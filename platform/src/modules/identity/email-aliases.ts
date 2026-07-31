/**
 * Beachhead dogfood mailboxes: @vuush.local and legacy @swift.local
 * resolve to the same identity.
 */
const LOCAL_DOMAINS = ["vuush.local", "swift.local"] as const;

export function emailLookupCandidates(email: string): string[] {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return [e];
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!(LOCAL_DOMAINS as readonly string[]).includes(domain)) return [e];
  return [...new Set(LOCAL_DOMAINS.map((d) => `${local}@${d}`))];
}
