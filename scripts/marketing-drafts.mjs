import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultBase = 'https://phoenxmusic.github.io';

function parseCsvLine(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { fields.push(value); value = ''; }
    else value += ch;
  }
  if (quoted) throw new Error('Malformed CSV: unterminated quoted field');
  fields.push(value);
  return fields;
}

export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) throw new Error('Marketing queue is empty');
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) throw new Error(`Marketing queue line ${index + 2}: expected ${headers.length} columns, got ${values.length}`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}

function parseFrontMatter(raw, source) {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${source}: missing front matter`);
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon > 0) fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return fields;
}

export async function generateMarketingDrafts({ rootDir = root, outputDir, baseUrl = defaultBase, now = new Date() } = {}) {
  if (!outputDir) throw new Error('Pass --out DIR so generated drafts are not written into the public site tree by accident');
  const repoRoot = path.resolve(rootDir);
  const queue = parseCsv(await readFile(path.join(repoRoot, 'content', 'marketing', 'queue.csv'), 'utf8'));
  const out = path.resolve(outputDir);
  if (out === repoRoot || out.startsWith(repoRoot + path.sep)) throw new Error('Draft output must be outside the repository/public site tree');
  const draftsDir = path.join(out, 'drafts');
  await mkdir(draftsDir, { recursive: true });
  const summary = { generated_at: now.toISOString(), mode: 'draft-only', publishing_enabled: false, queue_items: queue.length, draft_files: 0, held: 0, eligible_for_review: 0, published: 0, analytics: 'not_measured', items: [] };

  for (const item of queue) {
    const sourcePath = path.resolve(repoRoot, item.evidence_source || '');
    const insideRoot = sourcePath.startsWith(repoRoot + path.sep);
    let sourceExists = false;
    let sourceFields = {};
    const holdReasons = [];
    if (!insideRoot) holdReasons.push('evidence_source_outside_repository');
    else {
      try { sourceFields = parseFrontMatter(await readFile(sourcePath, 'utf8'), item.evidence_source); sourceExists = true; }
      catch { holdReasons.push('evidence_source_missing_or_unreadable'); }
    }
    let targetValid = false;
    try {
      const target = new URL(item.target_url);
      targetValid = target.protocol === 'https:' && target.origin === new URL(baseUrl).origin && !target.username && !target.password && target.pathname === `/releases/${item.catalogue_id_or_slug}/`;
    } catch {}
    if (!targetValid) holdReasons.push('target_url_not_canonical_release_route');
    if (item.rights_status !== 'cleared') holdReasons.push('rights_not_cleared');
    if (item.approval_status !== 'approved') holdReasons.push('human_approval_missing');
    if (!sourceFields.title || !sourceFields.type) holdReasons.push('verified_title_or_type_missing');

    const title = sourceFields.title || item.catalogue_id_or_slug || item.id;
    const year = sourceFields.year && !['unknown', 'null', '~'].includes(sourceFields.year.toLowerCase()) ? sourceFields.year : 'year not verified';
    const type = sourceFields.type || 'release type not verified';
    const copy = `Explore ${title} in the PhoenX music archive. The catalogue currently records this as ${type}; ${year === 'year not verified' ? 'the release year has not been verified in this source.' : `the source lists the year as ${year}.`} Visit the catalogue entry for the preserved details.`;
    const status = holdReasons.length ? 'held_for_review' : 'eligible_for_human_review';
    const draft = {
      id: item.id, theme: item.theme, status, generated_at: now.toISOString(), channel: item.channel,
      language: sourceFields.language || 'not_verified', source: item.evidence_source, source_exists: sourceExists,
      verified_fields: { title: sourceFields.title || null, year: sourceFields.year || null, type: sourceFields.type || null, language: sourceFields.language || null },
      target_url: targetValid ? item.target_url : '', rights_status: item.rights_status || 'unknown',
      approval_status: item.approval_status || 'not_approved', hold_reasons: holdReasons, copy, publishing_enabled: false
    };
    await writeFile(path.join(draftsDir, `${item.id}.json`), JSON.stringify(draft, null, 2) + '\n', 'utf8');
    summary.draft_files++;
    if (holdReasons.length) summary.held++; else summary.eligible_for_review++;
    summary.items.push({ id: item.id, status, hold_reasons: holdReasons });
  }

  await writeFile(path.join(out, 'marketing-report.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
  const report = [
    '# PhoenX marketing automation dry-run', '', `- Generated: ${summary.generated_at}`,
    '- Mode: draft-only; publishing is disabled', `- Queue records: ${summary.queue_items}`,
    `- Draft files created: ${summary.draft_files}`, `- Held for review: ${summary.held}`,
    `- Eligible for human review: ${summary.eligible_for_review}`,
    '- Analytics: not measured (no Search Console/Bing/analytics connection configured)', '', '## Item status',
    ...summary.items.map(item => `- **${item.id}** — ${item.status}${item.hold_reasons.length ? `: ${item.hold_reasons.join(', ')}` : ''}`),
    '', 'No posts were published. Rights status and human approval are mandatory gates.'
  ].join('\n') + '\n';
  await writeFile(path.join(out, 'README.md'), report, 'utf8');
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  if (outIndex < 0 || !args[outIndex + 1]) throw new Error('Usage: node scripts/marketing-drafts.mjs --out DIR [--base-url URL]');
  const baseIndex = args.indexOf('--base-url');
  const summary = await generateMarketingDrafts({ outputDir: args[outIndex + 1], baseUrl: baseIndex >= 0 ? args[baseIndex + 1] : defaultBase });
  console.log(`Marketing dry-run complete: ${summary.draft_files} drafts, ${summary.held} held, ${summary.eligible_for_review} eligible for human review, ${summary.published} published.`);
}
