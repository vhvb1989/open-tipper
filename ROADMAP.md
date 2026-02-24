# Open Tipper — Implementation Plan & Roadmap

> Reference: [SPEC.md](SPEC.md) for full product specification.
>
> Each cycle produces **incremental, testable functionality**. Cycles are sequential — each builds on the previous one.
>
> This project is an **open-source public template** (MIT license). Anyone can fork it, run `azd up`, and have their own instance running on Azure.

---

## Status Tracker

Use this table to track progress across cycles. Update as work proceeds.

| Cycle | Name | Status | Notes |
|-------|------|--------|-------|
| 0 | Project Bootstrap | **completed** | Next.js 16, Tailwind, Prisma, Vitest, Playwright, azd + Bicep, CI/CD |
| 1 | Data Layer & Football API | **completed** | Prisma schema (Team, Contest, Match), API-Football client, sync service, seed script, API routes |
| 2 | Auth & User Profiles | **completed** | NextAuth.js (Auth.js v5), multi-provider OAuth (Google/GitHub/Microsoft), Prisma adapter, sign-in/profile UI |
| 3 | Groups (CRUD + Membership) | **completed** | Prisma models (Group, Membership, ScoringRules), CRUD API routes, Dashboard, Create Group, Group Page with tabs, Members/Settings tabs, invite link flow |
| 4 | Predictions | **completed** | Prediction model, upsert/read/all API routes, group matches route, kickoff locking, Predictions tab UI with auto-save, match-day navigation, lock icons, 16 tests |
| 5 | Scoring Engine | **completed** | Pure scoring algorithm (6 factors, accumulate/highest-only, playoff multiplier), scoring service, sync integration, scores API, 57 scoring tests |
| 6 | Leaderboard & Results | **completed** | Standings API (ranked table, match-day filter), Results API (finished matches + predictions), StandingsTab UI (medals, user highlighting), ResultsTab UI (expandable match cards, point indicators), 17 new tests (123 total), 27 routes |
| 7 | Invitation & Sharing | **completed** | Invite code (Cycle 3), join page, invite-link regeneration API, InviteSection component (copy + Web Share API + regenerate), 5 new tests (128 total), 28 routes |
| 8 | Admin Panel & Sync | **completed** | UserRole enum, auto-admin first user, admin auth helper, competitions browser (API-Football), sync API, user management API, admin UI (competitions + users tabs), NavBar admin link, 18 new tests (146 total), 33 routes |
| — | **MVP Complete** | — | — |
| 9 | Polish, Landing Page & How It Works | **completed** | Landing page (hero + 6 feature cards + footer), How It Works page (6-step guide + scoring table), 4-theme design system (Classic/Midnight/Deep Blue/Steel), mobile responsiveness fixes, loading/error states across all pages, Footer component |
| 10 | Public Groups & Group Browser | **completed** | Browse API with search/contest filters, public group cards (name, contest, members, admin), join button, public standings/results for non-members, NavBar browse link, JoinGroupButton component, 11 new tests (167 total), 36 routes |
| 11 | Real-Time Updates & Live Scoring | **completed** | Cron sync endpoint, SSE live stream, LiveProvider/LiveBadge, auto-refresh results/standings, Azure Functions timer, 14 new tests (182 total), 38 routes |
| 12 | Additional Competitions | **completed** | API-Football 1200+ leagues, admin competitions browser, sync any league, sub-tournament filtering |
| 13 | Push Notifications | not-started | |
| 13 | Stats & Analytics | not-started | |
| 14 | i18n & Accessibility | not-started | |

---

## Tech Stack (Finalized in Cycle 0)

The following tech stack was chosen and set up during Cycle 0.

| Layer | Recommendation | Alternatives |
|-------|---------------|-------------|
| **Frontend** | Next.js (React) with TypeScript | Nuxt (Vue), SvelteKit |
| **Styling** | Tailwind CSS | CSS Modules, Chakra UI |
| **Backend** | Next.js API routes (or separate Express/Fastify) | NestJS, Azure Functions |
| **Database** | Azure Database for PostgreSQL (Flexible Server) | Azure Cosmos DB, Azure SQL |
| **ORM** | Prisma | Drizzle, TypeORM, Knex |
| **Auth** | NextAuth.js (Auth.js v5) with multi-provider OAuth (Google, GitHub, Microsoft Entra ID) | Azure AD B2C |
| **Football API** | API-Football (free/paid tiers) | football-data.org, OpenLigaDB |
| **Hosting** | Azure App Service (Web App) or Azure Static Web Apps | Azure Container Apps, Azure Kubernetes Service |
| **Background Jobs** | Azure Functions (timer-triggered) | Azure Container Apps Jobs |
| **Blob Storage** | Azure Blob Storage (avatars, static assets) | Azure CDN |
| **CI/CD** | GitHub Actions deploying to Azure | Azure DevOps Pipelines |
| **IaC / Deploy** | Azure Developer CLI (`azd`) + Bicep templates | Terraform, ARM templates |
| **Monitoring** | Azure Application Insights | Azure Monitor, Sentry |
| **Testing** | Vitest (unit) + Playwright (e2e) | Jest, Cypress |
| **License** | MIT | Apache 2.0 |

