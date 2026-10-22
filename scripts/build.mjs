import { readdir, readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'content', 'releases');
const outDir = root;
const generatedReleasesDir = path.join(root, 'releases');
const generatedAboutDir = path.join(root, 'about');
const generatedVideosDir = path.join(root, 'videos');
const bannedFile = path.join(root, '.banned-terms');
const site = JSON.parse(await readFile(path.join(root, 'content', 'site.json'), 'utf8'));
const banned = (await readFile(bannedFile, 'utf8')).split(/\r?\n/).map(x => x.trim()).filter(Boolean);

for (const key of ['title', 'tagline', 'description', 'original_site_url']) {
  if (typeof site[key] !== 'string' || !site[key].trim()) throw new Error(`content/site.json: missing ${key}`);
}
if (site.featured_video_id && !/^[A-Za-z0-9_-]{11}$/.test(site.featured_video_id)) {
  throw new Error('content/site.json: featured_video_id must be an 11-character YouTube ID or blank');
}

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
  if (fields.youtube_id && !/^[A-Za-z0-9_-]{11}$/.test(fields.youtube_id)) throw new Error(`${filename}: youtube_id must be an 11-character YouTube ID or blank`);
  if (fields.artwork && !fields.artwork.startsWith('/media/') && !fields.artwork.startsWith('https://')) throw new Error(`${filename}: artwork must use a /media/ path or HTTPS URL`);
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

