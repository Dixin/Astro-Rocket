/**
 * Members area — configuration.
 *
 * OFF BY DEFAULT. With `enabled: false` the integration in astro.config.mjs
 * registers no routes at all, so the build is identical to a site that does
 * not have this file: no member pages, and no serverless function where the
 * site previously had none.
 *
 * Turn it on and it is your members area, working, with your people and your
 * content. Nothing here is a sample and nothing has to be deleted first —
 * the demo that runs on astrorocket.dev is driven entirely by an environment
 * variable and cannot appear on a site that does not set one. See
 * `src/lib/members/demo.ts`.
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
   * The tiers this site uses, in no particular order. Leave empty for a site
   * where every member sees the same thing — `access: members` then covers
   * everything and the word "tier" never appears in the project.
   */
  tiers: string[];
  /**
   * Who may sign in.
   *
   * There is no signup: an address that is not here gets no link, however
   * many times it is typed. Someone becomes a member when you add them and
   * deploy, which is also what puts the record of who had access, and when,
   * into your git history.
   */
  members: Member[];
}

const membersConfig: MembersConfig = {
  enabled: false,
  prefix: '/members',
  sessionDays: 30,
  linkMinutes: 15,
  tiers: [],
  members: [],
};

export default membersConfig;
