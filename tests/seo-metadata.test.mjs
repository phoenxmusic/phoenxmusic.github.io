import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

test('SEO metadata audit detects missing required fields, duplicate canonicals, and social preview gaps', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phoenx-seo-metadata-'));
  try {
    await mkdir(path.join(root, 'scripts'), { recursive: true });
    await mkdir(path.join(root, 'pages', 'one'), { recursive: true });
    await mkdir(path.join(root, 'pages', 'two'), { recursive: true });
    const source = await readFile(new URL('../scripts/audit-seo-metadata.mjs', import.meta.url), 'utf8');
    await writeFile(path.join(root, 'scripts', 'audit-seo-metadata.mjs'), source);
    const page = '<title>Example</title><meta name="description" content="Example page"><link rel="canonical" href="https://phoenxmusic.github.io/example/"><meta property="og:title" content="Example"><meta property="og:description" content="Example page"><meta property="og:url" content="https://phoenxmusic.github.io/example/">';
    await writeFile(path.join(root, 'pages', 'one', 'index.html'), page);
    await writeFile(path.join(root, 'pages', 'two', 'index.html'), page.replace('<title>Example</title>', '<title></title>'));
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'audit-seo-metadata.mjs')], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Canonical duplicates: 1/);
    assert.match(result.stdout, /og:image 2/);
    assert.match(result.stderr, /Missing required metadata/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
