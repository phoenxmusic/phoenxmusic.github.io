# PhoenX music catalogue

The public site is a static website hosted on GitHub Pages. It is generated from portable source records in this repository, with no package installation or paid API required. The generated site includes a searchable/filterable release catalogue, one permanent page per release, a separate archive of unmatched video IDs, and an archive-information page.

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

The script writes generated `index.html`, `.nojekyll`, `about/index.html`, `videos/index.html`, and `releases/<slug>/index.html` pages. It only clears the generated `releases/`, `about/`, and `videos/` folders; source records are kept separate.

Run `node scripts/check-build.mjs` after the build to verify the generated page count, interactive catalogue controls, Greek text, and the separate 13-item unmatched-video archive. The GitHub Actions workflow runs this check before staging generated output.

## Legacy preservation and maintenance

- Read [`LEGACY_PLAN.md`](LEGACY_PLAN.md) for the preservation, hosting, marketing, monitoring, and succession roadmap.
- [`content/marketing/`](content/marketing/) contains planning-only evergreen promotion briefs. Nothing in that folder is published automatically.
- The **PhoenX legacy site monitor** workflow runs monthly and can also be started manually from the repository's **Actions** tab. It checks the live homepage and all release pages, expected titles, and homepage catalogue links; it does not verify media playback or archival backups.
- Use the read-only archive inventory tool against an actual archive directory: `node scripts/archive-manifest.mjs "PATH-TO-MUSIC-LEGACY"`. It prints file sizes and SHA-256 hashes without writing files. To save a new manifest, add `--write "PATH-TO-MUSIC-LEGACY/99_ARCHIVE_MANIFEST/manifest.json"`; the destination must not already exist.
- The tool has only been tested against the nine Markdown release records so far. The master audio, artwork, video, and backup copies have not yet been inventoried or verified.
