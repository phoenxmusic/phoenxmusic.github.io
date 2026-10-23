import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set(['.git', '.github', 'content', 'docs', 'node_modules', 'presentation-preview', 'scripts', 'tests']);

async function collect(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!excluded.has(entry.name)) await collect(path.join(directory, entry.name), files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

const attr = (html, pattern) => html.match(pattern)?.[1]?.trim() ?? '';
const files = (await collect(root)).sort();
const records = [];
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const title = attr(html, /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i).replace(/\s+/g, ' ');
  const description = attr(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i);
  const canonical = attr(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i);
  const ogTitle = attr(html, /<meta\s+property=["']og:title["']\s+content=["']([^"']*)["'][^>]*>/i);
  const ogDescription = attr(html, /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["'][^>]*>/i);
  const ogUrl = attr(html, /<meta\s+property=["']og:url["']\s+content=["']([^"']*)["'][^>]*>/i);
  const ogImage = attr(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']*)["'][^>]*>/i);
  const twitterCard = attr(html, /<meta\s+name=["']twitter:card["']\s+content=["']([^"']*)["'][^>]*>/i);
  records.push({ file: path.relative(root, file).split(path.sep).join('/'), title, description, canonical, ogTitle, ogDescription, ogUrl, ogImage, twitterCard });
}

const missing = records.filter(record => !record.title || !record.description || !record.canonical);
const canonicals = records.map(record => record.canonical).filter(Boolean);
const duplicates = [...new Set(canonicals.filter((url, index) => canonicals.indexOf(url) !== index))];
const badCanonicals = records.filter(record => {
  if (!record.canonical) return false;
  try {
    const url = new URL(record.canonical);
    return url.protocol !== 'https:' || url.origin !== 'https://phoenxmusic.github.io' || url.username !== '' || url.password !== '';
  } catch { return true; }
});
const mismatchedOpenGraph = records.filter(record => record.canonical && record.ogUrl && record.canonical !== record.ogUrl);
const missingOgImage = records.filter(record => !record.ogImage);
const missingTwitterCard = records.filter(record => !record.twitterCard);
const missingOgTitle = records.filter(record => !record.ogTitle);
const missingOgDescription = records.filter(record => !record.ogDescription);

console.log(`SEO metadata audit: ${records.length} public HTML files scanned.`);
console.log(`Required fields: ${records.length - missing.length}/${records.length} have title, meta description, and canonical.`);
console.log(`Canonical duplicates: ${duplicates.length}; invalid/out-of-site canonicals: ${badCanonicals.length}; Open Graph URL mismatches: ${mismatchedOpenGraph.length}.`);
console.log(`Social-preview gaps (non-fatal): og:image ${missingOgImage.length}; twitter:card ${missingTwitterCard.length}; og:title ${missingOgTitle.length}; og:description ${missingOgDescription.length}.`);
if (missing.length) console.error('Missing required metadata:', missing.map(record => record.file + ' [' + [!record.title && 'title', !record.description && 'description', !record.canonical && 'canonical'].filter(Boolean).join(', ') + ']').join('; '));
if (duplicates.length) console.error('Duplicate canonical URLs:', duplicates.join(', '));
if (badCanonicals.length) console.error('Invalid canonical URLs:', badCanonicals.map(record => record.file + ' => ' + record.canonical).join('; '));
if (mismatchedOpenGraph.length) console.error('Open Graph URL mismatches:', mismatchedOpenGraph.map(record => record.file).join(', '));
if (missingOgImage.length) console.log('Sample pages missing og:image:', missingOgImage.slice(0, 8).map(record => record.file).join(', '));
if (missingTwitterCard.length) console.log('Sample pages missing twitter:card:', missingTwitterCard.slice(0, 8).map(record => record.file).join(', '));
if (missing.length || duplicates.length || badCanonicals.length || mismatchedOpenGraph.length) process.exitCode = 1;
