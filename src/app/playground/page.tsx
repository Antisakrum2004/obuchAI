"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { FlaskConical, Copy, Check, Sparkles, ArrowRight, Zap, Send, Loader2, MessageSquare, Bot, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const promptTemplates = [
  {
    id: 1,
    title: "Генерация обработки 1С",
    category: "1С",
    template: `Ты — опытный 1С-разработчик. Напиши внешнюю обработку для 1С:Предприятие 8.3, которая:

**Цель:** {опиши цель обработки}

**Требования:**
- Платформа: 1С:Предприятие 8.3
- Режим: Управляемое приложение
- Язык: Русский

**Структура:**
1. Форма с реквизитами
2. Команды обработки
3. Серверные процедуры

Покажи полный код с комментариями.`,
    good: true,
  },
  {
    id: 2,
    title: "Код-ревью с AI",
    category: "Ревью",
    template: `Проведи код-ревью следующего модуля 1С. Проверь:

1. **Производительность** — оптимизация запросов, индексы
2. **Безопасность** — SQL-инъекции, права доступа
3. **Чистота кода** — именование, структура, дублирование
4. **Best practices** — стандарты 1С

Код для ревью:
\`\`\`1c
{вставь код}
\`\`\`

Укажи конкретные строки с проблемами и предложи исправления.`,
    good: true,
  },
  {
    id: 3,
    title: "Оптимизация запроса 1С",
    category: "1С",
    template: `Напиши код`,  // intentionally bad
    good: false,
    fixSuggestion: `Добавь контекст: какую задачу решает запрос, какие таблицы используются, какие условия нужны. Укажи версию платформы и объём данных.`,
  },
];

const workflowExamples = [
  {
    id: 1,
    title: "AI Code Review Pipeline",
    description: "Автоматический код-ревью через AI при каждом коммите",
    steps: ["Git commit", "Webhook trigger", "AI анализ кода", "Отчёт в PR", "Авто-исправления"],
    tools: ["GitHub Actions", "OpenAI API", "1С:EDT"],
  },
  {
    id: 2,
    title: "Генерация документации",
    description: "Автоматическая генерация документации из кода 1С",
    steps: ["Парсинг модулей", "Извлечение метаданных", "AI описание", "Формирование docs", "Публикация"],
    tools: ["1С:EDT", "Claude API", "Markdown"],
  },
  {
    id: 3,
    title: "RAG для базы знаний",
    description: "Поиск решений по базе знаний компании через AI",
    steps: ["Загрузка документов", "Векторизация", "Индексация", "Поиск по запросу", "Генерация ответа"],
    tools: ["OpenAI Embeddings", "Pinecone", "1С:Документооборот"],
  },
];

