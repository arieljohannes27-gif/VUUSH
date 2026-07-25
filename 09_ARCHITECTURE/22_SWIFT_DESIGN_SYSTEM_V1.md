# SWIFT Design System v1.0

**Status:** OFFICIAL — Design Standard  
**Approved:** 2026-07-23 (founder brief — implement now)  
**Authority:** This document + `platform/design-system/`  
**Supersedes for product UI tokens:** `08A_DESIGN_TOKENS.md`, `08B_TYPOGRAPHY_AMENDMENT.md` (see §0)  
**Does not replace:** Phase 8 constitutional principles (trust, calm, Emergency truth, no fake motion) in `08_DESIGN_ARCHITECTURE.md` where they do not conflict with v1 tokens.

---

## 0. Executive position

SWIFT Design System v1.0 is the **single visual language** for every product in the ecosystem:

Customer App · Driver App · Dispatcher Portal · Enterprise Portal · Admin · Fleet · Support Centre · AI Operations Centre

**Philosophy references:** Apple · OpenAI · Stripe · Linear · Notion · Porsche — restraint, precision, whitespace, sparse colour.

**Not a screen dump.** Tokens, elevation, components, icons, and implementation contracts only. Apps adopt later.

### Board challenges

| Temptation | Verdict |
|------------|---------|
| Rebuild all apps in this pass | **Reject** — system first |
| Keep dual palettes (old sapphire + new blue) | **Reject** — one system |
| Decorative colour / large blue fields | **Reject** |
| Inter as UI primary (founder lock) | **Adopt** |

### Supersession

| Prior lock | v1.0 |
|------------|------|
| Accent `#1B4F9C` | Signature Blue `#2563EB` |
| Avenir Next + IBM Plex | **Inter** + system-ui |
| Radius 8 / 12 | Radius **16px** family |
| Cards rare by default | Cards allowed as **system components**; still no card farms / no hero card stacks |

---

## 1. Brand communication

Interfaces must feel: Trust · Precision · Simplicity · Speed · Professionalism · Premium Quality.

Never: cheap, cluttered, rainbow, banking-blue washes, loud gradients.

**Colour thesis:** White is the brand. Blue is the accent. Use colour sparingly.

---

## 2. Colour tokens

### Distribution

| Share | Role |
|------:|------|
| ~70% | White |
| ~20% | Soft grey / silver |
| ~10% | Signature blue (interactive only) |

### Never

- Large blue backgrounds  
- Blue as page chrome  
- Banking “full blue header” patterns  

### Blue only for

Primary buttons · selected states · active nav · links · progress · interactive affordances  

### Palette (locked)

| Token | Hex | CSS variable |
|-------|-----|----------------|
| Primary White | `#FFFFFF` | `--swift-white` / `--color-bg-canvas` |
| Background | `#FAFAFA` | `--swift-bg` / `--color-bg-page` |
| Surface | `#F5F6F8` | `--swift-surface` / `--color-bg-subtle` |
| Border | `#E7EAF0` | `--swift-border` / `--color-border` |
| Primary Text | `#1C1F26` | `--swift-text` / `--color-text-primary` |
| Secondary Text | `#6B7280` | `--swift-text-muted` / `--color-text-secondary` |
| Signature Blue | `#2563EB` | `--swift-blue` / `--color-accent` |
| Blue soft | `#EFF4FF` | `--swift-blue-soft` / `--color-accent-soft` |
| Success | `#16A34A` | `--color-success` |
| Warning | `#F59E0B` | `--color-warning` |
| Danger | `#DC2626` | `--color-danger` |
| Text inverse | `#FFFFFF` | `--color-text-inverse` |

Status colours: badges, chips, brief banners — never full-screen washes. Danger only for real errors / Emergency.

**Code:** `platform/design-system/tokens/`

---

## 3. Typography tokens

| Role | Weight | Size (desktop) | Token |
|------|--------|----------------|-------|
| Display | 700 | 32–40px | `--font-display` |
| Heading | 600 | 20–28px | `--font-heading` |
| Body | 400 | 16px | `--font-body` |
| Button | 500 | 14–16px | `--font-button` |
| Caption | 400 | 12–13px | `--font-caption` |

**Primary:** Inter  
**Fallback:** system-ui, sans-serif  

Readability over decoration. Sentence case in product UI. Tabular lining for money/IDs via `font-variant-numeric: tabular-nums` (Inter).

