import test from 'node:test';
import assert from 'node:assert/strict';
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
