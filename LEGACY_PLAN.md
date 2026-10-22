# PhoenX Music Legacy Plan

## Mission

Preserve the PhoenX body of work, make it understandable and discoverable, and make it possible for another person to maintain it if the artist is no longer available. No single website, platform, account, disk, or person is treated as permanent.

## Operating rules

- Cost target: €0 wherever practicable. Any unavoidable recurring cost must be disclosed before commitment.
- Artist identity in public-facing material: **PhoenX only**.
- Do not invent dates, credits, biographies, lyrics, recording details, rights status, or video-to-release matches. Unknown values remain explicitly unknown.
- The source catalogue and archive must be exportable without proprietary software.
- Do not delete or replace an existing website during evaluation or migration.
- No marketing item is published automatically until its factual source, rights, destination, and approval status are recorded.
- “Forever” is an aspiration, not a technical guarantee. The operational goal is recoverability, portability, redundancy, and succession.

## Current verified baseline (22 October 2026)

- Public catalogue: <https://phoenxmusic.github.io/>.
- Source repository: `phoenxmusic/phoenxmusic.github.io`, branch `main`.
- Last verified local HEAD: `5a0194b` (`Add Markdown release CMS and static builder`); working tree was clean during the initial audit.
- Nine release Markdown files exist under `content/releases/` and generate nine permanent release pages.
- Thirteen YouTube IDs remain explicitly unmapped in `content/unmapped-youtube-ids.md`; do not assign them without verification.
- Existing WordPress site: <https://phoenxmusic.wordpress.com/>. Connected-account metrics reported 121 posts, 23 pages, 102 media items, about 70.6 MB stored, one monthly view, and no post published in over a year. This is a starting inventory, not proof that all material is complete or accurate.
- The WordPress.com connector reported site-scoped editing unavailable on the current plan. No WordPress content or settings have been changed.
- The current static site is live, but Pages CMS access has not been verified. Do not claim that a visual CMS workflow is operational until an edit has been saved and verified live.
- No complete master-audio inventory, three-copy backup verification, rights inventory, successor, archive fund, or automated social publishing pipeline has yet been evidenced.
- A monthly GitHub Actions smoke-check workflow has been added in this commit; it must complete a scheduled/manual run successfully before monitoring is considered verified. It checks HTTP/HTML responses, homepage links, and expected release titles; it does not verify media playback, backups, social publishing, or WordPress.

## Workstreams and acceptance gates

### 1. Canonical catalogue and provenance

**Purpose:** Maintain one reliable record for every release and, later, every track and archival item.

- Keep release source records in portable Markdown/CSV/JSON; generated HTML is output, never the canonical editing surface.
- Add stable IDs, verified title, known date/year, work type, language, credits, artwork, audio/master availability, video links, source evidence, rights/permissions status, public URL, and last-reviewed date as information becomes available.
- Track completeness with `known`, `unknown`, `not applicable`, and `needs verification`; blank is not permission to guess.
- Reconcile the nine current release records, old WordPress pages/posts, media library, and the 13 unmapped video IDs before claiming the catalogue is complete.
- Preserve source URLs and timestamps when extracting facts from existing material.

**Acceptance gate:** Every identified release has a stable ID and page; each factual field is either sourced or explicitly unknown; no unverified video assignment; a human can export the catalogue in an open format.

### 2. Master archive and integrity

**Purpose:** Make the catalogue reconstructible even if all public websites disappear.

For each work, inventory what actually exists: WAV/FLAC masters, mixes/stems if available, artwork, lyrics, credits, session/production notes, photos, video, press, release documents, identifiers, and rights evidence. Do not create empty claims that an item exists merely because it appears in a template.

Recommended folder structure for the owner's chosen archive storage:

```text
MUSIC-LEGACY/
  00_CATALOGUE/
  01_MASTER_AUDIO/
  02_RELEASES/
  03_ARTWORK/
  04_VIDEO/
  05_PHOTOGRAPHS/
  06_DOCUMENTS/
  07_PRESS/
  08_METADATA/
  09_WEBSITE/
  10_MARKETING/
  99_ARCHIVE_MANIFEST/
```

- Use the checksum manifest tool in `scripts/archive-manifest.mjs` against the actual archive directory after it has been inventoried.
- Keep at least three copies on two types of storage, with one geographically separate; keep one physical copy disconnected when not being updated.
- Do not treat a checksum as a backup: verify restoreability and compare checksums after copying.
- Preserve original files unchanged; create working derivatives separately.

**Acceptance gate:** Inventory exported, SHA-256 manifest generated, three copies and their locations documented, and a sample restore verified. This gate is not passed yet.

### 3. Public catalogue and hosting resilience

- Maintain stable, descriptive URLs for releases and a clear “Start here” page, chronological catalogue, artist/project history, video index, and future-facing archive/rights contact page.
- Keep the website deployable from portable source files and documented build instructions.
- Compare the current GitHub Pages site with the existing WordPress site before selecting one as the primary public home. Consider editing usability, content completeness, accessibility, search visibility, media limits, URL stability, exportability, and recurring cost.
- Do not migrate, delete, redirect, or overwrite either site until a comparison and rollback plan exist.
- Keep a copy of the site source and a static export in the master archive. Check external links and recovery instructions regularly.
- A domain or hosting service can expire or change. Document how to move the site and update links; do not promise permanent hosting.

