# PROJECT_BRAIN

> Срез проекта на 2026-06-08 (обновлено). Для нового разработчика или AI — понять проект за 3-5 минут без чтения всего кода.
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
| `STORAGE_PROVIDER` | Провайдер файлового хранилища: "vercel-blob" (default) / "s3" / "minio" |

> ℹ️ **BLOB_READ_WRITE_TOKEN**: Не требуется! @vercel/blob v2.4.0 использует внутреннюю аутентификацию Vercel при запуске на серверless-функциях. OIDC токен автоматически доступен в production.
| `STORAGE_PROVIDER` | Провайдер файлового хранилища: "vercel-blob" (default) / "s3" / "minio" |

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
│  │ (SSR/CSR) │  │ (26 routes)  │  │ JWT + OAuth  │ │
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
│   └── api/                      # 26 API маршрутов
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
│       └── admin/                # CRUD challenges, skills, achievements, users, seed, settings, migrate
├── components/                   # 84 компонента
│   ├── challenges/               # Challenge card, result, multiple-choice, ordering
│   ├── dashboard/                # Stats grid, weekly chart, daily widget, mini leaderboard
│   ├── gamification/             # XP bar, streak, hearts, achievements, avatar frame, level badge
│   ├── layout/                   # AppLayout, sidebar, header, mobile tab bar
│   ├── effects/                  # Particles background
│   ├── profile/                  # Share card, referral card
│   ├── skills/                   # Skill tree
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
├── lib/                          # 5 модулей
│   ├── auth.ts                   # NextAuth config (Google + demo + admin)
│   ├── db.ts                     # Dual DB access: pool (raw SQL) + db (Prisma)
│   ├── gamification.ts           # XP/level math, multipliers, labels
│   ├── challenge-cache.ts        # Client-side challenge caching
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
| z-ai-web-dev-sdk | ^0.0.17 | AI SDK (интегрирован в Sprint 6: metadata/glossary/graph processing) |
| next-themes | ^0.4.6 | Dark/light переключатель |
| sonner | ^2.0.6 | Toast уведомления |
| ws | ^8.20.1 | WebSocket (для Neon pool в dev) |
| date-fns | ^4.1.0 | Работа с датами (streak, daily) |
| react-markdown | ^10.1.0 | Рендеринг Markdown в задачах |
| react-syntax-highlighter | ^15.6.1 | Подсветка кода в задачах |
| @vercel/blob | ^2.4.0 | Файловое хранилище (Vercel Blob Storage, OIDC auth) |

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

---

## 3. Core Modules

### 3.1 Auth (`src/lib/auth.ts` — 419 строк)
- **Провайдеры**: Google OAuth (условный — включается если GOOGLE_CLIENT_ID настроен), Demo login (email), Admin login (username/password)
- **Стратегия**: JWT, maxAge 30 дней, httpOnly cookies
- **Колбеки**: `signIn` (find-or-create user + referral processing), `jwt` (refresh from DB on every request), `session` (inject custom fields), `redirect` (prevent loops)
- **Проблема**: Admin credentials захардкожены (`admin/admin123`), 8 `as unknown as Record` кастов

### 3.2 Database (`src/lib/db.ts` — 69 строк)
- **Dual access**: `pool` (raw SQL через `@neondatabase/serverless`, 85% запросов) + `db` (PrismaClient через `PrismaNeon` adapter, admin/auth routes)
- **Hot-reload protection**: Глобальные синглтоны через `globalThis` (не пересоздаётся при HMR)
- **WebSocket fallback**: `ws` пакет для локальной разработки (Neon требует WebSocket в Node.js)
- **Проблема**: Pool/PrismaNeon type incompatibility — `as unknown as PoolConfig` каст

### 3.3 Gamification (`src/lib/gamification.ts` — 147 строк)
- **XP формулы**: `xpForLevel(n) = 100 * n^1.5` (экспоненциальный рост)
- **Множители**: Time-based (100% → 10% за 30с блоки), No-hearts penalty (50% XP)
- **Streak бонусы**: 7 дней → +200 XP, 30 дней → +1000 XP
- **48h правило**: Streak ломается если нет активности >48 часов
- **Категории**: prompting, agents, tools, automation, 1c, debugging, workflow, review
- **Сложности**: easy (25 XP), medium (50 XP), hard (100 XP)

### 3.4 User Store (`src/store/user-store.ts` — 50 строк)
- **Zustand 5**: id, name, email, image, role, xp, level, streak, maxStreak, completedChallenges, rank, isLoading
- **Методы**: setUser, addXp, setLevel, setStreak, setLoading, reset
- **Связи**: Dashboard, header (XP bar), profile, challenge result — все читают из стора

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
- **Header**: XP bar, streak counter, hearts display, avatar с frame, theme toggle
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
- **Media**: Видео/документы/изображения, привязанные к статьям (Vercel Blob → StorageProvider)
- **GlossaryTerm**: Термины с определениями, категориями, связанными терминами + Sprint 6: aiGenerated
- **ProcessingQueue**: Очередь AI-обработки (zip_import, ai_metadata, glossary_extract, graph_build, course_draft) с прогрессом и статусами
- **API**: 21 маршрут (CRUD spaces, categories, articles, glossary, search, seed, media, ZIP import, AI processing, processing queue)
- **Admin CRUD**: Вкладка «Знания» в /admin — полный CRUD для пространств, категорий, статей, глоссария
- **Markdown Editor**: Создание/редактирование статей с превью в admin
- **Publish/Draft**: Переключатель isPublished для пространств и статей
- **UI**: /knowledge (пространства), /knowledge/[slug] (категории+статьи), /knowledge/article/[id] (статья + медиа)

