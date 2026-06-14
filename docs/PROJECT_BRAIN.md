# PROJECT_BRAIN

> Срез проекта на 2026-06-14 (обновлено до v0.26.0 — YouTube Error 153 фикс, ASR транскрибация вместо галлюцинации, упрощённый video-embed). Для нового разработчика или AI — понять проект за 3-5 минут без чтения всего кода.
>
> **Расположение**: `/docs/PROJECT_BRAIN.md` в корне проекта (Git-репозиторий). Этот файл — единый источник правды о проекте, ведётся с самой первой сессии разработки.

---

## 1. Project Overview

- **Что это**: AI Тренажёр для 1C-разработчиков — Duolingo-style геймифицированная платформа обучения навыкам работы с ИИ
- **Задача**: Научить 1C-разработчиков промпт-инжинирингу, работе с AI-агентами, дебаггингу через решение задач
- **Домен**: obuch-ai.vercel.app
- **Репозиторий**: github.com/Antisakrum2004/obuchAI (синхронизирован с workspace)
- **Стек**:
  - Frontend: Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + shadcn/ui
  - Backend: Next.js API Routes (serverless)
  - БД: Neon PostgreSQL (serverless) через Prisma 7 + raw SQL
  - Аутентификация: NextAuth.js v4 (JWT strategy)
  - Стейт: Zustand 5 (клиент)
  - Анимации: Framer Motion 12 + canvas-confetti
  - Деплой: Vercel (standalone output)

### Версии окружений

| Окружение | URL | Статус | Что запущено |
|---|---|---|---|
| **obuch-ai** (production) | obuch-ai.vercel.app | READY | Полный проект из workspace, привязан к GitHub (obuchAI) |
| **obuch-project-rggt** | obuch-project-rggt.vercel.app | READY | Реструктурированная версия из GitHub repo |
| **GitHub repo** | Antisakrum2004/obuchAI | main | Рабочий код (синхронизирован с workspace) |
| **Старый repo** | Antisakrum2004/obuch-project | main | Устаревшая реструктурированная версия |

> ✅ **Синхронизация**: obuch-ai.vercel.app привязан к GitHub repo Antisakrum2004/obuchAI. Код из workspace деплоится через `vercel deploy --prod` (пока нет auto-deploy через webhook).

### Env vars на Vercel (obuch-ai)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL pooled connection |
| `DATABASE_URL_UNPOOLED` | Прямое подключение (для миграций) |
| `POSTGRES_*` | Набор переменных Neon (host, user, password, database) |
| `NEON_PROJECT_ID` | ID проекта Neon |
| `NEXTAUTH_URL` | URL для NextAuth callbacks |
| `NEXTAUTH_SECRET` | Секрет для подписи JWT |
| `GOOGLE_CLIENT_ID` | Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `VERCEL_TOOLBAR_DISABLED` | Отключение Vercel Toolbar |
| `NEXT_PUBLIC_VERCEL_*` | Клиентские флаги для тулбара |
| `BLOB_STORE_ID` | ID Blob Store: store_5OkTkSLciotjEC41 (авто-устанавливается Vercel) |
| `BLOB_WEBHOOK_PUBLIC_KEY` | Публичный ключ для Blob Store webhook'ов |
| `STORAGE_PROVIDER` | Провайдер файлового хранилища: **"s3"** (Selectel) / "vercel-blob" / "minio" |
| `S3_ACCESS_KEY_ID` | Selectel S3 access key |
| `S3_SECRET_ACCESS_KEY` | Selectel S3 secret key |
| `S3_ENDPOINT` | `https://s3.ru-7.storage.selcloud.ru` |
| `S3_REGION` | `ru-7` |
| `S3_BUCKET_NAME` | `ati-lab` (приватный бакет) |
| `ZAI_BASE_URL` | Z-AI SDK API base URL |
| `ZAI_API_KEY` | Z-AI SDK API key |
| `OPENROUTER_API_KEY` | OpenRouter/OpenAI API key (AI content processing) |

> ⚠️ **КРИТИЧЕСКИ ВАЖНО**: S3 бакет `ati-lab` используется **ТОЛЬКО для статических документов** (PDF, PPTX, DOCX, изображения). **ВИДЕО НЕ ХРАНИТСЯ НА S3** — эта архитектура действует с Sprint 7 (v0.9.0) и окончательно закреплена. Видео размещается **ИСКЛЮЧИТЕЛЬНО** через внешние облачные встраивания (YouTube, VK, Rutube, Яндекс Диск). S3 Signed URL роуты для видео удалены. Проксирование видео через Vercel полностью ликвидировано.

---

## 2. Architecture

### Общая схема

```
┌─────────────────────────────────────────────────────┐
│  Vercel Serverless Functions                        │
│                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Next.js   │  │ API Routes   │  │ Auth         │ │
│  │ Pages     │──│ /api/*       │──│ NextAuth v4  │ │
│  │ (SSR/CSR) │  │ (55+ routes) │  │ JWT + OAuth  │ │
│  └───────────┘  └──────┬───────┘  └──────────────┘ │
│                        │                             │
│          ┌─────────────┼───────────────┐             │
│          │  Raw SQL    │  Prisma ORM   │             │
│          │  (85% reqs) │  (15% reqs)   │             │
│          │  pool.query │  db.*.create  │             │
│          └─────────────┼───────────────┘             │
│                        │                             │
│              ┌─────────▼─────────┐                   │
│              │ Neon PostgreSQL   │                   │
│              │ (Serverless Pool) │                   │
│              └───────────────────┘                   │
└─────────────────────────────────────────────────────┘
```

