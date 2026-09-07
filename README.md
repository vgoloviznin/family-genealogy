# Family Genealogy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vgoloviznin/family-genealogy/actions/workflows/ci.yml/badge.svg)](https://github.com/vgoloviznin/family-genealogy/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/vgoloviznin/family-genealogy)](https://github.com/vgoloviznin/family-genealogy/releases)

**Local-first family archive for macOS and Windows.** No account, no server — your tree lives in a folder on disk. Relatives share and merge updates with a single **`.fgtree`** file.

[Русский](./README.ru.md)

## Why this app

- **vs cloud genealogy (MyHeritage, Ancestry, …):** your data stays on your computer; sync is a file you control, not a subscription silo.
- **vs Gramps / Ancestris:** modern desktop UI and **offline merge** of the same project without treating GEDCOM as the sync path. (GEDCOM import/export is intentionally out of scope for now.)
- **vs “just a tree” apps:** people, relationships, life events, places, sources & citations, media, and an interactive ancestor/descendant tree.

## Screenshots

Product screenshots (`tree.png`, `person.png`, `sync.png`) live in [docs/screenshots/](docs/screenshots/). Capture guidelines and filenames: [docs/screenshots/README.md](docs/screenshots/README.md). PRs that add them are welcome (`good first issue`).

## Features

- Projects in any local folder (`project.json` + SQLite + media)
- People: names, sex, birth/death dates, notes, primary photo
- Family links: partners, children, parents; union and kinship types
- Life events with partial dates and place suggestions
- Sources and citations (book, archive, document, oral history, …)
- Associations (godparents, witnesses, …)
- Media with thumbnails
- Interactive **tree** of ancestors and descendants
- Export / import / backup via **`.fgtree`**
- **Sync** local copies of the same `projectId` (single or batch merge)
- Undo (up to 5 steps)
- UI languages: **ru** / **en** / **it**

## Download

Installers: [GitHub Releases](https://github.com/vgoloviznin/family-genealogy/releases)

| Platform | Artifact |
|----------|----------|
| macOS Apple Silicon | `*-arm64.dmg` |
| Windows x64 | `*Setup*.exe` |

Builds are **unsigned** (ad-hoc on macOS):

- **macOS:** Gatekeeper will warn. On macOS 15+: **System Settings → Privacy & Security** and allow; or `xattr -cr "/Applications/Family Genealogy.app"`.
- **Windows:** SmartScreen → **More info** → **Run anyway**.

## Quick start (development)

**Node.js 22+** (see `.nvmrc`). macOS arm64 or Windows x64 for a local platform build.

```bash
npm install
npm run dev
```

On first launch, set language, editor name, and a backup folder — required before create / open / import.

```bash
npm run test        # unit tests
npm run lint        # ESLint + Prettier
npm run build:mac   # DMG (arm64)
npm run build:win   # NSIS (x64)
```

## Data layout

| Path | Role |
|------|------|
| `project.json` | Project id, name, schema version |
| `family.sqlite` | SQLite database (WAL) |
| `media/` | Original photos and documents |
| `thumbs/` | Image previews |

**`.fgtree`** is a ZIP64 pack (manifest, DB, media, thumbs) for transfer, backup, and **serverless merge**. Pass it through cloud storage as a **file** — do **not** put the live project folder in Dropbox / iCloud / OneDrive (SQLite can corrupt).

Merge details for developers: [AGENTS.md](./AGENTS.md). In-app sync help: sync menu → Help.

## For contributors & coding agents

This repo is set up for humans and AI coding agents:

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — branches, PRs, lint/test, i18n
- **[AGENTS.md](./AGENTS.md)** — stack, IPC/schema rules, merge semantics, non-goals
- Open issues labeled [`good first issue`](https://github.com/vgoloviznin/family-genealogy/labels/good%20first%20issue)

```
src/main/       Electron main, services, DB
src/preload/    contextBridge API (`window.api`)
src/renderer/   React UI
src/shared/     shared types and IPC contract
tests/          Vitest (mirrors src/)
```

Releases are cut from `v*` tags after a version bump on `main` — see [AGENTS.md](./AGENTS.md).

## Community

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)

## License

[MIT](./LICENSE)

## After the storefront

Maintainers: post-merge marketing checklist is in [docs/EXPOSURE.md](docs/EXPOSURE.md) (do not spam channels before screenshots land).

