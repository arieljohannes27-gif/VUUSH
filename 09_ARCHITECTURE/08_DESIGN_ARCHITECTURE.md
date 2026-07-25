# Phase 8 — Design Architecture

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-20  
**Depends on:** Phases 1–6 approved · Phase 7 (**APPROVED** 2026-07-20)  
**Phase gate:** Phase 8 locked as baseline. Amendments require explicit revision. Phase 9 unlocked.

---

## 0. Executive Position

Phase 8 defines the **design system**: how SWIFT looks, feels, and behaves across every product surface. This is not marketing collage. It is the operational language of calm trust.

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| Dashboard-card chaos on every screen | **Reject** | Raises stress; violates “technology disappears” |
| Purple-gradient “AI startup” look | **Reject** | Generic; not SWIFT |
| Dark mode first | **Reject** | Brand is light, airy, premium; dark is secondary |
| Loud warning colours everywhere | **Reject** | Cries wolf; breaks calm |
| Different UI language per app | **Reject** | Destroys one-company feel |
| **One calm system: light, spacious, precise, human** | **Adopt** | Matches brand promise |

### Design thesis

> Fewer decisions. More air. Clear hierarchy. Motion that reassures.  
> Colour is quiet; sapphire speaks only when needed.  
> **Emergency and truth must never be styled as decoration.**

Inspiration to *absorb*, not copy: Apple, Stripe, Linear, Notion, Porsche calm, Scandinavian light, Japanese restraint, Swiss clarity.

---

## 1. Brand Guidelines (Design Binding)

| Pillar | Design implication |
|--------|-------------------|
| Trust | Honest status colours; no fake progress animation |
| Reliability | Consistent components; predictable patterns |
| Premium | Restraint over ornament; quality typography |
| Simplicity | One primary action per view when possible |
| Calm | Soft surfaces, low visual noise, generous space |
| Human warmth | Friendly copy + soft radii — never cold clinic sterility |
| Safety | Emergency controls high contrast, always reachable (Driver) |

**Brand promise in UI:** Every screen should make “Done Right” feel plausible.

**Voice in UI:** Clear, calm, confident, warm, precise (see Brand Voice handbook). No blame language. No jargon without need.

---

## 2. Colour Palette

### 2.1 Core tokens (semantic names)

| Token | Role | Directional value | Usage |
|-------|------|-------------------|-------|
| `color.bg.canvas` | Primary | White `#FFFFFF` | App backgrounds |
| `color.bg.subtle` | Secondary | Soft Silver `#F3F4F6` → calibrate | Sheets, zebra, side areas |
| `color.bg.elevated` | Surface | White / slight silver | Modals, key panels |
| `color.text.primary` | Typography | Charcoal `#1F2937` class | Body, titles |
| `color.text.secondary` | Muted text | Charcoal @ ~60–70% | Meta, hints |
| `color.text.inverse` | On accent | White | Text on sapphire buttons |
| `color.accent.primary` | Accent | Sapphire Blue `#1B4F9C` class | Primary CTA, key links, focus |
| `color.border.subtle` | Lines | Silver-grey | Dividers, input borders |
| `color.success` | Success | Green (restrained) | Delivered, paid, success |
| `color.signal` | Attention | Signal Yellow | Needs action soon — not panic |
| `color.warning` | Warning | Amber (minimal) | Caution states |
| `color.danger` | Critical | Red (minimal, serious) | Errors, Emergency, S1 |
| `color.focus` | Focus ring | Sapphire glow subtle | Keyboard/accessibility |

Exact hex lock historically in `08A`; **product UI tokens now locked by SWIFT Design System v1.0** (`22_SWIFT_DESIGN_SYSTEM_V1.md`, `platform/design-system/`). Roles above remain constitutional where they do not conflict with v1 (white brand, blue accent sparingly, danger reserved).

### 2.2 Usage rules

