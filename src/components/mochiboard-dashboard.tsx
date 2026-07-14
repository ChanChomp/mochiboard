'use client';

import { useEffect, useState, type FormEvent, type ReactElement } from 'react';

import { supabase } from '@/lib/supabase';

type ThemeKey = 'peach' | 'strawberry' | 'matcha' | 'ube' | 'black-sesame';

type ThemeOption = {
  id: ThemeKey;
  label: string;
  swatch: string;
};

type PlannerDay = {
  key: string;
  label: string;
  dateNumber: number;
  isToday: boolean;
};

type TaskRow = {
  id: string;
  created_at: string;
  title: string;
  time_label: string | null;
  description: string | null;
  is_complete: boolean;
  day: string;
};

type WidgetIcon = {
  peach: ReactElement;
  strawberry: ReactElement;
  matcha: ReactElement;
  ube: ReactElement;
  'black-sesame': ReactElement;
};

type ThemePalette = {
  background: string;
  foreground: string;
  surface: string;
  surfaceStrong: string;
  surfaceSoft: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentContrast: string;
  muted: string;
  border: string;
  shadow: string;
  shadowSoft: string;
  mascotFill: string;
  mascotStroke: string;
  mascotBlush: string;
};

const themeOptions: ThemeOption[] = [
  { id: 'peach', label: 'Peach', swatch: '#d97a4d' },
  { id: 'strawberry', label: 'Strawberry', swatch: '#dd6f8f' },
  { id: 'matcha', label: 'Matcha', swatch: '#86b06f' },
  { id: 'ube', label: 'Ube', swatch: '#a57ad8' },
  { id: 'black-sesame', label: 'Black Sesame', swatch: '#4a4a4a' },
];

const widgetIcons: WidgetIcon = {
  peach: (
    <svg viewBox="0 0 40 40" className="h-6 w-6 shrink-0" aria-hidden="true">
      <circle cx="20" cy="21" r="15" fill="#EFA36C" />
      <path d="M20 6 Q22 9 20 12" stroke="#5A7A3E" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="14" cy="15" rx="4" ry="3" fill="#FFF3E6" opacity="0.8" transform="rotate(-25 14 15)" />
    </svg>
  ),
  strawberry: (
    <svg viewBox="0 0 40 40" className="h-6 w-6 shrink-0" aria-hidden="true">
      <path d="M20 7 C29 7 33 19 26 29 C23 34 17 34 14 29 C7 19 11 7 20 7 Z" fill="#F06E93" />
      <circle cx="16" cy="19" r="1.5" fill="#FFE8EF" />
      <circle cx="24" cy="19" r="1.5" fill="#FFE8EF" />
      <circle cx="20" cy="25" r="1.5" fill="#FFE8EF" />
      <path d="M14 9 Q20 3 26 9" stroke="#5A9450" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="15" cy="13" rx="3" ry="2" fill="#FFF" opacity="0.5" transform="rotate(-20 15 13)" />
    </svg>
  ),
  matcha: (
    <svg viewBox="0 0 40 40" className="h-6 w-6 shrink-0" aria-hidden="true">
      <circle cx="20" cy="21" r="15" fill="#B9D89A" />
      <path d="M20 8 Q26 8 27 15 Q20 18 13 15 Q14 8 20 8 Z" fill="#8CA86E" />
      <ellipse cx="14" cy="16" rx="3" ry="2" fill="#F1F7E8" opacity="0.7" transform="rotate(-20 14 16)" />
    </svg>
  ),
  ube: (
    <svg viewBox="0 0 40 40" className="h-6 w-6 shrink-0" aria-hidden="true">
      <ellipse cx="20" cy="20" rx="15" ry="16" fill="#BB9DDA" />
      <path d="M20 8 C16 14 16 26 20 32" stroke="#8A6BAE" strokeWidth="1.5" fill="none" />
      <ellipse cx="14" cy="14" rx="3.5" ry="2.5" fill="#F3EBFA" opacity="0.7" transform="rotate(-25 14 14)" />
    </svg>
  ),
  'black-sesame': (
    <svg viewBox="0 0 40 40" className="h-6 w-6 shrink-0" aria-hidden="true">
      <circle cx="20" cy="20" r="15" fill="#3A3836" />
      <ellipse cx="14" cy="14" rx="3" ry="2" fill="#F1EFE8" opacity="0.5" transform="rotate(-25 14 14)" />
      <ellipse cx="16" cy="17" rx="2.3" ry="1.4" fill="#F1EFE8" transform="rotate(-20 16 17)" />
      <ellipse cx="25" cy="24" rx="2.3" ry="1.4" fill="#F1EFE8" transform="rotate(-30 25 24)" />
    </svg>
  ),
};

