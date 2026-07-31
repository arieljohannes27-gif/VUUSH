# Wave E — E-hailing (People mobility) · Parked architecture brief

**VUUSH · Project Atlas**  
**Status:** PARKED — analysis only · **no design approval · no coding**  
**Opened:** 2026-07-30  
**Brand:** **VUUSH** (logistics first; e-hailing is a later product line if approved)  
**Hard gate:** Design work opens **only after Wave 2 Finance is fully complete** (see `38_WAVE2_FINANCE_DESIGN.md` + implementation notes when delivered).  
**Until then:** Do not change the live job spine, apps, or schema for rides.

---

## 0. Chief architect ruling

| Ruling | Detail |
|--------|--------|
| **Now** | Logistics beachhead + Wave 2 Finance. Nothing else. |
| **After Finance done** | Open **design-only** programme for e-hailing (this brief → full design doc). |
| **Coding** | Forbidden until that design is **APPROVED TO BUILD**. |
| **Spine** | Today’s spine is **goods completion**. Do not dilute it with passenger semantics early. |
| **Reuse** | Auth, maps, pay rails, dispatch *patterns* may transfer. Job meaning, proof, liability, and regulation will **not**. |

This brief is **architecture analysis** of what already exists — not a build plan.

---

## 1. Plain English

VUUSH today moves **things** from intention to done.

E-hailing moves **people** from A to B.

Same company *can* own both later (shared control layer).  
They must **not** share one muddy “job” meaning without a deliberate design.

Saturday courier dogfood ≠ e-hailing.  
Finance desk ≠ e-hailing.  
Parked here so we do not forget — and so we do not start early.

---

## 2. Hard sequence (locked intent)

```text
Wave 1 logistics spine     ✅ (in flight / beachhead)
        ↓
Wave 2 Finance + audit     ← complete fully first
        ↓
[GATE] Finance DoD met
        ↓
Wave E design (architecture + screens + legal lens)
        ↓
Founder APPROVE TO BUILD
        ↓
Wave E implementation (separate module programme)
```

**Wave 3 Fleet / Ops** may run before or after Wave E design — **founder choice at Finance close**.  
Default recommendation: finish Finance → optional short Wave E design spike → then Fleet/Ops or E-hailing build by commercial priority.  
**Never** start Wave E code during Finance.

---

## 3. What the existing architecture already gives us

Analysis against approved Atlas + `platform/` reality (read-only lens).

### 3.1 Strong reuse candidates (control layer)

| Existing piece | Why it helps e-hailing later | Caution |
|----------------|------------------------------|---------|
| **Identity / OTP / MFA** (M1) | Riders + drivers need accounts | Rider ≠ shipper; driver clearance may need different docs |
| **Session + roles** | Staff desks stay separate | New roles: rider, e-hail driver (or dual-mode driver — design choice) |
| **Maps / tracking** (M5 / M5b) | Live ETA, driver location, nav handoff | Passenger UX expects continuous trip share; different privacy |
| **Dispatch console patterns** (M4a) | Offer / assign / recover | Matching rules differ (proximity, class, rating — not parcel size) |
| **Payments Paystack + Harden** (M8) | Card charge, refunds, payouts | Trip pricing + cancellation fees; no POD of goods |
| **Admin zones / flags / pricing params** | City on/off, take-rate | New service catalogue; regulatory flags |
| **Support + incidents** (M8a / M8c) | Safety incidents, lost contact | Medical / personal safety bar is higher |
| **Audit events** (PR25 direction) | Diligence and disputes | Trip evidence ≠ parcel POD |

### 3.2 Weak or false reuse (do not stretch blindly)

