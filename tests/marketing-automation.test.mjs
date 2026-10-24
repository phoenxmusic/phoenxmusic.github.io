import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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
  const headers = 'id,theme,catalogue_id_or_slug,evidence_source,rights_status,target_url,channel,approval_status';
  assert.throws(() => parseCsv(`${headers}\nitem-1,release-spotlight`), /expected 8 columns/);
  assert.throws(() => parseCsv(`${headers}\n"unterminated,value`), /unterminated quoted field/);
  assert.throws(() => parseCsv('id,id,theme,catalogue_id_or_slug,evidence_source,rights_status,target_url,channel,approval_status'), /duplicate column names/);
  assert.throws(() => parseCsv('id,title\nitem-1,Title'), /missing required columns/);
});

test('marketing generator rejects unsafe and duplicate queue ids before creating drafts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-id-root-'));
  const out = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-id-out-'));
  try {
    await mkdir(path.join(root, 'content', 'marketing'), { recursive: true });
    const header = 'id,theme,catalogue_id_or_slug,evidence_source,rights_status,target_url,channel,approval_status';
    await writeFile(path.join(root, 'content', 'marketing', 'queue.csv'), `${header}\n../escape,release-spotlight,sample,content/releases/sample.md,unknown,https://phoenxmusic.github.io/releases/sample/,website,not_approved\n`);
    await assert.rejects(generateMarketingDrafts({ rootDir: root, outputDir: out }), /id must be a lowercase kebab-case slug/);
    await writeFile(path.join(root, 'content', 'marketing', 'queue.csv'), `${header}\nitem-1,release-spotlight,sample,content/releases/sample.md,unknown,https://phoenxmusic.github.io/releases/sample/,website,not_approved\nitem-1,release-spotlight,sample,content/releases/sample.md,unknown,https://phoenxmusic.github.io/releases/sample/,website,not_approved\n`);
    await assert.rejects(generateMarketingDrafts({ rootDir: root, outputDir: out }), /duplicate id item-1/);
    await assert.rejects(readFile(path.join(out, 'drafts', 'item-1.json'), 'utf8'), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(out, { recursive: true, force: true });
  }
});

test('marketing generator holds evidence symlinks that resolve outside the repository', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-link-root-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-link-outside-'));
  const out = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-link-drafts-'));
  try {
    await mkdir(path.join(root, 'content', 'marketing'), { recursive: true });
    await mkdir(path.join(root, 'content', 'releases'), { recursive: true });
    const outsideSource = path.join(outside, 'outside.md');
    await writeFile(outsideSource, '---\ntitle: Outside\nyear: 2001\ntype: release\n---\n');
    try { await symlink(outsideSource, path.join(root, 'content', 'releases', 'linked.md')); }
    catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error.code)) { t.skip(`File symlinks unavailable: ${error.code}`); return; }
      throw error;
    }
    const header = 'id,theme,catalogue_id_or_slug,evidence_source,rights_status,target_url,channel,approval_status';
    await writeFile(path.join(root, 'content', 'marketing', 'queue.csv'), `${header}\nitem-1,release-spotlight,sample,content/releases/linked.md,unknown,https://phoenxmusic.github.io/releases/sample/,website,not_approved\n`);
    const summary = await generateMarketingDrafts({ rootDir: root, outputDir: out });
    const draft = JSON.parse(await readFile(path.join(out, 'drafts', 'item-1.json'), 'utf8'));
    assert.equal(summary.held, 1);
    assert.ok(draft.hold_reasons.includes('evidence_source_outside_repository'));
    assert.equal(draft.source_exists, false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
    await rm(out, { recursive: true, force: true });
  }
});

test('marketing generator rejects an output symlink that resolves into the repository', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-output-root-'));
  const aliasParent = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-output-alias-'));
  const alias = path.join(aliasParent, 'repository-link');
  try {
    await mkdir(path.join(root, 'content', 'marketing'), { recursive: true });
    await writeFile(path.join(root, 'content', 'marketing', 'queue.csv'), 'id,theme,catalogue_id_or_slug,evidence_source,rights_status,target_url,channel,approval_status\nitem-1,release-spotlight,sample,content/releases/sample.md,unknown,https://phoenxmusic.github.io/releases/sample/,website,not_approved\n');
    try { await symlink(root, alias, 'junction'); }
    catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error.code)) { t.skip(`Directory symlinks unavailable: ${error.code}`); return; }
      throw error;
    }
    await assert.rejects(generateMarketingDrafts({ rootDir: root, outputDir: alias }), /Draft output must resolve outside the repository/);
    await assert.rejects(readFile(path.join(root, 'drafts', 'item-1.json'), 'utf8'), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(aliasParent, { recursive: true, force: true });
  }
});

test('marketing generator rejects a drafts subdirectory symlink that resolves into the repository', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-nested-output-root-'));
  const out = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-nested-output-out-'));
  try {
    await mkdir(path.join(root, 'content', 'marketing'), { recursive: true });
    await writeFile(path.join(root, 'content', 'marketing', 'queue.csv'), 'id,theme,catalogue_id_or_slug,evidence_source,rights_status,target_url,channel,approval_status\nitem-1,release-spotlight,sample,content/releases/sample.md,unknown,https://phoenxmusic.github.io/releases/sample/,website,not_approved\n');
    try { await symlink(root, path.join(out, 'drafts'), 'junction'); }
    catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error.code)) { t.skip(`Directory symlinks unavailable: ${error.code}`); return; }
      throw error;
    }
    await assert.rejects(generateMarketingDrafts({ rootDir: root, outputDir: out }), /Draft output directory must resolve inside the external output directory/);
    await assert.rejects(readFile(path.join(root, 'drafts', 'item-1.json'), 'utf8'), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(out, { recursive: true, force: true });
  }
});

test('marketing generator refuses to overwrite a symlinked draft file', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-file-link-root-'));
  const out = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-file-link-out-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'phoenx-marketing-file-link-target-'));
  try {
    await mkdir(path.join(root, 'content', 'marketing'), { recursive: true });
    await writeFile(path.join(root, 'content', 'marketing', 'queue.csv'), 'id,theme,catalogue_id_or_slug,evidence_source,rights_status,target_url,channel,approval_status\nitem-1,release-spotlight,sample,content/releases/sample.md,unknown,https://phoenxmusic.github.io/releases/sample/,website,not_approved\n');
    await mkdir(path.join(out, 'drafts'), { recursive: true });
    const protectedFile = path.join(outside, 'protected.txt');
    await writeFile(protectedFile, 'must remain unchanged');
    try { await symlink(protectedFile, path.join(out, 'drafts', 'item-1.json')); }
    catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error.code)) { t.skip(`File symlinks unavailable: ${error.code}`); return; }
      throw error;
    }
    await assert.rejects(generateMarketingDrafts({ rootDir: root, outputDir: out }), /Refusing unsafe pre-existing draft output path/);
    assert.equal(await readFile(protectedFile, 'utf8'), 'must remain unchanged');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(out, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