const getCurrentWeekDays = (baseDate = new Date()): PlannerDay[] => {
  const today = new Date(baseDate);
  const dayIndex = today.getDay();
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return {
      key,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNumber: date.getDate(),
      isToday: date.toDateString() === today.toDateString(),
    };
  });
};

const themePalettes: Record<ThemeKey, ThemePalette> = {
  peach: {
    background: '#fffaf5',
    foreground: '#52372f',
    surface: '#fff6eb',
    surfaceStrong: '#fff0e2',
    surfaceSoft: '#fff8ef',
    accent: '#d97a4d',
    accentStrong: '#b95d31',
    accentSoft: '#f2c7a2',
    accentContrast: '#fffdfa',
    muted: '#8b6757',
    border: '#efd8c5',
    shadow: '0 22px 70px rgba(166, 94, 56, 0.14)',
    shadowSoft: '0 12px 30px rgba(166, 94, 56, 0.08)',
    mascotFill: '#fcefe3',
    mascotStroke: '#6b3f2a',
    mascotBlush: '#f3b79c',
  },
  strawberry: {
    background: '#fff7fa',
    foreground: '#6a3347',
    surface: '#fff0f4',
    surfaceStrong: '#ffe7ee',
    surfaceSoft: '#fff8fb',
    accent: '#e58aa4',
    accentStrong: '#c95f7a',
    accentSoft: '#f5c7d3',
    accentContrast: '#fffdfd',
    muted: '#8e5a6d',
    border: '#f2d0db',
    shadow: '0 22px 70px rgba(202, 95, 122, 0.14)',
    shadowSoft: '0 12px 30px rgba(202, 95, 122, 0.08)',
    mascotFill: '#fff1f5',
    mascotStroke: '#7f4252',
    mascotBlush: '#f0a7bb',
  },
  matcha: {
    background: '#f7fcf4',
    foreground: '#37523d',
    surface: '#eef8ea',
    surfaceStrong: '#e5f4df',
    surfaceSoft: '#f8fdf6',
    accent: '#8bbd78',
    accentStrong: '#5d8d57',
    accentSoft: '#cfe5c0',
    accentContrast: '#fdfefb',
    muted: '#61795e',
    border: '#d9e9cf',
    shadow: '0 22px 70px rgba(93, 141, 87, 0.14)',
    shadowSoft: '0 12px 30px rgba(93, 141, 87, 0.08)',
    mascotFill: '#f2f8ea',
    mascotStroke: '#436448',
    mascotBlush: '#c8dda8',
  },
  ube: {
    background: '#faf7ff',
    foreground: '#4d3f63',
    surface: '#f2ebff',
    surfaceStrong: '#e9defc',
    surfaceSoft: '#fcf9ff',
    accent: '#a77edc',
    accentStrong: '#7d56b6',
    accentSoft: '#d7c4f5',
    accentContrast: '#fdfdff',
    muted: '#78658d',
    border: '#e2d3f8',
    shadow: '0 22px 70px rgba(125, 86, 182, 0.14)',
    shadowSoft: '0 12px 30px rgba(125, 86, 182, 0.08)',
    mascotFill: '#f5eeff',
    mascotStroke: '#6a4e97',
    mascotBlush: '#c3aee9',
  },
  'black-sesame': {
    background: '#121212',
    foreground: '#f5f0e8',
    surface: '#1b1b1b',
    surfaceStrong: '#232323',
    surfaceSoft: '#1f1f1f',
    accent: '#cfc1a6',
    accentStrong: '#e9ddc3',
    accentSoft: '#4f4a41',
    accentContrast: '#121212',
    muted: '#c3b49b',
    border: '#3c362f',
    shadow: '0 22px 70px rgba(0, 0, 0, 0.35)',
    shadowSoft: '0 12px 30px rgba(0, 0, 0, 0.24)',
    mascotFill: '#2f2a24',
    mascotStroke: '#f5f0e8',
    mascotBlush: '#b8a88e',
  },
};

