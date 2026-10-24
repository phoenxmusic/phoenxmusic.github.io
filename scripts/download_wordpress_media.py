#!/usr/bin/env python3
"""Download and verify public media referenced by the WordPress WXR export."""
from __future__ import annotations
import json, mimetypes, time
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REGISTER = ROOT / "content" / "wordpress" / "media.json"
OUT = ROOT / "assets" / "wordpress-media"
MAX_BYTES = 20 * 1024 * 1024
ALLOWED_HOST = "phoenxmusic.wordpress.com"
MAGIC = {".jpg": (b"\xff\xd8\xff",), ".jpeg": (b"\xff\xd8\xff",), ".png": (b"\x89PNG\r\n\x1a\n",), ".gif": (b"GIF87a", b"GIF89a")}

def valid_signature(path: Path, ext: str) -> bool:
    try:
        with path.open("rb") as stream: head = stream.read(16)
        return any(head.startswith(sig) for sig in MAGIC.get(ext.lower(), ()))
    except OSError: return False

def main() -> int:
    records = json.loads(REGISTER.read_text(encoding="utf-8")); OUT.mkdir(parents=True, exist_ok=True)
    counts = {"downloaded": 0, "already_valid": 0, "failed": 0}; failures = []
    for i, record in enumerate(records, 1):
        url = record.get("url", ""); parsed = urlparse(url); name = Path(unquote(parsed.path)).name; ext = Path(name).suffix.lower()
        if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST or not name or ext not in MAGIC:
            record.update(binary_status="rejected_invalid_url_or_type", local_path=""); counts["failed"] += 1
            failures.append({"id": record.get("id"), "url": url, "error": "URL host, scheme, or file extension not allowed"}); continue
        rel = Path("assets") / "wordpress-media" / name; destination = ROOT / rel
        if destination.exists() and valid_signature(destination, ext):
            record.update(status="verified_existing_local_file", binary_status="verified_existing_local_file", local_path=rel.as_posix(), bytes=destination.stat().st_size)
            counts["already_valid"] += 1; continue
        temp = destination.with_suffix(destination.suffix + ".part")
        try:
            request = Request(url, headers={"User-Agent": "PhoenX-Media-Migration/1.0", "Accept": "image/*"})
            with urlopen(request, timeout=25) as response:
                final = urlparse(response.geturl())
                if final.scheme != "https" or final.hostname != ALLOWED_HOST: raise ValueError("redirected outside approved WordPress media host")
                content_type = response.headers.get_content_type().lower(); expected = mimetypes.guess_type(name)[0]
                if not content_type.startswith("image/") or (expected and content_type != expected and not (ext in (".jpg", ".jpeg") and content_type == "image/jpeg")):
                    raise ValueError(f"unexpected content type: {content_type}")
                length = response.headers.get("Content-Length")
                if length and int(length) > MAX_BYTES: raise ValueError("file exceeds 20 MiB safety limit")
                total = 0
                with temp.open("wb") as out:
                    while True:
                        chunk = response.read(65536)
                        if not chunk: break
                        total += len(chunk)
                        if total > MAX_BYTES: raise ValueError("file exceeded 20 MiB safety limit while streaming")
                        out.write(chunk)
            if total == 0 or not valid_signature(temp, ext): raise ValueError("empty file or file signature mismatch")
            temp.replace(destination); record.update(status="downloaded_and_signature_verified", binary_status="downloaded_and_signature_verified", local_path=rel.as_posix(), bytes=total, content_type=content_type)
            counts["downloaded"] += 1; print(f"[{i}/{len(records)}] OK {name} ({total} bytes)")
        except Exception as exc:
            temp.unlink(missing_ok=True); record.update(status="download_failed", binary_status="download_failed", local_path="", download_error=str(exc))
            counts["failed"] += 1; failures.append({"id": record.get("id"), "url": url, "error": str(exc)})
            print(f"[{i}/{len(records)}] FAILED {name}: {exc}")
        time.sleep(0.05)
    REGISTER.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {"source": REGISTER.relative_to(ROOT).as_posix(), "destination": "assets/wordpress-media", "total_records": len(records), "results": counts, "all_assets_verified": counts["failed"] == 0 and counts["downloaded"] + counts["already_valid"] == len(records), "failures": failures}
    (ROOT / "content" / "wordpress" / "media-download-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    import_report_path = ROOT / "content" / "wordpress" / "import-report.json"
    if import_report_path.is_file():
        import_report = json.loads(import_report_path.read_text(encoding="utf-8"))
        verified = counts["downloaded"] + counts["already_valid"]
        import_report["media_binary_migration"] = (
            f"WXR contains metadata and URLs, not file bytes; the separate downloader verified "
            f"{verified}/{len(records)} image binaries locally. See media-download-report.json."
        ) if report["all_assets_verified"] else (
            f"WXR contains metadata and URLs, not file bytes; the separate downloader verified "
            f"{verified}/{len(records)} image binaries locally and recorded {counts['failed']} failures. "
            "See media-download-report.json."
        )
        import_report_path.write_text(json.dumps(import_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2)); return 0 if counts["failed"] == 0 else 1

if __name__ == "__main__": raise SystemExit(main())