### 3.14 AI-Глоссарий (`src/components/knowledge/glossary-command.tsx`, `glossary-trigger.tsx`)
- **Cmd+K / Ctrl+K / Ctrl+Л**: Глобальный поиск по терминам из любого места приложения (русская раскладка поддерживается)
- **Inline Search**: Строка поиска по глоссарию прямо на странице База знаний
- **Floating ? button**: Кнопка в правом нижнем углу (позиционирована над mobile tab bar)
- **Command Dialog**: Fuzzy-поиск по glossary_terms, кликабельные related terms
- **Категории**: AI, Tools, 1C, General — цветные badge
- **10 предзагруженных терминов**: LLM, Промпт, MCP, RAG, Context Window, Tool Calling, AI Агент, Токен, Fine-tuning, Embedding

### 3.16 Storage & Media (`src/lib/storage/`, `src/lib/media-service.ts`, `src/lib/media-utils.ts`)
- **StorageProvider**: Интерфейс (upload, delete, getUrl) — абстракция над файловым хранилищем
- **VercelBlobStorageProvider**: Реализация через @vercel/blob (MVP)
- **MediaService**: Бизнес-логика загрузки/удаления/привязки файлов, не знает про конкретное хранилище
- **media-utils.ts**: Клиентские утилиты (formatFileSize, getFileIcon, validateFile, detectFileType, generateStorageKey, ALLOWED_FILE_TYPES) — БЕЗ серверных импортов. Клиентские компоненты импортируют отсюда.
- **Поддерживаемые типы**: видео (MP4/WebM/MOV до 2 ГБ), PDF (100 МБ), PPTX (200 МБ), DOCX (100 МБ), изображения (20 МБ)
- **Формат ключей**: knowledge/{entityType}s/{entityId}/{timestamp}_{filename}
- **API**: POST /api/knowledge/media/upload, GET /api/knowledge/media, GET/DELETE /api/knowledge/media/[id]
- **UI**: MediaUpload (drag&drop + прогресс), MediaViewer (видеоплеер, документы, изображения + лайтбокс + видео-модалка)
- **Lightbox**: Изображения увеличиваются в модалке (клик/Escape/крестик), картинки в Markdown тоже кликабельны
- **Video Modal**: Видео открываются в модалке поверх страницы, продолжение с того же места после закрытия
- **Inline Glossary Search**: Строка поиска по глоссарию прямо на странице База знаний
- **Ctrl+Л**: Русская раскладка поддерживается для глобального поиска (Ctrl+K / Ctrl+Л)
- **Переключение хранилища**: env var STORAGE_PROVIDER → vercel-blob (default) / s3 / minio (будущие)
- **Blob Store**: store_5OkTkSLciotjEC41 (подключён, верифицирован, region iad1)

### 3.17 AI Content Processing Pipeline — Sprint 6 (`src/app/api/knowledge/`, `src/components/knowledge/`)
- **Видение**: НЕ строить курсы вручную. Загрузить сырые материалы → AI анализирует → глоссарий → граф знаний → курсы появляются автоматически
- **Поток**: Materials → AI Analysis → Glossary → Knowledge Graph → Learning Path → Course
- **Хранилище видео**: Яндекс Диск (75 ГБ бесплатно) — видео НЕ загружается на наш сервер, только ссылки
- **Article расширения**: 15 новых колонок (difficulty, prerequisites, nextTopics, keyConcepts, estimatedTime, status, aiGenerated, videoUrl, pdfUrl, pptxUrl, sourceUrl, sourceType, processedAt, errorMessage)
- **ProcessingQueue**: Новая таблица для асинхронной обработки (zip_import, ai_metadata, glossary_extract, graph_build, course_draft)
- **API маршруты** (5 новых):
  - `/api/knowledge/import` — ZIP-импорт (JSZip extraction, auto-create articles)
  - `/api/knowledge/process` — Создание задач обработки
  - `/api/knowledge/process/[id]` — Управление задачей (GET/PUT/DELETE)
  - `/api/knowledge/queue` — Список очереди обработки
  - `/api/knowledge/ai` — AI-обработчик (metadata, glossary, graph через z-ai-web-dev-sdk)
- **UI компоненты** (5 новых):
  - `VideoEmbed` — Универсальный видео-плеер (YouTube, Rutube, VK, Яндекс Диск, прямая ссылка)
  - `UrlImportForm` — Форма ввода URL для видео/PDF/PPTX
  - `ZipUpload` — Загрузка ZIP-архива с drag-and-drop
  - `ProcessingQueue` — Отображение очереди обработки с прогрессом
  - Materials Library (`/knowledge/materials`) — Страница библиотеки материалов с фильтрами
- **VideoEmbed**: Авто-детект источника по URL, адаптивный 16:9 iframe для YouTube/Rutube, ссылка-кнопка для Яндекс Диска, нативный `<video>` для прямых ссылок
- **Sidebar**: Добавлен пункт «Материалы» (Archive icon) перед «База знаний»
- **gen-id.ts**: Общий модуль генерации ID — замена дублированию genId() в 5+ файлах

---

## 4. Current State

### Метрики проекта
- **Строк кода**: ~23,000 (src/ только .ts/.tsx)
- **Страниц**: 17
- **API маршрутов**: 42
- **Компонентов**: 89
- **Хуков**: 5
- **Моделей Prisma**: 17 (User, Account, Session, VerificationToken, Skill, UserSkill, Challenge, ChallengeAttempt, DailyChallengeAssignment, XPLog, Achievement, UserAchievement, KnowledgeSpace, Category, Article, Media, GlossaryTerm, ProcessingQueue)
- **Размер GitHub repo**: 6,752 KB