const style = `:root{--night:#0e1118;--panel:#171c26;--moon:#ece6d3;--ember:#c8402b;--ash:#a6aab4;--rule:#303644;color-scheme:dark}*{box-sizing:border-box}html{font-size:100%;scroll-padding-top:1rem;scroll-behavior:smooth}body{margin:0;background:var(--night);color:var(--moon);font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;line-height:1.65}a{color:var(--moon);text-decoration-color:var(--ember);text-underline-offset:.2em}a:hover{color:#fff}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,iframe:focus-visible{outline:2px solid var(--ember);outline-offset:3px}.wrap{max-width:64rem;margin:0 auto;padding:0 1.25rem}header{position:relative;overflow:hidden;padding:4.5rem 0 3.5rem;border-bottom:1px solid var(--rule)}header::after{content:"";position:absolute;right:-4rem;top:-4rem;width:20rem;height:20rem;border-radius:50%;background:radial-gradient(circle at 38% 36%,#f4efde 0%,#d9d2bc 55%,#a9a390 100%);opacity:.9;pointer-events:none}header .wrap{position:relative;z-index:1}h1{font-size:clamp(3.5rem,14vw,7rem);line-height:.95;margin:0;font-weight:700;letter-spacing:-.02em}h2{font-size:1.6rem;margin:0 0 1.5rem}h3{font-size:1.25rem}.sub{margin:1.25rem 0 0;color:var(--ash);font-size:1.15rem;max-width:36rem}nav{margin-top:2rem;display:flex;gap:1.5rem;flex-wrap:wrap}nav a{padding:.25rem 0}section{padding:3rem 0;border-bottom:1px solid var(--rule)}.filters{display:grid;grid-template-columns:minmax(12rem,2fr) repeat(3,minmax(8rem,1fr));gap:.75rem;margin:0 0 1.25rem}.filters label{display:grid;gap:.3rem;color:var(--ash);font: .85rem/1.4 system-ui,sans-serif}.filters input,.filters select{width:100%;min-width:0;padding:.75rem;background:var(--panel);border:1px solid var(--rule);border-radius:.35rem;color:var(--moon);font:1rem system-ui,sans-serif}.result-count{color:var(--ash);font-size:.9rem}.timeline{list-style:none;margin:0;padding:0}.timeline li{display:grid;grid-template-columns:5.5rem minmax(0,1fr);gap:1rem;padding:1rem 0;border-top:1px solid var(--rule)}.timeline li:first-child{border-top:0}.year{font-size:2rem;line-height:1;color:var(--ember);font-variant-numeric:oldstyle-nums}.title{font-size:1.25rem;margin:0}.meta,.small{color:var(--ash);font-size:.95rem}.meta{margin:.15rem 0 0}.video{aspect-ratio:16/9;width:100%;border:0;background:#000}.video-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem}.video-card{min-width:0;padding:1rem;background:var(--panel);border:1px solid var(--rule);border-radius:.5rem}.video-card h2{font-size:1.1rem;margin:.5rem 0}.video-card code{color:var(--ash);overflow-wrap:anywhere}.cover{display:block;width:min(100%,24rem);height:auto;max-height:24rem;object-fit:contain;margin:0 0 1.5rem}.notice{padding:1rem;border-left:3px solid var(--ember);background:var(--panel);color:var(--ash)}.page-content{max-width:48rem}.page-content p,.page-content li{max-width:48rem}footer{padding:2.5rem 0 4rem;color:var(--ash);font-size:.95rem}article{padding:3rem 0}article p,article li{max-width:48rem}article .meta{margin-bottom:2rem}.button-link{display:inline-block;padding:.65rem 1rem;border:1px solid var(--rule);border-radius:.35rem;text-decoration:none}@media(max-width:48rem){.filters{grid-template-columns:1fr 1fr}.filters label:first-child{grid-column:1/-1}.video-grid{grid-template-columns:1fr}}@media(max-width:34rem){header{padding:3.5rem 0 2.5rem}header::after{width:12rem;height:12rem;right:-4rem;top:-3rem}.timeline li{grid-template-columns:4rem 1fr}.year{font-size:1.5rem}.wrap{padding:0 1rem}.filters{grid-template-columns:1fr}.filters label:first-child{grid-column:auto}nav{gap:1rem}}`;

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
const videoIds = [...(await readFile(path.join(root, 'content', 'unmapped-youtube-ids.md'), 'utf8')).matchAll(/^\s*-\s+([A-Za-z0-9_-]{11})\s*$/gm)].map(match => match[1]);
const uniqueVideoIds = [...new Set(videoIds)];
const list = releases.map(r => `<li data-search="${escapeHtml(`${r.title} ${r.year} ${r.type} ${r.language}`.toLocaleLowerCase())}" data-year="${escapeHtml(r.year || 'unknown')}" data-type="${escapeHtml(r.type.toLocaleLowerCase())}" data-language="${escapeHtml(r.language.toLocaleLowerCase())}"><span class="year">${escapeHtml(r.year || '—')}</span><div><p class="title"><a href="/releases/${r.slug}/">${escapeHtml(r.title)}</a></p><p class="meta">${escapeHtml(r.type)} · ${r.language === 'el' ? 'Greek' : r.language === 'en' ? 'English' : escapeHtml(r.language || 'Language unknown')}</p></div></li>`).join('\n');
const years = [...new Set(releases.map(r => r.year).filter(Boolean))].sort((a,b) => Number(b)-Number(a));
const yearOptions = years.map(year => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join('');
const typeOptions = [...new Set(releases.map(r => r.type).filter(Boolean))].sort().map(type => `<option value="${escapeHtml(type.toLocaleLowerCase())}">${escapeHtml(type)}</option>`).join('');
const homeBody = `<header><div class="wrap"><h1>${escapeHtml(site.title)}</h1><p class="sub">${escapeHtml(site.tagline)}</p><nav aria-label="Main"><a href="#catalogue">Catalogue</a><a href="/videos/">Video archive</a><a href="/about/">About this archive</a><a href="${escapeHtml(site.original_site_url)}">Original site</a></nav></div></header><main><section id="catalogue"><div class="wrap"><h2>Explore the catalogue</h2><p class="small">Search by title, or narrow the list by year, format, and language. Every release has its own permanent page.</p><div class="filters" role="search"><label for="release-search">Search titles and details<input id="release-search" type="search" placeholder="Search the catalogue" autocomplete="off"></label><label for="year-filter">Year<select id="year-filter"><option value="">All years</option>${yearOptions}<option value="unknown">Year unknown</option></select></label><label for="type-filter">Format<select id="type-filter"><option value="">All formats</option>${typeOptions}</select></label><label for="language-filter">Language<select id="language-filter"><option value="">All languages</option><option value="el">Greek</option><option value="en">English</option></select></label></div><p id="result-count" class="result-count" aria-live="polite">${releases.length} releases</p><ol class="timeline" id="release-list">${list}</ol><p id="no-results" class="notice" hidden>No releases match those filters. Clear one or more filters to see the catalogue again.</p><p class="small">Dates and release details remain blank or marked unknown until verified. Video IDs not matched to a release are kept separately in the <a href="/videos/">video archive</a>.</p></div></section>${site.featured_video_id ? `<section id="featured-video"><div class="wrap"><h2>Featured video</h2><iframe class="video" loading="lazy" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(site.featured_video_id)}" title="PhoenX featured video" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe><p class="small">Browse the <a href="/videos/">full list of archived video links</a>.</p></div></section>` : ''}<section id="about"><div class="wrap"><h2>About this archive</h2><p class="page-content">${escapeHtml(site.description)}</p><p><a class="button-link" href="/about/">How this catalogue is maintained</a></p></div></section></main><footer><div class="wrap">${escapeHtml(site.title)} · <a href="${escapeHtml(site.original_site_url)}">Original WordPress site</a></div></footer><script>(()=>{const search=document.getElementById('release-search'),year=document.getElementById('year-filter'),type=document.getElementById('type-filter'),language=document.getElementById('language-filter'),rows=[...document.querySelectorAll('#release-list li')],count=document.getElementById('result-count'),empty=document.getElementById('no-results');function filter(){const q=search.value.trim().toLocaleLowerCase();let visible=0;for(const row of rows){const show=(!q||row.dataset.search.includes(q))&&(!year.value||row.dataset.year===year.value)&&(!type.value||row.dataset.type===type.value)&&(!language.value||row.dataset.language===language.value);row.hidden=!show;if(show)visible++}count.textContent=visible+' of '+rows.length+' releases shown';empty.hidden=visible!==0}for(const control of [search,year,type,language])control.addEventListener('input',filter);})();</script>`;
await writeFile(path.join(outDir, 'index.html'), documentHtml({ title: `${site.title} — music catalogue`, description: site.description, canonical: 'https://phoenxmusic.github.io/', body: homeBody }), 'utf8');

