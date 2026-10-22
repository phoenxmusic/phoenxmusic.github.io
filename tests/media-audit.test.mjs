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
