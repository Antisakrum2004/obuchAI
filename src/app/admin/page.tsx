"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Users, Trophy, Target, Plus, Trash2, Edit, Save, BarChart3, Zap, X, Check, ToggleLeft, ToggleRight, TreePine, Award, Database, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

// --- Types ---
interface ChallengeAdmin {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  category: string;
  xpReward: number;
  isActive: boolean;
  content?: string;
  options?: string;
  correctAnswer?: string;
  explanation?: string;
  hints?: string;
}

interface SkillAdmin {
  id: string;
  name: string;
  slug: string;
  category: string;
  requiredXp: number;
  description?: string;
  icon?: string;
}

interface AchievementAdmin {
  id: string;
  name: string;
  slug: string;
  category: string;
  xpReward: number;
  description?: string;
  icon?: string;
  condition?: string;
}

interface UserAdmin {
  id: string;
  name: string | null;
  email: string;
  role: string;
  xp: number;
  level: number;
  _count: { attempts: number };
}

// --- Empty form defaults ---
const emptyChallenge = {
  title: "", description: "", difficulty: "easy", type: "multiple_choice",
  category: "prompting", xpReward: 25, content: '{"text":"Вопрос"}',
  options: '["Вариант 1","Вариант 2","Вариант 3"]',
  correctAnswer: '"0"', explanation: "", hints: "[]", validationType: "static",
  isActive: true,
};

const emptySkill = {
  name: "", slug: "", category: "prompting", requiredXp: 100, description: "", icon: "🎯",
};

const emptyAchievement = {
  name: "", slug: "", category: "streak", xpReward: 50, description: "", icon: "🏆", condition: "",
};

