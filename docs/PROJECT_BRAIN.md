# PROJECT_BRAIN

## 1. Project Overview

- **Что это**: AI Тренажёр для разработчиков — Duolingo-style геймифицированная платформа обучения навыкам работы с ИИ
- **Задача**: Научить 1C-разработчиков промпт-инжинирингу, работе с AI-агентами, дебаггингу через решение задач
- **Домен**: obuch-ai.vercel.app
- **Стек**:
  - Frontend: Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + shadcn/ui
  - Backend: Next.js API Routes (serverless)
  - БД: Neon PostgreSQL (serverless) через Prisma 7 + raw SQL
  - Аутентификация: NextAuth.js v4 (JWT strategy)
  - Стейт: Zustand 5 (клиент)
  - Анимации: Framer Motion 12 + canvas-confetti
  - Деплой: Vercel (standalone output)

---

## 2. Architecture

### Общая схема

```
┌─────────────────────────────────────────────────┐
│  Vercel Edge / Serverless                       │
│  ┌───────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ Next.js   │  │ API Routes   │  │ Auth     │ │
│  │ Pages     │──│ /api/*       │──│ NextAuth │ │
│  │ (SSR/SSG) │  │              │  │ JWT v4   │ │
│  └───────────┘  └──────┬───────┘  └──────────┘ │
│                        │                         │
│          ┌─────────────┼──────────────┐          │
│          │  Raw SQL    │  Prisma ORM  │          │
│          │  (pool.query)│ (db.*.create)│          │
│          └─────────────┼──────────────┘          │
│                        │                         │
│              ┌─────────▼─────────┐               │
│              │ Neon PostgreSQL   │               │
│              │ (Serverless Pool) │               │
│              └───────────────────┘               │
└─────────────────────────────────────────────────┘
```

### Ключевые зависимости

| Зависимость | Версия | Роль |
|---|---|---|
| next | ^16.1.1 | Фреймворк |
| react | ^19.0.0 | UI |
| next-auth | ^4.24.11 | Аутентификация |
| @prisma/client | ^7.8.0 | ORM (частично) |
| @neondatabase/serverless | ^1.1.0 | Драйвер БД |
| zustand | ^5.0.6 | Клиентский стейт |
| framer-motion | ^12.23.2 | Анимации |
| recharts | ^2.15.4 | Графики |
| @dnd-kit/core | ^6.3.1 | Drag-and-drop |
| canvas-confetti | ^1.9.4 | Конфетти |
| html-to-image | ^1.11.13 | Генерация share-карточки |
| z-ai-web-dev-sdk | ^0.0.17 | AI SDK (playground) |

### Как идут данные

1. Пользователь → страница (SSG/CSR) → Zustand store (профиль, XP, streak)
2. Действие (ответ на задачу) → POST `/api/challenges/[id]/submit` → валидация → UPDATE БД → XP/streak/achievements → ответ клиенту
3. Каждый запрос → JWT декодируется → данные юзера обновляются из БД (jwt callback)
4. Feature flags: `/api/settings` (revalidate 30s) → `useAppSettings` context

---

## 3. Core Modules

### 3.1 Auth (`src/lib/auth.ts`)
- **Путь**: `src/lib/auth.ts`
- **Ответственность**: Google OAuth + demo-вход + admin-вход, JWT сессии, колбеки (signIn, jwt, session, redirect)
- **Связи**: Все `/api/*` маршруты проверяют `session` через `getServerSession()`

### 3.2 Database (`src/lib/db.ts`)
- **Путь**: `src/lib/db.ts`
- **Ответственность**: Dual-access — `pool` (raw SQL, 85% запросов) + `db` (PrismaClient, admin routes)
- **Связи**: Все API routes импортируют `pool` или `db`

### 3.3 Gamification (`src/lib/gamification.ts`)
- **Путь**: `src/lib/gamification.ts`
- **Ответственность**: XP/level математика, множители времени/сердец, streak-бонусы, лейблы сложности
- **Связи**: `/api/challenges/[id]/submit`, `/api/marathon/complete`, `xp-bar.tsx`

### 3.4 User Store (`src/store/user-store.ts`)
- **Путь**: `src/store/user-store.ts`
- **Ответственность**: Zustand-стор: id, name, xp, level, streak, rank, completedChallenges
- **Связи**: Dashboard, header, profile, все компоненты с данными юзера

### 3.5 Challenge System
- **Путь**: `src/app/challenges/`, `src/app/api/challenges/`
- **Ответственность**: Список задач, фильтрация, решение, валидация, cooldown
- **Связи**: Gamification, streak, hearts, achievements

