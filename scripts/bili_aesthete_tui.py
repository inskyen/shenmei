#!/usr/bin/env python3
"""Termux-friendly terminal dashboard for Bilibili comment scanning and favorite imports."""

from __future__ import annotations

import csv
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from rich import box
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Confirm, IntPrompt, Prompt
    from rich.table import Table
    from rich.text import Text

    RICH_AVAILABLE = True
except ImportError:
    box = None
    Console = None
    Panel = None
    Confirm = None
    IntPrompt = None
    Prompt = None
    Table = None
    Text = None
    RICH_AVAILABLE = False


ROOT_DIR = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT_DIR / ".local" / "bilibili_user_scan"
OUTPUT_DIR = STATE_DIR / "outputs"
STATE_FILE = STATE_DIR / "tui_state.json"
CANDIDATE_BOARD_FILE = STATE_DIR / "candidate_board.json"
SCANNER = ROOT_DIR / "scripts" / "bilibili" / "scan_comments.py"
BATCH_IMPORTER = ROOT_DIR / "scripts" / "bilibili" / "import_scanned_default_favorites.py"
FAVORITE_IMPORTER = ROOT_DIR / "scripts" / "bilibili" / "import_favorite.py"
DEFAULT_MIN_FAVORITE_COUNT = 50

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"
GRAY = "\033[90m"

USE_RICH = RICH_AVAILABLE and "--plain" not in sys.argv
if "--plain" in sys.argv:
    sys.argv.remove("--plain")
console = Console() if USE_RICH else None


@dataclass
class MenuState:
    last_scan_file: str = ""
    last_video: str = ""
    comment_pages: int = 5
    user_limit: int = 120
    import_limit: int = 3
    min_count: int = DEFAULT_MIN_FAVORITE_COUNT
    excluded_fids: list[str] | None = None

    def __post_init__(self) -> None:
        if self.excluded_fids is None:
            self.excluded_fids = []
        self.min_count = max(DEFAULT_MIN_FAVORITE_COUNT, parse_count(self.min_count))


def clear_screen() -> None:
    if USE_RICH:
        console.clear()
    elif sys.stdout.isatty():
        print("\033[2J\033[H", end="")


def ensure_dirs() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_state() -> MenuState:
    ensure_dirs()
    if not STATE_FILE.exists():
        return MenuState()
    try:
        payload = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return MenuState(**{key: value for key, value in payload.items() if key in MenuState.__annotations__})
    except (OSError, json.JSONDecodeError, TypeError):
        return MenuState()


def save_state(state: MenuState) -> None:
    ensure_dirs()
    STATE_FILE.write_text(json.dumps(state.__dict__, ensure_ascii=False, indent=2), encoding="utf-8")