### Реализовано и работает стабильно
- Аутентификация (Google OAuth + demo вход + admin вход)
- 100 задач в 7 категориях (prompting, agents, debugging, workflow, 1c, review, tools)
- 3 типа задач: multiple_choice, ordering, workflow_build
- Геймификация: XP (экспоненциальная формула), уровни (1-бесконечность), streak (48h правило), hearts, cooldown
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
- **Файловое хранилище** — Vercel Blob Storage через StorageProvider абстракцию (видео, PDF, PPTX, DOCX, изображения)
- **MediaUpload** — Drag&drop загрузка файлов с прогрессом, привязка к статьям
- **MediaViewer** — Видеоплеер, документы, изображения + лайтбокс + видео-модалка с resume

### Работает частично
- **Activity chart**: Верхняя граница может перекрывать числа при высоких значениях
- **Адаптивная сложность**: Механизм есть, но нет UI-индикации для юзера
- **Marathon**: Валидация на клиенте (correctAnswer в response) — работает, но нечестно
- **Google OAuth**: Условно включён — если env vars не настроены, провайдер не добавляется

### Не реализовано
- **Playground** (`/playground`): Страница скрыта из навигации, доступна по прямой ссылке. z-ai-web-dev-sdk не интегрирован
- **Уведомления** (push/email)
- **Мультиязычность** (только русский, next-intl установлен но не используется)
- **Тесты** (0 тестовых файлов, playwright установлен)
- **Error boundaries** (любой рантайм краш = белый экран)
- **Rate limiting** (API без защиты от спама)
- **Загрузка файлов** (MinIO/S3 — Sprint 2, реализовано через Vercel Blob)
- **HLS-трансляция** (FFMPEG — отложено до VPS/Render Worker)
- **Превью видео** (thumbnailUrl — отложено до FFmpeg)
- ~~**AI-анализ материалов**~~ (реализовано в Sprint 6 — AI metadata/glossary/graph через z-ai-web-dev-sdk)
- **Learning Path** (дорожные карты онбординга)

### Синхронизация кодовых баз
- **Workspace → Vercel (obuch-ai)**: Деплоится через `vercel deploy --prod`, содержит весь функционал
- **GitHub repo (obuchAI)**: Синхронизирован с workspace, Vercel привязан к GitHub
- **Старый repo (obuch-project)**: Устаревшая реструктурированная версия, не используется

---

## 5. Known Issues & Problems

### Критические (P0)
1. **Hardcoded admin-пароль** — `admin/admin123` прямо в `src/lib/auth.ts:143`
2. **SQL injection** — admin challenges PUT/spaces PUT/glossary PUT используют `Object.entries(body)` для формирования SQL-колонок без whitelist (categories и articles PUT используют whitelist — исправлено в Sprint 4)
3. **Marathon читерство** — `correctAnswer` отправляется клиенту в `/api/marathon`
4. **Нет валидации входных данных** — admin routes передают `body` напрямую в Prisma/raw SQL

### Значимые (P1)
5. **Schema drift** — Prisma schema не содержит 9+ колонок и 1 таблицу (`app_settings`), добавленных через `ALTER TABLE` в runtime
6. **Runtime ALTER TABLE** — `ensureColumns()` в `admin/users/[id]/route.ts` выполняет ALTER TABLE при каждом запросе
7. **Дублирование данных сидирования** — 100 задач определены и в `prisma/seed.ts`, и в `admin/seed/route.ts` — синхронизация вручную
8. ~~**Дублирование genId()**~~ — **Исправлено в Sprint 6**: создан `/src/lib/gen-id.ts` (shared модуль)
9. **Дублирование реферальной логики** — Генерация кода + XP начисление повторяются 3 раза
10. **Неправильное имя таблицы** — ~~`DELETE FROM attempts` вместо `challenge_attempts`~~ **ИСПРАВЛЕНО** (2026-06-08)
11. **Type-unsafe касты** — 44+ инстансов `as Record<string, unknown>` вместо расширения NextAuth типов
12. **`ignoreBuildErrors: true`** в next.config.ts — TypeScript ошибки не ломают билд
13. **`reactStrictMode: false`** — Отключён строгий режим React
14. **GitHub синхронизирован** — Рабочий код в obuchAI repo, Vercel привязан к GitHub

### Минорные (P2)
15. **Версия не совпадает** — package.json `0.3.0`, sidebar `v2.5.0`
16. **Stale .env.example** — Содержит GITHUB_ID/EMAIL_SERVER, которые не используются
17. **Мёртвые зависимости** — next-intl, @mdxeditor/editor, sharp, playwright не используются в src/
18. **Vercel Toolbar hack** — Скрипт+куки для убийства тулбара вместо нормального отключения
19. **Мёртвый компонент** — `src/components/ui/achievement-card.tsx` (старая версия)

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

### GitHub реструктуризация
- **Проблема**: Попытка переписать архитектуру (journeys/tasks/rbac/events)
- **Что случилось**: Новый repo создан 2026-06-07, но не завершён — упрощённая версия без большей части функционала
- **Результат**: Две расходящиеся кодовые базы; рабочий код в workspace, незавершённый в GitHub

### TypeScript ошибки
- **Проблема**: 31 ошибка в src/, билд падал
- **Что делали**: Исправили UserState (добавили completedChallenges, rank), streak-calendar typing, Framer Motion easing cast, auth.ts unsafe casts, db.ts Pool/PoolConfig
- **Результат**: 0 ошибок в src/, 4 некритичных в prisma/seed (не влияют на runtime)