---

## Cycle 0 — Project Bootstrap

**Goal:** Runnable project skeleton with dev tooling. No features yet.

**Deliverables:**
- [x] Initialize monorepo project (Next.js + TypeScript in `web/` directory)
- [x] Configure linting (ESLint) and formatting (Prettier)
- [x] Set up Tailwind CSS
- [x] Set up database (local PostgreSQL via Docker for dev)
- [x] Configure ORM (Prisma) and create initial schema (empty)
- [x] Set up testing framework (Vitest + Playwright)
- [x] Create basic folder structure (`web/src/app`, `web/src/lib`, `web/src/components`, `web/prisma`)
- [x] **Monorepo structure:** web-specific files in `web/` directory; root contains docs, infra, CI/CD, and azure.yaml
- [x] **Azure Developer CLI (`azd`) setup:**
  - [x] Initialize `azd` project: `azure.yaml` manifest at repo root (pointing to `web/` service)
  - [x] Create Bicep templates in `/infra` directory for all Azure resources:
    - Azure App Service for the web app
    - Azure Database for PostgreSQL Flexible Server
    - Azure Blob Storage account
    - Azure Application Insights
    - Microsoft Entra ID app registration (documented as manual step)
  - [x] Configure `azd` environment variables and parameters (football API key, Entra ID client ID, etc.)
  - [ ] Verify full lifecycle: `azd up` provisions and deploys, `azd down` tears down all resources — **requires Azure subscription; templates are ready**
- [ ] Register an app in Microsoft Entra ID (Azure Portal → App registrations) — **manual step, documented in README**
- [x] Set up GitHub Actions workflow for CI (lint + tests) and CD (deploy to Azure via `azd deploy`)
- [x] Add MIT license file (`LICENSE`)
- [x] Add README with:
  - Project overview
  - Local dev setup instructions
  - One-command Azure deployment: `azd up`
  - Teardown: `azd down`
  - Environment variables reference
  - Contributing guidelines
- [x] Add `CONTRIBUTING.md` with contribution workflow

**Actual outcome (verified):**
- Monorepo structure: web app lives in `web/`, root has docs/infra/CI
- `npm run lint` — passes with 0 errors (from `web/` directory)
- `npm test` — 2 unit tests passing (Vitest)
- `npm run build` — production build succeeds
- Playwright e2e tests configured (run with `npm run test:e2e`)
- Bicep templates ready for `azd up` deployment
- GitHub Actions CI workflow ready (`.github/workflows/ci.yml`) with `working-directory: web`
- GitHub Actions deploy workflow ready (`.github/workflows/deploy.yml`)

---

## Cycle 1 — Data Layer & Football API Integration

**Goal:** Populate the database with real competition and match data.

**Deliverables:**
- [x] Define Prisma schema: `Contest`, `Match`, `Team` models
- [x] Integrate with API-Football:
  - Fetch competitions (Champions League, World Cup)
  - Fetch match fixtures per competition/season
  - Fetch match results
- [x] Build a sync service/script that:
  - Creates/updates contests from the API
  - Creates/updates matches (teams, kickoff times, match day, results)
- [x] Seed script to populate DB with current season data
- [x] API route: `GET /api/contests` — list contests
- [x] API route: `GET /api/contests/:id/matches` — list matches for a contest

**Testable outcome:**  
Run the seed script → database is populated with Champions League fixtures. Hit the API routes → JSON data is returned with real match data.

**Actual outcome (verified):**
- Prisma schema: `Team`, `Contest`, `Match` models with `ContestStatus` and `MatchStatus` enums, proper relations, indexes, and @@map table annotations
- Prisma v7 with `@prisma/adapter-pg` driver adapter for PostgreSQL
- football-data.org v4 typed API client (`FootballApiClient` class) supporting Champions League (CL) and World Cup (WC)
- Sync service (`syncCompetition`, `syncAll`) with upsert logic, status mapping, and season derivation
- Seed script (`prisma/seed.ts`) using `tsx` runner
- API routes: `GET /api/contests` (with match counts), `GET /api/contests/:id/matches` (with status/matchDay/stage filters)
- 15 unit tests passing (6 API client + 7 sync service + 2 page)
- `npm run build` — production build succeeds
- `npm run lint` — 0 errors
- DB migration and seeding require Docker (PostgreSQL) and an API-Football API key

