export const prerender = false;

/**
 * One-click sign-in for a public demo.
 *
 * This is an open door: anyone who posts to it is signed in as the first
 * configured member. It exists so a visitor to astrorocket.dev can see the
 * members area working without an email address, and it refuses to do
 * anything unless `demo: true` is set, which the theme never ships.
 */

import type { APIRoute } from 'astro';
import membersConfig from '@/config/members.config';
import { createSession } from '@/lib/members/session';
import { normaliseEmail, tiersFor, demoEnabled, activeMembers } from '@/lib/members/members';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  if (!demoEnabled()) return new Response('Not found', { status: 404 });

  const member = activeMembers()[0];
  if (!member) return new Response('No demo member configured', { status: 500 });

  await createSession(cookies, {
    sub: normaliseEmail(member.email),
    kind: 'demo',
    tiers: tiersFor(member),
  });

  return redirect(membersConfig.prefix, 303);
};
