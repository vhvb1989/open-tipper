# Open Tipper — Product Specification

> A faithful recreation of **tipper.io**, a social football (soccer) score-prediction platform where friends compete by predicting exact match scorelines.

---

## 1. Vision & Goals

| Attribute | Detail |
|-----------|--------|
| **Elevator pitch** | Create or join a group, predict football match scores, and compete on a leaderboard with friends, family, or co-workers. |
| **Target users** | Friend groups, office pools, families, online communities who want a fun, zero-stakes score prediction game. |
| **Monetization** | Completely free — no ads, no premium tier. |
| **Platforms** | Responsive web app (mobile-first, works on desktop). |
| **License** | MIT — open-source public template. |
| **Deployment** | One-command deploy to Azure via `azd up`. Anyone can fork and run their own instance. |

---

## 2. Supported Competitions

Football (soccer) only. Competitions to support at launch:

| League / Tournament | Country / Region |
|---------------------|-----------------|
| Champions League | Europe (UEFA) |
| World Cup | International (when active) |

Additional leagues (Premier League, La Liga, Bundesliga, Serie A, etc.) can be added over time. Match fixtures and results should be sourced from a reliable football data API.

---

## 3. Core Concepts

### 3.1 Users
- A registered person who can create groups, join groups, and submit predictions.
- Profile includes: display name, avatar (from social provider), and membership list.

### 3.2 Contests
- A **contest** maps to a real-world football competition/season (e.g. "Premier League 2025/26").
- Contests have a list of **match days** (rounds) and **matches** pulled from the data source.
- A contest has a start date, end date, and current status (upcoming / active / completed).

### 3.3 Groups
- A **group** is the core social unit. Users play within groups.
- Every group is tied to exactly **one contest**.
- Groups have a name, description, an administrator (the creator), and members.
- Two visibility types:
  - **Private** — join by invitation only; results visible only to members.
  - **Public** — anyone can join; results visible to all users.
- The group administrator can:
  - Invite/remove members.
  - Customize the scoring rules (see §5).
  - Edit group name/description.
- A user can belong to **multiple groups** (even for the same contest) and submit **different predictions** in each.

### 3.4 Predictions (Tips)
- For each match in the group's contest, a member can submit a **scoreline prediction** (home goals, away goals).
- Predictions can be submitted or changed **up until kick-off** of that match.
- After kick-off, the prediction is locked and becomes **visible to all group members**.
- Predictions concern **regular time only** (90 min + stoppage). Extra time and penalties are excluded.

### 3.5 Scoring & Points
- After each match, the system automatically calculates points for every member's prediction.
- Points are awarded based on configurable **scoring factors** (see §5).
- A running **leaderboard** (standings table) is maintained per group.

---

## 4. Pages & Navigation

### 4.1 Public Pages (unauthenticated)

| Page | Description |
|------|-------------|
| **Landing / Home** | Hero section ("Score Prediction With Your Mates"), value propositions, list of active contests with links to browse public groups, and CTA to sign in. |
| **How It Works** | Explanation of joining, creating groups, making predictions, and how scoring works with visual examples. |
| **Public Group Browser** | Filterable list of public groups per contest. Shows group name, member count, admin. |

### 4.2 Authenticated Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Overview of the user's groups, upcoming matches needing predictions, recent results. |
| **Group Page** | The main game view for a group. Sub-sections below. |
| **Create Group** | Form to create a new group: pick contest, set name, description, visibility, scoring rules. |
| **Profile / Settings** | View/edit display name, manage group memberships. |

### 4.3 Group Page (Sub-sections)

| Section | Description |
|---------|-------------|
| **Predictions** | List of matches organized by match day. Input fields (home score / away score) for each match. Auto-saves on input. Shows lock icon after kick-off. |
| **Standings / Leaderboard** | Ranked table of all group members by total points. Columns: rank, member name, points, (optionally) last-round points. |
| **Results** | Completed matches with: actual result, each member's prediction, and points awarded. Visual indicators for exact match, correct outcome, etc. Scoring breakdown badges (2-letter color-coded tags: ES, GD, OC, OT, TG, RG) show which scoring factors contributed to each prediction's points. |
| **Members** | List of group members. Admin tools: invite (link or email), remove member. |
| **Settings** | (Admin only) Edit group name, description, visibility, scoring rules. |

---

## 5. Scoring System

The scoring system is the heart of tipper.io. Each group administrator can customize the point values. The system evaluates the following **scoring factors** for each prediction:

| # | Scoring Factor | Default Points | Description |
|---|---------------|----------------|-------------|
| 1 | **Exact scoreline** | 10 | Predicted the exact final score (e.g., predicted 2-1, result was 2-1). |
| 2 | **Goal difference** | 6 | Predicted the correct goal difference (e.g., predicted 3-1 = +2 diff, result was 2-0 = +2 diff). |
| 3 | **Outcome** | 4 | Predicted the correct match result: home win / draw / away win. |
| 4 | **One team's goals** | 3 | Correctly predicted the exact number of goals scored by at least one team. |
| 5 | **Total goals** | 2 | Correctly predicted the total number of goals in the match. |
| 6 | **Reverse goal difference** | 1 | Predicted the goal difference magnitude correctly but with the wrong sign (e.g., predicted +2, result was -2). Does **not** apply to draws. |

