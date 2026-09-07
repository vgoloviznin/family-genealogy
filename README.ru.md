# Family Genealogy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vgoloviznin/family-genealogy/actions/workflows/ci.yml/badge.svg)](https://github.com/vgoloviznin/family-genealogy/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/vgoloviznin/family-genealogy)](https://github.com/vgoloviznin/family-genealogy/releases)

**Локальный семейный архив для macOS и Windows.** Без аккаунта и без сервера — дерево лежит в папке на диске. Родственники обмениваются правками одним файлом **`.fgtree`**.

[English](./README.md)

## Чем это отличается

- **vs облачная генеалогия (MyHeritage, Ancestry, …):** данные остаются у вас; синхронизация — файл, которым вы управляете, а не подписка.
- **vs Gramps / Ancestris:** современный UI и **офлайн-merge** одного проекта без GEDCOM как пути синхронизации. (Импорт/экспорт GEDCOM сознательно вне текущего scope.)
- **vs «просто дерево»:** люди, связи, события, места, источники и цитаты, медиа, интерактивное дерево предков/потомков.

## Скриншоты

Скриншоты (`tree.png`, `person.png`, `sync.png`) — в [docs/screenshots/](docs/screenshots/). Как снимать: [docs/screenshots/README.md](docs/screenshots/README.md). PR с картинками welcome (`good first issue`).

## Возможности

- Проект в любой локальной папке (`project.json` + SQLite + медиа)
- Карточки людей: ФИО, пол, даты, заметки, главное фото
- Семейные связи: партнёры, дети, родители; тип союза и родства
- События с частичными датами и подсказками мест
- Источники и цитаты
- Ассоциации (крёстные, свидетели и т.п.)
- Медиа с превью
- Интерактивное **древо** предков и потомков
- Экспорт / импорт / бэкап в **`.fgtree`**
- **Синхронизация** копий одного `projectId` (один или несколько архивов)
- Отмена (до 5 шагов)
- Языки UI: **ru** / **en** / **it**

## Скачать

Установщики: [GitHub Releases](https://github.com/vgoloviznin/family-genealogy/releases)

| Платформа | Артефакт |
|-----------|----------|
| macOS Apple Silicon | `*-arm64.dmg` |
| Windows x64 | `*Setup*.exe` |

Сборки **не подписаны** (ad-hoc на macOS):

- **macOS:** Gatekeeper предупредит. На macOS 15+: **Системные настройки → Конфиденциальность и безопасность**; либо `xattr -cr "/Applications/Family Genealogy.app"`.
- **Windows:** SmartScreen → «Подробнее» → «Выполнить в любом случае».

## Быстрый старт (разработка)

**Node.js 22+** (см. `.nvmrc`).

```bash
npm install
npm run dev
```

При первом запуске — язык, имя редактора и папка бэкапов.

```bash
npm run test
npm run lint
npm run build:mac
npm run build:win
```

## Формат данных

| Путь | Назначение |
|------|------------|
| `project.json` | ID, имя, версия схемы |
| `family.sqlite` | База SQLite (WAL) |
| `media/` | Оригиналы |
| `thumbs/` | Превью |

**`.fgtree`** — ZIP64 для переноса, бэкапа и **merge без сервера**. В облако кладите **файл**, а не живую папку проекта (Dropbox / iCloud / OneDrive могут повредить SQLite).

Подробности для разработчиков: [AGENTS.md](./AGENTS.md) (EN) / [AGENTS.ru.md](./AGENTS.ru.md).

## Для контрибьюторов и агентов

- **[CONTRIBUTING.md](./CONTRIBUTING.md)**
- **[AGENTS.md](./AGENTS.md)**
- Issues с меткой [`good first issue`](https://github.com/vgoloviznin/family-genealogy/labels/good%20first%20issue)

## Лицензия

[MIT](./LICENSE)
