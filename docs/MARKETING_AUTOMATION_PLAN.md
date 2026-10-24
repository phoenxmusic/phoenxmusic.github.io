# PhoenX 24/7 discovery, SEO, and marketing automation

**Status:** local SEO/feed build, draft-only engine, and social metadata checks are implemented; GitHub Actions validation passed on the review branch. Recurring schedules still require the workflows to be on the default branch. Publishing integrations are not connected.
**Cost target:** $0, using repository automation, static-site tooling, public platform features, and existing accounts.
**Canonical destination:** `https://phoenxmusic.github.io/` while the review version is evaluated.
**Safety rule:** this plan does not authorize a production deploy, account connection, or public post.

## Goal

Continuously improve the chance that listeners discover PhoenX music, videos, release history, and archive stories; route that attention to durable catalogue pages; measure what works; and prevent inaccurate claims, rights problems, repetitive posts, and unattended automation failures.

“24/7” means that scheduled jobs, monitoring, and queue preparation can run without the owner sitting at the computer. It does not promise uninterrupted service, guaranteed social reach, or a post every hour. Scheduled GitHub Actions can be delayed or skipped, so the workflow must be idempotent and report the last successful run.

## What to build

### 1. Search-engine foundation

- Generate `sitemap.xml` from the actual public routes after each successful site build; exclude preview material, source files, private/draft records, and redirects that are not canonical pages.
- Generate `robots.txt` that allows public catalogue crawling and references the sitemap.
- Add a feed (`rss.xml` or Atom) for newly published, approved archive features and journal entries. Do not label an old imported post as new just because it was migrated.
- Review title, meta description, canonical URL, language, Open Graph image, and social preview per route. Preserve Greek characters and original dates.
- Add JSON-LD only where supported by verified source data. Use MusicAlbum/MusicRecording or VideoObject only when the relevant release/video relationship and fields are confirmed; do not invent ISRCs, dates, performers, or artwork.
- Add checks for unique canonical URLs, missing/duplicate titles and descriptions, internal 404s, sitemap validity, and exclusion of preview/draft paths.
- Submit the canonical sitemap to Google Search Console and Bing Webmaster Tools only after the production destination is approved and the owner completes account verification.

### 2. Evidence-backed evergreen content engine

- Read the catalogue, imported public posts/pages, and approved marketing queue as source material.
- Generate draft variants for: release spotlights, chronology, “start here” listening paths, video highlights, Greek/English discovery guides, and sourced archive stories.
- Every draft records source record(s), factual claims, target canonical URL, rights status, channel format, language, creation date, approval status, and cooldown.
- Reject or hold drafts that depend on unknown facts, unmatched video IDs, unavailable media, unverified credits, or uncleared artwork/lyrics.
- Maintain English and Greek variants only when a reliable translation can be reviewed; do not silently change titles or lyrics.
- Reuse evergreen material only after its cooldown, with a materially different audience angle and destination-specific copy.

### 3. Scheduling and distribution adapters

- Keep a single platform-neutral campaign queue; create a separate adapter for each explicitly approved destination.
- Prepare channel-native variants and links with campaign tags, but never publish the same text to every channel by default.
- Enforce per-channel frequency caps, minimum cooldowns, duplicate detection, rate-limit handling, retries with backoff, and a global kill switch.
- Start in **draft-only mode**. Public auto-publishing stays disabled until the owner confirms the exact accounts, destinations, scopes/permissions, cadence, and approval boundary. Credentials belong in repository/environment secrets, never in source files or logs.
- Publishing must be idempotent: a retry cannot create a second copy of the same post. Store external post IDs and status after a confirmed response.
- If a platform has no suitable free, supported API, keep an exportable ready-to-schedule draft rather than scraping the platform or using brittle browser automation.

### 4. Continuous monitoring and reporting

- Scheduled checks: homepage, sitemap, feed, representative release pages, internal links, build/tests, catalogue counts, queue health, and recent workflow status.
- Daily campaign report: jobs attempted/completed, drafts created, items held and why, items published only if publishing is enabled, failed destinations, and links to evidence/logs.
- Weekly report: top landing pages and referrals when analytics data is available, newly indexed/known search data when available, best-performing approved themes, stale links, and the next proposed queue items.
- Monthly review: Search Console/Bing query and page trends, organic landing-page visits, video click-through where available, and newsletter conversions only if a lawful, consent-based signup is implemented.
- Alert on failure with actionable details. Do not report “healthy” if analytics or a connected destination was unavailable; report “not measured”.

## Operating schedule (initial proposal)

| Frequency | Automated work | Public side effect |
|---|---|---|
| On each reviewed branch push | Build, tests, metadata checks, sitemap/feed generation, preview report | None |
| Every 6 hours | Lightweight route/sitemap/feed health check with retry/backoff | None |
| Daily | Generate a small batch of evidence-backed draft candidates; enforce duplicate/cooldown rules | None in draft-only mode |
| Weekly | Assemble performance/queue report and propose next themes | None |
| Monthly | Full broken-link, route, metadata, and catalogue-drift audit | None |

