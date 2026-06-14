import { NextResponse } from "next/server";

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1600">
  <title>Дашборд — Мокап редизайна</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            bg: '#0a0a0f',
            surface: '#111118',
            card: '#16161f',
            border: 'rgba(255,255,255,0.06)',
            emerald: { 400: '#34d399', 500: '#10b981', 600: '#059669' },
            muted: '#71717a',
          }
        }
      }
    }
  <\/script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #0a0a0f;
      color: #e4e4e7;
      overflow: hidden;
      height: 100vh;
      width: 100vw;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .glass {
      background: rgba(22, 22, 31, 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.06);
    }
    .gradient-text {
      background: linear-gradient(135deg, #34d399, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .glow-emerald { box-shadow: 0 0 12px rgba(16, 185, 129, 0.15); }
    .sidebar-icon {
      display: flex; align-items: center; justify-content: center;
      width: 42px; height: 42px; border-radius: 12px;
      cursor: pointer; transition: all 0.2s; color: #71717a; position: relative;
    }
    .sidebar-icon:hover { background: rgba(255,255,255,0.06); color: #e4e4e7; }
    .sidebar-icon.active { background: rgba(16,185,129,0.15); color: #34d399; }
    .sidebar-icon[data-tooltip]:hover::after {
      content: attr(data-tooltip); position: absolute; left: 56px; top: 50%;
      transform: translateY(-50%); background: #1e1e2e;
      border: 1px solid rgba(255,255,255,0.1); color: #e4e4e7;
      padding: 4px 10px; border-radius: 6px; font-size: 12px;
      white-space: nowrap; z-index: 100; pointer-events: none;
    }
    .xp-bar-track { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
    .xp-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #10b981, #34d399); transition: width 0.6s ease; }
    .heatmap-cell { width: 14px; height: 14px; border-radius: 3px; transition: all 0.15s; }
    .heatmap-cell:hover { transform: scale(1.3); }
    .roadmap-node {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: all 0.2s; position: relative;
    }
    .roadmap-node:hover { transform: scale(1.1); }
    .roadmap-connector { height: 2px; flex: 1; min-width: 20px; }
    .task-item {
      padding: 10px 12px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.06);
      background: rgba(22,22,31,0.5); cursor: pointer; transition: all 0.2s;
    }
    .task-item:hover { border-color: rgba(255,255,255,0.12); background: rgba(22,22,31,0.8); }
    .custom-scroll::-webkit-scrollbar { width: 4px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
    @keyframes flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    .streak-fire { animation: flicker 1.5s ease-in-out infinite; }
    @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(1.6); opacity: 0; } }
    .pulse-ring::before {
      content: ''; position: absolute; inset: -4px; border-radius: 50%;
      border: 2px solid #34d399; animation: pulse-ring 2s ease-out infinite;
    }
  </style>
</head>
<body>
  <div style="width:1600px; height:920px; max-width:1600px; max-height:920px;"
       class="flex overflow-hidden bg-bg rounded-2xl border border-white/5 shadow-2xl">

    <aside style="width:70px; min-width:70px;" class="h-full flex flex-col items-center py-4 border-r border-white/5 bg-surface">
      <div class="mb-6">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/20 glow-emerald flex items-center justify-center cursor-pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
      </div>
      <nav class="flex flex-col gap-2 flex-1">
        <div class="sidebar-icon active" data-tooltip="Главная">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div class="sidebar-icon" data-tooltip="Задачи">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        </div>
        <div class="sidebar-icon" data-tooltip="База знаний">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        </div>
        <div class="sidebar-icon" data-tooltip="Рейтинг">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
        </div>
        <div class="sidebar-icon" data-tooltip="Марафон">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
        </div>
      </nav>
      <div class="flex flex-col gap-2 items-center">
        <div class="sidebar-icon" data-tooltip="Настройки">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </div>
      </div>
    </aside>

    <div class="flex-1 flex flex-col h-full overflow-hidden">
      <header style="height:60px; min-height:60px;" class="flex items-center justify-between px-5 border-b border-white/5 bg-surface/50 backdrop-blur-md">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold">Главная</h2>
          <span class="text-xs text-muted bg-white/5 px-2 py-0.5 rounded-full">Уровень 12</span>
        </div>
        <div class="flex items-center gap-4 flex-1 max-w-md mx-8">
          <div class="flex-1">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] text-muted">2,450 / 3,000 XP</span>
            </div>
            <div class="xp-bar-track">
              <div class="xp-bar-fill" style="width: 82%"></div>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5 bg-orange-500/10 rounded-lg px-2.5 py-1.5 cursor-pointer">
            <span class="streak-fire text-sm">🔥</span>
            <span class="text-sm font-semibold text-orange-400">14</span>
          </div>
          <div class="flex items-center gap-1 text-sm">
            <span style="color:#ef4444">❤️</span>
            <span style="color:#ef4444">❤️</span>
            <span style="color:#ef4444">❤️</span>
          </div>
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-purple-500 flex items-center justify-center text-xs font-bold cursor-pointer ring-2 ring-emerald-500/30">А</div>
        </div>
      </header>

      <div class="grid grid-cols-12 gap-5 h-full p-5">
        <div class="col-span-9 flex flex-col gap-5 min-h-0">
          <div class="flex-1 glass rounded-2xl p-5 flex flex-col min-h-0">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </div>
                <div>
                  <h3 class="font-semibold text-base">Текущий урок</h3>
                  <p class="text-xs text-muted mt-0.5">Модуль 3 • Запросы в 1С</p>
                </div>
              </div>
              <button class="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-all hover:bg-emerald-500/20">
                Продолжить
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            </div>
            <div class="flex-1 flex gap-5 min-h-0">
              <div class="flex-1 flex flex-col">
                <div class="glass rounded-xl p-4 flex-1 flex flex-col">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">Средний</span>
                    <span class="text-[11px] text-muted">• 25 мин</span>
                    <span class="text-[11px] text-muted">• +120 XP</span>
                  </div>
                  <h4 class="font-semibold text-lg mb-2">Сложные запросы: объединения и подзапросы</h4>
                  <p class="text-sm text-muted leading-relaxed mb-4">Изучите продвинутые техники работы с запросами в 1С: объединение нескольких таблиц, использование подзапросов для фильтрации, временные таблицы и пакетные запросы. На практическом задании закрепите навыки построения эффективных запросов.</p>
                  <div class="mt-auto flex items-center gap-4">
                    <div class="flex items-center gap-2">
                      <div class="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden"><div class="h-full bg-emerald-500 rounded-full" style="width:65%"></div></div>
                      <span class="text-[11px] text-muted">65%</span>
                    </div>
                    <div class="flex -space-x-1.5 ml-auto">
                      <div class="w-6 h-6 rounded-full bg-purple-500/30 border-2 border-card flex items-center justify-center text-[9px]">М</div>
                      <div class="w-6 h-6 rounded-full bg-blue-500/30 border-2 border-card flex items-center justify-center text-[9px]">К</div>
                      <div class="w-6 h-6 rounded-full bg-orange-500/30 border-2 border-card flex items-center justify-center text-[9px]">Д</div>
                      <div class="w-6 h-6 rounded-full bg-white/10 border-2 border-card flex items-center justify-center text-[9px]">+5</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="w-56 flex flex-col gap-3">
                <div class="glass rounded-xl p-3 text-center"><div class="text-2xl font-bold gradient-text">147</div><div class="text-[11px] text-muted mt-1">Решено задач</div></div>
                <div class="glass rounded-xl p-3 text-center"><div class="text-2xl font-bold text-orange-400">14</div><div class="text-[11px] text-muted mt-1">Дней серия</div></div>
                <div class="glass rounded-xl p-3 text-center"><div class="text-2xl font-bold text-purple-400">#23</div><div class="text-[11px] text-muted mt-1">В рейтинге</div></div>
              </div>
            </div>
          </div>
          <div style="height:160px; min-height:160px;" class="glass rounded-2xl p-4 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-medium text-sm">Дорожная карта</h3>
              <span class="text-[11px] text-muted">6 из 18 модулей</span>
            </div>
            <div class="flex-1 flex items-center">
              <div class="flex items-center gap-0 w-full px-2">
                <div class="roadmap-node bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/30">1</div><div class="roadmap-connector bg-emerald-500/30"></div>
                <div class="roadmap-node bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/30">2</div><div class="roadmap-connector bg-emerald-500/30"></div>
                <div class="roadmap-node bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/30">3</div><div class="roadmap-connector bg-emerald-500/30"></div>
                <div class="roadmap-node bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/30">4</div><div class="roadmap-connector bg-emerald-500/30"></div>
                <div class="roadmap-node bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/30">5</div><div class="roadmap-connector bg-emerald-500/30"></div>
                <div class="roadmap-node bg-emerald-500/30 text-emerald-300 border-2 border-emerald-400 pulse-ring" style="z-index:1">6</div><div class="roadmap-connector bg-white/10"></div>
                <div class="roadmap-node bg-white/5 text-muted border-2 border-white/10">7</div><div class="roadmap-connector bg-white/10"></div>
                <div class="roadmap-node bg-white/5 text-muted border-2 border-white/10">8</div><div class="roadmap-connector bg-white/10"></div>
                <div class="roadmap-node bg-white/5 text-muted border-2 border-white/10">9</div><div class="roadmap-connector bg-white/10"></div>
                <div class="roadmap-node bg-white/5 text-muted border-2 border-white/10 text-[10px]">···</div><div class="roadmap-connector bg-white/10"></div>
                <div class="roadmap-node bg-white/5 text-muted border-2 border-white/10">18</div>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-1 text-[10px] text-muted">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Пройдено</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30 inline-block"></span> Текущий</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-white/10 inline-block"></span> Заблокирован</span>
            </div>
          </div>
        </div>

        <div class="col-span-3 flex flex-col gap-5 min-h-0">
          <div class="flex-1 glass rounded-2xl p-4 flex flex-col min-h-0">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-medium text-sm">Активные задачи</h3>
              <span class="text-[11px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">3</span>
            </div>
            <div class="flex-1 flex flex-col gap-2.5 overflow-y-auto custom-scroll pr-1">
              <div class="task-item">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">Сложный</span>
                  <span class="text-[10px] text-muted ml-auto">+80 XP</span>
                </div>
                <p class="text-sm font-medium leading-snug">Оптимизация запроса с временными таблицами</p>
                <div class="flex items-center gap-2 mt-2"><div class="flex-1 h-1 bg-white/5 rounded-full overflow-hidden"><div class="h-full bg-red-400 rounded-full" style="width:30%"></div></div><span class="text-[10px] text-muted">30%</span></div>
              </div>
              <div class="task-item">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium">Средний</span>
                  <span class="text-[10px] text-muted ml-auto">+50 XP</span>
                </div>
                <p class="text-sm font-medium leading-snug">Обработка событий при изменении реквизитов</p>
                <div class="flex items-center gap-2 mt-2"><div class="flex-1 h-1 bg-white/5 rounded-full overflow-hidden"><div class="h-full bg-yellow-400 rounded-full" style="width:70%"></div></div><span class="text-[10px] text-muted">70%</span></div>
              </div>
              <div class="task-item">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">Лёгкий</span>
                  <span class="text-[10px] text-muted ml-auto">+30 XP</span>
                </div>
                <p class="text-sm font-medium leading-snug">Создание регистра сведений</p>
                <div class="flex items-center gap-2 mt-2"><div class="flex-1 h-1 bg-white/5 rounded-full overflow-hidden"><div class="h-full bg-emerald-400 rounded-full" style="width:0%"></div></div><span class="text-[10px] text-muted">0%</span></div>
              </div>
              <div class="task-item border-emerald-500/20 bg-emerald-500/5">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Ежедневная</span>
                  <span class="text-[10px] text-muted ml-auto">+60 XP</span>
                </div>
                <p class="text-sm font-medium leading-snug">Рефакторинг модуля: вынести общие функции</p>
                <div class="flex items-center gap-2 mt-2"><div class="flex-1 h-1 bg-white/5 rounded-full overflow-hidden"><div class="h-full bg-emerald-400 rounded-full" style="width:0%"></div></div><span class="text-[10px] text-muted">0%</span></div>
              </div>
            </div>
          </div>
          <div style="height:150px; min-height:150px;" class="glass rounded-2xl p-4 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-medium text-sm">Активность</h3>
              <span class="text-[11px] text-muted">Последние 12 недель</span>
            </div>
            <div class="flex-1 flex items-end"><div class="flex gap-[3px] flex-wrap" id="heatmap"></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const heatmap = document.getElementById('heatmap');
    const levels = ['rgba(255,255,255,0.03)','rgba(16,185,129,0.15)','rgba(16,185,129,0.3)','rgba(16,185,129,0.5)','rgba(16,185,129,0.75)'];
    for (let w = 0; w < 12; w++) {
      for (let d = 0; d < 7; d++) {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        let level; const recency = w / 12; const isWeekend = d >= 5; const rand = Math.random();
        if (rand < 0.25 * (1 - recency)) level = 0;
        else if (isWeekend && rand < 0.5) level = 0;
        else if (rand < 0.35) level = 1;
        else if (rand < 0.55) level = 2;
        else if (rand < 0.8) level = 3;
        else level = 4;
        if (w >= 10 && !isWeekend) level = Math.max(level, 2);
        if (w === 11) level = Math.max(level, 3);
        cell.style.background = levels[level];
        heatmap.appendChild(cell);
      }
    }
    document.querySelectorAll('.sidebar-icon').forEach(icon => {
      icon.addEventListener('click', function() {
        document.querySelectorAll('.sidebar-icon').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
      });
    });
    document.querySelectorAll('.task-item').forEach(task => {
      task.addEventListener('click', function() {
        this.style.borderColor = 'rgba(52,211,153,0.3)';
        setTimeout(() => { this.style.borderColor = ''; }, 1000);
      });
    });
    document.querySelectorAll('.roadmap-node').forEach(node => {
      node.addEventListener('click', function() {
        if (this.classList.contains('pulse-ring') || this.textContent.trim().match(/^[1-6]$/)) {
          this.style.transform = 'scale(1.2)';
          setTimeout(() => { this.style.transform = ''; }, 200);
        }
      });
    });
  <\/script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
