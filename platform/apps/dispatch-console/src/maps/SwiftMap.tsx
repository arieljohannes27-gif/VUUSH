import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { CPT_CENTER, DEFAULT_MAP_STYLE } from "./nav";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: "vehicle" | "pickup" | "dropoff" | "pin";
  live?: boolean;
};

export type MapLine = {
  id: string;
  coords: Array<[number, number]>; // [lng, lat]
};

type Props = {
  className?: string;
  markers?: MapMarker[];
  lines?: MapLine[];
  fitPadding?: number;
  interactive?: boolean;
};

type AnimState = {
  raf: number | null;
  lng: number;
  lat: number;
};

const CAR_SVG = `
<svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true">
  <defs>
    <filter id="carShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#carShadow)">
    <ellipse cx="32" cy="54" rx="14" ry="4" fill="rgba(0,0,0,0.18)"/>
    <path fill="#1B4DFF" d="M16 38c0-2 1-4 3-5l4-10c1-3 4-5 7-5h4c3 0 6 2 7 5l4 10c2 1 3 3 3 5v6c0 2-1 3-3 3h-2c0 3-2 5-5 5s-5-2-5-5H28c0 3-2 5-5 5s-5-2-5-5h-2c-2 0-3-1-3-3v-6z"/>
    <path fill="#D6E4FF" d="M24 24h16l3 8H21l3-8z"/>
    <circle cx="23" cy="47" r="4" fill="#1A1A1A"/>
    <circle cx="41" cy="47" r="4" fill="#1A1A1A"/>
    <circle cx="23" cy="47" r="1.6" fill="#E8EEF5"/>
    <circle cx="41" cy="47" r="1.6" fill="#E8EEF5"/>
  </g>
</svg>`;

