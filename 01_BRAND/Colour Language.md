# VUUSH Colour Language

**Version:** 1.0  
**Status:** LOCKED — Official colour meaning source of truth  
**Effective:** 2026-07-24  
**Owner:** Ariel Johannes · VUUSH  
**Atlas path:** `01_BRAND/Colour Language.md`  
**Parent:** [`Visual Principles.md`](./Visual%20Principles.md) · [`Brand Foundation.md`](./Brand%20Foundation.md)  
**Engineering tokens:** `09_ARCHITECTURE/22_SWIFT_DESIGN_SYSTEM_V1.md` · `platform/design-system/tokens/colors.css`

---

## Authority

This document defines **what colour means** at VUUSH — roles, ratios, ethics, and guardrails.

Exact hex values and CSS variables are locked in the Design System. This chapter governs **how** those tokens may be used. Token **filenames and `--swift-*` prefixes** may lag the VUUSH name until an authorised technical migration; **meaning is already VUUSH**.

Where marketing taste conflicts with this language, **this document wins**.

---

## 1. Colour thesis

> **White is the brand. Accent is rare. Status tells the truth. Danger is never decoration.**

Colour serves **Calm Precision** and **Time Returned**. It does not entertain. It does not manufacture urgency.

People should feel light, clear, and composed — not stimulated.

---

## 2. Distribution (product UI)

| Share (approx.) | Role |
|----------------:|------|
| ~70% | White / near-white canvas |
| ~20% | Soft silver / grey structure |
| ~10% | Accent blue — interactive only |
| Trace | Success / warning / danger — meaning only |

**Never invert the ratio.** A screen that is mostly accent has failed.

---

## 3. Core roles

### 3.1 White — brand field

| Token (semantic) | Hex | Role |
|------------------|-----|------|
| Primary white / canvas | `#FFFFFF` | App backgrounds, elevated surfaces |
| Page background | `#FAFAFA` | Soft page field when canvas needs air |

White carries premium calm. It is not empty — it is confidence.

---

### 3.2 Silver / structure

| Token (semantic) | Hex | Role |
|------------------|-----|------|
| Surface | `#F5F6F8` | Sheets, grouped areas, subtle zones |
| Border | `#E7EAF0` | Dividers, input edges — quiet structure |

Structure should whisper. Prefer spacing over heavy lines.

---

### 3.3 Charcoal — type

| Token (semantic) | Hex | Role |
|------------------|-----|------|
| Primary text | `#1C1F26` | Titles, body |
| Secondary text | `#6B7280` | Meta, hints |
| Inverse text | `#FFFFFF` | Text on accent / solid dark controls |

Hierarchy through value and weight — not rainbow labels.

---

### 3.4 Accent — signature blue

| Token (semantic) | Hex | Role |
|------------------|-----|------|
| Signature blue | `#2563EB` | Primary CTAs, selected states, key links, focus |
| Blue soft | `#EFF4FF` | Selected row washes, soft chips — sparse |
| Blue hover / pressed | `#1D4ED8` / `#1E40AF` | Interactive feedback only |

**Accent is for interaction and commitment affordance** — especially actions at The Point.

**Accent is not for:** page chrome, full headers, large brand blocks, “energy,” or wallpaper.

---

## 4. Status colours

Status colours appear in **badges, icons, brief banners, and inline signals** — never as full-screen personality.

| Role | Hex | Use when |
|------|-----|----------|
| **Success** | `#16A34A` (+ soft `#DCFCE7`) | Delivered, paid, verified, truly complete |
| **Warning / signal** | `#F59E0B` (+ soft `#FEF3C7`) | Needs attention soon — not panic |
| **Danger** | `#DC2626` (+ soft `#FEE2E2`) | Real errors, Emergency, irreversible risk |

### Ethics

| Do | Don’t |
|----|-------|
| Match colour to real state | Use danger red for emphasis or sales |
| Keep washes small and local | Flood the viewport with status colour |
| Pair with exact language (Voice & Tone) | Let colour replace clear copy |
| Reserve danger for truth | Cry wolf |

**Emergency controls** stay high-contrast and reachable. Their seriousness is earned by rarity.

---

## 5. The Point and the square (colour)

| Element | Colour guidance |
|---------|-----------------|
| **Wordmark** | Primary text / charcoal on light; inverse on rare dark brand moments |
| **Square mark** | Same family as wordmark or a single exact accent ink — **never** gradient candy; never multi-colour play |
| **Commit control (The Point)** | Primary accent button (or equally unmistakable solid) — one per critical moment |
| **Soft / draft actions** | Neutral / secondary — must not compete with commit |

The square remains understated. Colour must not turn it into a toy.

---

## 6. Usage rules

1. **White + silver dominate** every product surface.  
2. **One accent family** across customer, driver, dispatch, support, admin — density may change; personality of colour must not.  
3. **Commit actions** may use accent; explore/edit actions stay quieter.  
4. **Focus rings** use restrained accent transparency — accessibility is premium.  
5. **Maps and data:** accent and status for meaning; base map stays neutral; no decorative rainbow series.  
6. **Marketing** may use richer photography; product UI ratios still apply to UI chrome in campaigns.  
7. **Dark mode** is not the brand default. If introduced later, it must preserve calm precision and status ethics — not neon.

---

## 7. Threshold clarity (colour)

| Phase | Colour behaviour |
|-------|------------------|
| Before The Point | Neutrals; secondary actions; soft surfaces |
| At The Point | Clear accent (or solid) primary — unmistakable |
| After The Point | Status honesty; accent only for true next actions |
| Failure | Danger/warning locally + calm surrounding field |
| Complete | Restrained success — quiet resolution, not celebration wash |

---

## 8. Physical / environmental cues (directional)

For future spaces, vehicles, and print — same soul:

- Light fields, quiet metals, restrained accent moments  
- No courier-cliché neon wraps as identity  
- Square mark small and exact where brand appears  

Detailed environmental specs are out of scope for v1.0.

---

## 9. Engineering bridge

| Concern | Location |
|---------|----------|
| Hex + CSS variables | `platform/design-system/tokens/colors.css` |
| DS narrative lock | `09_ARCHITECTURE/22_SWIFT_DESIGN_SYSTEM_V1.md` |
| App adoption | Existing apps may still use legacy aliases (`--color-*`); converge on DS |

**Rename note:** `--swift-*` → VUUSH-prefixed tokens is a **technical migration** item — not authorised by this document alone.

---

## 10. Kill list

- Large blue backgrounds / banking headers  
- Purple or multi-stop “AI” gradients as brand colour  
- Danger red as decoration or default CTA  
- Success green as page theme  
- Different accent hue per app  
- Colour used to fake progress or urgency  
- Rainbow dashboards  

---

## 11. Review questions

1. Is the screen still ~white-led?  
2. Is accent earning its ~10% — or leaking into chrome?  
3. Does status colour match a **real** state?  
4. Is The Point’s action the clearest interactive colour on the screen?  
5. Would this still feel like one company next to the other apps?

---

## 12. Governance

| Topic | Rule |
|-------|------|
| Meaning authority | This document (v1.0+) |
| Parent | Visual Principles · Brand Foundation |
| Hex authority | Design System token lock |
| Changes | Amend in place with version bump; token hex changes require DS revision |

---

## 13. Revision history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-07-24 | Locked Colour Language from Visual Principles + DS v1.0 palette; VUUSH meaning, legacy token names acknowledged |

---

*VUUSH — White is the brand. Accent is rare. Status tells the truth.*
