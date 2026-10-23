import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { generateSeoAssets } from '../scripts/seo-assets.mjs';

test('SEO assets include only canonical public routes and exclude preview/source trees', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phoenx-seo-'));
  try {
    await mkdir(path.join(root, 'releases', 'sample'), { recursive: true });
    await mkdir(path.join(root, 'releases', 'greek'), { recursive: true });
    await mkdir(path.join(root, 'presentation-preview'), { recursive: true });
    await mkdir(path.join(root, 'content'), { recursive: true });
    await writeFile(path.join(root, 'index.html'), '<link rel="canonical" href="https://phoenxmusic.github.io/">');
    await writeFile(path.join(root, 'releases', 'sample', 'index.html'), '<html><head><title>Sample release</title><meta name="description" content="A sample release"><meta property="og:title" content="Sample release"><meta property="og:description" content="A sample release"><link rel="canonical" href="https://phoenxmusic.github.io/releases/sample/"></head><body>Example</body></html>');
    await writeFile(path.join(root, 'releases', 'greek', 'index.html'), '<link rel="canonical" href="https://phoenxmusic.github.io/στιχοι/">');
    await writeFile(path.join(root, 'presentation-preview', 'index.html'), '<link rel="canonical" href="https://phoenxmusic.github.io/presentation-preview/">');
    await writeFile(path.join(root, 'content', 'draft.html'), '<link rel="canonical" href="https://phoenxmusic.github.io/draft/">');

    const summary = await generateSeoAssets(root);
    const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
    const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
    const generatedPage = await readFile(path.join(root, 'releases', 'sample', 'index.html'), 'utf8');
    assert.equal(summary.urls, 3);
    assert.match(sitemap, /https:\/\/phoenxmusic\.github\.io\//);
    assert.match(sitemap, /https:\/\/phoenxmusic\.github\.io\/releases\/sample\//);
    assert.match(sitemap, /%CF%83%CF%84%CE%B9%CF%87%CE%BF%CE%B9/);
    assert.doesNotMatch(sitemap, /presentation-preview|\/draft\//);
    assert.match(robots, /User-agent: \*/);
    assert.match(robots, /Sitemap: https:\/\/phoenxmusic\.github\.io\/sitemap\.xml/);
    assert.match(generatedPage, /name="twitter:card" content="summary"/);
    assert.match(generatedPage, /name="twitter:title" content="Sample release"/);
    assert.match(generatedPage, /name="twitter:description" content="A sample release"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SEO asset generation fails if the canonical homepage is absent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phoenx-seo-empty-'));
  try {
    await writeFile(path.join(root, 'index.html'), '<html><head></head><body>no canonical</body></html>');
    await assert.rejects(() => generateSeoAssets(root), /canonical homepage .* was not found/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