---

## Cycle 2 — Authentication & User Profiles

**Goal:** Users can sign in via OAuth (Google, GitHub, or Microsoft) and have a profile.

**Deliverables:**
- [x] Define Prisma schema: `User`, `Account`, `Session`, `VerificationToken` models (NextAuth.js adapter)
- [x] Set up NextAuth.js (Auth.js v5) with multi-provider support:
  - Google OAuth provider (optional)
  - GitHub OAuth provider (optional)
  - Microsoft Entra ID provider (optional)
- [x] Implement sign-in / sign-out flow via NextAuth.js
- [x] Auto-create user profile on first login (name, avatar, email from OAuth claims)
- [x] Protected API middleware (auth guard via NextAuth.js `auth()`)
- [x] Basic UI:
  - Sign-in page with provider buttons (Google, GitHub, Microsoft)
  - Minimal nav bar with user avatar and sign-out
  - Profile page showing display name, avatar, email (read-only for now)

**Testable outcome:**  
Click "Sign in with Google" (or GitHub/Microsoft) → redirected to provider login → redirected back → see your name and avatar in the nav. Refresh the page → still signed in. Sign out → redirected to landing.

**Actual outcome (verified):**
- Prisma schema: `User`, `Account`, `Session`, `VerificationToken` models with @@map table annotations matching Auth.js conventions
- NextAuth.js (Auth.js v5, next-auth@5.0.0-beta.30) with `@auth/prisma-adapter` for database sessions
- Dynamic provider loading: only providers with env vars set are registered (zero-config for unused providers)
- Sign-in page (`/signin`) with Google, GitHub, Microsoft buttons using Server Actions
- NavBar component with session-aware user avatar, name, and sign-out button
- Profile page (`/profile`) showing name, email, avatar, and user ID (read-only)
- Home page updated with session-aware welcome message and "Get started" CTA
- Proxy (middleware) for session token management without Prisma edge-runtime issues
- Remote image domains configured in `next.config.ts` for Google, GitHub, and Microsoft avatars
- `.env.example` updated with all auth provider env vars and AUTH_SECRET
- Bicep infrastructure updated: `AUTH_SECRET`, `AUTH_GOOGLE_*`, `AUTH_GITHUB_*`, `AUTH_MICROSOFT_ENTRA_ID_*` params
- SPEC.md updated: §6 Authentication now describes NextAuth.js multi-provider approach
- 19 unit tests passing (3 auth + 6 API client + 7 sync + 3 page)
- `npm run build` — production build succeeds
- `npm run lint` — 0 errors
- Migration `cycle2_auth` applied successfully

---

## Cycle 3 — Groups (CRUD + Membership)

**Goal:** Users can create groups, join groups, and see their groups.

**Deliverables:**
- [x] Define Prisma schema: `Group`, `ScoringRules`, `Membership` models
- [x] API routes:
  - `POST /api/groups` — create group (with contest, name, description, visibility, scoring rules)
  - `GET /api/groups/:id` — get group details
  - `PUT /api/groups/:id` — update group settings (admin only)
  - `DELETE /api/groups/:id` — delete group (admin only)
  - `POST /api/groups/:id/join` — join a group
  - `POST /api/groups/:id/leave` — leave a group
  - `GET /api/groups/:id/members` — list members
  - `DELETE /api/groups/:id/members/:userId` — remove member (admin only)
- [x] UI pages:
  - **Dashboard** (`/dashboard`) — list of user's groups with group name, contest, member count, admin badge
  - **Create Group** (`/groups/create`) — form: select contest, enter name, description, choose visibility, configure scoring rules (with defaults pre-filled, collapsible advanced section)
  - **Group Page shell** (`/groups/:id`) — layout with header (name, contest, member count, role), tab navigation (Predictions, Standings, Results, Members, Settings)
  - **Members tab** (`/groups/:id/members`) — list of members with avatars, roles, join dates; invite link copy for admins; remove member button; leave group button
  - **Settings tab** (`/groups/:id/settings`) — edit group name, description, visibility, scoring rules; delete group
- [x] Default scoring rules auto-applied on group creation
- [x] Invite link flow (`/join/:inviteCode`) — auto-join on visit, redirect to sign-in if unauthenticated
- [x] NavBar updated with "My Groups" dashboard link
- [x] Home page updated with "Go to dashboard" button for authenticated users

