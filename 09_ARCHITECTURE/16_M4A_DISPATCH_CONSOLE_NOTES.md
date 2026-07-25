# M4a — Dispatcher Console (Implementation Notes)

**Status:** DELIVERED (first real UI)  
**Depends on:** M4 APIs  
**App:** `platform/apps/dispatch-console/`  
**Run:** `cd platform/apps/dispatch-console && npm install && npm run dev`  
**URL:** http://localhost:5173 (proxies API to :3000)

## Screens covered

| Screen | Notes |
|--------|--------|
| SC-DI-001 Login | OTP email; auto-grants `dispatcher` in local via `/v1/dev/assign-role` |
| SC-DI-002 Board | Queue + honest map placeholder (no fake GPS) |
| SC-DI-003 Detail | Job facts + assignment state |
| SC-DI-004 Assign / reassign | Eligible drivers + reason field |
| SC-DI-005 Backup | Backup action on detail |
| SC-DI-010 Driver panel | Duty / eligibility list when no job selected |

## Design

Phase 8 + **08A token lock** (`tokens.css`): white/silver/charcoal/sapphire; Fraunces + IBM Plex; lists not cards; one primary CTA; honest map stage (no fake motion); hold banner; `prefers-reduced-motion` respected.

## Deferred

Live map (M5), incident board depth (M8c), AI suggestions (W4).
