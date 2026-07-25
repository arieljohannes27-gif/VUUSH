import { PACKAGE_CLASS_MULTIPLIER } from "./states.js";

export type PriceInput = {
  baseFeeCents: number;
  perKmFeeCents: number;
  priorityMultiplier: number;
  packageClass: string;
  distanceKm: number;
};

export type PriceResult = {
  totalCents: number;
  distanceKm: number;
  components: Record<string, number>;
};

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Zone-pair fallback when lat/lng missing (deterministic stub km). */
export function zonePairDistanceKm(pickupZone: string, dropoffZone: string): number {
  if (pickupZone === dropoffZone) return 3.5;
  const seed = [...`${pickupZone}:${dropoffZone}`].reduce(
    (n, c) => n + c.charCodeAt(0),
    0,
  );
  return 5 + (seed % 20);
}

export function calculatePrice(input: PriceInput): PriceResult {
  const distanceKm = Math.max(1, Number(input.distanceKm.toFixed(2)));
  const packageMult = PACKAGE_CLASS_MULTIPLIER[input.packageClass] ?? 1;
  const base = input.baseFeeCents;
  const distance = Math.round(input.perKmFeeCents * distanceKm);
  const packageFee = Math.round((base + distance) * (packageMult - 1));
  const subtotal = base + distance + packageFee;
  const priorityFee = Math.round(subtotal * (input.priorityMultiplier - 1));
  const totalCents = subtotal + priorityFee;

  return {
    totalCents,
    distanceKm,
    components: {
      base_fee_cents: base,
      distance_fee_cents: distance,
      package_fee_cents: packageFee,
      priority_fee_cents: priorityFee,
    },
  };
}
