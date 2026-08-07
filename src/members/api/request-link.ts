export const prerender = false;

/**
 * Ask for a sign-in link.
 *
 * Answers the same way whether or not the address is on the member list. A
 * different response would turn this endpoint into a way to test which
 * addresses belong to members, which is worth more to an attacker than it
 * sounds — it confirms who a site's clients are.
 */

import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import membersConfig from '@/config/members.config';
import { issueToken, deliverLink } from '@/lib/members/magic-link';

const schema = z.object({
  email: z.email(),
  /** Anti-spam: must be empty, matching the contact and newsletter forms. */
  honeypot: z.string().max(0),
});

export const POST: APIRoute = async ({ request, url, redirect }) => {
  const form = await request.formData();
  const parsed = schema.safeParse({
    email: form.get('email')?.toString() ?? '',
    honeypot: form.get('honeypot')?.toString() ?? '',
  });

  const sent = redirect(`${membersConfig.prefix}/check-email`, 303);
  if (!parsed.success) {
    return redirect(`${membersConfig.prefix}/login?error=email`, 303);
  }

  const token = await issueToken(parsed.data.email);
  // No member with that address. Say the link is on its way regardless.
  if (!token) return sent;

  const link = new URL(`${membersConfig.prefix}/verify`, url.origin);
  link.searchParams.set('token', token);

  try {
    await deliverLink(parsed.data.email, link.toString());
  } catch {
    return redirect(`${membersConfig.prefix}/login?error=send`, 303);
  }
  return sent;
};
