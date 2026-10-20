"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { GeocodeResult } from "@/lib/geocode";

type Props = {
  initialQuery: string | null;
  error: string | null;
  locating: boolean;
  onSearch(query: string, hit?: GeocodeResult): void;
  onNearMe(): void;
};

export const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  { initialQuery, error, locating, onSearch, onNearMe },
  inputRef,
) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const listId = useId();
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?suggest=1&q=${encodeURIComponent(query)}`);
        if (res.ok) setSuggestions(((await res.json()) as { suggestions: GeocodeResult[] }).suggestions);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [query]);

  return (
    <div className="relative">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSuggestions([]);
          if (query.trim()) onSearch(query.trim());
        }}
      >
        <label htmlFor="location-search" className="sr-only">
          Search a city, address or ZIP
        </label>
        <input
          ref={inputRef}
          id="location-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City, address or ZIP"
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={error ? `${listId}-err` : undefined}
          aria-controls={suggestions.length ? listId : undefined}
          className="h-11 min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 text-base shadow-md outline-none focus:border-[#0d5eaf]"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-full bg-[#0d5eaf] px-4 font-medium text-white shadow-md"
        >
          Search
        </button>
        <button
          type="button"
          onClick={onNearMe}
          disabled={locating}
          className="h-11 shrink-0 rounded-full border border-slate-300 bg-white px-4 font-medium text-slate-800 shadow-md disabled:opacity-60"
        >
          {locating ? "Locating…" : "Near me"}
        </button>
      </form>
      {suggestions.length > 0 && (
        <ul className="absolute inset-x-0 top-12 z-20 overflow-hidden rounded-xl bg-white shadow-lg" role="listbox" id={listId}>
          {suggestions.map((s) => (
            <li key={`${s.lat},${s.lng}`}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="block w-full truncate px-4 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setQuery(s.label);
                  setSuggestions([]);
                  onSearch(s.label, s);
                }}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={`${listId}-err`} role="alert" data-testid="search-error" className="mt-2 rounded-lg bg-white/95 px-3 py-1.5 text-sm text-red-700 shadow">
          {error}
        </p>
      )}
    </div>
  );
});
