#!/usr/bin/env python3
"""將 B 站公開收藏夾批次匯入審美者的影片、採樣與頻道資料。"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable
from urllib.parse import urlencode

import certifi
import requests


BILIBILI_FAVORITE_API = "https://api.bilibili.com/x/v3/fav/resource/list"
DEFAULT_ENV_FILE = Path(__file__).resolve().parents[1] / ".env.local"
DEFAULT_CHANNEL_NAME = "B站2021"
DEFAULT_PAGE_SIZE = 20
DEFAULT_BATCH_SIZE = 40
DEFAULT_CHECKPOINT_DIR = Path(__file__).resolve().parents[1] / ".local"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 Chrome/125 Safari/537.36"
)
SPINNER_FRAMES = ("⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏")


def batched(items: list[Any], size: int) -> Iterable[list[Any]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def save_env_value(path: Path, key: str, value: str) -> None:
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    replacement = f"{key}={value}"
    replaced = False
    updated: list[str] = []

    for line in lines:
        if line.strip().startswith(f"{key}="):
            updated.append(replacement)
            replaced = True
        else:
            updated.append(line)

    if not replaced:
        if updated and updated[-1].strip():
            updated.append("")
        updated.append(replacement)

    path.write_text("\n".join(updated) + "\n", encoding="utf-8")


def parse_media_id(source: str) -> str:
    match = re.search(r"(?:[?&]fid=|^)(\d+)", source.strip())
    if not match:
        raise ValueError("請輸入收藏夾 ID，或包含 fid 的完整收藏夾連結。")
    return match.group(1)


def iso_from_epoch(value: Any) -> str | None:
    try:
        timestamp = int(value)
    except (TypeError, ValueError):
        return None
    if timestamp <= 0:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()


def is_2021_or_earlier(value: Any) -> bool:
    try:
        timestamp = int(value)
    except (TypeError, ValueError):
        return False
    if timestamp <= 0:
        return False
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).year <= 2021


class TerminalUI:
    def __init__(self) -> None:
        self.interactive = sys.stdout.isatty()
        self.frame_index = 0
        self.last_width = 0

    def _rewrite(self, text: str) -> None:
        if not self.interactive:
            print(text)
            return
        padding = " " * max(0, self.last_width - len(text))
        sys.stdout.write(f"\r{text}{padding}")
        sys.stdout.flush()
        self.last_width = len(text)

    def clear_line(self) -> None:
        if self.interactive and self.last_width:
            sys.stdout.write("\r" + " " * self.last_width + "\r")
            sys.stdout.flush()
        self.last_width = 0

    def spin(self, text: str) -> None:
        frame = SPINNER_FRAMES[self.frame_index % len(SPINNER_FRAMES)]
        self.frame_index += 1
        self._rewrite(f"  {frame}  {text}")

    def progress(self, label: str, current: int, total: int) -> None:
        width = 24
        ratio = 1 if total == 0 else min(1, current / total)
        filled = round(width * ratio)
        bar = "█" * filled + "░" * (width - filled)
        self._rewrite(f"  {label:<8} {bar}  {current:>4}/{total:<4}")

    def done(self, text: str) -> None:
        self.clear_line()
        print(f"  ✓  {text}")

    def warn(self, text: str) -> None:
        self.clear_line()
        print(f"  !  {text}")

    def title(self, text: str) -> None:
        self.clear_line()
        print(f"\n━━ {text} {'━' * max(2, 38 - len(text))}")


def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: Any = None,
    retries: int = 5,
    on_retry: Callable[[int, int, float, Exception], None] | None = None,
) -> Any:
    request_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        **(headers or {}),
    }
    if body is not None:
        request_headers["Content-Type"] = "application/json"

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.request(
                method,
                url,
                headers=request_headers,
                json=body,
                timeout=(12, 35),
                verify=certifi.where(),
            )
            if not response.ok:
                raise RuntimeError(f"HTTP {response.status_code}: {response.text[:500]}")
            if not response.text:
                return None
            return response.json()
        except (requests.RequestException, ValueError, RuntimeError) as error:
            last_error = error
            if attempt < retries:
                wait_seconds = min(20.0, 1.5 * (2 ** (attempt - 1))) + random.uniform(0.1, 0.8)
                if on_retry:
                    on_retry(attempt, retries, wait_seconds, error)
                time.sleep(wait_seconds)

    raise RuntimeError(f"網路請求失敗：{last_error}")


class SupabaseRest:
    def __init__(self, url: str, secret_key: str) -> None:
        self.base_url = url.rstrip("/")
        self.headers = {
            "apikey": secret_key,
            "Authorization": f"Bearer {secret_key}",
            "User-Agent": "shenmei-local-importer/2.0",
        }

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        query = urlencode(params, safe="(),.*")
        result = request_json(
            f"{self.base_url}/rest/v1/{table}?{query}",
            headers=self.headers,
        )
        return result if isinstance(result, list) else []

    def insert(
        self,
        table: str,
        rows: list[dict[str, Any]],
        *,
        on_conflict: str | None = None,
        ignore_duplicates: bool = False,
    ) -> list[dict[str, Any]]:
        if not rows:
            return []
        params = {"on_conflict": on_conflict} if on_conflict else {}
        query = f"?{urlencode(params)}" if params else ""
        prefer = "return=representation"
        if ignore_duplicates:
            prefer = f"resolution=ignore-duplicates,{prefer}"
        elif on_conflict:
            prefer = f"resolution=merge-duplicates,{prefer}"
        result = request_json(
            f"{self.base_url}/rest/v1/{table}{query}",
            method="POST",
            headers={**self.headers, "Prefer": prefer},
            body=rows,
        )
        return result if isinstance(result, list) else []


@dataclass
class FavoriteVideo:
    bvid: str
    title: str
    payload: dict[str, Any]
    pubtime: int | None
    favorite_time: int | None


@dataclass
class ImportPreview:
    declared_count: int
    accessible_count: int
    invalid_count: int
    existing_video_count: int
    new_video_count: int
    existing_post_count: int
    new_post_count: int
    channel_candidate_count: int
    new_channel_link_count: int
    channel_conflict_count: int


def fetch_favorite_page(
    media_id: str,
    page: int,
    ui: TerminalUI,
) -> tuple[dict[str, Any], list[dict[str, Any]], bool]:
    query = urlencode(
        {
            "media_id": media_id,
            "pn": page,
            "ps": DEFAULT_PAGE_SIZE,
            "order": "mtime",
            "type": 0,
            "tid": 0,
            "platform": "web",
        }
    )
    def report_retry(attempt: int, retries: int, wait: float, error: Exception) -> None:
        error_name = type(error).__name__
        ui.spin(
            f"第 {page} 頁連線中斷，{wait:.1f} 秒後重試 "
            f"（{attempt}/{retries - 1}，{error_name}）"
        )

    response = request_json(
        f"{BILIBILI_FAVORITE_API}?{query}",
        headers={
            "Referer": f"https://space.bilibili.com/0/favlist?fid={media_id}",
            "Origin": "https://space.bilibili.com",
            "Connection": "close",
        },
        retries=8,
        on_retry=report_retry,
    )
    if response.get("code") != 0:
        raise RuntimeError(
            f"B 站拒絕第 {page} 頁：{response.get('message')}（code {response.get('code')}）"
        )
    data = response.get("data") or {}
    return data.get("info") or {}, data.get("medias") or [], bool(data.get("has_more"))


def checkpoint_path(media_id: str) -> Path:
    return DEFAULT_CHECKPOINT_DIR / f"favorite-{media_id}.json"


def serialize_video(video: FavoriteVideo) -> dict[str, Any]:
    return {
        "bvid": video.bvid,
        "title": video.title,
        "payload": video.payload,
        "pubtime": video.pubtime,
        "favorite_time": video.favorite_time,
    }


def deserialize_video(value: dict[str, Any]) -> FavoriteVideo:
    return FavoriteVideo(
        bvid=value["bvid"],
        title=value["title"],
        payload=value["payload"],
        pubtime=value.get("pubtime"),
        favorite_time=value.get("favorite_time"),
    )


def load_checkpoint(media_id: str) -> dict[str, Any] | None:
    path = checkpoint_path(media_id)
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if value.get("media_id") != media_id:
        return None
    return value


def save_checkpoint(
    media_id: str,
    folder_info: dict[str, Any],
    accessible_count: int,
    next_page: int,
    videos: Iterable[FavoriteVideo],
    *,
    fetch_complete: bool,
) -> None:
    path = checkpoint_path(media_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(".tmp")
    payload = {
        "media_id": media_id,
        "folder_info": folder_info,
        "accessible_count": accessible_count,
        "next_page": next_page,
        "fetch_complete": fetch_complete,
        "videos": [serialize_video(video) for video in videos],
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    temporary_path.write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )
    temporary_path.replace(path)


def clear_checkpoint(media_id: str) -> None:
    path = checkpoint_path(media_id)
    if path.exists():
        path.unlink()


def normalize_video(raw: dict[str, Any], media_id: str, folder_title: str) -> FavoriteVideo | None:
    bvid = raw.get("bvid") or raw.get("bv_id")
    title = (raw.get("title") or "").strip()
    if not bvid or not title or title == "已失效视频" or raw.get("attr", 0) != 0:
        return None

    owner = raw.get("upper") or {}
    stats = raw.get("cnt_info") or {}
    cover_url = raw.get("cover") or None
    duration = raw.get("duration") or None
    pubtime = raw.get("pubtime") or None
    favorite_time = raw.get("fav_time") or None

    return FavoriteVideo(
        bvid=bvid,
        title=title,
        pubtime=int(pubtime) if pubtime else None,
        favorite_time=int(favorite_time) if favorite_time else None,
        payload={
            "bvid": bvid,
            "source_platform": "bilibili",
            "external_id": bvid,
            "source_url": f"https://www.bilibili.com/video/{bvid}",
            "title": title,
            "cover": cover_url,
            "cover_url": cover_url,
            "up_name": owner.get("name") or None,
            "author_name": owner.get("name") or None,
            "up_mid": owner.get("mid") or None,
            "duration": duration,
            "duration_seconds": duration,
            "play_count": stats.get("play") or None,
            "fav_time": favorite_time,
            "published_at": iso_from_epoch(pubtime),
            "status": "published",
            "added_by": f"B站收藏夾導入:{media_id}",
            "metadata": {
                "import_source": "bilibili_public_favorite",
                "favorite_media_id": media_id,
                "favorite_title": folder_title,
                "bilibili_aid": raw.get("id"),
                "bilibili_pubtime": pubtime,
                "favorite_time": favorite_time,
            },
        },
    )


def fetch_all_favorite_videos(
    media_id: str,
    ui: TerminalUI,
    delay: float,
    *,
    fresh: bool = False,
) -> tuple[dict[str, Any], list[FavoriteVideo], int]:
    saved = None if fresh else load_checkpoint(media_id)
    if saved:
        page = max(1, int(saved.get("next_page") or 1))
        folder_info = saved.get("folder_info") or {}
        accessible_count = int(saved.get("accessible_count") or 0)
        saved_videos = [deserialize_video(item) for item in saved.get("videos") or []]
        videos_by_bvid = {video.bvid: video for video in saved_videos}
        if saved.get("fetch_complete"):
            ui.done(f"沿用完整讀取紀錄，共 {len(videos_by_bvid)} 支可播放影片")
            return folder_info, list(videos_by_bvid.values()), accessible_count
        ui.done(
            f"找到第 {page} 頁續傳點，保留前面 {len(videos_by_bvid)} 支影片"
        )
    else:
        page = 1
        folder_info: dict[str, Any] = {}
        accessible_count = 0
        videos_by_bvid: dict[str, FavoriteVideo] = {}

    while True:
        ui.spin(f"正在讀取收藏夾第 {page} 頁……")
        info, raw_items, has_more = fetch_favorite_page(media_id, page, ui)
        if not folder_info:
            folder_info = info
        accessible_count += len(raw_items)
        for item in raw_items:
            normalized = normalize_video(item, media_id, folder_info.get("title") or "")
            if normalized:
                videos_by_bvid[normalized.bvid] = normalized
        ui.spin(
            f"第 {page} 頁完成，已收集 {len(videos_by_bvid)} 支可播放影片"
        )
        next_page = page + 1 if has_more else page
        save_checkpoint(
            media_id,
            folder_info,
            accessible_count,
            next_page,
            videos_by_bvid.values(),
            fetch_complete=not has_more,
        )
        if not has_more:
            break
        page += 1
        time.sleep(max(0, delay) + random.uniform(0.05, 0.35))

    ui.done(f"收藏夾讀取完成，共 {len(videos_by_bvid)} 支可播放影片")
    return folder_info, list(videos_by_bvid.values()), accessible_count


def select_in_batches(
    database: SupabaseRest,
    table: str,
    field: str,
    values: list[Any],
    select: str,
    *,
    extra: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for group in batched(values, 50):
        params = {
            "select": select,
            field: f"in.({','.join(str(value) for value in group)})",
            **(extra or {}),
        }
        rows.extend(database.select(table, params))
    return rows


def resolve_profile(
    database: SupabaseRest,
    configured_user: str | None,
    env_path: Path,
) -> dict[str, Any]:
    if configured_user:
        field = "id" if re.fullmatch(r"[0-9a-fA-F-]{36}", configured_user) else "username"
        rows = database.select(
            "profiles",
            {"select": "id,username,display_name,role", field: f"eq.{configured_user}", "limit": "1"},
        )
        if not rows:
            raise RuntimeError(f"找不到採樣發布者：{configured_user}")
        return rows[0]

    profiles = database.select(
        "profiles",
        {
            "select": "id,username,display_name,role",
            "role": "in.(aesthete,super_admin)",
            "order": "username.asc",
            "limit": "100",
        },
    )
    if not profiles:
        raise RuntimeError("目前沒有可向頻道採樣的審美者或超管帳號。")

    print("\n請選擇這批採樣的發布者：")
    for index, profile in enumerate(profiles, start=1):
        name = profile.get("display_name") or profile.get("username")
        print(f"  {index:>2}. {name}（{profile.get('username')}）")

    while True:
        choice = input("輸入序號：").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(profiles):
            profile = profiles[int(choice) - 1]
            break
        print("請輸入列表中的正確序號。")

    save_default = input("保存為以後的預設發布者？[Y/n] ").strip().lower()
    if save_default in ("", "y", "yes"):
        save_env_value(env_path, "SHENMEI_IMPORT_USERNAME", profile["username"])
        print("  ✓  已保存；下次只需要輸入收藏夾 ID。")
    return profile


def find_channel(database: SupabaseRest, channel_name: str) -> dict[str, Any]:
    channels = database.select(
        "modules",
        {"select": "id,name,slug,status", "status": "eq.active", "order": "sort_order.asc"},
    )
    for channel in channels:
        if channel.get("name") == channel_name:
            return channel
    raise RuntimeError(f"找不到啟用中的「{channel_name}」頻道，請先確認頻道名稱。")


def build_post_payload(profile_id: str, video_id: int, video: FavoriteVideo) -> dict[str, Any]:
    created_at = iso_from_epoch(video.favorite_time)
    payload: dict[str, Any] = {
        "user_id": profile_id,
        "video_id": video_id,
        "note": f"收藏夾批次採樣｜{video.title}",
        "visibility": "public",
        "status": "published",
    }
    if created_at:
        payload["created_at"] = created_at
    return payload


def render_preview(
    folder_title: str,
    profile: dict[str, Any],
    channel: dict[str, Any],
    preview: ImportPreview,
) -> None:
    profile_name = profile.get("display_name") or profile.get("username")
    print(f"  收藏夾       {folder_title}")
    print(f"  發布者       {profile_name}（{profile.get('username')}）")
    print(f"  可播放       {preview.accessible_count} 支")
    print(f"  失效/隱藏    {preview.invalid_count} 支")
    print(f"  新增影片     {preview.new_video_count} 支")
    print(f"  已有影片     {preview.existing_video_count} 支")
    print(f"  新增採樣     {preview.new_post_count} 條")
    print(f"  已有採樣     {preview.existing_post_count} 條")
    print(f"  {channel['name']:<10} {preview.channel_candidate_count} 條符合年份")
    print(f"  待歸頻道     {preview.new_channel_link_count} 條")
    if preview.channel_conflict_count:
        print(f"  頻道衝突     {preview.channel_conflict_count} 條（保留原頻道）")


def insert_with_progress(
    database: SupabaseRest,
    table: str,
    rows: list[dict[str, Any]],
    ui: TerminalUI,
    label: str,
    *,
    on_conflict: str | None = None,
    ignore_duplicates: bool = False,
) -> int:
    if not rows:
        ui.done(f"{label}無需新增")
        return 0

    inserted = 0
    total = len(rows)
    ui.progress(label, 0, total)
    for group in batched(rows, DEFAULT_BATCH_SIZE):
        result = database.insert(
            table,
            group,
            on_conflict=on_conflict,
            ignore_duplicates=ignore_duplicates,
        )
        inserted += len(result)
        ui.progress(label, min(total, inserted), total)
    ui.done(f"{label}完成，新增 {inserted} 條")
    return inserted


def main() -> int:
    parser = argparse.ArgumentParser(
        description="將 B 站公開收藏夾匯入審美者的 videos、posts 與頻道關聯。"
    )
    parser.add_argument("source", nargs="?", help="收藏夾 ID 或包含 fid 的完整連結")
    parser.add_argument("--user", help="採樣發布者的審美號或 UUID")
    parser.add_argument("--channel", default=DEFAULT_CHANNEL_NAME, help="2021 年及以前影片歸入的頻道")
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE, help="Supabase 環境檔")
    parser.add_argument("--delay", type=float, default=0.9, help="讀取 B 站分頁的間隔秒數")
    parser.add_argument("--fresh", action="store_true", help="忽略本機續傳點並從第一頁重新讀取")
    parser.add_argument("--yes", action="store_true", help="跳過最後確認並直接寫入")
    args = parser.parse_args()

    print("\n╭────────────────────────────────────────╮")
    print("│       審美者 · B站收藏夾採樣器         │")
    print("╰────────────────────────────────────────╯")

    source = (args.source or "").strip()
    if not source:
        source = input("請輸入收藏夾 ID 或完整連結：").strip()
    media_id = parse_media_id(source)

    env = parse_env_file(args.env_file)
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    secret_key = (
        env.get("SUPABASE_SECRET_KEY")
        or os.getenv("SUPABASE_SECRET_KEY")
        or env.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )
    if not supabase_url or not secret_key:
        parser.error("需要在 .env.local 配置 Supabase URL 與 Secret Key。")

    database = SupabaseRest(supabase_url, secret_key)
    ui = TerminalUI()

    ui.title("連接與身份")
    configured_user = args.user or env.get("SHENMEI_IMPORT_USERNAME") or env.get("SHENMEI_IMPORT_USER_ID")
    profile = resolve_profile(database, configured_user, args.env_file)
    channel = find_channel(database, args.channel)
    ui.done(f"發布者與「{channel['name']}」頻道已就緒")

    ui.title("讀取 B站收藏夾")
    folder_info, videos, raw_accessible_count = fetch_all_favorite_videos(
        media_id,
        ui,
        args.delay,
        fresh=args.fresh,
    )
    bvids = [video.bvid for video in videos]

    ui.title("分析 Supabase 現況")
    ui.spin("正在比對已有影片……")
    existing_video_rows = select_in_batches(
        database,
        "videos",
        "external_id",
        bvids,
        "id,external_id",
        extra={"source_platform": "eq.bilibili"},
    )
    video_id_by_bvid = {row["external_id"]: row["id"] for row in existing_video_rows}
    new_videos = [video for video in videos if video.bvid not in video_id_by_bvid]

    existing_posts = select_in_batches(
        database,
        "posts",
        "video_id",
        list(video_id_by_bvid.values()),
        "id,video_id",
        extra={"user_id": f"eq.{profile['id']}", "status": "neq.deleted"},
    ) if video_id_by_bvid else []
    existing_post_by_video_id = {row["video_id"]: row for row in existing_posts}
    new_post_count = sum(
        1
        for video in videos
        if video.bvid not in video_id_by_bvid
        or video_id_by_bvid[video.bvid] not in existing_post_by_video_id
    )

    existing_post_ids = [row["id"] for row in existing_posts]
    existing_links = select_in_batches(
        database,
        "post_modules",
        "post_id",
        existing_post_ids,
        "post_id,module_id",
    ) if existing_post_ids else []
    existing_link_by_post = {row["post_id"]: row["module_id"] for row in existing_links}

    channel_candidates = [video for video in videos if is_2021_or_earlier(video.pubtime)]
    new_channel_link_count = 0
    channel_conflict_count = 0
    for video in channel_candidates:
        video_id = video_id_by_bvid.get(video.bvid)
        post = existing_post_by_video_id.get(video_id) if video_id else None
        if not post:
            new_channel_link_count += 1
            continue
        linked_module_id = existing_link_by_post.get(post["id"])
        if not linked_module_id:
            new_channel_link_count += 1
        elif linked_module_id != channel["id"]:
            channel_conflict_count += 1

    declared_count = int(folder_info.get("media_count") or raw_accessible_count)
    preview = ImportPreview(
        declared_count=declared_count,
        accessible_count=len(videos),
        invalid_count=max(0, declared_count - len(videos)),
        existing_video_count=len(existing_video_rows),
        new_video_count=len(new_videos),
        existing_post_count=len(existing_posts),
        new_post_count=new_post_count,
        channel_candidate_count=len(channel_candidates),
        new_channel_link_count=new_channel_link_count,
        channel_conflict_count=channel_conflict_count,
    )
    ui.done("去重、採樣與年份分類分析完成")

    ui.title("導入預覽")
    render_preview(folder_info.get("title") or media_id, profile, channel, preview)

    if not args.yes:
        confirmation = input("\n確認開始寫入？輸入 YES：").strip()
        if confirmation != "YES":
            print("已取消，資料庫沒有任何變更。")
            return 0

    ui.title("寫入影片資料")
    insert_with_progress(
        database,
        "videos",
        [video.payload for video in new_videos],
        ui,
        "影片",
        on_conflict="source_platform,external_id",
        ignore_duplicates=True,
    )

    ui.spin("重新取得影片 ID……")
    all_video_rows = select_in_batches(
        database,
        "videos",
        "external_id",
        bvids,
        "id,external_id",
        extra={"source_platform": "eq.bilibili"},
    )
    video_id_by_bvid = {row["external_id"]: row["id"] for row in all_video_rows}
    ui.done("影片 ID 已對齊")

    ui.title("建立採樣動態")
    new_video_ids = [video_id_by_bvid[video.bvid] for video in new_videos]
    generated_posts = select_in_batches(
        database,
        "posts",
        "video_id",
        new_video_ids,
        "id,video_id,user_id,status",
        extra={"status": "neq.deleted"},
    ) if new_video_ids else []
    generated_posts_by_video_id: dict[int, list[dict[str, Any]]] = {}
    for post in generated_posts:
        generated_posts_by_video_id.setdefault(post["video_id"], []).append(post)

    video_by_id = {
        video_id_by_bvid[video.bvid]: video
        for video in new_videos
    }
    adopted_post_rows = []
    for video_id, video in video_by_id.items():
        candidates = generated_posts_by_video_id.get(video_id, [])
        if len(candidates) != 1 or candidates[0].get("user_id") == profile["id"]:
            continue
        adopted_post_rows.append({
            "id": candidates[0]["id"],
            **build_post_payload(profile["id"], video_id, video),
        })

    adopted_posts = 0
    if adopted_post_rows:
        ui.spin("正在接管資料庫自動建立的採樣……")
        adopted_posts = len(database.insert(
            "posts",
            adopted_post_rows,
            on_conflict="id",
        ))
        ui.done(f"已將 {adopted_posts} 條自動採樣轉交給所選發布者")

    all_existing_posts = select_in_batches(
        database,
        "posts",
        "video_id",
        list(video_id_by_bvid.values()),
        "id,video_id",
        extra={"user_id": f"eq.{profile['id']}", "status": "neq.deleted"},
    )
    existing_post_by_video_id = {row["video_id"]: row for row in all_existing_posts}
    post_rows = [
        build_post_payload(profile["id"], video_id_by_bvid[video.bvid], video)
        for video in videos
        if video_id_by_bvid[video.bvid] not in existing_post_by_video_id
    ]
    insert_with_progress(database, "posts", post_rows, ui, "採樣")

    ui.spin("重新取得採樣 ID……")
    all_posts = select_in_batches(
        database,
        "posts",
        "video_id",
        list(video_id_by_bvid.values()),
        "id,video_id",
        extra={"user_id": f"eq.{profile['id']}", "status": "neq.deleted"},
    )
    post_by_video_id = {row["video_id"]: row for row in all_posts}
    ui.done("採樣 ID 已對齊")

    ui.title(f"歸入「{channel['name']}」頻道")
    candidate_post_ids = [
        post_by_video_id[video_id_by_bvid[video.bvid]]["id"]
        for video in channel_candidates
        if video_id_by_bvid[video.bvid] in post_by_video_id
    ]
    current_links = select_in_batches(
        database,
        "post_modules",
        "post_id",
        candidate_post_ids,
        "post_id,module_id",
    ) if candidate_post_ids else []
    current_link_by_post = {row["post_id"]: row["module_id"] for row in current_links}

    module_rows: list[dict[str, Any]] = []
    final_conflicts = 0
    for post_id in candidate_post_ids:
        linked_module_id = current_link_by_post.get(post_id)
        if not linked_module_id:
            module_rows.append(
                {"post_id": post_id, "module_id": channel["id"], "added_by": profile["id"]}
            )
        elif linked_module_id != channel["id"]:
            final_conflicts += 1

    inserted_links = insert_with_progress(
        database,
        "post_modules",
        module_rows,
        ui,
        "歸檔",
        on_conflict="post_id,module_id",
        ignore_duplicates=True,
    )

    ui.title("採樣完成")
    print(f"  新增影片     {len(new_videos)} 支")
    print(f"  新增採樣     {len(post_rows) + adopted_posts} 條")
    print(f"  歸入頻道     {inserted_links} 條")
    print(f"  去重跳過     {len(videos) - len(new_videos)} 支已有影片")
    if final_conflicts:
        print(f"  保留原頻道   {final_conflicts} 條")
    clear_checkpoint(media_id)
    print("\n  ✦  收藏夾已經變成審美者裡可以流動的採樣了。\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n已中止。", file=sys.stderr)
        raise SystemExit(130)
    except (RuntimeError, ValueError) as error:
        print(f"\n失敗：{error}", file=sys.stderr)
        raise SystemExit(1)
