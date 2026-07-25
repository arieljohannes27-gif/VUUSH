import { describe, expect, it } from "vitest";
import {
  calculatePrice,
  haversineKm,
  zonePairDistanceKm,
} from "./pricing.js";
import { canTransition } from "./states.js";

describe("pricing", () => {
  it("prices standard small package with distance", () => {
    const result = calculatePrice({
      baseFeeCents: 4500,
      perKmFeeCents: 800,
      priorityMultiplier: 1,
      packageClass: "small",
      distanceKm: 10,
    });
    expect(result.totalCents).toBe(4500 + 8000);
    expect(result.components.priority_fee_cents).toBe(0);
  });

  it("applies priority multiplier", () => {
    const result = calculatePrice({
      baseFeeCents: 1000,
      perKmFeeCents: 100,
      priorityMultiplier: 1.5,
      packageClass: "small",
      distanceKm: 1,
    });
    expect(result.totalCents).toBeGreaterThan(1100);
  });

  it("computes haversine distance", () => {
    const km = haversineKm(-33.9249, 18.4241, -33.918, 18.423);
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(5);
  });

  it("zone pair distance is stable", () => {
    expect(zonePairDistanceKm("A", "A")).toBe(3.5);
    expect(zonePairDistanceKm("A", "B")).toEqual(
      zonePairDistanceKm("A", "B"),
    );
  });
});

describe("job transitions", () => {
  it("allows draft to quoted and quoted to confirmed", () => {
    expect(canTransition("DRAFT", "QUOTED")).toBe(true);
    expect(canTransition("QUOTED", "CONFIRMED")).toBe(true);
    expect(canTransition("DRAFT", "CONFIRMED")).toBe(false);
    expect(canTransition("CONFIRMED", "DRAFT")).toBe(false);
  });

  it("allows confirmed to assigned", () => {
    expect(canTransition("CONFIRMED", "ASSIGNED")).toBe(true);
    expect(canTransition("ASSIGNED", "ASSIGNED")).toBe(true);
  });

  it("requires execution path toward delivered", () => {
    expect(canTransition("ASSIGNED", "EN_ROUTE_PICKUP")).toBe(true);
    expect(canTransition("ARRIVED_PICKUP", "PICKED_UP")).toBe(true);
    expect(canTransition("ARRIVED_DROPOFF", "DELIVERED")).toBe(true);
    expect(canTransition("ASSIGNED", "DELIVERED")).toBe(false);
  });
});

describe("vehicle eligibility", () => {
  it("gates package class by vehicle", async () => {
    const { vehicleEligibleForPackage } = await import("./states.js");
    expect(vehicleEligibleForPackage("bike", "large")).toBe(false);
    expect(vehicleEligibleForPackage("van", "large")).toBe(true);
    expect(vehicleEligibleForPackage("car", "medium")).toBe(true);
  });
});
