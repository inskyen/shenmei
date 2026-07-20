#!/usr/bin/env python3
"""Scan Bilibili comment authors and mark users with visible favorite folders."""

from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from http.cookiejar import Cookie
from pathlib import Path
from typing import Any
import certifi
import requests


ROOT_DIR = Path(__file__).resolve().parents[2]
STATE_DIR = ROOT_DIR / ".local" / "bilibili_user_scan"
COOKIE_FILE = STATE_DIR / "cookies.json"
OUTPUT_DIR = STATE_DIR / "outputs"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 Chrome/125 Safari/537.36"
)

QR_GENERATE_API = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate"
QR_POLL_API = "https://passport.bilibili.com/x/passport-login/web/qrcode/poll"
VIDEO_VIEW_API = "https://api.bilibili.com/x/web-interface/view"
REPLY_API = "https://api.bilibili.com/x/v2/reply"
SPACE_CARD_API = "https://api.bilibili.com/x/web-interface/card"
FAVORITE_FOLDERS_API = "https://api.bilibili.com/x/v3/fav/folder/created/list-all"


RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[36m"
BLUE = "\033[34m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"
GRAY = "\033[90m"

SPINNER_FRAMES = ("⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏")
SCAN_QUOTES = (
    "正在拂开评论区的帘子",
    "正在听人群里的审美回声",
    "正在把主页卡片翻到收藏夹那一面",
    "正在标记疑似宝藏审美者",
    "正在等 B 站接口慢慢开门",
)


@dataclass
class CommentUser:
    mid: str
    username: str
    avatar: str
    sign: str
    level: int | None
    comment: str


@dataclass
class ScanResult:
    mid: str
    username: str
    space_url: str
    sign: str
    level: int | None
    comment: str
    favorite_visible: bool
    folder_count: int
    default_favorite_id: str
    default_favorite_title: str
    default_favorite_url: str
    import_command: str
    default_favorite_count: int | None
    priority: str
    favorite_error: str


class TerminalUI:
    def __init__(self, quiet: bool = False) -> None:
        self.quiet = quiet
        self.interactive = sys.stdout.isatty() and not quiet
        self.frame_index = 0
        self.last_width = 0

    def _line(self, text: str) -> None:
        if self.quiet:
            return
        print(text)

    def _rewrite(self, text: str) -> None:
        if self.quiet:
            return
        if not self.interactive:
            print(text)
            return
        padding = " " * max(0, self.last_width - visible_len(text))
        sys.stdout.write(f"\r{text}{padding}")
        sys.stdout.flush()
        self.last_width = visible_len(text)

    def clear(self) -> None:
        if self.interactive and self.last_width:
            sys.stdout.write("\r" + " " * self.last_width + "\r")
            sys.stdout.flush()
        self.last_width = 0

    def banner(self) -> None:
        if self.quiet:
            return
        print()
        print(f"{MAGENTA}{BOLD}╭────────────────────────────────────────────╮{RESET}")
        print(f"{MAGENTA}{BOLD}│{RESET}  {BOLD}审美者 B站评论区探针{RESET}  {DIM}Comment Aesthete Scanner{RESET}  {MAGENTA}{BOLD}│{RESET}")
        print(f"{MAGENTA}{BOLD}╰────────────────────────────────────────────╯{RESET}")
        print(f"{DIM}  Cookie 本地保存，默认只看公开可见信息。{RESET}\n")

    def section(self, text: str) -> None:
        self.clear()
        self._line(f"\n{CYAN}{BOLD}━━ {text} {RESET}{GRAY}{'━' * max(2, 34 - len(text))}{RESET}")

    def spin(self, text: str) -> None:
        frame = SPINNER_FRAMES[self.frame_index % len(SPINNER_FRAMES)]
        quote = SCAN_QUOTES[self.frame_index % len(SCAN_QUOTES)]
        self.frame_index += 1
        self._rewrite(f"  {CYAN}{frame}{RESET}  {text} {DIM}· {quote}{RESET}")

    def progress(self, label: str, current: int, total: int, suffix: str = "") -> None:
        width = 28
        ratio = 1 if total <= 0 else min(1, current / total)
        filled = round(width * ratio)
        bar = f"{GREEN}{'█' * filled}{GRAY}{'░' * (width - filled)}{RESET}"
        self._rewrite(f"  {label:<10} {bar} {current:>4}/{total:<4} {suffix}")

    def done(self, text: str) -> None:
        self.clear()
        self._line(f"  {GREEN}✓{RESET}  {text}")

    def warn(self, text: str) -> None:
        self.clear()
        self._line(f"  {YELLOW}!{RESET}  {text}")

    def hit(self, text: str) -> None:
        self.clear()
        self._line(f"  {MAGENTA}◆{RESET}  {text}")

    def fail(self, text: str) -> None:
        self.clear()
        self._line(f"  {RED}×{RESET}  {text}")


def visible_len(text: str) -> int:
    return len(re.sub(r"\033\[[0-9;]*m", "", text))


def ensure_dirs() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Referer": "https://www.bilibili.com/",
            "Accept": "application/json, text/plain, */*",
        }
    )
    return session


