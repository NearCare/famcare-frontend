@AGENTS.md

# HealthEase Frontend

## Project overview
Next.js 16 (App Router) dashboard for **HealthEase** — a WhatsApp-first family health tracking platform.
Family members send casual Hindi/English WhatsApp messages; this dashboard displays the parsed health data in charts and summaries.

## Stack
- **Framework**: Next.js 16.2.6, React 19, TypeScript 5
- **Styling**: Tailwind CSS 4 + inline styles (no CSS modules)
- **Charts**: Chart.js 4.5 via `useChart` hook (canvas-based)
- **Font**: DM Sans (Google Fonts)
- **Auth**: WhatsApp OTP — token + user stored in `localStorage` as `auth_token` / `auth_user`
- **API client**: `lib/api.ts` — reads `NEXT_PUBLIC_API_URL` env var, defaults to `http://localhost:8080`
- **Deployment**: Netlify (auto-deploy from `main`)

## Project structure
```
app/
  layout.tsx          — root layout, DM Sans font, viewport meta
  page.tsx            — landing / home page
  login/page.tsx      — WhatsApp OTP login (2-step: phone → OTP)
  dashboard/page.tsx  — main dashboard (auth-guarded)
  dashboard/components/EmptyState.tsx
lib/
  api.ts              — typed API client (getUsers, getUserLogs, getUserSummary, sendOtp, verifyOtp)
public/
  family-sunset.png   — hero illustration on home page
  family-whatsapp.png — hero illustration on login page
```

## Key conventions
- All pages are `"use client"` — no server components used yet
- Inline styles used throughout (not Tailwind classes) — keep consistent
- `useChart(canvasId, buildConfig, deps)` custom hook wraps Chart.js lifecycle
- `localStorage.getItem("auth_user")` returns `User | null` — dashboard redirects to `/login` if missing
- `getGreeting()` returns time-aware greeting (morning/afternoon/evening)
- Mobile breakpoint: `≤768px` via CSS class `.dashboard-main`, `.stat-grid`, `.chart-grid`, `.progress-grid`

## Environment variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | Backend base URL | `http://localhost:8080` |

Copy `.env.local.example` → `.env.local` for local dev.

## Backend
Kotlin/Ktor backend at `../nearcare-be`. Run on port **8080** locally.
API endpoints:
- `POST /auth/send-otp` — sends WhatsApp OTP
- `POST /auth/verify-otp` — verifies OTP, returns `{ token, user }`
- `GET /api/users` — list all users
- `GET /api/users/:id/logs?days=N` — health logs
- `GET /api/users/:id/summary` — 7-day summary

## Running locally
```bash
npm install
cp .env.local.example .env.local
npm run dev   # http://localhost:3000
```

## ⚠️ Git rules — READ BEFORE COMMITTING

**NEVER push directly to `main`.**

Always work on a feature branch and open a pull request:
```bash
# Start work
git checkout -b fix/your-branch-name

# Commit your changes
git add <files>
git commit -m "fix: description"

# Push branch and open PR — never push to main directly
git push origin fix/your-branch-name
gh pr create --base main --title "..." --body "..."
```

`main` is the production branch — it auto-deploys to Netlify on every push.
Direct pushes bypass review and can break the live site.
