<div align="center">

# FamCare

**Track your family's health — just send a WhatsApp message.**

A warm-pastel health dashboard that visualises data logged by family members via WhatsApp. No app install for them, a beautiful dashboard for you.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Recharts](https://img.shields.io/badge/Recharts-2-22B5BF?style=flat-square)](https://recharts.org)

</div>

---

## About

FamCare is a WhatsApp-first family health tracker. Family members send casual Hindi/English messages or voice notes; a Kotlin/Ktor backend parses them with an AI provider chain, stores structured health logs, sends reminders, and powers a clean warm-pastel dashboard.

Key highlights:

- **WhatsApp onboarding** — invite family members with one tap; they reply YES to join, no app install required
- **Family health cards** — per-member KPI cards with score, calories, protein, steps, and expandable recent logs
- **Calorie calculator** — guided calorie/protein target flow with save-to-goals support
- **Food reminders** — configure up to 5 custom meal/reminder names and times
- **Medicine tracking** — manage family medicines, schedules, reminders, and dose status
- **First-run intro** — elevated swipe/tap onboarding slides for new/returning users
- **Animated charts** — line graph with dots (Recharts) showing weekly step trends
- **KPI hover lift** — dashboard cards lift on hover with a shadow transition
- **Mixed icon system** — Phosphor bold icons for UI chrome, hand-crafted Fluent Emoji-style SVGs for data slots

---

## Screenshots

### Landing Page
![Landing page — hero section with features and CTA](public/screenshots/landing.png)

### Login
![Login page — WhatsApp OTP authentication](public/screenshots/login.png)

### Dashboard
![Dashboard — health KPIs, step chart, and family tracking](public/screenshots/dashboard.png)

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| npm | 10+ |

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/your-org/famcare-frontend.git
cd famcare-frontend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL to your backend URL

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | Backend base URL | `http://localhost:8080` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5 |
| Styling | Inline styles + CSS custom properties (no Tailwind) |
| Charts | Recharts — `LineChart` + `Line` with dot props |
| Icons (UI) | [@phosphor-icons/react](https://phosphoricons.com) — `weight="bold"` |
| Icons (data) | Custom Fluent Emoji-style SVG components (`FluentEmoji.tsx`) |
| Font | Plus Jakarta Sans via `next/font/google` |
| Auth | WhatsApp OTP — token stored in `localStorage` |

---

## Features

### Dashboard
- **KPI cards** — score, calories, protein, steps, sleep/health signals with animated card states
- **Weekly steps chart** — `LineChart` with dot markers; light tooltip with white background
- **Wellness widgets** — hydration, sleep with Fluent Emoji SVG icons
- **Family section** — member cards showing active/pending status, score, today's totals, and expandable recent logs
- **Recent logs** — per-message food/health log events with details and review/correction actions
- **Food reminder dropdown** — ON/OFF plus custom reminder labels/times, max 5, at least one active while ON
- **First-run feature intro** — full-screen elevated onboarding slides from `public/web*.jpeg` and `public/mob*.jpeg`
- **Mobile-responsive** — hamburger nav collapses on small screens

### Calorie Calculator
- Guided questions for age, sex, height in cm/feet, weight, activity, and goal
- Uses backend `/api/users/:id/calorie-target` for BMR/TDEE-based calorie and protein targets
- Result can be saved as the user's calorie and protein goals

### Medicine Tracking
- Add medicines for self or family members
- Configure schedules and WhatsApp reminders
- View today's doses and mark taken/missed/skipped

### Family Tracking
- Invite family or friends by WhatsApp number + label
- Member replies YES to activate (no OTP, no app install)
- Per-member modal: steps/protein/avg KPIs, weekly chart, today's log, recent log history

### Auth
- Phone number → 6-digit OTP delivered via WhatsApp
- Session token stored in `localStorage` as `auth_token`
- User profile stored in `localStorage` as `auth_user`
- Landing page resumes saved sessions automatically and redirects to dashboard/onboarding
- Dashboard redirects to `/login` when token is absent

---

## Icon System

| Use case | Icon source |
|----------|------------|
| Nav, close, card titles, badges | `@phosphor-icons/react` — `weight="bold"`, size 15–22 |
| KPI slots (steps, protein, carbs) | `FEShoe`, `FEMeat`, `FEWheat` from `FluentEmoji.tsx` |
| Wellness widgets (hydration, sleep) | `FEDroplet`, `FEMoon` |
| WhatsApp banner | `FEChat` |
| Invite sent confirmation | `FESmartphone` |

The `FluentEmoji.tsx` components are hand-crafted layered SVGs that match the Microsoft Fluent Emoji flat-3D aesthetic. Each is a `({ size = 28 }) => <svg>` component with a 32×32 viewBox.

---

## Contributing

1. Branch off `dev`: `git checkout -b feat/your-feature`
2. Keep inline-style conventions — no Tailwind classes, no CSS modules
3. Open a PR against `dev`, not `main`

`main` auto-deploys to Netlify — never push directly to it.

---

<div align="center">
Made with care by the FamCare team
</div>