**Testable outcome:**  
Sign in → create a group for Champions League → see it on your dashboard → open the group page → see yourself as admin in the Members tab. Create a second account → join the group → both members visible.

**Actual outcome (verified):**
- Prisma schema: `Group` (name, description, visibility, inviteCode, contestId), `ScoringRules` (6 scoring factors + accumulation mode + playoff multiplier), `Membership` (userId, groupId, role with unique constraint)
- 8 API route handlers across 6 route files covering all CRUD, join/leave, and member management
- Dashboard page with group cards showing contest badge, member count, and admin indicator
- Create Group form with contest picker, visibility toggle, and collapsible scoring rules editor with reset-to-defaults
- Group page layout with context-aware tab bar (Members/Settings tabs only for members/admins)
- Members tab with user avatars, role badges, admin remove/copy-invite-link actions, member leave button  
- Settings tab with full group editing form and delete group with confirmation
- Invite link page (`/join/:inviteCode`) handles unauthenticated redirect, already-member redirect, and auto-join
- Placeholder tabs for Predictions (Cycle 4), Standings (Cycle 6), Results (Cycle 6)
- 33 tests passing (14 new group API tests + 19 existing)
- `npm run build` — production build succeeds (21 routes)
- `npm run lint` — 0 errors
- Migration `cycle3_groups` applied successfully

---

## Cycle 4 — Predictions

**Goal:** Users can submit and edit score predictions for upcoming matches.

**Deliverables:**
- [x] Define Prisma schema: `Prediction` model
- [x] API routes:
  - `PUT /api/groups/:id/predictions` — upsert prediction (home goals, away goals) for a match
  - `GET /api/groups/:id/predictions` — get current user's predictions for the group
  - `GET /api/groups/:id/predictions/all` — get all members' predictions (only for finished/started matches)
  - `GET /api/groups/:id/matches` — get matches for the group's contest with match-day navigation
- [x] Prediction locking logic: reject submissions for matches past kick-off or with in-progress/finished status
- [x] UI — **Predictions tab**:
  - Matches listed by match day, showing: home team crest + name vs away team crest + name, kickoff time
  - Input fields (home / away score) for each upcoming match
  - Auto-save on input (debounced 600ms)
  - Visual lock icon for matches past kick-off
  - Show previously submitted predictions
  - Match-day navigation (prev / next round) with quick-jump dropdown
  - Auto-selects first match day with upcoming matches
  - Save status indicators (saving / saved / error)
  - Actual result display for finished matches
- [x] 16 new tests (49 total): prediction GET/PUT validation, kickoff locking, all-predictions privacy, matches endpoint

**Testable outcome:**  
Open a group → see upcoming Champions League matches → enter predictions (e.g., 2-1) → predictions save → refresh page → predictions are still there. Wait until a match kicks off → prediction is locked → cannot edit.

**Actual outcome:**  
All deliverables implemented. Build passes (24 routes), 49 tests pass, lint clean.

---

## Cycle 5 — Scoring Engine

**Goal:** Automatically calculate points for predictions when a match finishes.

**Deliverables:**
- [x] Implement scoring algorithm (per SPEC.md §5):
  - Evaluate all 6 scoring factors: exact score, goal diff, outcome, one team goals, total goals, reverse goal diff
  - Support both accumulation modes (accumulate vs highest-only)
  - Support playoff double-points multiplier
- [x] Scoring service: given a match result and a prediction, return points breakdown
- [x] Match result sync: extend the football API sync to detect finished matches and trigger scoring
- [x] On match finish: calculate and store `pointsAwarded` for every prediction in every group for that match
- [x] Comprehensive unit tests for scoring logic (50 tests for the scoring engine, 7 tests for the scoring service)
- [x] API route: `GET /api/groups/:id/predictions/:matchId/scores` — points breakdown per member

**Testable outcome:**  
Run unit tests → all scoring examples from the spec pass. Manually mark a match as finished → scoring runs → each member's prediction gets points assigned correctly. Verify with different scoring rule configurations.

**Actual outcome:**  
All deliverables implemented. 106 tests pass (57 new scoring tests), build passes (25 routes), lint clean. Scoring triggered automatically during sync.

---

## Cycle 6 — Leaderboard & Results

**Goal:** Users can see standings and per-match results with points breakdowns.

**Deliverables:**
- [x] Compute and store/derive standings per group (total points, rank, last-round points)
- [x] API routes:
  - `GET /api/groups/:id/standings` — ranked leaderboard
  - `GET /api/groups/:id/results` — finished matches with all members' predictions + points