### 5.1 Accumulation Mode

The group admin chooses one of two accumulation modes:

- **Accumulate (default):** All applicable scoring factor points are summed.  
  Example — exact scoreline hit: 10 + 6 + 4 + 3 + 2 = **25 points**.
- **Highest only:** Only the single highest matching scoring factor is awarded.  
  Example — exact scoreline hit: **10 points**.

### 5.2 Playoff Multiplier

Optional: the admin can enable **double points** for knockout/playoff-round matches.

### 5.3 Scoring Examples (Accumulate Mode, Default Points)

| Prediction | Actual Result | Factors Matched | Points |
|------------|---------------|-----------------|--------|
| 2-1 | 2-1 | Exact + Diff + Outcome + One team + Total | 25 |
| 3-1 | 2-0 | Diff (+2) + Outcome (home win) | 10 |
| 0-1 | 0-2 | Outcome (away win) + One team (0 goals home) | 7 |
| 1-1 | 2-2 | Diff (0) + Outcome (draw) + Total (combined 4) | 12 |
| 3-4 | 1-2 | Reverse diff (magnitude 1) | 1 |
| 2-0 | 1-3 | (none) | 0 |

---

## 6. Authentication

- **NextAuth.js (Auth.js v5)** — runs as part of the Next.js backend (no external auth service).
- **Multi-provider OAuth** — supports Google, GitHub, and Microsoft Entra ID. Each provider is optional; configure only the ones you need.
- No email/password registration.
- On first login, a user profile is auto-created from the OAuth provider's claims (name, avatar, email).
- Sessions managed via database-backed sessions (via Prisma adapter) or JWT cookies.
- Users can link multiple OAuth accounts to a single profile (e.g., sign in with Google and later link GitHub).

---

## 7. Data & Integrations

### 7.1 Football Data API

A third-party API is needed to supply:
- List of competitions and seasons.
- Match fixtures (teams, date/time, match day).
- Live/final match results.

