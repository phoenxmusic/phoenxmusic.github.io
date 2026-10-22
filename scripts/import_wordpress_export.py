#!/usr/bin/env python3
"""Import published content from a WordPress WXR export into portable JSON.

Usage: python scripts/import_wordpress_export.py PATH_TO_WORDPRESS_EXPORT.xml

Only published pages, posts, and portfolio records are imported. Private and
draft records are deliberately excluded. The WXR export contains media URLs,
not the binary media files, so the importer records media provenance rather
than pretending those assets have been copied.
"""
from __future__ import annotations

import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "content" / "wordpress"
NS = {
    "wp": "http://wordpress.org/export/1.2/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "excerpt": "http://wordpress.org/export/1.2/excerpt/",
    "dc": "http://purl.org/dc/elements/1.1/",
}
TYPE_MAP = {"page": "page", "post": "post", "jetpack-portfolio": "portfolio"}


def text(node: ET.Element, path: str, default: str = "") -> str:
    return node.findtext(path, default=default, namespaces=NS) or default


def clean_html(source: str) -> str:
    """Remove active scripting while retaining article structure and embeds."""
    source = re.sub(r"(?is)<script\b[^>]*>.*?</script\s*>", "", source)
    source = re.sub(r"(?is)<form\b[^>]*>.*?</form\s*>", "", source)
    source = re.sub(r"(?i)\s+on[a-z]+\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]+)", "", source)
    source = re.sub(r"(?i)(href|src|action)\s*=\s*([\"'])\s*javascript:[\s\S]*?\2", r'\1="#"', source)
    source = re.sub(r"(?is)<object\b[^>]*>.*?</object\s*>", "", source)
    return source.strip()


def convert_wordpress_shortcodes(source: str, media_by_id: dict[str, dict]) -> str:
    """Turn common legacy shortcodes into visible, portable HTML fallbacks."""
    source = re.sub(r"(?is)\[caption[^\]]*\](.*?)\[/caption\]", r'<div class="wp-caption">\1</div>', source)

    def gallery(match: re.Match[str]) -> str:
        attrs = match.group(1)
        ids_match = re.search(r"""ids\s*=\s*["']([^"']+)["']""", attrs, re.I)
        if not ids_match:
            return '<p class="media-unavailable">WordPress gallery metadata was present, but no attachment IDs were recorded.</p>'
        cards = []
        for attachment_id in ids_match.group(1).split(","):
            media = media_by_id.get(attachment_id.strip())
            if not media:
                cards.append('<li>Gallery attachment ' + html.escape(attachment_id.strip()) + ' is not present in the export.</li>')
                continue
            label = media.get("alt") or media.get("title") or ("Attachment " + attachment_id.strip())
            cards.append('<li><strong>' + html.escape(label) + '</strong> — image binary not included in export; <a href="' + html.escape(media["url"], quote=True) + '">original media URL</a></li>')
        return '<section class="wp-gallery"><h2>Original WordPress gallery</h2><p>Gallery image files were referenced by the export but could not be retrieved from the private source site.</p><ul>' + "".join(cards) + '</ul></section>'

    source = re.sub(r"(?is)\[gallery\b([^\]]*)\]", gallery, source)

    def audio(match: re.Match[str]) -> str:
        attrs = match.group(1)
        src_match = re.search(r"""src\s*=\s*["']([^"']+)["']""", attrs, re.I)
        if not src_match:
            return '<p class="media-unavailable">An audio shortcode was present, but its source URL was not recorded.</p>'
        url = html.escape(src_match.group(1), quote=True)
        return '<p class="media-unavailable">Audio file referenced by the WordPress page; binary not included in the export. <a href="' + url + '">Original audio URL</a></p>'

    source = re.sub(r"(?is)\[audio\b([^\]]*)\]", audio, source)
    source = re.sub(r"(?is)\[embed\]\s*(https?://[^\[]+?)\s*\[/embed\]", lambda m: '<p>Embedded media reference: <a href="' + html.escape(m.group(1).strip(), quote=True) + '">' + html.escape(m.group(1).strip()) + '</a> (playback not verified).</p>', source)
    return source


def safe_slug(value: str, fallback: str) -> str:
    value = unquote(value or "").strip("/ ")
    value = re.sub(r"[\\\\\x00-\x1f]", "-", value)
    value = re.sub(r"\.{2,}", ".", value)
    return value or fallback


