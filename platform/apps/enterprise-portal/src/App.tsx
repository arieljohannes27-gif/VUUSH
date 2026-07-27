import { useEffect, useState } from "react";
import {
  createSite,
  fetchEnterpriseHome,
  fetchEnterpriseSession,
  fetchMembers,
  fetchSites,
  fetchZones,
  inviteMember,
  requestOtp,
  verifyOtp,
  type OrgMember,
  type OrgMembership,
  type OrgSite,
  type SessionUser,
} from "./api";

type Nav = "home" | "sites" | "people";

const TOKEN_KEY = "vuush.enterprise.token";
const ORG_KEY = "vuush.enterprise.org";

function readToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function writeToken(value: string) {
  localStorage.setItem(TOKEN_KEY, value);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
function readOrgId() {
  return localStorage.getItem(ORG_KEY);
}
function writeOrgId(value: string) {
  localStorage.setItem(ORG_KEY, value);
}

function canManageSites(role: string) {
  return role === "org_admin" || role === "booker";
}
function canManagePeople(role: string) {
  return role === "org_admin";
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<SessionUser | null>(null);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(() => readOrgId());
  const [nav, setNav] = useState<Nav>("home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const [home, setHome] = useState<Awaited<
    ReturnType<typeof fetchEnterpriseHome>
  > | null>(null);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [zones, setZones] = useState<Array<{ code: string; name: string }>>([]);

  const [siteForm, setSiteForm] = useState({
    label: "",
    address: "",
    zoneCode: "",
    kind: "warehouse" as "warehouse" | "store" | "other",
  });
  const [inviteForm, setInviteForm] = useState({
    email: "",
    displayName: "",
    role: "booker" as "org_admin" | "booker" | "approver" | "viewer",
  });

  const active = memberships.find((m) => m.orgId === orgId) ?? memberships[0];
  const role = active?.role ?? "";

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setBusy(false);
    }
  }

  async function bootstrap(accessToken: string, preferredOrg?: string | null) {
    const session = await fetchEnterpriseSession(accessToken);
    setUser(session.user);
    setMemberships(session.memberships);
    const nextOrg =
      session.memberships.find((m) => m.orgId === preferredOrg)?.orgId ??
      session.memberships[0]?.orgId ??
      null;
    if (nextOrg) {
      setOrgId(nextOrg);
      writeOrgId(nextOrg);
    }
  }

  useEffect(() => {
    if (!token) return;
    void run(async () => {
      await bootstrap(token, orgId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !orgId || !user) return;
    void run(async () => {
      if (nav === "home") setHome(await fetchEnterpriseHome(token, orgId));
      if (nav === "sites") {
        setSites((await fetchSites(token, orgId)).sites);
        setZones((await fetchZones(token, orgId)).zones);
      }
      if (nav === "people") setMembers((await fetchMembers(token, orgId)).members);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orgId, nav, user?.id]);

  if (!token || !user || !active) {
    return (
      <div className="shell">
        <header className="bar">
          <div className="lockup">
            <span className="mark" aria-hidden="true" />
            <span className="word">VUUSH</span>
          </div>
          <span className="meta">Enterprise</span>
        </header>
        <main className="auth">
          <p className="brand">VUUSH</p>
          <h1>Sign in</h1>
          <p className="lede">Org Admin and team members use email codes.</p>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!challengeId) {
                  const res = await requestOtp(email.trim());
                  setChallengeId(res.challengeId);
                  setDevCode(res.devCode ?? null);
                  if (res.devCode) setOtp(res.devCode);
                  return;
                }
                const res = await verifyOtp(challengeId, otp.trim());
                if (res.status !== "authenticated" || !res.session?.accessToken) {
                  throw new Error(res.status || "auth_failed");
                }
                writeToken(res.session.accessToken);
                setToken(res.session.accessToken);
                await bootstrap(res.session.accessToken);
              });
            }}
          >
            <label className="label" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              className="field"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={Boolean(challengeId)}
              required
            />
            {challengeId ? (
              <>
                <label className="label" htmlFor="otp">
                  Code
                </label>
                <input
                  id="otp"
                  className="field"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
              </>
            ) : null}
            {devCode ? <p className="hint">Dev code: {devCode}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            <button className="cta" type="submit" disabled={busy}>
              {challengeId ? "Enter" : "Send code"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="bar">
        <div className="lockup">
          <span className="mark" aria-hidden="true" />
          <span className="word">VUUSH</span>
        </div>
        <nav className="nav" aria-label="Primary">
          {(
            [
              ["home", "Home"],
              ["sites", "Sites"],
              ["people", "People"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={nav === id ? "nav-item active" : "nav-item"}
              onClick={() => setNav(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="bar-right">
          {memberships.length > 1 ? (
            <select
              className="org-select"
              value={active.orgId}
              onChange={(e) => {
                writeOrgId(e.target.value);
                setOrgId(e.target.value);
              }}
              aria-label="Organisation"
            >
              {memberships.map((m) => (
                <option key={m.orgId} value={m.orgId}>
                  {m.orgName}
                </option>
              ))}
            </select>
          ) : (
            <span className="meta">{active.orgName}</span>
          )}
          <button
            type="button"
            className="nav-item"
            onClick={() => {
              clearToken();
              setToken(null);
              setUser(null);
              setMemberships([]);
              setChallengeId(null);
              setOtp("");
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="main">
        {error ? <p className="error">{error}</p> : null}

        {nav === "home" && home ? (
          <section className="stack">
            <p className="eyebrow">{home.org.cityCode}</p>
            <h1>{home.org.name}</h1>
            <p className="lede">
              You are signed in as {role.replaceAll("_", " ")}. Shipping arrives
              in the next slice — sites and people are ready now.
            </p>
            <ul className="stat-list">
              <li>
                <span className="stat-n">{home.stats.liveShipments}</span>
                <span className="stat-l">Live shipments</span>
              </li>
              <li>
                <span className="stat-n">{home.stats.todayShipments}</span>
                <span className="stat-l">Created today</span>
              </li>
              <li>
                <span className="stat-n">{home.stats.sites}</span>
                <span className="stat-l">Sites</span>
              </li>
              <li>
                <span className="stat-n">{home.stats.members}</span>
                <span className="stat-l">People</span>
              </li>
            </ul>
          </section>
        ) : null}

        {nav === "sites" ? (
          <section className="stack">
            <h1>Sites</h1>
            <p className="lede">
              Warehouses, stores, and saved addresses for Cape Town runs.
            </p>

            {canManageSites(role) ? (
              <form
                className="panel stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await createSite(token, active.orgId, {
                      label: siteForm.label.trim(),
                      address: siteForm.address.trim(),
                      zoneCode: siteForm.zoneCode || null,
                      kind: siteForm.kind,
                    });
                    setSiteForm({
                      label: "",
                      address: "",
                      zoneCode: "",
                      kind: "warehouse",
                    });
                    setSites((await fetchSites(token, active.orgId)).sites);
                  });
                }}
              >
                <h2>Add site</h2>
                <label className="label" htmlFor="site-label">
                  Label
                </label>
                <input
                  id="site-label"
                  className="field"
                  value={siteForm.label}
                  onChange={(e) =>
                    setSiteForm((f) => ({ ...f, label: e.target.value }))
                  }
                  placeholder="Main warehouse"
                  required
                />
                <label className="label" htmlFor="site-address">
                  Address
                </label>
                <input
                  id="site-address"
                  className="field"
                  value={siteForm.address}
                  onChange={(e) =>
                    setSiteForm((f) => ({ ...f, address: e.target.value }))
                  }
                  required
                />
                <label className="label" htmlFor="site-kind">
                  Kind
                </label>
                <select
                  id="site-kind"
                  className="field"
                  value={siteForm.kind}
                  onChange={(e) =>
                    setSiteForm((f) => ({
                      ...f,
                      kind: e.target.value as typeof f.kind,
                    }))
                  }
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="store">Store</option>
                  <option value="other">Other</option>
                </select>
                <label className="label" htmlFor="site-zone">
                  Zone
                </label>
                <select
                  id="site-zone"
                  className="field"
                  value={siteForm.zoneCode}
                  onChange={(e) =>
                    setSiteForm((f) => ({ ...f, zoneCode: e.target.value }))
                  }
                >
                  <option value="">Optional…</option>
                  {zones.map((z) => (
                    <option key={z.code} value={z.code}>
                      {z.code} — {z.name}
                    </option>
                  ))}
                </select>
                <button className="cta" type="submit" disabled={busy}>
                  Save site
                </button>
              </form>
            ) : null}

            <ul className="plain-list">
              {sites.length === 0 ? (
                <li className="muted">No sites yet.</li>
              ) : (
                sites.map((s) => (
                  <li key={s.id}>
                    <strong>{s.label}</strong>
                    <span className="muted">
                      {" "}
                      · {s.kind}
                      {s.zoneCode ? ` · ${s.zoneCode}` : ""}
                    </span>
                    <div className="muted">{s.address}</div>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {nav === "people" ? (
          <section className="stack">
            <h1>People</h1>
            <p className="lede">Who can book, approve, and watch for this org.</p>

            {canManagePeople(role) ? (
              <form
                className="panel stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await inviteMember(token, active.orgId, {
                      email: inviteForm.email.trim(),
                      displayName: inviteForm.displayName.trim() || undefined,
                      role: inviteForm.role,
                    });
                    setInviteForm({
                      email: "",
                      displayName: "",
                      role: "booker",
                    });
                    setMembers((await fetchMembers(token, active.orgId)).members);
                  });
                }}
              >
                <h2>Invite</h2>
                <label className="label" htmlFor="inv-email">
                  Email
                </label>
                <input
                  id="inv-email"
                  className="field"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
                <label className="label" htmlFor="inv-name">
                  Name
                </label>
                <input
                  id="inv-name"
                  className="field"
                  value={inviteForm.displayName}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                />
                <label className="label" htmlFor="inv-role">
                  Role
                </label>
                <select
                  id="inv-role"
                  className="field"
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((f) => ({
                      ...f,
                      role: e.target.value as typeof f.role,
                    }))
                  }
                >
                  <option value="booker">Booker</option>
                  <option value="approver">Approver</option>
                  <option value="viewer">Viewer</option>
                  <option value="org_admin">Org Admin</option>
                </select>
                <button className="cta" type="submit" disabled={busy}>
                  Send invite
                </button>
              </form>
            ) : (
              <p className="muted">Only Org Admins can invite people.</p>
            )}

            <ul className="plain-list">
              {members.map((m) => (
                <li key={m.membershipId}>
                  <strong>{m.displayName || m.email || m.userId}</strong>
                  <span className="muted"> · {m.role.replaceAll("_", " ")}</span>
                  <div className="muted">{m.email}</div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
