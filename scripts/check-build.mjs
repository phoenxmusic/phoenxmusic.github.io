import { readFile, access, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const exists = async relative => { try { await access(path.join(root, relative)); return true; } catch { return false; } };
let passedChecks = 0;
const assert = (condition, message) => { if (!condition) throw new Error('FAIL: ' + message); passedChecks++; };
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
async function collectHtml(directory, prefix = '') {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    // Standalone design concepts are review artifacts, not generated site pages.
    if (entry.name.startsWith('.') || ['scripts', 'content', 'node_modules', 'presentation-preview'].includes(entry.name)) continue;
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) found.push(...await collectHtml(path.join(directory, entry.name), relative));
    else if (entry.isFile() && entry.name.endsWith('.html')) found.push(relative);
  }
  return found;
}
const site = JSON.parse(await read('content/site.json'));
const homepage = await read('index.html');
const aboutArchive = await read('archive-info/index.html');
const videos = await read('videos/index.html');
const sourceFiles = (await import('node:fs/promises')).readdir(path.join(root, 'content', 'releases')).then(files => files.filter(file => file.endsWith('.md')));
const releaseFiles = await sourceFiles;
const generatedReleaseFiles = await (await import('node:fs/promises')).readdir(path.join(root, 'releases'));
const videoIds = [...(await read('content/unmapped-youtube-ids.md')).matchAll(/^\s*-\s+([A-Za-z0-9_-]{11})\s*$/gm)].map(match => match[1]);
const youtubeVideos = JSON.parse(await read('content/youtube-videos.json'));

assert(homepage.includes('<h1>' + site.title + '</h1>') && homepage.includes(site.tagline), 'homepage title and subtitle come from content/site.json');
assert(homepage.includes('id="release-search"') && homepage.includes('id="year-filter"') && homepage.includes('id="type-filter"') && homepage.includes('id="language-filter"'), 'release search and all three filters are present');
assert(homepage.includes('name="viewport"') && homepage.includes('@media(max-width:48rem)'), 'responsive layout and viewport metadata are present');
assert(['Home', 'Music', 'Videos', 'Story', 'Journal', 'Connect'].every(label => homepage.includes('>' + label + '</a>')), 'homepage has the six primary artist-site navigation sections');
assert(['view-toggle', 'surprise-release', 'share-filters', 'clear-filters'].every(id => homepage.includes('id="' + id + '"')), 'catalogue exposes list/grid, random discovery, shareable filters, and reset controls');
assert(homepage.includes('navigator.clipboard.writeText') && homepage.includes('searchParams.set') && homepage.includes('params.get'), 'filtered catalogue links can be copied and restored from URL parameters');
assert(homepage.includes('prefers-reduced-motion:reduce') && homepage.includes('aria-expanded="false"') && homepage.includes('aria-controls="primary-navigation"'), 'navigation and motion behavior include accessibility controls');
assert(releaseFiles.length === generatedReleaseFiles.length, 'all ' + releaseFiles.length + ' Markdown release records have generated pages');
assert(await exists('archive-info/index.html') && aboutArchive.includes('What is verified'), 'separate migration and archive information page exists');
assert(await exists('videos/index.html') && youtubeVideos.length === 90, 'all 90 public videos from the two supplied channels are indexed');
assert(new Set(youtubeVideos.map(video => video.id)).size === youtubeVideos.length, 'YouTube video index contains unique video IDs');
assert(youtubeVideos.filter(video => video.channel === 'Nikolas Phoenx').length === 2 && youtubeVideos.filter(video => video.channel === 'PhoenX Music').length === 88, 'both YouTube channels are represented with expected counts');
assert(youtubeVideos.every(video => videos.includes(`data-video-id="${video.id}"`) && videos.includes(escapeHtml(video.title))), 'all public video titles and IDs are rendered in the searchable archive');
assert(videoIds.length === 13 && videoIds.every(id => youtubeVideos.some(video => video.id === id)), 'the original 13 unmatched archive IDs remain included in the full channel index');
assert(videos.includes('data-play-video') && videos.includes('youtube-nocookie.com/embed/'), 'video players are embedded on demand using the privacy-enhanced YouTube host');
assert(homepage.includes('/journal/') && homepage.includes('/archive-pages/') && homepage.includes('/media-archive/'), 'homepage exposes the imported WordPress content indexes');

