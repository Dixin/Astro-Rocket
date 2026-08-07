/**
 * Signing and comparison for the members area.
 *
 * Everything here is HMAC-SHA256 over Web Crypto, so it runs unchanged on
 * Vercel, Netlify and Cloudflare — Node's `crypto` module is not available on
 * Cloudflare Workers, and this theme supports all three deploy targets.
 *
 * There is no session store anywhere in this feature. A signed payload IS the
 * session and IS the sign-in link, which is what keeps the members area
 * working with no database.
 */

const encoder = new TextEncoder();

/** base64url — the URL-safe alphabet, no padding. Cookies and links carry it. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeText(value: string): string {
  return toBase64Url(encoder.encode(value));
}

export function decodeText(value: string): string {
  return new TextDecoder().decode(fromBase64Url(value));
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/** HMAC-SHA256 of `data` under `secret`, base64url encoded. */
export async function sign(data: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return toBase64Url(new Uint8Array(mac));
}

/**
 * Compare two strings without leaking their difference through timing.
 *
 * `a === b` returns as soon as two characters differ, so the time it takes
 * reveals how much of a guess was correct — enough to reconstruct a signature
 * one character at a time. This reads every byte of both strings whatever
 * they contain.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  // Length is not a secret, but returning early on it would still shortcut the
  // loop below, so fold it into the same result instead.
  let mismatch = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i++) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
}

/** Sign `payload`, returning `payload.signature`. */
export async function stamp(payload: string, secret: string): Promise<string> {
  return `${payload}.${await sign(payload, secret)}`;
}

/**
 * Verify a `payload.signature` string and return the payload, or null.
 *
 * Null covers every failure — wrong shape, wrong signature, wrong secret — so
 * a caller cannot accidentally distinguish them for an attacker's benefit.
 */
export async function unstamp(token: string, secret: string): Promise<string | null> {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!signature) return null;
  const expected = await sign(payload, secret);
  return timingSafeEqual(signature, expected) ? payload : null;
}
