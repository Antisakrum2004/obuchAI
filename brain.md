# AI Тренажёр для 1C разработчиков — Brain Doc

## Проект
**Стек:** Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui + Prisma ORM
**Деплой:** Vercel (serverless)
**БД:** PostgreSQL (Prisma)
**Аутентификация:** NextAuth.js
**Стиль:** Тёмная glassmorphism-тема, Duolingo-подобная геймификация

---

## Архитектура

### Страницы
| Роут | Назначение |
|------|-----------|
| `/` | Landing page (маркетинг) |
| `/dashboard` | Главная — дашборд пользователя |
| `/challenges` | Список задач |
| `/marathon` | Марафон (серия задач без перерыва) |
| `/knowledge` | База знаний (курс-мап) |
| `/knowledge/materials` | Управление материалами (admin) |
| `/leaderboard` | Рейтинг |
| `/achievements` | Ачивки |
| `/profile/[id]` | Профиль пользователя |
| `/admin` | Админ-панель |

### Layout
- `AppLayout` — обёртка: sidebar (w-64) + header (h-16) + main content
- `AppSidebar` — навигация с фильтром по роли (admin/user)
- `Header` — XP-bar compact, streak, avatar
- `MobileTabBar` — нижняя навигация для мобилок

### Геймификация
- **XP и уровни:** 4 тира (emerald → purple → gold → rainbow)
- **Streak:** 4 уровня огня (3/7/14/30 дней), CSS-частицы
- **Hearts:** 3 сердца как Duolingo, таймер регенерации
- **Ачивки:** Модал разблокировки с конфетти и анимацией
- **Avatar Frames:** 6 тиров (bronze → rainbow) + admin dragon frame

### База знаний (Knowledge)
- Статьи создаются из PDF или видео (YouTube/Rutube/VK)
- **Очередь обработки:** pending → processing → done/error
- Типы очереди: content_extract, ai_metadata, glossary_extract, graph_build, course_draft
- Видео-статьи публикуются сразу (контент генерируется при создании)
- PDF-статьи проходят полный пайплайн обработки

---

## Последние изменения (v0.16+)

### Фикс видео-статей (выполнено)
1. **Статьи из видео теперь публикуются сразу** — статус `published`, `isPublished: true` при создании
2. **Очередь обработки:** видео-статьи пропускают `content_extract` (контент уже сгенерирован)
3. **Уведомления:** toast "Статья из видео создана и опубликована!"
4. **Гранулярные статусы в курс-мапе:** "Обработка" / "В очереди" / "Ошибка" вместо общего "AI обрабатывает"
5. **fix-video-articles action:** чинит застрявшие видео-статьи в продакшене

### Редизайн главной страницы (в процессе)
- Полная пересборка layout дашборда
- Спецификация:
  - Контейнер: max-w-[1600px] max-h-[920px], без скролла
  - Микро-сайдбар: w-[70px], только иконки
  - Хедер: h-[60px], название секции + XP + streak + avatar
  - Сетка: grid-cols-12 gap-5, p-5
  - Левая колонка (col-span-9): текущий урок (flex-1) + roadmap (h-[160px])
  - Правая колонка (col-span-3): активные задачи (flex-1) + heatmap (h-[150px])
  - Компактные отступы (gap-4/p-4/p-5 вместо py-12/my-10/space-y-8)

---

## Ключевые файлы
- `/src/app/dashboard/page.tsx` — дашборд
- `/src/components/layout/app-layout.tsx` — layout-обёртка
- `/src/components/layout/app-sidebar.tsx` — сайдбар
- `/src/components/layout/header.tsx` — хедер
- `/src/app/api/knowledge/ai/video-article/route.ts` — создание видео-статей
- `/src/app/api/knowledge/ai/route.ts` — AI-обработка
- `/src/app/api/knowledge/queue/route.ts` — очередь обработки
- `/src/app/knowledge/course-map/page.tsx` — курс-мап
- `/src/store/user-store.ts` — Zustand-стор пользователя
