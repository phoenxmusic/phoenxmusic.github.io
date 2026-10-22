#!/usr/bin/env node
// Summarize the imported WordPress attachment register without fetching or modifying media.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'content', 'wordpress', 'media.json');
const args = process.argv.slice(2);
const writeIndex = args.indexOf('--write');
const output = writeIndex >= 0 ? args[writeIndex + 1] : null;
const summaryOnly = args.includes('--summary');
const checkReport = args.includes('--check');
const validArgs = args.length === 0 ||
  (args.length === 1 && summaryOnly) ||
  (args.length === 1 && checkReport) ||
  (args.length === 2 && writeIndex === 0 && Boolean(output) && !output.startsWith('--'));
if (!validArgs) {
  console.error('Usage: node scripts/audit-media-inventory.mjs [--summary | --write <new-report.json> | --check]');
  process.exit(2);
}

const records = JSON.parse(await readFile(input, 'utf8'));
if (!Array.isArray(records)) throw new Error('Media inventory must be a JSON array.');
const countBy = keyFn => Object.fromEntries([...records.reduce((counts, record) => {
  const key = keyFn(record);
  counts.set(key, (counts.get(key) || 0) + 1);
  return counts;
}, new Map())].sort(([a], [b]) => a.localeCompare(b, 'en')));
const extensionOf = url => {
  try { return (path.posix.extname(new URL(url).pathname).toLowerCase() || '[no extension]'); }
  catch { return '[invalid or missing URL]'; }
};
const urlCounts = new Map();
for (const record of records) if (record.url) urlCounts.set(record.url, (urlCounts.get(record.url) || 0) + 1);
const duplicateUrls = [...urlCounts].filter(([, count]) => count > 1).map(([url, count]) => ({ url, count }));
const invalidUrlRecords = records.filter(record => {
  try { const url = new URL(record.url); return url.protocol !== 'https:'; }
  catch { return true; }
}).map(record => ({ id: record.id, title: record.title, url: record.url || null }));
const report = {
  schema_version: 1,
  source: 'content/wordpress/media.json',
  generated_by: 'scripts/audit-media-inventory.mjs',
  scope: 'Metadata-only audit; no network requests and no claim that media binaries are present.',
  total_records: records.length,
  unique_nonempty_urls: urlCounts.size,
  duplicate_url_groups: duplicateUrls.length,
  duplicate_urls: duplicateUrls,
  missing_url_records: records.filter(record => !record.url).map(record => ({ id: record.id, title: record.title })),
  invalid_or_non_https_url_records: invalidUrlRecords,
  missing_title_records: records.filter(record => !String(record.title || '').trim()).map(record => ({ id: record.id, url: record.url || null })),
  missing_alt_records: records.filter(record => !String(record.alt || '').trim()).map(record => ({ id: record.id, title: record.title, url: record.url || null })),
  missing_mime_type_records: records.filter(record => !String(record.mime_type || '').trim()).map(record => ({ id: record.id, title: record.title, url: record.url || null, inferred_extension: extensionOf(record.url) })),
  extension_counts: countBy(record => extensionOf(record.url)),
  mime_type_counts: countBy(record => String(record.mime_type || '[missing]')),
  year_counts: countBy(record => /^\d{4}/.test(String(record.date || '')) ? String(record.date).slice(0, 4) : '[missing or invalid date]'),
  binary_status_counts: countBy(record => String(record.status || '[missing]')),
};
const json = `${JSON.stringify(report, null, 2)}\n`;
if (checkReport) {
  const reportPath = path.join(root, 'content', 'wordpress', 'media-audit.json');
  const saved = await readFile(reportPath, 'utf8');
  if (saved !== json) {
    console.error('MEDIA AUDIT STALE: run node scripts/audit-media-inventory.mjs --write <new-report.json> and review/update content/wordpress/media-audit.json.');
    process.exit(1);
  }
  console.log(`MEDIA AUDIT PASSED: ${report.total_records} records; ${report.unique_nonempty_urls} unique URLs; ${report.duplicate_url_groups} duplicate URL groups; binary availability remains unverified.`);
} else if (output) {
  await writeFile(path.resolve(output), json, { encoding: 'utf8', flag: 'wx' });
  console.log(`Wrote ${path.relative(process.cwd(), path.resolve(output))}: ${report.total_records} records, ${report.unique_nonempty_urls} unique URLs, ${report.duplicate_url_groups} duplicate URL groups.`);
} else {
  if (summaryOnly) {
    console.log(JSON.stringify({
      total_records: report.total_records,
      unique_nonempty_urls: report.unique_nonempty_urls,
      duplicate_url_groups: report.duplicate_url_groups,
      missing_url_records: report.missing_url_records.length,
      invalid_or_non_https_url_records: report.invalid_or_non_https_url_records.length,
      missing_title_records: report.missing_title_records.length,
      missing_alt_records: report.missing_alt_records.length,
      missing_mime_type_records: report.missing_mime_type_records.length,
      extension_counts: report.extension_counts,
      year_counts: report.year_counts,
      binary_status_counts: report.binary_status_counts,
    }, null, 2));
  } else console.log(json.trimEnd());
}
