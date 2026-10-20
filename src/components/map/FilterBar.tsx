"use client";

import type { Taxonomy } from "@/lib/directory";

type Props = {
  taxonomy: Taxonomy;
  groups: string[];
  categories: string[];
  onChange(next: { groups: string[]; categories: string[] }): void;
};

export function FilterBar({ taxonomy, groups, categories, onChange }: Props) {
  const toggleGroup = (slug: string) =>
    onChange({ groups: groups.includes(slug) ? groups.filter((g) => g !== slug) : [...groups, slug], categories });
  const active = groups.length + categories.length > 0;
  const categoryName = (slug: string) =>
    taxonomy.flatMap((g) => g.categories).find((c) => c.slug === slug)?.name ?? slug;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" data-testid="filter-bar">
      <label className="sr-only" htmlFor="category-picker">
        Filter by category
      </label>
      <select
        id="category-picker"
        className="h-9 shrink-0 rounded-full border border-slate-300 bg-white px-3 text-sm shadow-sm"
        value=""
        onChange={(e) => {
          const slug = e.target.value;
          if (slug && !categories.includes(slug)) onChange({ groups, categories: [...categories, slug] });
        }}
      >
        <option value="">Category…</option>
        {taxonomy.map((g) => (
          <optgroup key={g.slug} label={g.name}>
            {g.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name === "Other" ? `Other ${g.name}` : c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {categories.map((slug) => (
        <button
          key={slug}
          type="button"
          onClick={() => onChange({ groups, categories: categories.filter((c) => c !== slug) })}
          className="h-9 shrink-0 rounded-full bg-[#0d5eaf] px-3 text-sm text-white shadow-sm"
          aria-label={`Remove ${categoryName(slug)} filter`}
        >
          {categoryName(slug)} ✕
        </button>
      ))}

      {taxonomy
        .filter((g) => g.slug !== "other")
        .map((g) => {
          const on = groups.includes(g.slug);
          return (
            <button
              key={g.slug}
              type="button"
              aria-pressed={on}
              onClick={() => toggleGroup(g.slug)}
              className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-sm shadow-sm ${
                on ? "border-[#0d5eaf] bg-[#0d5eaf] text-white" : "border-slate-300 bg-white text-slate-800"
              }`}
            >
              {g.name}
            </button>
          );
        })}

      {active && (
        <button
          type="button"
          onClick={() => onChange({ groups: [], categories: [] })}
          className="h-9 shrink-0 px-2 text-sm text-slate-600 underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