### 3.6 Marathon Mode
- **Путь**: `src/app/mathon/`, `src/app/api/marathon/`
- **Ответственность**: 15 последовательных задач, локальная валидация, множитель streak
- **Связи**: Challenge system, gamification

### 3.7 Admin Panel
- **Путь**: `src/app/admin/`, `src/app/api/admin/`
- **Ответственность**: CRUD задач/навыков/ачивок, управление юзерами (role/ban/XP/hearts/streak), сидирование, фича-флаги
- **Связи**: Все API admin routes, middleware guard

### 3.8 Achievement System
- **Путь**: `src/components/gamification/achievement-*.tsx`, `src/app/achievements/`
- **Ответственность**: 20 SVG-иконок, 16+ ачивок, автопроверка при правильном ответе, модал разблокировки
- **Связи**: Challenge submit, dashboard, profile

### 3.9 Layout & Navigation
- **Путь**: `src/components/layout/`
- **Ответственность**: Sidebar (desktop), header (XP/streak/avatar), mobile tab bar, AppLayout wrapper
- **Связи**: Все страницы оборачиваются в `<AppLayout>`

### 3.10 Effects & Themes
- **Путь**: `src/components/effects/`, `src/hooks/use-app-settings.tsx`, `src/app/globals.css`
- **Ответственность**: Particles background, confetti, тёмная/светлая тема, фича-флаги эффектов
- **Связи**: `useAppSettings` context, `/api/admin/settings`

### 3.11 Profile & Social
- **Путь**: `src/app/profile/[id]/`, `src/components/profile/`
- **Ответственность**: Публичный профиль, share-карточка, реферальная система
- **Связи**: User store, achievements, skills

---

## 4. Current State

### Реализовано и работает стабильно
- Аутентификация (Google OAuth + demo + admin)
- 100 задач в 7 категориях (промптинг, агенты, дебаг, workflow, 1С, ревью, tools)
- 3 типа задач: multiple_choice, ordering, workflow_build
- Геймификация: XP, уровни (1-∞), streak, hearts, cooldown
- Marathon mode (15 задач, множитель streak)
- Achievement system (16+ ачивок, SVG иконки, rarity tiers)
- Skill tree (7 категорий, иерархия)
- Leaderboard (alltime/weekly/monthly)
- Daily challenge
- Admin panel (CRUD, пользователи, сидирование, эффекты)
- Реферальная система
- Адаптивный дизайн (mobile + desktop)
- Avatar frames (CSS glow по tier, dragon frame для admin)
- Тёмная/светлая тема
- Particle effects + confetti (отключаемые через фича-флаги)
- Profile page с share-карточкой

### Работает частично
- Activity chart: верхняя граница может перекрывать числа при высоких значениях
- Адаптивная сложность: механизм есть, но нет UI-индикации для юзера
- Marathon: валидация на клиенте (correctAnswer отправляется в response) — работает, но нечестно

### Не реализовано
- Интеграция с z-ai-web-dev-sdk (playground страница есть, но без функционала)
- Уведомления (push/email)
- Глобальный поиск
- Мультиязычность (только русский)
- Тесты (0 тестовых файлов)

---

## 5. Known Issues & Problems

### Критические
1. **Hardcoded admin-пароль** — `admin/admin123` прямо в `src/lib/auth.ts:143`
2. **SQL injection** — admin challenges PUT использует `Object.entries(body)` для формирования SQL-колонок без whitelist
3. **Marathon читерство** — `correctAnswer` отправляется клиенту в `/api/marathon`
4. **Нет валидации входных данных** — admin routes передают `body` напрямую в Prisma

### Значимые
5. **Schema drift** — Prisma schema не содержит 9+ колонок и 1 таблицу (`app_settings`), добавленных через `ALTER TABLE` в runtime
6. **Runtime ALTER TABLE** — `ensureColumns()` в `admin/users/[id]/route.ts` выполняет ALTER TABLE при каждом запросе
7. **Дублирование данных сидирования** — 100 задач определены и в `prisma/seed.ts`, и в `admin/seed/route.ts` — нужно синхронизировать вручную
8. **Дублирование genId()** — функция копируется в 5+ файлов
9. **Дублирование реферальной логики** — генерация кода + XP начисление повторяются 3 раза
10. **Неправильное имя таблицы** — `DELETE FROM attempts` вместо `challenge_attempts` в `admin/challenges/[id]/route.ts:75`
11. **Type-unsafe касты** — 44+ инстансов `as Record<string, unknown>` вместо расширения NextAuth типов
12. **`ignoreBuildErrors: true`** в next.config.ts — TypeScript ошибки не ломают билд
13. **`reactStrictMode: false`** — отключён строгий режим React