1. **White + silver dominate.** Sapphire is rare and intentional.  
2. **Never decorate with danger red.** Reserve for real failures / Emergency.  
3. Status colours appear in **badges, icons, brief banners** — not full-screen washes.  
4. Charts: sapphire + charcoal + limited secondaries; no rainbow spaghetti.  
5. Physical brand materials (oak, glass, aluminium) inform marketing/environments more than app chrome.

### 2.3 Do / Don’t

| Do | Don’t |
|----|-------|
| Quiet backgrounds, strong type hierarchy | Neon gradients, glassmorphism overload |
| One sapphire CTA | Competing purple/pink buttons |
| Honest yellow for “delayed” | Green “on the way” when signal is lost |

---

## 3. Typography

### 3.1 Principles

- Expressive but readable; **not** default Inter-as-personality alone if a sharper pair fits premium logistics — choose a clear **sans** system font stack suitable for UI + a restrained display option for brand moments.  
- **Locked display (2026-07-23):** Avenir Next for brand moments; IBM Plex Sans + Mono for product UI (`08B_TYPOGRAPHY_AMENDMENT.md`).  
- Charcoal on white for body; never light grey body text that fails contrast. Deep charcoal for primary type is encouraged; **black/dark-first canvases are not** (dark mode deferred).  
- Short labels; sentence case preferred in product UI.

### 3.2 Scale (directional)

| Token | Use | Approx |
|-------|-----|--------|
| `font.display` | Rare brand moments | 32–40 |
| `font.title` | Screen titles | 24–28 |
| `font.heading` | Section headers | 18–20 |
| `font.body` | Primary reading | 16 |
| `font.small` | Meta, timestamps | 13–14 |
| `font.mono` | Job codes, IDs | 13–14 tabular |

**Line length:** Comfortable; avoid dense newspaper walls in apps.  
**Weight:** Regular + Medium + Semibold; avoid constant Black weights.

### 3.3 Product density

| Surface | Density |
|---------|---------|
| Customer App | Airy, large tap targets |
| Driver App | Large controls, glanceable, one-thumb Emergency |
| Dispatch / Ops / Finance | Denser but still clear; tables OK |
| Enterprise Portal | Balanced; governable, not cluttered |

---

## 4. Spacing & Grid

### 4.1 Spacing scale (4-point base)

`4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64`

| Token | Common use |
|-------|------------|
| `space.xs` 4 | Icon gaps |
| `space.sm` 8 | Compact stacks |
| `space.md` 16 | Default padding |
| `space.lg` 24 | Section gaps |
| `space.xl` 32–40 | Screen margins mobile |
| `space.xxl` 48–64 | Web hero/marketing only |

### 4.2 Grid

- **Mobile:** 4-column mental grid; 16–20px side margins  
- **Tablet:** 8-column  
- **Web consoles:** 12-column; max content width for reading panels ~1120–1280px; full-bleed maps/queues allowed  
- **Alignment:** Consistent left edges; optical alignment over rigid clutter  

### 4.3 Spaciousness rule

If a screen feels busy, remove chrome before adding colour. **Every element must earn its pixels.**

---

## 5. Elevation, Radius, Materials

| Token | Direction |
|-------|-----------|
| Radius small | 8px inputs/buttons |
| Radius medium | 12px sheets |
| Radius large | 16–20px rare marketing |
| Shadow | Minimal; soft single-layer if any — no multi-glow stacks |
| Borders | 1px subtle silver preferred over heavy shadow cards |

**Cards doctrine (product UI):**  
Default to **sections and lists**, not card farms. Use a contained surface only when it groups a **single interactive unit** (e.g. one job summary tappable). If removing the border/shadow doesn’t hurt understanding, remove it.

---

## 6. Components

### 6.1 Buttons

| Type | Use |
|------|-----|
| **Primary** | One per view when possible — sapphire fill, white text |
| **Secondary** | Charcoal outline / silver fill |
| **Tertiary / ghost** | Low emphasis |
| **Danger** | Destructive confirm only |
| **Emergency** (Driver) | Persistent, high-contrast, distinct from Primary — not cute |

