# VUUSH Visual Principles

**Version:** 1.0  
**Status:** LOCKED — Official visual direction source of truth  
**Effective:** 2026-07-24  
**Owner:** Ariel Johannes · VUUSH  
**Atlas path:** `01_BRAND/Visual Principles.md`  
**Parent:** [`Brand Foundation.md`](./Brand%20Foundation.md) (v1.0)  
**Language companion:** [`Voice & Tone.md`](./Voice%20%26%20Tone.md) (v1.0)

---

## Authority

This document defines how VUUSH should look and feel.

It governs product UI, brand surfaces, and design-system evolution. It sits above component libraries and token files: tokens implement these principles; they do not redefine the brand.

**Related technical specs (implementation detail):**

- `09_ARCHITECTURE/08_DESIGN_ARCHITECTURE.md` — Phase 8 design architecture  
- `09_ARCHITECTURE/22_SWIFT_DESIGN_SYSTEM_V1.md` — current DS v1 token lock (legacy filename until an authorised migration)  
- `platform/design-system/` — engineering tokens  

Where visual direction conflicts with marketing taste or feature urgency, **this document + Brand Foundation win**.

This is **not** a licence to redesign every screen immediately. Bulk UI rebrand and package rename wait for an authorised migration programme.

---

## 1. Visual thesis

> **Quiet surfaces. Exact hierarchy. One clear Point of commitment. Motion that tells the truth.**  
> VUUSH should feel effortless and premium — never rushed, never loud.

People should feel: **calm, trust, precision, simplicity, intelligence, premium quality.**

---

## 2. Relationship to The Point

| Idea | Visual consequence |
|------|-------------------|
| Before The Point | Softer chrome; exploration feels reversible |
| At The Point | One unmistakable primary action; higher contrast / weight on commit |
| After The Point | Steady status; no celebration clutter; progress is honest |
| The square mark | Signature beside the wordmark — rare, small, exact |
| Square as craft unit | Spacing, rhythm, and containment may feel quietly modular — without painting squares on every control |

**Anti-gimmick rule:** The brand square is not a UI motif. If a screen is covered in decorative squares, it is wrong.

---

## 3. Core visual principles

### 3.1 One composition, one job

Each viewport or major section has a single job and a clear hierarchy.

- One primary message or action  
- Secondary content earns its place or waits below  
- Avoid dashboard collage on transactional and mobile surfaces  

**Reject:** Competing heroes, stat strips for decoration, card stacks that hide the real task.

---

### 3.2 Threshold clarity

Soft states and committed states must be visually distinguishable.

| Soft (before) | Commit (at) | Carrying / done (after) |
|---------------|-------------|-------------------------|
| Lighter emphasis | Strong primary control | Clear status, calm layout |
| Edit freely | Consequence visible near the action | No fake “all good” chrome |

**Reject:** Primary-styled buttons on non-commit actions; commit actions that look like optional chips.

---

### 3.3 Quiet premium

Quality comes from restraint: space, type, alignment, and materials — not ornament.

- Light, airy default  
- Generous but purposeful whitespace  
- Few borders; prefer structure through type and spacing  
- Accent colour is rare and intentional  

**Reject:** Purple AI gradients, glow theatre, glassmorphism noise, sticker badges on heroes, luxury kitsch.

---

### 3.4 Truthful motion

Motion explains change, presence, or continuity. It never invents progress.

- Prefer short, confident transitions (presence, hierarchy)  
- Live markers move only on real signal  
- Loading states are honest; empty states are calm  

**Reject:** Skeleton theatre that implies data you don’t have; bouncing urgency; confetti for ordinary completion.

---

### 3.5 Colour discipline

Colour serves meaning. It does not entertain.

| Role | Direction |
|------|-----------|
| Canvas | Light / white dominant |
| Structure | Soft silver / quiet grey surfaces |
| Type | Charcoal hierarchy |
| Accent | Single restrained brand accent — used sparingly (CTAs, key focus, rare highlights) |
| Success | Restrained confirmation — not a green carnival |
| Attention | Signal only when action is needed soon |
| Danger | Reserved for real failure and emergency — never decoration |

Exact hex values live in the design-system token lock. **Roles above are constitutional.**

**Reject:** Full-screen danger washes; accent as wallpaper; status colour as personality.

---

### 3.6 Typography as precision

Type carries calm authority.