// --- Main Component ---
export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  // Data states
  const [challenges, setChallenges] = useState<ChallengeAdmin[]>([]);
  const [skills, setSkills] = useState<SkillAdmin[]>([]);
  const [achievements, setAchievements] = useState<AchievementAdmin[]>([]);
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  // Form states
  const [challengeForm, setChallengeForm] = useState(emptyChallenge);
  const [skillForm, setSkillForm] = useState(emptySkill);
  const [achievementForm, setAchievementForm] = useState(emptyAchievement);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ChallengeAdmin>>({});

  // Toast state
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Auth check ---
  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch("/api/user/stats");
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.role === "admin");
        }
      } catch {
        // not logged in
      } finally {
        setChecking(false);
      }
    }
    checkAdmin();
  }, []);

  // --- Seed data ---
  const handleSeed = async () => {
    if (!confirm("Это пересоздаст все задачи, навыки и достижения. Продолжить?")) return;
    setIsSeeding(true);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey: "seed-v1.5.0" }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Данные обновлены: ${data.stats?.challenges || 0} задач`);
        fetchData();
      } else {
        showToast("Ошибка при заполнении данных", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    } finally {
      setIsSeeding(false);
    }
  };

  // --- Data fetching ---
  const fetchData = useCallback(() => {
    if (!isAdmin) return;
    fetch("/api/challenges").then(r => r.json()).then(d => Array.isArray(d) && setChallenges(d)).catch(() => {});
    fetch("/api/skills").then(r => r.json()).then(d => Array.isArray(d) && setSkills(d)).catch(() => {});
    fetch("/api/achievements").then(r => r.json()).then(d => Array.isArray(d) && setAchievements(d)).catch(() => {});
    fetch("/api/admin/users").then(r => r.json()).then(d => Array.isArray(d) && setUsers(d)).catch(() => {});
    fetch("/api/admin").then(r => r.json()).then(d => setStats(d)).catch(() => {});
  }, [isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Challenge CRUD ---
  const createChallenge = async () => {
    try {
      const res = await fetch("/api/admin/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(challengeForm),
      });
      if (res.ok) {
        showToast("Задача создана");
        setChallengeForm(emptyChallenge);
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || "Ошибка", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    }
  };

  const updateChallenge = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/challenges/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        showToast("Задача обновлена");
        setEditingId(null);
        setEditForm({});
        fetchData();
      } else {
        showToast("Ошибка обновления", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    }
  };

  const deleteChallenge = async (id: string) => {
    if (!confirm("Удалить задачу? Это действие необратимо.")) return;
    try {
      const res = await fetch(`/api/admin/challenges/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Задача удалена");
        fetchData();
      } else {
        showToast("Ошибка удаления", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    }
  };

  const toggleActive = async (ch: ChallengeAdmin) => {
    try {
      const res = await fetch(`/api/admin/challenges/${ch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !ch.isActive }),
      });
      if (res.ok) {
        showToast(ch.isActive ? "Задача скрыта" : "Задача активирована");
        fetchData();
      }
    } catch {
      showToast("Ошибка", "err");
    }
  };

  const startEdit = (ch: ChallengeAdmin) => {
    setEditingId(ch.id);
    setEditForm({
      title: ch.title,
      description: ch.description,
      difficulty: ch.difficulty,
      type: ch.type,
      category: ch.category,
      xpReward: ch.xpReward,
      content: ch.content || "",
      options: ch.options || "",
      correctAnswer: ch.correctAnswer || "",
      explanation: ch.explanation || "",
      hints: ch.hints || "",
      isActive: ch.isActive,
    });
  };

  // --- Skill CRUD ---
  const createSkill = async () => {
    try {
      const res = await fetch("/api/admin/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(skillForm),
      });
      if (res.ok) {
        showToast("Навык создан");
        setSkillForm(emptySkill);
        fetchData();
      } else {
        showToast("Ошибка", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    }
  };

  // --- Achievement CRUD ---
  const createAchievement = async () => {
    try {
      const res = await fetch("/api/admin/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(achievementForm),
      });
      if (res.ok) {
        showToast("Достижение создано");
        setAchievementForm(emptyAchievement);
        fetchData();
      } else {
        showToast("Ошибка", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    }
  };

  // --- User role toggle ---
  const toggleUserRole = async (user: UserAdmin) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    if (!confirm(`Сменить роль ${user.email} на "${newRole}"?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        showToast("Роль обновлена");
        fetchData();
      } else {
        showToast("Ошибка", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    }
  };

  // --- Render ---
  if (checking) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl text-center py-20">
          <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Доступ запрещён</h2>
          <p className="text-muted-foreground mb-4">Эта страница доступна только администраторам</p>
          <a href="/admin/login" className="text-emerald-400 hover:underline text-sm">
            Войти в админку →
          </a>
        </div>
      </AppLayout>
    );
  }

  // --- Helper: difficulty / type labels ---
  const diffLabel = (d: string) => ({ easy: "Легко", medium: "Средне", hard: "Сложно" }[d] || d);
  const typeLabel = (t: string) => ({ multiple_choice: "Выбор", ordering: "Порядок", workflow_build: "Workflow" }[t] || t);
  const catLabel = (c: string) => ({ prompting: "Промптинг", agents: "Агенты", debugging: "Дебаг", workflow: "Workflow", "1c": "1С", review: "Ревью" }[c] || c);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl relative">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${toast.type === "ok" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6 text-emerald-400" />
              <h1 className="text-2xl font-bold">Управление</h1>
            </div>
            <Button
              onClick={handleSeed}
              disabled={isSeeding}
              className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 h-9"
            >
              {isSeeding ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent mr-2" />
              ) : (
                <Database className="h-4 w-4 mr-1" />
              )}
              Заполнить данными
            </Button>
          </div>
          <p className="text-muted-foreground">Панель администратора</p>
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400/80">
              Кнопка «Заполнить данными» пересоздаёт все задачи, навыки и достижения. Прогресс пользователей сохраняется. Используйте после обновления кода.
            </p>
          </div>
        </motion.div>

        {/* Stats overview */}
        {stats && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Пользователи", value: stats.totalUsers, icon: Users, color: "text-emerald-400" },
              { label: "Задачи", value: stats.totalChallenges, icon: Target, color: "text-amber-400" },
              { label: "Попытки", value: stats.totalAttempts, icon: BarChart3, color: "text-purple-400" },
              { label: "Решений сегодня", value: stats.todayAttempts, icon: Zap, color: "text-cyan-400" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl p-4">
                <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                <p className="text-2xl font-bold">{String(stat.value)}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        <Tabs defaultValue="challenges" className="space-y-4">
          <TabsList className="bg-white/5 border border-white/5">
            <TabsTrigger value="challenges" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <Target className="h-3.5 w-3.5 mr-1" /> Задачи
            </TabsTrigger>
            <TabsTrigger value="skills" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <TreePine className="h-3.5 w-3.5 mr-1" /> Навыки
            </TabsTrigger>
            <TabsTrigger value="achievements" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <Award className="h-3.5 w-3.5 mr-1" /> Достижения
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <Users className="h-3.5 w-3.5 mr-1" /> Пользователи
            </TabsTrigger>
          </TabsList>

          {/* ===== CHALLENGES TAB ===== */}
          <TabsContent value="challenges" className="space-y-4">
            {/* Create form */}
            <div className="glass rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-400" />
                Новая задача
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Название" value={challengeForm.title} onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })} className="bg-white/5 border-white/10" />
                <div className="flex gap-2">
                  <Select value={challengeForm.difficulty} onValueChange={(v) => setChallengeForm({ ...challengeForm, difficulty: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111118] border-white/10">
                      <SelectItem value="easy">Легко</SelectItem>
                      <SelectItem value="medium">Средне</SelectItem>
                      <SelectItem value="hard">Сложно</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={challengeForm.type} onValueChange={(v) => setChallengeForm({ ...challengeForm, type: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111118] border-white/10">
                      <SelectItem value="multiple_choice">Выбор</SelectItem>
                      <SelectItem value="ordering">Порядок</SelectItem>
                      <SelectItem value="workflow_build">Workflow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="Описание" value={challengeForm.description} onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })} className="bg-white/5 border-white/10 md:col-span-2" />
                <Textarea placeholder='Содержимое JSON: {"text":"Вопрос","code":"..."}' value={challengeForm.content} onChange={(e) => setChallengeForm({ ...challengeForm, content: e.target.value })} className="bg-white/5 border-white/10 md:col-span-2 min-h-[60px] text-xs font-mono" />
                <Textarea placeholder='Варианты JSON: ["Вариант 1","Вариант 2"]' value={challengeForm.options} onChange={(e) => setChallengeForm({ ...challengeForm, options: e.target.value })} className="bg-white/5 border-white/10 min-h-[60px] text-xs font-mono" />
                <div className="space-y-2">
                  <Input placeholder='Ответ JSON: "0" или [0,1,2]' value={challengeForm.correctAnswer} onChange={(e) => setChallengeForm({ ...challengeForm, correctAnswer: e.target.value })} className="bg-white/5 border-white/10 text-xs font-mono" />
                  <Input placeholder="Пояснение" value={challengeForm.explanation} onChange={(e) => setChallengeForm({ ...challengeForm, explanation: e.target.value })} className="bg-white/5 border-white/10" />
                </div>
                <div className="flex gap-2 items-end flex-wrap">
                  <Select value={challengeForm.category} onValueChange={(v) => setChallengeForm({ ...challengeForm, category: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111118] border-white/10">
                      <SelectItem value="prompting">Промптинг</SelectItem>
                      <SelectItem value="agents">Агенты</SelectItem>
                      <SelectItem value="debugging">Дебаг</SelectItem>
                      <SelectItem value="workflow">Workflow</SelectItem>
                      <SelectItem value="1c">1С</SelectItem>
                      <SelectItem value="review">Ревью</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="XP" value={challengeForm.xpReward} onChange={(e) => setChallengeForm({ ...challengeForm, xpReward: Number(e.target.value) })} className="bg-white/5 border-white/10 w-20" />
                  <Button onClick={createChallenge} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                    <Save className="h-4 w-4 mr-1" /> Создать
                  </Button>
                </div>
              </div>
            </div>

            {/* Challenges list */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-sm">Все задачи ({challenges.length})</h3>
              </div>
              {challenges.map((ch) => (
                <div key={ch.id} className="px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  {editingId === ch.id ? (
                    /* Edit mode */
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Название" />
                      <div className="flex gap-2">
                        <Select value={editForm.difficulty} onValueChange={(v) => setEditForm({ ...editForm, difficulty: v })}>
                          <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-[#111118] border-white/10">
                            <SelectItem value="easy">Легко</SelectItem>
                            <SelectItem value="medium">Средне</SelectItem>
                            <SelectItem value="hard">Сложно</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                          <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-[#111118] border-white/10">
                            <SelectItem value="multiple_choice">Выбор</SelectItem>
                            <SelectItem value="ordering">Порядок</SelectItem>
                            <SelectItem value="workflow_build">Workflow</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Input value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Описание" />
                      <Input value={editForm.correctAnswer || ""} onChange={(e) => setEditForm({ ...editForm, correctAnswer: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm font-mono" placeholder='Ответ JSON' />
                      <div className="flex gap-2 items-center md:col-span-2">
                        <Button size="sm" onClick={() => updateChallenge(ch.id)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-8">
                          <Check className="h-3.5 w-3.5 mr-1" /> Сохранить
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditForm({}); }} className="h-8 text-muted-foreground">
                          <X className="h-3.5 w-3.5 mr-1" /> Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ch.title}</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] bg-white/5 border-white/5">{diffLabel(ch.difficulty)}</Badge>
                          <Badge variant="outline" className="text-[10px] bg-white/5 border-white/5">{typeLabel(ch.type)}</Badge>
                          <Badge variant="outline" className="text-[10px] bg-white/5 border-white/5">{catLabel(ch.category)}</Badge>
                        </div>
                      </div>
                      <span className="text-xs text-emerald-400">+{ch.xpReward} XP</span>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(ch)} className="h-7 w-7 p-0" title={ch.isActive ? "Скрыть" : "Активировать"}>
                        {ch.isActive ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(ch)} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="Редактировать">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteChallenge(ch.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" title="Удалить">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ===== SKILLS TAB ===== */}
          <TabsContent value="skills" className="space-y-4">
            {/* Create form */}
            <div className="glass rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-400" />
                Новый навык
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Название" value={skillForm.name} onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} className="bg-white/5 border-white/10" />
                <Input placeholder="slug (авто)" value={skillForm.slug} onChange={(e) => setSkillForm({ ...skillForm, slug: e.target.value })} className="bg-white/5 border-white/10" />
                <Select value={skillForm.category} onValueChange={(v) => setSkillForm({ ...skillForm, category: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#111118] border-white/10">
                    <SelectItem value="prompting">Промптинг</SelectItem>
                    <SelectItem value="agents">Агенты</SelectItem>
                    <SelectItem value="debugging">Дебаг</SelectItem>
                    <SelectItem value="workflow">Workflow</SelectItem>
                    <SelectItem value="1c">1С</SelectItem>
                    <SelectItem value="review">Ревью</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input type="number" placeholder="XP для уровня" value={skillForm.requiredXp} onChange={(e) => setSkillForm({ ...skillForm, requiredXp: Number(e.target.value) })} className="bg-white/5 border-white/10 w-28" />
                  <Input placeholder="Иконка" value={skillForm.icon} onChange={(e) => setSkillForm({ ...skillForm, icon: e.target.value })} className="bg-white/5 border-white/10 w-20 text-center" />
                </div>
                <Input placeholder="Описание" value={skillForm.description} onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })} className="bg-white/5 border-white/10 md:col-span-2" />
                <Button onClick={createSkill} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 w-fit">
                  <Save className="h-4 w-4 mr-1" /> Создать навык
                </Button>
              </div>
            </div>

            {/* Skills list */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold text-sm">Все навыки ({skills.length})</h3>
              </div>
              {skills.map((skill) => (
                <div key={skill.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5">
                  <span className="text-lg">{skill.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{skill.name}</p>
                    <p className="text-xs text-muted-foreground">{skill.slug} • {catLabel(skill.category)} • {skill.requiredXp} XP</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ===== ACHIEVEMENTS TAB ===== */}
          <TabsContent value="achievements" className="space-y-4">
            {/* Create form */}
            <div className="glass rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-400" />
                Новое достижение
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Название" value={achievementForm.name} onChange={(e) => setAchievementForm({ ...achievementForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} className="bg-white/5 border-white/10" />
                <Input placeholder="slug (авто)" value={achievementForm.slug} onChange={(e) => setAchievementForm({ ...achievementForm, slug: e.target.value })} className="bg-white/5 border-white/10" />
                <Select value={achievementForm.category} onValueChange={(v) => setAchievementForm({ ...achievementForm, category: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#111118] border-white/10">
                    <SelectItem value="streak">Серия</SelectItem>
                    <SelectItem value="xp">Опыт</SelectItem>
                    <SelectItem value="challenge">Задачи</SelectItem>
                    <SelectItem value="skill">Навыки</SelectItem>
                    <SelectItem value="special">Особые</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input type="number" placeholder="XP награда" value={achievementForm.xpReward} onChange={(e) => setAchievementForm({ ...achievementForm, xpReward: Number(e.target.value) })} className="bg-white/5 border-white/10 w-28" />
                  <Input placeholder="Иконка" value={achievementForm.icon} onChange={(e) => setAchievementForm({ ...achievementForm, icon: e.target.value })} className="bg-white/5 border-white/10 w-20 text-center" />
                </div>
                <Input placeholder="Описание" value={achievementForm.description} onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })} className="bg-white/5 border-white/10" />
                <Input placeholder='Условие JSON: {"type":"streak","value":7}' value={achievementForm.condition} onChange={(e) => setAchievementForm({ ...achievementForm, condition: e.target.value })} className="bg-white/5 border-white/10 text-xs font-mono" />
                <Button onClick={createAchievement} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 w-fit">
                  <Save className="h-4 w-4 mr-1" /> Создать достижение
                </Button>
              </div>
            </div>

            {/* Achievements list */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold text-sm">Все достижения ({achievements.length})</h3>
              </div>
              {achievements.map((ach) => (
                <div key={ach.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5">
                  <span className="text-lg">{ach.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{ach.name}</p>
                    <p className="text-xs text-muted-foreground">{ach.slug} • {ach.category} • +{ach.xpReward} XP</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ===== USERS TAB ===== */}
          <TabsContent value="users" className="space-y-4">
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold text-sm">Все пользователи ({users.length})</h3>
              </div>
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline" className={`${user.role === "admin" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 border-white/5"}`}>
                    {user.role}
                  </Badge>
                  <span className="text-xs text-emerald-400">Ур. {user.level}</span>
                  <span className="text-xs text-amber-400">{user.xp} XP</span>
                  <span className="text-xs text-muted-foreground">{user._count.attempts} поп.</span>
                  <Button size="sm" variant="ghost" onClick={() => toggleUserRole(user)} className="h-7 p-0 text-xs text-muted-foreground hover:text-foreground" title="Сменить роль">
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