### Минорные
14. **Версия не совпадает** — package.json `0.3.0`, sidebar `v2.4.0`
15. **Stale .env.example** — содержит GITHUB_ID/EMAIL_SERVER, которые не используются
16. **Мёртвые зависимости** — next-intl, @mdxeditor/editor, sharp, playwright не используются в src/
17. **Vercel Toolbar hack** — скрипт+куки для убийства тулбара вместо нормального отключения

---

## 6. Attempts & Failures

### Мобильная производительность
- **Проблема**: На мобильных анимации тормозили (~25+ анимированных элементов)
- **Что пробовали**: Framer Motion на всём, 18 частиц, shimmer-эффекты
- **Что сработало**: Снижение частиц до 6 на мобильных, удаление Framer Motion из header, CSS-only fire particles вместо JS-анимаций, setInterval 5s для hearts на мобильных
- **Урок**: Мобильные устройства не тянут >10 одновременных анимаций; CSS-only анимации дешевле Framer Motion

### Avatar frames
- **Проблема**: PNG-фреймы были слишком толстые, для admin — dragon PNG
- **Что пробовали**: PNG overlay с position:absolute
- **Что сработало**: CSS box-shadow glow для обычных юзеров (по tier), dragon PNG только для admin
- **Урок**: CSS glow гибче и легче PNG; отдельные PNG для каждого уровня — overkill

### XP bar
- **Проблема**: Полоска опыта полностью зелёная вместо частичного заполнения
- **Что пробовали**: Liquid animation, shimmer, glow dot
- **Что сработало**: Простой div с width=pct%, gradient по tier, без shimmer/glow
- **Урок**: Простое заполнение понятнее liquid-анимаций

### Achievement cards
- **Проблема**: Эмоджи в кружочках выглядят дёшево
- **Что пробовали**: Emoji + round container + shimmer
- **Что сработало**: SVG silhouette иконки (20 штук), квадратный frame без кругов, иконки "парят" над frame
- **Урок**: Кастомные SVG > эмоджи; минимализм > блёстки

### Schema drift
- **Проблема**: Нужно было добавить колонки без Prisma миграций
- **Что пробовали**: Prisma migrate, prisma db push
- **Что НЕ сработало**: Prisma migrate ломался на Neon serverless
- **Что сработало**: `ALTER TABLE IF NOT EXISTS` в runtime через API endpoint
- **Почему**: Neon serverless + Prisma adapter имеет ограничения; runtime DDL — временный костыль, ставший постоянным

---

## 7. Decisions & Reasoning

### Raw SQL вместо Prisma для большинства запросов
- **Причина**: Prisma adapter для Neon имеет ограничения; raw SQL гибче и быстрее для сложных запросов
- **Компромисс**: Потеря type-safety, дублирование genId(), риск SQL injection

### JWT вместо DB-сессий
- **Причина**: Serverless-окружение Vercel — нет постоянных соединений
- **Компромисс**: JWT обновляется из БД на каждый запрос (дополнительный SELECT)

### Feature flags в БД
- **Причина**: Включать/выключать эффекты без редеплоя
- **Реализация**: `app_settings` таблица, `/api/settings` с revalidation 30s, `useAppSettings` context

### Standalone output
- **Причина**: Оптимизация размера bundle для Vercel serverless
- **Компромисс**: Некоторые middleware-паттерны не работают

### NextAuth v4 вместо v5
- **Причина**: v5 нестабилен на момент старта; v4 документирован
- **Компромисс**: Устаревший API, нет Auth.js 5 фич

### Русский язык UI
- **Причина**: Целевая аудитория — 1C-разработчики в РФ
- **Компромисс**: Нет i18n, хардкод строк

---

## 8. Limitations / Tech Debt

### Костыли
1. **Runtime ALTER TABLE** — `ensureColumns()` выполняется при каждом admin-запросе к юзерам
2. **Vercel Toolbar killer** — скрипт в layout.tsx + cookie в middleware вместо настройки проекта
3. **Hardcoded admin credentials** — `admin/admin123` в исходном коде
4. **Marathon читерство** — correctAnswer на клиенте
5. **`ignoreBuildErrors: true`** — TypeScript ошибки не блокируют деплой