- [x] UI — **Standings tab**:
  - Ranked table: position, member avatar + name, total points, last round points
  - Highlight current user's row
- [x] UI — **Results tab**:
  - List of completed matches grouped by match day
  - For each match: actual result, expandable list of each member's prediction + points
  - Visual indicators: color-coded points (green for high scores, amber for partial, gray for zero), exact hit emoji
- [x] Auto-refresh standings after scoring runs (scoring triggered on sync, standings derived from stored pointsAwarded)

**Testable outcome:**  
Multiple users submit predictions → match finishes → open Standings tab → see ranked leaderboard with correct points. Open Results tab → see the match result and each member's prediction with a points breakdown.

**Actual outcome (verified):**
- Standings API (`GET /api/groups/:id/standings`): aggregates `pointsAwarded` per member, ranked with tiebreaker (predictions scored count), match-day filter for "last round" display, returns available match days
- Results API (`GET /api/groups/:id/results`): returns finished matches (FINISHED/AWARDED status) with all members' predictions and points, ordered by match day desc, supports matchDay query param filtering
- StandingsTab component: ranked table with gold/silver/bronze medal icons, player avatar + name, total points, last round +N indicator, tips count, current user row highlighted in blue, match-day selector dropdown, responsive (hides columns on mobile)
- ResultsTab component: match cards with team crests and score, expandable predictions list per match, color-coded point indicators (emerald for high, blue for good, amber for partial), exact hit 🎯 emoji, match-day navigation
- 17 new tests (9 standings + 8 results): auth, membership, ranking, tiebreaker, match-day filtering, predictions attachment
- 123 total tests passing across 9 test files
- `npm run build` — production build succeeds (27 routes)
- `npm run lint` — 0 errors

---

## Cycle 7 — Invitation & Sharing

**Goal:** Users can invite friends to private groups via shareable links.

**Deliverables:**
- [x] Generate unique invite codes per group (implemented in Cycle 3 — auto-generated via Prisma `@default(cuid())`)
- [x] API route: `POST /api/groups/:id/invite-link` — regenerate invite link (admin only, invalidates old link)
- [x] Page: `/join/:inviteCode` — join group via invite code (implemented in Cycle 3)
- [x] API route: `POST /api/groups/:id/join` — join group (implemented in Cycle 3, supports public/private with invite code validation)
- [x] Invite flow:
  - Unauthenticated user clicks invite link → redirected to sign-in with callback → auto-joined after auth
  - Authenticated user clicks invite link → auto-joined → redirected to group page
  - Already a member → redirected to group page
- [x] UI in Members tab:
  - `InviteSection` component with full invite URL in selectable input
  - "Copy" button (clipboard API with checkmark feedback)
  - "Share" button (Web Share API on supported browsers/mobile — shares title, text, and URL)
  - "Regenerate link" button with confirmation step (invalidates old link)
- [ ] Optional: email invitation — skipped (requires email infrastructure, not needed for MVP)

**Testable outcome:**  
Create a private group → copy invite link → open in incognito → sign in with a different account → auto-joined to the group → see the group on your dashboard.

**Actual outcome (verified):**
- Invite codes auto-generated on group creation via Prisma `@default(cuid())`, stored with unique constraint and index
- Join page (`/join/:inviteCode`) handles unauthenticated redirect, already-member redirect, and auto-join — implemented in Cycle 3
- `POST /api/groups/:id/invite-link` regenerates the invite code (admin only), old link immediately invalidated, new code generated via `crypto.randomBytes(18).toString('base64url')`
- `InviteSection` component replaces simple `CopyInviteButton`: full invite URL in selectable input, Copy button with clipboard API + checkmark feedback, Share button using Web Share API (only shown when `navigator.share` is available), Regenerate link with two-click confirmation and auto-timeout
- 5 new tests (auth, non-member, non-admin, admin regeneration, correct params)
- 128 total tests passing across 10 test files
- `npm run build` — production build succeeds (28 routes)
- `npm run lint` — 0 errors

---

## ✅ MVP Complete

At this point the core product is functional:
- Users sign in with Google, GitHub, or Microsoft Entra ID
- Create/join groups tied to Champions League or World Cup
- Submit score predictions before kick-off
- Scoring engine calculates points automatically
- Leaderboard and results views work
- Invite friends via shareable links (copy, native share, regenerate)

**Everything below is post-MVP enhancement.**

---

## Cycle 8 — Admin Panel & Sync ✅

**Goal:** Platform admins can browse, sync, and manage football competitions from the API-Football API, and manage user roles — all from within the app.

