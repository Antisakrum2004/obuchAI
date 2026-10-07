<div align="center">

<img src="public/logo.svg" alt="ObuchAI" width="120" />

# ObuchAI

### AI-тренажёр для IT: промпты, агенты, Cursor, Claude Code и практика каждый день

[![Version](https://img.shields.io/badge/version-v0.38.1-10b981?style=for-the-badge)](https://github.com/Antisakrum2004/obuchAI)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![License](https://img.shields.io/badge/license-Private-red?style=for-the-badge)](https://github.com/Antisakrum2004/obuchAI)

[Демо](https://obuch-ai.vercel.app) · [О проекте](docs/PROJECT_BRAIN.md)

<br/>

<img src="https://img.shields.io/github/last-commit/Antisakrum2004/obuchAI?style=flat-square&color=10b981" alt="last commit" />
<img src="https://img.shields.io/github/commit-activity/m/Antisakrum2004/obuchAI?style=flat-square&color=2FC6F6" alt="commits" />
<img src="https://img.shields.io/github/languages/top/Antisakrum2004/obuchAI?style=flat-square" alt="top language" />
<img src="https://img.shields.io/github/repo-size/Antisakrum2004/obuchAI?style=flat-square&color=orange" alt="repo size" />

</div>

---

## О проекте

**ObuchAI** — геймифицированная платформа практики для всей IT-сферы: джунов, сеньоров, 1С-разработчиков, админов и вайб-кодеров.

Ежедневные задачи по промпт-инжинирингу, AI-агентам, Cursor и Claude Code, плюс марафон, Versus, база знаний и рейтинг.

| | |
|:---|:---|
| **Практика** | Челленджи, квизы, playground, system design |
| **Геймификация** | XP, достижения, лидерборд, серия марафона |
| **Знания** | Курсы, статьи, материалы, карта курса |
| **Соревнования** | Versus и марафон «каждый день» |

---

## Возможности

<table>
<tr>
<td width="50%" valign="top">

### Обучение
- Роадмап: промпты → агенты → Cursor → Claude Code
- Курсы и статьи базы знаний
- Челленджи: AI-coding, ML, БД, LLD / HLD
- Playground и практика
- Локализация RU / EN

</td>
<td width="50%" valign="top">

### Продукт
- Дашборд прогресса и профиль
- Марафон и Versus
- Лидерборд и достижения
- Admin-панель и настройки эффектов
- Auth (NextAuth + Google OAuth)

</td>
</tr>
</table>

---

## Архитектура

```text
┌─────────────────────────────────────────────────────┐
│  Vercel Serverless                                  │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Next.js   │──│ API Routes   │──│ NextAuth v4  │ │
│  │ Pages     │  │ /api/*       │  │ JWT + OAuth  │ │
│  └───────────┘  └──────┬───────┘  └──────────────┘ │
│                        │                            │
│              Prisma · raw SQL (Neon pool)           │
│                        ▼                            │
│              Neon PostgreSQL                        │
└─────────────────────────────────────────────────────┘
```

---

## Стек технологий

<p align="center">
  <img src="https://skillicons.dev/icons?i=nextjs,react,ts,tailwind,prisma,postgres,vercel,git,github" alt="Tech stack" />
</p>

| Слой | Технологии |
|:-----|:-----------|
| **UI** | Next.js 16 · React 19 · Tailwind 4 · shadcn/ui · Framer Motion |
| **API** | Next.js Route Handlers · Zustand |
| **Данные** | Neon PostgreSQL · Prisma 7 · NextAuth v4 |
| **Хранилище** | S3 / Vercel Blob (документы) |
| **Деплой** | Vercel (standalone) |

---

## Структура репозитория

```text
obuchAI/
├── src/app/                 # лендинг, dashboard, challenges, knowledge…
├── src/components/          # UI, layout, brand
├── src/hooks/ · src/lib/    # клиентская логика
├── prisma/                  # схема и seed
├── docs/PROJECT_BRAIN.md    # единый обзор проекта
└── public/                  # логотип и статика
```

---

## Документация

- [`docs/PROJECT_BRAIN.md`](docs/PROJECT_BRAIN.md) — архитектура, окружения, changelog
- [`brain.md`](brain.md) — краткий контекст

---

## Ссылки

| | |
|:---|:---|
| Репозиторий | https://github.com/Antisakrum2004/obuchAI |
| Production | https://obuch-ai.vercel.app |

---

<details>
<summary>Локальный запуск</summary>

```bash
bun install   # или npm install
bun run dev
```

Секреты БД, OAuth и storage — только в env деплоя / `.env.local`.

</details>

---

<div align="center">

**ObuchAI · практика для всей IT-сферы · v0.38.1**

<img src="https://img.shields.io/badge/made%20with-%E2%9D%A4%EF%B8%8F-red?style=for-the-badge" alt="made with love" />

</div>