await rm(generatedAboutDir, { recursive: true, force: true });
await mkdir(generatedAboutDir, { recursive: true });
const aboutBody = `<header><div class="wrap"><p><a href="/">← ${escapeHtml(site.title)}</a></p><h1 style="font-size:clamp(2.5rem,9vw,4.5rem)">About this archive</h1><p class="sub">A portable, source-backed music catalogue.</p><nav aria-label="Main"><a href="/">Catalogue</a><a href="/videos/">Video archive</a><a href="${escapeHtml(site.original_site_url)}">Original site</a></nav></div></header><main><article class="wrap page-content"><p>${escapeHtml(site.description)}</p><h2>How it works</h2><p>Release records are stored as Markdown files in the repository. The build script turns those records into a responsive static website with permanent release pages. This keeps the catalogue portable and allows changes to be reviewed through version history.</p><h2>What is verified</h2><ul><li>Known release titles and years are shown from the current source records.</li><li>Unknown years remain marked as unknown.</li><li>Video links not verified against a particular release are kept in a separate index rather than assigned by guesswork.</li><li>Artwork is only displayed when a source record contains an explicit image path.</li></ul><p class="notice">The original WordPress site is retained as a reference. This static catalogue does not replace a full backup of original audio, photographs, video, or rights documentation.</p><p><a class="button-link" href="/">Return to the catalogue</a></p></article></main><footer><div class="wrap">${escapeHtml(site.title)} · <a href="${escapeHtml(site.original_site_url)}">Original site</a></div></footer>`;
await writeFile(path.join(generatedAboutDir, 'index.html'), documentHtml({ title: `About this archive — ${site.title}`, description: 'How the PhoenX static music catalogue is structured and maintained.', canonical: 'https://phoenxmusic.github.io/about/', body: aboutBody }), 'utf8');

