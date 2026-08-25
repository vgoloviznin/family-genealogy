# AGENTS.md — Family Geneology

Инструкции для AI-агентов и разработчиков, работающих с этим репозиторием.

## Проект

Desktop-приложение для ведения семейного архива: люди, семейные связи, события, источники/цитаты, медиа, дерево предков/потомков. Данные хранятся **локально** в папке проекта.

**Remote не используется** — репозиторий и проекты работают только локально, без обязательного git push.

## Стек

- **Electron 37** + **electron-vite** + **React 19** + **TypeScript**
- **SQLite** (`better-sqlite3`) + миграции в `src/main/db/connection.ts`
- **Tailwind CSS 4**, **@xyflow/react** (дерево), **i18next** (RU)
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
3. **Схема БД** — правки в `schema.ts` + `CREATE TABLE IF NOT EXISTS` в `connection.ts`; при смене версии — `SCHEMA_VERSION` и обновление `project.json`.
4. **Мягкое удаление** — `deletedAt` для people, events, associations, media, sources, citations.
5. **Обмен данными** — только через `.fgtree`, не синхронизировать живой SQLite через облако (iCloud/Dropbox и т.п. для папки проекта — предупреждение в UI).
6. **Язык UI** — русский (`src/renderer/src/i18n.ts`).
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
npm run build:mac    # dmg для macOS
npm run build:win    # NSIS для Windows
```

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

Unit-тесты на **vitest** (`tests/**/*.test.ts`):

- **tests/shared** — дерево, даты, recents, manifest `.fgtree`, merge-rules / merge-places / merge-conflict-fields
- **tests/main** — семьи, проект, архив, merge / merge-batch / pack-sync (SQLite во временной папке)
- **tests/renderer** — подписи и утилиты UI
- **tests/helpers** — фикстуры проекта (`project-fixture.ts`), проверка SQLite
- **tests/setup** — мок Electron (`vitest.setup.ts`)

Electron-диалоги и окна мокаются в `src/main/test/vitest.setup.ts`. Для service-тестов с SQLite может понадобиться `npm rebuild better-sqlite3`, если native-модуль собран под другую версию Node (Electron vs системный Node для vitest).

## Безопасность

- Не коммитить `.env`, ключи, личные данные из тестовых проектов.
- `node_modules/`, `out/`, `release/` — в `.gitignore`.
