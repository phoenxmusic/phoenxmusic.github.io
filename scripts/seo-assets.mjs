import path from 'node:path';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const EXCLUDED_DIRECTORIES = new Set([
  '.git', '.github', 'content', 'docs', 'node_modules', 'presentation-preview', 'scripts', 'tests'
]);

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function findHtmlFiles(directory, root, results = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name)) await findHtmlFiles(absolute, root, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      results.push({ absolute, relative });
    }
  }
  return results;
}

/** Generate deterministic crawler files from existing HTML canonical tags. */
export async function generateSeoAssets(root, baseUrl = 'https://phoenxmusic.github.io') {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const htmlFiles = await findHtmlFiles(root, root);
  const canonicalUrls = new Set();
  const ignored = [];

  for (const file of htmlFiles) {
    const html = await readFile(file.absolute, 'utf8');
    const match = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?\s*>/i);
    if (!match) {
      ignored.push(file.relative);
      continue;
    }
    const canonical = match[1].replaceAll('&amp;', '&');
    if (/\s/.test(canonical) || !canonical.startsWith(`${normalizedBase}/`) || canonical.includes('/presentation-preview/')) {
      ignored.push(file.relative);
      continue;
    }
    let normalizedUrl;
    try {
      normalizedUrl = new URL(canonical);
    } catch {
      ignored.push(file.relative);
      continue;
    }
    if (normalizedUrl.protocol !== 'https:' || normalizedUrl.origin !== normalizedBase || normalizedUrl.username || normalizedUrl.password) {
      ignored.push(file.relative);
      continue;
    }
    // URL.href percent-encodes Unicode path segments as required by sitemap consumers.
    canonicalUrls.add(normalizedUrl.href);
  }

  const urls = [...canonicalUrls].sort((a, b) => a.localeCompare(b, 'en'));
  if (!urls.includes(`${normalizedBase}/`)) {
    throw new Error(`SEO asset generation: canonical homepage ${normalizedBase}/ was not found`);
  }
  if (urls.some(url => /[\s<>"']/.test(url))) {
    throw new Error('SEO asset generation: a canonical URL contains invalid whitespace or XML characters');
  }

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(url => `  <url><loc>${xmlEscape(url)}</loc></url>`),
    '</urlset>',
    ''
  ].join('\n');
  const robots = `User-agent: *\nAllow: /\nSitemap: ${normalizedBase}/sitemap.xml\n`;

  await writeFile(path.join(root, 'sitemap.xml'), sitemap, 'utf8');
  await writeFile(path.join(root, 'robots.txt'), robots, 'utf8');
  return { htmlFiles: htmlFiles.length, urls: urls.length, ignored: ignored.length };
}
