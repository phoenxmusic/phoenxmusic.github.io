import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = 'https://phoenxmusic.github.io';

function xmlEscape(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
function parseDate(value) {
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : `${value.replace(' ', 'T')}Z`);
}

export async function generateFeed({ rootDir = root, now = new Date() } = {}) {
  const source = path.join(rootDir, 'content', 'wordpress', 'posts.json');
  let records = [];
  try { records = JSON.parse(await readFile(source, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const items = records
    .filter(record => record.status === 'publish' && typeof record.route === 'string' && record.route.startsWith('/') && !record.route.startsWith('//') && !/[\r\n]/.test(record.route) && !record.route.includes('..'))
    .filter(record => /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(record.date || '') && !Number.isNaN(parseDate(record.date).getTime()))
    .sort((a, b) => parseDate(b.date) - parseDate(a.date))
    .slice(0, 50);
  const latest = items.length ? parseDate(items[0].date).toISOString() : now.toISOString();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>', '<rss version="2.0"><channel>',
    `<title>${xmlEscape('PhoenX — Archive Journal')}</title>`, `<link>${baseUrl}/journal/</link>`,
    '<description>Published archive posts from the PhoenX music catalogue. Original publication dates are preserved.</description>',
    `<lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>`,
    ...items.map(record => {
      const link = new URL(record.route, baseUrl).href;
      const date = parseDate(record.date);
      const description = String(record.excerpt || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || `${record.title} — imported from the published WordPress archive.`;
      return `<item><title>${xmlEscape(record.title || 'Untitled archive post')}</title><link>${xmlEscape(link)}</link><guid isPermaLink="true">${xmlEscape(link)}</guid><pubDate>${date.toUTCString()}</pubDate><description>${xmlEscape(description)}</description></item>`;
    }), '</channel></rss>', ''
  ].join('\n');
  await writeFile(path.join(rootDir, 'rss.xml'), xml, 'utf8');
  return { items: items.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await generateFeed();
  console.log(`Generated rss.xml from ${result.items} published archive posts; no new publication dates were invented.`);
}
