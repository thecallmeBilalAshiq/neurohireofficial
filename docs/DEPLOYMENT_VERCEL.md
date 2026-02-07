

# Part 2: Backend on Vercel

The backend is an Express app. On Vercel it runs as a **single serverless function** that handles all API routes.

## 2.1 Prepare the backend repo

You can deploy in either of these ways:

- **Option A – Backend in its own repo**  
  Push only the `backend` folder to a separate Git repo (e.g. `neurohire-backend`).

- **Option B – Monorepo**  
  Keep frontend and backend in one repo. When creating the backend project on Vercel, set the **Root Directory** to `backend`.

## 2.2 Create the Vercel project (backend)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**.
2. Import the repository that contains the backend (or the monorepo).
3. **Project name**: e.g. `neurohire-api`.
4. **Root Directory**:  
   - If backend is in a subfolder: set to **backend**.  
   - If the repo is backend-only: leave empty.
5. **Framework Preset**: leave **Other** (we use a custom Node serverless setup).
6. **Build Command**: leave empty (or `echo "No build"`).
7. **Output Directory**: leave empty.
8. **Install Command**: `npm install` (runs in the root directory you set).

## 2.3 Environment variables (backend)

In the same project, go to **Settings** → **Environment Variables** and add:

| Name | Value | Notes |
|------|--------|--------|
| `MONGO_URI` | Your Atlas connection string | From Part 1 |
| `BACKEND_URL` | `https://neurohire-api.vercel.app` | Replace with your backend’s Vercel URL (see after first deploy) |
| `FRONTEND_URL` | `https://neurohire.vercel.app` | Replace with your frontend’s Vercel URL (set after Part 3) |
| `NEXT_PUBLIC_FRONTEND_URL` | Same as `FRONTEND_URL` | Used for redirects / links |
| `BYTEZ_API_KEY` | Your Bytez API key | For LLM (job description, emails, test questions) |
| `ADMIN_JWT_SECRET` | A long random string | For admin JWT (e.g. generate with `openssl rand -hex 32`) |
| `N8N_EMAIL_WEBHOOK_URL` | Your n8n webhook URL | e.g. `https://your-n8n.ngrok.io/webhook/send-interview-emails` (optional at first) |
| `N8N_WEBHOOK_URL` | Your n8n job-post webhook | Optional |

**Firebase (backend):**

