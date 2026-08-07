/**
 * The member session — a signed cookie and nothing else.
 *
 * There is no session table. The cookie carries who the visitor is and what
 * they hold, signed so it cannot be edited, and the server keeps no record of
 * it. That is what lets the members area run with no database.
 *
 * The trade-off is honest and worth knowing: a session cannot be revoked
 * server-side before it expires. Removing someone from `members.config.ts`
 * stops them signing in again and locks them out of every page the guard
 * checks against the member list, but a cookie already issued stays valid for
 * its remaining life. Keep `sessionDays` short if that matters.
 */

import type { AstroCookies } from 'astro';
import { stamp, unstamp, encodeText, decodeText } from './crypto';
import membersConfig from '@/config/members.config';

export const SESSION_COOKIE = 'ar_member';

/**
 * What the cookie carries.
 *
 * `sub` is a subject, not an email. Today it is always an address, but a
 * second sign-in method — an access code, say — would have no address to put
 * here, and every consumer reading `sub` as "the member's email" would break.
 * `kind` says what `sub` means.
 *
 * Access decisions read `tiers` and never the member list, for the same
 * reason.
 */
export interface MemberSession {
  /** Who this is. An email address when `kind` is 'email'. */
  sub: string;
  /** How they signed in. */
  kind: 'email' | 'demo';
  /** Tiers held at the moment the session was created. */
  tiers: string[];
  /** Expiry, seconds since the epoch. */
  exp: number;
}

/**
 * The signing secret.
 *
 * Throws rather than falling back to a default. A members area running on a
 * guessable secret is a gate anyone can forge a key for, and it would look
 * like it was working the whole time.
 */
export function sessionSecret(): string {
  const secret = import.meta.env.MEMBERS_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'MEMBERS_SESSION_SECRET is missing or shorter than 32 characters. The ' +
        'members area cannot sign sessions without it. Generate one with ' +
        '`openssl rand -base64 32` and set it in your environment.'
    );
  }
  return secret;
}

export async function createSession(
  cookies: AstroCookies,
  session: Omit<MemberSession, 'exp'>
): Promise<void> {
  const maxAge = membersConfig.sessionDays * 24 * 60 * 60;
  const payload: MemberSession = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  };
  const token = await stamp(encodeText(JSON.stringify(payload)), sessionSecret());

  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true, // never readable from JavaScript
    secure: import.meta.env.PROD, // plain http in local development only
    sameSite: 'lax', // survives the click through from the email
    maxAge,
  });
}

/** The current session, or null if there is none, it is forged, or it expired. */
export async function readSession(cookies: AstroCookies): Promise<MemberSession | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let payload: string | null;
  try {
    payload = await unstamp(token, sessionSecret());
  } catch {
    return null;
  }
  if (!payload) return null;

  try {
    const session = JSON.parse(decodeText(payload)) as MemberSession;
    if (typeof session.exp !== 'number' || session.exp * 1000 < Date.now()) return null;
    if (typeof session.sub !== 'string' || !Array.isArray(session.tiers)) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearSession(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