def cookie_to_dict(cookie: Cookie) -> dict[str, Any]:
    return {
        "name": cookie.name,
        "value": cookie.value,
        "domain": cookie.domain,
        "path": cookie.path,
        "expires": cookie.expires,
        "secure": cookie.secure,
    }


def save_cookies(session: requests.Session) -> None:
    ensure_dirs()
    cookies = [cookie_to_dict(cookie) for cookie in session.cookies]
    COOKIE_FILE.write_text(json.dumps(cookies, ensure_ascii=False, indent=2), encoding="utf-8")


def load_cookies(session: requests.Session) -> bool:
    if not COOKIE_FILE.exists():
        return False
    try:
        cookies = json.loads(COOKIE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False

    for item in cookies:
        session.cookies.set(
            item["name"],
            item["value"],
            domain=item.get("domain") or ".bilibili.com",
            path=item.get("path") or "/",
        )
    return True


def request_json(
    session: requests.Session,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    retries: int = 4,
    ui: TerminalUI | None = None,
) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = session.get(url, params=params, timeout=(10, 30), verify=certifi.where())
            if not response.ok:
                raise RuntimeError(f"HTTP {response.status_code}: {response.text[:300]}")
            payload = response.json()
            code = payload.get("code")
            if code not in (0, None):
                message = payload.get("message") or payload.get("msg") or "unknown"
                raise RuntimeError(f"Bilibili code={code}: {message}")
            return payload
        except (requests.RequestException, ValueError, RuntimeError) as error:
            last_error = error
            if attempt < retries:
                wait = min(12.0, 1.4 * (2 ** (attempt - 1))) + random.uniform(0.2, 0.9)
                if ui:
                    ui.spin(f"接口打了个盹，{wait:.1f}s 后重试 {attempt}/{retries}")
                time.sleep(wait)
    raise RuntimeError(str(last_error))


def login_by_qrcode(session: requests.Session, ui: TerminalUI) -> None:
    ui.section("扫码登录")
    payload = request_json(session, QR_GENERATE_API, ui=ui)
    data = payload.get("data") or {}
    qr_url = data.get("url")
    qr_key = data.get("qrcode_key")
    if not qr_url or not qr_key:
        raise RuntimeError("无法获取 B站二维码登录地址。")

    print_qr(qr_url)
    ui._line(f"\n  {DIM}请用 B站 App 扫码确认。登录成功后 Cookie 会保存到：{COOKIE_FILE}{RESET}")

    for _ in range(120):
        time.sleep(2)
        poll = request_json(session, QR_POLL_API, params={"qrcode_key": qr_key}, ui=ui)
        poll_data = poll.get("data") or {}
        code = poll_data.get("code")
        if code == 0:
            save_cookies(session)
            ui.done("登录成功，Cookie 已落盘。")
            return
        if code == 86090:
            ui.spin("已扫码，等待手机确认")
        elif code == 86101:
            ui.spin("等待扫码")
        elif code == 86038:
            raise RuntimeError("二维码已过期，请重新运行脚本。")
        else:
            ui.spin(f"等待登录状态 code={code}")

    raise RuntimeError("扫码登录等待超时。")


def print_qr(text: str) -> None:
    try:
        import qrcode
    except ImportError:
        print(f"\n  登录二维码地址：{text}")
        print("  如需终端二维码，可安装：python3 -m pip install qrcode")
        return

    qr = qrcode.QRCode(border=1)
    qr.add_data(text)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    print()
    for row in matrix:
        line = "".join("  " if cell else "██" for cell in row)
        print(f"  {line}")


def ensure_login(session: requests.Session, ui: TerminalUI, force_login: bool = False) -> None:
    loaded = load_cookies(session)
    if force_login or not loaded:
        login_by_qrcode(session, ui)
        return

    try:
        request_json(session, "https://api.bilibili.com/x/web-interface/nav", ui=ui)
        ui.done(f"已读取本地 Cookie：{COOKIE_FILE}")
    except RuntimeError:
        ui.warn("本地 Cookie 失效，重新扫码登录。")
        login_by_qrcode(session, ui)


def parse_bvid(source: str) -> str:
    value = source.strip()
    match = re.search(r"(BV[0-9A-Za-z]+)", value)
    if match:
        return match.group(1)
    raise ValueError("请输入 BV 号或包含 BV 号的视频链接。")


def get_video_aid(session: requests.Session, bvid: str, ui: TerminalUI) -> tuple[int, str]:
    payload = request_json(session, VIDEO_VIEW_API, params={"bvid": bvid}, ui=ui)
    data = payload.get("data") or {}
    aid = data.get("aid")
    title = data.get("title") or bvid
    if not aid:
        raise RuntimeError(f"无法解析 {bvid} 的 aid。")
    return int(aid), title


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def fetch_comment_users(
    session: requests.Session,
    aid: int,
    *,
    max_pages: int,
    page_size: int,
    delay: tuple[float, float],
    ui: TerminalUI,
) -> list[CommentUser]:
    users: dict[str, CommentUser] = {}
    for page in range(1, max_pages + 1):
        ui.progress("评论页", page, max_pages, f"{len(users)} users")
        payload = request_json(
            session,
            REPLY_API,
            params={"type": 1, "oid": aid, "pn": page, "ps": page_size, "sort": 2},
            ui=ui,
        )
        data = payload.get("data") or {}
        replies = data.get("replies") or []
        if not replies:
            ui.warn(f"第 {page} 页没有更多评论。")
            break

        for reply in replies:
            member = reply.get("member") or {}
            mid = str(member.get("mid") or "").strip()
            if not mid or mid in users:
                continue
            users[mid] = CommentUser(
                mid=mid,
                username=member.get("uname") or "",
                avatar=member.get("avatar") or "",
                sign=member.get("sign") or "",
                level=(member.get("level_info") or {}).get("current_level"),
                comment=clean_text((reply.get("content") or {}).get("message") or ""),
            )
        sleep_between(delay)

    ui.done(f"评论用户去重完成：{len(users)} 人")
    return list(users.values())


def fetch_profile(session: requests.Session, mid: str, ui: TerminalUI) -> dict[str, Any]:
    payload = request_json(session, SPACE_CARD_API, params={"mid": mid}, ui=ui)
    return payload.get("data") or {}


def fetch_folders(session: requests.Session, mid: str, ui: TerminalUI) -> list[dict[str, Any]]:
    payload = request_json(
        session,
        FAVORITE_FOLDERS_API,
        params={"up_mid": mid, "jsonp": "jsonp"},
        ui=ui,
    )
    data = payload.get("data")
    if isinstance(data, dict):
        folders = data.get("list") or []
    elif isinstance(data, list):
        folders = data
    else:
        folders = []
    return folders if isinstance(folders, list) else []


def media_count(folder: dict[str, Any]) -> int:
    for key in ("media_count", "count"):
        try:
            return int(folder.get(key) or 0)
        except (TypeError, ValueError):
            continue
    return 0


def folder_id(folder: dict[str, Any]) -> str:
    for key in ("id", "media_id", "fid"):
        value = folder.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def folder_title(folder: dict[str, Any]) -> str:
    return str(folder.get("title") or folder.get("name") or "").strip()


def is_default_folder(folder: dict[str, Any]) -> bool:
    title = folder_title(folder)
    attr = str(folder.get("attr") or "")
    fid = folder_id(folder)
    return "默认收藏夹" in title or title.lower() in {"default", "default favorite"} or attr == "0" or fid.endswith("1")


def analyze_user(session: requests.Session, user: CommentUser, ui: TerminalUI) -> ScanResult:
    favorite_visible = False
    favorite_error = ""
    folder_count = 0
    default_id = ""
    default_title = ""
    default_count: int | None = None
    username = user.username
    sign = user.sign
    level = user.level

    try:
        profile = fetch_profile(session, user.mid, ui)
        card = profile.get("card") or {}
        username = card.get("name") or username
        sign = card.get("sign") or sign
        level = (card.get("level_info") or {}).get("current_level") or level
    except RuntimeError as error:
        favorite_error = f"profile: {error}"

    try:
        folders = fetch_folders(session, user.mid, ui)
        folder_count = len(folders)
        favorite_visible = folder_count > 0
        default_candidates = [folder for folder in folders if is_default_folder(folder)]
        if not default_candidates and folders:
            default_candidates = [folders[0]]
        if default_candidates:
            default_folder = max(default_candidates, key=media_count)
            default_id = folder_id(default_folder)
            default_title = folder_title(default_folder)
            default_count = media_count(default_folder)
    except RuntimeError as error:
        favorite_error = str(error)

    priority = "NORMAL"
    if favorite_visible and default_count is not None and default_count > 100:
        priority = "HIGH_VALUE"
    elif favorite_visible:
        priority = "VISIBLE"

    return ScanResult(
        mid=user.mid,
        username=username,
        space_url=f"https://space.bilibili.com/{user.mid}",
        sign=clean_text(sign),
        level=level,
        comment=user.comment,
        favorite_visible=favorite_visible,
        folder_count=folder_count,
        default_favorite_id=default_id,
        default_favorite_title=default_title,
        default_favorite_url=(
            f"https://space.bilibili.com/{user.mid}/favlist?fid={default_id}"
            if default_id
            else ""
        ),
        import_command=(
            f"python3 scripts/import_bilibili_favorite.py {default_id}"
            if default_id
            else ""
        ),
        default_favorite_count=default_count,
        priority=priority,
        favorite_error=favorite_error,
    )


def scan_users(
    session: requests.Session,
    users: list[CommentUser],
    *,
    limit: int,
    delay: tuple[float, float],
    ui: TerminalUI,
) -> list[ScanResult]:
    target = users[:limit] if limit > 0 else users
    results: list[ScanResult] = []
    high_count = 0

    for index, user in enumerate(target, start=1):
        ui.progress("主页扫描", index, len(target), f"{user.username[:14]} high={high_count}")
        result = analyze_user(session, user, ui)
        results.append(result)
        if result.priority == "HIGH_VALUE":
            high_count += 1
            ui.hit(
                f"HIGH_VALUE @{result.username} 默认收藏夹 {result.default_favorite_count} 个 "
                f"{DIM}fid={result.default_favorite_id} {result.space_url}{RESET}"
            )
        elif result.priority == "VISIBLE":
            ui.done(f"VISIBLE @{result.username} 收藏夹公开，默认 {result.default_favorite_count or 0} 个")
        sleep_between(delay)

    ui.done(f"主页扫描完成：{len(results)} 人，重点标记 {high_count} 人")
    return results


def sleep_between(delay: tuple[float, float]) -> None:
    low, high = delay
    if high <= 0:
        return
    time.sleep(random.uniform(low, high))


def write_outputs(bvid: str, results: list[ScanResult], ui: TerminalUI) -> tuple[Path, Path]:
    ensure_dirs()
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return write_outputs_with_prefix(f"{bvid}_comment_users_{stamp}", results, ui)


def write_outputs_with_prefix(prefix: str, results: list[ScanResult], ui: TerminalUI) -> tuple[Path, Path]:
    ensure_dirs()
    safe_prefix = re.sub(r"[^0-9A-Za-z_.-]+", "_", prefix).strip("._") or "comment_users"
    csv_path = OUTPUT_DIR / f"{safe_prefix}.csv"
    json_path = OUTPUT_DIR / f"{safe_prefix}.json"

    rows = [result.__dict__ for result in results]
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    fields = [
        "priority",
        "mid",
        "username",
        "space_url",
        "favorite_visible",
        "default_favorite_id",
        "default_favorite_title",
        "default_favorite_url",
        "import_command",
        "default_favorite_count",
        "folder_count",
        "level",
        "sign",
        "comment",
        "favorite_error",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    ui.done(f"CSV 已保存：{csv_path}")
    ui.done(f"JSON 已保存：{json_path}")
    return csv_path, json_path


def priority_rank(result: ScanResult) -> int:
    return {"HIGH_VALUE": 0, "VISIBLE": 1, "NORMAL": 2}.get(result.priority, 3)


def parse_delay(value: str) -> tuple[float, float]:
    parts = value.split(",", 1)
    try:
        if len(parts) == 1:
            seconds = float(parts[0])
            return (seconds, seconds)
        low = float(parts[0])
        high = float(parts[1])
    except ValueError as error:
        raise argparse.ArgumentTypeError("delay 格式应为 1.0 或 1.0,3.0") from error
    if low < 0 or high < 0 or high < low:
        raise argparse.ArgumentTypeError("delay 必须满足 0 <= min <= max")
    return (low, high)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="登录 B站，扫描指定视频评论用户，并标记公开收藏夹和默认收藏夹大户。",
    )
    parser.add_argument("video", help="BV 号或 B站视频链接")
    parser.add_argument("--login", action="store_true", help="强制重新扫码登录并覆盖本地 Cookie")
    parser.add_argument("--comment-pages", type=int, default=5, help="扫描评论页数，默认 5")
    parser.add_argument("--page-size", type=int, default=20, help="每页评论数，默认 20")
    parser.add_argument("--user-limit", type=int, default=120, help="最多扫描多少个去重用户，0 表示不限制")
    parser.add_argument("--comment-delay", type=parse_delay, default=(0.8, 1.8), help="评论分页延迟，如 0.8,1.8")
    parser.add_argument("--user-delay", type=parse_delay, default=(1.5, 3.5), help="用户主页扫描延迟，如 1.5,3.5")
    parser.add_argument("--output-prefix", help="固定输出文件名前缀，供自动化编排使用")
    parser.add_argument("--quiet", action="store_true", help="减少终端动效输出")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    ui = TerminalUI(quiet=args.quiet)

    try:
        ensure_dirs()
        bvid = parse_bvid(args.video)
        session = make_session()
        ui.banner()
        ensure_login(session, ui, force_login=args.login)

        ui.section("视频解析")
        aid, title = get_video_aid(session, bvid, ui)
        ui.done(f"{title} {DIM}aid={aid} bvid={bvid}{RESET}")

        ui.section("评论区捕获")
        users = fetch_comment_users(
            session,
            aid,
            max_pages=max(1, args.comment_pages),
            page_size=max(1, min(args.page_size, 49)),
            delay=args.comment_delay,
            ui=ui,
        )
        if not users:
            ui.warn("没有抓到评论用户，任务结束。")
            return 0

        ui.section("主页与收藏夹扫描")
        results = scan_users(
            session,
            users,
            limit=args.user_limit,
            delay=args.user_delay,
            ui=ui,
        )

        ui.section("落盘")
        sorted_results = sorted(results, key=lambda item: (priority_rank(item), -(item.default_favorite_count or 0)))
        if args.output_prefix:
            write_outputs_with_prefix(args.output_prefix, sorted_results, ui)
        else:
            write_outputs(bvid, sorted_results, ui)

        high = sum(1 for item in results if item.priority == "HIGH_VALUE")
        visible = sum(1 for item in results if item.favorite_visible)
        ui.section("收工小结")
        ui._line(f"  {BOLD}扫描用户：{len(results)}{RESET}")
        ui._line(f"  {GREEN}收藏夹公开：{visible}{RESET}")
        ui._line(f"  {MAGENTA}默认收藏夹 >100：{high}{RESET}")
        ui._line(f"  {DIM}提示：这只读取公开可见信息，遇到风控就降低页数或增大 delay。{RESET}\n")
        return 0
    except KeyboardInterrupt:
        ui.fail("已中断。")
        return 130
    except Exception as error:
        ui.fail(str(error))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
