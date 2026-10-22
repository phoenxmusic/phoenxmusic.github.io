import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(repoRoot, 'scripts', 'archive-manifest.mjs');

async function fixture(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'phoenx-manifest-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const archive = path.join(temp, 'archive');
  await mkdir(path.join(archive, 'artwork'), { recursive: true });
  await writeFile(path.join(archive, 'artwork', 'cover.txt'), 'original cover bytes\n');
  await writeFile(path.join(archive, 'master.txt'), 'original master bytes\n');
  return { temp, archive, manifest: path.join(temp, 'manifest.json') };
}

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 15000 });
}

test('writes and verifies a read-only SHA-256 inventory', async t => {
  const { archive, manifest } = await fixture(t);
  const created = run([archive, '--write', manifest]);
  assert.equal(created.status, 0, created.stderr || created.stdout);
  const saved = JSON.parse(await readFile(manifest, 'utf8'));
  assert.equal(saved.format, 'phoenx-archive-manifest-v1');
  assert.equal(saved.file_count, 2);
  assert.deepEqual(saved.inventory_summary.category_counts, { other: 2 });
  assert.deepEqual(saved.inventory_summary.zero_byte_files, []);
  assert.deepEqual(saved.inventory_summary.duplicate_content_groups, []);
  const verified = run([archive, '--verify', manifest]);
  assert.equal(verified.status, 0, verified.stderr || verified.stdout);
  assert.match(verified.stdout, /VERIFY PASSED: 2 files match manifest SHA-256 hashes and sizes/);
});

test('summarizes media categories, zero-byte files, and byte-identical duplicates', async t => {
  const { archive, manifest } = await fixture(t);
  await writeFile(path.join(archive, 'master.txt'), 'same bytes\n');
  await writeFile(path.join(archive, 'artwork', 'cover.txt'), 'same bytes\n');
  await writeFile(path.join(archive, 'track.mp3'), 'fake fixture bytes');
  await writeFile(path.join(archive, 'silent.wav'), '');
  const created = run([archive, '--write', manifest]);
  assert.equal(created.status, 0, created.stderr || created.stdout);
  const saved = JSON.parse(await readFile(manifest, 'utf8'));
  assert.deepEqual(saved.inventory_summary.category_counts, { audio: 2, other: 2 });
  assert.deepEqual(saved.inventory_summary.zero_byte_files, ['silent.wav']);
  assert.equal(saved.inventory_summary.duplicate_content_groups.length, 1);
  assert.deepEqual(saved.inventory_summary.duplicate_content_groups[0].paths, ['artwork/cover.txt', 'master.txt']);
});

test('detects changed file bytes and size', async t => {
  const { archive, manifest } = await fixture(t);
  assert.equal(run([archive, '--write', manifest]).status, 0);
  await writeFile(path.join(archive, 'master.txt'), 'changed master bytes\n');
  const result = run([archive, '--verify', manifest]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /VERIFY FAILED/);
  assert.match(result.stderr, /HASH master\.txt/);
});

test('detects missing and unexpected files', async t => {
  const { archive, manifest } = await fixture(t);
  assert.equal(run([archive, '--write', manifest]).status, 0);
  await rm(path.join(archive, 'master.txt'));
  await writeFile(path.join(archive, 'new.txt'), 'untracked bytes\n');
  const result = run([archive, '--verify', manifest]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MISSING master\.txt/);
  assert.match(result.stderr, /UNEXPECTED new\.txt/);
});

test('rejects malformed manifests', async t => {
  const { archive, manifest } = await fixture(t);
  await writeFile(manifest, JSON.stringify({ format: 'wrong', files: [] }));
  const result = run([archive, '--verify', manifest]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported or malformed archive manifest/);
});

test('refuses to overwrite an existing manifest', async t => {
  const { archive, manifest } = await fixture(t);
  await writeFile(manifest, 'keep this existing file unchanged\n');
  const result = run([archive, '--write', manifest]);
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(manifest, 'utf8'), 'keep this existing file unchanged\n');
});

test('rejects unknown flags, misplaced arguments, and extra arguments', async t => {
  const { archive, manifest } = await fixture(t);
  for (const args of [
    [archive, '--unknown', manifest],
    ['--write', manifest, archive],
    [archive, '--write'],
    [archive, '--write', manifest, 'unexpected'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stderr}`);
    assert.match(result.stderr, /Usage: node scripts\/archive-manifest\.mjs/);
  }
  await assert.rejects(readFile(manifest, 'utf8'));
});

test('refuses to write or read a manifest inside the archive being inventoried', async t => {
  const { archive, manifest } = await fixture(t);
  const internalManifest = path.join(archive, 'manifest.json');
  const writeResult = run([archive, '--write', internalManifest]);
  assert.notEqual(writeResult.status, 0);
  assert.match(writeResult.stderr, /Manifest input\/output must be stored outside the archive directory/);
  assert.equal(await readFile(path.join(archive, 'master.txt'), 'utf8'), 'original master bytes\n');

  await writeFile(manifest, JSON.stringify({ format: 'phoenx-archive-manifest-v1' }));
  const verifyResult = run([archive, '--verify', internalManifest]);
  assert.notEqual(verifyResult.status, 0);
  assert.match(verifyResult.stderr, /Manifest input\/output must be stored outside the archive directory/);
  await assert.rejects(readFile(internalManifest, 'utf8'));
});

test('rejects unsafe paths and duplicate entries in a manifest', async t => {
  const { archive, manifest } = await fixture(t);
  assert.equal(run([archive, '--write', manifest]).status, 0);
  const saved = JSON.parse(await readFile(manifest, 'utf8'));
  saved.files[0].path = '../outside.txt';
  await writeFile(manifest, JSON.stringify(saved));
  const unsafe = run([archive, '--verify', manifest]);
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /Unsupported or malformed archive manifest/);

  saved.files[0].path = saved.files[1].path;
  saved.total_size_bytes = saved.files.reduce((sum, item) => sum + item.size_bytes, 0);
  await writeFile(manifest, JSON.stringify(saved));
  const duplicate = run([archive, '--verify', manifest]);
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /Unsupported or malformed archive manifest/);
});

test('refuses to claim a complete inventory when the archive contains a symlink', async t => {
  const { archive } = await fixture(t);
  try {
    await symlink(path.join(archive, 'master.txt'), path.join(archive, 'master-link.txt'));
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOSYS', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Symlink creation is not permitted in this environment (${error.code})`);
      return;
    }
    throw error;
  }

  const result = run([archive]);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /symbolic link\(s\) found/);
  assert.match(result.stderr, /SYMLINK master-link\.txt/);
});
