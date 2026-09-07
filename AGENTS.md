# AGENTS.md — Family Genealogy

Instructions for AI coding agents and human contributors.

Canonical language: **English**. Russian: [AGENTS.ru.md](./AGENTS.ru.md).

## Project

Desktop app for a family archive: people, relationships, events, sources/citations, media, ancestor/descendant tree. Data is stored **locally** in a project folder.

Repo: [vgoloviznin/family-genealogy](https://github.com/vgoloviznin/family-genealogy).

## Git: branches and releases

- **Default branch `main`**. No direct pushes (ruleset): PR → green CI (`lint-test`) → merge. No force-push / delete `main`.
- Features/fixes: `feat/…` or `fix/…` → PR into `main`.
- After merge: delete the remote branch (`gh pr merge --delete-branch`) and prune locally.
- **Installer releases** only from git tag `v*` (e.g. `v0.2.0`), not on every `main` merge.
- Release flow:
  1. PR bumping `"version"` in `package.json` (+ lockfile) → merge to `main`.
  2. On merge SHA: `git tag vX.Y.Z && git push origin vX.Y.Z` — tag without `v` **must match** `package.json` `version` (workflow check).
  3. [`.github/workflows/release.yml`](.github/workflows/release.yml) builds **macOS arm64** (DMG, ad-hoc `identity: "-"`) and **Windows x64** (NSIS) → [GitHub Release](https://github.com/vgoloviznin/family-genealogy/releases).
- CI on PR/`main`: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — lint + test (Node from `.nvmrc`; after `npm ci` rebuild `better-sqlite3` and `sharp` for vitest).
- Builds are **unsigned** (Gatekeeper / SmartScreen). Apple/Authenticode signing is out of process.
- User-facing download notes: [README.md](./README.md).

## Stack

- **Electron** + **electron-vite** + **React 19** + **TypeScript** (see `package.json` for exact versions)
- **SQLite** (`better-sqlite3`) + migrations in `src/main/db/migrations.ts`
- **Tailwind CSS 4**, **@xyflow/react** (tree), **i18next** (ru / en / it)
- Portable **`.fgtree`** (ZIP64): export, import, backup, **sync (merge)**

## Layout

```
src/
  main/       Electron main, IPC, services, DB
  preload/    contextBridge API (`window.api`)
  renderer/   React UI
  shared/     shared types and IPC channels (@shared)
tests/        unit tests (mirrors src/ + helpers, setup)
```

## Conventions

1. **Minimal diff** — no drive-by refactors or extras.
2. **IPC** — new methods: type in `src/shared/types.ts`, handler in `src/main/ipc/register.ts`, preload in `src/preload/index.ts`.
3. **DB schema** — edit `schema.ts` + migrations in `src/main/db/migrations.ts` (`schema_migrations`); bump `SCHEMA_VERSION` and update `project.json` only after successful `runMigrations`. Reject newer schemas.
4. **Soft delete** — `deletedAt` for people, events, associations, media, sources, citations.
5. **Data exchange** — only via `.fgtree`; never sync a live SQLite folder through iCloud/Dropbox/etc. (UI warns).
6. **UI i18n** — ru (default), en, it. New strings **only** via keys in `src/shared/locales/`.
   - **Renderer**: `react-i18next` (`src/renderer/src/i18n.ts`), `useTranslation()` / `t('key')`.
   - **Main / shared without React**: `translate(locale, key)` from `@shared/locales`; in main — `localizedError(key)` / `t(getAppLocale(), key)` from `src/main/i18n.ts`. Startup / locale change: `initAppLocale` / `applyAppLocale` (menus).
   - **IPC**: renderer `window.api.settings.set({ locale })` → `applyAppLocale` in main.
   - **User-facing errors**: `errors.*` keys; in `@shared` use `translate(locale, …)` with locale from `getAppLocale()` in main — never hardcode UI text.
   - **Batch merge preview**: `previewNoteKey` (locale key), not a finished string — UI renders via `t()`.
   - **Tests**: `tests/helpers/localized-error.ts` → `localizedErrorMessage('errors.*')`; do not assert raw Russian in `toThrow`.
   - Service example: `throw new Error(localizedError('errors.personNotFound'));`
   - `@shared` example: `throw new Error(translate(locale, 'errors.invalidArchiveFormat'));`
7. **Do not add without an explicit request**: GEDCOM, full-text search, **automatic person dedupe** (one person — two UUIDs).

## Project sync (`.fgtree` merge)

Relatives edit **local copies** of the same `projectId` and exchange archives. No server.

| Action | Behavior |
|--------|----------|
| **Import** | Unpack into an **empty** folder (new copy). |
| **Sync…** | Merge **into the open** project: preview → tie conflicts UI (default “Mine”) → apply. |
| **Sync several…** | Batch merge by `exportedAt`; one autobackup on apply. |

**Merge rules** (core in `@shared/merge-rules`, `@shared/merge-places`; apply in `main/services/merge.ts`):

- LWW by `updated_at`; conflict UI only when timestamps are **equal** and content differs.
- Soft-delete (`deleted_at`) — newer `updated_at` wins.
- **Places** — dedupe by `normalized_name`, remap `place_id` on events.
- **Media** — dedupe by `content_hash`; copy files on apply.
- `app_meta` is not merged; before apply — autobackup `.fgtree`, after — `clearUndo()`.

IPC: `pack:syncPreview`, `pack:syncApply`, `pack:syncPreviewBatch`, `pack:syncApplyBatch` — types in `src/shared/types.ts`, handlers in `register.ts`, preload `window.api.pack.*`.

User help UI: `SyncHelpDialog.tsx`.

## Commands

```bash
npm install
npm run dev          # development
npm run build        # production build
npm run test         # unit tests (vitest)
npm run build:mac    # macOS arm64 DMG (ad-hoc identity)
npm run build:win    # Windows x64 NSIS
```

Node 22+ (`.nvmrc`). Workflows — see Git section above.

## Project folder format

- `project.json` — `projectId`, `schemaVersion`, name
- `family.sqlite` — database
- `media/`, `thumbs/` — files and previews

## Testing

**Any logic change must pass tests.** Before finishing a task:

```bash
npm run test
```

**New behavior needs tests.** For `@shared`, `main/services`, or pure utils — add/update `*.test.ts` under `tests/` (mirrors `src/`).

Vitest layout (`tests/**/*.{test.ts,test.tsx}`):

- **tests/shared** — tree, dates, recents, `.fgtree` manifest, merge-rules / merge-places / merge-conflict-fields
- **tests/main** — families, project, archive, merge / merge-batch / pack-sync (temp SQLite)
- **tests/renderer** — labels and UI helpers
- **tests/helpers** — project fixtures (`project-fixture.ts`), SQLite checks
- **tests/setup** — Electron mocks (`vitest.setup.ts`)

Electron dialogs/windows are mocked in `tests/setup/vitest.setup.ts` (`initAppLocale('ru')`, Menu mock). Service tests with SQLite may need `npm rebuild better-sqlite3` if the native module was built for Electron vs system Node.

## Security

- Do not commit `.env`, secrets, or personal data from real test projects.
- `node_modules/`, `out/`, `release/` are gitignored.
- Vulnerability reports: [SECURITY.md](./SECURITY.md) (private advisory preferred; no public issues).
