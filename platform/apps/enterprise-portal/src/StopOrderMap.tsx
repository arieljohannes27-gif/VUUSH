import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapStop = {
  id: string;
  sequence: number;
  label: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
};

type Props = {
  stops: MapStop[];
};

/** Shows booker stop order on a map — not a smart/optimised route. */
export function StopOrderMap({ stops }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const points = stops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        ...s,
        lat: s.lat as number,
        lng: s.lng as number,
      }));

    if (points.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(host, {
      scrollWheelZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const latLngs: L.LatLngExpression[] = points.map((p) => [p.lat, p.lng]);
    L.polyline(latLngs, {
      color: "#1a1a1a",
      weight: 3,
      opacity: 0.75,
      dashArray: "6 8",
    }).addTo(map);

    for (const p of points) {
      const icon = L.divIcon({
        className: "stop-pin",
        html: `<span class="stop-pin-n">${p.sequence}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([p.lat, p.lng], { icon })
        .bindPopup(
          `<strong>${p.sequence}. ${escapeHtml(p.label || "Stop")}</strong><br/>${escapeHtml(p.address)}`,
        )
        .addTo(map);
    }

    map.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36], maxZoom: 13 });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [stops]);

  const ready = stops.some((s) => s.lat != null && s.lng != null);

  return (
    <div className="route-map-wrap">
      <p className="route-map-caption">
        Your stop order — we draw the path you set. This is not a smart route.
      </p>
      {ready ? (
        <div ref={hostRef} className="route-map" role="img" aria-label="Stop order map" />
      ) : (
        <p className="muted">No map points for these stops yet.</p>
      )}
      <ol className="route-stop-list">
        {stops.map((s) => (
          <li key={s.id}>
            <strong>{s.sequence}.</strong> {s.label || "Stop"} — {s.address}
          </li>
        ))}
      </ol>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
