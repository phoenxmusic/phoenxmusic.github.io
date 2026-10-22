#!/usr/bin/env node
// Read-only monthly smoke check for the published PhoenX site.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = (process.env.PHOENX_SITE_URL || 'https://phoenxmusic.github.io').replace(/\/$/, '');
const releaseDir = path.join(root, 'content', 'releases');
const filenames = (await readdir(releaseDir)).filter(name => name.endsWith('.md')).sort();
if (!filenames.length) throw new Error('No release source files found.');
const readJson = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const importedRecords = [
  ...await readJson('content/wordpress/pages.json'),
  ...await readJson('content/wordpress/posts.json'),
  ...await readJson('content/wordpress/portfolio.json'),
];
if (!importedRecords.length || importedRecords.some(record => record.status !== 'publish' || !record.route || !record.title)) {
  throw new Error('Imported public archive records are missing required published status, route, or title.');
}

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function readTitle(raw, filename) {
  const front = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!front) throw new Error(`${filename}: missing front matter`);
  const line = front[1].split(/\r?\n/).find(item => /^title\s*:/.test(item));
  if (!line) throw new Error(`${filename}: missing title`);
  let title = line.slice(line.indexOf(':') + 1).trim();
  if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) title = title.slice(1, -1);
  return title;
}

const releases = [];
for (const filename of filenames) {
  const raw = await readFile(path.join(releaseDir, filename), 'utf8');
  releases.push({ slug: path.basename(filename, '.md'), title: readTitle(raw, filename) });
}

let failures = 0;
async function check(url, expectedTitle, label) {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'PhoenX-Legacy-Monitor/1.0' } });
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    const problems = [];
    if (!response.ok) problems.push(`HTTP ${response.status}`);
    if (!contentType.toLowerCase().includes('text/html')) problems.push(`unexpected content-type ${contentType || '(missing)'}`);
    if (expectedTitle && !body.includes(escapeHtml(expectedTitle))) problems.push(`expected title text not found: ${expectedTitle}`);
    if (problems.length) {
      failures++;
      console.error(`FAIL ${label} ${url} — ${problems.join('; ')}`);
    } else {
      console.log(`PASS ${label} ${url} — HTTP ${response.status}, ${body.length} characters`);
    }
    return body;
  } catch (error) {
    failures++;
    console.error(`FAIL ${label} ${url} — ${error.message}`);
    return '';
  }
}

const homepage = await check(`${baseUrl}/`, 'PhoenX', 'homepage');
for (const release of releases) {
  if (!homepage.includes(`/releases/${release.slug}/`)) {
    failures++;
    console.error(`FAIL homepage catalogue link missing for ${release.slug}`);
  }
}

const targets = [
  ...releases.map(release => ({ route: `/releases/${release.slug}/`, title: release.title, label: `release:${release.slug}` })),
  ...importedRecords.map(record => ({ route: record.route, title: record.title, label: `wordpress:${record.type}:${record.id}` })),
  ...[
    ['/journal/', '109 published posts', 'archive:journal'],
    ['/archive-pages/', '19 published pages', 'archive:pages'],
    ['/media-archive/', '150 attachment records', 'archive:media'],
    ['/archive-info/', 'What is verified', 'archive:information'],
  ].map(([route, title, label]) => ({ route, title, label })),
];

// Keep the monthly probe bounded: parallel batches avoid a long serial run
// without generating an unbounded burst of requests to GitHub Pages.
const batchSize = 8;
for (let index = 0; index < targets.length; index += batchSize) {
  const batch = targets.slice(index, index + batchSize);
  await Promise.all(batch.map(target => check(`${baseUrl}${target.route}`, target.title, target.label)));
}

if (failures) {
  console.error(`MONITOR FAILED: ${failures} problem(s) across homepage, ${releases.length} release pages, ${importedRecords.length} imported WordPress routes, and 4 archive indexes.`);
  process.exit(1);
}
console.log(`MONITOR PASSED: homepage, ${releases.length} release pages, ${importedRecords.length} imported WordPress routes, and 4 archive indexes returned valid HTML with expected titles and homepage catalogue links.`);
