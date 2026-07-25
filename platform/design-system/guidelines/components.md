# Component guidelines — SWIFT DS v1.0

Shared names for Figma + React. Build components against tokens only — no hard-coded hex.

## Button

| Variant | Surface | Text | Use |
|---------|---------|------|-----|
| Primary | `--swift-blue` | white | One per region — main next action |
| Secondary | white | `--swift-text` | Border `--swift-border` |
| Ghost | transparent | `--swift-text-muted` | Tertiary |
| Danger | `--swift-danger` | white | Destructive / Emergency confirm only |

- Height: 44–48px (mobile), 40–44px (desktop dense)
- Radius: `--radius-lg` (16px)
- Weight: 500 · Padding: 16–24px horizontal
- Never full-width blue bars as decoration

## Input / Textarea / Select

- Background: white · Border: `--swift-border` · Radius: 12–16px
- Focus: 3px `--color-focus` ring · border → blue
- Label: caption / secondary text above field
- Error: danger border + caption below

## Search

Input pattern + leading search icon (stroke). Clear affordance when value present.

## Dropdown

Elevation-2 panel, radius 16px, 4px gap from trigger. Item hover: `--swift-blue-soft`.

## Table

Header: muted caption, medium weight. Rows: hairline borders or zebra `--swift-surface`. No heavy card wrapping every row in Dispatch.

## List / ListRow

Default for queues. Padding 16px. Selected: `--swift-blue-soft` + blue indicator, not a thick blue slab.

## TopBar

Height 64px. White / bg. Bottom border. Brand left · utilities right. No large blue header.

## Sidebar

Width ~280px. Surface or white. Active item: blue soft + blue label/icon.

## TabBar (mobile)

Bottom safe-area. Active = Signature Blue label/icon only.

## Modal / Dialog

Elevation-3 · radius 16px · max-width 480–560px · scrim `rgba(28,31,38,0.4)`.

## Badge / StatusChip

Pill or 8px radius. Soft semantic fill + strong text. Sizes: sm/md.

| Status | Chip |
|--------|------|
| Success / delivered | success soft |
| Warning / degraded | warning soft |
| Danger / emergency | danger soft |
| Info / selected | blue soft |

## Avatar

Circle (`radius-full`). Initials on surface. Sizes 24 / 32 / 40.

## Cards (Tracking / Delivery / Analytics)

Allowed when the card **is** the interaction container. Radius 16px · elevation-2 · padding 16–24.  
Do **not** nest card farms on home heroes. Prefer one focal card + lists.

## MapFrame

Neutral silver chrome. No vendor neon. Markers: charcoal + blue for “you/selected”. Honest last-known: static marker, no fake glide.

## Loading / Empty / Error

- Loading: quiet spinner or skeleton in surface grey — no branded rainbow  
- Empty: one sentence + one CTA  
- Error: danger text; calm recovery action  

## Domain density

| Product | Note |
|---------|------|
| Customer / Driver | Airy, 48px taps |
| Dispatch / Admin / Support | Denser tables OK |
| Enterprise / Fleet / AI Ops | Balanced dashboards; still 70/20/10 colour |
