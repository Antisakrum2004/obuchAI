"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Settings, Users, Trophy, Target, Plus, Trash2, Edit, Save, BarChart3, Zap, X, Check, ToggleLeft, ToggleRight, TreePine, Award, Database, AlertTriangle, RefreshCw, Sparkles, Shield, Ban, Heart, RotateCcw, MoreVertical, BookOpen, CircleDot } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { KnowledgeAdmin } from "@/components/knowledge/knowledge-admin";

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
  streak: number;
  hearts: number;
  banned: boolean;
  image: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  lastIp: string | null;
  lastUserAgent: string | null;
  lastDevice: string | null;
  _count: { attempts: number };
}

// --- Empty form defaults ---
const emptyChallenge = {
  title: "", description: "", difficulty: "easy", type: "multiple_choice",
  category: "prompting", xpReward: 25, questionText: "",
  optionList: ["", "", ""],
  correctIndex: 0, explanation: "", hints: "[]", validationType: "static",
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
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editOptionList, setEditOptionList] = useState<string[]>(["", "", ""]);
  const [editCorrectIndex, setEditCorrectIndex] = useState(0);

  // Toast state
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);
  const [effectSettings, setEffectSettings] = useState<Record<string, string>>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Effects settings ---
  const fetchEffectSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setEffectSettings(data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  const toggleEffectSetting = async (key: string, currentValue: string) => {
    const newValue = currentValue === "true" ? "false" : "true";
    // Optimistic update
    setEffectSettings(prev => ({ ...prev, [key]: newValue }));
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: newValue }),
      });
      if (res.ok) {
        showToast(`${key}: ${newValue === "true" ? "включено" : "выключено"}`);
      } else {
        // Revert on error
        setEffectSettings(prev => ({ ...prev, [key]: currentValue }));
        showToast("Ошибка обновления", "err");
      }
    } catch {
      setEffectSettings(prev => ({ ...prev, [key]: currentValue }));
      showToast("Ошибка сети", "err");
    }
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

  // --- Run migration ---
  const handleMigrate = async () => {
    if (!confirm("Создать/обновить таблицы базы данных? Это безопасная операция.")) return;
    setIsMigrating(true);
    try {
      const res = await fetch("/api/admin/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: "seed-v1.5.0" }),
      });
      if (res.ok) {
        showToast("Миграция выполнена успешно");
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Ошибка миграции", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    } finally {
      setIsMigrating(false);
    }
  };

  // --- Data fetching ---
  const fetchData = useCallback(() => {
    if (!isAdmin) return;
    fetch("/api/challenges").then(r => r.json()).then(d => { const arr = Array.isArray(d) ? d : (d.challenges && Array.isArray(d.challenges) ? d.challenges : []); setChallenges(arr); }).catch(() => {});
    fetch("/api/skills").then(r => r.json()).then(d => Array.isArray(d) && setSkills(d)).catch(() => {});
    fetch("/api/achievements").then(r => r.json()).then(d => Array.isArray(d) && setAchievements(d)).catch(() => {});
    fetch("/api/admin/users").then(r => r.json()).then(d => Array.isArray(d) && setUsers(d)).catch(() => {});
    fetch("/api/admin").then(r => r.json()).then(d => setStats(d)).catch(() => {});
  }, [isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => { if (isAdmin) fetchEffectSettings(); }, [isAdmin, fetchEffectSettings]);

  // --- Refresh users ---
  const refreshUsers = async () => {
    setIsRefreshingUsers(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsers(data);
          showToast(`Обновлено: ${data.length} пользователей`);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Ошибка загрузки", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    } finally {
      setIsRefreshingUsers(false);
    }
  };

  // Auto-refresh users every 30 seconds when on admin page
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setUsers(data);
        }
      } catch {
        // silently fail
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // --- Challenge CRUD ---
  const createChallenge = async () => {
    try {
      // Convert human-friendly form to API format
      const optionsArray = (challengeForm.optionList || []).filter((o: string) => o.trim() !== "");
      if (optionsArray.length < 2) {
        showToast("Минимум 2 варианта ответа", "err");
        return;
      }
      if (!challengeForm.questionText?.trim()) {
        showToast("Введите текст вопроса", "err");
        return;
      }

      const payload = {
        title: challengeForm.title,
        description: challengeForm.description,
        difficulty: challengeForm.difficulty,
        type: challengeForm.type,
        category: challengeForm.category,
        xpReward: challengeForm.xpReward,
        content: JSON.stringify({ text: challengeForm.questionText }),
        options: JSON.stringify(optionsArray),
        correctAnswer: JSON.stringify(challengeForm.correctIndex),
        explanation: challengeForm.explanation || null,
        hints: challengeForm.hints || "[]",
        validationType: challengeForm.validationType || "static",
        isActive: challengeForm.isActive,
      };

      const res = await fetch("/api/admin/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      const optionsArray = editOptionList.filter((o: string) => o.trim() !== "");
      if (optionsArray.length < 2) {
        showToast("Минимум 2 варианта ответа", "err");
        return;
      }
      if (!editQuestionText.trim()) {
        showToast("Введите текст вопроса", "err");
        return;
      }
      const payload = {
        ...editForm,
        content: JSON.stringify({ text: editQuestionText }),
        options: JSON.stringify(optionsArray),
        correctAnswer: JSON.stringify(editCorrectIndex),
      };
      const res = await fetch(`/api/admin/challenges/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast("Задача обновлена");
        setEditingId(null);
        setEditForm({});
        setEditQuestionText("");
        setEditOptionList(["", "", ""]);
        setEditCorrectIndex(0);
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
    // Parse JSON fields into user-friendly format
    let qText = "";
    try { qText = JSON.parse(ch.content || "{}").text || ""; } catch { qText = ch.content || ""; }
    let opts: string[] = ["", "", ""];
    try { const parsed = JSON.parse(ch.options || "[]"); if (Array.isArray(parsed)) opts = parsed; } catch { /* keep defaults */ }
    let cIdx = 0;
    try { cIdx = parseInt(JSON.parse(ch.correctAnswer || "0"), 10); if (isNaN(cIdx)) cIdx = 0; } catch { try { cIdx = parseInt(ch.correctAnswer || "0", 10); } catch { cIdx = 0; } }
    setEditQuestionText(qText);
    setEditOptionList(opts);
    setEditCorrectIndex(cIdx);
    setEditForm({
      title: ch.title,
      description: ch.description,
      difficulty: ch.difficulty,
      type: ch.type,
      category: ch.category,
      xpReward: ch.xpReward,
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

  // --- User action helpers ---
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

  const deleteUser = async (user: UserAdmin) => {
    if (!confirm(`Удалить пользователя ${user.email}? Это действие необратимо. Все попытки будут удалены.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Пользователь удалён");
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Ошибка удаления", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    }
  };

  const toggleBanUser = async (user: UserAdmin) => {
    const newBanned = !user.banned;
    if (!confirm(newBanned ? `Заблокировать ${user.email}?` : `Разблокировать ${user.email}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: newBanned }),
      });
      if (res.ok) {
        showToast(newBanned ? "Пользователь заблокирован" : "Пользователь разблокирован");
        fetchData();
      } else {
        showToast("Ошибка", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    }
  };

  const addHearts = async (user: UserAdmin) => {
    const input = prompt(`Текущие сердца: ${user.hearts}. Введите количество для добавления (отрицательное для удаления):`);
    if (input === null) return;
    const delta = parseInt(input, 10);
    if (isNaN(delta)) {
      showToast("Введите число", "err");
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heartsDelta: delta }),
      });
      if (res.ok) {
        showToast(`Сердца обновлены (${delta > 0 ? "+" : ""}${delta})`);
        fetchData();
      } else {
        showToast("Ошибка", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    }
  };

  const addXp = async (user: UserAdmin) => {
    const input = prompt(`Текущий XP: ${user.xp}. Введите количество для добавления (отрицательное для удаления):`);
    if (input === null) return;
    const delta = parseInt(input, 10);
    if (isNaN(delta)) {
      showToast("Введите число", "err");
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpDelta: delta }),
      });
      if (res.ok) {
        showToast(`XP обновлён (${delta > 0 ? "+" : ""}${delta})`);
        fetchData();
      } else {
        showToast("Ошибка", "err");
      }
    } catch {
      showToast("Ошибка сети", "err");
    }
  };

  const resetStreak = async (user: UserAdmin) => {
    if (!confirm(`Сбросить стрик ${user.email}? (Текущий: ${user.streak})`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streak: 0 }),
      });
      if (res.ok) {
        showToast("Стрик сброшен");
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

  // --- Date formatters ---
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
    } catch { return iso; }
  };
  const formatRelative = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffH = Math.floor(diffMs / 3600000);
      const diffD = Math.floor(diffMs / 86400000);
      if (diffMin < 1) return "только что";
      if (diffMin < 60) return `${diffMin} мин. назад`;
      if (diffH < 24) return `${diffH} ч. назад`;
      if (diffD < 7) return `${diffD} дн. назад`;
      return formatDate(iso);
    } catch { return iso; }
  };

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
            <div className="flex items-center gap-2">
              <Button
                onClick={handleMigrate}
                disabled={isMigrating}
                className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 h-9"
              >
                {isMigrating ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent mr-2" />
                ) : (
                  <Database className="h-4 w-4 mr-1" />
                )}
                Миграция БД
              </Button>
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
Сидировать задачи
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">Панель администратора</p>
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400/80">
              Пересоздаёт все задачи, навыки и достижения из шаблонов. Прогресс пользователей сохраняется. Используйте после обновления кода.
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
            <TabsTrigger value="effects" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Эффекты
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <BookOpen className="h-3.5 w-3.5 mr-1" /> Знания
            </TabsTrigger>
          </TabsList>

          {/* ===== CHALLENGES TAB (v2) ===== */}
          <TabsContent value="challenges" className="space-y-4">
            {/* Create form */}
            <div className="glass rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-400" />
                Новая задача
              </h3>
              <div className="space-y-4">
                {/* Row 1: Title + difficulty + type */}
                <div className="grid gap-3 md:grid-cols-2">
                  <Input placeholder="Название задачи" value={challengeForm.title} onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })} className="bg-white/5 border-white/10" />
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
                </div>

                {/* Row 2: Description */}
                <Input placeholder="Краткое описание" value={challengeForm.description} onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })} className="bg-white/5 border-white/10" />

                {/* Row 3: Question text */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Текст вопроса</label>
                  <Textarea
                    placeholder="Какой промпт лучше всего подходит для генерации кода?"
                    value={challengeForm.questionText || ""}
                    onChange={(e) => setChallengeForm({ ...challengeForm, questionText: e.target.value })}
                    className="bg-white/5 border-white/10 min-h-[60px]"
                  />
                </div>

                {/* Row 4: Options with correct answer selector */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Варианты ответа (отметьте правильный)</label>
                  <RadioGroup
                    value={String(challengeForm.correctIndex ?? 0)}
                    onValueChange={(v) => setChallengeForm({ ...challengeForm, correctIndex: parseInt(v) })}
                    className="space-y-2"
                  >
                    {(challengeForm.optionList || ["", "", ""]).map((opt: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <RadioGroupItem value={String(idx)} id={`opt-correct-${idx}`} className="shrink-0 border-emerald-500/50 text-emerald-400" />
                        <Label htmlFor={`opt-correct-${idx}`} className="text-[10px] text-muted-foreground shrink-0 w-4">
                          {idx + (challengeForm.correctIndex === idx ? "✓" : "")}
                        </Label>
                        <Input
                          placeholder={`Вариант ${idx + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const newList = [...(challengeForm.optionList || ["", "", ""])];
                            newList[idx] = e.target.value;
                            setChallengeForm({ ...challengeForm, optionList: newList });
                          }}
                          className={cn(
                            "bg-white/5 border-white/10 flex-1",
                            challengeForm.correctIndex === idx && "border-emerald-500/30 bg-emerald-500/5"
                          )}
                        />
                        {(challengeForm.optionList || []).length > 2 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const newList = (challengeForm.optionList || []).filter((_: string, i: number) => i !== idx);
                              const newCorrect = challengeForm.correctIndex >= idx
                                ? Math.max(0, challengeForm.correctIndex - 1)
                                : challengeForm.correctIndex;
                              setChallengeForm({ ...challengeForm, optionList: newList, correctIndex: newCorrect });
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setChallengeForm({ ...challengeForm, optionList: [...(challengeForm.optionList || []), ""] })}
                    className="mt-2 text-xs text-muted-foreground hover:text-emerald-400"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Добавить вариант
                  </Button>
                </div>

                {/* Row 5: Explanation + category + XP + Create */}
                <div className="grid gap-3 md:grid-cols-2">
                  <Input placeholder="Пояснение (после ответа)" value={challengeForm.explanation} onChange={(e) => setChallengeForm({ ...challengeForm, explanation: e.target.value })} className="bg-white/5 border-white/10" />
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
            </div>

            {/* Challenges list */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-sm">Все задачи ({challenges.length})</h3>
              </div>
              {challenges.map((ch) => (
                <div key={ch.id} className="px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  {editingId === ch.id ? (
                    /* Edit mode — same user-friendly UI as create form */
                    <div className="space-y-3">
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
                      </div>
                      <Input value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Описание" />
                      {/* Question text */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Текст вопроса</label>
                        <Textarea value={editQuestionText} onChange={(e) => setEditQuestionText(e.target.value)} className="bg-white/5 border-white/10 min-h-[50px] text-sm" placeholder="Вопрос..." />
                      </div>
                      {/* Options with radio for correct */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Варианты ответа (отметьте правильный)</label>
                        <RadioGroup value={String(editCorrectIndex)} onValueChange={(v) => setEditCorrectIndex(parseInt(v))} className="space-y-2">
                          {editOptionList.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <RadioGroupItem value={String(idx)} id={`edit-opt-${idx}`} className="shrink-0 border-emerald-500/50 text-emerald-400" />
                              <Label htmlFor={`edit-opt-${idx}`} className="text-[10px] text-muted-foreground shrink-0 w-4">
                                {idx + 1}{editCorrectIndex === idx ? "\u2713" : ""}
                              </Label>
                              <Input
                                value={opt}
                                onChange={(e) => { const nl = [...editOptionList]; nl[idx] = e.target.value; setEditOptionList(nl); }}
                                className={cn("bg-white/5 border-white/10 flex-1 h-9 text-sm", editCorrectIndex === idx && "border-emerald-500/30 bg-emerald-500/5")}
                                placeholder={`Вариант ${idx + 1}`}
                              />
                              {editOptionList.length > 2 && (
                                <Button size="sm" variant="ghost" onClick={() => {
                                  const nl = editOptionList.filter((_, i) => i !== idx);
                                  const nc = editCorrectIndex >= idx ? Math.max(0, editCorrectIndex - 1) : editCorrectIndex;
                                  setEditOptionList(nl);
                                  setEditCorrectIndex(nc);
                                }} className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 shrink-0">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </RadioGroup>
                        <Button size="sm" variant="ghost" onClick={() => setEditOptionList([...editOptionList, ""])} className="mt-2 text-xs text-muted-foreground hover:text-emerald-400">
                          <Plus className="h-3 w-3 mr-1" /> Добавить вариант
                        </Button>
                      </div>
                      {/* Explanation + category + XP */}
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input value={editForm.explanation || ""} onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })} className="bg-white/5 border-white/10 h-9 text-sm" placeholder="Пояснение" />
                        <div className="flex gap-2 items-end flex-wrap">
                          <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                            <SelectTrigger className="bg-white/5 border-white/10 w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#111118] border-white/10">
                              <SelectItem value="prompting">Промптинг</SelectItem>
                              <SelectItem value="agents">Агенты</SelectItem>
                              <SelectItem value="debugging">Дебаг</SelectItem>
                              <SelectItem value="workflow">Workflow</SelectItem>
                              <SelectItem value="1c">1С</SelectItem>
                              <SelectItem value="review">Ревью</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input type="number" value={editForm.xpReward || 25} onChange={(e) => setEditForm({ ...editForm, xpReward: Number(e.target.value) })} className="bg-white/5 border-white/10 w-20 h-9 text-sm" />
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Button size="sm" onClick={() => updateChallenge(ch.id)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-8">
                          <Check className="h-3.5 w-3.5 mr-1" /> Сохранить
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditForm({}); setEditQuestionText(""); setEditOptionList(["", "", ""]); setEditCorrectIndex(0); }} className="h-8 text-muted-foreground">
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
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass rounded-xl p-3">
                <p className="text-xl font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">Всего пользователей</p>
              </div>
              <div className="glass rounded-xl p-3">
                <p className="text-xl font-bold text-emerald-400">{users.filter(u => u.role === "admin").length}</p>
                <p className="text-xs text-muted-foreground">Администраторы</p>
              </div>
              <div className="glass rounded-xl p-3">
                <p className="text-xl font-bold text-amber-400">{users.filter(u => { if (!u.lastActiveAt) return false; const d = new Date(u.lastActiveAt); const now = new Date(); return now.getTime() - d.getTime() < 24*60*60*1000; }).length}</p>
                <p className="text-xs text-muted-foreground">Активны за 24ч</p>
              </div>
              <div className="glass rounded-xl p-3">
                <p className="text-xl font-bold text-red-400">{users.filter(u => u.banned).length}</p>
                <p className="text-xs text-muted-foreground">Заблокированы</p>
              </div>
            </div>

            {/* Tracking info hint */}
            <div className="flex items-start gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
              <AlertTriangle className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-xs text-cyan-400/80">
                Данные об IP и устройстве появляются, когда пользователь заходит на сайт. Если поля пустые — пользователь ещё не заходил после последнего обновления.
              </p>
            </div>

            {/* Users table */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-sm">Все пользователи ({users.length})</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={refreshUsers}
                  disabled={isRefreshingUsers}
                  className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingUsers ? "animate-spin" : ""}`} />
                  Обновить
                </Button>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">Пользователь</th>
                      <th className="text-left px-3 py-2.5 font-medium">Роль</th>
                      <th className="text-left px-3 py-2.5 font-medium">Прогресс</th>
                      <th className="text-left px-3 py-2.5 font-medium">Устройство</th>
                      <th className="text-left px-3 py-2.5 font-medium">IP</th>
                      <th className="text-left px-3 py-2.5 font-medium">Зарегистрирован</th>
                      <th className="text-left px-3 py-2.5 font-medium">Последний вход</th>
                      <th className="text-right px-3 py-2.5 font-medium w-10">Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className={`border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${user.banned ? "opacity-60" : ""}`}>
                        {/* User */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold shrink-0">
                              {user.image ? (
                                <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                              ) : (
                                (user.name || user.email).charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate max-w-[180px]">{user.name || "—"}</p>
                                {user.banned && (
                                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] h-4 px-1">
                                    Заблокирован
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        {/* Role */}
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={`${user.role === "admin" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 border-white/5 text-muted-foreground"}`}>
                            {user.role === "admin" ? "Admin" : "User"}
                          </Badge>
                        </td>
                        {/* Progress */}
                        <td className="px-3 py-3">
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-emerald-400 font-medium">Ур.{user.level}</span>
                              <span className="text-amber-400">{user.xp} XP</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500/40" style={{ width: `${Math.min(((user.xp % 100) / 100) * 100, 100)}%` }} />
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>🔥{user.streak}</span>
                              <span>❤️{user.hearts}</span>
                              <span>{user._count.attempts} поп.</span>
                            </div>
                          </div>
                        </td>
                        {/* Device */}
                        <td className="px-3 py-3">
                          <div className="max-w-[160px]">
                            <p className="text-xs truncate" title={user.lastDevice || undefined}>{user.lastDevice || <span className="text-muted-foreground/50">—</span>}</p>
                            {user.lastUserAgent && (
                              <p className="text-[10px] text-muted-foreground/50 truncate max-w-[160px]" title={user.lastUserAgent}>{user.lastUserAgent.substring(0, 50)}…</p>
                            )}
                          </div>
                        </td>
                        {/* IP */}
                        <td className="px-3 py-3">
                          <p className="text-xs font-mono text-muted-foreground">{user.lastIp || <span className="text-muted-foreground/50">—</span>}</p>
                        </td>
                        {/* Registered */}
                        <td className="px-3 py-3">
                          <p className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</p>
                        </td>
                        {/* Last active */}
                        <td className="px-3 py-3">
                          <p className="text-xs text-muted-foreground">{user.lastActiveAt ? formatRelative(user.lastActiveAt) : <span className="text-muted-foreground/50">—</span>}</p>
                        </td>
                        {/* Action */}
                        <td className="px-3 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#111118] border-white/10">
                              <DropdownMenuItem onClick={() => deleteUser(user)} className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer">
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Удалить
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/5" />
                              <DropdownMenuItem onClick={() => toggleBanUser(user)} className="cursor-pointer">
                                {user.banned ? <Shield className="h-3.5 w-3.5 mr-2 text-emerald-400" /> : <Ban className="h-3.5 w-3.5 mr-2 text-amber-400" />}
                                {user.banned ? "Разблокировать" : "Заблокировать"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleUserRole(user)} className="cursor-pointer">
                                <Edit className="h-3.5 w-3.5 mr-2" />
                                Сменить роль
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/5" />
                              <DropdownMenuItem onClick={() => addHearts(user)} className="cursor-pointer">
                                <Heart className="h-3.5 w-3.5 mr-2 text-pink-400" />
                                Добавить сердца
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => addXp(user)} className="cursor-pointer">
                                <Zap className="h-3.5 w-3.5 mr-2 text-amber-400" />
                                Изменить XP
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => resetStreak(user)} className="cursor-pointer">
                                <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                Сбросить стрик
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden">
                {users.map((user) => (
                  <div key={user.id} className={`px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${user.banned ? "opacity-60" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold shrink-0">
                        {user.image ? (
                          <img src={user.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          (user.name || user.email).charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{user.name || "—"}</p>
                          <Badge variant="outline" className={`${user.role === "admin" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 border-white/5 text-muted-foreground"} text-[10px] h-5`}>
                            {user.role === "admin" ? "Admin" : "User"}
                          </Badge>
                          {user.banned && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] h-5 px-1">
                              Заблокирован
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                          <span className="text-emerald-400">Ур. {user.level}</span>
                          <span className="text-amber-400">{user.xp} XP</span>
                          <span>🔥 {user.streak}</span>
                          <span>❤️ {user.hearts}</span>
                          <span>{user._count.attempts} поп.</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          {user.lastDevice && <span>{user.lastDevice}</span>}
                          {user.lastIp && <span className="font-mono">{user.lastIp}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
                          <span>Рег: {formatDate(user.createdAt)}</span>
                          {user.lastActiveAt && <span>Вход: {formatRelative(user.lastActiveAt)}</span>}
                        </div>
                        {/* Mobile actions dropdown */}
                        <div className="pt-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="bg-[#111118] border-white/10">
                              <DropdownMenuItem onClick={() => deleteUser(user)} className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer">
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Удалить
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/5" />
                              <DropdownMenuItem onClick={() => toggleBanUser(user)} className="cursor-pointer">
                                {user.banned ? <Shield className="h-3.5 w-3.5 mr-2 text-emerald-400" /> : <Ban className="h-3.5 w-3.5 mr-2 text-amber-400" />}
                                {user.banned ? "Разблокировать" : "Заблокировать"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleUserRole(user)} className="cursor-pointer">
                                <Edit className="h-3.5 w-3.5 mr-2" />
                                Сменить роль
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/5" />
                              <DropdownMenuItem onClick={() => addHearts(user)} className="cursor-pointer">
                                <Heart className="h-3.5 w-3.5 mr-2 text-pink-400" />
                                Добавить сердца
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => addXp(user)} className="cursor-pointer">
                                <Zap className="h-3.5 w-3.5 mr-2 text-amber-400" />
                                Изменить XP
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => resetStreak(user)} className="cursor-pointer">
                                <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                Сбросить стрик
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ===== EFFECTS TAB ===== */}
          <TabsContent value="effects" className="space-y-4">
            <div className="glass rounded-xl p-6">
              <div className="mb-6">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                  Настройки эффектов
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Управление визуальными эффектами приложения</p>
              </div>

              {isLoadingSettings ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "particles", emoji: "✨", name: "Частицы фона", desc: "Анимированные частицы на фоне страницы" },
                    { key: "confetti", emoji: "🎊", name: "Конфетти", desc: "Эффект конфетти при получении достижений" },
                    { key: "liquid_xp", emoji: "🌊", name: "Жидкий XP-бар", desc: "Жидкостная анимация прогресс-бара" },
                    { key: "heart_animations", emoji: "💔", name: "Анимация сердец", desc: "Анимация потери и восстановления сердец" },
                    { key: "streak_fire", emoji: "🔥", name: "Огонь стрика", desc: "Огненный эффект при серии ответов" },
                    { key: "avatar_frames", emoji: "👑", name: "Рамки аватаров", desc: "Декоративные рамки по уровню" },
                    { key: "micro_animations", emoji: "💫", name: "Микроанимации", desc: "Мелкие анимации кнопок и карточек" },
                    { key: "adaptive_difficulty", emoji: "🎯", name: "Адаптивная сложность", desc: "Автоматическая подстройка сложности" },
                  ].map((setting) => {
                    const isOn = effectSettings[setting.key] === "true"
                    return (
                      <motion.div
                        key={setting.key}
                        className="glass rounded-xl p-4 flex items-center justify-between gap-4 hover:bg-white/[0.07] transition-colors"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0">{setting.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{setting.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{setting.desc}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isOn}
                          aria-label={`Toggle ${setting.name}`}
                          onClick={() => toggleEffectSetting(setting.key, effectSettings[setting.key])}
                          className="relative shrink-0 inline-flex h-[1.8em] w-[3.7em] cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                          style={{ backgroundColor: isOn ? "#3a4b39" : "#313033" }}
                        >
                          <span
                            className="pointer-events-none inline-block h-[1.4em] w-[1.4em] rounded-full shadow-lg transition-transform duration-200 ease-in-out mt-[0.2em] ml-[0.2em]"
                            style={{
                              backgroundColor: isOn ? "#84da89" : "#aeaaae",
                              transform: isOn ? "translateX(1.9em)" : "translateX(0)",
                            }}
                          />
                        </button>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== KNOWLEDGE TAB ===== */}
          <TabsContent value="knowledge" className="space-y-4">
            <KnowledgeAdmin />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