function bearingDeg(fromLng: number, fromLat: number, toLng: number, toLat: number) {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function makeElement(kind: MapMarker["kind"], live?: boolean): HTMLDivElement {
  const el = document.createElement("div");
  if (kind === "vehicle") {
    el.className = `swift-map-car${live ? " is-live" : " is-frozen"}`;
    el.innerHTML = CAR_SVG;
    el.style.width = "36px";
    el.style.height = "36px";
    el.style.display = "grid";
    el.style.placeItems = "center";
    el.style.transition = "filter 200ms ease";
    if (!live) {
      el.style.filter = "grayscale(0.85) opacity(0.85)";
    }
    return el;
  }

  el.className = `swift-map-marker swift-map-marker--${kind}`;
  el.style.width = kind === "pin" ? "12px" : "14px";
  el.style.height = kind === "pin" ? "12px" : "14px";
  el.style.borderRadius = kind === "pickup" || kind === "dropoff" ? "3px" : "50%";
  el.style.background = kind === "pin" ? "#6B7280" : "#1A1A1A";
  el.style.border = "2px solid #fff";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,.35)";
  return el;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function SwiftMap({
  className,
  markers = [],
  lines = [],
  fitPadding = 56,
  interactive = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const animRef = useRef<Map<string, AnimState>>(new Map());
  const fittedKeyRef = useRef<string>("");
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_MAP_STYLE,
      center: CPT_CENTER,
      zoom: 12,
      attributionControl: { compact: true },
      interactive,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(containerRef.current);
    // First paint after layout settles
    requestAnimationFrame(() => map.resize());

    return () => {
      ro.disconnect();
      for (const anim of animRef.current.values()) {
        if (anim.raf != null) cancelAnimationFrame(anim.raf);
      }
      animRef.current.clear();
      for (const m of markersRef.current.values()) m.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const moveVehicle = (
      id: string,
      marker: maplibregl.Marker,
      toLng: number,
      toLat: number,
      live: boolean,
    ) => {
      const prev = animRef.current.get(id);
      const fromLng = prev?.lng ?? marker.getLngLat().lng;
      const fromLat = prev?.lat ?? marker.getLngLat().lat;

      if (prev?.raf != null) cancelAnimationFrame(prev.raf);

      const dist =
        Math.hypot(toLng - fromLng, toLat - fromLat) * 111_000; // ~meters

      // Tiny jitter or frozen → snap
      if (!live || reducedMotion || dist < 2) {
        marker.setLngLat([toLng, toLat]);
        animRef.current.set(id, { raf: null, lng: toLng, lat: toLat });
        return;
      }

      const heading = bearingDeg(fromLng, fromLat, toLng, toLat);
      const el = marker.getElement();
      const svg = el.querySelector("svg");
      if (svg) {
        (svg as SVGElement).style.transform = `rotate(${heading}deg)`;
        (svg as SVGElement).style.transformOrigin = "50% 50%";
        (svg as SVGElement).style.transition = reducedMotion
          ? "none"
          : "transform 280ms ease";
      }

      const duration = Math.min(2400, Math.max(600, dist * 8));
      const started = performance.now();

      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / duration);
        const e = easeInOut(t);
        const lng = fromLng + (toLng - fromLng) * e;
        const lat = fromLat + (toLat - fromLat) * e;
        marker.setLngLat([lng, lat]);
        if (t < 1) {
          const raf = requestAnimationFrame(tick);
          animRef.current.set(id, { raf, lng, lat });
        } else {
          animRef.current.set(id, { raf: null, lng: toLng, lat: toLat });
        }
      };

      const raf = requestAnimationFrame(tick);
      animRef.current.set(id, { raf, lng: fromLng, lat: fromLat });
    };

    const apply = () => {
      for (const line of lines) {
        const sourceId = `line-${line.id}`;
        const layerId = `line-layer-${line.id}`;
        const data: GeoJSON.Feature = {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: line.coords,
          },
        };
        if (map.getSource(sourceId)) {
          (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data);
        } else {
          map.addSource(sourceId, { type: "geojson", data });
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": "#1B4DFF",
              "line-width": 3.5,
              "line-opacity": 0.85,
            },
          });
        }
      }

      const seen = new Set<string>();
      for (const m of markers) {
        seen.add(m.id);
        let marker = markersRef.current.get(m.id);
        if (!marker) {
          const el = makeElement(m.kind, m.live);
          marker = new maplibregl.Marker({ element: el, rotationAlignment: "map" })
            .setLngLat([m.lng, m.lat])
            .addTo(map);
          markersRef.current.set(m.id, marker);
          animRef.current.set(m.id, { raf: null, lng: m.lng, lat: m.lat });
        } else if (m.kind === "vehicle") {
          const el = marker.getElement();
          el.className = `swift-map-car${m.live ? " is-live" : " is-frozen"}`;
          el.style.filter = m.live ? "" : "grayscale(0.85) opacity(0.85)";
          moveVehicle(m.id, marker, m.lng, m.lat, Boolean(m.live));
        } else {
          marker.setLngLat([m.lng, m.lat]);
        }
      }

      for (const [id, marker] of markersRef.current) {
        if (!seen.has(id)) {
          const anim = animRef.current.get(id);
          if (anim?.raf != null) cancelAnimationFrame(anim.raf);
          animRef.current.delete(id);
          marker.remove();
          markersRef.current.delete(id);
        }
      }

      // Fit around stops + vehicle once per stop set (avoid re-zoom every ping)
      const fitKey = markers
        .filter((m) => m.kind !== "vehicle")
        .map((m) => `${m.id}:${m.lat.toFixed(4)},${m.lng.toFixed(4)}`)
        .join("|");
      if (fitKey && fitKey !== fittedKeyRef.current) {
        fittedKeyRef.current = fitKey;
        const bounds = new maplibregl.LngLatBounds();
        let has = false;
        for (const m of markers) {
          bounds.extend([m.lng, m.lat]);
          has = true;
        }
        for (const line of lines) {
          for (const c of line.coords) {
            bounds.extend(c);
            has = true;
          }
        }
        if (has) {
          map.fitBounds(bounds, {
            padding: fitPadding,
            maxZoom: 15,
            duration: reducedMotion ? 0 : 400,
          });
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [markers, lines, fitPadding, reducedMotion]);

  return <div ref={containerRef} className={className ?? "swift-map"} />;
}
