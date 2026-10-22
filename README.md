# PhoenX music catalogue

The public site is a static website hosted on GitHub Pages. It is generated from portable source records in this repository, with no package installation or paid API required. It includes a searchable/filterable release catalogue, permanent release pages, the published WordPress pages and posts, a video archive, and a media-reference inventory.

## Edit without writing code

The repository is configured for [Pages CMS](https://app.pagescms.org/). **The configuration is committed, but the account/app connection and an actual CMS save still need to be verified.** Once connected:

### Edit a release

1. Sign in to Pages CMS with GitHub and authorize it for `phoenxmusic/phoenxmusic.github.io` if prompted.
2. Open this repository and select the publishing branch, `main`.
3. Open **Releases** and select a release.
4. Edit its title, year, type, language, YouTube ID, artwork, original page URL, or story/credits.
5. Save/commit the change. The build checks the source and regenerates the static site.

Leave a YouTube ID blank unless the video is verified for that release. Artwork uploads are stored in the repository under `media/`; do not upload assets without the right to publish them.

### Edit the homepage

Open **Homepage settings** in Pages CMS. The editable fields are stored in `content/site.json`: site title, subtitle, description, original WordPress URL, and featured video ID. Saving a change to the publishing branch triggers the build workflow. A featured video ID must be 11 valid YouTube ID characters or blank.

Blank values are unknown; do not guess them. The artist name is PhoenX only. `.banned-terms` is enforced by the local Git hooks and the GitHub Actions check.

## Local build

Requires Node.js only; no package installation is needed.

```sh
node scripts/build.mjs
```

The script writes generated `index.html`, `.nojekyll`, `archive-info/index.html`, `journal/`, `archive-pages/`, `media-archive/`, release pages, and the routes recorded in the imported WordPress JSON. It clears only the generated `releases/`, `archive-info/`, and `videos/` folders; source records are kept separate.

Run `node scripts/check-build.mjs` after the build to verify the generated page count, interactive catalogue controls, Greek text, the WordPress import counts, route uniqueness, source provenance, and the separate 13-item unmatched-video archive. The GitHub Actions workflow runs this check before staging generated output.

## WordPress content migration

The import source was `meniossymeon.WordPress.2026-10-22.xml`. The public site build imports **19 published pages, 109 published posts, and one published portfolio item**. It also preserves 39 navigation records and 150 attachment references. Private and draft content is excluded. The original WordPress site has not been changed.

Portable content sources live in `content/wordpress/`: `pages.json`, `posts.json`, `portfolio.json`, `media.json`, and `navigation.json`, with import and build audit reports. Generated pages preserve source URLs, dates, titles, content HTML, categories, and tags. Internal links are rewritten to local routes where a matching imported record exists. Common WordPress gallery, caption, and audio shortcodes are converted to readable HTML fallbacks; unavailable images are shown as explicit placeholders rather than broken images.

The metadata-only attachment audit is stored in `content/wordpress/media-audit.json` and can be reviewed with `node scripts/audit-media-inventory.mjs --summary`. Current findings: 150 unique HTTPS attachment URLs, no duplicate URLs, 3 missing titles, 147 missing alt-text values, and 150 missing MIME types. Extension-based counts suggest 78 JPG, 19 PNG, 2 GIF, 1 JPEG, 48 MP3, and 2 ZIP files. These are filename-derived categories, not verified file contents; all 150 binaries remain unavailable in the export. CI checks that the committed audit report still matches the source register.

To repeat the import from a new WordPress WXR export, run `python scripts/import_wordpress_export.py PATH_TO_EXPORT.xml`, then `node scripts/build.mjs` and `node scripts/check-build.mjs`. Python is required only for re-importing; the GitHub Pages build uses Node.js built-ins and the checked-in JSON sources.

**Media limitation:** the WXR export records attachment metadata and URLs but does not contain the actual image/audio/video files. Attempts to fetch the source site and sample media returned HTTP 403 because the WordPress site is private. `media-archive/` records all 150 references and explicitly does not claim those binaries were copied. Full binary migration remains blocked until authenticated media access or a separate media archive is available.

## Legacy preservation and maintenance

- Read [`LEGACY_PLAN.md`](LEGACY_PLAN.md) for the preservation, hosting, marketing, monitoring, and succession roadmap.
- Follow [`docs/ARCHIVE_INTAKE_CHECKLIST.md`](docs/ARCHIVE_INTAKE_CHECKLIST.md) before inventorying or copying the real master archive. It records the non-destructive sequence and the evidence required to claim a verified backup.
- [`content/marketing/`](content/marketing/) contains planning-only evergreen promotion briefs. Nothing in that folder is published automatically.
- The **PhoenX legacy site monitor** workflow runs monthly, on pull requests targeting `main`, and manually from the repository's **Actions** tab. It runs archive-manifest unit tests, checks the committed media metadata audit, rebuilds and checks internal links, then verifies the live homepage, all 9 release pages, all 129 imported WordPress routes, and the 4 archive indexes for HTTP/HTML responses and expected titles; it also checks homepage release links. The monitor and branding check have passed on recent development commits. It does not verify media playback, media binary completeness, or archival backups.
- The archive manifest utility can inventory an existing archive without modifying it, write a portable SHA-256 JSON manifest, and verify a copy/restore against that manifest. It hashes files as a stream, so large master WAV/video files are not read entirely into RAM; it also aborts if a file appears to change during hashing and rejects malformed manifests containing unsafe or duplicate paths. It resolves existing manifest symlinks and symlinked parent directories before enforcing the rule that manifests must be outside the archive. The manifest summarizes extension-based media categories, zero-byte files, and byte-identical duplicate groups. Those are triage signals, not proof of file quality or that duplicate files can safely be deleted. Run `node --test tests/archive-manifest.test.mjs` for its automated tests. Example: `node scripts/archive-manifest.mjs "D:\\MUSIC-LEGACY" --write "D:\\MUSIC-LEGACY-MANIFEST.json"`, then run `node scripts/archive-manifest.mjs "E:\\MUSIC-LEGACY-COPY" --verify "D:\\MUSIC-LEGACY-MANIFEST.json"` to verify a copy. Choose actual paths carefully; `--write` refuses to overwrite an existing manifest. This tool does not create backup copies for you.
- Use the read-only archive inventory tool against an actual archive directory: `node scripts/archive-manifest.mjs "PATH-TO-MUSIC-LEGACY"`. It prints file sizes and SHA-256 hashes without writing files. To save a new manifest, add `--write "PATH-TO-SEPARATE-ARCHIVE-RECORDS/source-manifest.json"`; the destination must not already exist and should be outside the directory being inventoried, preferably on separate storage. Do not put the only manifest inside the source archive or a backup being verified.
- Automated tests exercise the manifest tool on synthetic fixtures. The real master audio, artwork, video, and backup copies have not yet been inventoried or verified; running the tool against the actual archive is still an outstanding task.
