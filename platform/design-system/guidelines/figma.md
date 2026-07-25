# Figma-ready specification — SWIFT DS v1.0

Build the Figma library to match these pages and token names exactly so engineering can 1:1 map variables.

## File structure

```
SWIFT Design System v1.0
├── 🖋 Cover
├── 🎨 Foundations
│   ├── Colour
│   ├── Typography
│   ├── Spacing & Grid
│   ├── Radius
│   └── Elevation
├── 🧩 Components
│   ├── Actions
│   ├── Inputs
│   ├── Navigation
│   ├── Feedback
│   ├── Data display
│   └── Domain (Tracking / Delivery / Analytics / Map)
├── ✦ Icons
└── ✅ Examples (one calm screen per product — not a mock dump)
```

## Figma variables

| Collection | Modes |
|------------|-------|
| Colour | Light (only mode Wave-1) |
| Spacing | Default |
| Radius | Default |

Map hex values from `22_SWIFT_DESIGN_SYSTEM_V1.md` §2. Name variables `swift/blue`, `swift/text`, etc.

## Typography styles

| Style | Size / weight |
|-------|----------------|
| Display/Bold | 36 / 700 |
| Heading/Semibold | 24 / 600 |
| Title/Semibold | 28 / 600 |
| Body/Regular | 16 / 400 |
| Button/Medium | 15 / 500 |
| Caption/Regular | 13 / 400 |

Font family: **Inter**.

## Component set conventions

- Variants via properties: `Variant`, `Size`, `State` (default / hover / focus / disabled / error)  
- Auto-layout everywhere; 8-point spacing  
- Publish as team library **SWIFT DS v1**  

## Example frames (optional, one each)

Customer home · Driver duty · Dispatch queue · Support inbox — using components only. No one-off colours.

## Handoff

Dev mode: export token JSON optional; primary contract remains CSS + Tailwind preset in repo.
