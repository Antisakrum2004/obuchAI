// XP required for a given level: 100 * level^1.5
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// Total XP required to reach a level from level 1
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

// Calculate level from total XP
export function calculateLevel(totalXp: number): number {
  let level = 1;
  let accumulated = 0;
  while (accumulated + xpForLevel(level) <= totalXp) {
    accumulated += xpForLevel(level);
    level++;
  }
  return level;
}

// XP progress within current level
export function xpProgressInLevel(totalXp: number): { current: number; required: number; percentage: number } {
  const level = calculateLevel(totalXp);
  const xpForPreviousLevels = totalXpForLevel(level);
  const current = totalXp - xpForPreviousLevels;
  const required = xpForLevel(level);
  const percentage = Math.min((current / required) * 100, 100);
  return { current, required, percentage };
}

// XP reward for challenge difficulty
export function xpForDifficulty(difficulty: string): number {
  switch (difficulty) {
    case "easy": return 25;
    case "medium": return 50;
    case "hard": return 100;
    default: return 25;
  }
}

// Streak bonus XP
export function streakBonus(streak: number): number {
  if (streak > 0 && streak % 30 === 0) return 1000;
  if (streak > 0 && streak % 7 === 0) return 200;
  return 0;
}

// Check if streak is broken (48h inactivity rule)
export function isStreakBroken(lastActiveAt: Date | null): boolean {
  if (!lastActiveAt) return false;
  const now = new Date();
  const diffHours = (now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60);
  return diffHours > 48;
}

// Difficulty label in Russian
export function difficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case "easy": return "Легко";
    case "medium": return "Средне";
    case "hard": return "Сложно";
    default: return difficulty;
  }
}

// Difficulty color class
export function difficultyColor(difficulty: string): string {
  switch (difficulty) {
    case "easy": return "text-emerald-400";
    case "medium": return "text-amber-400";
    case "hard": return "text-red-400";
    default: return "text-gray-400";
  }
}

// Difficulty badge class
export function difficultyBadgeClass(difficulty: string): string {
  switch (difficulty) {
    case "easy": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "medium": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "hard": return "bg-red-500/20 text-red-400 border-red-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

// Category label in Russian
export function categoryLabel(category: string): string {
  switch (category) {
    case "prompting": return "Промптинг";
    case "agents": return "AI Агенты";
    case "tools": return "Инструменты";
    case "automation": return "Автоматизация";
    case "1c": return "1С";
    case "debugging": return "Дебаггинг";
    case "workflow": return "Workflow";
    case "review": return "Ревью";
    default: return category;
  }
}

// Category emoji
export function categoryEmoji(category: string): string {
  switch (category) {
    case "prompting": return "✍️";
    case "agents": return "🤖";
    case "tools": return "🛠️";
    case "automation": return "⚡";
    case "1c": return "🖥️";
    case "debugging": return "🔍";
    case "workflow": return "🔄";
    case "review": return "👀";
    default: return "📚";
  }
}

// Type label in Russian
export function typeLabel(type: string): string {
  switch (type) {
    case "multiple_choice": return "Выбор ответа";
    case "prompt_fix": return "Исправление промпта";
    case "text_input": return "Ввод текста";
    case "ordering": return "Упорядочивание";
    case "workflow_build": return "Сборка workflow";
    default: return type;
  }
}
