import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'

export const dynamic = 'force-dynamic'

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
    const adapter = new PrismaNeon(pool)
    const prisma = new PrismaClient({ adapter })

    try {
      // Create admin user
      const admin = await prisma.user.create({
        data: {
          email: 'admin@ai-trainer.dev',
          name: 'Admin',
          role: 'admin',
          xp: 2500,
          level: 5,
          streak: 12,
          maxStreak: 15,
          lastActiveAt: new Date(),
        },
      })

      // Create demo users
      const demoUsers = await Promise.all([
        prisma.user.create({ data: { email: 'ivan@demo.dev', name: 'Иван Петров', role: 'user', xp: 1800, level: 4, streak: 7, maxStreak: 10, lastActiveAt: new Date() } }),
        prisma.user.create({ data: { email: 'maria@demo.dev', name: 'Мария Сидорова', role: 'user', xp: 3200, level: 6, streak: 21, maxStreak: 21, lastActiveAt: new Date() } }),
        prisma.user.create({ data: { email: 'alex@demo.dev', name: 'Алексей Козлов', role: 'user', xp: 950, level: 3, streak: 3, maxStreak: 8, lastActiveAt: new Date() } }),
        prisma.user.create({ data: { email: 'elena@demo.dev', name: 'Елена Новикова', role: 'user', xp: 4200, level: 7, streak: 30, maxStreak: 30, lastActiveAt: new Date() } }),
        prisma.user.create({ data: { email: 'dmitry@demo.dev', name: 'Дмитрий Волков', role: 'user', xp: 600, level: 2, streak: 1, maxStreak: 5, lastActiveAt: new Date() } }),
      ])

      // Create Skills
      const skills = await Promise.all([
        prisma.skill.create({ data: { name: 'Prompt Engineering', slug: 'prompt-engineering', description: 'Искусство написания эффективных промптов для AI-моделей', icon: '✍️', category: 'prompting', order: 1, requiredXp: 200 } }),
        prisma.skill.create({ data: { name: 'AI Агенты', slug: 'ai-agents', description: 'Создание и настройка AI-агентов для автоматизации задач', icon: '🤖', category: 'agents', order: 2, requiredXp: 300 } }),
        prisma.skill.create({ data: { name: 'Cursor', slug: 'cursor', description: 'AI-ассистент для программирования в IDE', icon: '🖱️', category: 'tools', order: 3, requiredXp: 250 } }),
        prisma.skill.create({ data: { name: 'Claude Code', slug: 'claude-code', description: 'Использование Claude для написания и анализа кода', icon: '🧠', category: 'tools', order: 4, requiredXp: 250 } }),
        prisma.skill.create({ data: { name: 'OpenAI API', slug: 'openai-api', description: 'Интеграция OpenAI API в проекты', icon: '🔮', category: 'tools', order: 5, requiredXp: 300 } }),
        prisma.skill.create({ data: { name: 'MCP', slug: 'mcp', description: 'Model Context Protocol — подключение контекста к AI', icon: '🔌', category: 'tools', order: 6, requiredXp: 200 } }),
        prisma.skill.create({ data: { name: 'RAG', slug: 'rag', description: 'Retrieval-Augmented Generation для обогащения ответов AI', icon: '📚', category: 'automation', order: 7, requiredXp: 300 } }),
        prisma.skill.create({ data: { name: 'AI Code Review', slug: 'ai-code-review', description: 'Автоматический код-ревью с помощью AI', icon: '👀', category: 'review', order: 8, requiredXp: 200 } }),
        prisma.skill.create({ data: { name: 'AI Автоматизация', slug: 'ai-automation', description: 'Автоматизация рутинных задач с помощью AI', icon: '⚡', category: 'automation', order: 9, requiredXp: 250 } }),
        prisma.skill.create({ data: { name: 'AI для 1С', slug: 'ai-for-1c', description: 'Применение AI в разработке на платформе 1С:Предприятие', icon: '🖥️', category: '1c', order: 10, requiredXp: 300 } }),
      ])

      // Create Achievements
      const achievements = await Promise.all([
        prisma.achievement.create({ data: { name: 'Первый шаг', slug: 'first-challenge', description: 'Реши первую задачу', icon: '🎯', category: 'challenges', requirement: '{"type":"challenges","count":1}', xpReward: 50 } }),
        prisma.achievement.create({ data: { name: '10 задач', slug: '10-challenges', description: 'Реши 10 задач', icon: '🔥', category: 'challenges', requirement: '{"type":"challenges","count":10}', xpReward: 200 } }),
        prisma.achievement.create({ data: { name: '50 задач', slug: '50-challenges', description: 'Реши 50 задач', icon: '💎', category: 'challenges', requirement: '{"type":"challenges","count":50}', xpReward: 500 } }),
        prisma.achievement.create({ data: { name: 'Неделя огня', slug: '7-day-streak', description: 'Поддержи серию 7 дней подряд', icon: '🔥', category: 'streak', requirement: '{"type":"streak","count":7}', xpReward: 200 } }),
        prisma.achievement.create({ data: { name: 'Месяц дисциплины', slug: '30-day-streak', description: 'Поддержи серию 30 дней подряд', icon: '👑', category: 'streak', requirement: '{"type":"streak","count":30}', xpReward: 1000 } }),
        prisma.achievement.create({ data: { name: 'Мастер промптов', slug: 'prompt-master', description: 'Достигни 5 уровня в Prompt Engineering', icon: '✍️', category: 'skills', requirement: '{"type":"skill_level","skill":"prompt-engineering","level":5}', xpReward: 300 } }),
        prisma.achievement.create({ data: { name: 'Создатель агентов', slug: 'agent-builder', description: 'Достигни 3 уровня в AI Агентах', icon: '🤖', category: 'skills', requirement: '{"type":"skill_level","skill":"ai-agents","level":3}', xpReward: 200 } }),
        prisma.achievement.create({ data: { name: 'Охотник за багами', slug: 'bug-hunter', description: 'Реши 5 задач по дебаггингу', icon: '🐛', category: 'special', requirement: '{"type":"category_challenges","category":"debugging","count":5}', xpReward: 150 } }),
        prisma.achievement.create({ data: { name: 'Детектор галлюцинаций', slug: 'hallucination-detector', description: 'Найди все ошибки в AI-генерированном коде', icon: '🕵️', category: 'special', requirement: '{"type":"special","name":"hallucination"}', xpReward: 250 } }),
        prisma.achievement.create({ data: { name: '1С AI Эксперт', slug: '1c-ai-expert', description: 'Достигни 5 уровня в AI для 1С', icon: '🏆', category: 'special', requirement: '{"type":"skill_level","skill":"ai-for-1c","level":5}', xpReward: 500 } }),
        prisma.achievement.create({ data: { name: 'Cursor мастер', slug: 'cursor-master', description: 'Достигни 3 уровня в навыке Cursor', icon: '🖱️', category: 'skills', requirement: '{"type":"skill_level","skill":"cursor","level":3}', xpReward: 200 } }),
        prisma.achievement.create({ data: { name: 'RAG специалист', slug: 'rag-specialist', description: 'Достигни 3 уровня в RAG', icon: '📚', category: 'skills', requirement: '{"type":"skill_level","skill":"rag","level":3}', xpReward: 200 } }),
        prisma.achievement.create({ data: { name: 'Автоматизатор', slug: 'automator', description: 'Достигни 3 уровня в AI Автоматизации', icon: '⚡', category: 'skills', requirement: '{"type":"skill_level","skill":"ai-automation","level":3}', xpReward: 200 } }),
        prisma.achievement.create({ data: { name: 'Ревьюер кода', slug: 'code-reviewer', description: 'Достигни 3 уровня в AI Code Review', icon: '👀', category: 'skills', requirement: '{"type":"skill_level","skill":"ai-code-review","level":3}', xpReward: 200 } }),
        prisma.achievement.create({ data: { name: 'MCP подключатель', slug: 'mcp-connector', description: 'Достигни 3 уровня в MCP', icon: '🔌', category: 'skills', requirement: '{"type":"skill_level","skill":"mcp","level":3}', xpReward: 200 } }),
      ])

      // Create core challenges (first batch - Prompt Engineering)
      const challengeData = [
        { title: 'Какой prompt лучше для генерации кода?', description: 'Выбери наиболее эффективный промпт для генерации кода обработки 1С', difficulty: 'easy', type: 'multiple_choice', category: 'prompting', xpReward: 25, content: JSON.stringify({ text: 'Какой промпт даст лучший результат при генерации кода обработки 1С для массового обновления цен?' }), options: JSON.stringify(['Напиши код', 'Сгенерируй обработку 1С 8.3 для массового обновления цен номенклатуры с формой выбора каталога и кнопкой выполнения', 'Помоги с кодом', 'Сделай обработку для цен']), correctAnswer: JSON.stringify('1'), explanation: 'Эффективный промпт содержит: платформу, конкретную задачу, описание формы и необходимых элементов.', validationType: 'static', skillId: skills[0].id, order: 1 },
        { title: 'Структура идеального промпта', description: 'Определи правильную структуру промпта для AI', difficulty: 'easy', type: 'multiple_choice', category: 'prompting', xpReward: 25, content: JSON.stringify({ text: 'Какая структура промпта является наиболее эффективной?' }), options: JSON.stringify(['Вопрос → Контекст → Формат ответа → Пример', 'Просто описать что нужно', 'Копировать чужой промпт', 'Написать как можно больше текста']), correctAnswer: JSON.stringify('0'), explanation: 'Структура «Вопрос → Контекст → Формат → Пример» даёт AI максимум информации для точного ответа.', validationType: 'static', skillId: skills[0].id, order: 2 },
        { title: 'Исправь плохой промпт', description: 'Улучши промпт для генерации отчёта в 1С', difficulty: 'medium', type: 'prompt_fix', category: 'prompting', xpReward: 50, content: JSON.stringify({ text: 'Улучши следующий промпт для генерации отчёта в 1С:', originalPrompt: 'Сделай отчёт' }), options: null, correctAnswer: JSON.stringify('отчёт'), validationType: 'pattern', validationConfig: JSON.stringify({ keywords: ['1С', 'отчёт', 'платформ', '8.3', 'СКД', 'форма', 'период', 'фильтр'] }), explanation: 'Хороший промпт для отчёта 1С должен содержать: версию платформы, источник данных, поля вывода, фильтры и группировки.', hints: JSON.stringify(['Укажи платформу и версию', 'Опиши какие данные нужны', 'Укажи фильтры и группировки']), skillId: skills[0].id, order: 3 },
        { title: 'Few-shot prompting', description: 'Как правильно использовать примеры в промпте', difficulty: 'medium', type: 'multiple_choice', category: 'prompting', xpReward: 50, content: JSON.stringify({ text: 'Что такое few-shot prompting и когда его лучше использовать?' }), options: JSON.stringify(['Предоставление нескольких примеров вход/выход в промпте для задания формата ответа', 'Использование нескольких AI моделей одновременно', 'Повторение одного промпта несколько раз', 'Короткий промпт из нескольких слов']), correctAnswer: JSON.stringify('0'), explanation: 'Few-shot prompting — это техника, когда в промпт включаются примеры желаемого формата ответа.', validationType: 'static', skillId: skills[0].id, order: 4 },
        { title: 'Chain of Thought промптинг', description: 'Как заставить AI рассуждать пошагово', difficulty: 'medium', type: 'multiple_choice', category: 'prompting', xpReward: 50, content: JSON.stringify({ text: 'Какая фраза в промпте лучше всего активирует chain-of-thought рассуждение?' }), options: JSON.stringify(['Подумай пошагово', 'Ответь быстро', 'Дай краткий ответ', 'Скопируй из документации']), correctAnswer: JSON.stringify('0'), explanation: 'Фраза «Подумай пошагово» активирует цепочку рассуждений, что улучшает качество ответов на сложные задачи.', validationType: 'static', skillId: skills[0].id, order: 5 },
        { title: 'Температура модели', description: 'Выбери правильную температуру для задачи', difficulty: 'easy', type: 'multiple_choice', category: 'prompting', xpReward: 25, content: JSON.stringify({ text: 'Какую температуру модели лучше выбрать для генерации кода обработки 1С?' }), options: JSON.stringify(['0 (максимальная точность)', '0.5 (баланс)', '1.0 (креативность)', '2.0 (максимальная случайность)']), correctAnswer: JSON.stringify('0'), explanation: 'Для генерации кода нужна температура 0 — максимальная детерминированность и точность.', validationType: 'static', skillId: skills[0].id, order: 6 },
        { title: 'Системный промпт vs Пользовательский', description: 'В чём разница и когда использовать каждый', difficulty: 'easy', type: 'multiple_choice', category: 'prompting', xpReward: 25, content: JSON.stringify({ text: 'Какое утверждение о системном и пользовательском промптах верное?' }), options: JSON.stringify(['Системный задаёт поведение AI, пользовательский — конкретный запрос', 'Системный промпт — это промпт от системы, пользовательский — от человека', 'Они одинаковые, разница только в названии', 'Системный промпт длиннее пользовательского']), correctAnswer: JSON.stringify('0'), explanation: 'Системный промпт задаёт роль, контекст и ограничения AI. Пользовательский — конкретный запрос.', validationType: 'static', skillId: skills[0].id, order: 7 },
        { title: 'Промпт-инъекция', description: 'Как защитить промпт от злоумышленников', difficulty: 'hard', type: 'multiple_choice', category: 'prompting', xpReward: 100, content: JSON.stringify({ text: 'Что такое prompt injection и как от неё защититься?' }), options: JSON.stringify(['Внедрение вредоносных инструкций в пользовательский ввод; защита — валидация и разделение контекстов', 'Ошибка в написании промпта', 'Слишком длинный промпт', 'Использование чужого промпта']), correctAnswer: JSON.stringify('0'), explanation: 'Prompt injection — атака, когда в пользовательский ввод встраиваются инструкции, пытающиеся изменить поведение AI.', validationType: 'static', skillId: skills[0].id, order: 8 },
        { title: 'Что такое AI-агент?', description: 'Основные концепции AI-агентов', difficulty: 'easy', type: 'multiple_choice', category: 'agents', xpReward: 25, content: JSON.stringify({ text: 'Какое определение AI-агента наиболее точное?' }), options: JSON.stringify(['Автономная система, воспринимающая среду и действующая для достижения целей', 'Просто чат-бот с API', 'Программа на Python', 'Плагин для браузера']), correctAnswer: JSON.stringify('0'), explanation: 'AI-агент — это автономная система, которая воспринимает среду и действует для достижения определённых целей.', validationType: 'static', skillId: skills[1].id, order: 9 },
        { title: 'Компоненты AI-агента', description: 'Расставь компоненты AI-агента в правильном порядке', difficulty: 'medium', type: 'ordering', category: 'agents', xpReward: 50, content: JSON.stringify({ text: 'Расставь этапы работы AI-агента в правильном порядке:' }), options: JSON.stringify(['Восприятие среды', 'Анализ и планирование', 'Принятие решения', 'Выполнение действия', 'Оценка результата']), correctAnswer: JSON.stringify([0, 1, 2, 3, 4]), explanation: 'Цикл AI-агента: восприятие → анализ → решение → действие → оценка.', validationType: 'static', skillId: skills[1].id, order: 10 },
        { title: 'ReAct паттерн', description: 'Как работает паттерн Reasoning + Acting', difficulty: 'hard', type: 'multiple_choice', category: 'agents', xpReward: 100, content: JSON.stringify({ text: 'В чём суть паттерна ReAct для AI-агентов?' }), options: JSON.stringify(['Чередование рассуждений и действий с наблюдением результатов каждого шага', 'Быстрые реакции на запросы', 'Использование только reasoning без действий', 'Параллельное выполнение задач']), correctAnswer: JSON.stringify('0'), explanation: 'ReAct — паттерн, при котором агент чередует рассуждения с конкретными действиями.', validationType: 'static', skillId: skills[1].id, order: 11 },
        { title: 'Ограничения AI-агентов', description: 'Что НЕ может AI-агент', difficulty: 'medium', type: 'multiple_choice', category: 'agents', xpReward: 50, content: JSON.stringify({ text: 'Какое ограничение AI-агентов является наиболее критичным при работе с 1С?' }), options: JSON.stringify(['Галлюцинации — генерация несуществующих методов и объектов 1С', 'Низкая скорость работы', 'Отсутствие русского языка', 'Невозможность работы с API']), correctAnswer: JSON.stringify('0'), explanation: 'Галлюцинации — главная проблема AI-агентов при работе с 1С.', validationType: 'static', skillId: skills[1].id, order: 12 },
        { title: 'Cursor: режимы работы', description: 'Какие режимы Cursor эффективны для 1С', difficulty: 'easy', type: 'multiple_choice', category: 'tools', xpReward: 25, content: JSON.stringify({ text: 'Какой режим Cursor лучше всего подходит для рефакторинга большого модуля 1С?' }), options: JSON.stringify(['Composer — для комплексных изменений нескольких файлов', 'Chat — для быстрых вопросов', 'Inline edit — для мелких правок', 'Terminal — для команд']), correctAnswer: JSON.stringify('0'), explanation: 'Composer позволяет AI видеть контекст нескольких файлов и делать согласованные изменения.', validationType: 'static', skillId: skills[2].id, order: 13 },
        { title: 'Cursor: контекст для 1С', description: 'Как правильно предоставить контекст о проекте 1С', difficulty: 'medium', type: 'multiple_choice', category: 'tools', xpReward: 50, content: JSON.stringify({ text: 'Как лучше всего дать Cursor контекст о структуре конфигурации 1С?' }), options: JSON.stringify(['Добавить .cursorrules с описанием структуры конфигурации и стандартов кодирования', 'Объяснять каждый раз в чате', 'Ничего не делать', 'Удалить все файлы проекта']), correctAnswer: JSON.stringify('0'), explanation: 'Файл .cursorrules позволяет задать постоянный контекст: стандарты кодирования, структура конфигурации.', validationType: 'static', skillId: skills[2].id, order: 14 },
        { title: 'OpenAI API: базовые концепции', description: 'Как работает OpenAI API', difficulty: 'easy', type: 'multiple_choice', category: 'tools', xpReward: 25, content: JSON.stringify({ text: 'Какой эндпоинт OpenAI API используется для чат-комплитий?' }), options: JSON.stringify(['/v1/chat/completions', '/v1/completions', '/v1/generate', '/v1/ask']), correctAnswer: JSON.stringify('0'), explanation: '/v1/chat/completions — основной эндпоинт для чат-моделей.', validationType: 'static', skillId: skills[4].id, order: 15 },
        { title: 'MCP: что это и зачем', description: 'Model Context Protocol — подключение контекста к AI', difficulty: 'easy', type: 'multiple_choice', category: 'tools', xpReward: 25, content: JSON.stringify({ text: 'Что такое MCP (Model Context Protocol)?' }), options: JSON.stringify(['Открытый протокол для подключения внешних данных и инструментов к AI-моделям', 'Протокол передачи данных в 1С', 'Язык программирования', 'Формат файла конфигурации']), correctAnswer: JSON.stringify('0'), explanation: 'MCP — это открытый протокол от Anthropic, который позволяет AI-моделям подключаться к внешним источникам данных.', validationType: 'static', skillId: skills[5].id, order: 16 },
        { title: 'RAG: базовые концепции', description: 'Retrieval-Augmented Generation для 1С', difficulty: 'medium', type: 'multiple_choice', category: 'automation', xpReward: 50, content: JSON.stringify({ text: 'Что такое RAG и чем он полезен для 1С-разработчика?' }), options: JSON.stringify(['Техника обогащения ответов AI поиском по базе знаний; позволяет AI отвечать на основе документации 1С', 'Новый язык программирования', 'Система контроля версий', 'Фреймворк для тестирования']), correctAnswer: JSON.stringify('0'), explanation: 'RAG позволяет AI искать релевантную информацию в базе знаний перед генерацией ответа.', validationType: 'static', skillId: skills[6].id, order: 17 },
        { title: 'AI Code Review: преимущества', description: 'Зачем использовать AI для код-ревью', difficulty: 'medium', type: 'multiple_choice', category: 'review', xpReward: 50, content: JSON.stringify({ text: 'Какое главное преимущество AI-ассистированного код-ревью по сравнению с ручным?' }), options: JSON.stringify(['Мгновенный анализ 24/7 с покрытием всего кода, а не выборочных мест', 'AI всегда прав', 'Полная замена ручного ревью', 'Бесплатность']), correctAnswer: JSON.stringify('0'), explanation: 'AI-ревью обеспечивает мгновенный анализ всего кода без ограничений по времени и вниманию.', validationType: 'static', skillId: skills[7].id, order: 18 },
        { title: 'AI для 1С: интеграция ChatGPT', description: 'Как подключить ChatGPT к обработке 1С', difficulty: 'hard', type: 'multiple_choice', category: '1c', xpReward: 100, content: JSON.stringify({ text: 'Какой первый шаг для интеграции ChatGPT в обработку 1С?' }), options: JSON.stringify(['Получить API-ключ OpenAI и создать HTTPСоединение в 1С', 'Установить ChatGPT на сервер 1С', 'Написать промпт и отправить email', 'Использовать COM-объект']), correctAnswer: JSON.stringify('0'), explanation: 'Первый шаг: получить API-ключ OpenAI и создать HTTPСоединение для отправки запросов.', validationType: 'static', skillId: skills[9].id, order: 19 },
        { title: 'Промпт для AI-агента анализа ТЗ', description: 'Напиши промпт для AI-агента, который анализирует технические задания', difficulty: 'hard', type: 'prompt_fix', category: 'prompting', xpReward: 100, content: JSON.stringify({ text: 'Напиши системный промпт для AI-агента, который анализирует ТЗ на разработку 1С и выделяет: сущности, связи, требования к формам, ограничения', originalPrompt: 'Анализируй ТЗ' }), options: null, correctAnswer: JSON.stringify('агент'), validationType: 'pattern', validationConfig: JSON.stringify({ keywords: ['роль', 'формат', 'сущности', 'связи', 'требования', 'ограничения', '1С'] }), explanation: 'Системный промпт для агента должен определять: роль, контекст, формат ответа, задачи и ограничения.', hints: JSON.stringify(['Определи роль AI-агента', 'Задай структуру анализа', 'Укажи формат выходных данных']), skillId: skills[0].id, order: 20 },
      ]

      const challenges = await Promise.all(
        challengeData.map(c => prisma.challenge.create({ data: c }))
      )

      return NextResponse.json({
        success: true,
        message: 'Database seeded successfully',
        stats: {
          users: 1 + demoUsers.length,
          skills: skills.length,
          achievements: achievements.length,
          challenges: challenges.length,
        },
      })
    } finally {
      await prisma.$disconnect()
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
