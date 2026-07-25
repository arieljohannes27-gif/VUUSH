/** Auto-freeze reason codes written when INCIDENT_HOLD is placed. */
export const INCIDENT_FREEZE_SECURITY = "incident_security";
export const INCIDENT_FREEZE_MEDICAL = "incident_medical";
export const INCIDENT_FREEZE_GENERIC = "incident_hold";

const AUTO_REASONS = new Set([
  INCIDENT_FREEZE_SECURITY,
  INCIDENT_FREEZE_MEDICAL,
  INCIDENT_FREEZE_GENERIC,
]);

/**
 * Map hold reason → freeze reason.
 * Medical is non-punitive: payout paused until hold release (people-safe).
 * Threat / assault / theft → security hold.
 */
export function incidentFreezeReason(reasonCode: string): string {
  const code = reasonCode.toLowerCase();
  if (code.includes("medical")) return INCIDENT_FREEZE_MEDICAL;
  if (
    code.includes("threat") ||
    code.includes("assault") ||
    code.includes("theft")
  ) {
    return INCIDENT_FREEZE_SECURITY;
  }
  return INCIDENT_FREEZE_GENERIC;
}

export function isAutoIncidentFreezeReason(reason: string | null | undefined) {
  return reason != null && AUTO_REASONS.has(reason);
}
