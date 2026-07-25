/** Map helpers — M5b Maps Experience */

export type NavTarget = {
  lat: number | null;
  lng: number | null;
  address: string;
  leg: "pickup" | "dropoff";
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function systemNavUrl(target: {
  lat: number | null;
  lng: number | null;
  address: string;
}): string {
  // Desktop Mac → Google Maps (Apple Maps URLs are unreliable in Chrome).
  // iPhone/iPad → Apple Maps.
  if (target.lat != null && target.lng != null) {
    if (isIOS()) {
      return `https://maps.apple.com/?daddr=${target.lat},${target.lng}&dirflg=d`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving`;
  }

  const q = encodeURIComponent(target.address || "Cape Town");
  if (isIOS()) {
    return `https://maps.apple.com/?daddr=${q}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}

/**
 * Open system navigation from a user gesture.
 * Uses an <a> click — more reliable than window.open + noopener (which
 * returns null in Chrome even when the tab opens).
 */
export function openSystemNav(target: {
  lat: number | null;
  lng: number | null;
  address: string;
}): boolean {
  const url = systemNavUrl(target);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    console.info("[swift-nav] nav_handoff_opened", url, target);
    return true;
  } catch (err) {
    console.info("[swift-nav] nav_handoff_blocked", err, target);
    return false;
  }
}

/** Open a blank tab in the same gesture; navigate it after async work. */
export function openNavPlaceholder(): Window | null {
  try {
    return window.open("about:blank", "_blank");
  } catch {
    return null;
  }
}

export function navigatePlaceholder(
  preOpened: Window | null | undefined,
  target: { lat: number | null; lng: number | null; address: string },
): boolean {
  const url = systemNavUrl(target);
  if (preOpened && !preOpened.closed) {
    try {
      preOpened.location.href = url;
      console.info("[swift-nav] nav_handoff_opened", url, target);
      return true;
    } catch {
      try {
        preOpened.close();
      } catch {
        /* ignore */
      }
    }
  }
  return openSystemNav(target);
}

export function navTargetForJob(
  job: {
    state: string;
    pickupLat: number | null;
    pickupLng: number | null;
    pickupAddress: string;
    dropoffLat: number | null;
    dropoffLng: number | null;
    dropoffAddress: string;
  },
): NavTarget {
  const toDropoff = [
    "PICKED_UP",
    "IN_TRANSIT",
    "ARRIVED_DROPOFF",
  ].includes(job.state);

  if (toDropoff) {
    return {
      lat: job.dropoffLat,
      lng: job.dropoffLng,
      address: job.dropoffAddress,
      leg: "dropoff",
    };
  }

  return {
    lat: job.pickupLat,
    lng: job.pickupLng,
    address: job.pickupAddress,
    leg: "pickup",
  };
}

/** Free vector style — no API key for beachhead dogfood (OpenFreeMap). */
export const DEFAULT_MAP_STYLE =
  "https://tiles.openfreemap.org/styles/liberty";

export const CPT_CENTER: [number, number] = [18.4241, -33.9249];
