#!/usr/bin/env python3
"""Batch import default Bilibili favorite folders discovered by the comment scanner."""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
SCAN_OUTPUT_DIR = ROOT_DIR / ".local" / "bilibili_user_scan" / "outputs"
IMPORTER = ROOT_DIR / "scripts" / "import_bilibili_favorite.py"

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"
GRAY = "\033[90m"


@dataclass
class FavoriteCandidate:
    favorite_id: str
    owner_mid: str
    username: str
    priority: str
    default_count: int
    favorite_url: str
    source_file: Path


def banner() -> None:
    print()
    print(f"{MAGENTA}{BOLD}╭────────────────────────────────────────────╮{RESET}")
    print(f"{MAGENTA}{BOLD}│{RESET}  {BOLD}审美者 默认收藏夹批量入库器{RESET}  {DIM}Batch Import{RESET}  {MAGENTA}{BOLD}│{RESET}")
    print(f"{MAGENTA}{BOLD}╰────────────────────────────────────────────╯{RESET}")
    print(f"{DIM}  默认先预览；只有 --commit --yes 才会写 Supabase。{RESET}\n")


def latest_scan_file() -> Path:
    if not SCAN_OUTPUT_DIR.exists():
        raise RuntimeError(f"找不到扫描输出目录：{SCAN_OUTPUT_DIR}")
    files = sorted(
        [
            path
            for path in SCAN_OUTPUT_DIR.iterdir()
            if path.suffix.lower() in {".json", ".csv"} and "comment_users" in path.name
        ],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not files:
        raise RuntimeError(f"扫描输出目录里没有 comment_users CSV/JSON：{SCAN_OUTPUT_DIR}")
    return files[0]


def read_rows(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise RuntimeError(f"JSON 顶层必须是列表：{path}")
        return [row for row in payload if isinstance(row, dict)]

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def parse_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def collect_candidates(
    path: Path,
    *,
    priority: str,
    min_count: int,
    include_visible: bool,
    exclude_fids: set[str],
) -> list[FavoriteCandidate]:
    rows = read_rows(path)
    candidates_by_fid: dict[str, FavoriteCandidate] = {}

    for row in rows:
        favorite_id = str(row.get("default_favorite_id") or "").strip()
        if not favorite_id:
            continue
        if favorite_id in exclude_fids:
            continue

        row_priority = str(row.get("priority") or "").strip() or "NORMAL"
        default_count = parse_int(row.get("default_favorite_count"))
        if priority and row_priority != priority:
            if not include_visible or row_priority not in {"HIGH_VALUE", "VISIBLE"}:
                continue
        if default_count < min_count:
            continue

        if favorite_id not in candidates_by_fid:
            candidates_by_fid[favorite_id] = FavoriteCandidate(
                favorite_id=favorite_id,
                owner_mid=str(row.get("mid") or "").strip(),
                username=str(row.get("username") or "").strip(),
                priority=row_priority,
                default_count=default_count,
                favorite_url=str(row.get("default_favorite_url") or "").strip(),
                source_file=path,
            )

    return sorted(
        candidates_by_fid.values(),
        key=lambda item: (item.priority != "HIGH_VALUE", -item.default_count, item.favorite_id),
    )


def print_queue(candidates: list[FavoriteCandidate], limit: int) -> None:
    print(f"{CYAN}{BOLD}━━ 导入队列 {RESET}{GRAY}{'━' * 34}{RESET}")
    if not candidates:
        print(f"  {YELLOW}!{RESET}  没有符合条件的默认收藏夹。")
        return

    target = candidates[:limit] if limit > 0 else candidates
    for index, item in enumerate(target, start=1):
        print(
            f"  {index:>2}. {MAGENTA if item.priority == 'HIGH_VALUE' else GREEN}"
            f"{item.priority:<10}{RESET} fid={item.favorite_id:<12} "
            f"默认 {item.default_count:>4}  @{item.username or item.owner_mid}"
        )
    skipped = len(candidates) - len(target)
    if skipped:
        print(f"  {DIM}还有 {skipped} 个被 --limit 暂时跳过。{RESET}")


def run_importer(
    candidate: FavoriteCandidate,
    *,
    commit: bool,
    yes: bool,
    delay: float,
    importer_delay: float,
    fresh: bool,
    user: str | None,
    channel: str | None,
) -> int:
    command = [
        sys.executable,
        "-u",
        str(IMPORTER),
        candidate.favorite_id,
        "--delay",
        str(importer_delay),
    ]
    if fresh:
        command.append("--fresh")
    if user:
        command.extend(["--user", user])
    if channel:
        command.extend(["--channel", channel])
    if commit:
        command.append("--yes")
    else:
        command.append("--preview")

    label = "写入" if commit else "预览"
    print()
    print(
        f"{CYAN}{BOLD}━━ {label} {candidate.favorite_id} {RESET}"
        f"{DIM}@{candidate.username or candidate.owner_mid} · 默认 {candidate.default_count}{RESET}"
    )

    completed = subprocess.run(command, cwd=ROOT_DIR, check=False)

    if completed.returncode == 0:
        print(f"  {GREEN}✓{RESET}  {label}完成：fid={candidate.favorite_id}")
    else:
        print(f"  {RED}×{RESET}  {label}失败：fid={candidate.favorite_id} code={completed.returncode}")

    if delay > 0:
        time.sleep(delay)
    return completed.returncode


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="从评论用户扫描结果中批量导入默认收藏夹。默认只预览，不写库。"
    )
    parser.add_argument("scan_file", nargs="?", type=Path, help="扫描输出 CSV/JSON；不填则使用最新一份")
    parser.add_argument("--priority", default="HIGH_VALUE", help="筛选 priority，默认 HIGH_VALUE")
    parser.add_argument("--include-visible", action="store_true", help="同时纳入 VISIBLE 和 HIGH_VALUE")
    parser.add_argument("--min-count", type=int, default=101, help="默认收藏夹数量下限，默认 101")
    parser.add_argument("--skip", type=int, default=0, help="跳过排序后的前 N 个收藏夹")
    parser.add_argument(
        "--exclude-fid",
        action="append",
        default=[],
        help="排除某个收藏夹 ID；可重复传入多次",
    )
    parser.add_argument("--limit", type=int, default=5, help="本次最多处理几个收藏夹，0 表示不限制")
    parser.add_argument("--commit", action="store_true", help="真正写入 Supabase；不加则只跑预览")
    parser.add_argument("--yes", action="store_true", help="确认执行批量写入；必须和 --commit 一起使用")
    parser.add_argument("--fresh", action="store_true", help="传给单个导入器，忽略本机续传点")
    parser.add_argument("--user", help="传给单个导入器的采样发布者 username/UUID")
    parser.add_argument("--channel", help="传给单个导入器的频道名")
    parser.add_argument("--delay", type=float, default=3.0, help="每个收藏夹之间的间隔秒数，默认 3")
    parser.add_argument("--importer-delay", type=float, default=1.2, help="单个导入器读取 B站分页间隔，默认 1.2")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    banner()

    try:
        scan_file = args.scan_file or latest_scan_file()
        if not scan_file.exists():
            raise RuntimeError(f"扫描结果不存在：{scan_file}")
        if not IMPORTER.exists():
            raise RuntimeError(f"找不到导入器：{IMPORTER}")

        candidates = collect_candidates(
            scan_file,
            priority=args.priority,
            min_count=max(0, args.min_count),
            include_visible=args.include_visible,
            exclude_fids={str(fid).strip() for fid in args.exclude_fid if str(fid).strip()},
        )
        if args.skip > 0:
            candidates = candidates[args.skip :]
        print(f"  {GREEN}✓{RESET}  使用扫描结果：{scan_file}")
        print_queue(candidates, max(0, args.limit))
        if not candidates:
            return 0

        target = candidates[: args.limit] if args.limit > 0 else candidates
        if args.commit and not args.yes:
            print()
            print(f"  {RED}×{RESET}  写库需要同时传入 --commit --yes。当前未执行。")
            return 2

        if args.commit:
            print()
            print(f"  {YELLOW}!{RESET}  即将写入 {len(target)} 个收藏夹到 Supabase。")
        else:
            print()
            print(f"  {DIM}本次是预览模式：会展示每个收藏夹可新增数量，但最后输入 NO 取消写入。{RESET}")

        failures = 0
        for candidate in target:
            code = run_importer(
                candidate,
                commit=args.commit,
                yes=args.yes,
                delay=max(0, args.delay),
                importer_delay=max(0, args.importer_delay),
                fresh=args.fresh,
                user=args.user,
                channel=args.channel,
            )
            if code != 0:
                failures += 1

        print()
        print(f"{CYAN}{BOLD}━━ 批量完成 {RESET}{GRAY}{'━' * 34}{RESET}")
        print(f"  处理收藏夹   {len(target)}")
        print(f"  成功         {len(target) - failures}")
        print(f"  失败         {failures}")
        print(f"  模式         {'写入 Supabase' if args.commit else '仅预览'}")
        return 1 if failures else 0
    except Exception as error:
        print(f"  {RED}×{RESET}  {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
