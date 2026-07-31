# VUUSH first public Dispatch — ops checklist

## Live URLs
- Dispatch: https://vuush-dispatch.vercel.app
- API: https://vuush-production.up.railway.app

## Railway (API)
Set these in Railway variables:

- NODE_ENV=production
- DATABASE_URL= (Railway Postgres URL)
- AUTH_PEPPER= (long random secret, not the default)
- CORS_ORIGINS=https://vuush.vercel.app,https://vuush-7j3u.vercel.app,https://vuush-enterprise.vercel.app,https://vuush-dispatch.vercel.app
- OTP_EMAIL_PROVIDER=resend
- RESEND_API_KEY=re_...
- OTP_EMAIL_FROM=VUUSH <noreply@your-verified-domain>
  (or `VUUSH <onboarding@resend.dev>` until your domain is verified)
- LOG_LEVEL=info

Health check path should be `/ready` (already in railway.toml).

## Resend
1. Create a Resend account
2. Verify your sending domain
3. Create an API key
4. Put key + from-address into Railway

## Vercel (Dispatch)
- Root Directory: `platform/apps/dispatch-console`
- Env: `VITE_API_BASE_URL=https://vuush-production.up.railway.app` (no slash at end)
- Live: https://vuush-dispatch.vercel.app

## Staff access
1. Create / invite staff users in Admin (or DB role binding)
2. User must have role: dispatcher, operations_manager, or administrator
3. First login: email code → set up authenticator app → enter 6-digit code
4. Lost authenticator: admin MFA reset only (not from Dispatch)

## Not done in this pass (accept for beachhead or follow up)
- Paid map tiles (still OpenFreeMap)
- SMS OTP (email only for staff Dispatch)
- Full security headers / CSP on Vercel
- Chunk-splitting for MapLibre bundle size warning
