/**
 * Which content is gated, and who may read it.
 *
 * One rule decides three different questions — what a listing shows, what the
 * feed and the search index carry, and what a request is allowed to render —
 * so they cannot drift apart and leave a post visible in one place and hidden
 * in another.
 */

import membersConfig from '@/config/members.config';
import { isEntitled } from './members';
import { demoEnabled } from './demo';
import type { MemberSession } from './session';

/**
 * Is the members area on for this build?
 *
 * Mirrors the check in the integration in astro.config.mjs. MEMBERS_ENABLED
 * is how astrorocket.dev runs the feature while the theme ships it off;
 * `import.meta.env` is used here because this runs inside the app rather than
 * in the config.
 */
export function membersEnabled(): boolean {
  return membersConfig.enabled === true || import.meta.env.MEMBERS_ENABLED === 'true';
}

/** The access level an entry asks for, or null when it is public. */
export function accessOf(data: { access?: string }): string | null {
  const access = data.access?.trim();
  if (!access || access === 'public') return null;
  return access;
}

export function isGated(data: { access?: string }): boolean {
  return accessOf(data) !== null;
}

/**
 * Should this entry be visible at all?
 *
 * With the feature off, gated entries are hidden everywhere — no listing, no
 * feed, no search result, no route. Publishing them instead would turn the
 * switch into a way of exposing exactly the content someone had chosen to
 * protect.
 */
export function isVisible(data: { access?: string; demoOnly?: boolean }): boolean {
  // Demo content belongs to astrorocket.dev. It must not appear on a user's
  // site when they enable the members area — see the schema note on demoOnly.
  if (data.demoOnly && !demoEnabled()) return false;
  if (!isGated(data)) return true;
  return membersEnabled();
}

/** May this session read an entry with this access level? */
export function canRead(session: MemberSession | null, data: { access?: string }): boolean {
  const required = accessOf(data);
  if (required === null) return true;
  if (!session) return false;
  return isEntitled(session.tiers, required);
}

/** Drop what the current state says nobody should see. */
export function visibleEntries<T extends { data: { access?: string; demoOnly?: boolean } }>(
  entries: T[]
): T[] {
  return entries.filter((entry) => isVisible(entry.data));
}

/**
 * Entries that must not be prerendered.
 *
 * A gated entry is rendered on demand so the guard can run per request —
 * middleware runs at build time for prerendered pages, which would decide
 * once, at build, for everyone. The detail routes exclude these from
 * `getStaticPaths`, and the integration injects a route for each one at the
 * same URL.
 */
export function gatedEntries<T extends { data: { access?: string } }>(entries: T[]): T[] {
  return entries.filter((entry) => isGated(entry.data));
}

/** Entries safe to prerender: public, or hidden entirely. */
export function publicEntries<T extends { data: { access?: string } }>(entries: T[]): T[] {
  return entries.filter((entry) => !isGated(entry.data));
}
