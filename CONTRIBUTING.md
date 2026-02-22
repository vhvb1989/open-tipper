# Contributing to Sport Predictor

Thank you for your interest in contributing! This project is open-source and welcomes contributions of all kinds.

## Getting Started

1. **Fork** the repository and clone your fork locally.
2. Follow the [Quick Start](#quick-start) instructions in the README to set up your local environment.
3. Create a new branch for your work: `git checkout -b feature/my-feature`

## Development Workflow

1. **Read the docs first** — review [SPEC.md](SPEC.md) for product requirements and [ROADMAP.md](ROADMAP.md) for the implementation plan.
2. **Pick a task** — check the ROADMAP for the current cycle and pick an uncompleted item.
3. **Write code** — implement your changes with tests.
4. **Run checks** before committing (from the `web/` directory):
   ```bash
   cd web
   npm run lint          # ESLint
   npm run format:check  # Prettier
   npm test              # Unit tests
   npm run build         # Ensure it compiles
   ```
5. **Commit** with a clear message describing what changed and why.
6. **Open a Pull Request** against `main` with a description of your changes.

## Code Style

- **TypeScript** is required for all source files.
- **Prettier** handles formatting — run `npm run format` to auto-format.
- **ESLint** catches code quality issues — run `npm run lint` to check.
- Follow existing patterns in the codebase.

## Testing

- **Unit tests** use [Vitest](https://vitest.dev/) — place them next to the source file as `*.test.ts` or `*.test.tsx`.
- **End-to-end tests** use [Playwright](https://playwright.dev/) — place them in the `web/e2e/` directory.
- All PRs should include relevant tests for new functionality.

## Commit Messages

Use clear, descriptive commit messages. Example formats:

```
feat: add group creation form
fix: correct scoring calculation for draws
docs: update ROADMAP after completing Cycle 2
test: add unit tests for scoring engine
chore: update dependencies
```

## Reporting Issues

- Use GitHub Issues to report bugs or request features.
- Include steps to reproduce, expected behaviour and actual behaviour for bugs.
- Check existing issues before opening a new one.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
