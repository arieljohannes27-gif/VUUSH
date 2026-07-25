# SWIFT Platform — M0 + M1 + M3 + M8 + M4

| Module | Status |
|--------|--------|
| M0 Foundation | Done |
| M1 Auth | Done |
| M3 Booking | Done |
| M8 Payments | Done (`dev_stub`) |
| M4 Dispatch | Done (Wave 1 slice) |
| M4a Dispatcher Console | Done — `apps/dispatch-console` |
| M5 Tracking | Done (PR23 integrity) |
| M6a Proof / POD | Done |

Atlas: `09_ARCHITECTURE/10–18_*.md`

## Setup

```bash
cd platform
cp .env.example .env
npm install
npm run db:up
npm run db:migrate
npm run dev
```

Postgres: host port **55432**

## Dispatcher Console (M4a)

```bash
# API must be on :3000
cd platform/apps/dispatch-console
npm install
npm run dev
```

Open **http://localhost:5173** — sign in with any email (OTP `devCode` auto-filled). Local login grants `dispatcher`.

## Smoke tests

```bash
npm run smoke:m1
npm run smoke:m3
npm run smoke:m8
npm run smoke:m4
```

## Booking API (M3)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/catalog` | Service types + zones |
| POST | `/v1/jobs` | Create DRAFT (auth) |
| POST | `/v1/jobs/:id/quote` | Price → QUOTED |
| POST | `/v1/jobs/:id/confirm` | Charge (M8) → CONFIRMED/SCHEDULED |
| POST | `/v1/jobs/:id/cancel` | Cancel if allowed |
| GET | `/v1/jobs` | List own jobs |
| GET | `/v1/jobs/:id` | Job + active quote |

## Payments API (M8)

See `14_M8_PAYMENTS_NOTES.md`. Stub decline: `tok_fail`.

## Dispatch API (M4)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/dispatch/drivers` | Upsert driver profile |
| POST | `/v1/drivers/me/duty` | On/off duty |
| GET | `/v1/dispatch/queue` | Unassigned confirmed jobs |
| POST | `/v1/dispatch/jobs/:id/assign` | Assign (optional `requireAccept`) |
| POST | `/v1/dispatch/jobs/:id/reassign` | Reassign + reason |
| POST | `/v1/dispatch/jobs/:id/backup` | PR18 backup |
| POST | `/v1/dispatch/jobs/:id/holds` | Place hold |

## Next

**M5 Tracking** and/or **M8c Incidents** / **M8b Admin min**.
