/**
 * Shared helpers for the project listing and tag-archive pages.
 *
 * Mirrors `lib/blog` so projects get the same tag conventions (slugging,
 * tag clouds, archives) without the two drifting apart.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

// Re-export the shared tag-slug helpers so callers can import everything
// project-related from one place.
export { tagToSlug, findTagBySlug } from '@/lib/tags';

/** How many of the most-used tags to surface in a project tag cloud. */
export const PROJECT_TAG_CLOUD_LIMIT = 10;

/** Strip the `.md`/`.mdx` extension from a project id to get its URL slug. */
export function getProjectSlug(projectId: string): string {
  return projectId.replace(/\.mdx?$/, '');
}

/** URL path for an individual project. */
export function getProjectUrl(projectId: string): string {
  return `/projects/${getProjectSlug(projectId)}`;
}

/**
 * All visible projects, ordered by their `order` field. Drafts are filtered
 * out in production, kept visible in dev so authors can preview them.
 */
export async function getVisibleProjects(): Promise<CollectionEntry<'projects'>[]> {
  const all = await getCollection('projects', ({ data }) => {
    return import.meta.env.PROD ? data.draft !== true : true;
  });
  return all.sort((a, b) => a.data.order - b.data.order);
}

/** All unique tags across the given projects, alphabetically sorted. */
export function collectProjectTags(projects: CollectionEntry<'projects'>[]): string[] {
  return [...new Set(projects.flatMap((p) => p.data.tags))].sort();
}

/** Tag occurrence counts across the given projects, sorted by count desc then alpha. */
export function collectProjectTagsWithCounts(
  projects: CollectionEntry<'projects'>[]
): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of projects) {
    for (const t of p.data.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** The most-used tags across the given projects, capped at `limit`. */
export function collectTopProjectTags(
  projects: CollectionEntry<'projects'>[],
  limit: number
): string[] {
  return collectProjectTagsWithCounts(projects)
    .slice(0, limit)
    .map((t) => t.tag);
}
