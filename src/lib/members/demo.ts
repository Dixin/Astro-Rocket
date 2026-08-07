/**
 * The demo, which belongs to astrorocket.dev and to nothing else.
 *
 * A theme user who enables the members area gets a working members area: their
 * people, their gated posts, and none of this. That is the point of keeping
 * every part of the demo here rather than in `members.config.ts` —
 * configuration a user edits should describe their site, not carry a sample
 * they have to find and delete first.
 *
 * It is also the safer arrangement. One-click sign-in is an open door: anyone
 * who posts to `/members/demo-login` is signed in. Driving it from a committed
 * config value would mean a stray `true` could ship that door to a real site,
 * and it would look like a normal config edit in review. An environment
 * variable belongs to one deployment and cannot travel in a commit.
 */

import type { Member } from '@/config/members.config';

/**
 * Is the demo running?
 *
 * True only where MEMBERS_DEMO is set, which is astrorocket.dev. There is
 * deliberately no way to turn this on from `members.config.ts`.
 */
export function demoEnabled(): boolean {
  return import.meta.env.MEMBERS_DEMO === 'true';
}

/**
 * Who a visitor is signed in as on the demo. Not a real address, and never
 * consulted unless `demoEnabled()`.
 */
export const DEMO_MEMBER: Member = {
  email: 'demo@astrorocket.dev',
  name: 'Demo member',
  tiers: [],
};
