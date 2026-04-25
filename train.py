#!/usr/bin/env python3
"""Compatibility launcher for the canonical backend python pipeline."""

from __future__ import annotations

import runpy
from pathlib import Path


def main() -> None:
    script_path = Path(__file__).resolve().parent / "backend" / "python_pipeline" / "train.py"
    runpy.run_path(str(script_path), run_name="__main__")


if __name__ == "__main__":
    main()