def load_candidate_board() -> dict[str, dict[str, Any]]:
    ensure_dirs()
    if not CANDIDATE_BOARD_FILE.exists():
        return {}
    try:
        payload = json.loads(CANDIDATE_BOARD_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(payload, dict):
        return {}
    board = {str(fid): normalize_candidate_item(str(fid), item) for fid, item in payload.items() if isinstance(item, dict)}
    return board


def normalize_candidate_item(fid: str, item: dict[str, Any]) -> dict[str, Any]:
    normalized = {**item}
    normalized["fid"] = str(normalized.get("fid") or fid)
    normalized["status"] = normalized.get("status") or "candidate"
    normalized["library_status"] = normalized.get("library_status") or "pending"
    normalized["weight"] = parse_count(normalized.get("weight"))
    normalized["default_favorite_count"] = parse_count(normalized.get("default_favorite_count"))
    normalized["note"] = str(normalized.get("note") or "")
    return normalized


def save_candidate_board(board: dict[str, dict[str, Any]]) -> None:
    ensure_dirs()
    ordered = dict(sorted(
        board.items(),
        key=lambda item: (
            item[1].get("status") == "hidden",
            -int(item[1].get("weight") or 0),
            -int(item[1].get("default_favorite_count") or 0),
            item[0],
        ),
    ))
    CANDIDATE_BOARD_FILE.write_text(json.dumps(ordered, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_count(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def row_to_candidate(row: dict[str, Any], source_file: Path) -> dict[str, Any] | None:
    fid = str(row.get("default_favorite_id") or "").strip()
    if not fid:
        return None

    count = parse_count(row.get("default_favorite_count"))
    priority = str(row.get("priority") or "NORMAL")
    default_weight = count if priority == "HIGH_VALUE" else max(1, count // 2)
    now = datetime.now().isoformat(timespec="seconds")

    return {
        "fid": fid,
        "mid": str(row.get("mid") or "").strip(),
        "username": str(row.get("username") or "").strip(),
        "space_url": str(row.get("space_url") or "").strip(),
        "default_favorite_title": str(row.get("default_favorite_title") or "").strip(),
        "default_favorite_url": str(row.get("default_favorite_url") or "").strip(),
        "default_favorite_count": count,
        "priority": priority,
        "weight": default_weight,
        "status": "candidate",
        "library_status": "pending",
        "note": "",
        "source_files": [short_path(str(source_file))],
        "first_seen_at": now,
        "last_seen_at": now,
    }


def merge_scan_into_candidate_board(path: Path) -> tuple[int, int, int]:
    rows = read_rows(path)
    board = load_candidate_board()
    added = 0
    updated = 0

    for row in rows:
        candidate = row_to_candidate(row, path)
        if not candidate:
            continue
        fid = candidate["fid"]
        existing = board.get(fid)
        if not existing:
            board[fid] = candidate
            added += 1
            continue

        preserved = {
            "weight": existing.get("weight", candidate["weight"]),
            "status": existing.get("status", "candidate"),
            "library_status": existing.get("library_status", "pending"),
            "note": existing.get("note", ""),
            "first_seen_at": existing.get("first_seen_at", candidate["first_seen_at"]),
        }
        source_files = list(dict.fromkeys([
            *(existing.get("source_files") or []),
            short_path(str(path)),
        ]))
        board[fid] = {
            **existing,
            **candidate,
            **preserved,
            "source_files": source_files,
            "last_seen_at": candidate["last_seen_at"],
        }
        updated += 1

    save_candidate_board(board)
    return added, updated, len(board)


def banner(state: MenuState) -> None:
    clear_screen()
    if USE_RICH:
        grid = Table.grid(expand=True)
        grid.add_column(ratio=1)
        grid.add_column(justify="right")
        grid.add_row(
            "[bold magenta]审美者 B站采样台[/bold magenta]\n[dim]Termux Console · Scan → User/FID Board[/dim]",
            "[cyan]Bilibili[/cyan]\n[green]Supabase[/green]",
        )
        console.print(Panel(grid, border_style="magenta", box=box.ROUNDED))

        status = Table.grid(expand=True)
        status.add_column(ratio=1)
        status.add_column(ratio=1)
        status.add_row("[bold]最近视频[/bold]", state.last_video or "[dim]未设置[/dim]")
        status.add_row("[bold]最近结果[/bold]", short_path(state.last_scan_file) if state.last_scan_file else "[dim]未扫描[/dim]")
        status.add_row("[bold]扫描参数[/bold]", f"评论页 {state.comment_pages} · 用户 {state.user_limit} · 收藏下限 {state.min_count}")
        status.add_row("[bold]高级写库[/bold]", f"每次 {state.import_limit} 个 · 排除 {len(state.excluded_fids or [])} 个 fid")
        status.add_row("[bold]候选池[/bold]", short_path(str(CANDIDATE_BOARD_FILE)) if CANDIDATE_BOARD_FILE.exists() else "[dim]未建立[/dim]")
        console.print(Panel(status, title="当前状态", border_style="cyan", box=box.SIMPLE))
        return

    print(f"{MAGENTA}{BOLD}╭────────────────────────────────────────────╮{RESET}")
    print(f"{MAGENTA}{BOLD}│{RESET}  {BOLD}审美者 B站采样台{RESET}  {DIM}Termux Console{RESET}        {MAGENTA}{BOLD}│{RESET}")
    print(f"{MAGENTA}{BOLD}╰────────────────────────────────────────────╯{RESET}")
    print(f"{DIM}  输入 BV 号，扫描评论用户，整理高默认收藏夹用户和 fid。{RESET}")
    print()
    print(f"  最近视频     {state.last_video or DIM + '未设置' + RESET}")
    print(f"  最近结果     {short_path(state.last_scan_file) if state.last_scan_file else DIM + '未扫描' + RESET}")
    print(f"  扫描参数     评论页 {state.comment_pages} · 用户 {state.user_limit} · 收藏下限 {state.min_count}")
    print(f"  高级写库     每次 {state.import_limit} 个 · 排除 {len(state.excluded_fids or [])} 个 fid")
    print(f"  候选池       {short_path(str(CANDIDATE_BOARD_FILE)) if CANDIDATE_BOARD_FILE.exists() else DIM + '未建立' + RESET}")
    print()


def short_path(value: str) -> str:
    if not value:
        return ""
    path = Path(value)
    try:
        return str(path.relative_to(ROOT_DIR))
    except ValueError:
        return str(path)


def prompt(text: str, default: str = "") -> str:
    if USE_RICH:
        try:
            return Prompt.ask(text, default=default or None).strip()
        except EOFError:
            return default
    suffix = f" [{default}]" if default else ""
    try:
        value = input(f"{CYAN}{text}{RESET}{suffix}: ").strip()
    except EOFError:
        return default
    return value or default


def prompt_int(text: str, default: int, *, minimum: int = 0) -> int:
    if USE_RICH:
        while True:
            value = IntPrompt.ask(text, default=default)
            if value >= minimum:
                return value
            console.print(f"[red]不能小于 {minimum}。[/red]")

    while True:
        raw = prompt(text, str(default))
        try:
            value = int(raw)
        except ValueError:
            print(f"  {RED}请输入数字。{RESET}")
            continue
        if value < minimum:
            print(f"  {RED}不能小于 {minimum}。{RESET}")
            continue
        return value


def pause() -> None:
    if USE_RICH:
        Prompt.ask("[dim]按回车返回菜单[/dim]", default="")
    else:
        input(f"\n{DIM}按回车返回菜单...{RESET}")


def run_command(command: list[str]) -> int:
    print()
    if USE_RICH:
        console.print(Panel(f"[dim]$ {' '.join(command)}[/dim]", title="执行命令", border_style="yellow", box=box.SIMPLE))
    else:
        print(f"{GRAY}$ {' '.join(command)}{RESET}")
    print()
    return subprocess.run(command, cwd=ROOT_DIR, check=False).returncode


def print_success(message: str) -> None:
    if USE_RICH:
        console.print(f"[green]✓[/green] {message}")
    else:
        print(f"  {GREEN}✓ {message}{RESET}")


def print_warning(message: str) -> None:
    if USE_RICH:
        console.print(f"[yellow]![/yellow] {message}")
    else:
        print(f"  {YELLOW}{message}{RESET}")


def print_error(message: str) -> None:
    if USE_RICH:
        console.print(f"[red]×[/red] {message}")
    else:
        print(f"  {RED}× {message}{RESET}")


def latest_scan_file() -> Path | None:
    if not OUTPUT_DIR.exists():
        return None
    files = sorted(
        [
            path
            for path in OUTPUT_DIR.iterdir()
            if path.suffix.lower() in {".csv", ".json"}
            and (
                "comment_users" in path.name
                or path.name.startswith("tui_")
                or path.name.startswith("pipeline_")
            )
        ],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return files[0] if files else None


def scan_file_summary(path: Path) -> tuple[int, int, int]:
    try:
        rows = read_rows(path)
    except (OSError, json.JSONDecodeError, csv.Error):
        return (0, 0, 0)

    high_count = sum(
        1
        for row in rows
        if row.get("priority") == "HIGH_VALUE"
    )
    importable_high_count = sum(
        1
        for row in rows
        if row.get("priority") == "HIGH_VALUE" and str(row.get("default_favorite_id") or "").strip()
    )
    return (len(rows), high_count, importable_high_count)


def file_modified_label(path: Path) -> str:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime).strftime("%m-%d %H:%M")
    except OSError:
        return "-"


def scan_video(state: MenuState) -> None:
    video = prompt("BV 号或视频链接", state.last_video)
    if not video:
        print(f"  {YELLOW}没有输入视频。{RESET}")
        pause()
        return

    login = Confirm.ask("是否强制扫码登录？", default=False) if USE_RICH else prompt("是否强制扫码登录？y/N", "N").lower() in {"y", "yes"}
    state.comment_pages = prompt_int("评论页数", state.comment_pages, minimum=1)
    state.user_limit = prompt_int("最多扫描用户数", state.user_limit, minimum=1)
    state.min_count = prompt_int("高价值收藏夹下限", state.min_count, minimum=1)
    prefix = f"tui_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    expected_csv = OUTPUT_DIR / f"{prefix}.csv"

    command = [
        sys.executable,
        "-u",
        str(SCANNER),
        video,
        "--comment-pages",
        str(state.comment_pages),
        "--user-limit",
        str(state.user_limit),
        "--output-prefix",
        prefix,
    ]
    if login:
        command.append("--login")

    code = run_command(command)
    if code == 0 and expected_csv.exists():
        state.last_video = video
        state.last_scan_file = str(expected_csv)
        added, updated, total = merge_scan_into_candidate_board(expected_csv)
        save_state(state)
        print_success(f"扫描结果已保存：{short_path(str(expected_csv))}")
        print_success(f"已合并到候选池：新增 {added}，更新 {updated}，总计 {total}")
    else:
        print_error(f"扫描失败或没有生成结果。code={code}")
    pause()


def read_rows(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, list) else []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def show_results(state: MenuState) -> None:
    path = pick_scan_file(state)
    if not path:
        pause()
        return

    added, updated, total = merge_scan_into_candidate_board(path)
    print_success(f"已合并到候选池：新增 {added}，更新 {updated}，总计 {total}")
    render_user_board(path)
    pause()


def render_user_board(path: Path) -> list[dict[str, Any]]:
    rows = read_rows(path)
    high_priority_rows = [
        row for row in rows
        if row.get("priority") == "HIGH_VALUE"
    ]
    high_rows = [
        row for row in rows
        if row.get("priority") == "HIGH_VALUE" and str(row.get("default_favorite_id") or "").strip()
    ]
    visible_rows = [
        row for row in rows
        if row.get("priority") == "VISIBLE" and str(row.get("default_favorite_id") or "").strip()
    ]
    excluded = set(load_state().excluded_fids or [])

    if USE_RICH:
        summary = Table.grid(expand=True)
        summary.add_column(ratio=1)
        summary.add_column(ratio=1)
        summary.add_row("[bold]文件[/bold]", short_path(str(path)))
        summary.add_row("[bold]总用户[/bold]", str(len(rows)))
        summary.add_row("[bold magenta]HIGH_VALUE[/bold magenta]", str(len(high_priority_rows)))
        summary.add_row("[bold magenta]可用默认收藏夹 ID[/bold magenta]", str(len(high_rows)))
        summary.add_row("[bold green]VISIBLE[/bold green]", str(len(visible_rows)))
        console.print(Panel(summary, title="高默认收藏夹用户数据", border_style="cyan", box=box.ROUNDED))

        table = Table(title="HIGH_VALUE 用户与默认收藏夹 ID", box=box.SIMPLE_HEAVY)
        table.add_column("#", justify="right", style="dim")
        table.add_column("fid", style="magenta")
        table.add_column("默认数", justify="right", style="green")
        table.add_column("用户")
        table.add_column("mid", style="cyan")
        table.add_column("状态", style="yellow")
        table.add_column("主页", style="dim")
        for index, row in enumerate(high_rows[:30], start=1):
            fid = str(row.get("default_favorite_id") or "")
            table.add_row(
                str(index),
                fid,
                str(row.get("default_favorite_count") or "0"),
                f"@{row.get('username') or row.get('mid')}",
                str(row.get("mid") or ""),
                "已排除" if fid in excluded else "候选",
                str(row.get("space_url") or ""),
            )
        console.print(table)

        commands = Table.grid(expand=True)
        commands.add_column(ratio=1)
        commands.add_row(f"[bold]导出 CSV[/bold]  {short_path(str(path))}")
        commands.add_row("[bold]下一步[/bold]    菜单 4 可编辑候选池；高级工具里才会写 Supabase")
        console.print(Panel(commands, title="只看数据，不写库", border_style="green", box=box.SIMPLE))
    else:
        print()
        print(f"{CYAN}{BOLD}━━ 高默认收藏夹用户数据 {RESET}{GRAY}{'━' * 34}{RESET}")
        print(f"  文件         {short_path(str(path))}")
        print(f"  总用户       {len(rows)}")
        print(f"  HIGH_VALUE  {len(high_priority_rows)}")
        print(f"  可用默认ID   {len(high_rows)}")
        print(f"  VISIBLE     {len(visible_rows)}")
        print()
        print(f"{BOLD}  HIGH_VALUE 用户与默认收藏夹 ID{RESET}")
        print(f"  {'#':>2}  {'fid':<12} {'默认数':>6}  {'状态':<6} 用户")
        for index, row in enumerate(high_rows[:30], start=1):
            fid = str(row.get("default_favorite_id") or "")
            print(
                f"  {index:>2}. {MAGENTA}{fid:<12}{RESET} "
                f"{str(row.get('default_favorite_count') or '0'):>6}  "
                f"{'已排除' if fid in excluded else '候选':<6} @{row.get('username') or row.get('mid')}"
            )
        print(f"\n  {DIM}只看数据，不写库。菜单 4 可编辑候选池；高级工具里才会写 Supabase。{RESET}")

    if high_priority_rows and not high_rows:
        print_warning("这份扫描结果是旧格式，缺少 default_favorite_id。请选较新的 pipeline_*.csv，或重新扫描。")

    return high_rows


def sorted_board_items(include_hidden: bool = False) -> list[dict[str, Any]]:
    board = load_candidate_board()
    items = list(board.values())
    if not include_hidden:
        items = [item for item in items if item.get("status") != "hidden"]
    return sorted(
        items,
        key=lambda item: (
            item.get("status") == "hidden",
            item.get("library_status") == "imported",
            -parse_count(item.get("weight")),
            -parse_count(item.get("default_favorite_count")),
            item.get("fid") or "",
        ),
    )


def render_candidate_board(*, include_hidden: bool = False) -> list[dict[str, Any]]:
    items = sorted_board_items(include_hidden=include_hidden)
    active_count = sum(1 for item in load_candidate_board().values() if item.get("status") != "hidden")
    hidden_count = sum(1 for item in load_candidate_board().values() if item.get("status") == "hidden")
    imported_count = sum(1 for item in load_candidate_board().values() if item.get("library_status") == "imported")

    if USE_RICH:
        summary = Table.grid(expand=True)
        summary.add_column(ratio=1)
        summary.add_column(ratio=1)
        summary.add_row("[bold]候选池文件[/bold]", short_path(str(CANDIDATE_BOARD_FILE)))
        summary.add_row("[bold green]候选[/bold green]", str(active_count))
        summary.add_row("[bold blue]已入库[/bold blue]", str(imported_count))
        summary.add_row("[bold yellow]隐藏[/bold yellow]", str(hidden_count))
        console.print(Panel(summary, title="可编辑高收藏夹用户池", border_style="cyan", box=box.ROUNDED))

        table = Table(title="候选池 Top 30", box=box.SIMPLE_HEAVY)
        table.add_column("#", justify="right", style="dim")
        table.add_column("fid", style="magenta")
        table.add_column("权重", justify="right", style="yellow")
        table.add_column("默认数", justify="right", style="green")
        table.add_column("用户")
        table.add_column("mid", style="cyan")
        table.add_column("状态")
        table.add_column("入库", style="blue")
        table.add_column("备注", overflow="fold")
        for index, item in enumerate(items[:30], start=1):
            table.add_row(
                str(index),
                str(item.get("fid") or ""),
                str(item.get("weight") or 0),
                str(item.get("default_favorite_count") or 0),
                f"@{item.get('username') or item.get('mid')}",
                str(item.get("mid") or ""),
                str(item.get("status") or "candidate"),
                "已入库" if item.get("library_status") == "imported" else "未入库",
                str(item.get("note") or ""),
            )
        console.print(table)
        console.print("[dim]编辑命令：d 隐藏 · r 恢复 · i 切换入库 · w 改权重 · n 备注 · a 显示隐藏 · q 返回[/dim]")
    else:
        print()
        print(f"{CYAN}{BOLD}━━ 可编辑高收藏夹用户池 {RESET}{GRAY}{'━' * 28}{RESET}")
        print(f"  文件       {short_path(str(CANDIDATE_BOARD_FILE))}")
        print(f"  候选       {active_count}")
        print(f"  已入库     {imported_count}")
        print(f"  隐藏       {hidden_count}")
        print()
        print(f"  {'#':>2} {'fid':<12} {'权重':>6} {'默认数':>6} {'状态':<9} {'入库':<6} 用户")
        for index, item in enumerate(items[:30], start=1):
            print(
                f"  {index:>2}. {str(item.get('fid') or ''):<12} "
                f"{str(item.get('weight') or 0):>6} "
                f"{str(item.get('default_favorite_count') or 0):>6} "
                f"{str(item.get('status') or 'candidate'):<9} "
                f"{'已入库' if item.get('library_status') == 'imported' else '未入库':<6} "
                f"@{item.get('username') or item.get('mid')}"
            )
        print(f"\n  {DIM}编辑命令：d 隐藏 · r 恢复 · i 切换入库 · w 改权重 · n 备注 · a 显示隐藏 · q 返回{RESET}")
    return items


def pick_board_item(items: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not items:
        print_warning("候选池为空。先从扫描结果合并。")
        return None
    index = prompt_int("选择序号", 1, minimum=1)
    if index > len(items[:30]):
        print_error("序号超出当前显示范围。")
        return None
    return items[index - 1]


def edit_candidate_board(state: MenuState) -> None:
    include_hidden = False

    while True:
        clear_screen()
        items = render_candidate_board(include_hidden=include_hidden)
        action = prompt("编辑命令", "q").lower()
        if action == "q":
            return
        if action == "a":
            include_hidden = not include_hidden
            continue
        if action not in {"d", "r", "i", "w", "n"}:
            print_warning("未知命令。")
            pause()
            continue

        item = pick_board_item(items)
        if not item:
            pause()
            continue

        board = load_candidate_board()
        fid = str(item.get("fid") or "")
        if fid not in board:
            print_error("候选项不存在。")
            pause()
            continue

        if action == "d":
            board[fid]["status"] = "hidden"
            print_success(f"已隐藏 fid={fid}")
        elif action == "r":
            board[fid]["status"] = "candidate"
            print_success(f"已恢复 fid={fid}")
        elif action == "i":
            current = board[fid].get("library_status") or "pending"
            board[fid]["library_status"] = "pending" if current == "imported" else "imported"
            print_success(f"已切换入库状态 fid={fid} -> {board[fid]['library_status']}")
        elif action == "w":
            board[fid]["weight"] = prompt_int("新的展示权重", parse_count(board[fid].get("weight")), minimum=0)
            print_success(f"已更新权重 fid={fid}")
        elif action == "n":
            board[fid]["note"] = prompt("备注", str(board[fid].get("note") or ""))
            print_success(f"已更新备注 fid={fid}")

        save_candidate_board(board)
        save_state(state)
        pause()


def pick_scan_file(state: MenuState) -> Path | None:
    candidates = []
    latest = latest_scan_file()
    if latest:
        candidates.append(latest)
    if state.last_scan_file and Path(state.last_scan_file).exists() and Path(state.last_scan_file) not in candidates:
        candidates.append(Path(state.last_scan_file))

    if not candidates:
        print_warning("还没有扫描结果。先执行菜单 1。")
        return None

    print()
    if USE_RICH:
        table = Table(title="选择扫描结果", box=box.SIMPLE)
        table.add_column("序号", justify="right")
        table.add_column("文件名", overflow="fold")
        table.add_column("用户", justify="right", style="dim")
        table.add_column("HIGH", justify="right", style="magenta")
        table.add_column("可导入", justify="right", style="green")
        table.add_column("时间", style="dim")
        for index, path in enumerate(candidates, start=1):
            row_count, high_count, importable_count = scan_file_summary(path)
            table.add_row(str(index), path.name, str(row_count), str(high_count), str(importable_count), file_modified_label(path))
        console.print(table)
        console.print(f"[dim]当前默认选择：{short_path(str(candidates[0]))}。直接回车即可。[/dim]")
    else:
        print(f"{CYAN}选择扫描结果{RESET}")
        for index, path in enumerate(candidates, start=1):
            row_count, high_count, importable_count = scan_file_summary(path)
            print(f"  {index}. {path.name}  users={row_count} high={high_count} importable={importable_count}  {file_modified_label(path)}")
        print(f"  {DIM}当前默认选择：{short_path(str(candidates[0]))}。直接回车即可。{RESET}")
    choice = prompt_int("序号", 1, minimum=1)
    if choice > len(candidates):
        print_error("序号超出范围。")
        return None
    state.last_scan_file = str(candidates[choice - 1])
    save_state(state)
    return candidates[choice - 1]


def import_from_scan(state: MenuState, *, commit: bool) -> None:
    path = export_candidate_board_for_import()
    if not path:
        print_warning("候选池没有可写入的项目。")
        pause()
        return

    import_from_path(state, path, commit=commit)


def preview_pending_favorites(state: MenuState) -> None:
    items = [
        item for item in sorted_board_items(include_hidden=False)
        if item.get("library_status") != "imported"
        and parse_count(item.get("default_favorite_count")) >= state.min_count
    ]

    if USE_RICH:
        summary = Table.grid(expand=True)
        summary.add_column(ratio=1)
        summary.add_column(ratio=1)
        summary.add_row("[bold]候选池文件[/bold]", short_path(str(CANDIDATE_BOARD_FILE)))
        summary.add_row("[bold]默认数下限[/bold]", str(state.min_count))
        summary.add_row("[bold green]未入库收藏夹[/bold green]", str(len(items)))
        console.print(Panel(summary, title="未入库收藏夹", border_style="cyan", box=box.ROUNDED))

        table = Table(title="复制 fid 后可去高级工具 2 写入", box=box.SIMPLE_HEAVY)
        table.add_column("#", justify="right", style="dim")
        table.add_column("fid", style="magenta", no_wrap=True)
        table.add_column("默认数", justify="right", style="green")
        table.add_column("权重", justify="right", style="yellow")
        table.add_column("用户")
        table.add_column("mid", style="cyan")
        table.add_column("收藏夹")
        table.add_column("备注", overflow="fold")
        for index, item in enumerate(items[:50], start=1):
            table.add_row(
                str(index),
                str(item.get("fid") or ""),
                str(item.get("default_favorite_count") or 0),
                str(item.get("weight") or 0),
                f"@{item.get('username') or item.get('mid')}",
                str(item.get("mid") or ""),
                str(item.get("default_favorite_title") or "默认收藏夹"),
                str(item.get("note") or ""),
            )
        console.print(table)
        if items:
            console.print("[dim]提示：复制某一行 fid，选择高级工具 2，然后粘贴写入。[/dim]")
    else:
        print()
        print(f"{CYAN}{BOLD}━━ 未入库收藏夹 {RESET}{GRAY}{'━' * 34}{RESET}")
        print(f"  文件       {short_path(str(CANDIDATE_BOARD_FILE))}")
        print(f"  默认下限   {state.min_count}")
        print(f"  未入库     {len(items)}")
        print()
        print(f"  {'#':>2} {'fid':<14} {'默认数':>6} {'权重':>6} {'用户':<18} 收藏夹")
        for index, item in enumerate(items[:50], start=1):
            print(
                f"  {index:>2}. {str(item.get('fid') or ''):<14} "
                f"{str(item.get('default_favorite_count') or 0):>6} "
                f"{str(item.get('weight') or 0):>6} "
                f"@{str(item.get('username') or item.get('mid')):<17} "
                f"{item.get('default_favorite_title') or '默认收藏夹'}"
            )
        if items:
            print(f"\n  {DIM}复制某一行 fid，选择高级工具 2，然后粘贴写入。{RESET}")
    pause()


def export_candidate_board_for_import() -> Path | None:
    items = [
        item for item in sorted_board_items(include_hidden=False)
        if item.get("library_status") != "imported"
    ]
    if not items:
        return None

    export_path = OUTPUT_DIR / "candidate_board_import.csv"
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

    with export_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for item in items:
            writer.writerow({
                "priority": item.get("priority") or "HIGH_VALUE",
                "mid": item.get("mid") or "",
                "username": item.get("username") or "",
                "space_url": item.get("space_url") or "",
                "favorite_visible": "True",
                "default_favorite_id": item.get("fid") or "",
                "default_favorite_title": item.get("default_favorite_title") or "",
                "default_favorite_url": item.get("default_favorite_url") or "",
                "import_command": f"python3 scripts/import_bilibili_favorite.py {item.get('fid')}",
                "default_favorite_count": item.get("default_favorite_count") or 0,
                "folder_count": "",
                "level": "",
                "sign": item.get("note") or "",
                "comment": f"weight={item.get('weight') or 0}",
                "favorite_error": "",
            })
    return export_path


def import_from_path(state: MenuState, path: Path, *, commit: bool) -> None:
    state.last_scan_file = str(path)

    state.import_limit = prompt_int("本次处理收藏夹数量 limit", state.import_limit, minimum=0)
    state.min_count = prompt_int("默认收藏夹数量下限", state.min_count, minimum=1)

    command = [
        sys.executable,
        "-u",
        str(BATCH_IMPORTER),
        str(path),
        "--min-count",
        str(state.min_count),
        "--limit",
        str(state.import_limit),
    ]
    for fid in state.excluded_fids or []:
        command.extend(["--exclude-fid", fid])

    if commit:
        if USE_RICH:
            console.print("[yellow]写入会修改 Supabase 数据。请输入 YES 继续。[/yellow]")
        confirm = prompt("确认写入 Supabase？输入 YES", "")
        if confirm != "YES":
            print_warning("已取消写入。")
            pause()
            return
        command.extend(["--commit", "--yes"])

    code = run_command(command)
    save_state(state)
    (print_success if code == 0 else print_error)(f"{'完成' if code == 0 else '失败'} code={code}")
    pause()


def import_single_favorite(state: MenuState) -> None:
    favorite_id = prompt("输入要写入的视频收藏夹 ID", "")
    if not favorite_id:
        print_warning("没有输入收藏夹 ID。")
        pause()
        return

    command = [
        sys.executable,
        "-u",
        str(FAVORITE_IMPORTER),
        favorite_id,
    ]
    code = run_command(command)
    save_state(state)
    (print_success if code == 0 else print_error)(f"{'完成' if code == 0 else '失败'} code={code}")
    pause()


def scan_and_show_users(state: MenuState) -> None:
    video = prompt("BV 号或视频链接", state.last_video)
    if not video:
        print(f"  {YELLOW}没有输入视频。{RESET}")
        pause()
        return

    state.comment_pages = prompt_int("评论页数", state.comment_pages, minimum=1)
    state.user_limit = prompt_int("最多扫描用户数", state.user_limit, minimum=1)
    login = Confirm.ask("是否强制扫码登录？", default=False) if USE_RICH else prompt("是否强制扫码登录？y/N", "N").lower() in {"y", "yes"}
    prefix = f"tui_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    expected_csv = OUTPUT_DIR / f"{prefix}.csv"

    command = [
        sys.executable,
        "-u",
        str(SCANNER),
        video,
        "--comment-pages",
        str(state.comment_pages),
        "--user-limit",
        str(state.user_limit),
        "--output-prefix",
        prefix,
    ]
    if login:
        command.append("--login")

    code = run_command(command)
    state.last_video = video
    if code == 0 and expected_csv.exists():
        state.last_scan_file = str(expected_csv)
        added, updated, total = merge_scan_into_candidate_board(expected_csv)
    save_state(state)
    if code == 0 and expected_csv.exists():
        print_success(f"扫描完成：{short_path(str(expected_csv))}")
        print_success(f"已合并到候选池：新增 {added}，更新 {updated}，总计 {total}")
        render_candidate_board()
    else:
        print_error(f"扫描失败或没有生成结果。code={code}")
    pause()


def edit_exclusions(state: MenuState) -> None:
    print()
    if USE_RICH:
        table = Table(title="排除列表", box=box.SIMPLE_HEAVY)
        table.add_column("#", justify="right")
        table.add_column("fid", style="yellow")
        if state.excluded_fids:
            for index, fid in enumerate(state.excluded_fids, start=1):
                table.add_row(str(index), fid)
        console.print(table)
    elif state.excluded_fids:
        print(f"{CYAN}{BOLD}━━ 排除列表 {RESET}{GRAY}{'━' * 34}{RESET}")
        for index, fid in enumerate(state.excluded_fids, start=1):
            print(f"  {index}. {fid}")
    else:
        print(f"  {DIM}当前没有排除项。{RESET}")

    print()
    print("  1. 添加 fid")
    print("  2. 清空列表")
    print("  3. 返回")
    choice = prompt("选择", "1")
    if choice == "1":
        fid = prompt("要排除的 fid", "")
        if fid and fid not in state.excluded_fids:
            state.excluded_fids.append(fid)
            save_state(state)
            print_success("已添加。")
    elif choice == "2":
        state.excluded_fids = []
        save_state(state)
        print_success("已清空。")
    pause()


def advanced_menu(state: MenuState) -> None:
    while True:
        clear_screen()
        if USE_RICH:
            table = Table(title="高级工具", box=box.ROUNDED, expand=True)
            table.add_column("键", justify="center", style="bold cyan", width=4)
            table.add_column("动作", style="bold")
            table.add_column("说明", style="dim")
            table.add_row("1", "预览未入库收藏夹", "显示用户信息和 fid，方便复制")
            table.add_row("2", "写入指定收藏夹视频", "手动输入 fid，再确认写入")
            table.add_row("3", "排除/取消排除 fid", "过滤不想导入的收藏夹")
            table.add_row("0", "返回主菜单", "继续编辑候选池")
            console.print(table)
        else:
            print(f"{BOLD}高级工具{RESET}")
            print(f"{BOLD}  1.{RESET} 预览未入库收藏夹")
            print(f"{BOLD}  2.{RESET} 写入指定收藏夹视频")
            print(f"{BOLD}  3.{RESET} 排除/取消排除 fid")
            print(f"{BOLD}  0.{RESET} 返回主菜单")
            print()

        choice = prompt("选择高级工具", "0")
        if choice == "1":
            preview_pending_favorites(state)
        elif choice == "2":
            import_single_favorite(state)
        elif choice == "3":
            edit_exclusions(state)
        elif choice == "0":
            return
        else:
            print_error("未知菜单。")
            pause()


def menu_loop() -> int:
    state = load_state()

    while True:
        banner(state)
        if USE_RICH:
            menu = Table(title="操作菜单", box=box.ROUNDED, expand=True)
            menu.add_column("键", justify="center", style="bold cyan", width=4)
            menu.add_column("动作", style="bold")
            menu.add_column("说明", style="dim")
            menu.add_row("1", "扫描并展示高收藏夹用户", "从 BV 到用户/fid 数据看板")
            menu.add_row("2", "只扫描视频评论用户", "生成 CSV/JSON，不触发导入")
            menu.add_row("3", "从扫描结果合并", "把 CSV/JSON 合并进候选池")
            menu.add_row("4", "查看/编辑候选池", "隐藏、恢复、改权重、备注")
            menu.add_row("5", "高级工具", "预览/写库/排除 fid")
            menu.add_row("0", "退出", "保存当前状态")
            console.print(menu)
        else:
            print(f"{BOLD}  1.{RESET} 扫描并展示高收藏夹用户")
            print(f"{BOLD}  2.{RESET} 只扫描视频评论用户")
            print(f"{BOLD}  3.{RESET} 从扫描结果合并")
            print(f"{BOLD}  4.{RESET} 查看/编辑候选池")
            print(f"{BOLD}  5.{RESET} 高级工具")
            print(f"{BOLD}  0.{RESET} 退出")
            print()

        choice = prompt("选择菜单", "1" if sys.stdin.isatty() else "0")
        if choice == "1":
            scan_and_show_users(state)
        elif choice == "2":
            scan_video(state)
        elif choice == "3":
            show_results(state)
        elif choice == "4":
            edit_candidate_board(state)
        elif choice == "5":
            advanced_menu(state)
        elif choice == "0":
            if USE_RICH:
                console.print("[dim]下次继续采。[/dim]")
            else:
                print(f"\n{DIM}下次继续采。{RESET}")
            return 0
        else:
            print_error("未知菜单。")
            pause()


if __name__ == "__main__":
    try:
        raise SystemExit(menu_loop())
    except KeyboardInterrupt:
        print(f"\n{DIM}已退出。{RESET}")
        raise SystemExit(130)
