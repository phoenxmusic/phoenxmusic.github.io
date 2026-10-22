import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(repoRoot, 'scripts', 'audit-media-inventory.mjs');

test('rejects unsupported or conflicting media-audit command-line arguments', () => {
  const invalidArguments = [
    ['--unknown'],
    ['--summary', '--check'],
    ['--write'],
    ['--write', 'report.json', '--summary'],
    ['--summary', 'unexpected'],
    ['--check', '--check'],
  ];

  for (const args of invalidArguments) {
    const result = spawnSync(process.execPath, [script, ...args], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.status, 2, `${args.join(' ')} should be rejected: ${result.stderr}`);
    assert.match(result.stderr, /Usage: node scripts\/audit-media-inventory\.mjs/);
  }
});

test('supports summary, consistency-check, and create-only report modes', async t => {
  const summary = spawnSync(process.execPath, [script, '--summary'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(summary.status, 0, summary.stderr);
  const summaryReport = JSON.parse(summary.stdout);
  assert.equal(summaryReport.total_records, 150);
  assert.equal(summaryReport.unique_nonempty_urls, 150);

  const check = spawnSync(process.execPath, [script, '--check'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /MEDIA AUDIT PASSED/);

  const temp = await mkdtemp(path.join(os.tmpdir(), 'phoenx-media-audit-write-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const output = path.join(temp, 'report.json');
  const write = spawnSync(process.execPath, [script, '--write', output], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(write.status, 0, write.stderr);
  const writtenReport = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(writtenReport.total_records, 150);

  const overwrite = spawnSync(process.execPath, [script, '--write', output], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.notEqual(overwrite.status, 0, 'report creation must not overwrite an existing file');
});

test('fails clearly when the attachment register contains malformed records', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'phoenx-media-audit-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const scriptsDir = path.join(temp, 'scripts');
  const contentDir = path.join(temp, 'content', 'wordpress');
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(contentDir, { recursive: true });
  const scriptCopy = path.join(scriptsDir, 'audit-media-inventory.mjs');
  await writeFile(scriptCopy, await readFile(script, 'utf8'));

  const malformedRecords = [
    [null],
    [[]],
    [{ title: 'missing id' }],
    [{ id: '42', title: 123 }],
    [{ id: '42', url: false }],
  ];
  for (const records of malformedRecords) {
    await writeFile(path.join(contentDir, 'media.json'), JSON.stringify(records));
    const result = spawnSync(process.execPath, [scriptCopy], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Malformed media inventory record at index 0/);
  }
});

test('fails closed when the attachment register is unexpectedly empty', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'phoenx-media-audit-empty-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const scriptsDir = path.join(temp, 'scripts');
  const contentDir = path.join(temp, 'content', 'wordpress');
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(contentDir, { recursive: true });
  const scriptCopy = path.join(scriptsDir, 'audit-media-inventory.mjs');
  await writeFile(scriptCopy, await readFile(script, 'utf8'));
  await writeFile(path.join(contentDir, 'media.json'), '[]\n');

  const result = spawnSync(process.execPath, [scriptCopy], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Media inventory is empty/);
});

test('flags non-absolute HTTPS URLs and URLs containing embedded credentials', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'phoenx-media-audit-url-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const scriptsDir = path.join(temp, 'scripts');
  const contentDir = path.join(temp, 'content', 'wordpress');
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(contentDir, { recursive: true });
  const scriptCopy = path.join(scriptsDir, 'audit-media-inventory.mjs');
  await writeFile(scriptCopy, await readFile(script, 'utf8'));
  await writeFile(path.join(contentDir, 'media.json'), JSON.stringify([
    { id: 1, title: 'relative', url: 'https:relative/path.mp3' },
    { id: 2, title: 'credentials', url: 'https://user:password@example.com/private.mp3' },
    { id: 3, title: 'raw whitespace', url: 'https://example.com/audio file.mp3' },
    { id: 4, title: 'valid', url: 'https://example.com/audio.mp3' },
  ]));

  const result = spawnSync(process.execPath, [scriptCopy, '--summary'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.invalid_or_non_https_url_records, 3);
});

test('reports missing and impossible calendar dates without modifying source metadata', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'phoenx-media-audit-date-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const scriptsDir = path.join(temp, 'scripts');
  const contentDir = path.join(temp, 'content', 'wordpress');
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(contentDir, { recursive: true });
  const scriptCopy = path.join(scriptsDir, 'audit-media-inventory.mjs');
  await writeFile(scriptCopy, await readFile(script, 'utf8'));
  const source = [
    { id: 1, title: 'missing date', url: 'https://example.com/a.mp3', date: '' },
    { id: 2, title: 'impossible date', url: 'https://example.com/b.mp3', date: '2025-02-29' },
    { id: 3, title: 'valid leap day', url: 'https://example.com/c.mp3', date: '2024-02-29' },
    { id: 4, title: 'invalid timestamp', url: 'https://example.com/d.mp3', date: '2024-02-29Tnot-a-time' },
  ];
  const input = path.join(contentDir, 'media.json');
  await writeFile(input, JSON.stringify(source));

  const result = spawnSync(process.execPath, [scriptCopy], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.missing_date_records.map(record => record.id), [1]);
  assert.deepEqual(report.invalid_date_records.map(record => record.id), [2, 4]);
  assert.deepEqual(JSON.parse(await readFile(input, 'utf8')), source);
});

test('flags malformed MIME types while accepting standard type/subtype values', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'phoenx-media-audit-mime-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const scriptsDir = path.join(temp, 'scripts');
  const contentDir = path.join(temp, 'content', 'wordpress');
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(contentDir, { recursive: true });
  const scriptCopy = path.join(scriptsDir, 'audit-media-inventory.mjs');
  await writeFile(scriptCopy, await readFile(script, 'utf8'));
  await writeFile(path.join(contentDir, 'media.json'), JSON.stringify([
    { id: 1, title: 'valid audio', url: 'https://example.com/a.mp3', mime_type: 'audio/mpeg' },
    { id: 2, title: 'valid with parameter', url: 'https://example.com/b.mp3', mime_type: 'audio/mpeg; charset=binary' },
    { id: 3, title: 'missing slash', url: 'https://example.com/c.mp3', mime_type: 'audio' },
    { id: 4, title: 'empty subtype', url: 'https://example.com/d.mp3', mime_type: 'audio/' },
  ]));

  const result = spawnSync(process.execPath, [scriptCopy, '--summary'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.invalid_mime_type_records, 2);
});

test('flags known MIME and filename-extension conflicts without guessing missing types', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'phoenx-media-audit-mime-extension-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const scriptsDir = path.join(temp, 'scripts');
  const contentDir = path.join(temp, 'content', 'wordpress');
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(contentDir, { recursive: true });
  const scriptCopy = path.join(scriptsDir, 'audit-media-inventory.mjs');
  await writeFile(scriptCopy, await readFile(script, 'utf8'));
  await writeFile(path.join(contentDir, 'media.json'), JSON.stringify([
    { id: 1, title: 'consistent audio', url: 'https://example.com/a.mp3', mime_type: 'audio/mpeg' },
    { id: 2, title: 'conflicting image', url: 'https://example.com/b.png', mime_type: 'image/jpeg' },
    { id: 3, title: 'zip alias', url: 'https://example.com/c.zip', mime_type: 'application/x-zip-compressed' },
    { id: 4, title: 'missing type', url: 'https://example.com/d.mp3', mime_type: '' },
    { id: 5, title: 'unknown extension', url: 'https://example.com/e.custom', mime_type: 'image/jpeg' },
  ]));

  const result = spawnSync(process.execPath, [scriptCopy, '--summary'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.mime_extension_mismatch_records, 1);
});

test('reports attachment-path and source-URL filename conflicts', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'phoenx-media-audit-filename-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const scriptsDir = path.join(temp, 'scripts');
  const contentDir = path.join(temp, 'content', 'wordpress');
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(contentDir, { recursive: true });
  const scriptCopy = path.join(scriptsDir, 'audit-media-inventory.mjs');
  await writeFile(scriptCopy, await readFile(script, 'utf8'));
  await writeFile(path.join(contentDir, 'media.json'), JSON.stringify([
    { id: 1, title: 'matching', url: 'https://example.com/audio.mp3', attached_file: '/uploads/audio.mp3' },
    { id: 2, title: 'mismatch', url: 'https://example.com/photo.jpg', attached_file: '/uploads/renamed.jpg' },
    { id: 3, title: 'missing local path', url: 'https://example.com/no-path.png', attached_file: '' },
  ]));

  const result = spawnSync(process.execPath, [scriptCopy, '--summary'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.attachment_path_filename_mismatch_records, 1);
});

test('rejects duplicate attachment identifiers instead of conflating records', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'phoenx-media-audit-duplicate-id-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const scriptsDir = path.join(temp, 'scripts');
  const contentDir = path.join(temp, 'content', 'wordpress');
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(contentDir, { recursive: true });
  await writeFile(path.join(scriptsDir, 'audit-media-inventory.mjs'), await readFile(script, 'utf8'));
  await writeFile(path.join(contentDir, 'media.json'), JSON.stringify([
    { id: '42', title: 'first attachment' },
    { id: 42, title: 'second attachment' },
  ]));

  const result = spawnSync(process.execPath, [path.join(scriptsDir, 'audit-media-inventory.mjs')], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Duplicate media inventory id at index 1: 42/);
});