After publishing is explicitly enabled, the first live cadence should be conservative (for example, two or three approved posts per week across all channels combined), then adjusted using measured engagement—not increased just because the scheduler can run more often.

## Data and workflow boundaries

- Keep source records, generated drafts, approval records, delivery receipts, and analytics reports separate.
- Queue states: `idea` → `drafted` → `needs_review` → `approved` → `scheduled` → `published`; terminal alternatives include `held_rights`, `held_fact_check`, `failed`, and `retired`.
- A content item is eligible for publication only if its source evidence is recorded, rights status is cleared for the proposed asset/use, target URL resolves, copy passed automated checks, cooldown has expired, and the required approval is present.
- Automated factual checks can catch missing evidence and malformed links; they cannot independently establish copyright ownership or guarantee that a historical claim is true.
- Keep tracking parameters limited to campaign attribution; canonical tags must remain untagged canonical URLs.
- No paid ads, purchased followers, mass unsolicited messages, scraping of restricted services, or automatic outreach.

## Implementation sequence and acceptance gates

1. **SEO plumbing:** implement sitemap, robots, feed, structured metadata checks, and tests. Pass when the generated sitemap exactly matches eligible canonical routes and no preview/source/draft paths leak into it.
2. **Draft engine:** build deterministic candidate generation from verified source fields and the existing queue. Pass when fixtures prove missing facts/rights block an item and duplicate/cooldown checks are enforced.
3. **Scheduler and reports:** add scheduled workflows with least-privilege permissions, retry/backoff, run logs, and an observable last-success timestamp. Pass after repeated dry runs and a simulated failure produce accurate reports without duplicate items.
4. **Analytics:** document Search Console/Bing verification and privacy-conscious analytics choices. Pass when real data is accessible and report outputs distinguish missing data from zero traffic.
5. **Publishing integration:** add one destination at a time after account and permission confirmation. Pass only after a private/test-mode end-to-end run, idempotency test, failure test, and explicit owner approval to enable public publishing.

## Current blockers / facts

- The current review branch has a large uncommitted set of imported/rebuilt site files and a new WordPress export. Preserve these changes; do not reset or blanket-commit them while implementing the marketing layer.
- The repository already has `content/marketing/queue.csv`, but it is planning-only and its items are not approved for publication.
- Local build validation generates `sitemap.xml`, `robots.txt`, and `rss.xml`; the current verified local build produced 145 canonical routes and 50 dated, published RSS items. This does not prove search-engine indexing or traffic growth.
- The SEO build supplies `twitter:card`, `twitter:title`, `twitter:description`, and a default `og:image` on all 145 public HTML routes. The metadata audit confirms 145/145 have titles, descriptions, canonicals, and social preview fields, with zero duplicate/invalid canonicals and zero Open Graph URL mismatches.
- The default social preview is an original typographic PhoenX archive card (`assets/phoenx-social-card.png`, 1200×630) with an editable SVG source and a local Pillow-based regeneration helper. It does not reuse or imply clearance for any specific release artwork; existing page-specific `og:image` values are preserved.
- The local draft-only dry run produced nine candidate files, with all nine held because rights clearance and human approval are not established. No campaign item was published.
- The draft generator now fails closed on missing/duplicate queue columns, unsafe or duplicate item IDs, evidence paths that resolve outside the repository, output paths that resolve into the repository, and pre-existing symlinked/hard-linked draft files. Regression tests cover traversal and output symlink cases; Windows skips file-symlink cases when OS permissions prohibit creating them.
- `.github/workflows/seo-health.yml` and `.github/workflows/marketing-drafts.yml` provide read-only health checks and artifact-based draft review. The SEO and legacy-monitor workflows passed on commit `e192280`; the draft workflow passed on commit `06e4196`. Recurring schedules run from the default branch; do not merge this review branch without separate production approval.
- The legacy monitor compares two complete build snapshots and runs the branding check on review branches. Its live-site probe is now restricted to scheduled/manual runs on `main`, so un-deployed review changes are not incorrectly reported as production failures. No monitor guard was removed; the production URL probe remains active on `main`.
- The site is a review version; do not treat it as the approved production destination until the owner reviews and authorizes deployment.
- The PhoenX Music export's 102 image binaries have been recovered locally and signature-verified, but rights evidence remains incomplete. Do not make artwork-dependent promotion eligible until the relevant asset's usage rights are cleared; this does not recover audio/video files or verify the separate Meniossymeon WordPress archive.
- No social publishing integration, search-console data connection, or owner-approved publication cadence is evidenced in this repository.

## Definition of done

The campaign is not “live” merely because a cron workflow exists. Done means: SEO artifacts pass automated validation; the draft engine creates sourced and rights-gated candidates; scheduled jobs report verifiable outcomes; analytics reports use real available data; every publishing destination is owner-authorized; public posts are deduplicated and rate-limited; and an emergency disable path is tested.
