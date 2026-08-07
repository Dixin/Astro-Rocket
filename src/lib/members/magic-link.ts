/**
 * The sign-in link.
 *
 * A link is a signed payload of address, tiers and expiry. Nothing is stored,
 * so the link is valid until it expires rather than until it is used once —
 * single use would need somewhere to record that it had been. `linkMinutes`
 * defaults to 15 for that reason, and the docs say so rather than claiming
 * otherwise.
 *
 * Forwarding is the same risk either way: whoever can read the inbox can sign
 * in, which is true of every emailed link and of password resets too.
 */

import { Resend } from 'resend';
import { stamp, unstamp, encodeText, decodeText } from './crypto';
import { sessionSecret } from './session';
import membersConfig from '@/config/members.config';
import { findMember, normaliseEmail, tiersFor } from './members';
import { t, defaultLocale } from '@/i18n';

interface LinkPayload {
  email: string;
  tiers: string[];
  /** Expiry, seconds since the epoch. */
  exp: number;
  /**
   * Random, and never checked. Two links issued in the same second for the
   * same address would otherwise be the same string, so a link resent after a
   * lost email would be indistinguishable from the first in any log it
   * reached.
   */
  jti: string;
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
}

/** A token for this address, or null if it belongs to nobody on the list. */
export async function issueToken(email: string): Promise<string | null> {
  const member = findMember(email);
  if (!member) return null;

  const payload: LinkPayload = {
    email: normaliseEmail(member.email),
    tiers: tiersFor(member),
    exp: Math.floor(Date.now() / 1000) + membersConfig.linkMinutes * 60,
    jti: randomId(),
  };
  return stamp(encodeText(JSON.stringify(payload)), sessionSecret());
}

/** The address and tiers a token carries, or null if it is bad or expired. */
export async function readToken(
  token: string
): Promise<{ email: string; tiers: string[] } | null> {
  let payload: string | null;
  try {
    payload = await unstamp(token, sessionSecret());
  } catch {
    return null;
  }
  if (!payload) return null;

  try {
    const link = JSON.parse(decodeText(payload)) as LinkPayload;
    if (typeof link.exp !== 'number' || link.exp * 1000 < Date.now()) return null;
    if (typeof link.email !== 'string' || !Array.isArray(link.tiers)) return null;
    return { email: link.email, tiers: link.tiers };
  } catch {
    return null;
  }
}

/**
 * Send the link, or print it.
 *
 * In development it goes to the terminal instead of an inbox, so the members
 * area can be tried with `pnpm dev` and no Resend account: enter an address,
 * read the link in the console, click it. Production sends through Resend and
 * fails loudly if it is not configured, because a sign-in page that silently
 * sends nothing looks identical to one that works.
 */
export async function deliverLink(
  email: string,
  url: string,
  /**
   * The locale of the request that asked for the link.
   *
   * At the moment a link is sent the recipient is not signed in, so there is
   * no stored preference to read. The request already knows: /nl/members/login
   * sends Dutch, /members/login sends English. On a single-locale site this
   * produces the default language with no mechanism and nothing to configure.
   */
  locale: string = defaultLocale
): Promise<void> {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(
      `\n  Members area — sign-in link for ${email}\n  ${url}\n  ` +
        `Valid for ${membersConfig.linkMinutes} minutes. Set RESEND_API_KEY to send these by email.\n`
    );
    return;
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const from = import.meta.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error(
      'RESEND_API_KEY and RESEND_FROM_EMAIL are required to send sign-in links in production.'
    );
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: email,
    subject: t('members.emailSubject', locale),
    text: t('members.emailBody', locale, { url, minutes: membersConfig.linkMinutes }),
  });
}
