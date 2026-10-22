# PhoenX music catalogue

The public site is built from Markdown files in `content/releases/`. Each file represents one release. Edit the front-matter fields and the story/credits body through [Pages CMS](https://app.pagescms.org/) after granting it access to this repository. A GitHub Action regenerates the root `index.html` and `releases/` pages after each non-build push; GitHub Pages is configured to publish `main` from `/`.

## Edit a release

1. Open Pages CMS and sign in with GitHub.
2. Install/authorize the Pages CMS GitHub App for `phoenxmusic/phoenxmusic.github.io` if prompted.
3. Open this repository and select the `main` branch.
4. Select **Releases**, then open a release.
5. Edit the fields or rich-text **Story and credits** body, then save/commit to `main`.
6. The **Build and deploy PhoenX site** GitHub Action builds and publishes the change.

Blank values are unknown; do not guess them. The artist name is PhoenX only. `.banned-terms` is enforced by the local Git hooks and the GitHub Actions check.

## Local build

Requires Node.js only; no package installation is needed.

```sh
node scripts/build.mjs
```

The script writes the generated `index.html`, `.nojekyll`, and `releases/<slug>/index.html` pages. It only clears the generated `releases/` folder; source files in `content/releases/` are kept separate.
