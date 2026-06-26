@AGENTS.md

# FamCare Frontend

## Project overview

Next.js 15 (App Router) dashboard for **FamCare** — a WhatsApp-first family health tracking platform. Family members send casual Hindi/English messages or voice notes to a WhatsApp number; the Kotlin/Ktor backend parses them and stores structured health data. This frontend displays that data.

## Stack

- **Framework**: Next.js 15, React 19, TypeScript 5
- **Styling**: Inline styles throughout — no Tailwind, no CSS modules
- **Charts**: Recharts — `LineChart` + `Line` with `dot` prop (replaced Chart.js)
- **Icons (UI chrome)**: `@phosphor-icons/react` — always `weight="bold"`, size 15–22
- **Icons (data/personality)**: `FluentEmoji.tsx` — custom Fluent Emoji-style SVG components
- **Font**: Plus Jakarta Sans via `next/font/google` (replaced DM Sans)
- **Auth**: WhatsApp OTP — `auth_token` + `auth_user` stored in `localStorage`
- **API client**: `lib/api.ts` — reads `NEXT_PUBLIC_API_URL`, defaults to `http://localhost:8080`
- **Deployment**: Netlify (auto-deploy from `main`)

## Project structure

```
app/
  layout.tsx                    — root layout, Plus Jakarta Sans, viewport meta
  globals.css                   — CSS vars, .db-kpi hover lift, shimmer animation
  page.tsx                      — landing page
  login/page.tsx                — WhatsApp OTP login (phone → OTP)
  dashboard/
    page.tsx                    — main dashboard (auth-guarded)
    components/
      AddFamilyModal.tsx        — 2-step invite flow (details → sent confirmation)
      FamilyMemberModal.tsx     — per-member health detail modal with chart + logs
      FluentEmoji.tsx           — custom Fluent Emoji SVG components
      EmptyState.tsx            — empty state for no health data
lib/
  api.ts                        — typed API client for all backend endpoints
public/
  family-sunset.png
  family-whatsapp.png
```

## Key conventions

- All pages are `"use client"` — no server components used yet
- **Inline styles only** — keep consistent with existing code; never add Tailwind classes
- `localStorage.getItem("auth_token")` — session token; `"auth_user"` — serialised User object
- Dashboard redirects to `/login` if `auth_token` is missing
- `getGreeting()` returns time-aware greeting (morning/afternoon/evening)
- Mobile breakpoint: `≤768px` — hamburger nav collapses, layouts stack vertically

## Icon usage rules

Phosphor (`@phosphor-icons/react`) for all UI chrome:
```tsx
import { House, X, ChartBar, Users, CaretRight } from "@phosphor-icons/react"
<House size={19} weight="bold" />
```

FluentEmoji SVGs for data/personality slots:
```tsx
import { FEShoe, FEMeat, FEWheat, FEDroplet, FEMoon, FESmile, FETarget, FEChat, FESmartphone } from "./FluentEmoji"
<FEShoe size={20} />
```

Never use Lucide React — it was removed.

## Chart conventions

Steps chart uses Recharts `LineChart` with a light tooltip:
```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from "recharts"

<ReTooltip
  cursor={{ stroke: "#FF6B6B", strokeWidth: 1, strokeDasharray: "4 3" }}
  contentStyle={{ background: "#fff", border: "1px solid #EDE6E6", borderRadius: 10, fontSize: 12 }}
  labelStyle={{ color: "#9AA0AD", fontSize: 11, fontWeight: 600 }}
  itemStyle={{ color: "#FF6B6B", fontWeight: 700 }}
/>
<Line type="monotone" dataKey="value" stroke="#FF6B6B" strokeWidth={2.5}
  dot={{ fill: "#FF6B6B", stroke: "#fff", strokeWidth: 2, r: 4 }}
  activeDot={{ fill: "#FF6B6B", stroke: "#fff", strokeWidth: 2, r: 6 }}
/>
```

## Design system tokens

```
Primary coral:   #FF6B6B
Purple:          #7C6FF7
Orange accent:   #FF9F45
Green:           #2FBE76
Blue:            #5CAAED
Text primary:    #2C2F3A
Text muted:      #9AA0AD
Card bg:         #FAFAFA
Border:          #F2F1F3
```

KPI hover lift is defined in `globals.css` as `.db-kpi` — add that class to any card that should lift on hover.

## Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | Backend base URL | `http://localhost:8080` |

## Backend API

Kotlin/Ktor backend, port **8080** locally.

### Auth
- `POST /auth/send-otp` — `{ phone }` → sends OTP via WhatsApp
- `POST /auth/verify-otp` — `{ phone, code }` → `{ token, user }`

### Users (public)
- `GET /api/users` — list all users
- `GET /api/users/:id/logs?days=N` — health logs
- `GET /api/users/:id/summary` — 7-day summary

### Family (Bearer token required)
- `POST /family/invite` — `{ phone, label, type }` → invite member + send WhatsApp
- `GET /family/members` — list caller's family members
- `GET /family/members/:id/summary` — 7-day summary for a member
- `GET /family/members/:id/logs?days=N` — logs for a member

All authenticated calls pass `Authorization: Bearer <token>` header. See `lib/api.ts` for typed wrappers: `inviteFamilyMember`, `getFamilyMembers`, `getMemberSummary`, `getMemberLogs`.

## Running locally

```bash
npm install
cp .env.local.example .env.local
npm run dev   # http://localhost:3000
```

## Git rules — READ BEFORE COMMITTING

**NEVER push directly to `main`.**

`main` is the production branch — it auto-deploys to Netlify on every push.

```bash
git checkout -b feat/your-branch
git add <files>
git commit -m "feat: description"
git push origin feat/your-branch
gh pr create --base development --title "..." --body "..."
```

Work branches off `development`. PRs merge to `development` first, then `development` → `main` for releases.
