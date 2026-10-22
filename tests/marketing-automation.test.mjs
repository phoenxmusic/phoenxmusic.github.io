import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { generateFeed } from '../scripts/generate-feed.mjs';
import { generateMarketingDrafts, parseCsv } from '../scripts/marketing-drafts.mjs';

test('RSS feed includes only published records with source publication dates', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phoenx-feed-'));
  try {
    await mkdir(path.join(root, 'content', 'wordpress'), { recursive: true });
    await writeFile(path.join(root, 'content', 'wordpress', 'posts.json'), JSON.stringify([
      { status: 'publish', title: 'Published & preserved', route: '/2014/08/15/sample/', date: '2014-08-15 11:49:03', excerpt: 'Archive item' },
      { status: 'draft', title: 'Do not expose', route: '/draft/', date: '2026-01-01 00:00:00' },
      { status: 'publish', title: 'No date', route: '/no-date/', date: 'unknown' }
    ]));
    const summary = await generateFeed({ rootDir: root });
    const xml = await readFile(path.join(root, 'rss.xml'), 'utf8');
    assert.equal(summary.items, 1);
    assert.match(xml, /Published &amp; preserved/);
    assert.match(xml, /https:\/\/phoenxmusic\.github\.io\/2014\/08\/15\/sample\//);
    assert.doesNotMatch(xml, /Do not expose|No date/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('marketing dry-run creates evidence-linked drafts but holds uncleared rights and unapproved items', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-root-'));
  const out = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-out-'));
  try {
    await mkdir(path.join(root, 'content', 'marketing'), { recursive: true });
    await mkdir(path.join(root, 'content', 'releases'), { recursive: true });
    await writeFile(path.join(root, 'content', 'marketing', 'queue.csv'), 'id,theme,catalogue_id_or_slug,draft_brief,evidence_source,rights_status,target_url,channel,approval_status,last_used,cooldown_until,notes\nitem-1,release-spotlight,sample,brief,content/releases/sample.md,unknown,https://phoenxmusic.github.io/releases/sample/,website,not_approved,,,');
    await writeFile(path.join(root, 'content', 'releases', 'sample.md'), '---\ntitle: Sample Release\nyear: 2004\ntype: Album\nlanguage: en\n---\nOnly source-backed fields.');
    const summary = await generateMarketingDrafts({ rootDir: root, outputDir: out, now: new Date('2026-10-22T00:00:00Z') });
    const draft = JSON.parse(await readFile(path.join(out, 'drafts', 'item-1.json'), 'utf8'));
    assert.equal(summary.draft_files, 1);
    assert.equal(summary.held, 1);
    assert.equal(summary.published, 0);
    assert.equal(draft.status, 'held_for_review');
    assert.ok(draft.hold_reasons.includes('rights_not_cleared'));
    assert.ok(draft.hold_reasons.includes('human_approval_missing'));
    assert.equal(draft.verified_fields.year, '2004');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(out, { recursive: true, force: true });
  }
});

test('marketing queue parser rejects malformed CSV rows', () => {
  assert.throws(() => parseCsv('id,title\nonly-one-field'), /expected 2 columns/);
  assert.throws(() => parseCsv('id,title\n"unterminated,value'), /unterminated quoted field/);
});
