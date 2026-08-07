/**
 * Members area — configuration.
 *
 * OFF BY DEFAULT. With `enabled: false` the integration in astro.config.mjs
 * registers no routes at all, so the build is identical to a site that does
 * not have this file: no member pages, and no serverless function where the
 * site previously had none. Turning it on is a two-line change here plus one
 * environment variable.
 *
 * The demo at astrorocket.dev runs the feature on while the theme ships it
 * off, through MEMBERS_ENABLED in that deployment's environment. See the
 * integration for how the two combine.
 */

/** A member of the site. Tiers are optional; see `tiers` below. */
export interface Member {
  /** Sign-in address. Compared case-insensitively. */
  email: string;
  /** Shown on the account page. Never used for access decisions. */
  name?: string;
  /**
   * Which tiers this member holds. Omit on a site with no tiers — every
   * member then satisfies `access: members` and nothing else is checked.
   */
  tiers?: string[];
}

export interface MembersConfig {
  /** Master switch — set to true to enable site-wide. */
  enabled: boolean;
  /**
   * URL prefix for every member route. `/members` gives /members/login,
   * /members/account and so on. Leading slash, no trailing slash.
   */
  prefix: string;
  /**
   * How long a member stays signed in, in days. The cookie carries its own
   * expiry, so shortening this only affects sessions created afterwards.
   */
  sessionDays: number;
  /** How long a sign-in link stays valid, in minutes. */
  linkMinutes: number;
  /**
   * One-click sign-in, for a public demo of the feature. It signs the visitor
   * in as the first member below without an email address.
   *
   * NEVER true on a real site: it is an open door by design. It exists so a
   * stranger can see the members area working in ten seconds, and it is what
   * astrorocket.dev uses.
   */
  demo: boolean;
  /**
   * The tiers this site uses, in no particular order. Leave empty for a site
   * where every member sees the same thing — `access: members` then covers
   * everything and the word "tier" never appears in the project.
   */
  tiers: string[];
  /** Who may sign in. */
  members: Member[];
  /**
   * Members used only while `demo` is on, kept apart from `members` so the
   * real list ships empty and a site that enables the feature grants nobody
   * access by accident.
   *
   * This is what lets astrorocket.dev run the demo from the same repository
   * the theme ships from: two environment variables and no edit to this file.
   * Delete these when you make the theme yours.
   */
  demoMembers: Member[];
}

const membersConfig: MembersConfig = {
  enabled: false,
  prefix: '/members',
  sessionDays: 30,
  linkMinutes: 15,
  demo: false,
  tiers: [],
  members: [],
  demoMembers: [
    { email: 'demo@astrorocket.dev', name: 'Demo member', tiers: [] },
  ],
};

export default membersConfig;
