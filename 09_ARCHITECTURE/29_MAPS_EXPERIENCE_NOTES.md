# M5b — Maps Experience (Implementation Notes)

**Status:** DELIVERED (Wave-1 beachhead)  
**Design:** `28_MAPS_EXPERIENCE_DESIGN.md` **APPROVED**  
**Date:** 2026-07-24  

## Done

- [x] MapLibre display maps (OpenFreeMap liberty — no API key for dogfood)  
- [x] Customer live marker + integrity freeze  
- [x] Car icon + smooth glide between real GPS pings (heading-aware)  
- [x] Driver cockpit: map-first active job  
- [x] Auto-nav on Accept / Open job / post-pickup (system Google/Apple Maps)  
- [x] Recover interstitial if popup blocked  
- [x] `navTarget` on `GET /v1/drivers/me`  
- [x] Dispatch city board real tiles + last-known markers  
- [x] Flag `maps_experience_enabled` (default on) + `GET /v1/config/beachhead`  

## Code

| Area | Path |
|------|------|
| Shared reference | `platform/shared/maps/` (copied into apps) |
| Customer / Driver / Dispatch | `apps/*/src/maps/` |
| Driver home nav | `dispatch/service.ts` → `navTarget` |

## Dogfood

1. Customer: book → pay → **Track** → map with pickup/dropoff line  
2. Driver: accept offer → system maps should open (or Tap to navigate)  
3. After pickup proof → auto-nav to dropoff  
4. Dispatch: board shows real map markers when sessions have coords  

## Deferred

- Native in-app turn-by-turn  
- Single shared npm package (apps currently hold copies)  
- Paid map vendor account / SLA tiles  
- Multi-stop B2B runs (Wave-2)  
