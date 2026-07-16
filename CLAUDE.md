@AGENTS.md

# FamCare Frontend — Claude context

## Project overview

Next.js 16 (App Router) dashboard for FamCare, a WhatsApp-first family health tracking product. The frontend covers OTP login, auto session resume, dashboard family cards, expandable recent logs, configurable food reminders, calorie/protein calculator, medicine tracking, review/correction flows, and first-run onboarding slides.

## Stack

- Next.js 16, React 19, TypeScript 5
- Styling: existing inline styles plus `app/globals.css`; no Tailwind/CSS modules
- Icons: `@phosphor-icons/react` for UI chrome, `FluentEmoji.tsx` for custom data/personality icons
- Charts: Recharts
- Auth: `auth_token` and `auth_user` in localStorage
- API client: `lib/api.ts`, using `NEXT_PUBLIC_API_URL`
- Deployment: Netlify

## Current feature map

- Landing page (`app/page.tsx`) checks saved auth with `/auth/me` and redirects to dashboard/onboarding.
- Login (`app/login/page.tsx`) stores `auth_token` and `auth_user`.
- Dashboard (`app/dashboard/page.tsx`) loads logs, log events, summaries, family members, food reminders, recent logs, and first-run intro.
- Calorie calculator (`app/dashboard/calorie-calculator/page.tsx`) calls `/api/users/:id/calorie-target` and saves calorie/protein goals.
- Medicines (`app/dashboard/medications/page.tsx`) manages medicines, schedules, today's doses, and reminder settings.
- Review/log correction flows use log events and `PATCH/DELETE /api/log-values`.
- Feature intro assets live in `public/web1.jpeg`…`web3.jpeg` and `public/mob1.jpeg`…`mob3.jpeg`.

## Key conventions

- Keep existing visual language: warm pastel cards, primary coral/green/blue tokens, rounded pills, subtle shadows.
- Food reminder UI allows max 5 reminder slots and must keep at least one active while reminders are ON.
- First-run intro uses `famcare_feature_intro_seen_${user.id}` in localStorage; logout clears it.
- Use `npm run build` before committing frontend changes.

## Git rules

Never push directly to `main`. Work on `dev`/feature branches and open PRs for release.
