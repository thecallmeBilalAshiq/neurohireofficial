# Landing contact form — Nodemailer (Gmail)

Submissions from the landing page `POST /api/contact` are sent to your inbox via Nodemailer.

## 1. Backend environment variables

Copy the block from `backend/.env.example` into `backend/.env` and fill in real values:

| Variable | Purpose |
|----------|---------|
| `SMTP_HOST` | For Gmail: `smtp.gmail.com` |
| `SMTP_PORT` | `587` (STARTTLS) or `465` (SSL) |
| `SMTP_SECURE` | `false` for 587, `true` for 465 |
| `SMTP_USER` | Gmail address used to sign in to SMTP |
| `SMTP_PASS` | Gmail **App Password** (not your normal password) |
| `SMTP_FROM` | From address (usually same as `SMTP_USER`) |
| `CONTACT_TO_EMAIL` | Where contact emails are delivered (defaults to `neurohireofficial@gmail.com`) |

## 2. Gmail App Password

1. Open [Google Account](https://myaccount.google.com/) → **Security**.
2. Turn on **2-Step Verification** if it is off.
3. Go to **2-Step Verification** → **App passwords** (or search “App passwords” in account settings).
4. Create an app password for “Mail” / “Other” and name it e.g. `NeuroHire backend`.
5. Paste the 16-character password into `SMTP_PASS` in `backend/.env` (no spaces).

If App passwords are not available (workspace restrictions), use another SMTP provider (SendGrid, Mailgun, etc.) and set `SMTP_HOST` / `SMTP_PORT` / credentials accordingly.

## 3. Frontend API URL

The landing page calls `{NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL}/api/contact`.

- Local dev: set `NEXT_PUBLIC_BACKEND_URL=http://localhost:5000` in `frontend/.env.local` (or rely on defaults if they match your ports).
- Production: set `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_BACKEND_URL` to your deployed API origin so CORS and the request URL stay correct. Ensure `FRONTEND_URL` on the backend matches your site URL for CORS.

## 4. Test

1. Start the backend (`npm run dev` or your usual command).
2. Open the landing page, submit the contact form.
3. Check the inbox for `CONTACT_TO_EMAIL` (subject prefix `[NeuroHire Contact]`). Replies can go to the visitor via **Reply-To** (their email).

## 5. Error: `535-5.7.8` / `EAUTH` / “Username and Password not accepted”

Gmail is rejecting `SMTP_USER` + `SMTP_PASS`. Fix it by checking:

1. **`SMTP_PASS` must be an App Password** — 16 characters from Google (**Security** → **2-Step Verification** → **App passwords**). Your normal Gmail password will not work.
2. **`SMTP_USER` and `SMTP_FROM`** — Use the **same** `@gmail.com` address the App Password was created for (the account that owns the inbox).
3. **No spaces** in the App Password in `.env` (paste as one string; Google often shows `xxxx xxxx xxxx xxxx` — you may omit spaces).
4. **No extra quotes** in `.env` unless the whole value is quoted correctly; accidental `"` inside the password breaks login.
5. **Regenerate** the App Password if it was revoked or you are unsure — update `SMTP_PASS` and restart the backend.
6. **Google Workspace / school accounts** — admins can disable SMTP or App passwords; use an allowed account or another provider (SendGrid, Resend, etc.).

Official help: [BadCredentials (Google)](https://support.google.com/mail/?p=BadCredentials).