### SessionProvider вне корневого layout → useSession() crash
- **Проблема**: `Cannot destructure property 'data' of useSession() as it is undefined` — весь сайт крашился с белым экраном
- **Причина**: `SessionProvider` был внутри `AppLayout` (клиентский компонент), а не в корневом `layout.tsx`. Next.js 16 + next-auth v4 несовместимость: при SSR/hydration `useSession()` возвращал `undefined` вместо `{data: null, status: "unauthenticated"}`
- **Почему опасно**: `const { data: session } = useSession()` — деструктуризация `undefined` крашит React. Это ломало ВСЁ: сайдбар, хедер, страницу статьи, кнопку "Прикрепить файлы", админ-логин
- **Что НЕ сработало**: Прямой импорт SessionProvider в корневой layout — крашит билд (`React Context is unavailable in Server Components`)
- **Что сработало**: Создан `src/components/providers.tsx` — `"use client"` обёртка → `SessionProvider` → используется в корневом layout. Плюс defensive destructuring: `const sessionResult = useSession(); const session = sessionResult?.data ?? null;`
- **Урок**: **SessionProvider ВСЕГДА в корневом layout** через клиентский wrapper. Никогда не прятать в дочерние layout-ы. Всегда проверять `useSession()` на `undefined` через optional chaining.

### Текстовые иконки в квадратиках → overflow
- **Проблема**: Текстовые иконки пространств знаний (Prompting, tools, agents) не помещались в зелёные квадратики 40×40px и ломали вёрстку
- **Что НЕ сработало**: Уменьшение шрифта, text-overflow, word-break — всё равно некрасиво
- **Что сработало**: Детект emoji vs текст. Emoji показываем как есть. Текст → аббревиатура (1-2 символа) в квадратике, полный текст — мелким шрифтом рядом со статистикой
- **Урок**: Не пытаться впихнуть длинный текст в фиксированный контейнер — лучше переструктурировать layout

### Ctrl+K не работает на русской раскладке
- **Проблема**: Клавиша "K" на русской раскладке = "Л", событие keydown приходит с `e.key === "л"`, а не `"k"`
- **Что сработало**: Добавлен слушатель `e.key === "л"` (строчная русская Л) рядом с `"k"`. Плюс inline поиск на странице Базы знаний как альтернатива
- **Урок**: Горячие клавиши нужно тестировать на обеих раскладках (en/ru) для русской аудитории

---

## 7. Decisions & Reasoning

### Raw SQL вместо Prisma для большинства запросов
- **Причина**: Prisma adapter для Neon имеет ограничения; raw SQL гибче и быстрее для сложных запросов
- **Компромисс**: Потеря type-safety, дублирование genId(), риск SQL injection

### JWT вместо DB-сессий
- **Причина**: Serverless-окружение Vercel — нет постоянных соединений
- **Компромисс**: JWT обновляется из БД на каждый запрос (дополнительный SELECT при каждом запросе)

### Feature flags в БД
- **Причина**: Включать/выключать эффекты без редеплоя
- **Реализация**: `app_settings` таблица, `/api/settings` с revalidation 30s, `useAppSettings` React context

### Standalone output
- **Причина**: Оптимизация размера bundle для Vercel serverless
- **Компромисс**: Некоторые middleware-паттерны не работают

### NextAuth v4 вместо v5
- **Причина**: v5 нестабилен на момент старта; v4 документирован и стабилен
- **Компромисс**: Устаревший API, нет Auth.js 5 фич, 44+ type-unsafe кастов

### Русский язык UI
- **Причина**: Целевая аудитория — 1C-разработчики в РФ
- **Компромисс**: Нет i18n, хардкод строк на русском

### Vercel Toolbar hack
- **Причина**: Vercel Toolbar появлялся на production и ломал UI
- **Реализация**: Script в layout.tsx + cookies в middleware + CSS rules в globals.css
- **Компромисс**: Три слоя хаков вместо одной настройки проекта

---

## 8. Limitations / Tech Debt

### Костыли
1. **Runtime ALTER TABLE** — `ensureColumns()` выполняется при каждом admin-запросе к юзерам
2. **Vercel Toolbar killer** — Скрипт в layout.tsx + cookie в middleware + CSS вместо настройки проекта
3. **Hardcoded admin credentials** — `admin/admin123` в исходном коде
4. **Marathon читерство** — correctAnswer на клиенте
5. **`ignoreBuildErrors: true`** — TypeScript ошибки не блокируют деплой
6. **GitHub синхронизирован** — Рабочий код в obuchAI repo, Vercel привязан к GitHub

### Ограничения архитектуры
1. **Нет миграций** — Prisma schema не синхронизирована с реальной БД
2. **Нет валидации входных данных** — admin routes без Zod-схем
3. **Нет тестов** — 0 тестовых файлов
4. **Нет error boundaries** — Любой рантайм краш рендерит белый экран
5. **Мёртвый код** — Старый achievement-card.tsx, неиспользуемые зависимости
6. **Нет rate limiting** — API endpoints без защиты от спама
7. **Нет CSRF защиты** — Кроме NextAuth built-in
8. **Нет логирования** — console.log/warn/error без structured logging

### Временные решения
1. Feature flags через БД вместо env vars
2. Demo-вход без пароля (создаёт демо-юзера автоматически)
3. `noImplicitAny: false` в tsconfig
4. Дублирование сид-данных в двух файлах (prisma/seed.ts и admin/seed/route.ts)
5. genId() вместо UUID — ~~копируется в каждый файл~~ **Исправлено в Sprint 6**: создан `/src/lib/gen-id.ts` (shared модуль)

---


---

## 9. Next Steps

