import type { SourceCategory } from "./parse";

export const FALLBACK_CATEGORY = "other";

// Restaurant meal-time tags describe *when*, not *what*; never pick them as the primary category
// when something more specific is available.
const LOW_PRIORITY = new Set(["breakfast", "lunch", "dinner", "coffee", "bar"]);

export type CategoryMapping = {
  /** Our category slugs, primary first. */
  categories: string[];
  /** Source slugs that had no mapping (assigned to FALLBACK_CATEGORY). */
  unmapped: string[];
};

/**
 * Maps a listing's source category slugs to our category slugs.
 * A source parent (group) tag is dropped when the listing also has one of its children,
 * because WP Job Manager listings are usually tagged with both.
 */
export function mapCategories(
  sourceSlugs: string[],
  taxonomy: SourceCategory[],
  sourceMap: ReadonlyMap<string, string>,
): CategoryMapping {
  const bySlug = new Map(taxonomy.map((c) => [c.slug, c]));
  const present = new Set(sourceSlugs);
  const parentsWithChildren = new Set(
    sourceSlugs.map((s) => bySlug.get(s)).filter((c) => c && c.parent !== 0).map((c) => c!.parent),
  );

  const categories: string[] = [];
  const unmapped: string[] = [];
  for (const slug of present) {
    const term = bySlug.get(slug);
    if (term && term.parent === 0 && parentsWithChildren.has(term.id)) continue;
    const ours = sourceMap.get(slug);
    if (!ours) unmapped.push(slug);
    const target = ours ?? FALLBACK_CATEGORY;
    if (!categories.includes(target)) categories.push(target);
  }
  if (categories.length === 0) categories.push(FALLBACK_CATEGORY);

  const rank = (slug: string) => (slug === FALLBACK_CATEGORY ? 2 : LOW_PRIORITY.has(slug) ? 1 : 0);
  categories.sort((a, b) => rank(a) - rank(b));
  return { categories, unmapped };
}
