/**
 * Showcase Configuration
 *
 * Real sites built with Astro Rocket, rendered on the `/showcase` page.
 * Add an entry to the array below and the page updates on its own — no
 * component edits needed. Screenshots are optional: drop one in
 * `src/assets/showcase/`, import it here, and the card swaps its
 * placeholder for the image.
 *
 * Want your site listed on the theme's own showcase? Open a
 * "Showcase submission" issue: see `showcaseSubmitUrl` below.
 */
import type { ImageMetadata } from 'astro';

export interface ShowcaseEntry {
  /** Site or project name. */
  name: string;
  /** Live production URL. */
  url: string;
  /** Who built it. */
  author: string;
  /** Optional link for the author credit (personal site, LinkedIn, …). */
  authorUrl?: string;
  /** One or two lines about the project, shown on the card. */
  description: string;
  /** Optional screenshot — import from `src/assets/showcase/`. */
  image?: ImageMetadata;
  /** Alt text for the screenshot. */
  imageAlt?: string;
}

/** Where the "Submit your site" button points. */
export const showcaseSubmitUrl =
  'https://github.com/hansmartensdev/Astro-Rocket/issues/new?template=showcase_submission.yml';

/** The theme's repository, linked from the submit section. */
export const showcaseRepoUrl = 'https://github.com/hansmartensdev/Astro-Rocket';

export const showcaseEntries: ShowcaseEntry[] = [
  {
    name: 'LinkPress',
    url: 'https://linkpress.app/',
    author: 'Mithun A. Sridharan',
    description:
      'Publish once, get discovered everywhere — a content-syndication service for businesses, startups, marketers, and non-profits, reaching Google, AI assistants, and LLMs. Built with Astro Rocket, deployed on Cloudflare.',
  },
];
