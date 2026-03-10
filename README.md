# Open Tipper

> Score prediction with your mates — predict football match scores and compete on leaderboards with friends, family, or co-workers.

Inspired by [tipper.io](https://tipper.io), Open Tipper is an open-source, group-based football score prediction platform. Create or join a group, predict exact match scorelines, and earn points via a configurable scoring system.

**[Full Product Spec](SPEC.md)** · **[Implementation Roadmap](ROADMAP.md)**

## Features

- **Group-based competition** — create private or public groups tied to a football competition
- **Browse public groups** — discover and join public groups with search and competition filters
- **Score predictions** — predict exact scorelines for every match, up until kick-off
- **Configurable scoring** — 6 scoring factors with customizable point values and accumulation modes
- **Automatic leaderboards** — standings update automatically as real match results come in
- **Real-time live updates** — live match scores pushed via SSE, "LIVE" badge on in-progress matches, auto-refresh standings & results
- **Results & breakdowns** — view completed matches with each member's prediction and points earned
- **Invite friends** — share a link and friends join instantly
- **Azure-native** — deploy your own instance with a single `azd up` command

## Supported Competitions

Open Tipper supports **any competition available through API-Football** — over 1,200 leagues worldwide. Some popular choices:

- UEFA Champions League
- FIFA World Cup
- Premier League (England)
- La Liga (Spain)
- Bundesliga (Germany)
- Serie A (Italy)
- Ligue 1 (France)
- Liga MX (Mexico)
- UEFA Europa League
- Copa Libertadores
- …and many more

### Adding Competitions

The first user to sign up is automatically made an **admin**. To add competitions:

1. Sign in (you'll be admin if you're the first user)
2. Click the **Admin** link in the navigation bar
3. Go to the **Competitions** tab — this shows all leagues available from API-Football
4. Search or filter for the competition you want (e.g., "Premier League")
5. Click **Sync** to import fixtures and teams
6. The competition now appears in the **Create Group** form for all users

> **Note:** On the free API-Football plan (100 requests/day), some leagues may show a warning if the API restricts data. Upgrade to a paid plan for full access.

### Sub-tournaments (Liga MX, etc.)

Some leagues have multiple sub-tournaments per season (e.g., Liga MX has Apertura and Clausura). The sync automatically detects this and keeps only the most recent sub-tournament's fixtures, so match days don't collide.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Docker](https://www.docker.com/) (for local PostgreSQL)
- [Azure Developer CLI (`azd`)](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd) (for Azure deployment)
- An [API-Football](https://dashboard.api-football.com/) API key

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/open-tipper.git
cd open-tipper
```

#### 1. Start the database

```bash
docker compose up -d
```

This starts a local PostgreSQL 16 instance on port 5432 (user: `postgres`, password: `postgres`, database: `open_tipper`).

#### 2. Install dependencies

```bash
cd web
npm install
```

#### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `web/.env` and fill in at minimum:

| Variable | How to get it |
|----------|---------------|
| `FOOTBALL_API_KEY` | Sign up at [API-Football](https://dashboard.api-football.com/) (free tier — 100 requests/day) |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `DATABASE_URL` | Pre-filled for local Docker: `postgresql://postgres:postgres@localhost:5432/open_tipper?schema=public` |

> The auth provider variables (`AUTH_GOOGLE_*`, `AUTH_GITHUB_*`, `AUTH_MICROSOFT_ENTRA_ID_*`) are optional — configure at least one to enable sign-in. See [Authentication Providers](#authentication-providers) below.

#### 4. Run database migrations

```bash
npx prisma migrate dev
```

This creates all required tables (`teams`, `contests`, `matches`, etc.) in your local PostgreSQL database.

#### 5. Seed the database

```bash
npm run db:seed
```

This fetches current Champions League, World Cup, and Liga MX data from API-Football and populates your database. You'll see output like:

```
✓ Synced UEFA Champions League: X teams, Y matches
✓ Synced FIFA World Cup: X teams, Y matches
✓ Synced Liga MX: X teams, Y matches
```

#### Alternative: Seed with demo data (no API key needed)

If you don't have an API-Football key or simply want to explore all features quickly, you can seed the database with pre-built demo data instead:

```bash
npm run db:seed:demo
```

This creates a complete Liga MX Clausura 2026 scenario with:

| Data | Details |
|------|---------|
| **Contest** | Liga MX Clausura 2026 (active) |
| **Teams** | 18 teams with real names, abbreviations, and crests |
| **Matches** | 153 matches across 17 match days — some finished with scores, some scheduled, and 2 marked as live (IN_PLAY) |
| **Users** | 8 demo accounts with avatars |
| **Group** | "Liga MX Fans" — public group with default scoring rules (invite code: `demo-liga-mx-2026`) |
| **Predictions** | ~90% coverage on finished matches (scored with points) + ~60% coverage on the next 2 upcoming match days |

This lets you explore: results with scoring breakdowns, standings/leaderboard, upcoming predictions, live match badges, and public group discovery — all without any external API calls.

To wipe all data and re-seed from scratch:

```bash
npm run db:seed:demo -- --clean
```

> **Tip:** After seeding, sign in with any OAuth provider. Your account will be separate from the demo users, but you can join the "Liga MX Fans" group via the public groups page or using invite code `demo-liga-mx-2026`.

#### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

#### Re-syncing match data

To update match results and fixtures at any time, run:

```bash
npm run db:sync
```

### Deploy to Azure

Deploy your own instance to Azure with one command:

```bash
# Log in to Azure
azd auth login

# Provision all Azure resources and deploy the app
azd up
```

This provisions:
- **Azure App Service** — hosts the Next.js web app
- **Azure Functions** (Consumption plan) — timer-triggered live sync every 2 minutes during match windows
- **Azure Database for PostgreSQL** (Flexible Server) — application database
- **Azure Blob Storage** — avatar and asset storage
- **Azure Application Insights** — monitoring and logging

> **Note:** The App Service Plan must be **B2 or higher**. The B1 SKU does not provide enough memory (1.75 GB) for Oryx to run `npm install` and `next build` during remote deployment — the build process will be OOM-killed.

To tear down all resources:

```bash
azd down
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `AUTH_SECRET` | NextAuth.js session secret (generate with `openssl rand -base64 32`) | Yes |
| `FOOTBALL_API_KEY` | API-Football API key ([register here](https://dashboard.api-football.com/)) | Yes |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Optional |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Optional |
| `AUTH_GITHUB_ID` | GitHub OAuth app client ID | Optional |
| `AUTH_GITHUB_SECRET` | GitHub OAuth app client secret | Optional |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Microsoft Entra ID app client ID | Optional |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Microsoft Entra ID app client secret | Optional |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | Entra ID issuer URL (for single-tenant) | Optional |
| `CRON_SECRET` | Shared bearer token for cron/timer sync endpoint | Optional |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app | Yes |

See [web/.env.example](web/.env.example) for a template.

## Scripts

All commands run from the `web/` directory:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run db:migrate` | Run Prisma migrations (`prisma migrate dev`) |
| `npm run db:seed` | Seed the database from API-Football |
| `npm run db:seed:demo` | Seed demo data for local testing (no API key needed) |
| `npm run db:sync` | Re-sync match data from API-Football |
| `npx tsx scripts/live-poll.ts` | Start live-sync polling (every 90s) for local dev |

## Authentication Providers

Open Tipper uses [NextAuth.js (Auth.js v5)](https://authjs.dev/) for authentication. It runs entirely inside your app — no external auth service needed. Configure one or more OAuth providers by setting their environment variables. Only providers with credentials set will appear on the sign-in page.

First, generate an auth secret:

```bash
openssl rand -base64 32
```

Add it to `web/.env` as `AUTH_SECRET=<generated-value>`.

### Google

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add **Authorized redirect URI**: `http://localhost:3000/api/auth/callback/google`
4. Copy the Client ID and Client Secret into your `web/.env`:

```dotenv
AUTH_GOOGLE_ID=<your-client-id>
AUTH_GOOGLE_SECRET=<your-client-secret>
```

### GitHub

1. Go to [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Create a **New OAuth App**
3. Set **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Copy the Client ID and generate a Client Secret into your `web/.env`:

```dotenv
AUTH_GITHUB_ID=<your-client-id>
AUTH_GITHUB_SECRET=<your-client-secret>
```

### Microsoft Entra ID

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) and create a new registration
2. Set **Supported account types** to "Accounts in any organizational directory and personal Microsoft accounts"
3. Add **Redirect URI** (Web): `http://localhost:3000/api/auth/callback/microsoft-entra-id`
4. Under **Certificates & secrets**, create a new client secret
5. Copy into your `web/.env`:

```dotenv
AUTH_MICROSOFT_ENTRA_ID_ID=<application-client-id>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<client-secret-value>
```

> **Note:** No tenant ID is needed for multi-tenant (any Microsoft account). To restrict to a single tenant, add:
> `AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0`

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL (local Docker / Azure Flexible Server)
- **ORM:** Prisma
- **Auth:** NextAuth.js (Auth.js v5) — Google, GitHub, Microsoft
- **Hosting:** Azure App Service + Azure Functions (Consumption)
- **IaC:** Azure Developer CLI (`azd`) + Bicep
- **CI/CD:** GitHub Actions
- **Testing:** Vitest + Playwright

## Project Structure

```
open-tipper/
├── .github/workflows/     # CI/CD pipelines
├── infra/                 # Azure Bicep infrastructure templates
│   ├── main.bicep         # Root orchestration
│   ├── app/               # App-specific infra (web app config)
│   └── core/              # Shared infra modules
│       ├── database/      # PostgreSQL Flexible Server
│       ├── monitor/       # Application Insights
│       ├── host/          # Azure Functions
│       └── storage/       # Blob Storage
├── functions/             # Azure Functions (timer-triggered live sync)
│   └── src/               # Function App source code
├── web/                   # Next.js web application
│   ├── e2e/               # Playwright end-to-end tests
│   ├── prisma/            # Prisma schema and migrations
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # Shared React components
│   │   └── lib/           # Utility functions and services
│   └── package.json
├── azure.yaml             # Azure Developer CLI manifest
├── docker-compose.yml     # Local development services
├── SPEC.md                # Product specification
├── ROADMAP.md             # Implementation plan & roadmap
└── README.md
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