**Deliverables:**
- [x] `UserRole` enum (USER / ADMIN) with Prisma migration
- [x] First-ever user auto-promoted to ADMIN on sign-up
- [x] Role exposed on session via Auth.js `session` callback + `createUser` event
- [x] Admin auth helper (`requireAdmin`) for API routes
- [x] `listCompetitions()` method on `FootballApiClient` — fetches all available competitions
- [x] `GET /api/admin/competitions` — list available competitions, annotated with local sync status
- [x] `POST /api/admin/sync` — trigger sync for any competition code
- [x] `GET /api/admin/users` — list all users with roles
- [x] `PATCH /api/admin/users/:id` — promote/demote users (prevents self-demotion)
- [x] Admin section (`/admin`) with server-side role check, tab navigation
- [x] Competitions page — search/filter, sync/re-sync buttons, result banners
- [x] Users page — table with promote/demote toggle
- [x] NavBar "Admin" link (amber, only shown for admins)
- [x] `syncCompetition` now accepts any competition code (not just CL/WC)
- [x] API-Football competition emblem domain added to Next.js image config
- [x] 18 new tests (146 total), 33 routes, clean build

**Testable outcome:**
Sign up as the first user → see "Admin" link in nav → go to Admin → browse all API-Football leagues → sync Premier League → go to Create Group → see PL as an option.

---

## Cycle 9 — Polish, Landing Page & How It Works ✅

**Goal:** A polished public-facing experience for new visitors.

**Deliverables:**
- [x] Landing page: hero section with navy/gold branding, 6-card features grid, "How it works" CTA, Footer
- [x] How It Works page: 6-step visual walkthrough, scoring table with examples, CTA to sign up
- [x] Consistent design system: 4 theme presets (Classic/Midnight/Deep Blue/Steel), navy + gold palettes, runtime-switchable via `@theme` CSS custom properties
- [x] Mobile responsiveness audit and fixes (22 issues: 3 critical, 11 moderate, 8 minor — all addressed)
- [x] Loading states, empty states, and error handling across all pages (dashboard/members loading.tsx + error.tsx, tab error banners with retry, empty states in admin users and create group)
- [x] Footer with privacy policy link, contact info, How It Works link

**Actual implementation:**
- `Footer.tsx` — reusable footer with brand, product/legal links, copyright
- `page.tsx` (landing) — hero + 6 feature cards + footer
- `how-it-works/page.tsx` — 6-step guide + scoring examples table + CTA
- `ThemeProvider.tsx` + `ThemeSelector.tsx` — 4 navy/gold theme presets
- `globals.css` — `@theme` (non-inline) color tokens, `[data-theme]` overrides
- Mobile fixes: `overflow-x-auto` on tables, `flex-wrap` on button rows, `truncate`/`min-w-0` on team names, `hidden sm:table-cell` for secondary columns
- Error banners with retry in PredictionsTab, ResultsTab, StandingsTab
- Skeleton loading pages for dashboard and members routes
- Empty state messaging for admin users page and create group contests

**Testable outcome:**  
Visit the site without signing in → see an attractive landing page → click "How It Works" → understand the game. Site looks good on phone and desktop.

---

## Cycle 10 — Public Groups & Group Browser ✅

**Goal:** Users can discover and join public groups.

**Deliverables:**
- [x] Public group browser page: filterable by contest
- [x] Search/filter groups by name
- [x] Group cards showing: name, contest, member count, admin
- [x] "Join" button on public group cards
- [x] Public groups' standings and results visible to non-members

**Actual implementation:**
- `GET /api/groups/browse` — returns all public groups with contest info, member counts, admin name; supports `search` and `contestId` query params; also returns contests with public groups for filter dropdown
- `POST /api/groups/:id/join` — existing route already supported public groups (no invite code needed)
- `GET /api/groups/:id/standings` — updated: public groups visible to anyone (auth optional), private groups still require membership
- `GET /api/groups/:id/results` — updated: same public/private access pattern as standings
- `/groups/browse` — client-side page with search input, contest filter dropdown, loading skeletons, empty states, group cards with join button and "View standings" link
- `JoinGroupButton.tsx` — reusable client component shown on the group page header for non-members of public groups
- Group layout updated: non-members see Standings and Results tabs (no Predictions/Members/Settings), back link goes to "Browse Groups" instead of "My Groups"
- `GroupTabs` updated: Predictions tab hidden for non-members; non-members visiting the default group page are redirected to standings
- NavBar: "Browse" link added for both authenticated and unauthenticated users
- Landing page: "Browse groups" CTA added for unauthenticated visitors
- 11 new tests: browse API (6), public group access (3), join flow (2)
- 167 tests passing, 36 routes, clean build