- Clear hierarchy: display / title / body / meta  
- Readable sizes; no novelty fonts for core product  
- Prefer expressive but purposeful brand type on marketing and sign-in heroes; product UI stays highly legible  
- Numbers and codes (job IDs, plates) may use mono where scanning matters  

**Reject:** Default “startup Inter everywhere” as a brand story; tiny grey legal as primary instruction; shouting all-caps UI.

*(Font file choices may evolve under migration; the principle of precision and calm does not.)*

---

### 3.7 Density by role, soul unchanged

| Surface | Density | Still VUUSH |
|---------|---------|-------------|
| Customer | Spacious, guided | Calm, clear Point |
| Driver | Thumb-first, high clarity under stress | Dignified, exact |
| Dispatch / support / admin | Higher density, scannable | Same colour ethics, same commit honesty |

**Reject:** A pretty consumer app and a neglected ops tool that feel like different companies.

---

### 3.8 The mark

**Wordmark + square**

- Square sits beside VUUSH — small, aligned, understated  
- Timeless geometry; no gradients inside the mark for novelty  
- Do not animate the square as a mascot  
- Do not tile it, stamp it on photos, or replace system icons with it  

**App icon / future systems:** May derive from The Point (square unit) if the result stays simple. Complexity is failure.

---

### 3.9 Imagery and environment

When photography or environment appear:

- Real context: people, places, product in use — not stock hustle  
- Light, honest, uncluttered frames  
- Physical brand spaces (future): light, calm materials, quiet confidence  

**Reject:** Neon warehouse clichés; fake “AI brain” renders as the hero story.

---

### 3.10 Accessibility is premium

Contrast, focus, hit targets, and readable type are part of Calm Precision — not a compliance afterthought.

Emergency and critical actions stay high-contrast and reachable (especially driver).

---

## 4. Layout doctrine (product)

1. **Brand-first on branded entries** — Sign-in and marketing heroes: VUUSH (and mark) must read as the identity, not a nav afterthought.  
2. **Commit-first on transactional screens** — The primary action that is The Point must be obvious within one glance.  
3. **Status near truth** — Integrity, pause, and failure appear close to the thing they describe — calmly.  
4. **Cards are not the default** — Use containment when interaction or grouping requires it; do not card-wrap everything.  
5. **Mobile: thumb and clarity** — Driver and customer primary paths survive one-hand use and stress.

---

## 5. Motion doctrine (short)

| Use motion for | Do not use motion for |
|----------------|------------------------|
| Enter/exit of real UI | Fake vehicle movement |
| Drawing attention to a true state change | Constant idle animation |
| Smooth continuity of a live signal | “Energy” that implies haste |

Ship few intentional motions. Prefer stillness with clear state over busy life.

---

## 6. Kill list (visual anti-patterns)

- Urgency countdowns used as brand personality  
- Pill clusters, badge stickers, and promo chrome in the first viewport  
- Different accent personality per app  
- Dark-mode-first as the brand default  
- Decorative use of danger red  
- Logo square as bullet, checkbox, map pin, or loading spinner by default  
- Maximalist dashboards on simple tasks  

---

## 7. Design review questions

Before approving a visual:

1. Does this feel **calm and exact** — or busy and eager?  
2. Is **The Point** (commit) visually unmistakable if this screen has one?  
3. Would removing ornament **improve** understanding?  
4. Does this still feel like **one company** next to the other apps?  
5. Is any motion or colour **telling the truth**?  
6. Is the square mark **absent or earned** — never filler?

---

## 8. What this version does *not* do

- Does not rename design-system files or CSS tokens (migration holds)  
- Does not force an immediate full UI restyle of Wave-1 apps  
- Does not replace Phase 8 token tables — it governs them  
- Does not define a full marketing brand book photography library (later)

When implementation is authorised, visual work should converge toward these principles without violating product integrity mid-RC.

---

## 9. Governance

| Topic | Rule |
|-------|------|
| Parent authority | Brand Foundation v1.0 |
| Visual authority | This document (v1.0+) |
| Token / component specs | Must implement these principles |
| Changes | Amend in place with version bump |
| Conflicts with legacy SWIFT naming in files | Meaning is VUUSH; filenames may lag until migration |

---

## 10. Revision History

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-07-24 | Initial locked Visual Principles from Brand Foundation v1.0 |

---

*VUUSH — Quiet surfaces. Exact hierarchy. Truthful motion. One clear Point.*
