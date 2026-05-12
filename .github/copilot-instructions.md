# Copilot Instructions for Open Tipper

## Pre-commit Checks (Required)

Before completing any code change, **always** run the following checks from the `web/` directory to match the CI pipeline:

```bash
cd web
npm run lint          # ESLint — must pass with no errors
npm run format:check  # Prettier — must pass (run `npm run format` to auto-fix)
npm test              # Vitest unit tests — all must pass
npm run build         # Next.js build — must compile without errors
```

These are the same gates enforced by CI (`.github/workflows/ci.yml`). Do not consider a task complete until all four pass locally.

## Fixing Formatting

If `format:check` fails, run `npm run format` to auto-fix, then verify with `format:check` again.

## Project Structure

- **`web/`** — Next.js frontend + API routes (TypeScript)
- **`functions/`** — Azure Functions backend
- **`infra/`** — Infrastructure-as-code (Bicep)

## Key Conventions

- TypeScript is required for all source files
- Prettier handles formatting (do not manually format)
- Tests live next to source files as `*.test.ts` / `*.test.tsx`
- Use Vitest for unit tests, Playwright for E2E
- Follow existing patterns in the codebase
