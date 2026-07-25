# Surface rebrand notes

**Status:** Done (2026-07-24)  
**Scope:** Visible VUUSH brand on Wave-1 apps — **not** a full technical rename.

## Shipped

- Wordmark **VUUSH** + square mark (The Point) on Customer, Driver, Dispatch, Support, Admin  
- Mark: **black** square · Wordmark: **grey** (`--color-text-secondary`) across all apps  
- Browser titles updated  
- Login defaults use `@vuush.local`  
- Auth accepts `@vuush.local` **and** legacy `@swift.local` for the same mailbox  
- API display name / OTP log / TOTP issuer → VUUSH  
- Service catalogue seed names → VUUSH Standard / Priority (new seeds only)  
- Colours unchanged (Design System tokens)

## Still legacy (intentional)

- npm scopes `@swift/*`  
- CSS `--swift-*` token names  
- Database `swift_platform`  
- Stored user rows may still show `@swift.local` (login via `@vuush.local` still works)  
- Smoke scripts may still use `@swift.local`

## Dogfood tip

Use `driver1-m4@vuush.local` (or `@swift.local`) for Dave — both resolve.
