export const prerender = false;

/**
 * Consume a sign-in link and start the session.
 *
 * The token is re-checked against the member list rather than trusted on its
 * own. A link issued before someone was removed would still carry a valid
 * signature, and letting it through would mean removal did not take effect
 * until the link expired.
 */

import type { APIRoute } from 'astro';
import membersConfig from '@/config/members.config';
import { readToken } from '@/lib/members/magic-link';
import { createSession } from '@/lib/members/session';
import { findMember, tiersFor } from '@/lib/members/members';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect(`${membersConfig.prefix}/login?error=link`, 303);

  const link = await readToken(token);
  if (!link) return redirect(`${membersConfig.prefix}/login?error=link`, 303);

  const member = findMember(link.email);
  if (!member) return redirect(`${membersConfig.prefix}/login?error=link`, 303);

  // Tiers come from the list as it stands now, not from the token, so a change
  // of tier applies to the next sign-in rather than whenever the link was made.
  await createSession(cookies, {
    sub: link.email,
    kind: 'email',
    tiers: tiersFor(member),
  });

  return redirect(membersConfig.prefix, 303);
};
