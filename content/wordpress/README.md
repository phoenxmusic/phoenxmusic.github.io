# WordPress migration records

These JSON files are the portable source records generated from `meniossymeon.WordPress.2026-10-22.xml`.

- `pages.json`: all 19 published WordPress pages, with original HTML, dates, links, taxonomies, and generated routes.
- `posts.json`: all 109 published posts with original HTML, dates, links, categories, and tags.
- `portfolio.json`: the one published portfolio item.
- `media.json`: all 150 attachment records. The XML contains URLs and metadata, not binary image/audio/video files.
- `navigation.json`: all 39 published navigation items retained for provenance. Several source menu links are malformed or point to stale WordPress administration URLs, so the rebuilt site's primary navigation uses verified published page routes instead of blindly copying every old menu link.
- `import-report.json`: source export counts and excluded private/draft counts.
- `build-audit.json`: build-time import coverage and explicit media limitation.

The importer intentionally excludes private and draft pages/posts. It removes script/form/object elements and inline event handlers, preserves article HTML, and converts common gallery/caption/audio shortcodes to readable fallbacks. Images whose original bytes could not be retrieved are represented by placeholders and referenced in `/media-archive/`.

## Identity clean sweep

The clean sweep keeps the current artist identity (PhoenX) in site identity fields and shared page headers. It deliberately does not rewrite old artist-name references inside historical articles, track titles, or original source URLs: those are archive records, not current branding. `scripts/check_banned_terms.py` enforces that distinction. The source WordPress site and its export are not modified.

To refresh from a new export, run `python scripts/import_wordpress_export.py PATH_TO_EXPORT.xml`, then `node scripts/build.mjs` and `node scripts/check-build.mjs` from the repository root. Do not commit the full WXR export; it may contain private or draft content that must not be published.
