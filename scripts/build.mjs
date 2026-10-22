import { readdir, readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'content', 'releases');
const outDir = root;
const generatedReleasesDir = path.join(root, 'releases');
const bannedFile = path.join(root, '.banned-terms');
const banned = (await readFile(bannedFile, 'utf8')).split(/\r?\n/).map(x => x.trim()).filter(Boolean);

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function parseRelease(filename, raw) {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: missing YAML front matter`);
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    if (colon < 1) throw new Error(`${filename}: invalid front matter line: ${line}`);
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value === 'null' || value === '~') value = '';
    fields[key] = value;
  }
  for (const key of ['title', 'year', 'type', 'language', 'youtube_id', 'old_site_url']) {
    if (!(key in fields)) throw new Error(`${filename}: missing field ${key}`);
  }
  const slug = path.basename(filename, '.md');
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`${filename}: filename must use lowercase letters, numbers, and hyphens`);
  const allText = `${raw}\n${slug}`.toLocaleLowerCase();
  for (const term of banned) if (allText.includes(term.toLocaleLowerCase())) throw new Error(`${filename}: banned term detected`);
  return { ...fields, year: fields.year.trim(), body: match[2].trim(), slug };
}

function markdownToHtml(markdown) {
  if (!markdown.trim()) return '';
  return markdown.trim().split(/\n\s*\n/).map(block => {
    const text = escapeHtml(block.trim()).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>');
    if (text.startsWith('### ')) return `<h3>${text.slice(4)}</h3>`;
    if (text.startsWith('## ')) return `<h2>${text.slice(3)}</h2>`;
    if (text.startsWith('# ')) return `<h2>${text.slice(2)}</h2>`;
    if (text.split('\n').every(line => /^- /.test(line))) return `<ul>${text.split('\n').map(line => `<li>${line.slice(2)}</li>`).join('')}</ul>`;
    return `<p>${text.replaceAll('\n', '<br>')}</p>`;
  }).join('\n');
}

const style = `:root{--night:#0e1118;--moon:#ece6d3;--ember:#c8402b;--ash:#9a9ea8;--rule:#2a2f3b;color-scheme:dark}*{box-sizing:border-box}html{font-size:100%;scroll-padding-top:1rem}body{margin:0;background:var(--night);color:var(--moon);font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;line-height:1.65}a{color:var(--moon);text-decoration-color:var(--ember);text-underline-offset:.2em}a:hover{color:#fff}a:focus-visible,iframe:focus-visible{outline:2px solid var(--ember);outline-offset:3px}.wrap{max-width:46rem;margin:0 auto;padding:0 1.25rem}header{position:relative;overflow:hidden;padding:4.5rem 0 3.5rem;border-bottom:1px solid var(--rule)}header::after{content:"";position:absolute;right:-5rem;top:-4rem;width:19rem;height:19rem;border-radius:50%;background:radial-gradient(circle at 38% 36%,#f4efde 0%,#d9d2bc 55%,#a9a390 100%);opacity:.9;pointer-events:none}header .wrap{position:relative;z-index:1}h1{font-size:clamp(3.5rem,14vw,7rem);line-height:.95;margin:0;font-weight:700;letter-spacing:-.02em}h2{font-size:1.6rem;margin:0 0 1.5rem}h3{font-size:1.25rem}.sub{margin:1.25rem 0 0;color:var(--ash);font-size:1.15rem;max-width:30rem}nav{margin-top:2rem;display:flex;gap:1.5rem;flex-wrap:wrap}section{padding:3rem 0;border-bottom:1px solid var(--rule)}.timeline{list-style:none;margin:0;padding:0}.timeline li{display:grid;grid-template-columns:5.5rem 1fr;gap:1rem;padding:1rem 0;border-top:1px solid var(--rule)}.timeline li:first-child{border-top:0}.year{font-size:2rem;line-height:1;color:var(--ember);font-variant-numeric:oldstyle-nums}.title{font-size:1.25rem;margin:0}.meta,.small{color:var(--ash);font-size:.95rem}.meta{margin:.15rem 0 0}.video{aspect-ratio:16/9;width:100%;border:0;background:#000}footer{padding:2.5rem 0 4rem;color:var(--ash);font-size:.95rem}article{padding:3rem 0}article p,article li{max-width:42rem}article .meta{margin-bottom:2rem}@media(max-width:34rem){header::after{width:12rem;height:12rem;right:-4rem;top:-3rem}.timeline li{grid-template-columns:4rem 1fr}.year{font-size:1.5rem}}`;

function documentHtml({ title, description, body, canonical, lang = 'en' }) {
  return `<!DOCTYPE html>\n<html lang="${escapeHtml(lang)}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(title)}</title>\n<meta name="description" content="${escapeHtml(description)}">\n<link rel="canonical" href="${escapeHtml(canonical)}">\n<meta property="og:type" content="website">\n<meta property="og:title" content="${escapeHtml(title)}">\n<meta property="og:description" content="${escapeHtml(description)}">\n<meta property="og:url" content="${escapeHtml(canonical)}">\n<style>${style}</style>\n</head>\n<body>${body}\n</body>\n</html>\n`;
}

const files = (await readdir(sourceDir)).filter(name => name.endsWith('.md')).sort();
if (!files.length) throw new Error('No Markdown release files found in content/releases');
const releases = [];
for (const filename of files) releases.push(parseRelease(filename, await readFile(path.join(sourceDir, filename), 'utf8')));
releases.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || a.title.localeCompare(b.title));

// Only clear the generated release pages. Never delete the repository root or source content.
await rm(generatedReleasesDir, { recursive: true, force: true });
await mkdir(generatedReleasesDir, { recursive: true });
await writeFile(path.join(outDir, '.nojekyll'), '', 'utf8');
const list = releases.map(r => `<li><span class="year">${escapeHtml(r.year || '—')}</span><div><p class="title"><a href="/releases/${r.slug}/">${escapeHtml(r.title)}</a></p><p class="meta">${escapeHtml(r.type)}</p></div></li>`).join('\n');
const homeBody = `<header><div class="wrap"><h1>PhoenX</h1><p class="sub">An independent catalogue of Greek and English releases, 2004–2024.</p><nav aria-label="Main"><a href="#catalogue">Catalogue</a><a href="#watch">Watch</a><a href="#about">About</a><a href="https://phoenxmusic.wordpress.com/">Original site</a></nav></div></header><main><section id="catalogue"><div class="wrap"><h2>Catalogue</h2><ol class="timeline">${list}</ol><p class="small">Plus various other singles. Full credits and stories for each release are being added.</p></div></section><section id="watch"><div class="wrap"><h2>Watch</h2><iframe class="video" loading="lazy" src="https://www.youtube-nocookie.com/embed/Qh2ICyWXbn4" title="PhoenX on YouTube" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe><p class="small">More videos are on the <a href="https://phoenxmusic.wordpress.com/">original site</a>.</p></div></section><section id="about"><div class="wrap"><h2>About</h2><p>PhoenX is an independent music project. This site is the permanent home of its catalogue: one stable page for every release, so the music can be found and explored in one place.</p></div></section></main><footer><div class="wrap">PhoenX · <a href="https://phoenxmusic.wordpress.com/">phoenxmusic.wordpress.com</a></div></footer>`;
await writeFile(path.join(outDir, 'index.html'), documentHtml({ title: 'PhoenX – music catalogue, 2004–2024', description: 'The complete PhoenX catalogue: albums and EPs from Πανσέληνος (2004) to Badalona Blues (2024), including The Stockholm Sessions and The Piano Weekend.', canonical: 'https://phoenxmusic.github.io/', body: homeBody }), 'utf8');

for (const r of releases) {
  const releaseUrl = `https://phoenxmusic.github.io/releases/${r.slug}/`;
  const sourceLink = r.old_site_url ? `<p class="small"><a href="${escapeHtml(r.old_site_url)}">Original release page</a></p>` : '';
  const video = r.youtube_id ? `<iframe class="video" loading="lazy" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(r.youtube_id)}" title="${escapeHtml(r.title)} — PhoenX" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>` : '';
  const releaseBody = `<header><div class="wrap"><p><a href="/">← PhoenX catalogue</a></p><h1 style="font-size:clamp(2.5rem,9vw,4.5rem)">${escapeHtml(r.title)}</h1><p class="sub">PhoenX · ${escapeHtml(r.year || 'Year unknown')} · ${escapeHtml(r.type)}</p></div></header><main><article class="wrap"><p class="meta">Language: ${escapeHtml(r.language)}</p>${markdownToHtml(r.body)}${video}${sourceLink}</article></main><footer><div class="wrap"><a href="/">Back to catalogue</a></div></footer>`;
  const dir = path.join(outDir, 'releases', r.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), documentHtml({ title: `${r.title} — PhoenX`, description: `${r.title}, ${r.year || 'year unknown'} — PhoenX music catalogue.`, canonical: releaseUrl, body: releaseBody, lang: r.language || 'en' }), 'utf8');
}

console.log(`Built index.html and ${releases.length} permanent release pages in the repository root.`);
