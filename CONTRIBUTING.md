# Contributing

Thanks for helping improve **Family Genealogy**.

Short Russian note: ветки `feat/` / `fix/` → PR в `main`; перед PR — `npm run lint` и `npm run test`; новые строки UI только через ключи в `src/shared/locales/`. Подробности для агентов: [AGENTS.md](./AGENTS.md) / [AGENTS.ru.md](./AGENTS.ru.md).

## Setup

- Node.js **22+** (`.nvmrc`)
- `npm install` then `npm run dev`

If Vitest fails on native modules after switching between Electron and system Node:

```bash
npm rebuild better-sqlite3 sharp
```

## Workflow

1. Open or comment on an issue (prefer [`good first issue`](https://github.com/vgoloviznin/family-genealogy/labels/good%20first%20issue) / `help wanted`).
2. Branch from `main`: `feat/…` or `fix/…` (docs: `docs/…` is fine).
3. Keep the diff focused — no unrelated refactors.
4. Run locally:

```bash
npm run lint
npm run test
```

5. Open a PR into `main`. Direct pushes to `main` are blocked.

## UI strings

Add or change user-visible text **only** via locale keys under `src/shared/locales/` (ru / en / it). See [AGENTS.md](./AGENTS.md) for renderer vs main patterns.

## Releases

Maintainers cut installers from `v*` tags after a version bump on `main`. Contributors normally do **not** tag releases. Details: [AGENTS.md](./AGENTS.md).

## Coding agents

Follow [AGENTS.md](./AGENTS.md). Thin pointers: `.github/copilot-instructions.md`, `CLAUDE.md`.
