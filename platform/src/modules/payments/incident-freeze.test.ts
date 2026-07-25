import { describe, expect, it } from "vitest";
import {
  INCIDENT_FREEZE_GENERIC,
  INCIDENT_FREEZE_MEDICAL,
  INCIDENT_FREEZE_SECURITY,
  incidentFreezeReason,
  isAutoIncidentFreezeReason,
} from "./incident-freeze.js";

describe("incidentFreezeReason", () => {
  it("maps medical as non-punitive medical freeze", () => {
    expect(incidentFreezeReason("emergency_medical")).toBe(
      INCIDENT_FREEZE_MEDICAL,
    );
  });

  it("maps threat/assault/theft to security freeze", () => {
    expect(incidentFreezeReason("emergency_threat")).toBe(
      INCIDENT_FREEZE_SECURITY,
    );
    expect(incidentFreezeReason("emergency_assault")).toBe(
      INCIDENT_FREEZE_SECURITY,
    );
    expect(incidentFreezeReason("theft_suspected")).toBe(
      INCIDENT_FREEZE_SECURITY,
    );
  });

  it("defaults other incident holds to generic", () => {
    expect(incidentFreezeReason("emergency_accident")).toBe(
      INCIDENT_FREEZE_GENERIC,
    );
  });

  it("recognises auto freeze reasons for release", () => {
    expect(isAutoIncidentFreezeReason(INCIDENT_FREEZE_MEDICAL)).toBe(true);
    expect(isAutoIncidentFreezeReason("manual_ops_hold")).toBe(false);
  });
});