### Сводка спринтов (актуализировано 2026-06-08)

> **Важно**: Нумерация спринтов обновлена. Ранее Sprint 3 был «AI-анализ» и стоял после Sprint 2,
> но фактически мы прошли Content Management, UI Polish и UX Fixes раньше.
> Теперь нумерация отражает реальный порядок выполнения.

| Спринт | Название | Статус | Ключевые результаты |
|---|---|---|---|
| **Sprint 1** | Knowledge Hub | ✅ ЗАВЕРШЁН | Модели, миграции, 9+ API, UI /knowledge, AI-Глоссарий (⌘K) |
| **Sprint 2** | Загрузка файлов | ✅ ЗАВЕРШЁН | StorageProvider, Vercel Blob, MediaUpload/Viewer, drag&drop |
| **Sprint 3** | Content Management | ✅ ЗАВЕРШЁН | Admin CRUD для знаний, Markdown-редактор, publish/draft, whitelist SQL |
| **Sprint 4** | UI Polish & Cleanup | ✅ ЗАВЕРШЁН | Редизайн форм задач, Ctrl+Л, inline-поиск, генерация ID |
| **Sprint 5** | UX Fixes & Auth Stability | ✅ ЗАВЕРШЁН | SessionProvider в корне, лайтбокс, видео-модалка, скрытие Песочницы/Навыков |
| **Bugfix** | Admin API 500 | ✅ ЗАВЕРШЁН | Конвертация на raw SQL, фикс DELETE, кнопка «Миграция БД» |
| **Sprint 6** | AI Content Processing Pipeline | ✅ ЗАВЕРШЁН | Расширение Article (15 новых колонок), ProcessingQueue, ZIP Import, AI Metadata/Glossary/Graph, Materials Library, Video Embed, URL Import, Яндекс Диск |
| **Sprint 7** | Наполнение контентом | 📋 СЛЕДУЮЩИЙ | Bulk-наполнение 30+ тем, новые категории, расширение глоссария |
| **Sprint 8** | Умный поиск | 📋 ПЛАН | UI поиска по всем материалам, фильтры, «похожие статьи», расширенный ⌘K |

### Проблемы, с которыми столкнулись, и решения (для предотвращения повторов)

| Проблема | Симптом | Решение | Урок |
|---|---|---|---|
| SessionProvider в дочернем layout | `Cannot destructure property 'data' of useSession()` — весь сайт крашился | Создан `providers.tsx` (клиентский wrapper), SessionProvider перемещён в корневой layout | **Никогда не прятать SessionProvider в дочерние layout-ы. Всегда defensive destructuring: `r?.data ?? null`** |
| Текстовые иконки overflow | "Prompting" ломал зелёные квадратики 40×40px | Детект emoji vs текст → аббревиатура в квадратике, полный текст рядом | Не впихивать длинный текст в фиксированный контейнер — переструктурировать layout |
| Ctrl+K не работает на русской раскладке | Клавиша "K" на русской = "Л", `e.key === "л"` | Добавлен слушатель `e.key === "л"` рядом с `"k"` + inline поиск | Тестировать хоткеи на обеих раскладках (en/ru) |
| Prisma migrate ломается на Neon | Миграции не применяются на serverless PostgreSQL | Runtime `ALTER TABLE IF NOT EXISTS` через API endpoint | Neon serverless + Prisma adapter имеет ограничения; runtime DDL — временный костыль |
| Мобильная производительность | 25+ анимаций тормозили на мобильных | Снижение частиц до 6, CSS-only анимации вместо Framer Motion | ≤10 одновременных анимаций на мобильных; CSS дешевле Framer |
| API 500 на admin routes | Prisma `create()` ломался на серверных API | Конвертация на raw SQL (pool.query) | Raw SQL надёжнее при schema drift, Prisma только для auth |
| z-ai-web-dev-sdk не используется | Установлен, но нигде не импортирован | Будет интегрирован в Sprint 6 (AI Content Processing Pipeline) | Не устанавливать зависимости «на будущее» без интеграции |
| Vercel Hobby = 250 МБ Blob | Невозможно загрузить видео (700 МБ–1.2 ГБ) | Переход на Pro ($20/мес) = 1 ТБ хранилища | Планировать тариф до загрузки контента; StorageProvider абстракция позволяет сменить провайдера |

### Sprint 1 — Knowledge Hub (ЗАВЕРШЁН ✅)
- [x] Prisma модели: KnowledgeSpace, Category, Article, Media, GlossaryTerm
- [x] Миграция: CREATE TABLE + FK + индексы + seed данные
- [x] API routes: 9 маршрутов (CRUD + search + seed)
- [x] UI: /knowledge, /knowledge/[slug], /knowledge/article/[id]
- [x] AI-Глоссарий: ⌘K overlay + floating ? button
- [x] Sidebar: "База знаний" с BookOpen иконкой

### Sprint 2 — Загрузка файлов (ЗАВЕРШЁН ✅)
- [x] StorageProvider интерфейс (абстракция: upload, delete, getUrl)
- [x] VercelBlobStorageProvider реализация (@vercel/blob)
- [x] MediaService (бизнес-логика, не знает про Blob/S3)
- [x] Upload API: POST /api/knowledge/media/upload (multipart/form-data, admin only)
- [x] Delete API: DELETE /api/knowledge/media/[id] (admin only)
- [x] List API: GET /api/knowledge/media?articleId=xxx
- [x] Поддержка типов: видео (MP4/WebM/MOV до 2 ГБ), PDF (100 МБ), PPTX (200 МБ), DOCX (100 МБ), изображения (20 МБ)
- [x] UI: MediaUpload — drag&drop + выбор файлов, прогресс загрузки
- [x] UI: MediaViewer — видеоплеер, документы, изображения в статье
- [x] Интеграция: MediaUpload + MediaViewer в /knowledge/article/[id]
- [x] Blob Store подключён и верифицирован (store_5OkTkSLciotjEC41, region iad1)
- [x] BLOB_READ_WRITE_TOKEN не нужен — Vercel internal auth работает
- [x] media-utils.ts — клиентские утилиты отделены от серверного media-service.ts
- [ ] Привязка файлов к урокам (когда появятся lessons)
- [ ] Превью: thumbnailUrl для видео (FFmpeg — отложено)
- [ ] HLS-трансляция для видео 500+ МБ (отложено до VPS/Render Worker)