**Acceptance gate:** A non-technical owner can make a routine content edit through the chosen editor; publication is verified; a fresh copy can be deployed using written instructions; rollback is tested.

### 4. Distribution and preservation partners

- Build a verified list of official artist/channel profiles and legitimate listening/download destinations.
- Prefer more than one discovery surface, but do not create duplicate uploads until rights, audio quality, metadata, account ownership, and platform rules are checked.
- Evaluate public archival repositories and music databases only for material whose rights and terms permit deposit. Record what was deposited, under which terms, and the persistent identifier.
- Keep an exportable list of destinations and the date each was last checked.

**Acceptance gate:** Each destination is verified as official, linked from the canonical catalogue, and has an owner/recovery note where available.

### 5. Evergreen discovery and marketing

- Build an approved queue of factual stories: release spotlights, verified recording history, lyric excerpts only where rights permit, artwork/photo context, listening guides, chronology, and “start here” recommendations.
- Each item must include: claim/source, rights check, target URL, format, channel, approval status, last-used date, and a reuse/cooldown date.
- Start with a sustainable weekly rotation, not daily low-value repetition. Reuse evergreen items only after a cooldown and review.
- Draft and review content first. Do not connect or publish to social accounts until each channel, permission, cadence, and approval boundary is confirmed.
- Track measurable outcomes: qualified site visits, release-page visits, video plays where analytics are available, mailing-list signups if a lawful free solution exists, and referral sources. Do not equate posting volume with discovery.
- Paid advertising is not a perpetual solution without a funded budget. Organic distribution can continue but cannot guarantee reach.

**Acceptance gate:** At least 12 fact-checked, rights-cleared evergreen drafts; channel-specific formats; a documented approval flow; a tested schedule with no duplicate/spam loop; monthly results review. Not passed yet.

### 6. Monitoring and maintenance

- Monthly automated checks where a free, reliable mechanism is available: home page response, release URLs, broken internal links, build/checker status, and catalogue count drift.
- Every six months: human review of metadata, destinations, CMS/editor access, account recovery, backup status, and pending verification items.
- Annually: verify hashes, perform a restore test, export the catalogue and site, review rights/contact information, and update this plan.
- Every 3–5 years: review file formats, storage media, hosting, domain ownership, and service viability.
- Alerts must report evidence and failures, not merely say “healthy”. Avoid scheduling duplicate jobs until existing automations are inventoried.

**Acceptance gate:** Monitoring has been tested, alerts reach a maintained contact, and a failed check produces actionable evidence.

### 7. Succession, rights, and funding

- Create a legacy handover package containing artist/project history, canonical catalogue, archive map, checksums, rights and licensing records, account/domain inventory (never passwords in the repository), restore instructions, marketing queue, service contacts, and a dated maintenance checklist.
- Document a successor or responsible institution only after the person/organization has agreed. Do not publish private personal data.
- Keep credentials in an appropriate password manager and define account recovery/transfer separately from public documentation.
- Review copyright, performer, co-writer, artwork, sample, and recording rights before licensing, redistribution, or public archival deposits.
- Model annual costs and potential revenue from royalties, licensing, downloads, reissues, and other legitimate uses. Do not assume revenue or investment returns. No paid service or fund is created without explicit approval.

**Acceptance gate:** A trusted successor can locate the archive, understand rights/permissions, restore the site, and continue approved catalogue maintenance from the handover package.

## Execution order

1. Audit all existing sites, release records, media, official channels, and available source files without changing or deleting anything.
2. Build the verified catalogue register and mark gaps.
3. Inventory master files and establish/verify backup copies.
4. Decide the primary website after the WordPress-versus-static-site comparison.
5. Complete the public catalogue and preservation export.
6. Prepare and approve evergreen marketing material; only then automate distribution.
7. Add tested monitoring and recurring review.
8. Complete succession, rights, and funding documentation.

## Decision log

- 2026-10-22: Initial freeze on static-site feature expansion was superseded by the owner's explicit decision to rebuild on GitHub Pages and test its editing flexibility. WordPress remains untouched; Wix is not the chosen destination. Use a review branch and evidence-based checks before production deployment.
- 2026-10-22: Add a data-driven homepage settings file, Pages CMS fields for release artwork/video metadata, a searchable/filterable catalogue, an archive-information page, and a separate index for unmatched video IDs. This is a flexibility experiment; the Pages CMS account connection and a real no-code save remain unverified until tested.
- 2026-10-22: Do not assign the 13 unmapped YouTube IDs to releases without evidence.

## Status vocabulary

- `VERIFIED`: supported by direct evidence and date recorded.
- `IN_PROGRESS`: work started but acceptance gate not met.
- `BLOCKED`: requires owner access, missing files, rights evidence, or a decision.
- `NOT_STARTED`: no implementation/evidence yet.
- `UNKNOWN`: cannot be responsibly inferred.