Candidate APIs:
- **[API-Football](https://www.api-football.com/) v3** ← chosen provider (1,200+ leagues, World Cup, Liga MX, Champions League)
- [football-data.org](https://www.football-data.org/) (original provider, limited coverage)
- [OpenLigaDB](https://www.openligadb.de/) (free, community-driven)

### 7.2 Real-Time Updates
- Match results should be polled or pushed at regular intervals (e.g., every 1-2 minutes during live matches).
- When a match finishes, scoring is calculated automatically and leaderboards update in near-real-time.

---

## 8. Invitation & Sharing

- **Invite link** — every private group gets a unique shareable URL. Anyone with the link (and an account) can join.
- **Social sharing** — users can share their group link on social media or messaging apps.
- Group admins can also invite by entering a friend's email (sends an email with the join link).

---

## 9. Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| **Responsive design** | Mobile-first; fully usable on phones, tablets, desktops. |
| **Performance** | Pages load in < 2s. Leaderboard/prediction updates feel instant. |
| **Scalability** | Support at least 10,000 concurrent users. |
| **Availability** | 99.9% uptime target. |
| **Security** | OAuth 2.0, HTTPS everywhere, input validation, rate limiting. |
| **Internationalization** | English as primary language. Designed so i18n can be added later (the original supported English + Hungarian). |
| **Accessibility** | WCAG 2.1 AA compliance target. |
| **Cookie / Privacy** | Cookie consent banner. Privacy policy page. GDPR-compliant data handling. |

---

## 10. User Flows

### 10.1 New User — Join a Friend's Group
```
1. Receive invite link from friend
2. Click link → lands on group page → prompted to sign in
3. Sign in with Microsoft (Entra ID)
4. Auto-joined to the group
5. Redirected to the group's Predictions page
6. Start entering scoreline predictions for upcoming matches
```

### 10.2 New User — Create a Group
```
1. Visit landing page → sign in
2. Click "Create a Group"
3. Select a contest (e.g., Premier League 2025/26)
4. Set group name, description, visibility (private/public)
5. Optionally customize scoring rules (or keep defaults)
6. Group is created → redirected to group page
7. Share invite link with friends
```

### 10.3 Returning User — Submit Predictions
```
1. Sign in → lands on Dashboard
2. See "Upcoming predictions needed" section
3. Click into a group
4. See list of next match-day fixtures
5. Enter home/away score for each match
6. Predictions auto-save
7. Can change predictions any time before kick-off
```

### 10.4 After Match Completes
```
1. System polls API → detects match is finished
2. Scoring engine runs: compares each member's prediction to actual result
3. Points calculated per scoring factor
4. Leaderboard updated
5. Members see results + points breakdown on their group's Results page
```

---

## 11. Information Architecture

```
/                           → Landing page (public)
/how-it-works               → How it works (public)
/groups                     → Browse public groups (public)
/auth/login                 → Social login page
/dashboard                  → User dashboard (auth)
/groups/create              → Create a group (auth)
/groups/:id                 → Group page — Predictions tab (auth for private, public for public groups)
/groups/:id/standings       → Group page — Leaderboard tab
/groups/:id/results         → Group page — Results tab  
/groups/:id/members         → Group page — Members tab
/groups/:id/settings        → Group page — Settings tab (admin only)
/profile                    → User profile & settings (auth)
/privacy                    → Privacy policy (public)
```

---

## 12. Entity Model (Conceptual)

```
User
  ├── id
  ├── displayName
  ├── email
  ├── avatarUrl
  ├── authProvider (entra-id)
  └── createdAt

Contest
  ├── id
  ├── name (e.g., "Premier League 2025/26")
  ├── externalId (from football API)
  ├── season
  ├── status (upcoming | active | completed)
  ├── startDate
  └── endDate

Match
  ├── id
  ├── contestId → Contest
  ├── matchDay (round number)
  ├── homeTeam
  ├── awayTeam
  ├── kickoffTime
  ├── status (scheduled | live | finished)
  ├── homeGoals (nullable, set when finished)
  └── awayGoals (nullable, set when finished)

Group
  ├── id
  ├── name
  ├── description
  ├── contestId → Contest
  ├── visibility (private | public)
  ├── adminId → User
  ├── inviteCode (unique, for invite links)
  ├── scoringRules → ScoringRules (embedded or reference)
  └── createdAt

ScoringRules
  ├── exactScore (default: 10)
  ├── goalDifference (default: 6)
  ├── outcome (default: 4)
  ├── oneTeamGoals (default: 3)
  ├── totalGoals (default: 2)
  ├── reverseGoalDifference (default: 1)
  ├── accumulateFactors (default: true)
  └── playoffDoublePoints (default: false)

Membership
  ├── userId → User
  ├── groupId → Group
  ├── role (admin | member)
  └── joinedAt

Prediction
  ├── id
  ├── userId → User
  ├── groupId → Group
  ├── matchId → Match
  ├── homeGoals
  ├── awayGoals
  ├── pointsAwarded (nullable, calculated after match)
  └── submittedAt

Standing (derived / materialized)
  ├── userId → User
  ├── groupId → Group
  ├── totalPoints
  ├── rank
  └── lastRoundPoints
```

---

## 13. Open Questions & Future Considerations

These are out of scope for v1 but worth noting:

| Topic | Notes |
|-------|-------|
| **Push notifications** | Remind users to submit predictions before kick-off. |
| **Match-day chat** | In-group chat or comment thread per match day. |
| **Statistics / analytics** | Per-user stats: accuracy %, best/worst predictions, streaks. |
| **Multiple sports** | Extend beyond football in the future. |
| **Native apps** | iOS / Android apps if the web app gains traction. |
| **Additional languages** | Hungarian was supported in the original. i18n framework should be in place. |
| **Prizes / rewards** | Virtual badges, trophies, or seasonal awards (handled by the platform, not real money). |

---

## 14. Summary

Open Tipper is a faithful recreation of the tipper.io experience: a social, group-based football score prediction game. Users sign in via Microsoft Entra ID, create or join groups tied to real football competitions, predict exact scorelines before kick-off, and earn points via a rich configurable scoring system. Leaderboards automatically update as real match results come in. The platform is free, open-source (MIT license), hosted on Azure, and deployable by anyone with a single `azd up` command. Fork it, customize it, and run your own instance.

---

## 15. Repository Structure

The project follows a **monorepo layout** to support multiple services in the future (e.g. background workers, mobile apps, shared packages) without splitting into separate repositories.

```
open-tipper/
├── .github/workflows/     # CI/CD pipelines
├── infra/                 # Azure Bicep infrastructure templates
│   ├── main.bicep         # Root orchestration
│   ├── app/               # App-specific infra (web app config)
│   └── core/              # Shared infra modules
├── web/                   # Next.js web application
│   ├── e2e/               # Playwright end-to-end tests
│   ├── prisma/            # Prisma schema and migrations
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # Shared React components
│   │   └── lib/           # Utility functions and services
│   └── package.json       # Web service dependencies and scripts
├── azure.yaml             # Azure Developer CLI manifest
├── docker-compose.yml     # Local development services
├── SPEC.md                # Product specification
├── ROADMAP.md             # Implementation plan & roadmap
├── README.md              # Project overview and setup guide
├── CONTRIBUTING.md        # Contribution guidelines
└── LICENSE                # MIT license
```

**Conventions:**
- Each service lives in its own top-level directory (e.g. `web/`, and potentially `worker/`, `shared/` in the future).
- Infrastructure, documentation, and CI/CD configuration remain at the repository root.
- Service-specific tooling (linters, formatters, test runners) is scoped to the service directory.
- The `azure.yaml` manifest maps each service to its directory via the `project` field.
