import { NextResponse } from 'next/server'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

export const dynamic = 'force-dynamic'

// Generate a CUID-like ID
function genId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const adminSecret = process.env.NEXTAUTH_SECRET
    if (body.secret !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 })
    }

    neonConfig.webSocketConstructor = ws
    const pool = new Pool({ connectionString: databaseUrl })
    const client = await pool.connect()

    try {
      // 1. Create users
      const adminId = genId()
      const userIds = [adminId, ...Array.from({ length: 5 }, () => genId())]

      await client.query(`
        INSERT INTO users (id, email, name, role, xp, level, streak, "maxStreak", "lastActiveAt") VALUES
        ($1, 'admin@ai-trainer.dev', 'Admin', 'admin', 2500, 5, 12, 15, NOW()),
        ($2, 'ivan@demo.dev', 'Иван Петров', 'user', 1800, 4, 7, 10, NOW()),
        ($3, 'maria@demo.dev', 'Мария Сидорова', 'user', 3200, 6, 21, 21, NOW()),
        ($4, 'alex@demo.dev', 'Алексей Козлов', 'user', 950, 3, 3, 8, NOW()),
        ($5, 'elena@demo.dev', 'Елена Новикова', 'user', 4200, 7, 30, 30, NOW()),
        ($6, 'dmitry@demo.dev', 'Дмитрий Волков', 'user', 600, 2, 1, 5, NOW())
        ON CONFLICT (email) DO NOTHING
      `, userIds)

      // 2. Create skills
      const skillIds = Array.from({ length: 10 }, () => genId())
      await client.query(`
        INSERT INTO skills (id, name, slug, description, icon, category, "order", "requiredXp") VALUES
        ($1, 'Prompt Engineering', 'prompt-engineering', 'Искусство написания эффективных промптов для AI-моделей', '✍️', 'prompting', 1, 200),
        ($2, 'AI Агенты', 'ai-agents', 'Создание и настройка AI-агентов для автоматизации задач', '🤖', 'agents', 2, 300),
        ($3, 'Cursor', 'cursor', 'AI-ассистент для программирования в IDE', '🖱️', 'tools', 3, 250),
        ($4, 'Claude Code', 'claude-code', 'Использование Claude для написания и анализа кода', '🧠', 'tools', 4, 250),
        ($5, 'OpenAI API', 'openai-api', 'Интеграция OpenAI API в проекты', '🔮', 'tools', 5, 300),
        ($6, 'MCP', 'mcp', 'Model Context Protocol — подключение контекста к AI', '🔌', 'tools', 6, 200),
        ($7, 'RAG', 'rag', 'Retrieval-Augmented Generation для обогащения ответов AI', '📚', 'automation', 7, 300),
        ($8, 'AI Code Review', 'ai-code-review', 'Автоматический код-ревью с помощью AI', '👀', 'review', 8, 200),
        ($9, 'AI Автоматизация', 'ai-automation', 'Автоматизация рутинных задач с помощью AI', '⚡', 'automation', 9, 250),
        ($10, 'AI для 1С', 'ai-for-1c', 'Применение AI в разработке на платформе 1С:Предприятие', '🖥️', '1c', 10, 300)
        ON CONFLICT (slug) DO NOTHING
      `, skillIds)

      // 3. Create achievements
      const achIds = Array.from({ length: 15 }, () => genId())
      await client.query(`
        INSERT INTO achievements (id, name, slug, description, icon, category, requirement, "xpReward") VALUES
        ($1, 'Первый шаг', 'first-challenge', 'Реши первую задачу', '🎯', 'challenges', '{"type":"challenges","count":1}', 50),
        ($2, '10 задач', '10-challenges', 'Реши 10 задач', '🔥', 'challenges', '{"type":"challenges","count":10}', 200),
        ($3, '50 задач', '50-challenges', 'Реши 50 задач', '💎', 'challenges', '{"type":"challenges","count":50}', 500),
        ($4, 'Неделя огня', '7-day-streak', 'Поддержи серию 7 дней подряд', '🔥', 'streak', '{"type":"streak","count":7}', 200),
        ($5, 'Месяц дисциплины', '30-day-streak', 'Поддержи серию 30 дней подряд', '👑', 'streak', '{"type":"streak","count":30}', 1000),
        ($6, 'Мастер промптов', 'prompt-master', 'Достигни 5 уровня в Prompt Engineering', '✍️', 'skills', '{"type":"skill_level","skill":"prompt-engineering","level":5}', 300),
        ($7, 'Создатель агентов', 'agent-builder', 'Достигни 3 уровня в AI Агентах', '🤖', 'skills', '{"type":"skill_level","skill":"ai-agents","level":3}', 200),
        ($8, 'Охотник за багами', 'bug-hunter', 'Реши 5 задач по дебаггингу', '🐛', 'special', '{"type":"category_challenges","category":"debugging","count":5}', 150),
        ($9, 'Детектор галлюцинаций', 'hallucination-detector', 'Найди все ошибки в AI-генерированном коде', '🕵️', 'special', '{"type":"special","name":"hallucination"}', 250),
        ($10, '1С AI Эксперт', '1c-ai-expert', 'Достигни 5 уровня в AI для 1С', '🏆', 'special', '{"type":"skill_level","skill":"ai-for-1c","level":5}', 500),
        ($11, 'Cursor мастер', 'cursor-master', 'Достигни 3 уровня в навыке Cursor', '🖱️', 'skills', '{"type":"skill_level","skill":"cursor","level":3}', 200),
        ($12, 'RAG специалист', 'rag-specialist', 'Достигни 3 уровня в RAG', '📚', 'skills', '{"type":"skill_level","skill":"rag","level":3}', 200),
        ($13, 'Автоматизатор', 'automator', 'Достигни 3 уровня в AI Автоматизации', '⚡', 'skills', '{"type":"skill_level","skill":"ai-automation","level":3}', 200),
        ($14, 'Ревьюер кода', 'code-reviewer', 'Достигни 3 уровня в AI Code Review', '👀', 'skills', '{"type":"skill_level","skill":"ai-code-review","level":3}', 200),
        ($15, 'MCP подключатель', 'mcp-connector', 'Достигни 3 уровня в MCP', '🔌', 'skills', '{"type":"skill_level","skill":"mcp","level":3}', 200)
        ON CONFLICT (slug) DO NOTHING
      `, achIds)

      // 4. Create challenges - batch with raw SQL for speed
      const challenges = [
        [genId(), 'Какой prompt лучше для генерации кода?', 'Выбери наиболее эффективный промпт для генерации кода обработки 1С', 'easy', 'multiple_choice', 'prompting', 25, '{"text":"Какой промпт даст лучший результат при генерации кода обработки 1С для массового обновления цен?"}', '["Напиши код","Сгенерируй обработку 1С 8.3 для массового обновления цен номенклатуры с формой выбора каталога и кнопкой выполнения","Помоги с кодом","Сделай обработку для цен"]', '"1"', 'Эффективный промпт содержит: платформу, конкретную задачу, описание формы и необходимых элементов.', null, 'static', null, skillIds[0], 1],
        [genId(), 'Структура идеального промпта', 'Определи правильную структуру промпта для AI', 'easy', 'multiple_choice', 'prompting', 25, '{"text":"Какая структура промпта является наиболее эффективной?"}', '["Вопрос → Контекст → Формат ответа → Пример","Просто описать что нужно","Копировать чужой промпт","Написать как можно больше текста"]', '"0"', 'Структура «Вопрос → Контекст → Формат → Пример» даёт AI максимум информации для точного ответа.', null, 'static', null, skillIds[0], 2],
        [genId(), 'Исправь плохой промпт', 'Улучши промпт для генерации отчёта в 1С', 'medium', 'prompt_fix', 'prompting', 50, '{"text":"Улучши следующий промпт для генерации отчёта в 1С:","originalPrompt":"Сделай отчёт"}', null, '"отчёт"', 'Хороший промпт для отчёта 1С должен содержать: версию платформы, источник данных, поля вывода, фильтры и группировки.', '["Укажи платформу и версию","Опиши какие данные нужны","Укажи фильтры и группировки"]', 'pattern', '{"keywords":["1С","отчёт","платформ","8.3","СКД","форма","период","фильтр"]}', skillIds[0], 3],
        [genId(), 'Few-shot prompting', 'Как правильно использовать примеры в промпте', 'medium', 'multiple_choice', 'prompting', 50, '{"text":"Что такое few-shot prompting и когда его лучше использовать?"}', '["Предоставление нескольких примеров вход/выход в промпте для задания формата ответа","Использование нескольких AI моделей одновременно","Повторение одного промпта несколько раз","Короткий промпт из нескольких слов"]', '"0"', 'Few-shot prompting — это техника, когда в промпт включаются примеры желаемого формата ответа.', null, 'static', null, skillIds[0], 4],
        [genId(), 'Chain of Thought промптинг', 'Как заставить AI рассуждать пошагово', 'medium', 'multiple_choice', 'prompting', 50, '{"text":"Какая фраза в промпте лучше всего активирует chain-of-thought рассуждение?"}', '["Подумай пошагово","Ответь быстро","Дай краткий ответ","Скопируй из документации"]', '"0"', 'Фраза «Подумай пошагово» активирует цепочку рассуждений, что улучшает качество ответов на сложные задачи.', null, 'static', null, skillIds[0], 5],
        [genId(), 'Температура модели', 'Выбери правильную температуру для задачи', 'easy', 'multiple_choice', 'prompting', 25, '{"text":"Какую температуру модели лучше выбрать для генерации кода обработки 1С?"}', '["0 (максимальная точность)","0.5 (баланс)","1.0 (креативность)","2.0 (максимальная случайность)"]', '"0"', 'Для генерации кода нужна температура 0 — максимальная детерминированность и точность.', null, 'static', null, skillIds[0], 6],
        [genId(), 'Системный промпт vs Пользовательский', 'В чём разница и когда использовать каждый', 'easy', 'multiple_choice', 'prompting', 25, '{"text":"Какое утверждение о системном и пользовательском промптах верное?"}', '["Системный задаёт поведение AI, пользовательский — конкретный запрос","Системный промпт — это промпт от системы, пользовательский — от человека","Они одинаковые, разница только в названии","Системный промпт длиннее пользовательского"]', '"0"', 'Системный промпт задаёт роль, контекст и ограничения AI. Пользовательский — конкретный запрос.', null, 'static', null, skillIds[0], 7],
        [genId(), 'Промпт-инъекция', 'Как защитить промпт от злоумышленников', 'hard', 'multiple_choice', 'prompting', 100, '{"text":"Что такое prompt injection и как от неё защититься?"}', '["Внедрение вредоносных инструкций в пользовательский ввод; защита — валидация и разделение контекстов","Ошибка в написании промпта","Слишком длинный промпт","Использование чужого промпта"]', '"0"', 'Prompt injection — атака, когда в пользовательский ввод встраиваются инструкции, пытающиеся изменить поведение AI.', null, 'static', null, skillIds[0], 8],
        [genId(), 'Что такое AI-агент?', 'Основные концепции AI-агентов', 'easy', 'multiple_choice', 'agents', 25, '{"text":"Какое определение AI-агента наиболее точное?"}', '["Автономная система, воспринимающая среду и действующая для достижения целей","Просто чат-бот с API","Программа на Python","Плагин для браузера"]', '"0"', 'AI-агент — это автономная система, которая воспринимает среду и действует для достижения целей.', null, 'static', null, skillIds[1], 9],
        [genId(), 'Компоненты AI-агента', 'Расставь компоненты AI-агента в правильном порядке', 'medium', 'ordering', 'agents', 50, '{"text":"Расставь этапы работы AI-агента в правильном порядке:"}', '["Восприятие среды","Анализ и планирование","Принятие решения","Выполнение действия","Оценка результата"]', '[0,1,2,3,4]', 'Цикл AI-агента: восприятие → анализ → решение → действие → оценка.', null, 'static', null, skillIds[1], 10],
        [genId(), 'ReAct паттерн', 'Как работает паттерн Reasoning + Acting', 'hard', 'multiple_choice', 'agents', 100, '{"text":"В чём суть паттерна ReAct для AI-агентов?"}', '["Чередование рассуждений и действий с наблюдением результатов каждого шага","Быстрые реакции на запросы","Использование только reasoning без действий","Параллельное выполнение задач"]', '"0"', 'ReAct — паттерн, при котором агент чередует рассуждения с конкретными действиями.', null, 'static', null, skillIds[1], 11],
        [genId(), 'Ограничения AI-агентов', 'Что НЕ может AI-агент', 'medium', 'multiple_choice', 'agents', 50, '{"text":"Какое ограничение AI-агентов является наиболее критичным при работе с 1С?"}', '["Галлюцинации — генерация несуществующих методов и объектов 1С","Низкая скорость работы","Отсутствие русского языка","Невозможность работы с API"]', '"0"', 'Галлюцинации — главная проблема AI-агентов при работе с 1С.', null, 'static', null, skillIds[1], 12],
        [genId(), 'Cursor: режимы работы', 'Какие режимы Cursor эффективны для 1С', 'easy', 'multiple_choice', 'tools', 25, '{"text":"Какой режим Cursor лучше всего подходит для рефакторинга большого модуля 1С?"}', '["Composer — для комплексных изменений нескольких файлов","Chat — для быстрых вопросов","Inline edit — для мелких правок","Terminal — для команд"]', '"0"', 'Composer позволяет AI видеть контекст нескольких файлов и делать согласованные изменения.', null, 'static', null, skillIds[2], 13],
        [genId(), 'OpenAI API: базовые концепции', 'Как работает OpenAI API', 'easy', 'multiple_choice', 'tools', 25, '{"text":"Какой эндпоинт OpenAI API используется для чат-комплитий?"}', '["/v1/chat/completions","/v1/completions","/v1/generate","/v1/ask"]', '"0"', '/v1/chat/completions — основной эндпоинт для чат-моделей.', null, 'static', null, skillIds[4], 14],
        [genId(), 'MCP: что это и зачем', 'Model Context Protocol — подключение контекста к AI', 'easy', 'multiple_choice', 'tools', 25, '{"text":"Что такое MCP (Model Context Protocol)?"}', '["Открытый протокол для подключения внешних данных и инструментов к AI-моделям","Протокол передачи данных в 1С","Язык программирования","Формат файла конфигурации"]', '"0"', 'MCP — это открытый протокол от Anthropic для подключения AI к внешним источникам данных.', null, 'static', null, skillIds[5], 15],
        [genId(), 'RAG: базовые концепции', 'Retrieval-Augmented Generation для 1С', 'medium', 'multiple_choice', 'automation', 50, '{"text":"Что такое RAG и чем он полезен для 1С-разработчика?"}', '["Техника обогащения ответов AI поиском по базе знаний; позволяет AI отвечать на основе документации 1С","Новый язык программирования","Система контроля версий","Фреймворк для тестирования"]', '"0"', 'RAG позволяет AI искать релевантную информацию в базе знаний перед генерацией ответа.', null, 'static', null, skillIds[6], 16],
        [genId(), 'AI для 1С: интеграция ChatGPT', 'Как подключить ChatGPT к обработке 1С', 'hard', 'multiple_choice', '1c', 100, '{"text":"Какой первый шаг для интеграции ChatGPT в обработку 1С?"}', '["Получить API-ключ OpenAI и создать HTTPСоединение в 1С","Установить ChatGPT на сервер 1С","Написать промпт и отправить email","Использовать COM-объект"]', '"0"', 'Первый шаг: получить API-ключ OpenAI и создать HTTPСоединение для отправки запросов.', null, 'static', null, skillIds[9], 17],
        [genId(), 'AI Code Review: преимущества', 'Зачем использовать AI для код-ревью', 'medium', 'multiple_choice', 'review', 50, '{"text":"Какое главное преимущество AI-ассистированного код-ревью?"}', '["Мгновенный анализ 24/7 с покрытием всего кода","AI всегда прав","Полная замена ручного ревью","Бесплатность"]', '"0"', 'AI-ревью обеспечивает мгновенный анализ всего кода без ограничений по времени и вниманию.', null, 'static', null, skillIds[7], 18],
        [genId(), 'Cursor: контекст для 1С', 'Как правильно предоставить контекст о проекте 1С', 'medium', 'multiple_choice', 'tools', 50, '{"text":"Как лучше всего дать Cursor контекст о структуре конфигурации 1С?"}', '["Добавить .cursorrules с описанием структуры конфигурации и стандартов кодирования","Объяснять каждый раз в чате","Ничего не делать","Удалить все файлы проекта"]', '"0"', 'Файл .cursorrules позволяет задать постоянный контекст.', null, 'static', null, skillIds[2], 19],
        [genId(), 'Промпт для AI-агента анализа ТЗ', 'Напиши промпт для AI-агента, который анализирует технические задания', 'hard', 'prompt_fix', 'prompting', 100, '{"text":"Напиши системный промпт для AI-агента, который анализирует ТЗ на разработку 1С","originalPrompt":"Анализируй ТЗ"}', null, '"агент"', 'Системный промпт для агента должен определять: роль, контекст, формат ответа, задачи и ограничения.', '["Определи роль AI-агента","Задай структуру анализа","Укажи формат выходных данных"]', 'pattern', '{"keywords":["роль","формат","сущности","связи","требования","ограничения","1С"]}', skillIds[0], 20],
      ]

      // Insert challenges in batches
      for (const c of challenges) {
        await client.query(`
          INSERT INTO challenges (id, title, description, difficulty, type, category, "xpReward", content, options, "correctAnswer", explanation, hints, "validationType", "validationConfig", "skillId", "order")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT DO NOTHING
        `, c)
      }

      return NextResponse.json({
        success: true,
        message: 'Database seeded successfully',
        stats: {
          users: 6,
          skills: 10,
          achievements: 15,
          challenges: challenges.length,
        },
      })
    } finally {
      client.release()
      await pool.end()
    }
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: 'Seed failed', details: String(error) },
      { status: 500 }
    )
  }
}
