---
name: github-release
description: >-
  Cuts a GitHub Release with macOS DMG and Windows NSIS installers by bumping
  version via PR, then pushing a vX.Y.Z git tag (never a GitHub UI release).
  Use when the user asks to release, publish a version, cut a tag, ship
  installers, or mentions релиз, выпуск версии, тег, GitHub Release, DMG, NSIS.
---

# GitHub Release (tagged installers)

Publish macOS arm64 DMG and Windows x64 NSIS via `.github/workflows/release.yml`.

Installers are **not** built on merge to `main`. They are built only when a git tag matching `v*` is **pushed**. Creating a GitHub Release in the UI does **not** run that workflow unless the tag name is `vX.Y.Z`.

## Hard rules

- Tag format is **`vX.Y.Z`** (leading `v` required). Never tag `0.3.0`, `v0.3`, or `release-0.3.0`.
- The part after `v` **must equal** `"version"` in `package.json` (workflow fails otherwise).
- **Do not** create the GitHub Release in the website UI or with `gh release create`. The workflow’s `publish` job does that (`softprops/action-gh-release`) and attaches artifacts.
- **Do not** tag until the version bump is **merged into `origin/main`** and you tag that merge SHA.
- **Do not** commit or push to `main` directly. Version bump goes through a PR.
- **Do not** publish artifacts on a random commit or on a feature branch.
- **Do not** move an existing `vX.Y.Z` tag to a different SHA. Ship a new patch instead.

## Prerequisites (do first — saves round-trips)

```bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v gh >/dev/null || { echo "gh CLI required; install with: brew install gh"; exit 1; }
gh auth status
```

If `gh` is missing, install/auth once, then continue. Prefer `gh` for PRs, checks, merge, runs, and releases (repo rule).

## When to use

- User asks to release / cut a version / publish installers
- Version is already bumped on `main` but no `v*` tag (or a wrong tag like `0.3.0` exists)

## Workflow

Copy and track:

```
Release Progress:
- [ ] 0. PATH + gh ready
- [ ] 1. Decide version
- [ ] 2. Ensure version is on origin/main (PR if needed)
- [ ] 3–4. Tag + push vX.Y.Z in one step (after merge)
- [ ] 5. Point user at Release run (do not block on mac+win)
```

### 1. Decide version

Read `"version"` from `package.json` on `origin/main` after `git fetch`.

Compare with remote tags (`git ls-remote --tags origin 'v*'`):

| Situation | Action |
|-----------|--------|
| User named a version (`0.3.0`, `v0.3.0`) | Use `X.Y.Z` in `package.json`, tag `vX.Y.Z` |
| User said patch / minor / major | Bump from current `package.json` |
| “release” only; `main` version `X.Y.Z` has **no** `vX.Y.Z` tag | Skip bump → step 3 |
| `vX.Y.Z` **already exists** and `origin/main` is **ahead** of that tag (unreleased commits) | **Do not ask** — bump **patch** (`X.Y.Z` → `X.Y.(Z+1)`), then step 2 |
| `vX.Y.Z` exists and `origin/main` **is** that tag SHA | Nothing to ship — report the existing release URL |
| Ambiguous otherwise | Ask once which version to ship |

### 2. Version bump PR (skip if already on `origin/main`)

Inspect:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
node -p "require('./package.json').version"
git tag -l 'v*'
git ls-remote --tags origin 'v*' 'refs/tags/[0-9]*'
```

If `package.json` on `origin/main` already equals the target version **and** remote has no `vX.Y.Z` yet → skip to step 3.

Otherwise:

1. Branch: `chore/release-X.Y.Z` (not `main`).
2. Bump **both** `package.json` and `package-lock.json`:

   ```bash
   npm version X.Y.Z --no-git-tag-version
   ```

   Do **not** let `npm version` create a git tag (`--no-git-tag-version` is required).

3. Commit (English, conventional): `chore(release): bump version to X.Y.Z`
4. Push the branch, open PR into `main`, wait for CI (`lint-test`) to pass (`gh pr checks <n> --watch`).
5. Merge + sync in one go (prefer a **single** approved shell when Auto-review gates writes):

   ```bash
   gh pr merge <n> --merge --delete-branch
   git checkout main && git pull --ff-only origin main
   git fetch --prune
   git branch -d chore/release-X.Y.Z 2>/dev/null || true
   ```

Never combine the version bump with unrelated feature commits.

### 3–4. Tag and push (one step)

After bump is on `origin/main`, confirm then tag+push **in the same command block** (one approval):

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
test "$(node -p "require('./package.json').version")" = "X.Y.Z"
test -z "$(git ls-remote --tags origin "vX.Y.Z")"
git tag "vX.Y.Z"
git push origin "vX.Y.Z"
```

Confirm before tagging:

- `origin/main` `package.json` version is `X.Y.Z`
- SHA is `origin/main` (merge that contains the bump)
- Remote does **not** already have `vX.Y.Z`

Tag annotated or lightweight is fine; name must be exactly `vX.Y.Z`. Pushing the tag starts workflow **Release**. Pushing `main` again does nothing for installers.

### 5. Verify (non-blocking)

Do **not** wait in-chat for mac + win builds (several minutes). Immediately:

1. Confirm the tag exists remotely.
2. List the new run and give the user the Actions URL:

   ```bash
   gh run list --workflow=release.yml --limit 3
   ```

3. Report expected release page: `https://github.com/vgoloviznin/family-genealogy/releases/tag/vX.Y.Z` (assets appear when `publish` finishes: `*.dmg`, `*Setup*.exe`).

Optional: if the user asks to wait, then `gh run watch` / re-check assets.

If `gh` auth fails for Actions API, give the workflow URL from the push output / Actions tab and stop blocking.

## Recovery: wrong tag or UI-only release

Typical failure: GitHub Release / tag named `0.3.0` (no `v`). Workflow never runs. UI-created releases also skip the builder.

1. Delete the bad **tag** (local + remote):

   ```bash
   git push origin :refs/tags/0.3.0
   git tag -d 0.3.0
   ```

2. If a GitHub Release exists for that name and `gh` works:

   ```bash
   gh release delete 0.3.0 --yes
   ```

   Deleting the tag often removes or orphans that release; still delete it if it remains.

3. Push the correct tag on the **same** version-bump merge SHA: `git tag vX.Y.Z && git push origin vX.Y.Z`

### Recovery: tag already shipped but build was wrong

If `vX.Y.Z` exists with a GitHub Release / assets, but `main` now has fixes that must ship:

- **Do not** delete or move `vX.Y.Z`.
- Bump **patch**, open `chore/release-X.Y.(Z+1)`, merge, tag `vX.Y.(Z+1)`.

## Out of scope

- Code signing (Apple / Authenticode) — not part of this process.
- Local `npm run build:mac` / `build:win` unless the user asked for a local build, not a GitHub Release.
- Releasing from a fork or a non-`main` SHA.
- Waiting for the full Release workflow unless the user explicitly asks to watch it finish.
