#!/usr/bin/env python3
"""Compatibility wrapper for the old scan-and-import pipeline command."""

from __future__ import annotations

import runpy
from pathlib import Path


if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parent / "bilibili" / "scan_and_import_defaults.py"), run_name="__main__")
