# PhoenX Music repository roadmap

**Project:** phoenxmusic.github.io

**Purpose:** Maintain a portable PhoenX music catalogue and archive website, then operate evidence-led SEO, discovery, and rights-gated marketing workflows that bring listeners to durable catalogue pages without publishing unverified or uncleared material.

## Current status

The repository builds a static GitHub Pages site from portable catalogue and imported public-content records. It includes nine permanent release records/pages, imported published WordPress pages and posts, a searchable video archive, and locally recovered image assets. The build and audit tooling checks route generation, internal links, source provenance, reproducibility, branding, SEO metadata, sitemap/RSS output, and archive/media manifests.

The SEO foundation is implemented: sitemap, robots.txt, RSS generation, canonical metadata checks, and social preview metadata are present. The draft-only marketing engine reads the evidence-backed queue, generates drafts outside the public site, and holds items when rights, approval, evidence, canonical destinations, duplicate checks, or cooldown rules fail. The current queue has nine candidate records; all have rights_status=unknown and approval_status=not_approved, so none is authorized for publication.

GitHub Actions definitions exist for six-hour SEO health checks, daily draft generation, monthly legacy monitoring, deployment, and the banned-term guard. The marketing and SEO workflows are on the review branch; recurring schedule execution from the default branch has not been verified. No social publishing integration or Search Console/Bing performance connection is configured. The real master archive has not been inventoried, backed up three ways, or restore-tested.

**Repository evidence at last review (2026-10-31):** branch feat/github-pages-flexibility-test; HEAD fea2902 (2026-10-24); remote branch was in sync at inspection. The working tree was not clean: index.html and scripts/build.mjs were modified and an untracked nul) entry was present. These local changes are preserved and have not been treated as verified or included in this roadmap change. GitHub PR #1, “Harden evidence-gated PhoenX marketing drafts”, is open. No open GitHub issues or tracked TODO/FIXME/TBD comments were found in the inspected source/documentation files.

## Milestones

### 1. Static catalogue and archive presentation

**Status:** Done

Goal: Keep the public catalogue navigable, portable, and traceable to source records.

Tasks:

- [Done] Build the static website from portable release and imported-content records.
- [Done] Maintain permanent release pages and the searchable/filterable release catalogue.
- [Done] Publish the imported public pages and posts while retaining source URLs and dates.
- [Done] Maintain the searchable public video index and keep unmatched YouTube IDs separate until verified.
- [Done] Recover and signature-check the 102 image binaries in the PhoenX Music export; do not treat file verification as rights clearance.

### 2. Technical SEO and feed foundation

**Status:** Done

Goal: Make public catalogue pages consistently crawlable and shareable.

Tasks:

- [Done] Generate sitemap.xml and robots.txt from eligible public canonical routes.
- [Done] Generate RSS from dated, published archive posts without assigning new publication dates.
- [Done] Apply and audit page titles, descriptions, canonical URLs, Open Graph metadata, and Twitter cards.
- [Done] Validate generated XML, routes, internal links, and metadata in the automated site checks.

### 3. Evidence-gated marketing draft engine

**Status:** Done

Goal: Generate reviewable campaign drafts without publishing unapproved content.

Tasks:

- [Done] Maintain the platform-neutral campaign queue with source, rights, target, channel, approval, and cooldown fields.
- [Done] Generate deterministic draft files and reports outside the public website directory.
- [Done] Hold drafts when evidence is missing, rights are not cleared, or human approval is absent.
- [Done] Enforce canonical release destinations, duplicate-destination checks, and reuse cooldown validation.
- [Done] Cover queue parsing and publication safeguards with automated tests.

### 4. Scheduled operations and workflow activation

**Status:** In progress

Goal: Make the reviewable workflows operate predictably and provide evidence of their latest successful runs.

Tasks:

- [Done] Define the six-hour SEO health workflow and daily draft-generation workflow with read-only repository permissions.
- [In progress] Review and resolve GitHub PR #1, “Harden evidence-gated PhoenX marketing drafts”. **Needs confirmation:** the PR remains open; its final disposition has not been verified in this session.
- [Blocked] Put the reviewed scheduled workflows on the default branch only after the owner authorizes the required merge. **Needs confirmation:** production-branch approval is not recorded.
- [Blocked] Verify recurring default-branch runs, generated draft artifacts, retention, and the last successful run after the workflows are available there.
- [Planned] Add an actionable failure/last-success reporting path that does not imply a workflow is healthy when a dependency was unavailable.

