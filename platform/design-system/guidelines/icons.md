# Icon style — SWIFT DS v1.0

## Principles

- **Line-first.** 1.5–2px stroke · round caps/joins  
- Optical box **24×24** (touch targets still 44×44)  
- One weight across the set  
- No skeuomorphism, no gradients in glyphs, no emoji as icons  

## Colour

- Default: inherit `--swift-text` or `--swift-text-muted`  
- Active / selected: `--swift-blue`  
- Danger only for destructive / Emergency icons  

## Library recommendation

Prefer a single open set for Wave-1 (e.g. Lucide or Heroicons **outline**) remapped to stroke width 1.75–2. Do not mix filled + outline randomly.

## Naming

Use action nouns: `nav-home`, `job-track`, `action-search`, `status-warning`, `emergency-sos`.

## Don’t

- Multicolour icons in chrome  
- Oversized decorative icons in empty states (>48px without purpose)  
- Blue icons on blue backgrounds  
