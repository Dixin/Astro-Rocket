/**
 * Who may sign in.
 *
 * The list lives in `src/config/members.config.ts`, so adding a member is a
 * line and a deploy — and the history of who had access, and when, is the
 * repository's history.
 */

import membersConfig, { type Member } from '@/config/members.config';
import { demoEnabled, DEMO_MEMBER } from './demo';

/** Addresses are compared lowercased and trimmed; nothing else is normalised. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The list in force.
 *
 * A site's own members, except on the demo — where the one demo identity
 * stands in, so the real list can ship empty and a site that enables the
 * feature grants nobody access by accident.
 */
export function activeMembers(): Member[] {
  return demoEnabled() ? [DEMO_MEMBER] : membersConfig.members;
}

/** The member with this address, or null. */
export function findMember(email: string): Member | null {
  const wanted = normaliseEmail(email);
  return activeMembers().find((m) => normaliseEmail(m.email) === wanted) ?? null;
}

/**
 * The tiers a member holds.
 *
 * A site with no tiers configured gives every member an empty list, and
 * `access: members` is then satisfied by being signed in at all.
 */
export function tiersFor(member: Member): string[] {
  return member.tiers ?? [];
}

/**
 * Is this session allowed at content marked with `required`?
 *
 * `'members'` means any signed-in member. Anything else names a tier, and the
 * session has to hold it. The check reads the session's own tiers and never
 * the member list, so a session issued by a future sign-in method that has no
 * entry in that list still works.
 */
export function isEntitled(sessionTiers: string[], required: string): boolean {
  if (required === 'members') return true;
  return sessionTiers.includes(required);
}
