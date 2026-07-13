# mochiboard — Project Context for Claude Code

> **Note:** This project uses a customized version of Next.js. Before writing any Next.js code, check the local docs in `node_modules/next/dist/docs/` — APIs, conventions, and file structure may differ from standard Next.js. Heed deprecation notices. (See `AGENTS.md`.)

## What this is
A personal all-in-one productivity web app (planner, calendar, health/fitness tracking, finances/budgeting), live at **mochiboard.com**. The owner is a complete beginner to web development — explain changes clearly, avoid jargon without context, and confirm before making large structural changes.

## Tech stack & tools
- **Framework:** Next.js 16, TypeScript, Tailwind CSS, ESLint, App Router
- **Hosting:** Vercel (deployed and live, connected to GitHub for auto-deploy)
- **Database/Auth:** Supabase
- **Version control:** GitHub, username `ChanChomp`, repo `mochiboard`
- **Local machine:** Windows, Node v24, npm v11, Git v2.55
- **Project location:** `C:\Users\Chan\mochiboard`
- **GitHub CLI (`gh`):** installed and authenticated as `ChanChomp` — safe to use for creating branches, pushing, and opening PRs

## Live infrastructure — all working
- Domain `mochiboard.com` purchased via Cloudflare, DNS configured, fully propagated and live
- Deployed on Vercel, connected to GitHub repo for auto-deploys
- Supabase project connected via `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## Design system
- **Aesthetic:** soft, cute, pastel — rounded corners, soft shadows/gradients, cozy feel
- **5 selectable color themes**, switchable via a theme-picker widget in the nav (labeled "CHOOSE YOUR MOCHI"), stored in localStorage, implemented via CSS custom properties:
  1. **Peach** (default) — warm peach/cream/terracotta
  2. **Strawberry** — pastel pink
  3. **Matcha** — pastel green
  4. **Ube** — pastel purple
  5. **Black Sesame** — dark mode, black/charcoal with white/cream text
- **Mascot:** a custom "sleepy smile" mochi character (round face, closed curved eyes, small smile, blush circles) drawn as inline SVG, recolored per active theme, sitting in the top nav at ~64px
- **Theme food icons:** small flat, rounded, shiny-highlight icons (peach, strawberry, matcha, ube, black sesame) appear next to each widget title, auto-switching with the active theme
- **Layout:** top nav (no sidebar) with pill-style nav tabs, mochi mascot + "mochiboard" wordmark, theme picker on the right; below that a "Your week at a glance" header with quick stats; a gradient "Today's Focus" banner; then 3 widget cards (Planner, Health & Fitness, Finances)

## Features built so far
1. **Dashboard** — 3-widget overview (Planner, Health & Fitness, Finances); Health & Fitness and Finances still show mock data
2. **Planner widget** — connected to real Supabase data (schema below); working add-task input, working checkbox toggle for completion
3. **Authentication** — email/password login via Supabase Auth; `/login` and `/signup` pages in matching pastel style; logout button in nav; app gated so logged-out users redirect to login
4. **Per-user data security** — `tasks` table has a `user_id` column (uuid); RLS policies restrict select/insert/update/delete to rows matching `auth.uid()`; task creation/fetching code uses `currentUserId` derived from the logged-in session

## Supabase `tasks` table schema
| Column | Type | Notes |
|---|---|---|
| `id` | int8 | primary key, auto |
| `created_at` | timestamptz | default `now()` |
| `title` | text | task name |
| `time_label` | text | e.g. "10:00 AM" |
| `description` | text | e.g. "Review goals and next steps" |
| `is_complete` | bool | default `false` |
| `day` | text | mid-migration to real date format (YYYY-MM-DD) from generic "Mon"/"Tue" labels — verify this before assuming it's finished |
| `user_id` | uuid | ties each row to its owner via `auth.uid()` |

## In-progress / not yet finished
- **Auth redirect fix**: Supabase's Site URL was incorrectly set to `http://localhost:3000` instead of `https://mochiboard.com`, breaking email confirmation links on mobile. This was being corrected (Site URL → `https://mochiboard.com`, Redirect URLs → `https://mochiboard.com/**` plus `http://localhost:3000/**` for local dev). Verify this is saved and working before assuming confirmation emails work.
- **Per-user data isolation test**: not yet verified end-to-end. Plan: sign up a second test account, confirm its Planner starts empty, add a task as the test account, confirm the original account never sees it (and vice versa). Also spot-check the `tasks` table directly in Supabase to confirm `user_id` values differ correctly between accounts.
- **Dedicated Planner page**: planned but not fully built/verified — add a "Dashboard" nav tab (first, showing the current 3-widget view) and make "Planner" its own full page with:
  - a schedule column (hourly time slots)
  - a to-do checklist (existing working functionality)
  - a tilted sticky-note style notes section
  - themed decorative accents per theme (peach icons/leaves, strawberries/hearts, matcha leaves/whisk, ube swirls/stars, black sesame seeds/moon)
- **Real calendar date sync** for the day selector (Mon/Tue/etc. showing actual current-week dates, auto-selecting today) — attempted once, reported as fixed, but no visual change was observed. Needs re-verification once the dedicated Planner page work resumes.
- **Health & Fitness and Finances widgets** — still using mock/placeholder data, not yet connected to Supabase.

## Known gotchas / lessons learned
- The `"allow all for now"` Supabase RLS policy was a deliberate temporary shortcut before auth existed — it has since been replaced with real per-user policies. Do not reintroduce a blanket "allow all" policy.
- When Claude Code hits a usage limit mid-edit, it can leave code in a broken/incomplete state (e.g. a referenced-but-undefined variable). If this happens, describe the exact error and finish the wiring rather than starting over.
- When making visual/design decisions, show 2-3 options before committing to code changes, to avoid back-and-forth rework.
- The owner is non-technical — prefer clear explanations of *what* changed and *why* over dense technical jargon, and confirm before large refactors or schema changes.

## Suggested next steps (in order)
1. Confirm the Supabase auth redirect URL fix is saved and working (test signup + email confirmation on mobile)
2. Complete the per-user data isolation test (second test account, empty planner, cross-account check)
3. Finish/verify the dedicated Planner page (schedule + to-do + notes + themed decorations) and the Dashboard/Planner nav split
4. Re-verify the real calendar date sync for the day selector
5. Connect Health & Fitness and Finances widgets to real Supabase tables (similar pattern to `tasks`)
