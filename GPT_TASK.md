# Task for GPT (via DevSpace): publish the PhoenX test site

Cost: $0. Do not buy anything. Do not touch phoenxmusic.wordpress.com or any other existing site.

Public-facing artist identity: PhoenX only. The repository includes a banned-term check; install its local Git hooks with `git config core.hooksPath .githooks` after cloning. The GitHub Action also checks pushes and pull requests.

## Do
1. Create a public repo named exactly `phoenxmusic.github.io` under the GitHub account `phoenxmusic`.
2. Push the files in this folder to the `main` branch: `index.html`, `catalogue.json`, `.nojekyll`, `GPT_TASK.md`.
3. Enable GitHub Pages (Settings > Pages > deploy from branch `main`, folder `/`).
4. Wait until https://phoenxmusic.github.io/ loads, then report the result.

## Pass/fail test (report each as PASS or FAIL with evidence)
1. The page is live at https://phoenxmusic.github.io/ with no manual steps from the owner.
2. Make one small edit (change the subtitle), push, and confirm the live page updates.
3. Deliberately break the page, then roll back with one `git revert`, and confirm the live page recovers.
4. Greek titles display correctly and the YouTube player loads.
5. The page is readable and responsive on a phone-width viewport.

## Rules
- Do not invent facts about the artist. Fields set to `null` in `catalogue.json` are unknown.
- If any step needs a login or credential you don't have, stop and say exactly what is needed. Never ask for or paste passwords or tokens in chat.
- Report limits you hit (build time, size, rate limits) instead of working around them.
