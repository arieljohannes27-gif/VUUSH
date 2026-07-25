# Owner Threat Map — SWIFT Technologies

**Owner:** Ariel Johannes · SWIFT Technologies · Project Atlas  
**Status:** Owner brief (one page) · Aligns with Phase 7 Security Architecture  
**Purpose:** What is most likely to hurt you before first live city — and what must exist before go-live.

---

## How to read this

| Likelihood | What it means |
|------------|----------------|
| **High** | Expect attempts early |
| **Medium** | Common once you have volume |
| **Low / High impact** | Rare, but can kill trust |

**Rule:** You do not need to be unhackable. You need **hard to enter · easy to notice · limited blast radius · practiced response**.

---

## Threat map (before first live city)

| # | Threat | Likelihood | If they succeed | Must implement before go-live |
|---|--------|------------|-----------------|------------------------------|
| 1 | **Stolen / shared staff login** (Support, Dispatch, Admin) | **High** | Read many jobs; move assignments; issue bad credits; privacy breach | Unique logins · **MFA for staff** · no shared passwords · session kill · access audit alerts |
| 2 | **Customer / driver account takeover** (SIM-swap, OTP abuse, phishing) | **High** | Fake bookings; see addresses; driver-side theft risk | OTP rate limits · device risk checks · step-up for payout/doc changes · easy session revoke |
| 3 | **Driver fraud** (fake POD, abscond, GPS spoof) | **High** | Lost goods; false “delivered”; payout theft | Proof tiers · tracking integrity (PR23) · payout freezes · investigate queue · offboard path |
| 4 | **Shipper fraud / prohibited goods** | **Medium–High** | Legal exposure; safety events; chargebacks | Goods declaration · blocklist · high-risk review · ban path · PR21 playbook live |
| 5 | **Support / credit abuse** (insider or social engineering) | **Medium** | Margin leak; “buy silence” culture | Credit authority matrix · Finance thresholds · every credit audited · QA on cases |
| 6 | **Mid-job WhatsApp side deals** (destination change, cash) | **High** (ops culture) | Lost custody truth; unpaid km; fraud cover | **System is source of truth** · PR20 mutations only in-app · train Dispatch/drivers |
| 7 | **Enterprise API key leak** | **Medium** (once API exists) | Read/create that org’s jobs | Hashed keys · rotate · rate limit · scoped keys · revoke runbook |
| 8 | **Public or leaked POD / ID documents** | **Medium** | Severe privacy incident; enterprise death | Private object storage · short-lived signed URLs · download audit · no public buckets |
| 9 | **Payment / refund fraud** | **Medium** | Direct cash loss | PSP only (no PAN storage) · idempotent payments · refund dual-control above limit |
| 10 | **Ransomware / server breach** | **Low–Medium / Extreme impact** | Ops down; mass PII risk; brand crisis | Backups tested · least-privilege cloud · secrets manager · prod≠dev data · S1 cyber plan |
| 11 | **Physical threat to driver / theft with violence** | **Medium** (city-dependent) | Harm to people; lost goods | Emergency button · S1 page · “people first” · no punish for safety abort |
| 12 | **Owner / founder account compromise** | **Low / Extreme** | Company control risk | Your Apple ID + email + cloud + bank + Admin: **MFA everywhere** · hardware key preferred |

---

## Blast radius you must accept vs refuse

| Accept (containable) | Refuse (do not go live if true) |
|----------------------|----------------------------------|
| One customer account stolen | Shared Admin password on a sticky note |
| One driver investigated for fake POD | POD/KYC files in a public folder |
| One city degraded during outage | No audit log on credits or overrides |
| Honest delay messaging | Card numbers stored in your database |
| | No MFA on Admin/Finance |
| | No Emergency / incident path for drivers |

---

## Go-live minimum (owner checklist)

