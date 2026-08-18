# AGENTS.md — Family Geneology

Инструкции для AI-агентов и разработчиков, работающих с этим репозиторием.

## Проект

Desktop-приложение для ведения семейного архива: люди, семейные связи, события, источники/цитаты, медиа, дерево предков/потомков. Данные хранятся **локально** в папке проекта.

**Remote не используется** — репозиторий и проекты работают только локально, без обязательного git push.

## Стек

- **Electron 37** + **electron-vite** + **React 19** + **TypeScript**
- **SQLite** (`better-sqlite3`) + миграции в `src/main/db/connection.ts`
- **Tailwind CSS 4**, **@xyflow/react** (дерево), **i18next** (RU)
- Портable-архив **`.fgtree`** (ZIP64): экспорт, импорт, бэкап

## Структура

```
src/
  main/       — Electron main, IPC, сервисы, БД
  preload/    — contextBridge API (window.api)
  renderer/   — React UI
  shared/     — типы и IPC-каналы (@shared)
```

## Соглашения

1. **Минимальный diff** — не рефакторить и не добавлять лишнее без запроса.
2. **IPC** — новые методы: тип в `src/shared/types.ts`, handler в `src/main/ipc/register.ts`, preload в `src/preload/index.ts`.
3. **Схема БД** — правки в `schema.ts` + `CREATE TABLE IF NOT EXISTS` в `connection.ts`; при смене версии — `SCHEMA_VERSION` и обновление `project.json`.
4. **Мягкое удаление** — `deletedAt` для people, events, associations, media, sources, citations.
5. **Обмен данными** — только через `.fgtree`, не синхронизировать живой SQLite через облако.
6. **Язык UI** — русский (`src/renderer/src/i18n.ts`).
7. **Не добавлять без запроса**: GEDCOM, полнотекстовый поиск, слияние дубликатов.

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

Unit-тесты на **vitest** для чистых функций (`dates`, `paths`, `labels`). Не тянуть Electron/SQLite в тесты без необходимости — мокать или тестировать утилиты отдельно.

## Безопасность

- Не коммитить `.env`, ключи, личные данные из тестовых проектов.
- `node_modules/`, `out/`, `release/` — в `.gitignore`.