### Ограничения архитектуры
1. **Нет миграций** — Prisma schema не синхронизирована с реальной БД
2. **Нет валидации входных данных** — admin routes без Zod-схем
3. **Нет тестов** — 0 тестовых файлов
4. **Нет error boundaries** — любой рантайм краш рендерит белый экран
5. **Мёртвый код** — `src/components/ui/achievement-card.tsx` (старый), неиспользуемые зависимости
6. **Нет rate limiting** — API endpoints без защиты от спама
7. **Нет CSRF защиты** — кроме NextAuth built-in

### Временные решения
1. Feature flags через БД вместо env vars
2. Demo-вход без пароля (создаёт демо-юзера)
3. `noImplicitAny: false` в tsconfig
4. Дублирование сид-данных в двух файлах

---

## 9. Next Steps

### Безопасность (P0)
- [ ] Вынести admin credentials в env vars
- [ ] Добавить Zod-валидацию на admin routes
- [ ] Whitelist SQL-колонок в challenges PUT
- [ ] Серверная валидация marathon (не отправлять correctAnswer)

### Архитектура (P1)
- [ ] Синхронизировать Prisma schema с реальной БД
- [ ] Создать нормальные миграции (заменить runtime ALTER TABLE)
- [ ] Расширить NextAuth типы (убрать `as Record<string, unknown>`)
- [ ] Вынести genId() и реферальную логику в shared модули
- [ ] Исправить `DELETE FROM attempts` → `challenge_attempts`
- [ ] Консолидировать сид-данные (один источник)

### Качество (P2)
- [ ] Убрать `ignoreBuildErrors: true`
- [ ] Добавить React error boundaries
- [ ] Удалить мёртвые зависимости (next-intl, @mdxeditor/editor, sharp)
- [ ] Синхронизировать версию (0.3.0 → актуальная)
- [ ] Обновить .env.example
- [ ] Добавить хотя бы smoke-тесты

### Фичи (P3)
- [ ] Activity chart: исправить верхнюю границу
- [ ] UI-индикация адаптивной сложности
- [ ] Интеграция z-ai-web-dev-sdk в playground
- [ ] Уведомления о новом daily challenge
- [ ] Больше задач (200+)

---

## 10. Quick Context for AI

### Как писать код в этом проекте

1. **Язык**: TypeScript строго, React функциональные компоненты, `"use client"` для интерактивных
2. **Стили**: Tailwind CSS 4 + `cn()` из `src/lib/utils.ts` для условных классов
3. **UI-компоненты**: shadcn/ui из `src/components/ui/` — не писать свои кнопки/инпуты
4. **API**: Next.js App Router API routes в `src/app/api/`
5. **БД**: Raw SQL через `pool.query()` из `src/lib/db.ts` для новых запросов; Prisma `db.*` только для простых CRUD
6. **ID**: `genId()` → `cuid()` — НЕ использовать UUID, всегда cuid
7. **Стейт**: Zustand (`useUserStore`) для глобального; `useState` для локального
8. **Анимации**: Framer Motion для page transitions; CSS animations для микро-анимаций (не Framer!)
9. **Мобильные**: Использовать `useIsMobile()` из `src/hooks/use-mobile.ts`; ≤6 анимированных элементов на мобильных

### Принципы
- **Dark-first**: Весь UI сначала для тёмной темы, потом light
- **Glass morphism**: `className="glass"` для карточек (определено в globals.css)
- **Русский язык**: Все строки UI на русском; имена переменных/комментариев на английском
- **Serverless-friendly**: Нет глобального состояния между запросами; БД-соединения через пул
- **Performance**: Ленивые импорты для тяжёлых компонентов (canvas-confetti, html-to-image)

### Стиль
- Компоненты: функциональные, named exports (не default)
- Файлы: kebab-case (`xp-bar.tsx`, `achievement-icons.tsx`)
- Интерфейсы: в начале файла, не в отдельном файле
- API routes: inline типы, не отдельные schemas (пока нет Zod)
- CSS: Tailwind utility-классы, кастомные через `globals.css` с CSS variables

### Ограничения
- НЕ использовать Prisma migrations — только `prisma db push` + runtime ALTER TABLE
- НЕ добавлять Framer Motion на мобильных компонентах (только CSS)
- НЕ отправлять correctAnswer на клиент в новых режимах
- НЕ использовать localStorage для критичных данных (только кэш/таймер)
- НЕ делать серверные компоненты интерактивными (всегда `"use client"` если есть хуки)
- Новые колонки БД → сначала ALTER TABLE в migrate route, потом обновить Prisma schema
- Новые API → проверка admin через `getServerSession()`, не через middleware