### Структура файлов (workspace)

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout (ThemeProvider, SessionProvider/Providers, Particles, Toaster)
│   ├── globals.css               # CSS variables, glass, dark/light themes
│   ├── login/page.tsx            # Страница входа
│   ├── dashboard/page.tsx        # Дашборд пользователя
│   ├── challenges/               # Задачи (список + [id])
│   ├── marathon/page.tsx         # Марафон (15 задач подряд)
│   ├── achievements/page.tsx     # Страница ачивок
│   ├── skills/page.tsx           # Дерево навыков (скрыто из навигации)
│   ├── leaderboard/page.tsx      # Таблица лидеров
│   ├── profile/[id]/page.tsx     # Публичный профиль
│   ├── about/page.tsx            # О проекте
│   ├── playground/page.tsx       # AI Playground (скрыто из навигации)
│   ├── admin/                    # Админ-панель
│   │   ├── page.tsx              # Dashboard админа
│   │   └── login/page.tsx        # Логин для админа
│   └── api/                      # 55+ API маршрутов
│       ├── auth/[...nextauth]/   # NextAuth endpoints
│       ├── challenges/           # GET list, GET [id], POST submit
│       ├── marathon/             # GET start, POST complete
│       ├── achievements/         # GET achievements + user progress
│       ├── skills/               # GET skill tree
│       ├── daily/                # GET daily challenge
│       ├── leaderboard/          # GET rankings
│       ├── referral/             # GET/POST referral codes
│       ├── settings/             # GET public feature flags
│       ├── user/                 # GET stats, activity, profile
│       ├── dashboard/            # GET dashboard data
│       ├── knowledge/            # Knowledge Hub API
│       │   ├── quiz/submit/      # POST — отправка результатов квиза, XP начисление
│       │   ├── spaces/[id]/path/ # GET — learning path (топологическая сортировка)
│       │   ├── ai/               # POST — AI-обработка (content/metadata/glossary/graph/course)
│       │   ├── ai/video-article/ # POST — YouTube→AI статья пайплайн (v0.23.0)
│       │   ├── video/transcript/ # POST — извлечение субтитров из YouTube через Z-AI SDK (v0.23.0)
│       │   ├── bulk-upload/      # POST — массовая загрузка файлов
│       │   └── ...               # Остальные knowledge-роуты
│       └── admin/                # CRUD challenges, skills, achievements, users, seed, settings, migrate
├── components/                   # 97+ компонентов
│   ├── challenges/               # Challenge card, result, multiple-choice, ordering
│   ├── dashboard/                # Stats grid, weekly chart, daily widget, mini leaderboard
│   ├── gamification/             # XP bar (с grade name), streak, hearts, achievements, avatar frame, level badge
│   ├── layout/                   # AppLayout, sidebar, header, mobile tab bar
│   ├── effects/                  # Particles background
│   ├── profile/                  # Share card, referral card
│   ├── skills/                   # Skill tree
│   ├── knowledge/                # QuizBlock, VideoEmbed, UrlImportForm, ZipUpload, ProcessingQueue, GlossaryCommand, CreateArticleDialog
│   ├── theme-provider.tsx        # next-themes wrapper
│   ├── theme-toggle.tsx          # Dark/light switch
│   ├── vercel-toolbar-hider.tsx  # Хак для скрытия Vercel Toolbar
│   └── ui/                       # 44 shadcn/ui компонента
├── hooks/                        # 5 хуков
│   ├── use-app-settings.tsx      # Feature flags context (from /api/settings)
│   ├── use-daily-challenge.ts    # Daily challenge logic
│   ├── use-mobile.ts             # Mobile detection
│   ├── use-user-stats.ts         # User stats fetching
│   └── use-toast.ts              # Toast notifications
├── lib/                          # 6 модулей
│   ├── auth.ts                   # NextAuth config (Google + demo + admin)
│   ├── db.ts                     # Dual DB access: pool (raw SQL) + db (Prisma)
│   ├── gamification.ts           # XP/level math, multipliers, labels, grades, quiz XP
│   ├── challenge-cache.ts        # Client-side challenge caching
│   ├── ai-provider.ts            # AI SDK обёртка (OpenRouter)
│   ├── gen-id.ts                 # Общий модуль генерации ID
│   ├── storage/                  # StorageProvider абстракция + S3 реализация
│   ├── media-service.ts          # Бизнес-логика загрузки/удаления медиа
│   ├── media-utils.ts            # Клиентские утилиты (валидация, иконки)
│   └── utils.ts                  # cn() helper
├── store/
│   └── user-store.ts             # Zustand store (id, name, xp, level, streak, rank, completedChallenges)
└── middleware.ts                  # Auth guard for /admin, Vercel Toolbar cookie
```

### Ключевые зависимости

| Зависимость | Версия | Роль |
|---|---|---|
| next | ^16.1.1 | Фреймворк (App Router) |
| react | ^19.0.0 | UI библиотека |
| next-auth | ^4.24.11 | Аутентификация (JWT strategy) |
| @prisma/client | ^7.8.0 | ORM (частичное использование) |
| @prisma/adapter-neon | ^7.8.0 | Prisma adapter для Neon |
| @neondatabase/serverless | ^1.1.0 | Драйвер БД (WebSocket + HTTP) |
| zustand | ^5.0.6 | Клиентский стейт |
| framer-motion | ^12.23.2 | Анимации (page transitions, modals) |
| recharts | ^2.15.4 | Графики (weekly XP chart, leaderboard) |
| @dnd-kit/core | ^6.3.1 | Drag-and-drop (ordering challenges) |
| canvas-confetti | ^1.9.4 | Конфетти при правильном ответе |
| html-to-image | ^1.11.13 | Генерация share-карточки (PNG) |
| z-ai-web-dev-sdk | ^0.0.17 | AI SDK (интегрирован в Sprint 6: metadata/glossary/graph processing + v0.23.0 YouTube subtitle extraction) |
| next-themes | ^0.4.6 | Dark/light переключатель |
| sonner | ^2.0.6 | Toast уведомления |
| ws | ^8.20.1 | WebSocket (для Neon pool в dev) |
| date-fns | ^4.1.0 | Работа с датами (streak, daily) |
| react-markdown | ^10.1.0 | Рендеринг Markdown в задачах |
| react-syntax-highlighter | ^15.6.1 | Подсветка кода в задачах |
| @aws-sdk/client-s3 | ^3.1064.0 | S3-клиент для Selectel Object Storage (ТОЛЬКО документы/изображения) |
| @aws-sdk/s3-request-presigner | ^3.1064.0 | Генерация Signed URLs для приватного доступа к документам |
| @vercel/blob | ^2.4.0 | Файловое хранилище (legacy, заменено на Selectel S3) |
| pdf-parse | — | Извлечение текста из PDF (content extraction pipeline) |

### Мёртвые зависимости (установлены, не используются в src/)

| Зависимость | Вес | Почему |
|---|---|---|
| next-intl | ^4.3.4 | Планировалась i18n, не реализована |
| @mdxeditor/editor | ^3.39.1 | Планировался rich text editor, не нужен |
| sharp | ^0.34.3 | Обработка изображений, не используется |
| playwright | ^1.60.0 | E2E тесты, 0 тестовых файлов |

### Как идут данные

1. **Вход**: Пользователь → `/login` → Google OAuth / Demo / Admin → NextAuth JWT → редирект на `/dashboard`
2. **Профиль**: Страница загружается → Zustand store (клиент) → `/api/me` или `/api/dashboard` → raw SQL → Neon
3. **Решение задачи**: POST `/api/challenges/[id]/submit` → валидация ответа → UPDATE users (xp, streak, level) → INSERT challenge_attempt → проверка achievements → ответ клиенту → Zustand update → confetti/animation
4. **JWT refresh**: Каждый запрос → jwt callback → `SELECT role, xp, level, streak FROM users WHERE id=$1` → JWT обновляется свежими данными
5. **Feature flags**: `/api/settings` (revalidate 30s) → `useAppSettings` React context → все компоненты читают флаги
6. **Реферал**: Cookie `ref` → при регистрации → XP бонус обоим → `xp_logs` запись
7. **Квиз**: QuizBlock (клиент) → single-question режим с таймером 30с → POST `/api/knowledge/quiz/submit` → валидация → `xpForQuiz()` расчёт XP → UPDATE users (xp, level) → INSERT xp_logs → Zustand update
8. **YouTube→AI статья (v0.23.0)**: Вставка YouTube ссылки → CreateArticleDialog (вкладка «Из видео») → POST `/api/knowledge/ai/video-article/` → Z-AI SDK извлекает субтитры через `/api/knowledge/video/transcript/` → AI генерирует статью/глоссарий/квиз/практику → статья сохраняется и публикуется

---

## 3. Core Modules

### 3.1 Auth (`src/lib/auth.ts` — 419 строк)
- **Провайдеры**: Google OAuth (условный — включается если GOOGLE_CLIENT_ID настроен), Demo login (email), Admin login (username/password)
- **Стратегия**: JWT, maxAge 30 дней, httpOnly cookies
- **Колбеки**: `signIn` (find-or-create user + referral processing), `jwt` (refresh from DB on every request), `session` (inject custom fields), `redirect` (prevent loops)
- **Проблема**: Admin credentials захардкожены (`admin/admin123`), 8 `as unknown as Record` кастов

### 3.2 Database (`src/lib/db.ts` — 75 строк)
- **Dual access**: `pool` (raw SQL через `@neondatabase/serverless`, 85% запросов) + `db` (PrismaClient через `PrismaNeon` adapter, admin/auth routes)
- **Hot-reload protection**: Глобальные синглтоны через `globalThis` (не пересоздаётся при HMR)
- **WebSocket fallback**: `ws` пакет для локальной разработки (Neon требует WebSocket в Node.js) — вынесен на уровень модуля (v0.13.0)
- **Connection pooling** (v0.13.0): `connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 30000`, `max: 10`, `ssl: { rejectUnauthorized: false }`
- **Shared pool** (v0.13.0): Prisma adapter переиспользует тот же глобальный пул (раньше создавался второй пул на каждый холодный старт)
- **Проблема**: Pool/PrismaNeon type incompatibility — `as unknown as PoolConfig` каст
- **✅ Neon pool timeout — РЕШЕНО**: Connection pooling улучшен в v0.13.0 (shared pool + таймауты), проблемы с timeout устранены

### 3.3 Gamification (`src/lib/gamification.ts` — 182 строки)
- **XP формулы**: `xpForLevel(n) = 100 * n^1.5` (экспоненциальный рост)
- **Множители**: Time-based (100% → 10% за 30с блоки), No-hearts penalty (50% XP)
- **Streak бонусы**: 7 дней → +200 XP, 30 дней → +1000 XP
- **48h правило**: Streak ломается если нет активности >48 часов
- **Категории**: prompting, agents, tools, automation, 1c, debugging, workflow, review
- **Сложности**: easy (25 XP), medium (50 XP), hard (100 XP)

### 3.3.1 Grade System (v0.17.0) — `getGradeName()`, `getGradeColor()` в `src/lib/gamification.ts`
- **Механика**: Пользователи получают текстовый ранг (grade) в зависимости от уровня
- **Таблица рангов**:

| Уровень | Ранг (grade) | Цвет | CSS-класс |
|---|---|---|---|
| 1–4 | Начинающий | Изумрудный | `text-emerald-400` |
| 5–9 | Специалист | Синий | `text-blue-400` |
| 10–14 | Мастер | Фиолетовый | `text-purple-400` |
| 15–19 | Про | Янтарный | `text-amber-400` |
| 20–24 | Звезда | Жёлтый | `text-yellow-400` |
| 25+ | Легенда | Розовый | `text-rose-400` |

- **Функции**: `getGradeName(level)` → строка с названием ранга, `getGradeColor(level)` → CSS-класс цвета
- **Отображение**: XPBar компонент показывает `{level} {gradeName}` — цифра уровня + текстовый ранг рядом (шрифт `text-[10px]`, цвет `text-muted-foreground`)

### 3.3.2 Quiz Gamification (v0.17.0) — `xpForQuiz()`, `QUIZ_TIME_PER_QUESTION` в `src/lib/gamification.ts`
- **Таймер**: 30 секунд на вопрос (константа `QUIZ_TIME_PER_QUESTION = 30`), цветовая индикация: зелёный (>20с), янтарный (>10с), красный (≤10с)
- **Режим отображения**: Single-question — один вопрос за раз (не все сразу), с анимированными переходами между вопросами
- **Автопереход**: При истечении таймера вопрос помечается как без ответа, автоматически переход к следующему; на последнем — автопроверка
- **XP за квиз**: `xpForQuiz(correctCount, totalCount, difficulty)` — easy=5/medium=10/hard=15 XP за каждый правильный ответ, +50% бонус за идеальный результат (все правильные)
- **Без сердечек**: Квизы НЕ используют hearts — неправильные ответы просто не приносят XP
- **API**: POST `/api/knowledge/quiz/submit` — валидация (статья существует + есть квиз), расчёт XP, UPDATE users (xp, level, lastActiveAt), INSERT xp_logs (reason='quiz'), возврат { success, xpEarned, totalXp, newLevel, grade }
- **Навигация**: Кнопка «Следующий вопрос» / «Проверить ответы» (на последнем), точечная навигация для прыжка между вопросами
- **Violet кнопки (v0.17.3)**: Кнопки «Следующий вопрос» и «Проверить ответы» используют мягкий пастельный фиолетовый `bg-violet-400/50 hover:bg-violet-400/70` вместо ядовитого `bg-purple-600`

### 3.4 User Store (`src/store/user-store.ts` — 50 строк)
- **Zustand 5**: id, name, email, image, role, xp, level, streak, maxStreak, completedChallenges, rank, isLoading
- **Методы**: setUser, addXp, setLevel, setStreak, setLoading, reset
- **Связи**: Dashboard, header (XP bar), profile, challenge result — все читают из стора
- **v0.17.0**: После прохождения квиза — `addXp` и `setLevel` вызываются с данными из `/api/knowledge/quiz/submit` response

### 3.5 Challenge System
- **Страницы**: `/challenges` (список с фильтрацией), `/challenges/[id]` (решение)
- **API**: GET список, GET по ID, POST submit
- **Типы задач**: multiple_choice, ordering, workflow_build
- **Валидация**: Статическая (сравнение с correctAnswer), нет AI-оценки свободных ответов
- **Cooldown**: Задержка повторного решения одной задачи
- **Контент**: 100 задач в 7 категориях, описание + опции + объяснение + подсказки (JSON)

### 3.6 Marathon Mode (`src/app/marathon/`, `src/app/api/marathon/`)
- **Механика**: 15 последовательных задач без перерыва, streak множитель
- **Валидация**: На клиенте (correctAnswer приходит в response) — работает, но уязвимо к читерству
- **Завершение**: POST `/api/marathon/complete` → итоговый XP расчёт

### 3.7 Admin Panel (`src/app/admin/`, `src/app/api/admin/`)
- **Защита**: Middleware проверяет JWT role="admin" для всех `/admin/*` кроме `/admin/login`
- **CRUD**: Challenges (создание/редактирование/удаление), Skills, Achievements, Users
- **Управление юзерами**: Изменение role, XP, hearts, streak; бан/разбан
- **Сидирование**: `/api/admin/seed` — загрузка 100 задач + 7 навыков + 16+ ачивок
- **Фича-флаги**: `/api/admin/settings` — вкл/выкл particles, confetti, effects
- **Миграции**: `/api/admin/migrate` — runtime ALTER TABLE через ensureColumns()
- **Проблема**: Нет Zod-валидации на входных данных, SQL injection в challenges PUT

### 3.8 Achievement System (`src/components/gamification/achievement-*.tsx`, `src/app/achievements/`)
- **20 SVG-иконок**: Кастомные silhouette-иконки (не эмоджи)
- **16+ ачивок**: Категории — streak, challenges, skills, special
- **Rarity tiers**: Common, Uncommon, Rare, Epic, Legendary
- **Автопроверка**: При правильном ответе → проверка всех условий → модал разблокировки
- **Avatar frames**: CSS box-shadow glow по tier, dragon frame для admin

### 3.9 Layout & Navigation (`src/components/layout/`)
- **AppLayout**: Обёртка для страниц (sidebar + header + content). **БЕЗ SessionProvider** — он теперь в корневом layout через `Providers` (см. ниже)
- **Providers** (`src/components/providers.tsx`): `"use client"` обёртка для `SessionProvider` из next-auth. Находится в корневом `layout.tsx`, чтобы `useSession()` работал на всех страницах без крашей
- **Sidebar**: Десктоп — навигация слева (dashboard, challenges, marathon, materials, knowledge, achievements, leaderboard, about, admin). Навыки и Песочница скрыты.
- **Header**: XP bar (с grade name), streak counter, hearts display, avatar с frame, theme toggle
- **Mobile tab bar**: Нижняя навигация на мобильных
- **ParticlesBackground**: Фоновый эффект (6 частиц на мобильных, 18 на десктопе)

### 3.10 Effects & Themes
- **ThemeProvider**: next-themes, dark-first дизайн
- **Particles**: Canvas-based, адаптивные (6 мобильных / 18 десктоп)
- **Confetti**: canvas-confetti при правильном ответе, ленивый импорт
- **Feature flags**: particles, confetti, effects — управляются из admin → `/api/settings`

### 3.11 Profile & Social (`src/app/profile/[id]/`, `src/components/profile/`)
- **Публичный профиль**: Данные юзера + achievements + skills + stats
- **Share-карточка**: html-to-image → PNG, скачивание/поделиться
- **Реферальная система**: Уникальный код → XP бонус +50 обоим (демо/Google)
- **Реферальная логика**: Дублируется 3 раза (demo auth, Google auth, referral API)

### 3.12 Middleware (`src/middleware.ts`)
- **Admin guard**: Проверка `token.role === "admin"` для `/admin/*`
- **Vercel Toolbar killer**: Cookie `vercel-toolbar=0` + `vercel-toolbar-hide=1` на все маршруты
- **Matcher**: admin routes + все страницы (кроме API/static)

### 3.13 Knowledge Hub (`src/app/knowledge/`, `src/app/api/knowledge/`)
- **Сущности**: KnowledgeSpace → Category → Article → Media, GlossaryTerm
- **KnowledgeSpace**: Пространства знаний (AI Разработка, Промпт-инжиниринг, 1С и AI, Инструменты)
- **Category**: Иерархические категории внутри пространств (Cursor, Claude Code, MCP, OpenAI)
- **Article**: Markdown-статьи с summary, tags, keyTopics, viewCount + Sprint 6: difficulty, prerequisites, nextTopics, keyConcepts, estimatedTime, status, aiGenerated, videoUrl, pdfUrl, pptxUrl, sourceUrl, sourceType
- **Media**: Документы/изображения, привязанные к статьям (Selectel S3 → StorageProvider, приватный бакет). **Видео НЕ загружается на S3** — только через внешние ссылки
- **GlossaryTerm**: Термины с определениями, категориями, связанными терминами + Sprint 6: aiGenerated
- **ProcessingQueue**: Очередь AI-обработки (zip_import, ai_metadata, glossary_extract, graph_build, course_draft) с прогрессом и статусами
- **API**: 22+ маршрута (CRUD spaces, categories, articles, glossary, search, seed, media, ZIP import, AI processing, processing queue, quiz submit, learning path)
- **Admin CRUD**: Вкладка «Знания» в /admin — полный CRUD для пространств, категорий, статей, глоссария
- **Markdown Editor**: Создание/редактирование статей с превью в admin
- **Publish/Draft**: Переключатель isPublished для пространств и статей
- **UI**: /knowledge (пространства), /knowledge/[slug] (категории+статьи), /knowledge/article/[id] (статья + медиа), /knowledge/course-map (карта курса — v0.23.0)

### 3.14 AI-Глоссарий (`src/components/knowledge/glossary-command.tsx`, `glossary-trigger.tsx`)
- **Cmd+K / Ctrl+K / Ctrl+Л**: Глобальный поиск по терминам из любого места приложения (русская раскладка поддерживается)
- **Inline Search**: Строка поиска по глоссарию прямо на странице База знаний
- **Floating ? button**: Кнопка в правом нижнем углу (позиционирована над mobile tab bar)
- **Command Dialog**: Fuzzy-поиск по glossary_terms, кликабельные related terms
- **Категории**: AI, Tools, 1C, General — цветные badge
- **10 предзагруженных терминов**: LLM, Промпт, MCP, RAG, Context Window, Tool Calling, AI Агент, Токен, Fine-tuning, Embedding

### 3.15 Quiz System (v0.17.0) — `QuizBlock` в learn-странице + API
- **QuizBlock**: Компонент в `/knowledge/[spaceId]/learn/[articleId]/page.tsx` — интерактивный квиз к уроку
- **Режим**: Single-question — показывается один вопрос за раз с навигацией (точки + кнопки «Следующий» / «Проверить»)
- **Таймер**: 30с обратный отсчёт с прогресс-баром (цветовая индикация), автопереход при истечении
- **XP расчёт**: `xpForQuiz()` — по сложности (easy=5/medium=10/hard=15 за правильный ответ, +50% за идеальный результат)
- **Нет сердечек**: Неправильные ответы не влияют на hearts — просто не дают XP
- **API submit**: POST `/api/knowledge/quiz/submit` — серверная валидация, XP начисление, запись в xp_logs
- **Обновление стора**: После submit — Zustand store обновляется XP и level из ответа API
- **Отображение XP**: После проверки — `+{xpEarned} XP за квиз!`

### 3.16 Storage & Media (`src/lib/storage/`, `src/lib/media-service.ts`, `src/lib/media-utils.ts`)
- **StorageProvider**: Интерфейс (upload, delete, getUrl) — абстракция над файловым хранилищем
- **S3StorageProvider**: Реализация через @aws-sdk/client-s3 → **Selectel Object Storage** (используется **ТОЛЬКО для PDF/документов/изображений**)
- **VercelBlobStorageProvider**: Реализация через @vercel/blob (MVP, более не используется)
- **MediaService**: Бизнес-логика загрузки/удаления/привязки файлов, не знает про конкретное хранилище
- **media-utils.ts**: Клиентские утилиты (formatFileSize, getFileIcon, validateFile, detectFileType, generateStorageKey, ALLOWED_FILE_TYPES) — БЕЗ серверных импортов
- **Поддерживаемые типы**: PDF (100 МБ), PPTX (200 МБ), DOCX (100 МБ), изображения (20 МБ). **ВИДЕО — только через внешние облачные ссылки**
- **Формат ключей**: knowledge/{entityType}s/{entityId}/{timestamp}_{filename}
- **API**: POST /api/knowledge/media/upload, GET /api/knowledge/media, GET/DELETE /api/knowledge/media/[id]
- **Видео через облачные ссылки**: Видео **НЕ загружается на S3** (с Sprint 7). Админ указывает `videoUrl` (YouTube, Rutube, Яндекс Диск, VK) через UrlImportForm. Плеер VideoEmbed автоматически определяет тип ссылки и рендерит соответствующий iframe или кнопку «Смотреть видеоурок в облаке».
- **S3 Signed URL роуты для видео УДАЛЕНЫ**: `/api/knowledge/video/[id]` и `/api/knowledge/video/by-article/[articleId]` удалены в Sprint 7. Больше нет проксирования через Vercel.
- **UI**: MediaUpload (drag&drop + прогресс), MediaViewer (документы, изображения + лайтбокс + видео-модалка), VideoEmbed (YouTube/Rutube/VK/Яндекс Диск/прямая ссылка)
- **Переключение хранилища**: env var STORAGE_PROVIDER → **s3** (активный, Selectel) / vercel-blob / minio (будущие)
- **Blob Store**: Selectel S3 (ati-lab, приватный, region ru-7) — **ТОЛЬКО для документов/изображений**

### 3.17 AI Content Processing Pipeline — Sprint 6+v0.17.0 (`src/app/api/knowledge/ai/`, `src/components/knowledge/`)
- **Видение**: НЕ строить курсы вручную. Загрузить сырые материалы → AI анализирует → глоссарий → граф знаний → курсы появляются автоматически
- **Поток**: Materials → AI Analysis → Glossary → Knowledge Graph → Learning Path → Course
- **Хранилище видео**: **ИСКЛЮЧИТЕЛЬНО внешние облачные ссылки** (YouTube, Rutube, Яндекс Диск, VK) — S3 Selectel для видео НЕ используется с Sprint 7
- **Article расширения**: 18+ колонок (difficulty, prerequisites, nextTopics, keyConcepts, estimatedTime, status, aiGenerated, videoUrl, pdfUrl, pptxUrl, sourceUrl, sourceType, processedAt, errorMessage, quiz, practical_task, timecodes)
- **ProcessingQueue**: Новая таблица для асинхронной обработки (zip_import, ai_metadata, glossary_extract, graph_build, course_draft)
- **API маршруты** (7+ новых):
  - `/api/knowledge/import` — ZIP-импорт (JSZip extraction, auto-create articles)
  - `/api/knowledge/process` — Создание задач обработки
  - `/api/knowledge/process/[id]` — Управление задачей (GET/PUT/DELETE)
  - `/api/knowledge/queue` — Список очереди обработки
  - `/api/knowledge/ai` — AI-обработчик (metadata, glossary, graph, course через z-ai-web-dev-sdk)
  - `/api/knowledge/ai/video-article/` — YouTube→AI статья пайплайн (v0.23.0)
  - `/api/knowledge/video/transcript/` — Извлечение субтитров из YouTube через Z-AI SDK (v0.23.0)
  - `/api/knowledge/quiz/submit` — Отправка результатов квиза (v0.17.0)
  - `/api/knowledge/spaces/[id]/path` — Learning path API (v0.17.0 улучшен)
- **UI компоненты** (6+ новых):
  - `VideoEmbed` — Универсальный видео-плеер (YouTube, Rutube, VK, Яндекс Диск, прямая ссылка)
  - `UrlImportForm` — Форма ввода URL для видео/PDF/PPTX
  - `ZipUpload` — Загрузка ZIP-архива с drag-and-drop
  - `ProcessingQueue` — Отображение очереди обработки с прогрессом
  - Materials Library (`/knowledge/materials`) — Страница библиотеки материалов с фильтрами
  - `QuizBlock` — Интерактивный квиз с таймером, single-question режимом, XP расчётом (v0.17.0)
  - `CreateArticleDialog` — Диалог создания статьи: вкладка «Вручную» + вкладка «Из видео» (v0.23.0)
- **VideoEmbed inline (v0.22.0)**: YouTube видео встроено прямо на страницу урока без модала. Используется `youtube.com/embed/` (не youtube-nocookie.com). Для Edge/Safari — подсказка о возможных проблемах с встраиванием.
- **VideoEmbed**: Универсальный видео-плеер с авто-детектом источника по URL (без S3):
  - **YouTube**: `YouTubePlayer` — 3 стратегии fallback: (1) youtube-nocookie.com (privacy), (2) youtube.com (direct), (3) ссылка-кнопка (8s timeout)
  - **Rutube**: iframe embed `rutube.ru/play/embed/{id}`
  - **VK**: iframe embed
  - **Яндекс Диск**: `YandexDiskPlayer` — iframe → fallback на кнопку «Смотреть видеоурок в облаке»
  - **Direct/Other**: Нативный `<video>` элемент или `CloudLinkButton`
  - **CloudLinkButton**: Красивая кнопка-заглушка «Смотреть видеоурок в облаке» с прямой ссылкой — используется когда iframe невозможно встроить
- **AI Content Processing Pipeline** — ✅ ИСПРАВЛЕНО в v0.15.5: PDF→статья пайплайн не работал на Vercel serverless из-за fire-and-forget (Promise.allSettled без await/waitUntil — функция терминировалась после отправки ответа). Три исправления: (1) waitUntil() от @vercel/functions для server-side, (2) клиентский триггер AI-обработки после загрузки как backup, (3) maxDuration=120 для AI-роута. Добавлена защита от дублирования (skip если очередь уже processing/done).
- **Sidebar**: Добавлен пункт «Материалы» (Archive icon) перед «База знаний»
- **gen-id.ts**: Общий модуль генерации ID — замена дублированию genId() в 5+ файлах

### 3.18 AI Course Pipeline — `processCourseContent()` (v0.17.0 улучшен, v0.17.2 auto-migrate)
- **Очередь**: Тип `course_draft` в ProcessingQueue → генерация quiz + practical_task + timecodes
- **Обязательный минимум quiz**: 5 вопросов (раньше 3-5 опционально). Промпт явно требует 5-10 вопросов. Валидация предупреждает если < 5 вопросов: `console.warn`
- **Обязательный practical_task**: Для каждого урока (раньше опционально). Промпт требует: «ОБЯЗАТЕЛЬНО для каждого урока — НЕ возвращай null»
- **Quiz промпт**: Явно указывает «ОБЯЗАТЕЛЬНО минимум 5 вопросов (лучше 7-10 для объёмных уроков)», «НЕ возвращай пустой массив quiz»
- **Валидация**: `validQuiz.length < 5` → warning в логах (AI может не сгенерировать достаточно — нужна перепроверка)
- **bulk-upload**: При `autoProcess=true` включает `course_draft` в очередь обработки: `["content", "metadata", "glossary", "course"]` → quiz + practice + timecodes генерируются автоматически
- **Контекст курса**: processCourseContent получает sibling-статьи того же пространства для корректного ранжирования и prerequisites
- **Auto-migration (v0.17.2)**: Перед записью quiz/practical_task/timecodes автоматически выполняется `ALTER TABLE articles ADD COLUMN IF NOT EXISTS` для Sprint 7 колонок. Если колонки всё ещё отсутствуют — fallback UPDATE без этих полей.
- **Quiz Submit fallback (v0.17.2)**: `/api/knowledge/quiz/submit` при ошибке 42703 (column not found) автоматически мигрирует Sprint 7 колонки и повторяет запрос.

### 3.19 Course Navigation — Learning Path API (v0.17.0 улучшен)
- **API**: GET `/api/knowledge/spaces/[id]/path` — топологическая сортировка (Kahn's algorithm / BFS)
- **Сортировка по сложности** (v0.17.0): Внутри одного ранга статьи сортируются по difficulty (easy → medium → hard) через `difficultyOrder` mapping `{ easy: 0, medium: 1, hard: 2 }`
- **Результат**: `{ spaceId, path, levels, totalArticles, maxRank }` — каждый article содержит hasQuiz, hasPractice, hasTimecodes, hasVideo, keyConcepts
- **Fallback**: Если Sprint 7 колонки не существуют → fallback-запрос без quiz/practical_task/timecodes

### 3.20 YouTube→AI Article Pipeline (v0.23.0) — `/api/knowledge/ai/video-article/`
- **Поток**: Вставка YouTube ссылки → Z-AI SDK извлекает субтитры → AI генерирует статью/глоссарий/квиз/практику
- **Транскрипт**: POST `/api/knowledge/video/transcript/` — Z-AI SDK web_search для получения субтитров YouTube видео
- **Генерация статьи**: POST `/api/knowledge/ai/video-article/` — AI генерирует: контент статьи, метаданные (difficulty, keyConcepts, estimatedTime), глоссарий (5-10 терминов), квиз (5-10 вопросов), практическое задание
- **CreateArticleDialog «Из видео» вкладка**: Отдельная вкладка для создания статьи из YouTube видео. Ввод URL → предпросмотр → подтверждение → AI-обработка в фоне. Ручной выбор раздела (Select) удалён — AI определяет раздел и сложность автоматически.
- **sourceType**: Видео-статьи получают `sourceType = 'youtube'` / `'rutube'` / `'vk'` / `'yandex_disk'`

### 3.21 Карта курса (v0.23.0) — `/knowledge/course-map`
- **Горизонтальная карта**: Прогресс-бар с точками-уроками, замки для заблокированных уроков
- **Гранулярные статусы**: processing (жёлтый Loader2), error (красный AlertCircle), published (зелёный), видео-бейдж
- **Кнопка «Начать курс»**: На дашборде ведёт на /knowledge/course-map вместо БЗ
- **Навигация**: Клик на урок → переход к изучению (если опубликован). Processing/error — некликабельные

### 3.22 Video Articles Fix (v0.18.0)
- **Проблема**: Видео-статьи создавались как `pending` + `isPublished=false`, хотя контент уже AI-сгенерирован. Фоновая обработка `content_extract` пыталась извлечь PDF для видео, вызывая ошибку.
- **Исправления**: (1) Видео-статьи создаются как `published` сразу. (2) `processContentExtraction` пропускает PDF для youtube/rutube/vk. (3) `ensure-queue-items` проверяет `sourceType` перед добавлением `content_extract`. (4) Фоновые функции обновляют статусы очереди (processing→done/error). (5) Новое действие `fix-video-articles` для исправления уже зависших статей. (6) Карта курса показывает гранулярные статусы.

---

## 4. Current State

### Метрики проекта
- **Версия**: 0.23.0
- **Строк кода**: ~30,000 (src/ только .ts/.tsx)
- **Страниц**: 18
- **API маршрутов**: 55+
- **Компонентов**: 97+
- **Хуков**: 5
- **Моделей Prisma**: 17 (User, Account, Session, VerificationToken, Skill, UserSkill, Challenge, ChallengeAttempt, DailyChallengeAssignment, XPLog, Achievement, UserAchievement, KnowledgeSpace, Category, Article, Media, GlossaryTerm, ProcessingQueue)

### Реализовано и работает стабильно
- Аутентификация (Google OAuth + demo вход + admin вход)
- 100 задач в 7 категориях (prompting, agents, debugging, workflow, 1c, review, tools)
- 3 типа задач: multiple_choice, ordering, workflow_build
- Геймификация: XP (экспоненциальная формула), уровни (1-бесконечность), streak (48h правило), hearts, cooldown
- **Grade System (v0.17.0)**: 6 текстовых рангов по уровню (Начинающий → Специалист → Мастер → Про → Звезда → Легенда), цветовая индикация, отображение в XPBar
- Marathon mode (15 задач подряд, множитель streak)
- Achievement system (16+ ачивок, 20 SVG иконок, rarity tiers, unlock modal)
- ~~Skill tree (7 категорий, иерархия навыков)~~ **Удалён из UI** (2026-06-08)
- Leaderboard (alltime / weekly / monthly)
- Daily challenge (ежедневная задача)
- Admin panel (CRUD задач/навыков/ачивок, управление юзерами, сидирование, фича-флаги + вкладка «Знания» для управления БЗ)
- Реферальная система (коды + XP бонусы)
- Адаптивный дизайн (mobile sidebar/tab bar + desktop)
- Avatar frames (CSS glow по tier, dragon frame для admin)
- Тёмная/светлая тема (dark-first)
- Particle effects + confetti (отключаемые через feature flags)
- Profile page с share-карточкой (PNG генерация)
- Vercel деплой — READY, работает на production
- **Knowledge Hub** — База знаний (4 пространства, 6 категорий, статьи, медиа)
- **AI-Глоссарий** — ⌘K глобальный поиск по терминам (10 предзагруженных терминов)
- **Умный поиск** — /api/knowledge/search — поиск по статьям, глоссарию, задачам
- **Файловое хранилище** — Selectel S3 (ati-lab) через StorageProvider абстракцию (**ТОЛЬКО документы/изображения**; видео — через облачные ссылки)
- **MediaUpload** — Drag&drop загрузка файлов с прогрессом, привязка к статьям
- **MediaViewer** — Документы, изображения + лайтбокс + видео-модалка
- **Видеоплеер через облачные ссылки** — VideoEmbed определяет YouTube/Rutube/VK/Яндекс Диск/прямую ссылку. S3 для видео НЕ используется.
- **Интерактивные поля статей** — quiz (JSONB), practical_task (JSONB), timecodes (JSONB)
- **Inline-редактирование статей** — Админ может редактировать заголовок, описание, теги, контент прямо на странице статьи
- **Удаление статей** — Кнопка «Удалить» с подтверждением (✅ исправлено в v0.15.6: e.preventDefault() + e.stopPropagation())
- **«Опубликовать без AI»** — Быстрая публикация статьи без AI-обработки
- **Бейдж «Видео» на карточках** — Зелёный бейдж на карточках статей если есть videoUrl
- **UrlImportForm с ошибками** — Красная ошибка при неудачном сохранении
- **Quiz Gamification (v0.17.0)** — Таймер 30с/вопрос, single-question режим, автопереход, XP за квиз через API, нет сердечек
- **Quiz Submit API (v0.17.0)** — POST `/api/knowledge/quiz/submit` — серверная валидация, XP начисление, xp_logs
- **Learning Path (v0.17.0)** — Сортировка по сложности внутри ранга (easy → medium → hard)
- **AI Course Pipeline (v0.17.0)** — Обязательные 5+ quiz вопросов и practical_task для каждого урока
- **Auto-migration Sprint 7 (v0.17.2)** — Автоматический `ALTER TABLE ADD COLUMN IF NOT EXISTS` для quiz/practical_task/timecodes колонок. Quiz Submit fallback при ошибке 42703.
- **Violet квиз кнопки (v0.17.3)** — Мягкий пастельный `bg-violet-400/50` вместо ядовитого `bg-purple-600`. «🔄 Пройти заново» кнопка на экране завершения урока.
- **Video Articles Fix (v0.18.0)** — Видео-статьи публикуются сразу, PDF extraction пропускается для youtube/rutube/vk, очередь статусов отслеживается, карта курса показывает гранулярные статусы, кнопка «Исправить видео»
- **VideoEmbed inline (v0.22.0)** — youtube.com/embed/ (НЕ nocookie), видео прямо на странице урока без модала, подсказка для Edge/Safari
- **Карта курса (v0.23.0)** — /knowledge/course-map — горизонтальная карта с прогрессом, точками, замками. Кнопка «Начать курс» ведёт сюда вместо БЗ.
- **YouTube→AI статья (v0.23.0)** — Вставка YouTube ссылки → Z-AI SDK извлекает субтитры → AI генерирует статью, глоссарий, квиз, практику. Вкладка «Из видео» в CreateArticleDialog.
- **AI авто-раздел (v0.23.0)** — Удалён ручной Select выбора раздела из CreateArticleDialog. AI определяет раздел и сложность автоматически.

### Работает частично
- **Activity chart**: Верхняя граница может перекрывать числа при высоких значениях
- **Адаптивная сложность**: Механизм есть, но нет UI-индикации для юзера
- **Marathon**: Валидация на клиенте (correctAnswer в response) — работает, но нечестно
- **Google OAuth**: Условно включён — если env vars не настроены, провайдер не добавляется
- **Quiz валидация**: Если AI сгенерировал < 5 вопросов — warning в логах, но квиз всё равно сохраняется (нужна перепроверка/перегенерация)

### Не реализовано
- **Playground** (`/playground`): Страница скрыта из навигации, доступна по прямой ссылке. z-ai-web-dev-sdk не интегрирован
- **Уведомления** (push/email)
- **Мультиязычность** (только русский, next-intl установлен но не используется)
- **Тесты** (0 тестовых файлов, playwright установлен)
- **Error boundaries** (любой рантайм краш = белый экран)
- **Rate limiting** (API без защиты от спама)
- **HLS-трансляция** (FFMPEG — отложено до VPS/Render Worker)
- **Превью видео** (thumbnailUrl — отложено до FFmpeg)
- **Автоматическая перегенерация квиза** при < 5 вопросов (пока только warning)

### Синхронизация кодовых баз
- **Workspace → Vercel (obuch-ai)**: Деплоится через `vercel deploy --prod`, содержит весь функционал
- **GitHub repo (obuchAI)**: Синхронизирован с workspace, Vercel привязан к GitHub
- **Старый repo (obuch-project)**: Устаревшая реструктурированная версия, не используется

---

## 5. Known Issues & Problems

### Критические (P0)
1. **🟢 СТАТЬИ И ЗАДАЧИ НЕ ОТКРЫВАЛИСЬ ПО КЛИКУ — ИСПРАВЛЕНО в v0.15.4** — Конфликт `[slug]` vs `[spaceId]` + JSON-строки вместо массивов для tags/keyConcepts
2. **🟢 КНОПКА УДАЛЕНИЯ (УРНА) НЕ РАБОТАЛА — ИСПРАВЛЕНО в v0.15.6** — e.preventDefault() + e.stopPropagation() для корзины внутри Link-обёртки
3. **🟢 PDF→СТАТЬЯ ПАЙПЛАЙН НЕ РАБОТАЛ — ИСПРАВЛЕНО в v0.15.5+v0.15.6** — waitUntil + клиентский триггер + content_extract всегда создаётся + error вместо done при отсутствии URL + автозапуск обработки
4. **🟢 NEON POOL TIMEOUT — ИСПРАВЛЕНО в v0.13.0** — Connection pooling улучшен: shared pool, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, max: 10. Проблема с холодными стартами и двойными пулами устранена
5. **🟢 НАВИГАЦИЯ ПО СТАТЬЯМ — ИСПРАВЛЕНО в v0.15.4-v0.15.6** — Ряд багов с навигацией (конфликт динамических сегментов, JSON-строки вместо массивов, корзина внутри Link) полностью устранён
6. **Hardcoded admin-пароль** — `admin/admin123` прямо в `src/lib/auth.ts:143`
7. **SQL injection** — admin challenges PUT/spaces PUT/glossary PUT используют `Object.entries(body)` для формирования SQL-колонок без whitelist
8. **Marathon читерство** — `correctAnswer` отправляется клиенту в `/api/marathon`
9. **Нет валидации входных данных** — admin routes передают `body` напрямую в Prisma/raw SQL

### Значимые (P1)
10. **Schema drift** — Prisma schema не содержит 9+ колонок и 1 таблицу (`app_settings`), добавленных через `ALTER TABLE` в runtime
11. **Runtime ALTER TABLE** — `ensureColumns()` в `admin/users/[id]/route.ts` выполняет ALTER TABLE при каждом запросе
12. **Дублирование данных сидирования** — 100 задач определены и в `prisma/seed.ts`, и в `admin/seed/route.ts` — синхронизация вручную
13. ~~**Дублирование genId()**~~ — **Исправлено в Sprint 6**: создан `/src/lib/gen-id.ts` (shared модуль)
14. **Дублирование реферальной логики** — Генерация кода + XP начисление повторяются 3 раза
15. **Неправильное имя таблицы** — ~~`DELETE FROM attempts` вместо `challenge_attempts`~~ **ИСПРАВЛЕНО** (2026-06-08)
16. **Type-unsafe касты** — 44+ инстансов `as Record<string, unknown>` вместо расширения NextAuth типов
17. **`ignoreBuildErrors: true`** в next.config.ts — TypeScript ошибки не ломают билд
18. **`reactStrictMode: false`** — Отключён строгий режим React
19. **GitHub синхронизирован** — Рабочий код в obuchAI repo, Vercel привязан к GitHub
20. **Quiz < 5 вопросов** — AI может сгенерировать < 5 вопросов, warning в логах, но нет автоматической перегенерации

### Минорные (P2)
21. **Версия не совпадает** — ~~package.json `0.3.0`, sidebar `v2.5.0`~~ **ИСПРАВЛЕНО**: package.json `0.23.0`, sidebar показывает NEXT_PUBLIC_APP_VERSION
22. **Stale .env.example** — Содержит GITHUB_ID/EMAIL_SERVER, которые не используются
23. **Мёртвые зависимости** — next-intl, @mdxeditor/editor, sharp, playwright не используются в src/
24. **Vercel Toolbar hack** — Скрипт+куки для убийства тулбара вместо нормального отключения
25. **Мёртвый компонент** — `src/components/ui/achievement-card.tsx` (старая версия)

---

## 6. Attempts & Failures

### 🔴 СТАТЬИ И ЗАДАЧИ НЕ ОТКРЫВАЛИСЬ ПО КЛИКУ — ✅ ИСПРАВЛЕНО v0.15.1

> **Статус**: ✅ РЕШЕНО — корневая причина найдена и устранена в v0.15.1
> **Корневая причина**: Конфликт имён динамических сегментов в `/knowledge/` — директории `[slug]` и `[spaceId]` находились на одном уровне иерархии, что вызывало ошибку Next.js 16 Turbopack: `Error: You cannot use different slug names for the same dynamic path ('slug' !== 'spaceId')`. Эта ошибка крашила serverless-функцию при SSR ВСЕХ динамических маршрутов, вызывая полный таймаут без ответа (HTTP 000).
> **Исправление**: Переименование `[spaceId]/learn/[articleId]` → `[slug]/learn/[articleId]`, обновление `params: Promise<{ spaceId }>` → `params: Promise<{ slug }>`, `p.spaceId` → `p.slug` в learn-странице.
> **Локальная верификация**: `/challenges/[id]` — 150ms (200), `/knowledge/article/[id]` — 35ms (200). Все динамические маршруты работают.
> **Production верификация**: ⏳ Ожидается деплой на Vercel (нужен ручной `vercel deploy --prod`)

#### Что пробовали (ХРОНОЛОГИЧЕСКИ):

**1. SQL-фиксы в API маршрутах (v0.10.0)**
- Изменён JOIN → LEFT JOIN для knowledge_spaces (статьи без space возвращали 404)
- Кавычки для `ORDER BY "order"` (зарезервированное слово SQL)
- Индивидуальные фиксы для конкретных 404/500 ошибок

**2. Увеличение maxDuration для AI-роутов (v0.12.0)**
- Установлен maxDuration = 120 для /api/knowledge/ai
- Помогло для AI-обработки, но НЕ решило проблему навигации

**3. waitUntil() для fire-and-forget обработки (v0.15.5)**
- Использован waitUntil() из @vercel/functions
- Добавлен клиентский триггер AI-обработки как backup
- Помогло для PDF→статья пайплайна, но НЕ для навигации

**4. Переименование динамических сегментов (v0.15.1) — ✅ РЕШЕНИЕ**
- Конфликт [slug] vs [spaceId] → унифицировано в [slug]
- Все динамические маршруты заработали мгновенно

### Удаление статей — ✅ ИСПРАВЛЕНО v0.15.6

> **Корневая причина**: Карточка статьи обёрнута в <Link>. Клик по корзине вызывал e.stopPropagation() но НЕ e.preventDefault(), из-за чего клик всплывал до Link и происходил переход.
> **Исправление**: Добавлен e.preventDefault() в onClick корзины.

### PDF→Статья пайплайн — ✅ ИСПРАВЛЕНО v0.15.5+v0.15.6

> **4 исправления**: (1) Fire-and-forget → waitUntil. (2) content_extract всегда создаётся для PDF. (3) Ошибка вместо done при отсутствии URL. (4) Автозапуск обработки pending статей.

### Neon Pool Timeout — ✅ ИСПРАВЛЕНО v0.13.0

> **Корневая причина**: Два раздельных connection pool (Prisma adapter создавал свой), отсутствие таймаутов, холодные старты с множественными подключениями.
> **Исправление**: Shared pool (Prisma переиспользует глобальный пул), connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, max: 10, WebSocket fallback вынесен на уровень модуля.

### Кнопка «Завершить урок» не работала при повторном прохождении — ✅ ИСПРАВЛЕНО v0.17.3

> **Корневая причина**: При завершении урока `lessonCompleted = true`, экран «🎉 Урок завершён!» блокировал весь контент. При клике на таб блока состояние `lessonCompleted` не сбрасывалось, поэтому кнопка «Завершить урок» в PracticeBlock вызывала `completeBlock()`, который ставил `lessonCompleted = true` снова, но UI уже был в этом состоянии — ничего не происходило визуально.
> **Исправление**: (1) Клик по табу блока теперь сбрасывает `lessonCompleted = false`, позволяя вернуться к содержимому. (2) Добавлена кнопка «🔄 Пройти заново» на экране завершения — полностью сбрасывает весь прогресс (completedBlocks, quizAnswers, quizChecked, hint/solution/practice state) и возвращает к началу.

### Кнопки квиза — ядовито-фиолетовый цвет — ✅ ИСПРАВЛЕНО v0.17.3

> **Корневая причина**: Кнопки «Следующий вопрос» и «Проверить ответы» использовали `bg-purple-600 hover:bg-purple-500` — насыщенный яркий фиолетовый (#9333ea), который выглядел слишком кричащим в тёмной теме.
> **Исправление**: Заменено на `bg-violet-400/50 hover:bg-violet-400/70` — мягкий пастельный фиолетовый с полупрозрачностью, органично вписывается в midnight-тему. Также смягчены: иконка HelpCircle (`text-purple-400` → `text-violet-300`), точка активного вопроса (`bg-purple-400` → `bg-violet-300/70`).

### Видео-статьи зависали в pending — ✅ ИСПРАВЛЕНО v0.18.0

> **Корневая причина**: (1) Видео-статьи создавались как `pending` + `isPublished=false`, хотя контент уже AI-сгенерирован. Фоновая цепочка `fire-and-forget` не гарантировала завершение на Vercel serverless. (2) При нажатии «Обработать все» система создавала задачу `content_extract` для видео-статей (проверяла только pdfUrl/media, не sourceType), что вызывало ошибку «PDF не загружен в хранилище». (3) Очередь не отслеживала статусы фоновой обработки — задачи оставались `pending` навсегда.
> **Исправления**: (1) Видео-статьи теперь создаются как `published` сразу. (2) `processContentExtraction` пропускает PDF для youtube/rutube/vk. (3) `ensure-queue-items` проверяет `sourceType` перед добавлением `content_extract`. (4) Фоновые функции обновляют статусы очереди (processing→done/error). (5) Новое действие `fix-video-articles` для исправления уже зависших статей. (6) Карта курса показывает гранулярные статусы вместо «AI обрабатывает».

### YouTube Error 153 (iframe не загружался) — ✅ ИСПРАВЛЕНО v0.26.0

> **Симптом**: Консоль выдавала `[YouTubePlayer] Error code: 153` — видео не воспроизводилось в iframe.
> **Корневая причина**: (1) YouTube IFrame API (`new YT.Player()`) пыталась инициализироваться поверх уже загруженного iframe — это вызывало Error 153 (player setup error). (2) `referrerPolicy="no-referrer"` на iframe ломал YouTube-авторизацию — YouTube не видел реферер и считал запрос бот-проверкой. (3) Стратегия `direct → nocookie → link` была неверной: `youtube-nocookie.com` ещё более строгий к встраиванию, чем обычный `youtube.com/embed/`.
> **Исправление**: (1) Убран YouTube IFrame API полностью — весь блок загрузки `youtube.com/iframe_api` + `new YT.Player()` удалён. Простой `<iframe>` работает надёжнее. (2) Убран `referrerPolicy="no-referrer"` — YouTube видит реферер и пропускает без бот-проверки. (3) Стратегия упрощена до `embed → link` (2 шага вместо 3). Убран nocookie fallback. (4) URL упрощён: `youtube.com/embed/{id}?rel=0&modestbranding=1` без JSAPI.
> **Консольные ошибки после фикса**: `ublock-filters.js ERR_BLOCKED_BY_CLIENT` на `/youtubei/v1/log_event` и `/ptracking` — это uBlock Origin блокирует YouTube-аналитику. Это **нормально и ожидаемо**, не влияет на воспроизведение. `[Intervention] Slow network` — Chrome подменяет шрифт при медленной загрузке, тоже нормально.

### Видео→статья: AI галлюцинировал содержание — ✅ ИСПРАВЛЕНО v0.26.0

> **Симптом**: Видео об AI-платформе Antigravity превратилось в статью о гоночной игре. AI полностью выдумывал содержание, не совпадающее с реальным видео.
> **Корневая причина**: Пайплайн `video-article` не делал реальную транскрибацию. Он брал oEmbed заголовок + результаты веб-поиска и просил AI «предположить» содержание. AI по названию "Antigravity" нашёл через поиск гоночную игру и сгенерировал статью о ней вместо AI-платформы Google.
> **Исправление**: (1) Добавлена реальная транскрибация через Z-AI ASR: скачиваем аудио с YouTube через Piped API → отправляем в speech-to-text → получаем реальный транскрипт. (2) 5-уровневый fallback: ASR → YouTube описание из Piped → oEmbed → веб-поиск → AI описание. (3) Промпты переписаны с жёсткими инструкциями: «Строго придерживайся ФАКТИЧЕСКОГО содержания. НЕ придумывай темы. НЕ искажай смысл». (4) Температура снижена с 0.7 до 0.3. (5) Добавлено отслеживание `transcriptSource` — видно откуда взялся контент (asr/piped_description/ai_zai/ai_fallback).
> **Файлы**: `/api/knowledge/ai/video-article/route.ts`, `/api/knowledge/video/transcript/route.ts`.

### Аудит публичных страниц (внешняя проверка) — v0.26.0

> **Критические проблемы (пустая БД)**: (1) Задачи — «Найдено задач: 0» (2) Карта курса — пустая (3) База знаний — полностью пустая (4) Достижения — 0/0 (5) Рейтинг — пустой. Общий диагноз: **БД не засеяна**. Нужно зайти в /admin → Seed.
> **Значимые проблемы**: (6) Dashboard — «Активные задачи: 0» и дорожная карта без данных (следствие пустой БД) (9) /login — почти пустая страница (только `<h2>Поиск по знаниям</h2>`), форма логина не рендерится без JS.
> **Что работает**: Лендинг, навигация (8 пунктов), версия v0.26.0 синхронизирована, марафон, о проекте, Grade, мобильная навигация, Ctrl+K подсказка.
> **Консольные ошибки на странице видео**: Все от YouTube iframe + uBlock Origin — `ERR_BLOCKED_BY_CLIENT` на аналитических запросах YouTube. Не влияет на воспроизведение. Нет ошибок от нашего кода.