- [ ] Staff MFA + unique accounts  
- [ ] Audit log on money, overrides, document access, config  
- [ ] Private evidence/KYC storage  
- [ ] PSP payments (no PAN on SWIFT)  
- [ ] Driver Emergency + incident hold path  
- [ ] Fake-POD / lost-signal playbooks trained  
- [ ] Credit/refund authority matrix  
- [ ] Backup restore tested once  
- [ ] Your personal Admin + email + cloud on MFA  
- [ ] Named on-call for S1 (ops + cyber)

---

## If something bad happens (owner 5 moves)

1. **Contain** — freeze accounts, revoke sessions, stop the bleeding  
2. **Protect people** — safety first if drivers/public at risk  
3. **Preserve proof** — do not wipe devices/logs in panic  
4. **Tell truth** — customers/enterprises/regulators per counsel  
5. **Fix the door** — patch process + product; update Atlas  

---

## Solo founder mode (current reality)

**Fact:** Ariel Johannes is currently the only person in SWIFT Technologies.

That does **not** mean security is optional. It means the threat map **shifts**.

### What changes when you are alone

| Multi-person risk | Solo reality |
|-------------------|--------------|
| Shared Support/Admin passwords | Less relevant — you are every role |
| Insider Support snooping | Low until you hire |
| Separation of duties (Sales vs Finance) | **You wear every hat** — use checklists + delays instead of second people |
| Staff MFA theatre | Still critical — but for **your** accounts |
| “Train Dispatch” | Train **yourself** with written playbooks before go-live |

### Biggest threats to a one-person SWIFT

| Rank | Threat | Why it matters more when solo |
|------|--------|-------------------------------|
| 1 | **Your personal accounts get taken** (Apple ID, email, cloud, bank, domain, Admin) | Attacker gets the whole company at once |
| 2 | **You burn out and skip process** (WhatsApp deals, no audit, “just this once”) | You become your own weakest door |
| 3 | **Phone lost/stolen while testing driver flows** | Custody + admin access may live on one device |
| 4 | **Customer/driver fraud against a tiny operation** | You have no shift team to absorb chaos |
| 5 | **Cloud bill / ransomware / locked laptop** | No second person to recover while you sleep |

### Solo go-live minimum (replace the big-org checklist)

- [ ] MFA on: email, Apple ID, cloud hosting, domain registrar, bank, PSP, GitHub/Git  
- [ ] Prefer a **hardware security key** for your primary email + cloud  
- [ ] Separate browsers/profiles: “Admin SWIFT” vs everyday surfing  
- [ ] Do **not** use one password everywhere  
- [ ] Private storage for any ID/POD test files (never public links)  
- [ ] PSP for cards — never store card numbers in notes/sheets  
- [ ] Written personal playbook: medical emergency, lost signal, destination change (even if you play every role)  
- [ ] Backup: Atlas + code + customer list; test restore once  
- [ ] If you get sick: who can freeze payouts/domain? (trusted lawyer/spouse emergency envelope — optional but wise)

### Compensating for “no second approver”

Until you hire:

1. **24-hour cool-down** on large refunds/credits you issue to yourself as Support  
2. **Written reason** in the system (or Atlas log) for every override  
3. **Weekly 15-minute audit** of: refunds, admin changes, new drivers  
4. When you hire person #1: revoke shared access habits on day one; give them least privilege  

### What you can defer until first hire

- Full L1/L2 Support org charts  
- Complex dual-control Finance workflows  
- Staff on-call rotas  
- Heavy SIEM  

**Do not defer:** your MFA, private files, PSP hygiene, audit log in the product, Emergency/incident paths.

---

## Bottom line for Ariel Johannes

Attackers will try.  
As a solo founder, **you are the company** — so protecting your logins and your discipline *is* protecting SWIFT.

**Project Atlas Phase 7 is the rulebook. This page is your pre-flight.**  
Live safety = rulebook **implemented + trained**, not only written.

---

*Related: `09_ARCHITECTURE/07_SECURITY_ARCHITECTURE.md` · Phase 4B worst cases · PR25 audit*