| Logistics concept | Why it breaks for e-hailing |
|-------------------|----------------------------|
| **POD / proof of delivery** | No parcel; trip end is GPS + rider confirm + maybe pin |
| **Multi-stop warehouse runs (M7a)** | Not the same as multi-stop passenger (carpool) — different product |
| **Org statements / enterprise ship** | B2B mobility (corporate ride accounts) is a *later* sub-slice, not M7 copy-paste |
| **Job stops as drop addresses** | Stops are people waypoints; liability and wait-time differ |
| **“Your stop order” copy** | Irrelevant; trip is usually one pickup → one drop |
| **Prohibited goods / packaging** | Replaced by passenger conduct, capacity, accessibility |
| **Driver clearance (licence/insurance)** | Overlaps, but e-hailing often needs **operating licence / metered taxi or e-hailing permit** (jurisdiction-specific) |

### 3.3 Spine honesty

Phase 2 product architecture: **one job spine** for logistics completion.

For e-hailing, chief architect options (to decide **in design**, after Finance):

| Option | Meaning | Verdict for now |
|--------|---------|-----------------|
| **S1 — Extend job type** | `jobs.kind = parcel \| ride` on one table | Possible later; high contamination risk |
| **S2 — Parallel trip spine** | `trips` beside `jobs`, shared identity/pay/dispatch services | Cleaner domain boundary |
| **S3 — Separate product deploy** | New apps, shared platform packages only | Heaviest; only if brands diverge |

**Parked preference (non-binding until design):** **S2** — shared platform services, separate trip aggregate — so parcel Finance and Enterprise stay clean.

---

## 4. Product waves (placement)

| Wave | Intent | E-hailing? |
|------|--------|------------|
| W1 | Prove parcel promise | No |
| W2 | Money + B2B (Enterprise done; Finance remaining) | **No — gate** |
| W3 | Fleet + Ops maturity | Parcel ops first |
| **Wave E** | People mobility (e-hailing) | **Design after W2 Finance DoD** |
| W4 | AI / BI | After data exists (parcel and/or trips) |
| W5 | Multi-city harden | Includes whichever lines are live |

Wave E is a **named programme**, not a silent tweak inside M4/M5.

---

## 5. Design programme (only after Finance gate)

When Finance is complete, open a design doc (suggested name: `4x_WAVE_E_EHAILING_DESIGN.md`) covering:

1. **Market & licence lens (SA / Cape Town)** — what VUUSH is allowed to operate; partner vs licence holder.  
2. **Domain model** — trip vs job; states; cancel; no-show; wait time.  
3. **Apps** — Rider mode in Customer app vs separate app; Driver dual-mode vs dedicated.  
4. **Dispatch** — auto-offer radius; manual override; surge (yes/no for v1).  
5. **Money** — quote, charge on complete vs pre-auth; driver earnings; Finance impact.  
6. **Safety** — SOS, share trip, incident types.  
7. **Explicit non-goals for v1** — carpool, scheduled rides, intercity, Uber-theatre map wall.  
8. **Atlas screen IDs** — new SC-EH-* catalogue (Phase 9 style).  
9. **Approval checklist** — founder locks before any code.

**Out of that first design:** implementation tickets, schema migrations, Saturday demos.

---

## 6. Risks of starting early (why the park exists)

| Risk | If we ignore the gate |
|------|------------------------|
| Spine contamination | Parcel POD and ride “complete” confuse Finance and Support |
| Wave 2 slip | Finance desk delayed; beachhead money trust weak |
| Brand blur | VUUSH reads as “another Bolt” before logistics proof |
| Legal exposure | Public ride tests without licence path |
| Team thrash | Two products, one founder |

---

## 7. Success criteria for *this parked brief*

- [x] E-hailing named and sequenced **after** Wave 2 Finance  
- [x] Reuse vs non-reuse called out from existing architecture  
- [x] Coding forbidden until design approved  
- [x] No change to live spine required to accept this park  

Finance completion will unlock the next document — not this one turning into code.

---

## 8. Approval of the park (process)

This brief does **not** approve building e-hailing.  
It approves **parking and sequencing** only.

When Finance Wave 2 is fully complete, founder says: **open Wave E design**.  
Then chief architect produces the full design for approval.

---

## 9. Revision history

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-07-30 | Parked after founder ask; analysis only; gate = Finance complete |

---

**End of Wave E parked brief**
