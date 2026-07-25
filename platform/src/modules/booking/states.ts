/** Phase 1 job states — booking + dispatch + execution. */
export const JOB_STATES = [
  "DRAFT",
  "QUOTED",
  "CONFIRMED",
  "SCHEDULED",
  "ASSIGNED",
  "EN_ROUTE_PICKUP",
  "ARRIVED_PICKUP",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVED_DROPOFF",
  "DELIVERED",
  "FAILED_ATTEMPT",
  "CANCELLED",
  "RETURN_IN_PROGRESS",
  "RETURNED",
  "CLOSED",
] as const;

export type JobState = (typeof JOB_STATES)[number];

const ALLOWED: Record<string, JobState[]> = {
  DRAFT: ["QUOTED", "CANCELLED"],
  QUOTED: ["QUOTED", "CONFIRMED", "SCHEDULED", "CANCELLED", "DRAFT"],
  CONFIRMED: ["CANCELLED", "ASSIGNED", "SCHEDULED"],
  SCHEDULED: ["CANCELLED", "ASSIGNED"],
  ASSIGNED: ["CANCELLED", "ASSIGNED", "EN_ROUTE_PICKUP"],
  EN_ROUTE_PICKUP: ["ARRIVED_PICKUP", "CANCELLED", "FAILED_ATTEMPT"],
  ARRIVED_PICKUP: ["PICKED_UP", "FAILED_ATTEMPT", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["ARRIVED_DROPOFF", "FAILED_ATTEMPT", "CANCELLED"],
  ARRIVED_DROPOFF: ["DELIVERED", "FAILED_ATTEMPT"],
  FAILED_ATTEMPT: ["IN_TRANSIT", "CANCELLED", "RETURN_IN_PROGRESS", "CLOSED"],
  DELIVERED: ["CLOSED"],
};

export function canTransition(from: string, to: JobState): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export const PACKAGE_CLASS_MULTIPLIER: Record<string, number> = {
  small: 1,
  medium: 1.25,
  large: 1.6,
};

/** Vehicle classes that may take a package class (Wave 1 simple gate). */
export const VEHICLE_OK_FOR_PACKAGE: Record<string, string[]> = {
  small: ["bike", "car", "van"],
  medium: ["car", "van"],
  large: ["van"],
};

export function vehicleEligibleForPackage(
  vehicleClass: string,
  packageClass: string,
): boolean {
  return (VEHICLE_OK_FOR_PACKAGE[packageClass] ?? []).includes(vehicleClass);
}

/** Wave 1 proof kinds (PR08). */
export const PROOF_KINDS = [
  "pickup_photo",
  "pickup_ack",
  "dropoff_photo",
  "dropoff_signature",
  "dropoff_otp",
  "fail_photo",
  "condition_note",
] as const;

export type ProofKind = (typeof PROOF_KINDS)[number];

export const PICKUP_PROOF_KINDS: ProofKind[] = ["pickup_photo", "pickup_ack"];
export const DELIVERY_PROOF_KINDS: ProofKind[] = [
  "dropoff_photo",
  "dropoff_signature",
  "dropoff_otp",
];