const getStoredTheme = (): ThemeKey => {
  if (typeof window === 'undefined') {
    return 'peach';
  }

  const stored = window.localStorage.getItem('mochiboard-theme') as ThemeKey | null;
  return stored && themeOptions.some((option) => option.id === stored) ? stored : 'peach';
};

const applyTheme = (theme: ThemeKey) => {
  if (typeof window === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const palette = themePalettes[theme];

  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme === 'black-sesame' ? 'dark' : 'light';
  root.style.setProperty('--background', palette.background);
  root.style.setProperty('--foreground', palette.foreground);
  root.style.setProperty('--surface', palette.surface);
  root.style.setProperty('--surface-strong', palette.surfaceStrong);
  root.style.setProperty('--surface-soft', palette.surfaceSoft);
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-strong', palette.accentStrong);
  root.style.setProperty('--accent-soft', palette.accentSoft);
  root.style.setProperty('--accent-contrast', palette.accentContrast);
  root.style.setProperty('--muted', palette.muted);
  root.style.setProperty('--border', palette.border);
  root.style.setProperty('--shadow', palette.shadow);
  root.style.setProperty('--shadow-soft', palette.shadowSoft);
  root.style.setProperty('--mascot-fill', palette.mascotFill);
  root.style.setProperty('--mascot-stroke', palette.mascotStroke);
  root.style.setProperty('--mascot-blush', palette.mascotBlush);

  document.body.style.backgroundColor = palette.background;
  document.body.style.color = palette.foreground;
};

export default function MochiboardDashboard() {
  const [theme, setTheme] = useState<ThemeKey>('peach');

  useEffect(() => {
    const initialTheme = getStoredTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem('mochiboard-theme', theme);
  }, [theme]);

  const initialWeekDays = getCurrentWeekDays();
  const [weekDays] = useState<PlannerDay[]>(initialWeekDays);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [selectedDay, setSelectedDay] = useState(initialWeekDays.find((day) => day.isToday)?.key ?? initialWeekDays[0].key);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);

  useEffect(() => {
    const loadTasks = async () => {
      setIsLoadingTasks(true);
      setTaskError(null);

      const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });

      if (error) {
        setTaskError('Unable to load tasks right now.');
        setTasks([]);
      } else {
        setTasks(data ?? []);
      }

      setIsLoadingTasks(false);
    };

    void loadTasks();
  }, []);

  const selectedDayMeta = weekDays.find((day) => day.key === selectedDay);
  const visibleTasks = tasks.filter((task) => task.day === selectedDay || (selectedDayMeta ? task.day === selectedDayMeta.label : false));

  const handleToggleTask = async (task: TaskRow) => {
    const nextValue = !task.is_complete;

    setTasks((currentTasks) =>
      currentTasks.map((item) => (item.id === task.id ? { ...item, is_complete: nextValue } : item))
    );

    const { error } = await supabase.from('tasks').update({ is_complete: nextValue }).eq('id', task.id);

    if (error) {
      setTaskError('Unable to update that task.');
      setTasks((currentTasks) =>
        currentTasks.map((item) => (item.id === task.id ? { ...item, is_complete: task.is_complete } : item))
      );
    }
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = newTaskTitle.trim();
    if (!title) {
      return;
    }

    setIsSavingTask(true);
    setTaskError(null);

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        day: selectedDay,
        time_label: newTaskTime.trim() || null,
        description: newTaskDescription.trim() || null,
        is_complete: false,
      })
      .select()
      .single();

    if (error) {
      setTaskError('Unable to add that task.');
    } else if (data) {
      setTasks((currentTasks) => [...currentTasks, data]);
      setNewTaskTitle('');
      setNewTaskTime('');
      setNewTaskDescription('');
    }

    setIsSavingTask(false);
  };

  const navItems = [
    { href: '#planner', label: 'Planner' },
    { href: '#wellness', label: 'Health & Fitness' },
    { href: '#finances', label: 'Finances' },
    { href: '#notes', label: 'Notes' },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <header
          className="mb-8 rounded-[36px] border border-[color:var(--border)] p-6 shadow-[var(--shadow)]"
          style={{ background: 'linear-gradient(135deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <svg width="66" height="66" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
                <ellipse cx="50" cy="58" rx="38" ry="34" fill={themePalettes[theme].mascotFill} stroke={themePalettes[theme].mascotStroke} strokeWidth="2.5" />
                <path d="M32 55 Q37 60 42 55" fill="none" stroke={themePalettes[theme].mascotStroke} strokeWidth="2.5" strokeLinecap="round" />
                <path d="M58 55 Q63 60 68 55" fill="none" stroke={themePalettes[theme].mascotStroke} strokeWidth="2.5" strokeLinecap="round" />
                <path d="M42 68 Q50 74 58 68" fill="none" stroke={themePalettes[theme].mascotStroke} strokeWidth="2.5" strokeLinecap="round" />
                <ellipse cx="30" cy="63" rx="7" ry="5" fill={themePalettes[theme].mascotBlush} opacity="0.6" />
                <ellipse cx="70" cy="63" rx="7" ry="5" fill={themePalettes[theme].mascotBlush} opacity="0.6" />
              </svg>
              <div className="flex flex-col">
                <span className="inline-flex rounded-full bg-[color:var(--accent-soft)]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                  mochiboard
                </span>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                  Hello, Chan!
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
                {navItems.map((item, index) => {
                  const isActive = index === 0;
                  return (
                    <a
                      key={item.href}
                      className={`rounded-full px-4 py-2 transition ${
                        isActive
                          ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow-[var(--shadow-soft)]'
                          : 'hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]'
                      }`}
                      href={item.href}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </nav>

              <div className="flex flex-col items-end gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  CHOOSE YOUR MOCHI
                </p>
                <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-3 py-2 shadow-[var(--shadow-soft)]">
                  {themeOptions.map((option) => {
                    const isActive = theme === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-label={`Switch to ${option.label}`}
                        onClick={() => setTheme(option.id)}
                        className={`h-6 w-6 rounded-full border transition ${isActive ? 'scale-110 border-[color:var(--foreground)]' : 'border-[color:var(--border)]'}`}
                        style={{ backgroundColor: option.swatch }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="space-y-8">
          <section
            className="rounded-[36px] border border-[color:var(--border)] p-6 shadow-[var(--shadow)]"
            style={{ background: 'linear-gradient(135deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">Dashboard</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                  Your week at a glance
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                  Built for people who want a calm, cozy overview of plans, wellness, and money without feeling cluttered.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] bg-[color:var(--surface-soft)] px-4 py-4 text-center shadow-[var(--shadow-soft)]">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Focus</span>
                  <span className="mt-2 block text-2xl font-semibold text-[color:var(--foreground)]">3</span>
                </div>
                <div className="rounded-[24px] bg-[color:var(--surface-soft)] px-4 py-4 text-center shadow-[var(--shadow-soft)]">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Events</span>
                  <span className="mt-2 block text-2xl font-semibold text-[color:var(--foreground)]">8</span>
                </div>
                <div className="rounded-[24px] bg-[color:var(--surface-soft)] px-4 py-4 text-center shadow-[var(--shadow-soft)]">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Savings</span>
                  <span className="mt-2 block text-2xl font-semibold text-[color:var(--foreground)]">$1.8k</span>
                </div>
              </div>
            </div>
          </section>

          <section
            className="rounded-[32px] border border-[color:var(--border)] p-6 text-[color:var(--accent-contrast)] shadow-[var(--shadow)]"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, var(--accent) 82%, var(--accent-strong) 18%) 0%, color-mix(in srgb, var(--accent-strong) 84%, var(--accent) 16%) 100%)`,
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-current/80">Today’s focus</p>
                <h3 className="mt-2 text-2xl font-semibold">Launch your routines</h3>
              </div>
              <p className="max-w-xl text-sm leading-6 text-current/85">
                Check your planner, review sleep, and set a weekly budget for a smoother week.
              </p>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <section
              id="planner"
              className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]"
              style={{ background: 'linear-gradient(145deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Planner</p>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                    Today’s schedule
                  </h3>
                </div>
                <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                  {visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
                {weekDays.map((day) => {
                  const isActive = selectedDay === day.key;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setSelectedDay(day.key)}
                      className={`min-w-[64px] rounded-[22px] border px-3 py-2 text-center text-sm transition ${
                        isActive
                          ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
                          : 'border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--muted)]'
                      }`}
                    >
                      <p className="font-semibold">{day.label}</p>
                      <p className="mt-1 text-xs">{day.dateNumber}</p>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleCreateTask} className="mt-6 max-w-full rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 shadow-[var(--shadow-soft)]">
                <div className="flex flex-wrap gap-2">
                  <input
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="Add a new task"
                    className="min-w-0 flex-1 basis-[220px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingTask}
                    className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                  >
                    {isSavingTask ? 'Adding…' : 'Add task'}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={newTaskTime}
                    onChange={(event) => setNewTaskTime(event.target.value)}
                    placeholder="Time"
                    className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <input
                    value={newTaskDescription}
                    onChange={(event) => setNewTaskDescription(event.target.value)}
                    placeholder="Notes"
                    className="min-w-0 flex-1 basis-[180px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                </div>
              </form>

              {taskError ? <p className="mt-4 text-sm text-[color:var(--accent-strong)]">{taskError}</p> : null}

              <div className="mt-6 space-y-4">
                {isLoadingTasks ? (
                  <p className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                    Loading your planner…
                  </p>
                ) : visibleTasks.length === 0 ? (
                  <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                    {tasks.length === 0 ? 'No tasks yet — add one to get started.' : `No tasks for ${selectedDay} yet.`}
                  </div>
                ) : (
                  visibleTasks.map((task) => (
                    <div key={task.id} className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 shadow-[var(--shadow-soft)]">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.is_complete}
                          onChange={() => void handleToggleTask(task)}
                          className="mt-1 h-5 w-5 rounded border-[color:var(--accent)] accent-[color:var(--accent)]"
                        />
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${task.is_complete ? 'text-[color:var(--muted)] line-through' : 'text-[color:var(--foreground)]'}`}>
                            {task.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted)]">
                            {task.time_label ? <span>{task.time_label}</span> : null}
                            {task.description ? <span>· {task.description}</span> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section
              id="wellness"
              className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]"
              style={{ background: 'linear-gradient(145deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Health & Fitness</p>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                    Wellness summary
                  </h3>
                </div>
                <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                  On track
                </span>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow-soft)]">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">Sleep</p>
                  <div className="mt-3 flex items-end gap-3">
                    <p className="text-3xl font-semibold text-[color:var(--foreground)]">7.8h</p>
                    <p className="text-sm text-[color:var(--muted)]">goal 8h</p>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--accent-soft)]">
                    <div className="h-2 w-[98%] rounded-full bg-[color:var(--accent)]" />
                  </div>
                </div>
                <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow-soft)]">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">Steps</p>
                  <div className="mt-3 flex items-end gap-3">
                    <p className="text-3xl font-semibold text-[color:var(--foreground)]">9.2k</p>
                    <p className="text-sm text-[color:var(--muted)]">goal 10k</p>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--accent-soft)]">
                    <div className="h-2 w-[92%] rounded-full bg-[color:var(--accent)]" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow-soft)]">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">Water</p>
                    <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">1.8L</p>
                    <p className="mt-2 text-sm text-[color:var(--muted)]">Goal 2L</p>
                  </div>
                  <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow-soft)]">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">Mindful</p>
                    <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">18m</p>
                    <p className="mt-2 text-sm text-[color:var(--muted)]">Goal 20m</p>
                  </div>
                </div>
              </div>
            </section>

            <section
              id="finances"
              className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]"
              style={{ background: 'linear-gradient(145deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Finances</p>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                    Budget snapshot
                  </h3>
                </div>
                <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                  Monthly
                </span>
              </div>

              <div className="mt-6 space-y-5">
                <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--foreground)]">Available balance</p>
                      <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">$4,250</p>
                    </div>
                    <span className="rounded-[18px] bg-[color:var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--accent-strong)]">
                      +12.4%
                    </span>
                  </div>
                </div>
                <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow-soft)]">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">Spending categories</p>
                  <div className="mt-5 space-y-4">
                    {[
                      { label: 'Housing', amount: '$1,200' },
                      { label: 'Food', amount: '$420' },
                      { label: 'Savings', amount: '$520' },
                    ].map((item) => (
                      <div key={item.label} className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-[color:var(--muted)]">
                          <span>{item.label}</span>
                          <span>{item.amount}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[color:var(--accent-soft)]">
                          <div className={`h-2 rounded-full ${item.label === 'Housing' ? 'bg-[color:var(--accent)] w-[48%]' : item.label === 'Food' ? 'bg-[color:var(--accent)] w-[19%]' : 'bg-[color:var(--accent)] w-[21%]'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
