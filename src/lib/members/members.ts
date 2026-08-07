/**
 * Who may sign in.
 *
 * The list lives in `src/config/members.config.ts`, so adding a member is a
 * line and a deploy — and the history of who had access, and when, is the
 * repository's history.
 */

import membersConfig, { type Member } from '@/config/members.config';

/** Addresses are compared lowercased and trimmed; nothing else is normalised. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Is one-click demo sign-in on?
 *
 * MEMBERS_DEMO is how astrorocket.dev runs the demo from the repository the
 * theme ships from. Committing `demo: true` would turn an open door on for
 * everyone who clones it.
 */
export function demoEnabled(): boolean {
  return membersConfig.demo === true || import.meta.env.MEMBERS_DEMO === 'true';
}

/**
 * The list in force.
 *
 * In demo mode the demo list, so the real one can ship empty and a site that
 * enables the feature grants nobody access by accident.
 */
export function activeMembers(): Member[] {
  return demoEnabled() ? membersConfig.demoMembers : membersConfig.members;
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
