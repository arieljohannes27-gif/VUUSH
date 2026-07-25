# SWIFT Design System — Tailwind tokens reference

Generated from `tailwind/preset.js`. Use classes like:

```html
<div class="bg-swift-bg text-swift-text">
  <button class="bg-swift-blue text-white rounded-lg shadow-elevation-2 px-4 py-2 font-medium">
    Continue
  </button>
  <p class="text-caption text-swift-muted">Helper</p>
</div>
```

| Concern | Tokens |
|---------|--------|
| Colour | `swift-white`, `swift-bg`, `swift-surface`, `swift-border`, `swift-text`, `swift-muted`, `swift-blue`, `swift-blue-soft`, `swift-success`, `swift-warning`, `swift-danger` |
| Type | `font-sans`, `text-display`, `text-heading`, `text-body`, `text-button`, `text-caption` |
| Space | `p-3` (=16px in preset spacing scale 1–8) — prefer preset scale |
| Radius | `rounded-lg` (=16px) |
| Shadow | `shadow-elevation-1` … `3` |