States: default · hover/press · disabled · loading.  
Min tap target **44×44** pt/dp equivalent.

### 6.2 Forms

- Labels above fields  
- Helper text calm and short  
- Errors inline, specific, non-blaming  
- Group related fields; progressive disclosure for advanced options  
- Quote/price breakdown expandable, summary always clear  

### 6.3 Lists & “cards”

- Job rows: status pip + primary fact (where/when) + secondary meta  
- Avoid nested card-in-card  
- Swipe actions sparingly (Driver); always have visible alternatives  

### 6.4 Inputs & selection

Text, phone, address (map + text), selectors, date/time windows, toggles, segmented controls for few options (better than deep dropdowns when ≤4).

### 6.5 Icons

- Simple line/duotone charcoal; sapphire for active  
- One icon family across products  
- Status icons pair with text — colour not sole channel (accessibility)  
- No emoji as UI system  

### 6.6 Navigation

| Product | Pattern |
|---------|---------|
| Customer App | Bottom tabs (few) + stack |
| Driver App | Minimal tabs; **active job dominates**; Emergency always accessible |
| Web portals | Left nav (collapsible) + top context (org, city, user) |
| Dispatch | Map + queue split; keyboard-friendly |

Navigation labels: plain words (Home, Jobs, Wallet/Earnings, Support, Settings).

### 6.7 Tables (consoles)

- Clear header, sortable where useful  
- Row click → detail  
- Sticky first column if needed  
- Empty states that teach next action  
- Bulk actions rare and confirmed  

### 6.8 Charts

- Prefer simple lines/bars for Ops/BI  
- Always labelled axes; no chartjunk  
- Colour-blind safe palettes  
- Near-realtime Ops charts must show **as-of** timestamp  

### 6.9 Banners & toasts

- Info / success / signal / danger  
- Toasts for confirmations; banners for persistent holds (`INCIDENT_HOLD`)  
- Customer delay copy follows Phase 1 communication standard  

### 6.10 Modals & sheets

- Use for confirmation, mutations (price delta), Emergency type picker  
- Never trap users away from safety actions  

---

## 7. Status & Trust Visual Language

| State class | Visual |
|-------------|--------|
| Draft / quoted | Neutral |
| Confirmed / assigned | Sapphire subtle |
| In transit (Fresh tracking) | Calm progress |
| Degraded / lost signal | Signal yellow + honest copy — **no fake moving map** |
| Delivered | Success green quiet |
| Failed attempt | Neutral + reason; path to next action |
| Incident hold | Serious banner; limited detail for security events |
| Emergency active | Danger treatment on driver side; calm pause on customer side |

---

## 8. Motion

### 8.1 Principles

Motion communicates **confidence**, not playfulness.

| Motion | Use |
|--------|-----|
| Soft fade/slide 150–250ms | Sheet appear |
| Progress determinate | Real upload/POD |
| Skeleton loaders | Loading — not fake route drawing |
| Map marker updates | Only on real signals |
| Micro-press on buttons | Tactile confirm |

**Forbidden:** celebratory confetti on every delivery; looping fake “searching driver” animations that outlive truth; parallax noise on consoles.

### 8.2 Mandatory motion moments (product presence)

1. Job confirm → quiet success acknowledgment  
2. Driver Emergency → immediate visual lock-in that help path started  
3. Hold/pause → clear transition to truthful paused state  

---

## 9. Accessibility

| Requirement | Standard direction |
|-------------|-------------------|
| Contrast | Body text WCAG AA minimum on white/silver |
| Focus | Visible focus rings on web |
| Targets | ≥44×44 interactive |
| Colour | Not the only status cue |
| Screen readers | Labels on icon buttons; Driver Emergency named |
| Dynamic type | Mobile apps respect OS text scaling where feasible |
| Reduced motion | Respect OS setting; cut nonessential motion |
| Language | Plain language; English-first Wave 1 |

Accessibility is **premium**, not optional compliance theatre.

---

## 10. Dark Mode Strategy

