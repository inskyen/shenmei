#!/usr/bin/env python3
"""Compatibility wrapper for scanned default-favorite imports."""

from __future__ import annotations

import runpy
from pathlib import Path


if __name__ == "__main__":
    runpy.run_path(
        str(Path(__file__).resolve().parent / "bilibili" / "import_scanned_default_favorites.py"),
        run_name="__main__",
    )
