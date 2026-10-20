"use client";

import { Map as MlMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { BusinessInView } from "@/lib/directory";
import { BRAND_BLUE, mapStyleUrl } from "@/lib/map-style";
import type { LngLat } from "@/lib/map-state";

export type Bounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };
export type ViewChange = { center: LngLat; zoom: number; bounds: Bounds };

export type MapViewHandle = {
  flyTo(center: LngLat, zoom?: number): void;
};

type Props = {
  initialCenter: LngLat;
  initialZoom: number;
  businesses: BusinessInView[];
  selected: string | null;
  refPoint: { point: LngLat; kind: "me" | "search" } | null;
  onViewChange(view: ViewChange): void;
  onSelect(slug: string): void;
};

const SOURCE = "businesses";

// Copied into /public by scripts/copy-maplibre-worker.mjs.
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

export const MapView = forwardRef<MapViewHandle, Props>(function MapView(
  { initialCenter, initialZoom, businesses, selected, refPoint, onViewChange, onSelect },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const loaded = useRef(false);
  const refMarker = useRef<Marker | null>(null);
  // Keep latest callbacks/data reachable from map event handlers without re-creating the map.
  const latest = useRef({ onViewChange, onSelect, businesses, selected });
  latest.current = { onViewChange, onSelect, businesses, selected };

  useImperativeHandle(ref, () => ({
    flyTo(center, zoom) {
      map.current?.flyTo({
        center: [center.lng, center.lat],
        zoom: zoom ?? Math.max(map.current.getZoom(), 12),
        maxDuration: 2000,
      });
    },
  }));

  useEffect(() => {
    const m = new MlMap({
      container: container.current!,
      style: mapStyleUrl(),
      center: [initialCenter.lng, initialCenter.lat],
      zoom: initialZoom,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    // Test hook for Playwright (set NEXT_PUBLIC_E2E=1 at build time).
    if (process.env.NEXT_PUBLIC_E2E === "1") (window as unknown as { __map: MlMap }).__map = m;

    const emitView = () => {
      const b = m.getBounds();
      const c = m.getCenter();
      latest.current.onViewChange({
        center: { lat: c.lat, lng: c.lng },
        zoom: m.getZoom(),
        bounds: { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() },
      });
    };

    m.on("load", () => {
      m.addSource(SOURCE, {
        type: "geojson",
        data: toGeoJson(latest.current.businesses),
        cluster: true,
        clusterRadius: 45,
        clusterMaxZoom: 14,
      });
      m.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": BRAND_BLUE,
          "circle-opacity": 0.85,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });
      m.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE,
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 13, "text-font": ["Noto Sans Bold"] },
        paint: { "text-color": "#ffffff" },
      });
      m.addLayer({
        id: "points",
        type: "circle",
        source: SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": BRAND_BLUE,
          "circle-radius": ["case", ["==", ["get", "slug"], latest.current.selected ?? ""], 11, 7],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      m.on("click", "clusters", async (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const zoom = await (m.getSource(SOURCE) as GeoJSONSource).getClusterExpansionZoom(
          feature.properties.cluster_id as number,
        );
        m.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      m.on("click", "points", (e) => {
        const slug = e.features?.[0]?.properties.slug as string | undefined;
        if (slug) latest.current.onSelect(slug);
      });
      for (const layer of ["clusters", "points"]) {
        m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
      }
      loaded.current = true;
      emitView();
    });
    m.on("moveend", emitView);

    return () => {
      loaded.current = false;
      m.remove();
      map.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    (map.current!.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJson(businesses));
  }, [businesses]);

  useEffect(() => {
    if (!loaded.current) return;
    map.current!.setPaintProperty("points", "circle-radius", ["case", ["==", ["get", "slug"], selected ?? ""], 11, 7]);
  }, [selected]);

  useEffect(() => {
    refMarker.current?.remove();
    refMarker.current = null;
    if (!refPoint || !map.current) return;
    const el = document.createElement("div");
    el.className = refPoint.kind === "me" ? "hm-you-are-here" : "hm-search-pin";
    el.setAttribute("aria-label", refPoint.kind === "me" ? "You are here" : "Searched location");
    el.dataset.testid = "ref-marker";
    refMarker.current = new Marker({ element: el })
      .setLngLat([refPoint.point.lng, refPoint.point.lat])
      .addTo(map.current);
  }, [refPoint]);

  // MapLibre sets `position: relative` on its container, so position a wrapper instead.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" data-testid="map" />
    </div>
  );
});

function toGeoJson(items: BusinessInView[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: items.map((b) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [b.lng, b.lat] },
      properties: { slug: b.slug, name: b.name },
    })),
  };
}
