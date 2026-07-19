#!/usr/bin/env python3
"""One-command pipeline: scan comment authors, then import their default favorites."""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT_DIR / ".local" / "bilibili_user_scan" / "outputs"
SCANNER = ROOT_DIR / "scripts" / "scan_bilibili_comment_users.py"
BATCH_IMPORTER = ROOT_DIR / "scripts" / "import_scanned_default_favorites.py"

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"
GRAY = "\033[90m"


def banner() -> None:
    print()
    print(f"{MAGENTA}{BOLD}╭────────────────────────────────────────────╮{RESET}")
    print(f"{MAGENTA}{BOLD}│{RESET}  {BOLD}审美者 B站一键采矿流水线{RESET}  {DIM}Scan → Import{RESET}  {MAGENTA}{BOLD}│{RESET}")
    print(f"{MAGENTA}{BOLD}╰────────────────────────────────────────────╯{RESET}")
    print(f"{DIM}  一个命令：扫评论用户、找默认收藏夹、预览或写入 Supabase。{RESET}\n")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="扫描视频评论用户，并把命中的默认收藏夹交给批量导入器。默认只预览，不写库。"
    )
    parser.add_argument("video", help="BV 号或 B站视频链接")
    parser.add_argument("--login", action="store_true", help="强制重新扫码登录")
    parser.add_argument("--comment-pages", type=int, default=5, help="扫描评论页数，默认 5")
    parser.add_argument("--page-size", type=int, default=20, help="每页评论数，默认 20")
    parser.add_argument("--user-limit", type=int, default=120, help="最多扫描多少个去重用户，默认 120")
    parser.add_argument("--comment-delay", default="0.8,1.8", help="评论分页延迟，如 0.8,1.8")
    parser.add_argument("--user-delay", default="1.5,3.5", help="用户主页扫描延迟，如 1.5,3.5")
    parser.add_argument("--priority", default="HIGH_VALUE", help="导入筛选 priority，默认 HIGH_VALUE")
    parser.add_argument("--include-visible", action="store_true", help="导入时同时纳入 VISIBLE 和 HIGH_VALUE")
    parser.add_argument("--min-count", type=int, default=101, help="默认收藏夹数量下限，默认 101")
    parser.add_argument("--skip", type=int, default=0, help="导入时跳过排序后的前 N 个收藏夹")
    parser.add_argument(
        "--exclude-fid",
        action="append",
        default=[],
        help="导入时排除某个收藏夹 ID；可重复传入多次",
    )
    parser.add_argument("--limit", type=int, default=5, help="本次最多处理几个收藏夹，默认 5；0 表示不限制")
    parser.add_argument("--commit", action="store_true", help="真正写入 Supabase；不加则只预览")
    parser.add_argument("--yes", action="store_true", help="确认执行批量写入；必须和 --commit 一起使用")
    parser.add_argument("--fresh", action="store_true", help="导入收藏夹时忽略本机续传点")
    parser.add_argument("--importer-delay", type=float, default=1.2, help="单个收藏夹分页读取间隔，默认 1.2")
    parser.add_argument("--batch-delay", type=float, default=3.0, help="收藏夹之间间隔，默认 3")
    parser.add_argument("--user", help="传给收藏夹导入器的采样发布者 username/UUID")
    parser.add_argument("--channel", help="传给收藏夹导入器的频道名")
    return parser


def run_checked(command: list[str], *, input_text: str | None = None) -> int:
    completed = subprocess.run(command, cwd=ROOT_DIR, input=input_text, text=True, check=False)
    return completed.returncode


def main() -> int:
    args = build_parser().parse_args()
    banner()

    if args.commit and not args.yes:
        print(f"  {RED}×{RESET}  写库需要同时传入 --commit --yes。当前未执行。")
        return 2

    if not SCANNER.exists():
        print(f"  {RED}×{RESET}  找不到扫描器：{SCANNER}")
        return 1
    if not BATCH_IMPORTER.exists():
        print(f"  {RED}×{RESET}  找不到批量导入器：{BATCH_IMPORTER}")
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    prefix = f"pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    scan_csv = OUTPUT_DIR / f"{prefix}.csv"

    print(f"{CYAN}{BOLD}━━ 1/2 扫评论与默认收藏夹 {RESET}{GRAY}{'━' * 22}{RESET}")
    scan_command = [
        sys.executable,
        "-u",
        str(SCANNER),
        args.video,
        "--comment-pages",
        str(args.comment_pages),
        "--page-size",
        str(args.page_size),
        "--user-limit",
        str(args.user_limit),
        "--comment-delay",
        args.comment_delay,
        "--user-delay",
        args.user_delay,
        "--output-prefix",
        prefix,
    ]
    if args.login:
        scan_command.append("--login")

    scan_code = run_checked(scan_command)
    if scan_code != 0:
        print(f"  {RED}×{RESET}  扫描失败，已停止。code={scan_code}")
        return scan_code
    if not scan_csv.exists():
        print(f"  {RED}×{RESET}  扫描结束但没有找到输出 CSV：{scan_csv}")
        return 1

    print()
    print(f"{CYAN}{BOLD}━━ 2/2 默认收藏夹入库 {'写入' if args.commit else '预览'} {RESET}{GRAY}{'━' * 18}{RESET}")
    import_command = [
        sys.executable,
        "-u",
        str(BATCH_IMPORTER),
        str(scan_csv),
        "--priority",
        args.priority,
        "--min-count",
        str(args.min_count),
        "--skip",
        str(args.skip),
        "--limit",
        str(args.limit),
        "--delay",
        str(args.batch_delay),
        "--importer-delay",
        str(args.importer_delay),
    ]
    if args.include_visible:
        import_command.append("--include-visible")
    for favorite_id in args.exclude_fid:
        import_command.extend(["--exclude-fid", favorite_id])
    if args.fresh:
        import_command.append("--fresh")
    if args.user:
        import_command.extend(["--user", args.user])
    if args.channel:
        import_command.extend(["--channel", args.channel])
    if args.commit:
        import_command.extend(["--commit", "--yes"])

    import_code = run_checked(import_command)

    print()
    print(f"{CYAN}{BOLD}━━ 流水线完成 {RESET}{GRAY}{'━' * 32}{RESET}")
    print(f"  扫描文件     {scan_csv}")
    print(f"  模式         {'写入 Supabase' if args.commit else '仅预览'}")
    print(f"  状态         {GREEN + '成功' + RESET if import_code == 0 else RED + '失败' + RESET}")
    return import_code


if __name__ == "__main__":
    raise SystemExit(main())