| Decision | Detail |
|----------|--------|
| **Wave 1 default** | Light mode only (brand-true) |
| **Dark mode** | Phase later; optional for Driver night shifts first if demanded |
| **If/when built** | Recalibrate silver/charcoal; keep sapphire accent; never invert carelessly |
| **Consoles** | Light default; user preference later |

Do not ship an incomplete dark theme that breaks contrast on maps/tables.

---

## 11. Product-Specific Design Notes

| Product | Design emphasis |
|---------|-----------------|
| Customer App | Booking in few steps; tracking calm; support entry obvious |
| Driver App | Glanceable next action; huge Emergency; earnings clear; low clutter |
| Enterprise | Trust, tables, approvals; sober not flashy |
| Dispatcher | Situational awareness; queue priority; map readability |
| Finance | Numbers clarity; tabular figures; cautious danger on irreversible money |
| Support | Job timeline legibility; macros that still feel human |
| Admin | Config denser; danger zones clearly marked |
| BI | Honest charts; as-of stamps; no vanity decoration |

---

## 12. Content Design (UI Writing)

- Prefer “Delivery paused — we’re arranging another driver” over “Error 503”  
- Fee changes show **before** confirm  
- Mutation price deltas explicit (PR20)  
- Security events: limited, legal-safe wording (4B)  

---

## 13. Design Governance

1. Atlas Phase 8 is source of visual truth until a living component library exists.  
2. New components require: purpose, states, a11y notes.  
3. Marketing sites may be more expressive but must use same colour/type DNA.  
4. No parallel “designer exploration brands” in production apps.  

---

## 14. Handoff to Phase 9

Phase 8 defines the **system**.  
Phase 9 inventories **every screen** and its purpose, applying this system.

---

## 15. Decisions Log (Phase 8)

| ID | Decision |
|----|----------|
| DES-D1 | Light, calm, white/silver/charcoal/sapphire system |
| DES-D2 | Cards are rare; sections/lists default |
| DES-D3 | One primary CTA; Emergency is its own pattern |
| DES-D4 | No fake motion for tracking when signals are bad |
| DES-D5 | Dark mode deferred; light is brand default |
| DES-D6 | Minimal shadow; soft radius; Swiss clarity |
| DES-D7 | Accessibility AA as premium bar |
| DES-D8 | Same design DNA across all 11 products; density varies by role |
| DES-D9 | Status colour discipline; danger reserved |
| DES-D10 | Motion only for confidence and safety acknowledgment |

---

## 16. Risks

| Risk | Mitigation |
|------|------------|
| Designer invents a second brand | Gate on Phase 8 tokens |
| Dispatch UI becomes spreadsheet soup | Apply density rules + empty states |
| Driver UI over-designed | Glance tests with real glare/one thumb |
| Dark mode rushed | Keep deferred |
| Marketing site drifts from app | Shared tokens |

---

## 17. Assumptions

| # | Assumption |
|---|------------|
| DES-A1 | Exact font files chosen at implementation; must meet premium + license + Latin needs |
| DES-A2 | Hex values above are directional until design-token lock |
| DES-A3 | English UI Wave 1 |
| DES-A4 | Map provider styling tuned to silver/white/sapphire, not vendor default neon |
| DES-A5 | High-fidelity Figma library may follow approval; Atlas remains authority |

---

## 18. Out of Scope

- Full screen-by-screen layouts → **Phase 9**  
- React/SwiftUI code → later  
- Logo construction kit minutiae → Brand handbook expansion  
- Photo art direction for ads → Marketing  

---

## 19. Approval Checklist

- [ ] Colour & type system accepted  
- [ ] Spacing/grid/component doctrines accepted  
- [ ] Cards/motion/status/Emergency rules accepted  
- [ ] Dark mode deferral accepted  
- [ ] Assumptions DES-A1–DES-A5 accepted or amended  
- [ ] Ready to open Phase 9 — Screen Architecture  

**Approval response options:**  
`APPROVE PHASE 8` · `APPROVE PHASE 8 WITH AMENDMENTS: …` · `REVISE: …`
