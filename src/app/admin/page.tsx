"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Users, Trophy, Target, Plus, Trash2, Edit, Save, BarChart3, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface ChallengeAdmin {
  id: string;
  title: string;
  difficulty: string;
  type: string;
  category: string;
  xpReward: number;
  isActive: boolean;
}

interface SkillAdmin {
  id: string;
  name: string;
  slug: string;
  category: string;
  requiredXp: number;
}

interface AchievementAdmin {
  id: string;
  name: string;
  slug: string;
  category: string;
  xpReward: number;
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
  const [challengeForm, setChallengeForm] = useState({
    title: "", description: "", difficulty: "easy", type: "multiple_choice",
    category: "prompting", xpReward: 25, content: "", options: "",
    correctAnswer: "", explanation: "", hints: "", validationType: "static",
    skillId: "", isActive: true,
  });

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

  useEffect(() => {
    if (!isAdmin) return;

    // Fetch all admin data
    fetch("/api/challenges").then(r => r.json()).then(d => Array.isArray(d) && setChallenges(d)).catch(() => {});
    fetch("/api/skills").then(r => r.json()).then(d => Array.isArray(d) && setSkills(d)).catch(() => {});
    fetch("/api/achievements").then(r => r.json()).then(d => Array.isArray(d) && setAchievements(d)).catch(() => {});
    fetch("/api/admin/users").then(r => r.json()).then(d => Array.isArray(d) && setUsers(d)).catch(() => {});
    fetch("/api/admin").then(r => r.json()).then(d => setStats(d)).catch(() => {});
  }, [isAdmin]);

  const createChallenge = async () => {
    try {
      const res = await fetch("/api/admin/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(challengeForm),
      });
      if (res.ok) {
        const newChallenge = await res.json();
        setChallenges((prev) => [...prev, newChallenge]);
        setChallengeForm({
          title: "", description: "", difficulty: "easy", type: "multiple_choice",
          category: "prompting", xpReward: 25, content: "", options: "",
          correctAnswer: "", explanation: "", hints: "", validationType: "static",
          skillId: "", isActive: true,
        });
      }
    } catch {
      // silently fail
    }
  };

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
          <p className="text-muted-foreground">Эта страница доступна только администраторам</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl font-bold">Управление</h1>
          </div>
          <p className="text-muted-foreground">Панель администратора</p>
        </motion.div>

        {/* Stats overview */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
          >
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
              Задачи
            </TabsTrigger>
            <TabsTrigger value="skills" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              Навыки
            </TabsTrigger>
            <TabsTrigger value="achievements" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              Достижения
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              Пользователи
            </TabsTrigger>
          </TabsList>

          {/* Challenges Tab */}
          <TabsContent value="challenges" className="space-y-4">
            {/* Create form */}
            <div className="glass rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-400" />
                Новая задача
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Название"
                  value={challengeForm.title}
                  onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })}
                  className="bg-white/5 border-white/10"
                />
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
                      <SelectItem value="prompt_fix">Промпт</SelectItem>
                      <SelectItem value="text_input">Ввод</SelectItem>
                      <SelectItem value="ordering">Порядок</SelectItem>
                      <SelectItem value="workflow_build">Workflow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Описание"
                  value={challengeForm.description}
                  onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })}
                  className="bg-white/5 border-white/10 md:col-span-2"
                />
                <Textarea
                  placeholder='Содержимое (JSON) - например: {"text":"Вопрос","code":"..."}'
                  value={challengeForm.content}
                  onChange={(e) => setChallengeForm({ ...challengeForm, content: e.target.value })}
                  className="bg-white/5 border-white/10 md:col-span-2 min-h-[80px]"
                />
                <Textarea
                  placeholder='Варианты (JSON массив) - например: ["Вариант 1","Вариант 2"]'
                  value={challengeForm.options}
                  onChange={(e) => setChallengeForm({ ...challengeForm, options: e.target.value })}
                  className="bg-white/5 border-white/10"
                />
                <Input
                  placeholder='Правильный ответ (JSON) - например: "0" или ["1","2","0"]'
                  value={challengeForm.correctAnswer}
                  onChange={(e) => setChallengeForm({ ...challengeForm, correctAnswer: e.target.value })}
                  className="bg-white/5 border-white/10"
                />
                <Input
                  placeholder="Пояснение"
                  value={challengeForm.explanation}
                  onChange={(e) => setChallengeForm({ ...challengeForm, explanation: e.target.value })}
                  className="bg-white/5 border-white/10"
                />
                <div className="flex gap-2 items-end">
                  <Select value={challengeForm.category} onValueChange={(v) => setChallengeForm({ ...challengeForm, category: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111118] border-white/10">
                      <SelectItem value="prompting">Промптинг</SelectItem>
                      <SelectItem value="agents">Агенты</SelectItem>
                      <SelectItem value="debugging">Дебаггинг</SelectItem>
                      <SelectItem value="workflow">Workflow</SelectItem>
                      <SelectItem value="1c">1С</SelectItem>
                      <SelectItem value="review">Ревью</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={createChallenge}
                    className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Создать
                  </Button>
                </div>
              </div>
            </div>

            {/* Challenges list */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold text-sm">Все задачи ({challenges.length})</h3>
              </div>
              {challenges.map((ch) => (
                <div key={ch.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ch.title}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px] bg-white/5 border-white/5">{ch.difficulty}</Badge>
                      <Badge variant="outline" className="text-[10px] bg-white/5 border-white/5">{ch.type}</Badge>
                      <Badge variant="outline" className="text-[10px] bg-white/5 border-white/5">{ch.category}</Badge>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400">+{ch.xpReward} XP</span>
                  <Badge variant={ch.isActive ? "default" : "secondary"} className={ch.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-muted-foreground"}>
                    {ch.isActive ? "Активна" : "Скрыта"}
                  </Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Skills Tab */}
          <TabsContent value="skills" className="space-y-4">
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold text-sm">Все навыки ({skills.length})</h3>
              </div>
              {skills.map((skill) => (
                <div key={skill.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{skill.name}</p>
                    <p className="text-xs text-muted-foreground">{skill.slug} • {skill.category} • {skill.requiredXp} XP</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-4">
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold text-sm">Все достижения ({achievements.length})</h3>
              </div>
              {achievements.map((ach) => (
                <div key={ach.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{ach.name}</p>
                    <p className="text-xs text-muted-foreground">{ach.slug} • {ach.category} • +{ach.xpReward} XP</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Users Tab */}
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
                  <Badge variant="outline" className="bg-white/5 border-white/5">{user.role}</Badge>
                  <span className="text-xs text-emerald-400">Ур. {user.level}</span>
                  <span className="text-xs text-amber-400">{user.xp} XP</span>
                  <span className="text-xs text-muted-foreground">{user._count.attempts} попыток</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
