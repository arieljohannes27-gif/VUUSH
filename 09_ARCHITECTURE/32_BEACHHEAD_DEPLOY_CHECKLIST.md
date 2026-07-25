# Beachhead Deploy Checklist

**VUUSH · Project Atlas**  
**Status:** ACTIVE — go-live path (not Wave-2 Finance)  
**Date:** 2026-07-25  
**Authority:** Phase 10 DoD · `27_WAVE1_RC_DRILL.md` · hosting lock (GitHub · Supabase DB · Railway API · Vercel apps)

---

## What this means

Put the first city live so real people can book, deliver, and pay.  
Finance Dashboard, invoices, and Enterprise stay **after** this.

**Do not** flip Admin `city_live` until every section below is done (or consciously waived by founder).

---

## Hosting map (locked for beachhead)

| Piece | Where | Notes |
|-------|--------|--------|
| Code | **GitHub** | Source of truth; push to deploy |
| Database | **Supabase** (locked) | Postgres memory; Drizzle migrations (not Railway DB) |
| Web apps | **Vercel** | Admin · Dispatch · Customer · Driver · Support |
| API | **Railway** (locked) | Always-on Node (Fastify). Not Vercel alone. |
| Money | **Paystack** (ZAR) when ready | Dogfood may stay on `dev_stub` until KYC |
| Login | **Our API** (not Supabase Auth) | Keep existing OTP / MFA |

```text
GitHub → Vercel (apps) + Railway (API brain)
              ↓
         Supabase (data)
```

---

## 1. Lock the city

- [ ] First city named (e.g. Cape Town)  
- [ ] Zones / service types match that city in Admin  
- [ ] `city_live` stays **false** until §6  

---

## 2. Safety drills

Run from `27_WAVE1_RC_DRILL.md`.  

**Founder choice (2026-07-25):** deploy hosted stack first; finish B–E on live URLs with yourself as demo. Still leave `city_live` **false** until drills feel good.

- [x] Automated: `npm run smoke:rc`  
- [x] Drill A — Happy path (book → pay → deliver → earnings)  
- [ ] Drill B — Medical SOS *(post-live dogfood OK)*  
- [ ] Drill C — Threat SOS *(post-live dogfood OK)*  
- [ ] Drill D — Lost / weak signal *(post-live dogfood OK)*  
- [ ] Drill E — Support + Admin gates *(post-live dogfood OK)*  
- [ ] Mutation accept (once in UI)  
- [ ] Backup custody handoff (once in UI)  

---

## 3. Cloud setup

### 3.1 Supabase (database)

- [ ] Create project (prefer region close to SA users if offered)  
- [ ] Copy Postgres URL into API secrets as `DATABASE_URL`  
- [ ] Run migrations: `npm run db:migrate` against Supabase  
- [ ] Confirm tables exist (jobs, payments, users, etc.)  

### 3.2 Railway (API — locked)

- [ ] Create Railway project; connect GitHub → `platform` (or root monorepo path)  
- [ ] Start command: `npm run start` (after build: `npm run build`)  
- [ ] Set env from `platform/.env.example` (never commit real secrets)  
- [ ] At minimum set: `DATABASE_URL` · `AUTH_PEPPER` · `CORS_ORIGINS` · `PSP_*`  
- [ ] Deploy; health check returns OK  
- [ ] Note public API URL (Railway domain or custom `api.…`)  

### 3.3 Vercel (apps)

Deploy each Vite app; point each at the API URL:

| App | Env tip |
|-----|---------|
| Admin | API base URL |
| Dispatch | API base URL |
| Customer | API base URL (+ pay callback URL later) |
| Driver | API base URL |
| Support | API base URL |

- [ ] All five apps load over HTTPS  
- [ ] Login works against the hosted API  
- [ ] CORS allows only these Vercel origins  

### 3.4 GitHub

- [ ] Main branch protected enough for beachhead (no force-push chaos)  
- [ ] Secrets live in host dashboards — not in the repo  

---

## 4. Money (when you take real pay)

Dogfood can stay on stub. Public city with real cards needs this:

- [ ] Paystack business / KYC done  
- [ ] `PSP_PROVIDER=paystack`  
- [ ] Test keys first; then live keys + `PAYSTACK_LIVE_ENABLED` only when ready  
- [ ] Webhook URL → `POST /v1/payments/webhooks/paystack` on the API host  
- [ ] One real sandbox (or live) book → pay → deliver → Admin pay driver  

---

## 5. Comms (beachhead minimum)

- [ ] SMS / OTP vendor chosen for production (or accepted temporary limit)  
- [ ] Push when Driver app is closed — done **or** founder accepts “app open” limit for week-1  

---

## 6. Founder go-live call

Only after §1–§2 done and §3 live:

- [ ] Staging smoke: one full job on hosted stack  
- [ ] Ops knows who answers Support / Dispatch for day-1  
- [ ] Founder flips Admin **`city_live` = true**  
- [ ] Announce only that city — not “national live”  

---

## 7. Explicitly later (do not block beachhead)

| Parked | When |
|--------|------|
| Full Finance Dashboard | Wave-2 |
| Invoices | M7 / Wave-2 |
| Enterprise Portal | M7 |
| Fleet / Ops dashboards | Wave-3 |
| AI / deep analytics | Wave-4 |
| Training video | When you ask |

---

## Order to do the work

**Click-by-click:** `33_BEACHHEAD_GO_LIVE.md`

1. GitHub push  
2. Supabase + migrate (via Railway release)  
3. Railway API + secrets  
4. Vercel apps → API  
5. You dogfood one full job live  
6. Drills B–E on live stack  
7. Paystack when KYC ready  
8. Founder `city_live`  

---

**End of Beachhead Deploy Checklist**