### Sprint 3 — Content Management (ЗАВЕРШЁН ✅)
- [x] Исправлен SQL баг в articles/[id] (JOIN spaces → knowledge_spaces)
- [x] Создан POST /api/knowledge/media/upload (multipart/form-data, admin only)
- [x] POST /api/knowledge/spaces — создание пространств
- [x] POST /api/knowledge/categories — создание категорий
- [x] PUT/DELETE /api/knowledge/categories/[id] — обновление/удаление категорий
- [x] POST /api/knowledge/articles — создание статей
- [x] PUT/DELETE /api/knowledge/articles/[id] — обновление/удаление статей
- [x] POST /api/knowledge/glossary — создание терминов
- [x] ?all=true параметр для админ-листинга (включая неопубликованные)
- [x] KnowledgeAdmin компонент — 4 подвкладки (пространства, категории, статьи, глоссарий)
- [x] Markdown-редактор с превью для статей
- [x] Переключатель publish/draft для пространств и статей
- [x] Вкладка «Знания» в /admin (BookOpen иконка)
- [x] Whitelist SQL-полей в categories/articles PUT (без Object.entries)

### Bugfix — Admin API 500 errors (2026-06-08, ЗАВЕРШЁН ✅)
- [x] Конвертация admin/challenges POST с Prisma на raw SQL
- [x] Конвертация admin/achievements POST и admin/skills POST на raw SQL
- [x] Конвертация admin stats GET на raw SQL (с fallback-ами)
- [x] Исправлен баг DELETE FROM attempts → challenge_attempts
- [x] Исправлен формат ответа /api/challenges в admin page
- [x] Добавлена кнопка «Миграция БД» в admin page
- [x] Улучшены сообщения об ошибках (detail в 500 ответах)

### Sprint 4 — UI Polish & Cleanup (2026-06-08, ЗАВЕРШЁН ✅)
- [x] Исправлен баг `cn is not defined` в admin/page.tsx
- [x] Редизайн формы создания/редактирования задач (индивидуальные поля опций + radio-кнопки)
- [x] Версия обновлена до v2.5.0 в сайдбаре
- [x] Исправлен баг «верный ответ всегда неверный» — String() конвертация
- [x] Форма редактирования задач загружает данные через /api/challenges/[id]
- [x] Добавлена генерация ID (UUID с префиксами) для knowledge POST routes
- [x] Select «uncontrolled to controlled» — пустые строки → __none__ placeholder
- [x] GET endpoints для knowledge устойчивы к отсутствию таблиц ([] вместо 500)
- [x] **Ctrl+Л** — поиск по глоссарию работает на русской раскладке
- [x] **Inline поиск по глоссарию** — строка поиска прямо на странице База знаний

### Sprint 5 — UX Fixes & Auth Stability (2026-06-08, ЗАВЕРШЁН ✅)
- [x] **Критический фикс: SessionProvider в корневом layout** — создан `src/components/providers.tsx` (клиентский wrapper), перемещён из `AppLayout` в корневой `layout.tsx`
- [x] **Defensive destructuring** — все 3 вызова `useSession()` безопасны: `const r = useSession(); const session = r?.data ?? null;`
- [x] **Текстовые иконки пространств** — emoji как есть, текст → аббревиатура (1-2 символа)
- [x] **Песочница скрыта** — убрана из сайдбара и «О проекте» (доступна по /playground)
- [x] **Навыки удалены из UI** — сайдбар, вкладка в админке, дашборд, профиль, «О проекте»
- [x] **Лайтбокс для изображений** — клик → полноэкранный просмотр, Esc/крестик/клик по фону
- [x] **Видео-модалка** — видео поверх страницы, Esc/крестик/клик по фону
- [x] **Resume видео** — позиция запоминается, продолжение при повторном открытии
- [x] **Кнопка "Прикрепить файлы"** — починена (краш useSession() был корневой причиной)
- [x] Создан media-lightbox.tsx — переиспользуемые Lightbox и VideoModal компоненты
- [x] Исправлено определение прав админа — тройная проверка (Zustand + session + API)

### Sprint 6 — AI Content Processing Pipeline (СЛЕДУЮЩИЙ 📋)

> **Визия**: Не строить курсы руками. Автоматизировать поток:
> `Материалы → AI анализ → Глоссарий → Граф знаний → Learning Path → Курс`
>
> **Узкое место**: 90+ файлов (видео + PDF + PPTX) нужно превратить в структурированную базу знаний.
> Пока это не решено, все остальные функции почти бесполезны.
>
> **НЕ делать в этом спринте**: ❌ Битрикс ❌ Наставников ❌ Сертификаты ❌ Геймификацию ❌ Конструктор курсов

