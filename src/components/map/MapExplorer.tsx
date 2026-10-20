"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BusinessDetail } from "@/components/BusinessDetail";
import {
  DETAIL_SELECT,
  toBusinessDetail,
  type BusinessDetailData,
  type BusinessInView,
  type Taxonomy,
} from "@/lib/directory";
import type { GeocodeResult } from "@/lib/geocode";
import { parseMapState, serializeMapState, type LngLat, type MapState } from "@/lib/map-state";
import { createClient } from "@/lib/supabase/browser";
import { FilterBar } from "./FilterBar";
import { MapView, type Bounds, type MapViewHandle, type ViewChange } from "./MapView";
import { ResultsList } from "./ResultsList";
import { SearchBar } from "./SearchBar";

type RefPoint = { point: LngLat; kind: "me" | "search" };

export function MapExplorer({ taxonomy, initialSearch }: { taxonomy: Taxonomy; initialSearch: string }) {
  const [initial] = useState(() => parseMapState(new URLSearchParams(initialSearch)));
  const [state, setState] = useState<MapState>(initial);
  const [refPoint, setRefPoint] = useState<RefPoint | null>(
    initial.ref ? { point: initial.ref, kind: initial.query ? "search" : "me" } : null,
  );
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [items, setItems] = useState<BusinessInView[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BusinessDetailData | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const mapRef = useRef<MapViewHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const supabase = useRef(createClient()).current;

  // Mirror state into the URL (without a navigation) so the view can be shared.
  useEffect(() => {
    const qs = serializeMapState({ ...state, ref: refPoint?.point ?? null }).toString();
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, [state, refPoint]);

  // Load businesses for the visible area whenever the view, filters or reference point change.
  useEffect(() => {
    if (!bounds) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const ref = refPoint?.point ?? state.center;
      const { data, error } = await supabase.rpc("businesses_in_view", {
        min_lng: bounds.minLng,
        min_lat: bounds.minLat,
        max_lng: bounds.maxLng,
        max_lat: bounds.maxLat,
        ref_lng: ref.lng,
        ref_lat: ref.lat,
        category_slugs: state.categories,
        group_slugs: state.groups,
        max_results: 500,
      });
      if (cancelled) return;
      setItems(error ? [] : data);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bounds, refPoint, state.center, state.categories, state.groups, supabase]);

  // Load the selected business's details.
  useEffect(() => {
    if (!state.selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("businesses")
      .select(DETAIL_SELECT)
      .eq("slug", state.selected)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setDetail(data ? toBusinessDetail(data) : null);
      });
    return () => {
      cancelled = true;
    };
  }, [state.selected, supabase]);

  const onViewChange = useCallback((v: ViewChange) => {
    setBounds(v.bounds);
    setState((s) => ({ ...s, center: v.center, zoom: v.zoom }));
  }, []);

  const select = useCallback((slug: string | null) => {
    setState((s) => ({ ...s, selected: slug }));
    if (slug) setSheetOpen(true);
  }, []);

  const onSelect = useCallback(
    (slug: string) => {
      select(slug);
      const hit = items.find((b) => b.slug === slug);
      if (hit) mapRef.current?.flyTo({ lat: hit.lat, lng: hit.lng });
    },
    [items, select],
  );

  const onSearch = async (query: string, hit?: GeocodeResult) => {
    setSearchError(null);
    let place = hit;
    if (!place) {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (res.status === 404) return setSearchError(`Location not found: “${query}”`);
      if (!res.ok) return setSearchError("Location search is unavailable right now. Please try again.");
      place = (await res.json()) as GeocodeResult;
    }
    const point = { lat: place.lat, lng: place.lng };
    setRefPoint({ point, kind: "search" });
    setState((s) => ({ ...s, query, selected: null }));
    mapRef.current?.flyTo(point, 12);
  };

  const onNearMe = () => {
    setSearchError(null);
    if (!("geolocation" in navigator)) {
      setSearchError("Your browser can't share your location. Type a city, address or ZIP instead.");
      searchRef.current?.focus();
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setRefPoint({ point, kind: "me" });
        setState((s) => ({ ...s, query: null, selected: null }));
        mapRef.current?.flyTo(point, 12);
      },
      () => {
        setLocating(false);
        setSearchError("We couldn't get your location. Type a city, address or ZIP instead.");
        searchRef.current?.focus();
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      <MapView
        ref={mapRef}
        initialCenter={initial.center}
        initialZoom={initial.zoom}
        businesses={items}
        selected={state.selected}
        refPoint={refPoint}
        onViewChange={onViewChange}
        onSelect={onSelect}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-2 p-3 md:left-[392px] md:right-auto md:w-[min(720px,calc(100vw-408px))]">
        <div className="pointer-events-auto">
          <SearchBar
            ref={searchRef}
            initialQuery={state.query}
            error={searchError}
            locating={locating}
            onSearch={onSearch}
            onNearMe={onNearMe}
          />
        </div>
        <div className="pointer-events-auto">
          <FilterBar
            taxonomy={taxonomy}
            groups={state.groups}
            categories={state.categories}
            onChange={(f) => setState((s) => ({ ...s, ...f, selected: null }))}
          />
        </div>
      </div>

      <aside
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl bg-white shadow-2xl transition-[max-height] md:inset-y-0 md:left-0 md:right-auto md:w-[380px] md:max-h-none md:rounded-none ${
          sheetOpen ? "max-h-[50vh]" : "max-h-14"
        }`}
        aria-label="Results"
        data-testid="results-panel"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <button
            type="button"
            className="flex items-center gap-2 md:pointer-events-none"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
          >
            <span className="mx-auto h-1 w-8 rounded-full bg-slate-300 md:hidden" aria-hidden />
            <span className="font-semibold text-slate-900">
              {detail ? "Business" : loading ? "Loading…" : `${items.length} nearby`}
            </span>
          </button>
          <div className="flex items-center gap-3 text-sm">
            {detail ? (
              <button type="button" className="text-[#0d5eaf] underline" onClick={() => select(null)}>
                ← Back to list
              </button>
            ) : (
              <Link href="/submit" className="font-medium text-[#0d5eaf] underline">
                Add a business
              </Link>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {detail ? (
            <div className="p-4">
              <BusinessDetail business={detail} />
              <p className="mt-4 text-sm">
                <Link href={`/b/${detail.slug}`} className="text-slate-600 underline">
                  Open full page
                </Link>
              </p>
            </div>
          ) : (
            <ResultsList items={items} selected={state.selected} loading={loading} onSelect={onSelect} />
          )}
        </div>
      </aside>
    </div>
  );
}
