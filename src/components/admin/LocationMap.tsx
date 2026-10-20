"use client";

import { Map as MlMap, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { BRAND_BLUE, mapStyleUrl } from "@/lib/map-style";
import type { LngLat } from "@/lib/map-state";

setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

type Props = {
  point: LngLat | null;
  /** When set, the pin is draggable and clicking the map moves it. */
  onChange?(point: LngLat): void;
  className?: string;
};

// Fallback view when a submission has no location yet: the contiguous US.
const US_CENTER = { lat: 39.5, lng: -98.35 };

export function LocationMap({ point, onChange, className = "h-48" }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const marker = useRef<Marker | null>(null);
  const map = useRef<MlMap | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const start = point ?? US_CENTER;
    const m = new MlMap({
      container: container.current!,
      style: mapStyleUrl(),
      center: [start.lng, start.lat],
      zoom: point ? 15 : 3,
      interactive: !!onChange,
      attributionControl: { compact: true },
    });
    map.current = m;
    if (onChange) {
      m.addControl(new NavigationControl({ showCompass: false }), "top-right");
      m.on("click", (e) => onChangeRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    }
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!point) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = new Marker({ color: BRAND_BLUE, draggable: !!onChangeRef.current }).setLngLat([point.lng, point.lat]).addTo(m);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLngLat();
        onChangeRef.current?.({ lat: p.lat, lng: p.lng });
      });
      m.jumpTo({ center: [point.lng, point.lat], zoom: Math.max(m.getZoom(), 15) });
    } else {
      marker.current.setLngLat([point.lng, point.lat]);
    }
  }, [point]);

  return <div ref={container} className={`overflow-hidden rounded-lg border border-slate-200 ${className}`} data-testid="location-map" />;
}
