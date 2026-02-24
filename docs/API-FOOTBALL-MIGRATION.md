# API-Football Migration Plan

> **Goal**: Migrate from [football-data.org](https://www.football-data.org/) v4 to
> [API-Football](https://www.api-football.com/) v3 to gain coverage for **World Cup**,
> **Liga MX**, and 1 230+ other competitions.

---

## 1. Coverage Verification

### ✅ World Cup — CONFIRMED

Listed under **International → World**:

- World Cup
- World Cup - Qualification (Africa, Asia, CONCACAF, Europe, Oceania, South America,
  Intercontinental Play-offs)
- World Cup - U17 / U20 / Women

### ✅ Liga MX — CONFIRMED

Listed under **National → Mexico**:

| Competition             | Notes                   |
| ----------------------- | ----------------------- |
| Liga MX                 | Top division            |
| Liga MX Femenil         | Women's league          |
| Liga MX U21             | Youth                   |
| Liga de Expansión MX    | Second division         |
| Copa MX                 | Domestic cup            |
| Campeón de Campeones    | Super Cup equivalent    |
| Liga Premier Serie A/B  | Lower divisions         |

### ✅ Champions League — CONFIRMED

Listed under **International → UEFA → UEFA Champions League**.

---

## 2. API Comparison

| Aspect                  | football-data.org v4             | API-Football v3                        |
| ----------------------- | -------------------------------- | -------------------------------------- |
| **Base URL**            | `api.football-data.org/v4`       | `v3.football.api-sports.io`            |
| **Auth header**         | `X-Auth-Token`                   | `x-apisports-key`                      |
| **Identifier**          | Competition **code** (`CL`, `WC`)| League numeric **id** (`2`, `1`)       |
| **List competitions**   | `GET /competitions`              | `GET /leagues`                         |
| **Competition detail**  | `GET /competitions/{code}`       | `GET /leagues?id={id}`                 |
| **Matches**             | `GET /competitions/{code}/matches?season=YYYY` | `GET /fixtures?league={id}&season=YYYY` |
| **Image domain**        | `crests.football-data.org`       | `media.api-sports.io`                  |
| **Response shape**      | Direct JSON object               | Wrapped: `{ get, parameters, errors, results, paging, response }` |
| **Free tier**           | 10 req/min, unlimited daily      | 100 req/day (limited seasons)          |
| **Paid tiers**          | Token-based plans                | $19 Pro (7.5K/day), $29 Ultra (75K/day), $39 Mega (150K/day) |
| **Total competitions**  | ~170 (free: ~12)                 | 1 230+, all plans include all comps    |

### Key Architectural Differences

1. **Terminology**: "competitions" → "leagues"; "matches" → "fixtures"
2. **Lookups by code vs id**: football-data.org uses codes like `CL`, `WC` as URL path
   segments. API-Football uses numeric `id` as a query parameter.
3. **Response wrapper**: Every API-Football response is wrapped in
   `{ get, parameters, errors, results, paging, response: [...] }`.
4. **Teams in fixtures**: API-Football embeds team info *inside* each fixture object
   rather than requiring a separate teams fetch.

---

## 3. Match Status Mapping

| Our MatchStatus enum | football-data.org | API-Football short |
| -------------------- | ----------------- | ------------------ |
| `SCHEDULED`          | `SCHEDULED`       | `TBD`, `NS`        |
| `TIMED`              | `TIMED`           | `NS`               |
| `IN_PLAY`            | `IN_PLAY`         | `1H`, `2H`, `ET`, `P`, `LIVE` |
| `PAUSED`             | `PAUSED`          | `HT`, `BT`         |
| `FINISHED`           | `FINISHED`        | `FT`, `AET`, `PEN` |
| `SUSPENDED`          | `SUSPENDED`       | `SUSP`, `INT`      |
| `POSTPONED`          | `POSTPONED`       | `PST`              |
| `CANCELLED`          | `CANCELLED`       | `CANC`             |
| `AWARDED`            | `AWARDED`         | `AWD`, `WO`        |

---

## 4. Response Shape Mapping

### Leagues endpoint → `GET /leagues`

```jsonc
// API-Football response
{
  "response": [
    {
      "league": {
        "id": 2,         // ← numeric, was FdCompetitionListItem.id
        "name": "UEFA Champions League",
        "type": "Cup",   // "league" | "cup"
        "logo": "https://media.api-sports.io/football/leagues/2.png"
      },
      "country": {
        "name": "World",
        "code": null,
        "flag": null
      },
      "seasons": [
        {
          "year": 2024,
          "start": "2024-07-09",
          "end": "2025-05-31",
          "current": true,
          "coverage": { /* ... */ }
        }
      ]
    }
  ]
}
```

### Fixtures endpoint → `GET /fixtures?league={id}&season={year}`

```jsonc
// API-Football response  (each item in `response` array)
{
  "fixture": {
    "id": 868020,          // ← externalId (was FdMatch.id)
    "date": "2025-02-18T20:00:00+00:00",  // ← was utcDate
    "status": {
      "short": "FT",     // ← was status string
      "long": "Match Finished",
      "elapsed": 90
    }
  },
  "league": {
    "id": 2,
    "name": "UEFA Champions League",
    "round": "League Stage - 8"  // ← matchday info (was match.matchday)
  },
  "teams": {
    "home": {
      "id": 541,          // ← externalId
      "name": "Real Madrid",
      "logo": "https://media.api-sports.io/football/teams/541.png"
    },
    "away": {
      "id": 496,
      "name": "RB Salzburg",
      "logo": "https://media.api-sports.io/football/teams/496.png"
    }
  },
  "goals": {
    "home": 5,            // ← was score.fullTime.home
    "away": 1             // ← was score.fullTime.away
  },
  "score": {
    "halftime": { "home": 3, "away": 0 },
    "fulltime": { "home": 5, "away": 1 },
    "extratime": { "home": null, "away": null },
    "penalty": { "home": null, "away": null }
  }
}
```

---

## 5. Data Field Mapping

### Competition/Contest

| Prisma `Contest` field | football-data.org source          | API-Football source              |
| ---------------------- | --------------------------------- | -------------------------------- |
| `externalId`           | `competition.id`                  | `league.id`                      |
| `name`                 | `competition.name`                | `league.name`                    |
| `code`                 | `competition.code` (e.g. `"CL"`) | Use a manual lookup or store `id` as string |
| `season`               | Derived from `currentSeason.startDate/endDate` | `season.year` (4-digit) |
| `type`                 | `competition.type`                | `league.type` (`"league"` / `"cup"`) |
| `emblem`               | `competition.emblem`              | `league.logo`                    |
| `status`               | Derived from season dates         | Derived from `season.start`/`season.end` or `season.current` |
| `startDate`            | `currentSeason.startDate`         | `season.start`                   |
| `endDate`              | `currentSeason.endDate`           | `season.end`                     |

### Team

| Prisma `Team` field | football-data.org source | API-Football source           |
| ------------------- | ------------------------ | ----------------------------- |
| `externalId`        | `team.id`                | `teams.home.id` / `teams.away.id` |
| `name`              | `team.name`              | `teams.home.name`             |
| `shortName`         | `team.shortName`         | Not provided (use `name`)     |
| `tla`               | `team.tla`               | `teams.home.code` (3-letter, via `/teams` endpoint) |
| `crest`             | `team.crest`             | `teams.home.logo`             |

### Match

| Prisma `Match` field | football-data.org source             | API-Football source                |
| -------------------- | ------------------------------------ | ---------------------------------- |
| `externalId`         | `match.id`                           | `fixture.id`                       |
| `contestId`          | Looked up by contest                 | Same                               |
| `matchDay`           | `match.matchday` (number)            | Parse from `league.round` string   |
| `stage`              | `match.stage`                        | `league.round` (e.g. "League Stage - 8") |
| `group`              | `match.group`                        | `league.round` when group phase    |
| `homeTeamId`         | Looked up via `match.homeTeam.id`    | Looked up via `teams.home.id`      |
| `awayTeamId`         | Looked up via `match.awayTeam.id`    | Looked up via `teams.away.id`      |
| `kickoffTime`        | `match.utcDate`                      | `fixture.date`                     |
| `status`             | `toMatchStatus(match.status)`        | `toMatchStatus(fixture.status.short)` |
| `homeGoals`          | `match.score.fullTime.home`          | `goals.home`                       |
| `awayGoals`          | `match.score.fullTime.away`          | `goals.away`                       |

---

## 6. Known League IDs

| Competition            | API-Football `id` | Current `code` |
| ---------------------- | ----------------- | -------------- |
| UEFA Champions League  | `2`               | `CL`           |
| FIFA World Cup         | `1`               | `WC`           |
| Liga MX                | `262`             | _(new)_        |

> **Note**: Exact IDs should be verified via `GET /leagues?search=...` after
> obtaining an API key, especially Liga MX.

---

## 7. Files That Need Changes

### Core Implementation (3 files)

| # | File                           | Changes Description                                              |
| - | ------------------------------ | ---------------------------------------------------------------- |
| 1 | `web/src/lib/football-api.ts`  | **Full rewrite.** New base URL, auth header, response types, 3 methods. Rename `Fd*` types to `Af*`. Change identifier from code→id. Unwrap `response` array. |
| 2 | `web/src/lib/sync.ts`          | Update `toMatchStatus()` with new status codes. Update `upsertTeam()` and `upsertMatch()` field mappings. Parse `league.round` for `matchDay`/`stage`/`group`. Update `SUPPORTED_COMPETITIONS` shape (id-based). |
| 3 | `web/next.config.ts`           | Change image domain from `crests.football-data.org` to `media.api-sports.io` |

### Admin UI / API Routes (2 files)

| # | File                                          | Changes Description                                |
| - | --------------------------------------------- | -------------------------------------------------- |
| 4 | `web/src/app/api/admin/competitions/route.ts`  | Adapt response mapping to new league response shape |
| 5 | `web/src/app/admin/page.tsx`                   | Update any competition-specific field references (emblem URL, code display) |

### Infrastructure (3 files)

| # | File                              | Changes Description                             |
| - | --------------------------------- | ----------------------------------------------- |
| 6 | `infra/main.bicep`                | Rename parameter `footballApiKey` description    |
| 7 | `infra/app/web.bicep`             | Rename env var `FOOTBALL_API_KEY` or keep same   |
| 8 | `infra/main.parameters.json`      | Update parameter description                    |

### Tests (2 files)

| # | File                                | Changes Description                              |
| - | ----------------------------------- | ------------------------------------------------ |
| 9 | `web/src/lib/__tests__/sync.test.ts`| Update mock responses to new API-Football shape   |
| 10| `web/src/lib/__tests__/football-api.test.ts` | Update mocked fetch responses, type assertions |

### Documentation (3 files)

| # | File          | Changes Description                                         |
| - | ------------- | ----------------------------------------------------------- |
| 11| `README.md`   | Update API registration link, env var description, provider name |
| 12| `SPEC.md`     | Update data-source reference                                |
| 13| `ROADMAP.md`  | Note migration completion in changelog                      |

### Seed Script (1 file)

| # | File                       | Changes Description                        |
| - | -------------------------- | ------------------------------------------ |
| 14 | `web/prisma/seed.ts`      | Update competition references if any       |

**Total: ~14 files affected**

---

## 8. Migration Steps (Implementation Order)

### Phase 1 — API Client Rewrite

1. **Rename** `football-api.ts` types from `Fd*` → `Af*` prefix
2. **Change** `BASE_URL` to `https://v3.football.api-sports.io`
3. **Change** auth header from `X-Auth-Token` → `x-apisports-key`
4. **Rewrite** response types to match API-Football's wrapped shape
5. **Update** `SUPPORTED_COMPETITIONS` to use numeric ids and add Liga MX:
   ```ts
   export const SUPPORTED_COMPETITIONS = [
     { id: 2, name: "UEFA Champions League" },
     { id: 1, name: "FIFA World Cup" },
     { id: 262, name: "Liga MX" },
   ] as const;
   ```
6. **Rewrite** `listCompetitions()` → `GET /leagues`
7. **Rewrite** `getCompetition(id)` → `GET /leagues?id={id}`
8. **Rewrite** `getMatches(id, season?)` → `GET /fixtures?league={id}&season={year}`

### Phase 2 — Sync Service Update

9. **Replace** `toMatchStatus()` mapping with API-Football short codes
10. **Update** `upsertTeam()` to use `teams.home.logo` instead of `team.crest`, etc.
11. **Parse** `league.round` string to extract `matchDay` number, `stage`, and `group`
12. **Update** `upsertMatch()` to read `goals.home`/`goals.away` instead of `score.fullTime`
13. **Update** `deriveContestStatus()` to also consider `season.current` boolean

### Phase 3 — Config & Infra

14. **Update** `next.config.ts` image domain → `media.api-sports.io`
15. **Update** Bicep/infra parameter descriptions (env var can stay `FOOTBALL_API_KEY`)
16. **Update** error messages and registration links

### Phase 4 — Admin UI

17. **Adapt** admin competitions route to new response shape
18. **Update** list rendering (logo URLs, type labels)

### Phase 5 — Tests & Docs

19. **Rewrite** all test mocks with API-Football fixtures/leagues response format
20. **Update** README, SPEC, ROADMAP references

---

## 9. Risk Assessment

| Risk                                    | Impact | Mitigation                                          |
| --------------------------------------- | ------ | --------------------------------------------------- |
| Free tier only 100 req/day              | Medium | Pro plan ($19/mo) gives 7 500/day — sufficient      |
| League ID mismatch                      | Low    | Verify IDs via `/leagues?search=...` before coding   |
| `matchDay` not a number (it's a round string) | Medium | Parse with regex: `"Regular Season - 14"` → `14`  |
| `shortName` not in fixture response     | Low    | Omit or fetch from `/teams?id=X` separately          |
| `code` field (CL, WC) not in API-Football | Medium | Store league `id` as `code`, or maintain a manual map |
| Existing DB `externalId` values will change | High | **Must** re-sync all data since IDs differ between providers |
| Rate limiting per-day vs per-minute     | Low    | Sync is infrequent; daily quota is sufficient        |

---

## 10. Database Migration Consideration

Since `externalId` values will change (football-data.org IDs ≠ API-Football IDs), you need to:

1. **Clear** existing `matches`, `teams`, and `contests` data, OR
2. **Add** a migration that resets `externalId` fields, OR
3. **Create** a mapping table between old and new external IDs

**Recommended approach**: Clear and re-sync, since predictions are linked by
internal Prisma IDs (not external IDs), they will survive the re-sync unharmed
as long as matches are re-created pointing to the same contests.

> ⚠️ **Important**: Existing match records will get *new* external IDs. Predictions
> reference matches by internal `matchId` (UUID), so they remain valid. But
> team and contest records will be duplicated unless you clear them first.

---

## 11. Environment Variable Changes

| Variable           | Before                          | After                           |
| ------------------ | ------------------------------- | ------------------------------- |
| `FOOTBALL_API_KEY` | football-data.org token         | API-Football `x-apisports-key`  |

The env var name can stay the same to minimize infra changes. Only the *value*
(API key) needs to change after registering at
[dashboard.api-football.com](https://dashboard.api-football.com/).

---

## 12. Effort Estimate

| Phase                     | Estimated effort |
| ------------------------- | ---------------- |
| Phase 1 — API client      | 2–3 hours        |
| Phase 2 — Sync service    | 2–3 hours        |
| Phase 3 — Config/infra    | 30 min           |
| Phase 4 — Admin UI        | 1 hour           |
| Phase 5 — Tests & docs    | 2–3 hours        |
| Verification & re-sync    | 1 hour           |
| **Total**                 | **~8–11 hours**  |