---

## 4. Spacing system (8-point)

`4 · 8 · 16 · 24 · 32 · 40 · 48 · 64`

| Token | px |
|-------|---:|
| `space-1` | 4 |
| `space-2` | 8 |
| `space-3` | 16 |
| `space-4` | 24 |
| `space-5` | 32 |
| `space-6` | 40 |
| `space-7` | 48 |
| `space-8` | 64 |

Generous whitespace. One primary action per view when possible.

---

## 5. Radius & elevation

### Radius

| Token | Value | Use |
|-------|------:|-----|
| `radius-sm` | 8px | Chips, small controls |
| `radius-md` | 12px | Inputs (compact) |
| `radius-lg` | **16px** | Buttons, cards, sheets, modals |
| `radius-full` | 9999px | Avatars only — not pill CTAs by default |

### Elevation (soft shadows)

| Token | Value | Use |
|-------|-------|-----|
| `elevation-0` | none | Default lists / page |
| `elevation-1` | `0 1px 2px rgba(28,31,38,0.04)` | Inputs focus-adjacent |
| `elevation-2` | `0 4px 16px rgba(28,31,38,0.06)` | Cards, dropdowns |
| `elevation-3` | `0 12px 40px rgba(28,31,38,0.10)` | Modals, popovers |

Minimal borders (`--swift-border`). Prefer surface + shadow over heavy outlines.

---

## 6. Motion

150–250ms ease. Fade / short slide. Respect `prefers-reduced-motion`. No fake map motion. No decorative bounce.

---

## 7. Component library (catalogue)

Authoritative inventory — Figma + React must share names:

**Actions:** Button (primary / secondary / ghost / danger), IconButton  
**Inputs:** Text, Textarea, Select/Dropdown, Search, Checkbox, Radio, Switch  
**Data:** Table, List, ListRow  
**Nav:** TopBar, Sidebar, TabBar (mobile), Breadcrumb  
**Overlay:** Modal, Dialog, Sheet  
**Feedback:** Badge, StatusChip, Toast, Banner, Loading, Empty, Error  
**Domain:** MapFrame, TrackingCard, DeliveryCard, AnalyticsCard  
**People:** Avatar  

Rules:

1. One primary button per region.  
2. Status chips use semantic colour sparingly.  
3. Tracking honesty > decoration (no invented motion).  
4. Emergency / danger = high contrast, never ornamental.  

Specs: `platform/design-system/guidelines/components.md`

---

## 8. Icon style

- Stroke 1.5–2px · rounded joins · optical square 24px  
- Single weight; no skeuomorphism  
- Prefer line icons; solid only for selected nav / critical  
- Colour inherits text or Signature Blue when active  
- No emoji as UI icons  

`platform/design-system/guidelines/icons.md`

---

## 9. UX principles (all products)

Every screen answers:

1. Where am I?  
2. What should I do next?  
3. What is the most important information?  

Reduce cognitive load. Design for one-handed mobile (Driver / Customer). Calm, effortless interactions.

Density: Customer/Driver airy · Dispatch/Admin denser tables OK · Enterprise balanced.

---

## 10. Implementation contracts

| Deliverable | Location |
|-------------|----------|
| CSS tokens | `platform/design-system/tokens/*.css` |
| Tailwind preset | `platform/design-system/tailwind/preset.js` |
| Component guidelines | `platform/design-system/guidelines/components.md` |
| React guidelines | `platform/design-system/guidelines/react.md` |
| Figma-ready spec | `platform/design-system/guidelines/figma.md` |
| Icon style | `platform/design-system/guidelines/icons.md` |
| Package README | `platform/design-system/README.md` |

**App migration:** apps import `design-system/tokens/tokens.css` via local `tokens.css` bridge (Dispatch 5173 · Driver 5174 · Customer 5175 · Support 5176).

---

## 11. Approval checklist

- [x] Colour tokens locked  
- [x] Typography tokens locked (Inter)  
- [x] Spacing / radius / elevation locked  
- [x] Component catalogue named  
- [x] Icon style defined  
- [x] Tailwind + React + Figma contracts written  
- [ ] Designer Figma library built from `figma.md`  
- [x] Apps migrated off legacy 08A CSS variables (token bridge → `design-system/tokens`)  

---

**End of SWIFT Design System v1.0**
