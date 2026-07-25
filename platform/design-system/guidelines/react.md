# React component guidelines — SWIFT DS v1.0

## Package intent

Future `@swift/ui` (or `platform/packages/ui`) implements this system. Until then, apps import CSS tokens from `design-system/tokens/tokens.css`.

## Rules

1. **Tokens only** — no raw `#2563EB` in components; use CSS variables or Tailwind `swift.*`.  
2. **Composition** — primitives (Button, Input) stay dumb; domain cards compose primitives.  
3. **Accessibility** — focus rings use `--color-focus`; icon-only buttons need `aria-label`.  
4. **Motion** — CSS transitions via `--motion-*`; respect `prefers-reduced-motion`.  
5. **Density props** — `size="sm" | "md" | "lg"`; Driver/Customer default `lg` taps.  
6. **No dark mode API yet** — deferred; do not add `theme="dark"` half-measures.  

## Suggested primitive API

```tsx
// Illustrative — not shipped in this deliverable
<Button variant="primary" | "secondary" | "ghost" | "danger" size="md">
<TextField label error hint />
<StatusChip tone="success" | "warning" | "danger" | "info" />
```

## Import pattern

```tsx
import "@swift/design-system/tokens/tokens.css";
// later:
// import { Button } from "@swift/ui";
```

## Fonts

Load Inter once at app shell:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

## Anti-patterns

- Local one-off palettes per app  
- Cards wrapping every list row in Dispatch  
- Large blue layout regions  
- Inter mixed with legacy Fraunces / Plex / Avenir in the same view after migration  
