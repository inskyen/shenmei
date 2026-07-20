#!/usr/bin/env python3
"""Compatibility wrapper for the Bilibili comment scanner."""

from __future__ import annotations

import runpy
from pathlib import Path


if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parent / "bilibili" / "scan_comments.py"), run_name="__main__")
