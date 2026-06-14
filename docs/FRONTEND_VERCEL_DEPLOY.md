# Deploy NeuroHire Frontend to Vercel

This guide covers deploying the **Next.js frontend** (`frontend/`) from the monorepo to Vercel.

## Project overview

| Layer | Stack | Folder |
|-------|--------|--------|
| Frontend | Next.js 16 (App Router), React 19, Firebase Auth, Tailwind | `frontend/` |
| Backend | Express on Vercel serverless | `backend/` |
| Database | MongoDB Atlas | — |

The frontend reads API and Firebase settings from environment variables via `frontend/lib/config.js` and `frontend/lib/firebase.js`. No code changes are needed for production URLs — set env vars in Vercel.

---

## Prerequisites

1. **GitHub/GitLab/Bitbucket repo** with this project pushed.
2. **Backend deployed** (or reachable URL). See `docs/DEPLOYMENT_VERCEL.md` Part 2 for backend setup.
3. **Firebase project** with Email/Password auth enabled.
4. **Vercel account** — [vercel.com](https://vercel.com)

---

## Step 1: Create the Vercel project

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**.
2. **Import** your NeuroHire repository.
3. Configure the project:

   | Setting | Value |
   |---------|--------|
   | **Project name** | e.g. `neurohire` |
   | **Root Directory** | `frontend` ← important for monorepo |
   | **Framework Preset** | Next.js (auto-detected) |
   | **Build Command** | `npm run build` |
   | **Output Directory** | (leave default) |
   | **Install Command** | `npm install` |

4. Do **not** deploy yet — add environment variables first.

---

## Step 2: Environment variables

In **Project → Settings → Environment Variables**, add these for **Production** (and **Preview** if you want PR previews to work).

### API & URLs

| Variable | Example | Notes |
|----------|---------|--------|
| `NEXT_PUBLIC_API_URL` | `https://neurohire-api.vercel.app/api` | Preferred. Must include `/api` suffix. |
| `NEXT_PUBLIC_FRONTEND_URL` | `https://neurohire.vercel.app` | Your Vercel frontend URL (no trailing slash). |

Alternative: use `NEXT_PUBLIC_BACKEND_URL` instead of `NEXT_PUBLIC_API_URL` (e.g. `https://neurohire-api.vercel.app`). The app appends `/api` automatically.

### Firebase (client)

From [Firebase Console](https://console.firebase.google.com) → Project Settings → Your apps → Web app config:

| Variable |
|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` |

Copy values from your local `.env.local` or Firebase console. See `frontend/.env.example` for a template.

---

## Step 3: Firebase authorized domains

After the first deploy, add your Vercel domain to Firebase:

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**.
2. Add:
   - `your-project.vercel.app`
   - Your custom domain (if any)
   - `localhost` (already there for local dev)

Without this, login/signup will fail on the deployed site.

---

## Step 4: Deploy

1. Click **Deploy** (or push to the connected branch).
2. Wait for the build. Locally you can verify with:
   ```bash
   cd frontend
   npm run build
   ```
3. Open the deployment URL (e.g. `https://neurohire.vercel.app`).

---

## Step 5: Point backend CORS to frontend

In your **backend** Vercel project, set:

| Variable | Value |
|----------|--------|
| `FRONTEND_URL` | `https://neurohire.vercel.app` |
| `NEXT_PUBLIC_FRONTEND_URL` | same as above |

Redeploy the backend. Otherwise the browser will block API requests (CORS errors).

---

## Step 6: Smoke test

1. Open the landing page `/`.
2. **Sign up** or **log in** at `/auth/login`.
3. Open **HR dashboard** `/hr/dashboard` or **candidate dashboard** `/candidate/dashboard`.
4. Submit the **contact form** on the landing page.
5. If anything fails, check browser DevTools → **Network** and **Console**.

---

## Monorepo: two Vercel projects

Use **one repo**, **two projects**:

| Project | Root Directory | Purpose |
|---------|----------------|---------|
| `neurohire-api` | `backend` | Express API |
| `neurohire` | `frontend` | Next.js UI |

Each project only builds its own folder.

---

## CLI deploy (optional)

```bash
npm i -g vercel
cd frontend
vercel login
vercel link
vercel env pull .env.local   # optional: sync env from Vercel
vercel --prod
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **Build fails** | Run `npm run build` in `frontend/` locally. Fix ESLint/compile errors. Ensure all `NEXT_PUBLIC_*` vars are set in Vercel. |
| **CORS error** | Backend `FRONTEND_URL` must exactly match frontend URL (https, no trailing slash). Redeploy backend. |
| **Firebase auth error** | Add Vercel domain to Firebase **Authorized domains**. Confirm all `NEXT_PUBLIC_FIREBASE_*` vars. |
| **API calls go to localhost** | `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_BACKEND_URL` not set in Vercel. Redeploy after adding. |
| **404 on API** | Backend not deployed or wrong URL. Test `https://your-api.vercel.app/` — should return "Backend running". |
| **Preview deploy CORS** | Backend allows one origin by default. For PR previews, temporarily set `FRONTEND_URL` to the preview URL or use a custom domain. |

---

## Reference files

```
frontend/
├── .env.example          # Env var template
├── vercel.json           # Vercel project hints (Next.js)
├── lib/config.js         # API URL resolution
├── lib/firebase.js       # Firebase client init
├── lib/api.js            # Axios client → backend
└── package.json          # build: next build
```

Full stack deployment (MongoDB + backend + frontend): see `docs/DEPLOYMENT_VERCEL.md`.