#### 6.1 ZIP Upload (Bulk Import)
- [ ] API: POST /api/knowledge/import/upload — приём ZIP-архива (multipart/form-data)
- [ ] Распаковка ZIP на сервере ( админская мультипликативная загрузка)
- [ ] Парсинг структуры папок ZIP → определение тем по имени папки/файла
  ```
  AI-Course.zip
  ├ MCP/
  │ ├ MCP.mp4
  │ ├ MCP.pdf
  │ └ MCP.pptx
  ├ Cursor/
  │ ├ Cursor.mp4...
  ```
- [ ] Авто-создание Space «AI Development» если не существует
- [ ] Авто-создание Article для каждой папки (MCP, Cursor, Claude Code...)
- [ ] Авто-загрузка файлов в Vercel Blob → привязка к Article как Media
- [ ] Статус статьи: `aiStatus = 'pending'` после импорта
- [ ] UI: Окно загрузки ZIP в админке (вкладка «Знания» → кнопка «Импорт ZIP»)

#### 6.2 Расширение модели Article
- [ ] Новые колонки в БД (ALTER TABLE + Prisma schema):
  - `difficulty` TEXT — easy / medium / hard
  - `prerequisites` JSONB — [{"id": "...", "title": "LLM"}]
  - `nextTopics` JSONB — [{"id": "...", "title": "Advanced MCP"}]
  - `keyConcepts` JSONB — [{"term": "Tool", "definition": "..."}]
  - `estimatedTime` TEXT — «30 мин», «2 часа»
  - `aiStatus` TEXT — pending / processing / done / error
  - `aiGenerated` BOOLEAN DEFAULT false — карточка сгенерирована AI
  - `aiSummary` TEXT — сгенерированное AI описание (отличается от ручного summary)
  - `sourceType` TEXT — 'zip_import' / 'manual' / 'url_import'
  - `sourceUrl` TEXT — для URL-импорта

#### 6.3 Processing Queue (фоновая обработка)
- [ ] Таблица `processing_queue` в БД:
  - id, articleId, type (metadata / glossary / graph), status (pending/processing/done/error), result JSONB, createdAt, processedAt, error
- [ ] API: POST /api/knowledge/process/trigger — запустить обработку для статьи/всех pending
- [ ] API: GET /api/knowledge/process/status — статус очереди
- [ ] Обработка **асинхронная** — видео по 700 МБ — 1.2 ГБ, синхронно нельзя
- [ ] Статус-индикаторы в UI: 🕐 Не начата / ⏳ В очереди / 🔄 Обрабатывается / ✅ Готово / ❌ Ошибка

#### 6.4 AI Metadata Generation
- [ ] Извлечение текста из PDF (pdf-parse или аналоги)
- [ ] Извлечение текста из PPTX (pptx-to-text)
- [ ] Извлечение текста из DOCX (mammoth)
- [ ] AI-генерация через z-ai-web-dev-sdk:
  - `summary` — краткое описание темы (2-3 предложения)
  - `aiSummary` — развёрнутое AI-описание (1-2 абзаца)
  - `tags` — список тегов
  - `keyConcepts` — ключевые понятия с определениями
  - `difficulty` — easy/medium/hard
  - `estimatedTime` — предполагаемое время изучения
- [ ] Запись сгенерированных данных в Article + установка aiStatus='done', aiGenerated=true

#### 6.5 Glossary Extraction
- [ ] AI извлекает глоссарий-термины из текста материала
- [ ] Для каждого термина: term, shortDefinition, category, relatedTerms
- [ ] Сравнение с существующим глоссарём — дубликаты пропускаются
- [ ] UI: Список предложенных терминов → кнопка «Добавить в глоссарий» для каждого
- [ ] Авто-добавление при высокой уверенности AI (>90%)

#### 6.6 Knowledge Graph Generation
- [ ] AI анализирует prerequisites и nextTopics для каждой темы
- [ ] Построение графа зависимостей: `Введение → LLM → Промптинг → MCP → Advanced MCP`
- [ ] Запись в Article.prerequisites и Article.nextTopics
- [ ] UI: Визуализация графа (простая — список с уровнями)

#### 6.7 Materials Library (новый раздел навигации)
- [ ] Новый пункт меню: **Библиотека материалов** (отдельно от Knowledge Hub)
- [ ] Страница `/materials` — список всех тем с файлами и AI-статусами
  ```
  ┌─────────────────────────────────────────┐
  │ MCP                           📹 📄 📊  │
  │ AI-обработка: ✅ Готово                  │
  │ Сложность: Medium                        │
  ├─────────────────────────────────────────┤
  │ Cursor                        📹 📄 📊  │
  │ AI-обработка: ⏳ В очереди               │
  │ Сложность: —                             │
  └─────────────────────────────────────────┘
  ```
- [ ] Разделение: Materials Library = сырой контент, Knowledge Hub = готовые курсы
- [ ] Фильтры по AI-статусу, типу файлов, сложности

#### 6.8 URL Import (доп. функционал)
- [ ] API: POST /api/knowledge/import/url — импорт по ссылке
- [ ] Скачивание веб-статьи → извлечение текста → AI-обработка
- [ ] Поддержка: прямые ссылки на PDF, веб-статьи
- [ ] YouTube: извлечение описания + субтитров (если доступны)

### Vercel Blob Storage — лимиты и тарифы

> **Важно**: Текущий тариф — **Hobby (бесплатный)**. Хранилище — **250 МБ**.
> Даже одно видео на 700 МБ не поместится. Нужен апгрейд.

| Параметр | Hobby (сейчас) | Pro ($20/мес) |
|---|---|---|
| Хранилище | **250 МБ** | **1 ТБ (1024 ГБ)** |
| Бандвидс | 1 ГБ/мес | 1 ТБ/мес |
| Макс. файл | 500 МБ | 5 ГБ |
| Сверх лимита | — | $0.15/ГБ/мес |

