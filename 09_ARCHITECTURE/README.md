# 09_ARCHITECTURE

**Status:** Phases 1–10 **APPROVED** · Wave-1 through **M8c** · **M5b Maps design APPROVED**  

## Purpose

Official enterprise architecture programme for SWIFT Technologies. Each phase is a gated deliverable. No phase begins until the previous phase is approved. No production software is written from this folder unless explicitly authorised as implementation work outside the gated phase programme.

## Phase Gate Policy

1. Deliver one phase at a time.  
2. Summarise decisions, risks, and assumptions.  
3. Obtain explicit approval.  
4. Only then open the next phase.  
5. Atlas remains the single source of truth — amend in place; archive superseded versions.

## Phase Index

| Phase | Document | Status |
|-------|----------|--------|
| 1 | `01_BUSINESS_ARCHITECTURE.md` | **APPROVED** (2026-07-16) |
| 2 | `02_PRODUCT_ARCHITECTURE.md` | **APPROVED** (2026-07-20) |
| 3 | `03_USER_ARCHITECTURE.md` | **APPROVED** (2026-07-20) |
| 4 | `04_PROCESS_ARCHITECTURE.md` | **APPROVED** (2026-07-20, with 4B + 4C) |
| 4B | `04B_WORST_CASE_SCENARIOS.md` | **APPROVED** (2026-07-20) |
| 4C | `04C_PROCESS_COMPLETENESS.md` | **APPROVED** (2026-07-20) |
| 5 | `05_SYSTEM_ARCHITECTURE.md` | **APPROVED** (2026-07-20) |
| 6 | `06_DATABASE_ARCHITECTURE.md` | **APPROVED** (2026-07-20) |
| 7 | `07_SECURITY_ARCHITECTURE.md` | **APPROVED** (2026-07-20) |
| 7A | `07A_OWNER_THREAT_MAP.md` | Owner brief (solo-founder mode) |
| 8 | `08_DESIGN_ARCHITECTURE.md` | **APPROVED** (2026-07-20) |
| 8A | `08A_DESIGN_TOKENS.md` | Token lock (DES-A2) — hex/type for implementation |
| 9 | `09_SCREEN_ARCHITECTURE.md` | **APPROVED** (2026-07-20) |
| 10 | `10_DEVELOPMENT_ROADMAP.md` | **APPROVED** (2026-07-20) |
| 11 | `11_TECH_STACK_M0.md` | **LOCKED** — M0 stack |
| 12 | `12_M1_AUTH_NOTES.md` | **M1 auth** delivered |
| 13 | `13_M3_BOOKING_NOTES.md` | **M3 booking** delivered |
| — | `19_M6_DRIVER_APP_NOTES.md` … `21_M8A_SUPPORT_NOTES.md` | Wave-1 apps through Support |
| — | `22_SWIFT_DESIGN_SYSTEM_V1.md` | DS v1 locked (Figma library open) |
| — | `23_M8B_ADMIN_DESIGN.md` | **M8b Admin design — APPROVED** |
| — | `24_M8B_ADMIN_NOTES.md` | **M8b Admin implementation** |
| — | `25_M8C_INCIDENT_DESIGN.md` | **M8c Incidents design — APPROVED** |
| — | `26_M8C_INCIDENT_NOTES.md` | **M8c Incidents implementation** |
| — | `27_WAVE1_RC_DRILL.md` | **Wave-1 RC dogfood drill** |
| — | `28_MAPS_EXPERIENCE_DESIGN.md` | **M5b Maps Experience — APPROVED** |
| — | `29_MAPS_EXPERIENCE_NOTES.md` | **M5b Maps implementation** |
| — | `30_M8_HARDEN_DESIGN.md` | **M8 Harden design — APPROVED (Paystack SA · ZAR)** |
| — | `32_BEACHHEAD_DEPLOY_CHECKLIST.md` | **Beachhead deploy checklist** (hosting + go-live) |
| — | `33_BEACHHEAD_GO_LIVE.md` | **Go-live click path** (Supabase · Railway · Vercel) |
| — | `34_DRIVER_CLEARANCE_DESIGN.md` | **Driver clearance** — password at sign-up + Admin approve |
| — | `35_M7_ENTERPRISE_DESIGN.md` | **M7 Enterprise (B2B)** — APPROVED TO BUILD (2026-07-26) |
| — | `36_M7_ENTERPRISE_NOTES.md` | **M7 implementation** — E0–E1 delivered |
| — | `../platform/` | **M0–M8c + M5b maps · VUUSH surface brand** |

## What comes after baseline

1. ~~Open implementation from M0~~ → **started** (`platform/`)  
2. Lock beachhead city/country  
3. Hire (Ops + Tech Lead first among the first five)  
4. Choose remaining vendors (cloud, PSP, maps, SMS)  
5. Design tooling mockups from Phases 8–9  
6. Keep Atlas as the authority when coding  
7. Wave-1 spine through M8c. **RC drill:** `27_WAVE1_RC_DRILL.md` + `npm run smoke:rc`  
8. **Beachhead go-live:** `32_BEACHHEAD_DEPLOY_CHECKLIST.md` (GitHub · Supabase · Vercel · Railway)  

## Relationship to Handbook

Foundation, Brand, Product, Operations, and Legal chapters remain part of Atlas. Architecture phases are the **authoritative detailed design** for platform construction. Where a handbook outline and an approved architecture phase differ, the approved architecture phase wins until handbook chapters are updated to match.
