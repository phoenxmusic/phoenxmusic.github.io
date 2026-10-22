import { readdir, readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'content', 'releases');
const outDir = root;
const generatedReleasesDir = path.join(root, 'releases');
const generatedAboutDir = path.join(root, 'archive-info');
const generatedVideosDir = path.join(root, 'videos');
const generatedJournalDir = path.join(root, 'journal');
const generatedArchivePagesDir = path.join(root, 'archive-pages');
const generatedMediaArchiveDir = path.join(root, 'media-archive');
const wordpressContentDir = path.join(root, 'content', 'wordpress');
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

const presentationStyle = `
:root{--night:#090b10;--panel:#151922;--moon:#f4f0e6;--ember:#e55b3f;--ash:#a7adba;--rule:#303542;--gold:#d9c9a0}
html{scroll-padding-top:5rem}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.005em}h1,h2,h3,.display{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;letter-spacing:-.035em}h2{font-size:clamp(1.8rem,4vw,2.8rem);line-height:1.05}header{padding:0 0 3.5rem;background:radial-gradient(ellipse at 82% 10%,rgba(197,72,49,.19),transparent 36%),linear-gradient(145deg,#0b0d12,#111722 65%,#0a0c11)}header::after{right:4%;top:6rem;width:clamp(10rem,27vw,23rem);height:clamp(10rem,27vw,23rem);border:1px solid rgba(236,230,211,.22);background:radial-gradient(circle at 35% 30%,#e6d9bd 0%,#8f8170 20%,#2c2c36 43%,#10131b 64%);box-shadow:0 0 0 1.4rem rgba(236,230,211,.025),0 0 0 3rem rgba(236,230,211,.018);opacity:.8;mask-image:radial-gradient(circle,black 45%,transparent 73%)}header .wrap{padding-top:1.2rem}.site-nav{position:relative;z-index:3;display:flex;align-items:center;gap:1.25rem;margin:0 0 3.5rem;padding:.7rem 0;border-bottom:1px solid rgba(236,230,211,.14);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.nav-brand{font-weight:850;letter-spacing:.18em;text-decoration:none;font-size:.85rem;white-space:nowrap}.nav-toggle{display:none;margin-left:auto;border:1px solid var(--rule);border-radius:99px;background:transparent;color:var(--moon);padding:.55rem .8rem;font:inherit}.site-nav nav{margin:0 0 0 auto;display:flex;align-items:center;gap:clamp(.8rem,2.3vw,1.7rem)}.site-nav nav a{font-size:.77rem;letter-spacing:.11em;text-transform:uppercase;text-decoration:none;color:var(--ash);padding:.45rem 0;border-bottom:1px solid transparent}.site-nav nav a:hover,.site-nav nav a[aria-current=page]{color:var(--moon);border-color:var(--ember)}.archive-nav{margin-top:1rem!important;padding-top:.75rem;border-top:1px solid var(--rule);gap:1rem!important}.archive-nav a{font-size:.85rem!important;text-transform:none!important;letter-spacing:0!important}.hero-copy{position:relative;z-index:2;max-width:47rem;padding:1rem 0 2rem}.hero-kicker,.eyebrow{color:var(--gold);font:600 .72rem/1.4 Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase}.hero-copy h1{font-size:clamp(4.6rem,15vw,10rem);max-width:8ch;line-height:.82;margin:.7rem 0 1.4rem}.hero-copy .sub{max-width:34rem;font-size:clamp(1rem,2.4vw,1.25rem);color:#c2c5cd}.hero-actions{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:1.7rem}.button-link,.action-button{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:2.7rem;padding:.72rem 1rem;border:1px solid #4b505c;border-radius:99px;background:transparent;color:var(--moon);text-decoration:none;font:600 .82rem/1.2 Inter,ui-sans-serif,system-ui,sans-serif;cursor:pointer;transition:transform .2s ease,border-color .2s ease,background .2s ease}.button-link.primary,.action-button.primary{background:var(--moon);border-color:var(--moon);color:#11131a}.button-link:hover,.action-button:hover{border-color:var(--ember);transform:translateY(-2px)}.entry-paths{padding:1.5rem 0 2.5rem!important;border-bottom:0!important}.path-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.8rem}.path-card{display:flex;flex-direction:column;justify-content:space-between;min-height:10rem;padding:1.1rem;border:1px solid var(--rule);border-radius:.75rem;background:linear-gradient(145deg,rgba(255,255,255,.035),transparent 70%);text-decoration:none;transition:transform .2s ease,border-color .2s ease}.path-card:hover{border-color:var(--ember);transform:translateY(-3px)}.path-card .number{font-size:.7rem;color:var(--ember);letter-spacing:.15em}.path-card strong{display:block;font-family:Georgia,serif;font-size:1.35rem;font-weight:500}.path-card span:last-child{color:var(--ash);font-size:.82rem}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1.25rem}.section-heading h2{margin:0}.section-heading p{max-width:32rem;margin:0;color:var(--ash);font-size:.9rem}.catalogue-tools{display:flex;flex-wrap:wrap;gap:.5rem;margin:.8rem 0 1.2rem}.catalogue-tools .action-button{min-height:2.35rem;padding:.55rem .85rem;font-size:.76rem}.timeline.catalogue-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem}.timeline.catalogue-grid li{display:flex;flex-direction:column;gap:.75rem;min-height:10rem;padding:1rem;border:1px solid var(--rule);border-radius:.65rem;background:linear-gradient(145deg,rgba(255,255,255,.035),transparent 75%)}.timeline.catalogue-grid .year{font-size:1.3rem}.timeline.catalogue-grid .title{font-size:1.15rem}.timeline.catalogue-grid li:first-child{border-top:1px solid var(--rule)}.result-count{min-height:1.5em}.release-spotlight{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2rem;align-items:center;padding:2rem;border:1px solid var(--rule);border-radius:1rem;background:radial-gradient(ellipse at 100% 0,rgba(197,72,49,.13),transparent 55%),var(--panel)}.record-art{position:relative;aspect-ratio:1;max-width:24rem;margin:auto;width:100%;display:grid;place-items:center}.record-art::before,.record-art::after{content:"";position:absolute;border-radius:50%;aspect-ratio:1}.record-art::before{inset:3%;background:repeating-radial-gradient(circle,#191d27 0 4px,#292d38 5px 6px);border:1px solid #3a3d47;box-shadow:0 12px 38px #0008}.record-art::after{inset:39%;background:radial-gradient(circle,#d9c9a0 0 5%,#b84d39 6% 20%,#20232b 22% 100%);border:1px solid #d7c8a5}.record-groove{position:relative;z-index:1;width:16%;aspect-ratio:1;border-radius:50%;border:1px solid #5c5d65;opacity:.8}.visualizer{display:flex;align-items:center;gap:4px;height:2.2rem;margin:1.1rem 0}.visualizer i{display:block;width:4px;height:var(--h);border-radius:9px;background:var(--ember);transform-origin:center;animation:pulse-bar 1s ease-in-out infinite alternate;animation-delay:var(--d)}.notice.status{margin:.6rem 0 0;min-height:1.5em;padding:.4rem .65rem;border-left-width:2px;font-size:.85rem}.video-shell{padding:1rem;border:1px solid var(--rule);border-radius:1rem;background:var(--panel)}.video-shell .video{border-radius:.5rem}.archive-links{display:flex;flex-wrap:wrap;gap:.5rem}.archive-links .button-link{font-size:.78rem}.skip-link{position:absolute;left:-999px;top:1rem;z-index:99;background:var(--moon);color:#111;padding:.7rem}.skip-link:focus{left:1rem}.site-footer{border-top:1px solid var(--rule)}.site-footer nav{margin:1rem 0 0;gap:1rem}.site-footer nav a{font-size:.8rem;color:var(--ash)}
@media(max-width:48rem){.nav-toggle{display:inline-flex}.site-nav{margin-bottom:2.5rem;flex-wrap:wrap}.site-nav nav{display:none;order:3;flex:0 0 100%;margin:0;padding:.8rem 0 0;flex-direction:column;align-items:stretch;gap:.25rem}.site-nav nav.is-open{display:flex}.site-nav nav a{padding:.7rem 0}.path-grid{grid-template-columns:1fr}.path-card{min-height:7rem}.release-spotlight{grid-template-columns:1fr;padding:1.2rem}.record-art{max-width:15rem}.timeline.catalogue-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.section-heading{align-items:start;flex-direction:column}.archive-nav{flex-direction:row!important;flex-wrap:wrap!important}.hero-copy h1{font-size:clamp(4.4rem,22vw,7rem)}}
@media(max-width:34rem){.timeline.catalogue-grid{grid-template-columns:1fr}.hero-copy{padding-top:.3rem}.hero-copy h1{font-size:clamp(4rem,21vw,6rem)}.site-nav{margin-bottom:2rem}.wrap{padding:0 1rem}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;

const videoArchiveStyle = `.video-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.video-card h2{font-size:1.1rem;margin:.75rem 0 .35rem}.video-poster{position:relative;display:block;width:100%;aspect-ratio:16/9;padding:0;overflow:hidden;border:0;border-radius:.35rem;background:#080a0e;color:white;cursor:pointer}.video-poster img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .25s ease}.video-poster:hover img{transform:scale(1.035)}.play-icon{position:absolute;left:50%;top:50%;display:grid;place-items:center;width:3.2rem;height:2.3rem;transform:translate(-50%,-50%);border-radius:.65rem;background:var(--ember);color:#fff;font:1.2rem/1 system-ui,sans-serif;box-shadow:0 3px 18px #0008}.video-watch-link{display:inline-block;margin-top:.4rem;font:600 .78rem/1.5 Inter,ui-sans-serif,system-ui,sans-serif}.video-filters{grid-template-columns:minmax(12rem,2fr) minmax(12rem,1fr)}@media(max-width:64rem){.video-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:48rem){.video-grid{grid-template-columns:1fr}.video-filters{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.video-poster img{transition:none}}`;

function documentHtml({ title, description, body, canonical, lang = 'en' }) {
  const accessibleBody = body.replace(/<main(?![^>]*\bid=)/, '<main id="main-content"');
  return `<!DOCTYPE html>\n<html lang="${escapeHtml(lang)}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(title)}</title>\n<meta name="description" content="${escapeHtml(description)}">\n<link rel="canonical" href="${escapeHtml(canonical)}">\n<meta property="og:type" content="website">\n<meta property="og:title" content="${escapeHtml(title)}">\n<meta property="og:description" content="${escapeHtml(description)}">\n<meta property="og:url" content="${escapeHtml(canonical)}">\n<style>${style}${presentationStyle}${videoArchiveStyle}</style>\n</head>\n<body><a class="skip-link" href="#main-content">Skip to content</a>${accessibleBody}<script>(()=>{const toggle=document.querySelector('.nav-toggle');const nav=document.getElementById('primary-navigation');if(toggle&&nav){toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Close':'Menu';nav.classList.toggle('is-open',open)});nav.addEventListener('click',event=>{if(event.target.closest('a')){toggle.setAttribute('aria-expanded','false');toggle.textContent='Menu';nav.classList.remove('is-open')}})}const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const reveal=[...document.querySelectorAll('[data-reveal]')];if(!reduce&&'IntersectionObserver'in window){reveal.forEach(el=>el.classList.add('motion-ready'));const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.12});reveal.forEach(el=>observer.observe(el))}else reveal.forEach(el=>el.classList.add('is-visible'))})();</script>\n</body>\n</html>\n`;
}

function sanitizeImportedHtml(source = '') {
  return String(source)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<form\b[^>]*>[\s\S]*?<\/form\s*>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

function routeDirectory(route) {
  const decoded = decodeURIComponent(route).split('/').filter(Boolean);
  if (!decoded.length || decoded.some(part => part === '.' || part === '..' || /[<>:"|?*]/.test(part) || part.includes('\\\\') || [...part].some(char => char.charCodeAt(0) < 32))) {
    throw new Error(`Unsafe imported WordPress route: ${route}`);
  }
  return path.join(root, ...decoded);
}

function artistNav() {
  return `<div class="site-nav"><a class="nav-brand" href="/" aria-label="PhoenX home">PHOENX</a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">Menu</button><nav id="primary-navigation" aria-label="Main navigation"><a href="/">Home</a><a href="/#catalogue">Music</a><a href="/videos/">Videos</a><a href="/about/">Story</a><a href="/journal/">Journal</a><a href="/connect/">Connect</a></nav></div>`;
}

function wordpressNav() {
  return `${artistNav()}<nav class="archive-nav" aria-label="Archive navigation"><a href="/archive-pages/">All legacy pages</a><a href="/journal/">All posts</a><a href="/media-archive/">Media references</a><a href="/archive-info/">Archive notes</a></nav>`;
}

function rewriteImportedLinks(source, pathToRoute, slugToRoute) {
  const withMediaPlaceholders = sanitizeImportedHtml(source).replace(/<img\b([^>]*?)src=(['"])(https?:\/\/(?:www\.)?meniossymeon\.wordpress\.com\/wp-content\/uploads\/[^'"]+)\2([^>]*)\/?>/gi, (full, before, quote, url, after) => {
    const alt = (before + ' ' + after).match(/\balt=(['"])(.*?)\1/i);
    const label = alt ? alt[2] : 'WordPress image';
    return '<span class="media-unavailable" title="' + escapeHtml(url) + '" style="display:block;padding:1rem;border-left:3px solid var(--ember);background:var(--panel)">' + escapeHtml(label) + ' — original file not included in the export. See the media reference inventory for the source URL.</span>';
  });
  return withMediaPlaceholders.replace(/(href|src)=(['"])(https?:\/\/(?:www\.)?meniossymeon\.(?:wordpress\.com|com)[^'"]*)\2/gi, (full, attr, quote, url) => {
    if (attr.toLowerCase() !== 'href') return full;
    try {
      const parsed = new URL(url);
      let sourcePath = decodeURIComponent(parsed.pathname || '/');
      if (sourcePath !== '/' && !sourcePath.endsWith('/')) sourcePath += '/';
      const lastSegment = sourcePath.split('/').filter(Boolean).pop() || '';
      const route = sourcePath === '/' ? '/' : (pathToRoute.get(sourcePath) || slugToRoute.get(lastSegment));
      if (!route) return full;
      return attr + '=' + quote + route + parsed.search + parsed.hash + quote;
    } catch { return full; }
  });
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
const youtubeVideos = JSON.parse(await readFile(path.join(root, 'content', 'youtube-videos.json'), 'utf8'));
if (!Array.isArray(youtubeVideos) || !youtubeVideos.length) throw new Error('content/youtube-videos.json must contain public video records');
const seenYoutubeIds = new Set();
for (const video of youtubeVideos) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(video.id || '') || !video.title || !video.channel || !/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(video.video_url || '')) throw new Error('content/youtube-videos.json contains an invalid video record');
  if (seenYoutubeIds.has(video.id)) throw new Error(`content/youtube-videos.json contains duplicate video ID ${video.id}`);
  seenYoutubeIds.add(video.id);
}
const list = releases.map(r => `<li data-search="${escapeHtml(`${r.title} ${r.year} ${r.type} ${r.language}`.toLocaleLowerCase())}" data-year="${escapeHtml(r.year || 'unknown')}" data-type="${escapeHtml(r.type.toLocaleLowerCase())}" data-language="${escapeHtml(r.language.toLocaleLowerCase())}"><span class="year">${escapeHtml(r.year || '—')}</span><div><p class="title"><a href="/releases/${r.slug}/">${escapeHtml(r.title)}</a></p><p class="meta">${escapeHtml(r.type)} · ${r.language === 'el' ? 'Greek' : r.language === 'en' ? 'English' : escapeHtml(r.language || 'Language unknown')}</p></div></li>`).join('\n');
const years = [...new Set(releases.map(r => r.year).filter(Boolean))].sort((a,b) => Number(b)-Number(a));
const yearOptions = years.map(year => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join('');
const typeOptions = [...new Set(releases.map(r => r.type).filter(Boolean))].sort().map(type => `<option value="${escapeHtml(type.toLocaleLowerCase())}">${escapeHtml(type)}</option>`).join('');
let homeBody = `<header><div class="wrap"><h1>${escapeHtml(site.title)}</h1><p class="sub">${escapeHtml(site.tagline)}</p><nav aria-label="Main"><a href="#catalogue">Catalogue</a><a href="/videos/">Video archive</a><a href="/about/">About this archive</a><a href="${escapeHtml(site.original_site_url)}">Original site</a></nav></div></header><main><section id="catalogue"><div class="wrap"><h2>Explore the catalogue</h2><p class="small">Search by title, or narrow the list by year, format, and language. Every release has its own permanent page.</p><div class="filters" role="search"><label for="release-search">Search titles and details<input id="release-search" type="search" placeholder="Search the catalogue" autocomplete="off"></label><label for="year-filter">Year<select id="year-filter"><option value="">All years</option>${yearOptions}<option value="unknown">Year unknown</option></select></label><label for="type-filter">Format<select id="type-filter"><option value="">All formats</option>${typeOptions}</select></label><label for="language-filter">Language<select id="language-filter"><option value="">All languages</option><option value="el">Greek</option><option value="en">English</option></select></label></div><p id="result-count" class="result-count" aria-live="polite">${releases.length} releases</p><ol class="timeline" id="release-list">${list}</ol><p id="no-results" class="notice" hidden>No releases match those filters. Clear one or more filters to see the catalogue again.</p><p class="small">Dates and release details remain blank or marked unknown until verified. Video IDs not matched to a release are kept separately in the <a href="/videos/">video archive</a>.</p></div></section>${site.featured_video_id ? `<section id="featured-video"><div class="wrap"><h2>Featured video</h2><iframe class="video" loading="lazy" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(site.featured_video_id)}" title="PhoenX featured video" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe><p class="small">Browse the <a href="/videos/">full list of archived video links</a>.</p></div></section>` : ''}<section id="about"><div class="wrap"><h2>About this archive</h2><p class="page-content">${escapeHtml(site.description)}</p><p><a class="button-link" href="/about/">How this catalogue is maintained</a></p></div></section></main><footer><div class="wrap">${escapeHtml(site.title)} · <a href="${escapeHtml(site.original_site_url)}">Original WordPress site</a></div></footer><script>(()=>{const search=document.getElementById('release-search'),year=document.getElementById('year-filter'),type=document.getElementById('type-filter'),language=document.getElementById('language-filter'),rows=[...document.querySelectorAll('#release-list li')],count=document.getElementById('result-count'),empty=document.getElementById('no-results');function filter(){const q=search.value.trim().toLocaleLowerCase();let visible=0;for(const row of rows){const show=(!q||row.dataset.search.includes(q))&&(!year.value||row.dataset.year===year.value)&&(!type.value||row.dataset.type===type.value)&&(!language.value||row.dataset.language===language.value);row.hidden=!show;if(show)visible++}count.textContent=visible+' of '+rows.length+' releases shown';empty.hidden=visible!==0}for(const control of [search,year,type,language])control.addEventListener('input',filter);})();</script>`;

const homeHero = `<header><div class="wrap">${artistNav()}<div class="hero-copy"><p class="hero-kicker">Greek & English music · Archive and discovery</p><h1>${escapeHtml(site.title)}</h1><p class="sub">${escapeHtml(site.tagline)}</p><div class="hero-actions"><a class="button-link primary" href="#catalogue">Explore the music <span aria-hidden="true">↘</span></a><a class="button-link" href="/videos/">Enter the video archive</a></div></div></div></header><main id="main-content">`;
homeBody = homeBody.replace(/<header><div class="wrap"><h1>[\s\S]*?<\/nav><\/div><\/header><main>/, homeHero);
const spotlight = releases[0];
const discoverSection = `<section class="entry-paths" data-reveal><div class="wrap"><p class="eyebrow">Choose your way in</p><div class="path-grid"><a class="path-card" href="#catalogue"><span class="number">01 / LISTEN</span><strong>Explore the music</strong><span>Search the release catalogue →</span></a><a class="path-card" href="/videos/"><span class="number">02 / WATCH</span><strong>Watch the visuals</strong><span>Open the video archive →</span></a><a class="path-card" href="/about/"><span class="number">03 / DISCOVER</span><strong>Read the story</strong><span>Explore the artist archive →</span></a></div></div></section><section class="spotlight-section" data-reveal><div class="wrap"><div class="release-spotlight"><div class="record-art" role="img" aria-label="Abstract record artwork"><span class="record-groove"></span></div><div class="spotlight-copy"><p class="eyebrow">From the catalogue · ${escapeHtml(spotlight.year || 'Year unknown')}</p><h2>${escapeHtml(spotlight.title)}</h2><p class="meta">${escapeHtml(spotlight.type)} · ${spotlight.language === 'el' ? 'Greek' : spotlight.language === 'en' ? 'English' : escapeHtml(spotlight.language || 'Language unknown')}</p><p>Step into a release page for its available details, credits and verified listening links. Unknown information stays unfilled until it can be confirmed.</p><a class="button-link primary" href="/releases/${spotlight.slug}/">Explore this release ↗</a><div class="visualizer" aria-hidden="true">${Array.from({length:20},(_,i)=>`<i style="--h:${12+((i*17)%27)}px;--d:${(i%7)*-.13}s"></i>`).join('')}</div></div></div></div></section>`;
homeBody = homeBody.replace('<main id="main-content"><section id="catalogue">', `<main id="main-content">${discoverSection}<section id="catalogue">`);
homeBody = homeBody.replace('<h2>Explore the catalogue</h2><p class="small">Search by title, or narrow the list by year, format, and language. Every release has its own permanent page.</p>', '<div class="section-heading"><div><p class="eyebrow">The catalogue</p><h2>Find your next listen</h2></div><p>Search across titles and details, then narrow the archive by year, format or language.</p></div>');
homeBody = homeBody.replace('</div><p id="result-count"', '</div><div class="catalogue-tools"><button class="action-button" id="view-toggle" type="button" aria-pressed="false">View as cards</button><button class="action-button" id="surprise-release" type="button">Surprise me ↗</button><button class="action-button" id="share-filters" type="button">Copy filtered link</button><button class="action-button" id="clear-filters" type="button">Reset filters</button></div><p id="share-status" class="notice status" role="status" aria-live="polite"></p><p id="result-count"');
homeBody = homeBody.replace(/<script>\(\(\)=>\{const search=[\s\S]*?<\/script>/, `<script>(()=>{const search=document.getElementById('release-search'),year=document.getElementById('year-filter'),type=document.getElementById('type-filter'),language=document.getElementById('language-filter'),rows=[...document.querySelectorAll('#release-list li')],list=document.getElementById('release-list'),count=document.getElementById('result-count'),empty=document.getElementById('no-results'),status=document.getElementById('share-status'),view=document.getElementById('view-toggle'),surprise=document.getElementById('surprise-release'),share=document.getElementById('share-filters'),clear=document.getElementById('clear-filters');const params=new URLSearchParams(location.search);search.value=params.get('q')||'';year.value=params.get('year')||'';type.value=params.get('type')||'';language.value=params.get('language')||'';function filter(){const q=search.value.trim().toLocaleLowerCase();let visible=0;for(const row of rows){const show=(!q||row.dataset.search.includes(q))&&(!year.value||row.dataset.year===year.value)&&(!type.value||row.dataset.type===type.value)&&(!language.value||row.dataset.language===language.value);row.hidden=!show;if(show)visible++}count.textContent=visible+' of '+rows.length+' releases shown';empty.hidden=visible!==0;status.textContent='';}for(const control of [search,year,type,language])control.addEventListener('input',filter);view.addEventListener('click',()=>{const grid=!list.classList.contains('catalogue-grid');list.classList.toggle('catalogue-grid',grid);view.setAttribute('aria-pressed',String(grid));view.textContent=grid?'View as list':'View as cards'});surprise.addEventListener('click',()=>{const visible=rows.filter(row=>!row.hidden);if(!visible.length){status.textContent='No matching releases. Reset or change the filters first.';return}const chosen=visible[Math.floor(Math.random()*visible.length)];chosen.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});const link=chosen.querySelector('a');if(link){link.focus({preventScroll:true});status.textContent='Selected: '+link.textContent}});share.addEventListener('click',async()=>{const url=new URL(location.href);for(const [key,value] of [['q',search.value.trim()],['year',year.value],['type',type.value],['language',language.value]]){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key)}try{await navigator.clipboard.writeText(url.toString());status.textContent='Filtered catalogue link copied.'}catch{status.textContent='Copy is unavailable in this browser. Link: '+url.toString()}});clear.addEventListener('click',()=>{search.value='';year.value='';type.value='';language.value='';history.replaceState(null,'',location.pathname);filter();search.focus()});filter()})();</script>`);
await writeFile(path.join(outDir, 'index.html'), documentHtml({ title: `${site.title} — music catalogue`, description: site.description, canonical: 'https://phoenxmusic.github.io/', body: homeBody }), 'utf8');

await rm(generatedAboutDir, { recursive: true, force: true });
await mkdir(generatedAboutDir, { recursive: true });
const aboutBody = `<header><div class="wrap">${artistNav()}<h1 style="font-size:clamp(2.5rem,9vw,4.5rem)">About this archive</h1><p class="sub">A portable, source-backed music catalogue.</p>${wordpressNav().replace(artistNav(), '')}</div></header><main><article class="wrap page-content"><p>${escapeHtml(site.description)}</p><h2>How it works</h2><p>Release records are stored as Markdown files in the repository. The build script turns those records into a responsive static website with permanent release pages. This keeps the catalogue portable and allows changes to be reviewed through version history.</p><h2>What is verified</h2><ul><li>Known release titles and years are shown from the current source records.</li><li>Unknown years remain marked as unknown.</li><li>Video links not verified against a particular release are kept in a separate index rather than assigned by guesswork.</li><li>Artwork is only displayed when a source record contains an explicit image path.</li></ul><p class="notice">The original WordPress site is retained as a reference. This static catalogue does not replace a full backup of original audio, photographs, video, or rights documentation.</p><p><a class="button-link" href="/">Return to the catalogue</a></p></article></main><footer class="site-footer"><div class="wrap">${escapeHtml(site.title)} · <a href="${escapeHtml(site.original_site_url)}">Original site</a></div></footer>`;
await writeFile(path.join(generatedAboutDir, 'index.html'), documentHtml({ title: `About this archive — ${site.title}`, description: 'How the PhoenX static music catalogue is structured and maintained.', canonical: 'https://phoenxmusic.github.io/archive-info/', body: aboutBody }), 'utf8');

await rm(generatedVideosDir, { recursive: true, force: true });
await mkdir(generatedVideosDir, { recursive: true });
const videoCards = youtubeVideos.map(video => `<article class="video-card" data-search="${escapeHtml(`${video.title} ${video.channel}`.toLocaleLowerCase())}" data-channel="${escapeHtml(video.channel)}"><div class="video-player" data-video-id="${escapeHtml(video.id)}"><button class="video-poster" type="button" data-play-video aria-label="Play ${escapeHtml(video.title)}"><img src="https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async"><span class="play-icon" aria-hidden="true">▶</span></button></div><h2>${escapeHtml(video.title)}</h2><p class="small">${escapeHtml(video.channel)}</p><a class="video-watch-link" href="${escapeHtml(video.video_url)}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></article>`).join('\n');
const videoChannelOptions = [...new Set(youtubeVideos.map(video => video.channel))].map(channel => `<option value="${escapeHtml(channel)}">${escapeHtml(channel)}</option>`).join('');
const videosBody = `<header><div class="wrap">${artistNav()}<div class="hero-copy"><p class="hero-kicker">Official video archive</p><h1 style="font-size:clamp(2.5rem,9vw,5rem)">Watch PhoenX</h1><p class="sub">${youtubeVideos.length} public videos gathered from both PhoenX YouTube channels. Search the archive, choose a channel, and play any video here.</p><div class="hero-actions"><a class="button-link primary" href="https://www.youtube.com/@PhoenX_Music" target="_blank" rel="noopener noreferrer">PhoenX Music channel ↗</a><a class="button-link" href="https://www.youtube.com/@NikolasPhoenx/videos" target="_blank" rel="noopener noreferrer">Nikolas Phoenx channel ↗</a></div></div></div></header><main id="main-content"><section><div class="wrap"><div class="section-heading"><h2>Video library</h2><p>Players load when you press play, keeping the page lighter and avoiding dozens of simultaneous YouTube embeds.</p></div><div class="filters video-filters" role="search"><label for="video-search">Search videos<input id="video-search" type="search" placeholder="Search titles, Greek or English" autocomplete="off"></label><label for="video-channel-filter">Channel<select id="video-channel-filter"><option value="">Both channels</option>${videoChannelOptions}</select></label></div><p id="video-result-count" class="result-count" aria-live="polite">${youtubeVideos.length} videos</p><div class="video-grid" id="video-grid">${videoCards}</div><p id="video-no-results" class="notice" hidden>No videos match your search. Try another title or select both channels.</p><p class="notice">Only videos listed publicly on the supplied channel pages are included. Video titles and channel attribution come from YouTube's public listings; videos can still become unavailable if their owner changes visibility or embedding permissions.</p></div></section></main><footer class="site-footer"><div class="wrap"><a href="/">Back to PhoenX</a> · <a href="https://www.youtube.com/@PhoenX_Music" target="_blank" rel="noopener noreferrer">Subscribe on YouTube ↗</a></div></footer><script>(()=>{const search=document.getElementById('video-search'),channel=document.getElementById('video-channel-filter'),cards=[...document.querySelectorAll('#video-grid .video-card')],count=document.getElementById('video-result-count'),empty=document.getElementById('video-no-results');function filter(){const q=search.value.trim().toLocaleLowerCase();let visible=0;for(const card of cards){const show=(!q||card.dataset.search.includes(q))&&(!channel.value||card.dataset.channel===channel.value);card.hidden=!show;if(show)visible++}count.textContent=visible+' of '+cards.length+' videos shown';empty.hidden=visible!==0}for(const control of [search,channel])control.addEventListener('input',filter);document.getElementById('video-grid').addEventListener('click',event=>{const button=event.target.closest('[data-play-video]');if(!button)return;const player=button.closest('.video-player');const id=player.dataset.videoId;const iframe=document.createElement('iframe');iframe.className='video';iframe.loading='lazy';iframe.title=button.getAttribute('aria-label').replace(/^Play /,'');iframe.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1';iframe.allow='autoplay; encrypted-media; picture-in-picture; web-share';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';player.replaceChildren(iframe)})})();</script>`;
await writeFile(path.join(generatedVideosDir, 'index.html'), documentHtml({ title: `Videos — ${site.title}`, description: `${youtubeVideos.length} public videos from the PhoenX YouTube channels, with search and channel filters.`, canonical: 'https://phoenxmusic.github.io/videos/', body: videosBody }), 'utf8');

const wordpressReportPath = path.join(wordpressContentDir, 'import-report.json');
if (await readFile(wordpressReportPath, 'utf8').then(() => true).catch(() => false)) {
  const wpPages = JSON.parse(await readFile(path.join(wordpressContentDir, 'pages.json'), 'utf8'));
  const wpPosts = JSON.parse(await readFile(path.join(wordpressContentDir, 'posts.json'), 'utf8'));
  const wpPortfolio = JSON.parse(await readFile(path.join(wordpressContentDir, 'portfolio.json'), 'utf8'));
  const wpMedia = JSON.parse(await readFile(path.join(wordpressContentDir, 'media.json'), 'utf8'));
  const wpNavigation = JSON.parse(await readFile(path.join(wordpressContentDir, 'navigation.json'), 'utf8'));
  const allRecords = [...wpPages, ...wpPosts, ...wpPortfolio];
  const routes = allRecords.map(record => record.route);
  if (new Set(routes).size !== routes.length) throw new Error('WordPress import has duplicate output routes; refusing to silently overwrite records.');
  const pathToRoute = new Map();
  const slugToRoute = new Map();
  for (const record of allRecords) {
    try {
      const sourcePath = decodeURIComponent(new URL(record.source_url).pathname || '/');
      pathToRoute.set(sourcePath.endsWith('/') ? sourcePath : sourcePath + '/', record.route);
      const lastSegment = sourcePath.split('/').filter(Boolean).pop() || '';
      if (lastSegment) slugToRoute.set(lastSegment, record.route);
      if (record.slug) slugToRoute.set(record.slug, record.route);
    } catch { /* malformed source URL remains in the provenance record */ }
  }
  pathToRoute.set('/', '/');
  const pageItems = wpPages.map(record => {
    const details = record.content_html ? record.source_content_characters + ' content characters' : 'No body text in export';
    return '<li><div><p class=\"title\"><a href=\"' + escapeHtml(record.route) + '\">' + escapeHtml(record.title) + '</a></p><p class=\"meta\">' + escapeHtml(details) + ' · <a href=\"' + escapeHtml(record.source_url) + '\">source URL</a></p></div></li>';
  }).join('\n');
  const pageIndexBody = '<header><div class=\"wrap\"><p><a href=\"/\">← ' + escapeHtml(site.title) + '</a></p><h1 style=\"font-size:clamp(2.5rem,9vw,4.5rem)\">WordPress pages</h1><p class=\"sub\">' + wpPages.length + ' published pages imported from the export.</p>' + wordpressNav() + '</div></header><main><section><div class=\"wrap\"><ol class=\"timeline\">' + pageItems + '</ol><p class=\"notice\">Private and draft pages were excluded. Source URLs are retained for provenance.</p></div></section></main><footer><div class=\"wrap\"><a href=\"/\">Back to catalogue</a></div></footer>';
  await mkdir(generatedArchivePagesDir, { recursive: true });
  await writeFile(path.join(generatedArchivePagesDir, 'index.html'), documentHtml({ title: 'WordPress pages — ' + site.title, description: 'Published pages imported from the WordPress export.', canonical: 'https://phoenxmusic.github.io/archive-pages/', body: pageIndexBody }), 'utf8');

  const sortedPosts = [...wpPosts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const postItems = sortedPosts.map(record => {
    const terms = [...(record.categories || []), ...(record.tags || [])].map(term => term.name).filter(Boolean);
    const meta = (record.date || '').slice(0, 10) + (terms.length ? ' · ' + terms.join(', ') : '');
    const search = [record.title, record.excerpt, ...terms].join(' ').toLocaleLowerCase();
    return '<li data-search=\"' + escapeHtml(search) + '\" data-year=\"' + escapeHtml((record.date || '').slice(0, 4)) + '\"><span class=\"year\">' + escapeHtml((record.date || '').slice(0, 4) || '—') + '</span><div><p class=\"title\"><a href=\"' + escapeHtml(record.route) + '\">' + escapeHtml(record.title) + '</a></p><p class=\"meta\">' + escapeHtml(meta) + '</p></div></li>';
  }).join('\n');
  const yearsOfPosts = [...new Set(sortedPosts.map(record => (record.date || '').slice(0, 4)).filter(year => /^\d{4}$/.test(year)))].sort((a, b) => Number(b) - Number(a));
  const yearOptionsOfPosts = yearsOfPosts.map(year => '<option value=\"' + year + '\">' + year + '</option>').join('');
  const journalBody = '<header><div class=\"wrap\"><p><a href=\"/\">← ' + escapeHtml(site.title) + '</a></p><h1 style=\"font-size:clamp(2.5rem,9vw,4.5rem)\">Journal</h1><p class=\"sub\">' + wpPosts.length + ' published posts, with original dates and source links retained.</p>' + wordpressNav() + '</div></header><main><section><div class=\"wrap\"><div class=\"filters\"><label for=\"post-search\">Search posts<input id=\"post-search\" type=\"search\" placeholder=\"Title, excerpt, category, or tag\" autocomplete=\"off\"></label><label for=\"post-year\">Year<select id=\"post-year\"><option value=\"\">All years</option>' + yearOptionsOfPosts + '</select></label></div><p id=\"post-count\" class=\"result-count\" aria-live=\"polite\">' + wpPosts.length + ' posts</p><ol class=\"timeline\" id=\"post-list\">' + postItems + '</ol><p id=\"post-empty\" class=\"notice\" hidden>No posts match those filters.</p></div></section></main><footer><div class=\"wrap\"><a href=\"/\">Back to catalogue</a></div></footer><script>(()=>{const q=document.getElementById(\"post-search\"),y=document.getElementById(\"post-year\"),rows=[...document.querySelectorAll(\"#post-list li\")],count=document.getElementById(\"post-count\"),empty=document.getElementById(\"post-empty\");function f(){let n=0;for(const r of rows){const show=(!q.value||r.dataset.search.includes(q.value.trim().toLocaleLowerCase()))&&(!y.value||r.dataset.year===y.value);r.hidden=!show;if(show)n++}count.textContent=n+\" of \"+rows.length+\" posts shown\";empty.hidden=n!==0}q.addEventListener(\"input\",f);y.addEventListener(\"input\",f)})();</script>';
  await mkdir(generatedJournalDir, { recursive: true });
  await writeFile(path.join(generatedJournalDir, 'index.html'), documentHtml({ title: 'Journal — ' + site.title, description: 'Published posts imported from the WordPress export.', canonical: 'https://phoenxmusic.github.io/journal/', body: journalBody }), 'utf8');

  const mediaItemsHtml = wpMedia.map(media => {
    const label = media.title || media.attached_file || 'Untitled attachment';
    const meta = (media.mime_type || 'MIME type not recorded') + ' · ' + (media.date || 'Date unknown') + (media.alt ? ' · Alt: ' + media.alt : '');
    return '<li><div><p class=\"title\">' + escapeHtml(label) + '</p><p class=\"meta\">' + escapeHtml(meta) + '</p><p class=\"small\"><a href=\"' + escapeHtml(media.url) + '\">Original media URL</a></p><p class=\"small\">' + escapeHtml(media.status) + '</p></div></li>';
  }).join('\n');
  const mediaBody = '<header><div class=\"wrap\"><p><a href=\"/\">← ' + escapeHtml(site.title) + '</a></p><h1 style=\"font-size:clamp(2.5rem,9vw,4.5rem)\">Media references</h1><p class=\"sub\">' + wpMedia.length + ' attachment records from the WordPress export.</p>' + wordpressNav() + '</div></header><main><section><div class=\"wrap\"><p class=\"notice\">The XML export includes media metadata and URLs, not the original file bytes. Retrieval tests returned HTTP 403 because the source WordPress site is private. These are preserved references, not copied media files.</p><ol class=\"timeline\">' + mediaItemsHtml + '</ol></div></section></main><footer><div class=\"wrap\"><a href=\"/\">Back to catalogue</a></div></footer>';
  await mkdir(generatedMediaArchiveDir, { recursive: true });
  await writeFile(path.join(generatedMediaArchiveDir, 'index.html'), documentHtml({ title: 'Media references — ' + site.title, description: 'WordPress media attachment URLs and metadata; binary assets remain to be retrieved.', canonical: 'https://phoenxmusic.github.io/media-archive/', body: mediaBody }), 'utf8');

  for (const record of allRecords) {
    const outputDir = routeDirectory(record.route);
    await mkdir(outputDir, { recursive: true });
    const bodyHtml = rewriteImportedLinks(record.content_html || '', pathToRoute, slugToRoute);
    const terms = [...(record.categories || []), ...(record.tags || [])].map(term => term.name).filter(Boolean);
    const metadata = '<p class=\"meta\">' + escapeHtml((record.date || '').slice(0, 10) || 'Publication date unknown') + (record.author ? ' · ' + escapeHtml(record.author) : '') + (terms.length ? ' · ' + escapeHtml([...new Set(terms)].join(', ')) : '') + '</p>';
    const sourceLink = '<p class=\"small\">Source: <a href=\"' + escapeHtml(record.source_url) + '\">original WordPress URL</a> · Imported from the 22 October 2026 XML export.</p>';
    const emptyContent = record.type === 'page' && record.slug.toLowerCase() === 'news' ? '<p>The source export contains no body text for this page. Browse the imported <a href=\"/journal/\">journal archive</a> for published posts.</p>' : '<p class=\"notice\">The WordPress export contains no body text for this item. Its title, source URL, and metadata are preserved.</p>';
    const body = '<header><div class=\"wrap\"><p><a href=\"/\">← ' + escapeHtml(site.title) + '</a></p><h1 style=\"font-size:clamp(2.5rem,9vw,4.5rem)\">' + escapeHtml(record.title) + '</h1><p class=\"sub\">' + (record.type === 'post' ? 'From the original WordPress journal' : record.type === 'portfolio' ? 'Portfolio item from the original WordPress site' : 'Page from the original WordPress site') + '</p>' + wordpressNav() + '</div></header><main><article class=\"wrap page-content\">' + metadata + (bodyHtml || emptyContent) + sourceLink + '</article></main><footer><div class=\"wrap\"><a href=\"/journal/\">Journal</a> · <a href=\"/archive-pages/\">WordPress pages</a> · <a href=\"/\">Home</a></div></footer>';
    const lang = /[\u0370-\u03ff\u1f00-\u1fff]/.test(record.title + ' ' + record.content_html) ? 'el' : 'en';
    const description = (record.excerpt || '').replace(/<[^>]*>/g, ' ').slice(0, 240) || record.title + ' — imported from the WordPress archive.';
    const canonical = 'https://phoenxmusic.github.io' + record.route;
    await writeFile(path.join(outputDir, 'index.html'), documentHtml({ title: record.title + ' — ' + site.title, description, canonical, body, lang }), 'utf8');
  }

  // Add visible migration navigation to the homepage and route the old archive link to its new location.
  let homepage = await readFile(path.join(root, 'index.html'), 'utf8');
  homepage = homepage.replace('href=\"/about/\">About this archive', 'href=\"/archive-info/\">About this archive');
  homepage = homepage.replace('</main>', '<section id=\"wordpress-archive\"><div class=\"wrap\"><h2>Original WordPress archive</h2><p>Published pages and posts from the supplied export are reproduced here with original dates, source links, and taxonomy metadata.</p><p><a class=\"button-link\" href=\"/about/\">About PhoenX</a> <a class=\"button-link\" href=\"/music/\">Music</a> <a class=\"button-link\" href=\"/connect/\">Connect</a> <a class=\"button-link\" href=\"/gallery/\">Gallery</a> <a class=\"button-link\" href=\"/στιχοι/\">Lyrics</a> <a class=\"button-link\" href=\"/store/\">Store</a> <a class=\"button-link\" href=\"/tour/\">Tour</a> <a class=\"button-link\" href=\"/news/\">News</a> <a class=\"button-link\" href=\"/journal/\">All posts</a></p><p class=\"small\">The media inventory contains ' + wpMedia.length + ' attachment references. The XML does not contain media bytes and the source site returned HTTP 403 during retrieval tests. See <a href=\"/media-archive/\">media reference inventory</a> for the exact URLs.</p></div></section></main>');
  homepage = homepage.replace('<a class=\"button-link\" href=\"/journal/\">All posts</a>', '<a class=\"button-link\" href=\"/journal/\">All posts</a> <a class=\"button-link\" href=\"/archive-pages/\">All pages</a> <a class=\"button-link\" href=\"/media-archive/\">Media references</a> <a class=\"button-link\" href=\"/archive-info/\">Archive notes</a>');
  await writeFile(path.join(root, 'index.html'), homepage, 'utf8');
  for (const file of [path.join(generatedVideosDir, 'index.html')]) {
    const html = await readFile(file, 'utf8');
    await writeFile(file, html.replaceAll('href=\"/about/\">About this archive', 'href=\"/archive-info/\">About this archive'), 'utf8');
  }
  const audit = {
    source: 'meniossymeon.WordPress.2026-10-22.xml',
    imported_pages: wpPages.length,
    imported_posts: wpPosts.length,
    imported_portfolio_items: wpPortfolio.length,
    media_references: wpMedia.length,
    navigation_items: wpNavigation.length,
    generated_content_pages: allRecords.length,
    route_collisions: false,
    private_or_draft_records_in_public_json: false,
    media_binaries_copied: false,
    media_limit: 'WXR contains references, not binary files; WordPress source returns HTTP 403 without authenticated access.'
  };
  await writeFile(path.join(wordpressContentDir, 'build-audit.json'), JSON.stringify(audit, null, 2) + '\n', 'utf8');
  console.log('Imported WordPress archive: ' + wpPages.length + ' pages, ' + wpPosts.length + ' posts, ' + wpPortfolio.length + ' portfolio items, ' + wpMedia.length + ' media references, ' + wpNavigation.length + ' navigation records.');
} else {
  console.log('WordPress export has not been imported yet; built the PhoenX release catalogue only.');
}

for (const r of releases) {
  const releaseUrl = `https://phoenxmusic.github.io/releases/${r.slug}/`;
  const sourceLink = r.old_site_url ? `<p class="small"><a href="${escapeHtml(r.old_site_url)}">Original release page</a></p>` : '';
  const video = r.youtube_id ? `<iframe class="video" loading="lazy" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(r.youtube_id)}" title="${escapeHtml(r.title)} — PhoenX" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>` : '';
  const artwork = r.artwork ? `<img class="cover" src="${escapeHtml(r.artwork)}" alt="Artwork for ${escapeHtml(r.title)}" loading="lazy">` : '';
  const releaseBody = `<header><div class="wrap">${artistNav()}<p><a href="/">← Back to home</a></p><h1 style="font-size:clamp(2.5rem,9vw,4.5rem)">${escapeHtml(r.title)}</h1><p class="sub">${escapeHtml(site.title)} · ${escapeHtml(r.year || 'Year unknown')} · ${escapeHtml(r.type)}</p></div></header><main><article class="wrap">${artwork}<p class="meta">Language: ${escapeHtml(r.language)}</p>${markdownToHtml(r.body)}${video}${sourceLink}</article></main><footer class="site-footer"><div class="wrap"><a href="/">Back to catalogue</a> · <a href="/videos/">Videos</a> · <a href="/journal/">Journal</a></div></footer>`;
  const dir = path.join(outDir, 'releases', r.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), documentHtml({ title: `${r.title} — PhoenX`, description: `${r.title}, ${r.year || 'year unknown'} — PhoenX music catalogue.`, canonical: releaseUrl, body: releaseBody, lang: r.language || 'en' }), 'utf8');
}

console.log(`Built homepage, about page, video archive (${youtubeVideos.length} public YouTube videos; ${uniqueVideoIds.length} legacy IDs retained), and ${releases.length} permanent release pages.`);
