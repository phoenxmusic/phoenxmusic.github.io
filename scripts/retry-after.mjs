// Parse the two Retry-After formats defined by HTTP: delta-seconds and HTTP-date.
// Return null for invalid values so callers can use their bounded backoff.
export function retryAfterDelayMs(value, now = Date.now(), maxDelayMs = 5000) {
  if (typeof value !== 'string' || !value.trim()) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(maxDelayMs, seconds * 1000);
  }
  // Do not reinterpret invalid delta-seconds (especially negatives) as dates.
  if (/^[-+]?\d+(?:\.\d+)?$/.test(value.trim())) return null;

  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.min(maxDelayMs, Math.max(0, date - now));
}