def route_for(link: str, kind: str, slug: str, year: str, month: str, day: str) -> str:
    parsed = urlparse(link)
    path = unquote(parsed.path or "").strip("/")
    if kind == "page" and path == "":
        return "/legacy-home/"
    if path:
        parts = [safe_slug(part, "item") for part in path.split("/") if part]
        if parts:
            return "/" + "/".join(parts) + "/"
    if kind == "post":
        return f"/journal/{year}/{month}/{day}/{safe_slug(slug, 'post')}/"
    return f"/legacy/{kind}/{safe_slug(slug, kind)}/"


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/import_wordpress_export.py PATH_TO_WORDPRESS_EXPORT.xml", file=sys.stderr)
        return 2
    source = Path(sys.argv[1]).expanduser().resolve()
    if not source.is_file():
        print(f"ERROR: export file not found: {source}", file=sys.stderr)
        return 2

    tree = ET.parse(source)
    channel = tree.getroot().find("channel")
    if channel is None:
        raise ValueError("This XML does not contain a WordPress WXR channel")
    items = channel.findall("item")
    media_items = [item for item in items if text(item, "wp:post_type") == "attachment"]
    media_by_id: dict[str, dict] = {}
    for item in media_items:
        attachment_id = text(item, "wp:post_id")
        meta = {text(m, "wp:meta_key"): text(m, "wp:meta_value") for m in item.findall("wp:postmeta", NS)}
        url = text(item, "wp:attachment_url")
        media_by_id[attachment_id] = {
            "id": attachment_id,
            "title": text(item, "title"),
            "url": url,
            "date": text(item, "wp:post_date"),
            "mime_type": text(item, "wp:post_mime_type"),
            "alt": meta.get("_wp_attachment_image_alt", ""),
            "attached_file": meta.get("_wp_attached_file", ""),
            "status": "source-url-only; binary not included in WXR export",
        }

    imported: list[dict] = []
    pages: list[dict] = []
    posts: list[dict] = []
    portfolio: list[dict] = []
    public_counts: dict[str, int] = {}
    excluded_counts: dict[str, int] = {}
    for item in items:
        post_type = text(item, "wp:post_type")
        status = text(item, "wp:status")
        if post_type in ("page", "post", "jetpack-portfolio") and status != "publish":
            excluded_counts[f"{post_type}:{status}"] = excluded_counts.get(f"{post_type}:{status}", 0) + 1
            continue
        if post_type not in TYPE_MAP or status != "publish":
            continue

        kind = TYPE_MAP[post_type]
        link = text(item, "link")
        slug = text(item, "wp:post_name") or urlparse(link).path.rstrip("/").split("/")[-1] or "item"
        date = text(item, "wp:post_date")
        try:
            parsed_date = datetime.strptime(date[:19], "%Y-%m-%d %H:%M:%S")
            year, month, day = parsed_date.strftime("%Y"), parsed_date.strftime("%m"), parsed_date.strftime("%d")
        except ValueError:
            year, month, day = "unknown", "00", "00"
        categories = []
        tags = []
        menu_terms = []
        for term in item.findall("category"):
            term_data = {key: term.attrib.get(key, "") for key in ("domain", "nicename")}
            term_data["name"] = (term.text or "").strip()
            if term_data["domain"] == "category":
                categories.append(term_data)
            elif term_data["domain"] == "post_tag":
                tags.append(term_data)
            elif term_data["domain"] == "nav_menu":
                menu_terms.append(term_data)
        meta = {text(m, "wp:meta_key"): text(m, "wp:meta_value") for m in item.findall("wp:postmeta", NS)}
        thumbnail_id = meta.get("_thumbnail_id", "")
        content = convert_wordpress_shortcodes(clean_html(text(item, "content:encoded")), media_by_id)
        record = {
            "id": text(item, "wp:post_id"),
            "type": kind,
            "title": html.unescape(text(item, "title")) or "Untitled",
            "slug": safe_slug(slug, kind),
            "date": date,
            "modified": text(item, "wp:post_modified"),
            "author": text(item, "dc:creator"),
            "status": "publish",
            "source_url": link,
            "guid": text(item, "guid"),
            "route": route_for(link, kind, slug, year, month, day),
            "excerpt": clean_html(text(item, "excerpt:encoded")),
            "content_html": content,
            "categories": categories,
            "tags": tags,
            "menu_terms": menu_terms,
            "parent_id": text(item, "wp:post_parent", "0"),
            "menu_order": int(text(item, "wp:menu_order", "0") or 0),
            "featured_media": media_by_id.get(thumbnail_id, {}).get("url", ""),
            "source_content_characters": len(content),
        }
        imported.append(record)
        {"page": pages, "post": posts, "portfolio": portfolio}[kind].append(record)
        public_counts[kind] = public_counts.get(kind, 0) + 1

    # Include WordPress navigation records as provenance and an auditable menu inventory.
    nav_items = []
    for item in items:
        if text(item, "wp:post_type") != "nav_menu_item" or text(item, "wp:status") != "publish":
            continue
        meta = {text(m, "wp:meta_key"): text(m, "wp:meta_value") for m in item.findall("wp:postmeta", NS)}
        nav_items.append({
            "title": html.unescape(text(item, "title")),
            "url": meta.get("_menu_item_url", ""),
            "object": meta.get("_menu_item_object", ""),
            "object_id": meta.get("_menu_item_object_id", ""),
            "parent_id": meta.get("_menu_item_menu_item_parent", "0"),
            "type": meta.get("_menu_item_type", ""),
            "menu_terms": [term.text or "" for term in item.findall("category") if term.attrib.get("domain") == "nav_menu"],
        })

    OUT.mkdir(parents=True, exist_ok=True)
    for name, records in (("pages", pages), ("posts", posts), ("portfolio", portfolio), ("media", list(media_by_id.values())), ("navigation", nav_items)):
        (OUT / f"{name}.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report = {
        "source_filename": source.name,
        "source_bytes": source.stat().st_size,
        "source_record_count": len(items),
        "published_imported": public_counts,
        "published_total": sum(public_counts.values()),
        "media_reference_count": len(media_by_id),
        "navigation_item_count": len(nav_items),
        "excluded_nonpublic_records": excluded_counts,
        "media_binary_migration": "not possible from WXR alone: export contains URLs/metadata, not binary files; WordPress source returned HTTP 403 during retrieval test",
        "imported_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }
    (OUT / "import-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
