# Beachhead Go-Live — Click Path

**VUUSH · Project Atlas**  
**Date:** 2026-07-25  
**Hosting:** GitHub · Supabase (DB) · Railway (API) · Vercel (apps)  
**Drills:** Do on the live stack with yourself as demo (founder choice). Keep `city_live` **false** until you are happy.

---

## Before you start

You need browser logins for:
- [ ] [supabase.com](https://supabase.com)  
- [ ] [railway.app](https://railway.app)  
- [ ] [vercel.com](https://vercel.com)  
- [ ] [github.com](https://github.com)  

This folder is not a Git repo yet. Step 0 creates one.

---

## 0. Put code on GitHub

In Terminal (from `Project Atlas`):

```bash
cd "/Users/arieljohannes/Documents/Project Atlas"
git init
git add .
git commit -m "Beachhead: ready to deploy VUUSH platform"
```

Then on GitHub: **New repository** (e.g. `vuush` or `project-atlas`) → push:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

---

## 1. Supabase (memory)

1. New project → name `vuush` → set a strong DB password → save it  
2. Prefer a region near South Africa if listed  
3. **Project Settings → Database → Connection string → URI**  
4. Copy the URI (use **Session** or **Transaction** pooler if direct fails from Railway)  
5. Replace `[YOUR-PASSWORD]` with the real password  
6. If the URI has no SSL flag, append `?sslmode=require` (or `&sslmode=require` if `?` already present)  

You will paste this into Railway as `DATABASE_URL`.

---

## 2. Railway (brain)

1. **New Project → Deploy from GitHub** → pick your repo  
2. **Settings → Root Directory** = `platform`  
3. Railway should read `platform/railway.toml`  
4. **Variables** (Variables tab):

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `DATABASE_URL` | (Supabase URI from §1) |
| `AUTH_PEPPER` | long random string (32+ chars) |
| `PSP_PROVIDER` | `dev_stub` (real Paystack later) |
| `PSP_WEBHOOK_SECRET` | any long secret for now |
| `CORS_ORIGINS` | leave empty first, then set to Vercel URLs after §3 |
| `LOG_LEVEL` | `info` |

5. Deploy → open the public URL → visit `/health` — should say healthy  
6. Copy API base URL (no trailing slash), e.g. `https://vuush-api.up.railway.app`  

Migrations run via `releaseCommand` (`npm run db:migrate`). If tables missing, check Railway deploy logs.

---

## 3. Vercel (five apps)

For **each** app below, **Add New Project** from the same GitHub repo:

| Project name tip | Root Directory | Env `VITE_API_BASE_URL` |
|------------------|----------------|-------------------------|
| `vuush-admin` | `platform/apps/admin-console` | Railway URL from §2 |
| `vuush-dispatch` | `platform/apps/dispatch-console` | same |
| `vuush-customer` | `platform/apps/customer-app` | same |
| `vuush-driver` | `platform/apps/driver-app` | same |
| `vuush-support` | `platform/apps/support-console` | same |
| `vuush-enterprise` | `platform/apps/enterprise-portal` | same |

Framework: Vite. Build: `npm run build`. Output: `dist`.

After apps have URLs, go back to Railway and set:

```text
CORS_ORIGINS=https://vuush.vercel.app,https://vuush-admin.vercel.app,https://vuush-dispatch.vercel.app,https://vuush-customer.vercel.app,https://vuush-7j3u.vercel.app,https://vuush-support.vercel.app,https://vuush-enterprise.vercel.app
```

(Use your real Vercel URLs.) Redeploy API once.

---

## 4. First live demo (you)

1. Open Customer app → sign in with a `@swift.local` email (dev OTP still shows in API logs if stub)  
2. Book → pay with stub →  
3. Driver app: on duty → Dispatch: offer → accept → deliver  
4. Admin Money: see earnings  

Walk drills B–E when you want — same apps, live URLs.  
Leave Admin **`city_live` = false** until you mean “public city.”

---

## 5. If something breaks

| Symptom | Check |
|---------|--------|
| `/health` fails | Railway logs · `DATABASE_URL` · migrate |
| App login fails / CORS | `CORS_ORIGINS` matches Vercel URLs exactly |
| App calls localhost | `VITE_API_BASE_URL` missing → rebuild Vercel |
| Auth pepper error | Set strong `AUTH_PEPPER` (not the dev default) |

---

**End of Go-Live click path**
