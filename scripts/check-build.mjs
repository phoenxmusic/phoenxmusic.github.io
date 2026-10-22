import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const exists = async relative => { try { await access(path.join(root, relative)); return true; } catch { return false; } };
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS: ${message}`); };

const site = JSON.parse(await read('content/site.json'));
const homepage = await read('index.html');
const about = await read('about/index.html');
const videos = await read('videos/index.html');
const sourceFiles = (await readdir(path.join(root, 'content', 'releases'))).filter(file => file.endsWith('.md'));
const generatedSlugs = await readdir(path.join(root, 'releases'));
const videoIds = [...(await read('content/unmapped-youtube-ids.md')).matchAll(/^\s*-\s+([A-Za-z0-9_-]{11})\s*$/gm)].map(match => match[1]);

assert(homepage.includes(`<h1>${site.title}</h1>`) && homepage.includes(site.tagline), 'homepage title and subtitle are driven by content/site.json');
assert(homepage.includes('id="release-search"') && homepage.includes('id="year-filter"') && homepage.includes('id="type-filter"') && homepage.includes('id="language-filter"'), 'catalogue search, year, format, and language filters exist');
assert(homepage.includes('@media(max-width:48rem)') && homepage.includes('name="viewport"'), 'responsive layout and viewport metadata are present');
assert(sourceFiles.length === generatedSlugs.length, `all ${sourceFiles.length} Markdown release records have generated pages`);
assert(await exists('about/index.html') && about.includes('How it works'), 'standalone archive information page is generated');
assert(await exists('videos/index.html') && videoIds.length === 13, 'video archive source contains exactly 13 explicitly listed IDs');
assert(videoIds.every(id => videos.includes(`/embed/${id}`)), 'all 13 archived video IDs are rendered without assigning them to releases');
assert(!videos.includes('/embed/description'), 'non-ID prose is not accidentally parsed as a video');
assert(homepage.includes('Πανσέληνος'), 'Greek release titles survive generation');

for (const file of sourceFiles) {
  const slug = path.basename(file, '.md');
  const html = await read(`releases/${slug}/index.html`);
  assert(html.includes('href="/"') && html.includes('Video archive'), `${slug} page has catalogue and archive navigation`);
}

console.log(`Build checks complete: ${sourceFiles.length} releases, ${videoIds.length} archived video IDs, 3 core page types.`);
