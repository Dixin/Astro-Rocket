/**
 * A brake on the sign-in endpoint.
 *
 * Without one, anyone can post that form in a loop: a member's inbox fills
 * with links they did not ask for, the site's Resend quota drains, and the
 * sending domain's reputation goes with it.
 *
 * In memory, per instance, on purpose. A shared counter would need a store,
 * and this whole feature exists to work without one. Be honest about what
 * that buys: on a serverless host each cold instance starts with an empty
 * map, so a determined attacker spreading requests across instances gets more
 * through than the numbers below suggest. It stops the loop from one browser,
 * which is the case that actually happens, and it costs nothing.
 *
 * A site that needs a real limiter should put it in front — Vercel's firewall,
 * Cloudflare's rate limiting — where it belongs.
 */

interface Bucket {
  count: number;
  /** When this window ends, ms since the epoch. */
  resets: number;
}

const buckets = new Map<string, Bucket>();

/** Requests allowed per key within a window. */
const LIMIT = 5;
const WINDOW_MS = 60_000;

/**
 * Drop expired buckets so the map cannot grow without bound on a long-lived
 * instance. Cheap: it runs only when a new key arrives, over a map that stays
 * small by construction.
 */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resets <= now) buckets.delete(key);
  }
}

/**
 * Record an attempt. Returns false when this key has had enough.
 *
 * Key on the address rather than the IP: an address is what an attacker is
 * targeting, and it is stable where an IP is not. It also means one person
 * behind a shared connection cannot lock out everyone else on it.
 */
export function allowRequest(key: string, now: number = Date.now()): boolean {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resets <= now) {
    sweep(now);
    buckets.set(key, { count: 1, resets: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= LIMIT) return false;

  bucket.count += 1;
  return true;
}

/** Test seam. Never called by the app. */
export function resetRateLimit(): void {
  buckets.clear();
}
