<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# FamCare Frontend — Codex context

## Project overview

Next.js 16 (App Router) dashboard for FamCare, a WhatsApp-first family health tracking product. The frontend covers OTP login, auto session resume, dashboard family cards, expandable recent logs, configurable food reminders, calorie/protein calculator, medicine tracking, review/correction flows, and first-run onboarding slides.

## Current feature map

- Landing page (`app/page.tsx`) checks saved auth with `/auth/me` and redirects to dashboard/onboarding.
- Login (`app/login/page.tsx`) stores `auth_token` and `auth_user` in `localStorage`.
- Dashboard (`app/dashboard/page.tsx`) loads logs, log events, summaries, family members, food reminders, recent logs, and first-run intro.
- Calorie calculator (`app/dashboard/calorie-calculator/page.tsx`) calls backend calorie target endpoint and saves calorie/protein goals.
- Medicines (`app/dashboard/medications/page.tsx`) manages medicines, schedules, today's doses, and reminder settings.
- Health Assistant (`app/dashboard/health-assistant/page.tsx`) provides read-only self/family health insights, estimates, comparisons, and meal ideas.
- Review/log correction flows use log events and `PATCH/DELETE /api/log-values`.
- Feature intro assets live in `public/web1.jpeg`…`web3.jpeg` and `public/mob1.jpeg`…`mob3.jpeg`.

## Conventions

- Prefer existing inline-style patterns and `app/globals.css` utilities; do not introduce Tailwind/CSS modules.
- Keep Phosphor icons for UI chrome and `FluentEmoji.tsx` for data/personality icons.
- Auth state is localStorage-based: `auth_token`, `auth_user`.
- First-run intro uses `famcare_feature_intro_seen_${user.id}` in localStorage; logout clears it.
- Food reminder UI allows up to 5 slots and must keep at least one active while reminders are ON.
- Build check: `npm run build`.