const report = JSON.parse(await read('content/wordpress/import-report.json'));
const audit = JSON.parse(await read('content/wordpress/build-audit.json'));
const pages = JSON.parse(await read('content/wordpress/pages.json'));
const posts = JSON.parse(await read('content/wordpress/posts.json'));
const portfolio = JSON.parse(await read('content/wordpress/portfolio.json'));
const media = JSON.parse(await read('content/wordpress/media.json'));
const mediaAudit = JSON.parse(await read('content/wordpress/media-audit.json'));
const navigation = JSON.parse(await read('content/wordpress/navigation.json'));
assert(report.published_imported.page === 19 && pages.length === 19, 'all 19 published WordPress pages are represented');
assert(report.published_imported.post === 109 && posts.length === 109, 'all 109 published WordPress posts are represented');
assert(portfolio.length === 1, 'published portfolio record is represented');
assert(media.length === 150 && navigation.length === 39, 'all 150 media references and 39 navigation records are inventoried');
assert(mediaAudit.total_records === media.length && mediaAudit.unique_nonempty_urls === 150, 'media metadata audit covers all 150 unique attachment URLs');
assert(mediaAudit.duplicate_url_groups === 0 && mediaAudit.missing_url_records.length === 0 && mediaAudit.invalid_or_non_https_url_records.length === 0, 'media URL inventory has no duplicate, missing, or invalid URLs');
assert(mediaAudit.missing_title_records.length === 3 && mediaAudit.missing_alt_records.length === 147 && mediaAudit.missing_mime_type_records.length === 150, 'media metadata gaps are quantified rather than guessed');
assert(mediaAudit.binary_status_counts['source-url-only; binary not included in WXR export'] === 150, 'all media binaries remain explicitly marked as unavailable in the export');
assert(audit.private_or_draft_records_in_public_json === false, 'private and draft WordPress records are excluded from public source data');
assert(audit.media_binaries_copied === false, 'media binary limitation is explicitly recorded rather than misrepresented');
assert(await exists('journal/index.html') && (await read('journal/index.html')).includes('109 published posts'), 'searchable journal index contains the full published post count');
assert(await exists('archive-pages/index.html') && (await read('archive-pages/index.html')).includes('19 published pages'), 'page index contains the full published page count');
assert(await exists('media-archive/index.html') && (await read('media-archive/index.html')).includes('150 attachment records'), 'media reference index contains all attachment records');
assert(!(await read('gallery/index.html')).match(/\[(?:gallery|caption|audio)\b/i), 'common WordPress gallery/caption/audio shortcodes are converted into readable fallbacks');
assert((await read('gallery/index.html')).includes('media-unavailable'), 'unavailable image files are shown as explicit placeholders instead of broken image elements');

const allRecords = [...pages, ...posts, ...portfolio];
assert(new Set(allRecords.map(record => record.route)).size === allRecords.length, 'all imported WordPress records have unique output routes');
assert(allRecords.every(record => record.status === 'publish'), 'only published records appear in public JSON');
assert(!JSON.stringify(allRecords).includes('01 Internal Dashboard'), 'private internal dashboard content is not in public JSON');

for (const record of allRecords) {
  const relative = decodeURIComponent(record.route).split('/').filter(Boolean).join(path.sep) + path.sep + 'index.html';
  assert(await exists(relative), 'generated route exists: ' + record.route);
  const html = await read(relative);
  assert(html.includes(escapeHtml(record.title)), 'generated page contains source title: ' + record.title.slice(0, 55));
  assert(html.includes(record.source_url), 'generated page retains source provenance: ' + record.route);
  assert(!/<script\b[^>]*>[\s\S]*?<\/script\s*>/i.test(html.replace(/<script>[\s\S]*?<\/script>/gi, '')), 'imported page has no injected script element: ' + record.route);
  assert(!/<img\b[^>]*src=['"]https?:\/\/(?:www\.)?meniossymeon\.wordpress\.com\/wp-content\/uploads/i.test(html), 'unavailable WordPress image binary is not left as a broken image: ' + record.route);
}

const samplePost = posts.find(record => record.title === 'The Sthlm sessions Vol 1 is here');
assert(Boolean(samplePost) && (await read(decodeURIComponent(samplePost.route).slice(1) + 'index.html')).includes('original WordPress URL'), 'sample journal post preserves content and source provenance');
assert((await stat(path.join(root, 'content', 'wordpress', 'posts.json'))).size > 100000, 'full published post content is stored in the repository');
const htmlFiles = await collectHtml(root);
const navCoverage = await Promise.all(htmlFiles.map(async file => (await read(file)).includes('id="primary-navigation"')));
assert(htmlFiles.length > 0 && navCoverage.every(Boolean), 'all generated HTML pages share the primary artist navigation');
let checkedInternalLinks = 0;
for (const file of htmlFiles) {
  const html = await read(file);
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    new Script(match[1], { filename: file + ':inline-script' });
  }
  for (const match of html.matchAll(/(?:href|src)=(['"])(\/[^'"#]*)(?:#[^'"]*)?\1/gi)) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(match[2], 'https://phoenxmusic.github.io').pathname); } catch { continue; }
    let target = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    if (!path.extname(target)) target = path.join(target, 'index.html');
    assert(await exists(target), 'internal link resolves: ' + match[2] + ' (from ' + file + ')');
    checkedInternalLinks++;
  }
}
console.log('PASS: ' + passedChecks + ' checks; ' + releaseFiles.length + ' releases; ' + pages.length + ' WordPress pages; ' + posts.length + ' WordPress posts; ' + portfolio.length + ' portfolio item; ' + media.length + ' media references; ' + navigation.length + ' navigation records; ' + checkedInternalLinks + ' internal links checked across ' + htmlFiles.length + ' HTML files.');