await rm(generatedVideosDir, { recursive: true, force: true });
await mkdir(generatedVideosDir, { recursive: true });
const videoCards = uniqueVideoIds.map((id, index) => `<article class="video-card"><h2>Unmatched video ${String(index + 1).padStart(2, '0')}</h2><iframe class="video" loading="lazy" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}" title="Unmatched PhoenX video ${String(index + 1).padStart(2, '0')}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe><p class="small">Video ID: <code>${escapeHtml(id)}</code></p><p class="small">Retained from the earlier catalogue; title and release association have not been verified.</p></article>`).join('\n');
const videosBody = `<header><div class="wrap"><p><a href="/">← ${escapeHtml(site.title)}</a></p><h1 style="font-size:clamp(2.5rem,9vw,4.5rem)">Video archive</h1><p class="sub">${uniqueVideoIds.length} video IDs retained without guessing their release matches.</p><nav aria-label="Main"><a href="/">Catalogue</a><a href="/about/">About this archive</a><a href="${escapeHtml(site.original_site_url)}">Original site</a></nav></div></header><main><section><div class="wrap"><p class="notice">These videos were present in the earlier catalogue. The title and association for each release have not been verified, so they are listed by archive number and ID rather than given invented names. An embedded player may be unavailable if its owner removed or restricted the video.</p><div class="video-grid">${videoCards}</div></div></section></main><footer><div class="wrap"><a href="/">Back to catalogue</a></div></footer>`;
await writeFile(path.join(generatedVideosDir, 'index.html'), documentHtml({ title: `Video archive — ${site.title}`, description: 'Video IDs retained from the earlier PhoenX catalogue, without unverified release associations.', canonical: 'https://phoenxmusic.github.io/videos/', body: videosBody }), 'utf8');

for (const r of releases) {
  const releaseUrl = `https://phoenxmusic.github.io/releases/${r.slug}/`;
  const sourceLink = r.old_site_url ? `<p class="small"><a href="${escapeHtml(r.old_site_url)}">Original release page</a></p>` : '';
  const video = r.youtube_id ? `<iframe class="video" loading="lazy" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(r.youtube_id)}" title="${escapeHtml(r.title)} — PhoenX" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>` : '';
  const artwork = r.artwork ? `<img class="cover" src="${escapeHtml(r.artwork)}" alt="Artwork for ${escapeHtml(r.title)}" loading="lazy">` : '';
  const releaseBody = `<header><div class="wrap"><p><a href="/">← ${escapeHtml(site.title)} catalogue</a></p><h1 style="font-size:clamp(2.5rem,9vw,4.5rem)">${escapeHtml(r.title)}</h1><p class="sub">${escapeHtml(site.title)} · ${escapeHtml(r.year || 'Year unknown')} · ${escapeHtml(r.type)}</p><nav aria-label="Main"><a href="/">Catalogue</a><a href="/videos/">Video archive</a><a href="/about/">About this archive</a></nav></div></header><main><article class="wrap">${artwork}<p class="meta">Language: ${escapeHtml(r.language)}</p>${markdownToHtml(r.body)}${video}${sourceLink}</article></main><footer><div class="wrap"><a href="/">Back to catalogue</a></div></footer>`;
  const dir = path.join(outDir, 'releases', r.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), documentHtml({ title: `${r.title} — PhoenX`, description: `${r.title}, ${r.year || 'year unknown'} — PhoenX music catalogue.`, canonical: releaseUrl, body: releaseBody, lang: r.language || 'en' }), 'utf8');
}

console.log(`Built homepage, about page, video archive (${uniqueVideoIds.length} unmatched video IDs), and ${releases.length} permanent release pages.`);
