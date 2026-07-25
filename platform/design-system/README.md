# @swift/design-system

**SWIFT Design System v1.0** — official visual language for all SWIFT products.

Atlas authority: `09_ARCHITECTURE/22_SWIFT_DESIGN_SYSTEM_V1.md`

## What’s in this package

| Path | Purpose |
|------|---------|
| `tokens/tokens.css` | Single CSS import (colour, type, space, elevation) |
| `tokens/*.css` | Split token files |
| `tailwind/preset.js` | Tailwind preset (`swift.*` colours, Inter, 8-pt space) |
| `guidelines/` | Components, icons, React, Figma |

## Use in an app

```css
/* main entry */
@import "../../../design-system/tokens/tokens.css";
```

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

```js
// tailwind.config.js
module.exports = {
  presets: [require("../design-system/tailwind/preset.js")],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
};
```

## Design rules (short)

- **70% white · 20% silver · 10% blue**  
- Blue only for interactive accents — never large blue backgrounds  
- Inter for all product UI  
- Radius 16px for primary controls/cards  
- Soft elevation — not heavy Material shadows  

## Not in this package (yet)

React primitives (`Button`, etc.) — guidelines first; `@swift/ui` follows.  
Do not treat legacy app `tokens.css` as source of truth after migration.