**Testable outcome:**  
Create a public group → visit the group browser → see the group listed → join it with a different account → start predicting.

---

## Cycle 11 — Real-Time Updates & Live Scoring

**Goal:** Match results and scores update in near-real-time during live matches.

**Deliverables:**
- [x] Background job/cron: poll football API every 1-2 minutes during match windows
- [x] WebSocket or Server-Sent Events (SSE) for pushing updates to connected clients
- [x] Live match status indicators (scheduled → live → finished)
- [x] Auto-refresh leaderboard and results when a match finishes (no manual reload)
- [x] "Live" badge on matches currently in progress

**Actual implementation:**
- `GET /api/cron/sync-live` — cron endpoint that finds contests with live (IN_PLAY/PAUSED) or imminent (kickoff < 30 min) matches and calls `syncCompetition()` for each; protected by `CRON_SECRET` bearer token
- `GET /api/live/stream` — Server-Sent Events endpoint; polls DB every 10s for match changes, pushes `match-update` and `scores-updated` events; 30s heartbeat; supports `contestIds` query param
- `LiveProvider` context + `useLive()` / `useLiveMatch()` hooks — manages EventSource connection, auto-reconnect on error, distributes live match data to child components
- `LiveBadge` component — pulsing red "LIVE" badge for `IN_PLAY` matches, amber "HT" badge for `PAUSED` (halftime)
- `ResultsTab` updated — shows live matches alongside finished ones; live-aware `MatchScore` sub-component shows real-time scores in red; auto-refetches when predictions are scored
- `StandingsTab` updated — auto-refetches standings when `scores-updated` event fires (no manual reload needed)
- Results API updated — `GET /api/groups/:id/results` now includes `IN_PLAY` and `PAUSED` matches with status field, not just FINISHED
- Group layout wraps tab content with `LiveProvider` using the group's `contestId`
- `scripts/live-poll.ts` — localhost polling script (every 90s) that calls the cron endpoint for local testing
- Azure Functions timer trigger (`functions/src/index.ts`) — runs every 2 min on Consumption plan, calls the web app's cron endpoint
- Azure infrastructure: `infra/core/host/function.bicep` — Function App (Y1 Consumption), `CRON_TARGET_URL` + `CRON_SECRET` app settings; `infra/main.bicep` updated with Function App module; `azure.yaml` updated with functions service
- 14 new tests: cron endpoint (6), SSE stream (3), LiveBadge (5)
- 182 tests passing, 38 routes, clean build

**Testable outcome:**  
A match is live → the UI shows a "Live" badge → when the match finishes → the results and leaderboard update automatically without page refresh.

---

## Cycle 12 — Additional Competitions

**Goal:** Support any football competition available through API-Football (1,200+ leagues worldwide).

**Deliverables:**
- [x] API-Football v3 integration providing access to 1,200+ leagues (replaces football-data.org)
- [x] Admin competitions browser: search/filter all available leagues from API-Football, one-click sync
- [x] `syncCompetition(leagueId)` accepts any API-Football league ID — no hardcoded list
- [x] Synced competitions automatically appear in the "Create Group" contest selector
- [x] Sub-tournament handling for leagues with multiple tournaments per season (e.g., Liga MX Apertura/Clausura): sync automatically keeps only the most recent sub-tournament's fixtures
- [x] Free-tier warning banner when API-Football returns restriction errors during sync
- [x] First user auto-promoted to ADMIN on sign-up (via Auth.js `createUser` event) — no manual DB edits needed
- [x] Prev/Next match-day navigation on Results tab (matching Predictions tab)
- [x] Results tab defaults to latest finished match day on first load
- [x] 154 tests passing, clean build

**How to add a competition:**
1. Sign in as admin (the first user to sign up is automatically admin)
2. Go to Admin → Competitions tab
3. Search for any league (e.g., "Premier League", "Bundesliga", "Serie A")
4. Click "Sync" to pull fixtures and teams from API-Football
5. The competition now appears in the Create Group form for all users

**Testable outcome:**  
Sign up as first user → automatically admin → go to Admin → Competitions → search "Premier League" → click Sync → create a group for Premier League → see fixtures → submit predictions → scoring works.

