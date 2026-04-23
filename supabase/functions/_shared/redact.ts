/**
 * Log-scrubbing helpers shared across edge functions.
 *
 * `redactHeaders`: returns a shallow copy of a header map with any key outside
 * a small safelist replaced with `[REDACTED]`. Use when dumping `error.config.headers`,
 * `error.response.headers`, or any raw HTTP header bag into logs.
 *
 * `redactSecrets`: regex-replaces tokens that look like Supabase JWTs (starting with
 * `eyJ...`) or service-role keys (starting with `sb_...`) in an already-serialized
 * string. Use on `JSON.stringify(error.config.data)` / `error.response.data` before
 * logging so that accidental secret leakage is scrubbed.
 */

export function redactHeaders(
  headers: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!headers) return {};
  const SAFE = new Set([
    'content-type',
    'user-agent',
    'accept',
    'accept-encoding',
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SAFE.has(key.toLowerCase()) ? value : '[REDACTED]';
  }
  return out;
}

export function redactSecrets(serialized: string): string {
  if (!serialized) return serialized;
  return serialized
    .replace(/eyJ[A-Za-z0-9_\-.]{40,}/g, '[REDACTED_JWT]')
    .replace(/sb_[a-z0-9_]{30,}/g, '[REDACTED_SB]');
}
