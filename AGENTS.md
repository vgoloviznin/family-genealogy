# AGENTS.md — Family Genealogy

Инструкции для AI-агентов и разработчиков, работающих с этим репозиторием.

## Проект

Desktop-приложение для ведения семейного архива: люди, семейные связи, события, источники/цитаты, медиа, дерево предков/потомков. Данные хранятся **локально** в папке проекта.

Репозиторий: [vgoloviznin/family-genealogy](https://github.com/vgoloviznin/family-genealogy).

## Git: ветки и релизы

- **Default branch — `main`**. Прямой push запрещён (ruleset): только PR → зелёный CI (`lint-test`) → merge. Force-push и удаление `main` запрещены.
- Фичи/фиксы: ветка `feat/…` или `fix/…` → PR в `main`. Не коммитить в `main` напрямую.
- **После merge в `main`** — удалять смерженную ветку на remote (`gh pr merge --delete-branch` или удалить вручную) и локально (`git branch -d …`, `git fetch --prune`), чтобы не копить мусор.
- **Релизы установщиков** — только по git-тегу `v*` (например `v0.2.0`). Не публиковать артефакты на каждый merge в `main`.
- Порядок релиза:
  1. PR с бампом `"version"` в `package.json` (и `package-lock.json`) → merge в `main`.
  2. На SHA merge: `git tag vX.Y.Z && git push origin vX.Y.Z` — номер без `v` **должен совпадать** с `version` в `package.json` (проверка в workflow).
  3. [`.github/workflows/release.yml`](.github/workflows/release.yml) собирает **macOS arm64** (DMG, ad-hoc `identity: "-"`) и **Windows x64** (NSIS) и создаёт [GitHub Release](https://github.com/vgoloviznin/family-genealogy/releases) с артефактами.
- CI на PR/`main`: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — `lint` + `test` (Node из `.nvmrc`; после `npm ci` — `npm rebuild better-sqlite3 sharp` для vitest).
- Сборки **не подписаны** сертификатами (Gatekeeper / SmartScreen). Подпись Apple/Authenticode — вне текущего процесса.
- Подробности для пользователей — README («Скачать», «Как выпустить версию»).

## Стек

- **Electron 37** + **electron-vite** + **React 19** + **TypeScript**
- **SQLite** (`better-sqlite3`) + миграции в `src/main/db/migrations.ts`
- **Tailwind CSS 4**, **@xyflow/react** (дерево), **i18next** (ru / en / it)
- Портable-архив **`.fgtree`** (ZIP64): экспорт, импорт, бэкап, **синхронизация (merge)**

## Структура

```
src/
  main/       — Electron main, IPC, сервисы, БД
  preload/    — contextBridge API (window.api)
  renderer/   — React UI
  shared/     — типы и IPC-каналы (@shared)
tests/        — unit-тесты (зеркало src/ + helpers, setup)
```

## Соглашения

1. **Минимальный diff** — не рефакторить и не добавлять лишнее без запроса.
2. **IPC** — новые методы: тип в `src/shared/types.ts`, handler в `src/main/ipc/register.ts`, preload в `src/preload/index.ts`.
3. **Схема БД** — правки в `schema.ts` + миграции в `src/main/db/migrations.ts` (`schema_migrations`); при смене версии — `SCHEMA_VERSION` и обновление `project.json` только после успешного `runMigrations`. Более новую схему отвергать.
4. **Мягкое удаление** — `deletedAt` для people, events, associations, media, sources, citations.
5. **Обмен данными** — только через `.fgtree`, не синхронизировать живой SQLite через облако (iCloud/Dropbox и т.п. для папки проекта — предупреждение в UI).
6. **Язык UI** — ru (по умолчанию), en, it; выбор на экране приветствия и в настройках. Новые строки — только через ключи в `src/shared/locales/`.
   - **Renderer**: `react-i18next` (`src/renderer/src/i18n.ts`), компоненты — `useTranslation()` / `t('key')`.
   - **Main / shared без React**: `translate(locale, key)` из `@shared/locales`; в main — `localizedError(key)` / `t(getAppLocale(), key)` из `src/main/i18n.ts`. При старте и смене языка: `initAppLocale` / `applyAppLocale` (меню).
   - **IPC**: смена языка в renderer вызывает `window.api.settings.set({ locale })` → `applyAppLocale` в main.
   - **Ошибки пользователю**: ключи в `errors.*`; в `@shared` (например `pack-manifest`) — `translate(locale, …)` с `locale` из `getAppLocale()` в main; не хардкодить текст.
   - **Batch merge preview**: `previewNoteKey` (ключ локали), не готовая строка — UI рендерит через `t()`.
   - **Тесты**: `tests/helpers/localized-error.ts` → `localizedErrorMessage('errors.*')`, не русский текст в `toThrow`.
   - **Пример ошибки в сервисе**: `throw new Error(localizedError('errors.personNotFound'));`
   - **Пример в `@shared`**: `throw new Error(translate(locale, 'errors.invalidArchiveFormat'));` — `locale` из `getAppLocale()` в main.
7. **Не добавлять без запроса**: GEDCOM, полнотекстовый поиск, **автоматическое слияние дубликатов людей** (один человек — два UUID).

## Синхронизация проектов (`.fgtree` merge)

Несколько родственников правят **локальные копии** одного `projectId` и обмениваются архивами. Сервер не используется.

| Действие | Поведение |
|----------|-----------|
| **Импорт** | Развёртывание в **пустую** папку (новая копия проекта). |
| **Синхронизировать…** | Merge **в открытый** проект: preview → при tie-конфликтах UI (default «Моя») → apply. |
| **Синхронизировать несколько…** | Batch merge архивов по `exportedAt`; один autobackup на apply. |

**Правила merge** (ядро в `@shared/merge-rules`, `@shared/merge-places`; apply в `main/services/merge.ts`):

- LWW по `updated_at`; conflict UI только при **равных** timestamps и разном содержимом.
- Soft-delete (`deleted_at`) — побеждает более новая правка по `updated_at`.
- **Places** — dedupe по `normalized_name`, remap `place_id` в событиях.
- **Медиа** — dedupe по `content_hash`, файлы копируются при apply.
- `app_meta` не merge; перед apply — autobackup `.fgtree`, после — `clearUndo()`.

IPC: `pack:syncPreview`, `pack:syncApply`, `pack:syncPreviewBatch`, `pack:syncApplyBatch` — типы в `src/shared/types.ts`, handlers в `register.ts`, preload `window.api.pack.*`.

Справка для пользователей: `SyncHelpDialog.tsx`.

## Команды

```bash
npm install
npm run dev          # разработка
npm run build        # сборка
npm run test         # unit-тесты (vitest)
npm run build:mac    # dmg для macOS arm64 (ad-hoc identity)
npm run build:win    # NSIS для Windows x64
```

Node 22+ (`.nvmrc`). Workflows — см. раздел «Git: ветки и релизы».

## Формат проекта

Рабочая папка:

- `project.json` — метаданные (`projectId`, `schemaVersion`, имя)
- `family.sqlite` — база
- `media/`, `thumbs/` — файлы и превью

## Тестирование

**Любые изменения логики — только через прогон тестов.** Перед завершением задачи выполняй:

```bash
npm run test
```

**Новый функционал сразу покрывается тестами.** Если добавляешь поведение в `@shared`, `main/services` или чистые утилиты — добавь или обнови соответствующий `*.test.ts` в `tests/` (зеркало структуры `src/`).

Unit-тесты на **vitest** (`tests/**/*.{test.ts,test.tsx}`):

- **tests/shared** — дерево, даты, recents, manifest `.fgtree`, merge-rules / merge-places / merge-conflict-fields
- **tests/main** — семьи, проект, архив, merge / merge-batch / pack-sync (SQLite во временной папке)
- **tests/renderer** — подписи и утилиты UI
- **tests/helpers** — фикстуры проекта (`project-fixture.ts`), проверка SQLite
- **tests/setup** — мок Electron (`vitest.setup.ts`)

Electron-диалоги и окна мокаются в `tests/setup/vitest.setup.ts` (`initAppLocale('ru')`, мок `Menu`). Для service-тестов с SQLite может понадобиться `npm rebuild better-sqlite3`, если native-модуль собран под другую версию Node (Electron vs системный Node для vitest).

## Безопасность

- Не коммитить `.env`, ключи, личные данные из тестовых проектов.
- `node_modules/`, `out/`, `release/` — в `.gitignore`.