1. In [Firebase Console](https://console.firebase.google.com) → Project Settings → Service accounts → **Generate new private key**.
2. Copy the **entire JSON** (one line is fine).
3. In Vercel → Backend project → **Environment Variables** → add:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value**: paste the full JSON (as one line, no line breaks).
4. The backend is already set up to use this variable when present (and falls back to the local file when developing).

Add these for **Production** (and optionally Preview).

## 2.4 Deploy

1. Click **Deploy**.
2. After deploy, open the project URL, e.g. `https://neurohire-api.vercel.app`.
3. You should see **“Backend running”**.
4. Copy this URL (e.g. `https://neurohire-api.vercel.app`) and:
   - Update **BACKEND_URL** in the backend env vars to this URL.
   - Use **`https://neurohire-api.vercel.app/api`** as the API base for the frontend (see Part 3).

## 2.5 Limits and notes (backend)

- **Execution time**: Free tier ~10s per request. Pro allows 60s (already set in `backend/vercel.json`). Long LLM or n8n calls may need Pro or a different host for the API.
- **Request body size**: ~4.5 MB. Large CV uploads may hit this; consider Vercel Blob or S3 for production.
- **File storage**: Serverless filesystem is ephemeral. CVs stored under `uploads/` are not persistent. For production, use cloud storage (e.g. Vercel Blob, AWS S3) and adapt the CV upload code.

---



































# Part 3: Frontend on Vercel

## 3.1 Create the Vercel project (frontend)

1. In Vercel Dashboard → **Add New** → **Project**.
2. Import the repo that contains the frontend (or the same monorepo).
3. **Project name**: e.g. `neurohire` or `neurohire-app`.
4. **Root Directory**:  
   - If frontend is in a subfolder (e.g. `frontend`): set to **frontend**.  
   - If the repo is frontend-only: leave empty.
5. **Framework Preset**: **Next.js** (should be auto-detected).
6. **Build Command**: `npm run build` (default).
7. **Output Directory**: leave default.
8. **Install Command**: `npm install`.

## 3.2 Environment variables (frontend)

In **Settings** → **Environment Variables** add:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_API_URL` | `https://neurohire-api.vercel.app/api` |
| `NEXT_PUBLIC_BACKEND_URL` | `https://neurohire-api.vercel.app` |
| `NEXT_PUBLIC_FRONTEND_URL` | `https://neurohire.vercel.app` |

Replace with your real backend and frontend URLs.  
Your frontend uses these to call the API (see `frontend/lib/config.js`).

**Firebase (frontend):**

Add your Firebase web app config (so the client can talk to Firebase Auth):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

(Your `frontend/lib/firebase.js` or `.env.local` may already reference these; use the same names in Vercel.)

## 3.3 Deploy

1. Click **Deploy**.
2. When the build finishes, open the frontend URL (e.g. `https://neurohire.vercel.app`).
3. Test login, signup, and one API call (e.g. load dashboard) to confirm the frontend talks to the backend.

## 3.4 Point backend CORS to frontend

In the **backend** Vercel project, set:

- `FRONTEND_URL` = your frontend URL (e.g. `https://neurohire.vercel.app`)
- `NEXT_PUBLIC_FRONTEND_URL` = same

Redeploy the backend so CORS allows your production frontend origin.

---

# Part 4: Summary checklist

- [ ] MongoDB Atlas: cluster created, user created, IP `0.0.0.0/0` allowed, **MONGO_URI** copied (with DB name).
- [ ] Backend on Vercel: repo connected, root directory = `backend` if needed, env vars set (MONGO_URI, BACKEND_URL, FRONTEND_URL, BYTEZ_API_KEY, ADMIN_JWT_SECRET, Firebase if used).
- [ ] Backend URL noted (e.g. `https://neurohire-api.vercel.app`).
- [ ] Frontend on Vercel: repo connected, root directory = `frontend` if needed, env vars set (NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_FRONTEND_URL, Firebase client config).
- [ ] Backend CORS updated with final frontend URL and redeployed.
- [ ] Quick test: open frontend → login/signup → one API-backed page.

---

# Optional: One repo, two Vercel projects

If you use a **single repo** with `frontend/` and `backend/`:

1. Create **Project 1** (backend): connect the repo, set **Root Directory** to `backend`.
2. Create **Project 2** (frontend): connect the same repo, set **Root Directory** to `frontend`.
3. Set env vars per project as above. Each deploy only builds and runs its own root directory.

---

# Troubleshooting

- **“Backend running” but API 404**  
  Check that `backend/vercel.json` and `backend/api/index.js` exist and that every route is sent to the Express app (e.g. `"dest": "/api/index.js"`).

- **CORS errors in browser**  
  Ensure `FRONTEND_URL` (and `NEXT_PUBLIC_FRONTEND_URL`) on the backend exactly match the frontend URL (protocol + domain, no trailing slash).

- **MongoDB connection errors**  
  Check MONGO_URI (username, password encoding, DB name). Ensure Atlas **Network Access** allows `0.0.0.0/0` (or add Vercel’s IPs if you restrict).

- **Build fails (frontend)**  
  Run `npm run build` locally in the frontend root; fix any TypeScript/ESLint errors. Ensure all `NEXT_PUBLIC_*` vars used at build time are set in Vercel.

- **Build fails (backend)**  
  Ensure root directory is `backend`, install runs there, and `api/index.js` plus `vercel.json` are in the backend folder.

---

# Reference: Backend structure for Vercel

```
backend/
├── api/
│   └── index.js          # Vercel serverless entry: exports Express app
├── vercel.json           # Routes all requests to api/index.js, maxDuration 60 (Pro)
├── index.js              # Express app; exports app when required by api/index.js
├── config/
├── controllers/
├── ...
└── package.json
```

Your frontend already uses `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_BACKEND_URL` from `lib/config.js`, so once these are set in Vercel to your backend URL, the deployed app will use the online backend and MongoDB.