### 5. Search and traffic measurement

**Status:** Blocked

Goal: Measure whether organic search and referral traffic are bringing listeners to the catalogue.

Tasks:

- [Blocked] Confirm the approved canonical production destination before connecting search-performance services. **Needs confirmation:** the review site is not yet approved as the production destination.
- [Blocked] Verify ownership and connect Google Search Console and Bing Webmaster Tools. **Needs confirmation:** account access and verification have not been supplied.
- [Blocked] Produce a weekly report using real query, page, indexing, and referral data; distinguish unavailable data from zero traffic.
- [Planned] Decide whether a separate privacy-conscious traffic analytics source is needed. **Needs confirmation:** no analytics product or data-retention choice is recorded.

### 6. Rights-cleared content distribution

**Status:** Blocked

Goal: Turn approved evergreen material into measured, channel-appropriate distribution without spam or rights violations.

Tasks:

- [Blocked] Review factual evidence and usage rights for each of the nine current queue candidates. **Needs confirmation:** all nine currently have unknown rights status and are not approved.
- [Blocked] Confirm the official publishing accounts, permissions, channel scope, cadence, and human-approval boundary. **Needs confirmation:** no destination authorization is recorded.
- [Planned] Build a bank of at least 12 fact-checked, rights-cleared evergreen drafts, as required by the legacy-plan acceptance gate.
- [Planned] Implement one destination adapter only after authorization, with idempotency, duplicate protection, rate limits, retries, delivery receipts, and a global kill switch.
- [Planned] Test the adapter in private/test mode, including duplicate-retry and failure cases, before any public auto-publishing is enabled.

### 7. Master archive integrity and handover

**Status:** Blocked

Goal: Preserve the original music archive independently of any website or hosting provider.

Tasks:

- [Blocked] Confirm the actual master-archive source path, owner-approved scope, and storage devices. **Needs confirmation:** the source archive is not exposed to this repository workspace.
- [Blocked] Inventory the confirmed source and write a SHA-256 manifest to a separate destination using scripts/archive-manifest.mjs.
- [Blocked] Establish three independent copies across at least two storage types, including one geographically separate copy, and verify each against the baseline manifest.
- [Blocked] Restore a representative selection into a new location and verify checksums and media playback.
- [Planned] Complete the rights/provenance register for material considered for promotion or archival deposit.
- [Planned] Prepare a portable handover package covering catalogue sources, archive map, rights evidence, account recovery, deployment, restore instructions, and maintenance ownership.

## Open questions and risks

- The review branch has not been authorized for merge or production deployment. Scheduled GitHub Actions do not provide evidence of recurring operation until they run from the default branch.
- PR #1 is open. Its final review/merge decision is not confirmed.
- The nine marketing queue records are briefs, not approved posts. All nine are held by unknown rights status and missing human approval.
- No official social publishing destination, publishing permission, or autonomous posting cadence is confirmed.
- Search Console/Bing ownership and analytics access are not configured; organic performance is therefore not measured.
- The source master archive path is unknown to this workspace. Repository media checks do not establish a complete master archive or verified backups.
- The 102 recovered image binaries are a specific PhoenX Music export result; this does not establish recovery of audio/video masters or completeness of the separate legacy WordPress archive. Rights clearance remains a separate requirement.
- The root-level GPT_TASK.md describes an earlier minimal deployment procedure and is stale relative to the current generated-site architecture. LEGACY_PLAN.md remains the broader preservation and succession source; docs/MARKETING_AUTOMATION_PLAN.md is the current marketing implementation plan.
- The local working tree had unrelated uncommitted changes at roadmap preparation time. They must remain isolated from roadmap commits.

## Assumptions

- This roadmap describes the checked-in repository and its documented intended work. Uncommitted local edits are not assumed correct or complete.
- Existing workflows and local validation are considered implemented where the code and workflow definitions exist; recurring production operation is not considered complete without default-branch run evidence.
- “Done” for image recovery means file retrieval and signature verification only, not ownership, licensing, or permission to promote.
- No public publishing, production deployment, account connection, or archive mutation is authorized by this roadmap.

## Last updated

2026-10-31
