#!/usr/bin/env python3
"""Protect PhoenX branding without rewriting the historical archive."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS_FILE = ROOT / ".banned-terms"


def main() -> int:
    patterns = [line.strip().casefold() for line in PATTERNS_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]
    violations: list[tuple[str, str]] = []

    # Only public identity fields are subject to the current-name rule.
    # Historical articles, dates, titles, and source URLs remain as imported.
    config_path = ROOT / "content" / "site.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    for field in ("title", "tagline", "description"):
        value = str(config.get(field, "")).casefold()
        for pattern in patterns:
            if pattern in value:
                violations.append((f"content/site.json:{field}", pattern))

    tracked = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True,
        stdout=subprocess.PIPE,
    ).stdout.split(b"\0")
    checked_headers = 0
    for raw_path in tracked:
        if not raw_path:
            continue
        path = raw_path.decode("utf-8", errors="surrogateescape")
        if not path.endswith(".html"):
            continue
        file_path = ROOT / path
        if not file_path.is_file():
            continue
        content = file_path.read_text(encoding="utf-8", errors="replace")
        match = re.search(r"(?is)<header\b[^>]*>(.*?)</header\s*>", content)
        if not match:
            continue
        checked_headers += 1
        # Article/page titles can live in the header on imported pages. They
        # are historical content, so only inspect the shared brand/navigation.
        shared = re.sub(r"(?is)<h1\b[^>]*>.*?</h1\s*>", " ", match.group(1))
        shared = re.sub(r"(?is)<p\b[^>]*class=[\"'][^\"']*\bsub\b[^\"']*[\"'][^>]*>.*?</p\s*>", " ", shared)
        header = unescape(re.sub(r"(?is)<[^>]+>", " ", shared)).casefold()
        for pattern in patterns:
            if pattern in header:
                violations.append((f"{path}:site-header", pattern))

    if violations:
        for path, pattern in violations:
            print(f"IDENTITY VIOLATION: {path}: {pattern}", file=sys.stderr)
        print("Keep the current artist identity in branding fields and shared site headers.", file=sys.stderr)
        return 1

    print(f"PASS: PhoenX branding fields and {checked_headers} shared HTML headers are clear.")
    print("Historical article text and source URLs are preserved; they are not branding surfaces.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