**Actual outcome (verified):**
- API-Football client (`FootballApiClient`) with typed endpoints for leagues, fixtures, and competitions listing
- Admin panel with Competitions tab showing all 1,200+ API-Football leagues, search/filter, sync status badges
- Sync service handles any league ID, upserts contest/teams/matches, scores finished predictions
- Liga MX sub-tournament filtering: `parseRoundPrefix()` detects "Apertura"/"Clausura" prefixes, sync discards the older tournament
- Auto-admin: first user gets `ADMIN` role via `createUser` event in Auth.js config
- UI polish: prev/next navigation on Results tab, default to latest match day

---

## Cycle 13 — Push Notifications

**Goal:** Remind users to submit predictions before deadlines.

**Deliverables:**
- [ ] Web push notifications (service worker)
- [ ] Notification preferences in user profile settings
- [ ] Trigger notifications:
  - "Match day tomorrow — submit your predictions!" (24h before first match)
  - "You have X matches without predictions" (2h before kick-off)
- [ ] In-app notification center (bell icon with unread count)

**Testable outcome:**  
Enable notifications → receive a browser push notification before a match day → click it → lands on the predictions page.

---

## Cycle 14 — Stats & Analytics

**Goal:** Users can view personal and group-level statistics.

**Deliverables:**
- [ ] Per-user stats: prediction accuracy %, exact score hit rate, total predictions made, streaks
- [ ] Group stats: most accurate predictor, biggest upset (lowest-scored round), average points per round
- [ ] Stats tab on the group page
- [ ] Stats section on the user profile page
- [ ] Visual charts (bar/line charts for points over time)

**Testable outcome:**  
Open a group with history → see stats tab → view accuracy percentage, streaks, and charts.

---

## Cycle 14 — Internationalization & Accessibility

**Goal:** Support multiple languages and meet accessibility standards.

**Deliverables:**
- [ ] Extract all user-facing strings into i18n resource files
- [ ] Language switcher in the UI
- [ ] Add at least one additional language (e.g., Spanish or Hungarian)
- [ ] Accessibility audit: keyboard navigation, screen reader labels, ARIA attributes, contrast ratios
- [ ] Meet WCAG 2.1 AA compliance

**Testable outcome:**  
Switch language to Spanish → all UI text shows in Spanish. Navigate the entire app using only keyboard → everything is accessible.

---

## Development Guidelines

### For any agent picking up this roadmap:

1. **Always read SPEC.md first** — it is the source of truth for product requirements.
2. **Work one cycle at a time** — complete and test before moving on.
3. **Update the Status Tracker** at the top of this file after completing each cycle.
4. **Write tests** — each cycle should include relevant unit and/or integration tests.
5. **Commit per cycle** — each cycle should be a logical, self-contained commit or PR.
6. **Don't over-engineer** — build what's needed for the current cycle. Refactor in later cycles if needed.
7. **Ask questions** — if a requirement is ambiguous, check SPEC.md or ask the user before guessing.

### Key decisions to confirm before starting Cycle 0:
- Final tech stack choices (framework, database, hosting) — all Azure-optimized
- Which football data API to use (and API key setup)
- ~~Repository structure (monorepo vs separate repos)~~ — **decided: monorepo with `web/` service directory**
- Azure subscription setup (needed for `azd up`)
- Entra ID tenant and app registration
- Azure deployment model: App Service vs Static Web Apps vs Container Apps
- Confirm open-source license choice (MIT recommended)

### Azure Developer CLI (`azd`) — Key Files

The following files enable the one-command deploy experience:

```
/
├── azure.yaml                  # azd project manifest (services, language, host)
├── LICENSE                     # MIT license
├── CONTRIBUTING.md             # Contribution guidelines
├── docker-compose.yml          # Local development services
├── web/                        # Next.js web application
│   ├── package.json
│   ├── src/
│   ├── prisma/
│   └── e2e/
├── infra/
│   ├── main.bicep              # Root Bicep orchestration
│   ├── main.parameters.json    # Default parameter values
│   ├── abbreviations.json      # Azure resource naming conventions
│   ├── core/
│   │   ├── host/
│   │   │   └── appservice.bicep    # App Service plan + web app
│   │   ├── database/
│   │   │   └── postgresql.bicep    # PostgreSQL Flexible Server
│   │   ├── storage/
│   │   │   └── storage.bicep       # Blob Storage account
│   │   ├── monitor/
│   │   │   └── appinsights.bicep   # Application Insights + Log Analytics
│   │   └── security/
│   │       └── role-assignments.bicep  # Managed identity role assignments
│   └── app/
│       └── web.bicep            # App-specific configuration (env vars, settings)
```

**User workflow:**
```bash
# First time — provision Azure resources and deploy the app
azd auth login
azd up

# Subsequent deploys (code changes only)
azd deploy

# Tear down all Azure resources
azd down
```
