/** Phase 3 canonical roles */
export const ROLES = [
  "customer",
  "driver",
  "enterprise_customer",
  "dispatcher",
  "fleet_manager",
  "support_agent",
  "finance_officer",
  "administrator",
  "sales_representative",
  "operations_manager",
] as const;

export type Role = (typeof ROLES)[number];

/** Privileged staff roles that require TOTP once enrolled (Phase 7). */
export const STAFF_MFA_ROLES: Role[] = [
  "administrator",
  "dispatcher",
  "finance_officer",
  "support_agent",
  "operations_manager",
];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function requiresStaffMfa(roles: string[]): boolean {
  return roles.some((r) => STAFF_MFA_ROLES.includes(r as Role));
}