const goodBadComparisons = [
  {
    id: 1,
    bad: "Напиши код для 1С",
    good: "Напиши обработку 1С:Предприятие 8.3 для массового обновления цен номенклатуры. Используй Управляемое приложение, добавь форму с таблицей значений и кнопку 'Обновить цены'. Покажи полный код модуля объекта и формы.",
    tip: "Указывай платформу, версию, конкретную задачу и ожидаемый результат",
  },
  {
    id: 2,
    bad: "Исправь ошибку",
    good: "В запросе к регистру накопления 'Продажи' возникает ошибка 'Поле не найдено'. Вот код запроса:\n```1c\nВЫБРАТЬ Продажи.Контрагент, Продажи.Сумма ИЗ РегистрНакопления.Продажи\n```\nВерсия платформы 8.3.24. Найди причину и предложи исправление.",
    tip: "Прикладывай код ошибки, версию платформы и контекст проблемы",
  },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function PlaygroundPage() {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  // AI Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/playground/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages([...newMessages, { role: "assistant", content: data.content }]);
      } else {
        const data = await res.json().catch(() => ({}));
        setChatMessages([...newMessages, { role: "assistant", content: `❌ Ошибка: ${data.error || "Не удалось получить ответ"}` }]);
      }
    } catch {
      setChatMessages([...newMessages, { role: "assistant", content: "❌ Сетевая ошибка. Проверьте подключение." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleTemplateTry = (template: string) => {
    setChatInput(template);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl font-bold">Песочница</h1>
          </div>
          <p className="text-muted-foreground">
            Экспериментируй с промптами, изучай лучшие практики и тестируй AI-ответы
          </p>
        </motion.div>

        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/5">
            <TabsTrigger value="chat" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              💬 Попробовать
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              📝 Шаблоны
            </TabsTrigger>
            <TabsTrigger value="compare" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              ⚖️ Сравнение
            </TabsTrigger>
            <TabsTrigger value="workflows" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              🔄 Workflow
            </TabsTrigger>
          </TabsList>

          {/* AI Chat Tab */}
          <TabsContent value="chat" className="space-y-4">
            <div className="glass rounded-xl overflow-hidden flex flex-col" style={{ minHeight: "500px" }}>
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: "60vh" }}>
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-12 w-12 text-emerald-400/30 mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">Попробуй написать промпт</h3>
                    <p className="text-sm text-muted-foreground/60 max-w-md">
                      Введи свой промпт для AI-ассистента или выбери шаблон из вкладки &quot;Шаблоны&quot; и нажми &quot;Попробовать&quot;
                    </p>
                    <div className="flex gap-2 mt-4 flex-wrap justify-center">
                      {promptTemplates.filter(t => t.good).map((t) => (
                        <Button
                          key={t.id}
                          variant="outline"
                          size="sm"
                          className="text-xs border-white/10 text-muted-foreground hover:text-foreground"
                          onClick={() => handleTemplateTry(t.template)}
                        >
                          {t.title}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className="shrink-0 h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-emerald-400" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[80%] rounded-xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-emerald-500/15 text-foreground"
                        : "bg-white/5 text-foreground"
                    )}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none [&>p]:mb-2 [&>pre]:bg-black/30 [&>pre]:rounded-lg [&>pre]:p-3">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="shrink-0 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="shrink-0 h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="bg-white/5 rounded-xl px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              {/* Input */}
              <div className="border-t border-white/5 p-3">
                <div className="flex gap-2">
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSend();
                      }
                    }}
                    placeholder="Напиши промпт для AI-ассистента..."
                    className="min-h-[44px] max-h-[120px] resize-none bg-white/5 border-white/10"
                    rows={1}
                    disabled={chatLoading}
                  />
                  <Button
                    onClick={handleChatSend}
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            {promptTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`glass rounded-xl p-5 ${template.good ? "" : "border-red-500/20"}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{template.title}</h3>
                    <Badge
                      variant="outline"
                      className={
                        template.good
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      }
                    >
                      {template.good ? "Хороший" : "Плохой"}
                    </Badge>
                    <Badge variant="outline" className="bg-white/5 text-muted-foreground border-white/10">
                      {template.category}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 shrink-0 gap-1"
                      onClick={() => handleTemplateTry(template.template)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span className="text-xs">Попробовать</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      onClick={() => copyToClipboard(template.template, template.id)}
                    >
                      {copiedId === template.id ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <pre className="text-sm text-muted-foreground bg-black/30 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap font-mono">
                  {template.template}
                </pre>

                {!template.good && template.fixSuggestion && (
                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs text-amber-400 font-medium mb-1">Как улучшить:</p>
                    <p className="text-sm text-muted-foreground">{template.fixSuggestion}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </TabsContent>

          {/* Compare Tab */}
          <TabsContent value="compare" className="space-y-6">
            {goodBadComparisons.map((comp, index) => (
              <motion.div
                key={comp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-3"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Bad */}
                  <div className="glass rounded-xl p-4 border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">❌</span>
                      <span className="text-sm font-medium text-red-400">Плохой промпт</span>
                    </div>
                    <pre className="text-sm text-muted-foreground bg-black/30 rounded-lg p-3 whitespace-pre-wrap font-mono">
                      {comp.bad}
                    </pre>
                  </div>

                  {/* Good */}
                  <div className="glass rounded-xl p-4 border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">✅</span>
                      <span className="text-sm font-medium text-emerald-400">Хороший промпт</span>
                    </div>
                    <pre className="text-sm text-muted-foreground bg-black/30 rounded-lg p-3 whitespace-pre-wrap font-mono">
                      {comp.good}
                    </pre>
                  </div>
                </div>

                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{comp.tip}</p>
                </div>
              </motion.div>
            ))}
          </TabsContent>

          {/* Workflows Tab */}
          <TabsContent value="workflows" className="space-y-4">
            {workflowExamples.map((workflow, index) => (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass rounded-xl p-5"
              >
                <h3 className="font-semibold mb-1">{workflow.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{workflow.description}</p>

                {/* Steps */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {workflow.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-xs font-medium">
                        <span className="text-emerald-400">{i + 1}.</span>
                        {step}
                      </div>
                      {i < workflow.steps.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Tools */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Инструменты:</span>
                  {workflow.tools.map((tool) => (
                    <Badge
                      key={tool}
                      variant="outline"
                      className="bg-white/5 text-muted-foreground border-white/10 text-xs"
                    >
                      {tool}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
