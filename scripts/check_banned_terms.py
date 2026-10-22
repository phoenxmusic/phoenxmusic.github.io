#!/usr/bin/env python3
"""Reject banned identity terms in staged/tracked repository files."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PATTERNS_FILE = ROOT / ".banned-terms"
EXCLUDED = {".banned-terms"}


def main() -> int:
    patterns = [line.strip().casefold() for line in PATTERNS_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]
    paths = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, check=True, stdout=subprocess.PIPE).stdout.split(b"\0")
    hits = []
    for raw_path in paths:
        if not raw_path:
            continue
        path = raw_path.decode("utf-8", errors="surrogateescape")
        if path in EXCLUDED:
            continue
        result = subprocess.run(["git", "show", f":{path}"], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        if result.returncode:
            continue
        content = result.stdout.decode("utf-8", errors="replace").casefold()
        for pattern in patterns:
            if pattern in content:
                hits.append((path, pattern))
    if hits:
        for path, pattern in hits:
            print(f"BANNED TERM FOUND: {path}: {pattern}", file=sys.stderr)
        print("Commit/push blocked. Remove the match; the pattern list is in .banned-terms.", file=sys.stderr)
        return 1
    print("PASS: no banned terms in tracked repository content")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