**Расчёт для 30 тем** (видео + PDF + PPTX): ~21.5 ГБ
**Расчёт для 100 тем** (будущее): ~72 ГБ

**Рекомендация**: Перейти на **Vercel Pro** — 1 ТБ хватит на 100+ тем.
Альтернатива: S3/Selectel-провайдер (StorageProvider абстракция уже готова).

### Sprint 7 — Наполнение контентом (ПЛАН 📋)
> После Sprint 6 у нас будет AI-пайплайн. Sprint 7 — загрузить реальные материалы через него.

- [ ] Загрузить 30 тем через ZIP Import (видео + PDF + PPTX)
- [ ] Запустить AI-обработку для всех загруженных тем
- [ ] Проверить и подтвердить AI-сгенерированные метаданные
- [ ] Расширить глоссарий: 30-50 терминов (AI + ручная проверка)
- [ ] Новые категории: MCP серверы, Cursor правила, Copilot, Claude Code, AI Agents
- [ ] Превью статьи перед публикацией (preview mode для admin)
- [ ] Импорт дополнительных материалов по URL-ссылкам

### Sprint 8 — Умный поиск (ПЛАН 📋)
> Базовый API поиска уже есть (/api/knowledge/search — ILIKE по статьям, глоссарию, задачам).
> Но UI и расширенные функции поиска ещё не реализованы.

- [ ] UI поиска по всем материалам (отдельная страница или overlay)
- [ ] Расширить ⌘K: поиск не только по глоссарию, но и по статьям + задачам
- [ ] Фильтрация по категориям/тегам в результатах поиска
- [ ] Рекомендации «Похожие статьи» на странице статьи
- [ ] Подсветка совпадений в результатах поиска
- [ ] История поиска (localStorage)
- [ ] Интеграция с semantic search из Sprint 6 (когда будет)

### Безопасность (P0)
- [ ] Вынести admin credentials в env vars
- [ ] Добавить Zod-валидацию на admin routes
- [ ] Whitelist SQL-колонок в challenges PUT
- [ ] Серверная валидация marathon (не отправлять correctAnswer)

### Синхронизация (P0)
- [ ] Решить: синхронизировать GitHub repo с workspace или наоборот
- [ ] Если GitHub = source of truth → пушнуть текущий workspace код
- [ ] Если workspace = source of truth → обновить GitHub repo

### Архитектура (P1)
- [ ] Синхронизировать Prisma schema с реальной БД
- [ ] Создать нормальные миграции (заменить runtime ALTER TABLE)
- [ ] Расширить NextAuth типы (убрать `as Record<string, unknown>`)
- [ ] Вынести genId() и реферальную логику в shared модули
- [ ] Консолидировать сид-данные (один источник правды)

### Качество (P2)
- [ ] Убрать `ignoreBuildErrors: true`
- [ ] Добавить React error boundaries
- [ ] Удалить мёртвые зависимости (next-intl, @mdxeditor/editor, sharp)
- [ ] Синхронизировать версию (0.3.0 → актуальная)
- [ ] Обновить .env.example (убрать GITHUB_ID, EMAIL_SERVER; добавить GOOGLE_*, NEON_*)
- [ ] Добавить хотя бы smoke-тесты
- [ ] Включить `reactStrictMode`

### Фичи (P3)
- [ ] Activity chart: исправить верхнюю границу
- [ ] UI-индикация адаптивной сложности
- [ ] Интеграция z-ai-web-dev-sdk в playground
- [ ] Уведомления о новом daily challenge
- [ ] Больше задач (200+)
- [ ] Rate limiting на API
- [ ] Error boundaries на всех страницах

## 10. Quick Context for AI

### Как писать код в этом проекте

1. **Язык**: TypeScript строго, React функциональные компоненты, `"use client"` для интерактивных
2. **Стили**: Tailwind CSS 4 + `cn()` из `src/lib/utils.ts` для условных классов
3. **UI-компоненты**: shadcn/ui из `src/components/ui/` — не писать свои кнопки/инпуты
4. **API**: Next.js App Router API routes в `src/app/api/`
5. **БД**: Raw SQL через `pool.query()` из `src/lib/db.ts` для новых запросов; Prisma `db.*` только для auth adapter. **НЕ использовать Prisma для новых API routes** — raw SQL надёжнее и не ломается при schema drift.
6. **ID**: `genId()` → `cuid()` — НЕ использовать UUID, всегда cuid-подобный ID
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
- **НЕ прятать SessionProvider в дочерние layout-ы** — всегда в корневом layout через `"use client"` wrapper (провалили однажды, крашило весь сайт)
- **ВСЕГДА defensive destructuring для useSession()**: `const r = useSession(); const session = r?.data ?? null;` — никогда `const { data } = useSession()`
- Новые колонки БД → сначала ALTER TABLE в migrate route, потом обновить Prisma schema
- Новые API → проверка admin через `getServerSession()`, не через middleware

### Деплой
- Код из workspace деплоится на Vercel (obuch-ai) через `vercel deploy --prod`
- GitHub repo (obuchAI) привязан к Vercel проекту, но auto-deploy через webhook пока не настроен
- Для редеплоя: `vercel deploy --prod --token <VERCEL_TOKEN>` или push в GitHub + ручной деплой
- БД: Neon PostgreSQL — соединения pooled (DATABASE_URL) и unpooled (DATABASE_URL_UNPOOLED)
- Blob Store: store_5OkTkSLciotjEC41 (region iad1, public access, OIDC auth)
- После изменений в Prisma schema: `prisma generate` + `prisma db push`
