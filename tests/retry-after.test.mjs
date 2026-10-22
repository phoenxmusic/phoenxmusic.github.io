import test from 'node:test';
import assert from 'node:assert/strict';
import { retryAfterDelayMs } from '../scripts/retry-after.mjs';

test('parses Retry-After delta-seconds and caps long waits', () => {
  assert.equal(retryAfterDelayMs('2', 0), 2000);
  assert.equal(retryAfterDelayMs('60', 0), 5000);
  assert.equal(retryAfterDelayMs('0', 0), 0);
});

test('parses Retry-After HTTP-date values', () => {
  const now = Date.parse('Wed, 21 Oct 2026 07:28:00 GMT');
  assert.equal(retryAfterDelayMs('Wed, 21 Oct 2026 07:28:02 GMT', now), 2000);
  assert.equal(retryAfterDelayMs('Wed, 21 Oct 2026 07:29:00 GMT', now), 5000);
  assert.equal(retryAfterDelayMs('Wed, 21 Oct 2026 07:27:00 GMT', now), 0);
});

test('returns null for missing or invalid Retry-After values', () => {
  assert.equal(retryAfterDelayMs(null, 0), null);
  assert.equal(retryAfterDelayMs('', 0), null);
  assert.equal(retryAfterDelayMs('later', 0), null);
  assert.equal(retryAfterDelayMs('-1', 0), null);
});
