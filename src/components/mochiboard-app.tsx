'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactElement } from 'react';

import { supabase } from '@/lib/supabase';

type ViewMode = 'dashboard' | 'planner' | 'health' | 'analytics';

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
  user_id: string | null;
};

type HealthLogRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  log_date: string;
  metric_type: string;
  value: number;
  unit: string | null;
};

type WorkoutRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  workout_date: string;
  name: string;
  workout_type: string | null;
  duration_minutes: number | null;
  notes: string | null;
};

type WorkoutExerciseRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  workout_id: string;
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight_lbs: number | null;
};

type MonthlyAgendaItem =
  | { type: 'task'; id: string; task: TaskRow }
  | { type: 'holiday'; id: string; name: string; isPast: boolean };

type MonthlyAgendaGroup = { dateKey: string; dateLabel: string; items: MonthlyAgendaItem[] };

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

const WORKOUT_TYPES = ['Cardio', 'Strength', 'Yoga', 'HIIT', 'Sports', 'Other'] as const;

const workoutTypeIcons: Record<string, ReactElement> = {
  Cardio: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s-7-4.2-9.3-8.3C1 8.4 3 5 6.5 5c1.9 0 3.4 1.2 5.5 3.6C14.1 6.2 15.6 5 17.5 5 21 5 23 8.4 21.3 11.7 19 15.8 12 20 12 20z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Strength: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="1" y="9" width="4" height="6" rx="1.2" stroke="currentColor" strokeWidth="2" />
      <rect x="19" y="9" width="4" height="6" rx="1.2" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="7" width="2.5" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="15.5" y="7" width="2.5" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Yoga: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7v6M12 13l-5 5M12 13l5 5M8 11l-3 2M16 11l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  HIIT: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Sports: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3v18M3 12h18M6 6c3 3 9 3 12 0M6 18c3-3 9-3 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Other: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  ),
};

const getStoredTheme = (): ThemeKey => {
  if (typeof window === 'undefined') {
    return 'peach';
  }

  const storedValue = window.localStorage.getItem('mochiboard-theme');
  return storedValue === 'strawberry' || storedValue === 'matcha' || storedValue === 'ube' || storedValue === 'black-sesame'
    ? storedValue
    : 'peach';
};

const applyTheme = (theme: ThemeKey) => {
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

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const formatFloridaTime = (date: Date) =>
  date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

const easternDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

type DateTimeParts = { year: number; month: number; day: number; hour: number; minute: number };

const getEasternDateTimeParts = (date: Date): DateTimeParts => {
  const lookup: Record<string, string> = {};
  easternDateTimeFormatter.formatToParts(date).forEach((part) => {
    if (part.type !== 'literal') {
      lookup[part.type] = part.value;
    }
  });

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
  };
};

const parseTaskTime = (timeLabel: string | null): { hour: number; minute: number } | null => {
  if (!timeLabel) {
    return null;
  }

  const matched = timeLabel.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!matched) {
    return null;
  }

  let hour = Number(matched[1]);
  const minute = matched[2] ? Number(matched[2]) : 0;
  const meridiem = matched[3]?.toUpperCase();

  if (meridiem === 'PM' && hour < 12) {
    hour += 12;
  }
  if (meridiem === 'AM' && hour === 12) {
    hour = 0;
  }

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return { hour, minute };
};

const compareDateTimeParts = (a: DateTimeParts, b: DateTimeParts) => {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day !== b.day) return a.day - b.day;
  if (a.hour !== b.hour) return a.hour - b.hour;
  return a.minute - b.minute;
};

const isTaskOverdue = (task: TaskRow, selectedDayKey: string, now: Date): boolean => {
  if (task.is_complete) {
    return false;
  }

  const parsedTime = parseTaskTime(task.time_label);
  if (!parsedTime) {
    return false;
  }

  const [year, month, day] = selectedDayKey.split('-').map(Number);
  if (!year || !month || !day) {
    return false;
  }

  const taskParts: DateTimeParts = { year, month, day, hour: parsedTime.hour, minute: parsedTime.minute };
  return compareDateTimeParts(taskParts, getEasternDateTimeParts(now)) < 0;
};

type StatsPeriod = 'day' | 'week' | 'month' | 'year';

const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthNamesFull = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const startOfWeekMonday = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayIndex = start.getDay();
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
  start.setDate(start.getDate() + mondayOffset);
  return start;
};

const getPeriodRange = (period: StatsPeriod, anchor: Date): { start: Date; end: Date } => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();

  if (period === 'day') {
    const start = new Date(year, month, day);
    return { start, end: start };
  }

  if (period === 'week') {
    const start = startOfWeekMonday(anchor);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start, end };
  }

  if (period === 'month') {
    return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
  }

  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
};

const shiftAnchorDate = (period: StatsPeriod, anchor: Date, direction: 1 | -1): Date => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();

  if (period === 'day') return new Date(year, month, day + direction);
  if (period === 'week') return new Date(year, month, day + direction * 7);
  if (period === 'month') return new Date(year, month + direction, 1);
  return new Date(year + direction, 0, 1);
};

const getPreviousPeriodRange = (period: StatsPeriod, anchor: Date) => getPeriodRange(period, shiftAnchorDate(period, anchor, -1));

const formatPeriodLabel = (period: StatsPeriod, anchor: Date): string => {
  const { start, end } = getPeriodRange(period, anchor);

  if (period === 'day') {
    return `${monthNamesFull[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  }

  if (period === 'week') {
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${monthNamesShort[start.getMonth()]} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${monthNamesShort[start.getMonth()]} ${start.getDate()} - ${monthNamesShort[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${monthNamesShort[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} - ${monthNamesShort[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }

  if (period === 'month') {
    return `${monthNamesFull[start.getMonth()]} ${start.getFullYear()}`;
  }

  return `${start.getFullYear()}`;
};

const formatCompactPeriodLabel = (period: 'day' | 'week' | 'month', anchor: Date): string => {
  const { start, end } = getPeriodRange(period, anchor);

  if (period === 'day') {
    return `${monthNamesShort[start.getMonth()]} ${start.getDate()}`;
  }

  if (period === 'month') {
    return `${monthNamesFull[start.getMonth()]} ${start.getFullYear()}`;
  }

  if (start.getMonth() === end.getMonth()) {
    return `${monthNamesShort[start.getMonth()]} ${start.getDate()}-${end.getDate()}`;
  }
  return `${monthNamesShort[start.getMonth()]} ${start.getDate()} - ${monthNamesShort[end.getMonth()]} ${end.getDate()}`;
};

const formatComparisonLabel = (period: StatsPeriod, anchor: Date): string => {
  if (period === 'day') return 'vs yesterday';
  if (period === 'week') return 'vs last week';

  const previousAnchor = shiftAnchorDate(period, anchor, -1);
  if (period === 'month') return `vs ${monthNamesFull[previousAnchor.getMonth()]}`;
  return `vs ${previousAnchor.getFullYear()}`;
};

const parseDayKeyToDate = (dayKey: string): Date | null => {
  const matched = dayKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  return new Date(year, month - 1, day);
};

const isDateWithinRange = (date: Date, start: Date, end: Date): boolean => {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
};

const computeStatChange = (current: number, previous: number): { direction: 'up' | 'down' | 'flat'; text: string } => {
  if (previous === 0) {
    if (current === 0) {
      return { direction: 'flat', text: 'No change' };
    }
    return { direction: 'up', text: 'New' };
  }

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) {
    return { direction: 'flat', text: 'No change' };
  }

  return { direction: percent > 0 ? 'up' : 'down', text: `${percent > 0 ? '↑' : '↓'} ${Math.abs(percent)}%` };
};

type VerseOfTheDay = { text: string; reference: string };

const upliftingVerses: VerseOfTheDay[] = [
  // Strength
  { text: 'I can do all things through Christ which strengtheneth me.', reference: 'Philippians 4:13' },
  { text: 'Be strong in the Lord, and in the power of his might.', reference: 'Ephesians 6:10' },
  { text: 'But my God shall supply all your need according to his riches in glory by Christ Jesus.', reference: 'Philippians 4:19' },
  { text: 'The joy of the LORD is your strength.', reference: 'Nehemiah 8:10' },
  { text: 'God is our refuge and strength, a very present help in trouble.', reference: 'Psalm 46:1' },
  { text: 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.', reference: '2 Timothy 1:7' },

  // Hope
  { text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.', reference: 'Jeremiah 29:11' },
  { text: 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.', reference: 'Romans 15:13' },
  { text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.', reference: 'Romans 8:28' },
  { text: 'Now faith is the substance of things hoped for, the evidence of things not seen.', reference: 'Hebrews 11:1' },
  { text: 'And hope maketh not ashamed; because the love of God is shed abroad in our hearts by the Holy Ghost which is given unto us.', reference: 'Romans 5:5' },
  { text: 'Looking for that blessed hope, and the glorious appearing of the great God and our Saviour Jesus Christ.', reference: 'Titus 2:13' },
  { text: 'Rejoicing in hope; patient in tribulation; continuing instant in prayer.', reference: 'Romans 12:12' },

  // Joy
  { text: 'This is the day which the LORD hath made; we will rejoice and be glad in it.', reference: 'Psalm 118:24' },
  { text: 'Weeping may endure for a night, but joy cometh in the morning.', reference: 'Psalm 30:5' },
  { text: 'These things have I spoken unto you, that my joy might remain in you, and that your joy might be full.', reference: 'John 15:11' },
  { text: 'Rejoice in the Lord alway: and again I say, Rejoice.', reference: 'Philippians 4:4' },
  { text: 'Rejoice evermore.', reference: '1 Thessalonians 5:16' },

  // Love
  { text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', reference: 'John 3:16' },
  { text: 'We love him, because he first loved us.', reference: '1 John 4:19' },
  { text: 'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come, nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.', reference: 'Romans 8:38-39' },
  { text: 'Greater love hath no man than this, that a man lay down his life for his friends.', reference: 'John 15:13' },
  { text: 'Many waters cannot quench love, neither can the floods drown it.', reference: 'Song of Solomon 8:7' },
  { text: 'I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me... who loved me, and gave himself for me.', reference: 'Galatians 2:20' },

  // Encouragement
  { text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.', reference: 'Philippians 4:6-7' },
  { text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', reference: 'Matthew 11:28' },
  { text: 'Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.', reference: '2 Corinthians 5:17' },
  { text: 'Casting all your care upon him; for he careth for you.', reference: '1 Peter 5:7' },
  { text: 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.', reference: 'John 14:27' },
  { text: 'I sought the LORD, and he heard me, and delivered me from all my fears.', reference: 'Psalm 34:4' },
  { text: 'The LORD is my shepherd; I shall not want.', reference: 'Psalm 23:1' },
  { text: 'What shall we then say to these things? If God be for us, who can be against us?', reference: 'Romans 8:31' },
  { text: 'Nay, in all these things we are more than conquerors through him that loved us.', reference: 'Romans 8:37' },
  { text: 'I have fought a good fight, I have finished my course, I have kept the faith.', reference: '2 Timothy 4:7' },
  { text: 'It is more blessed to give than to receive.', reference: 'Acts 20:35' },
  { text: 'With men this is impossible; but with God all things are possible.', reference: 'Matthew 19:26' },
  { text: 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.', reference: 'Galatians 6:9' },
  { text: 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.', reference: '1 Thessalonians 5:18' },
  { text: 'I am come that they might have life, and that they might have it more abundantly.', reference: 'John 10:10' },
];

const getDayOfYear = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const getVerseOfTheDay = (date: Date): VerseOfTheDay => upliftingVerses[getDayOfYear(date) % upliftingVerses.length];

const getCurrentWeekDays = (baseDate = new Date()): PlannerDay[] => {
  const today = new Date(baseDate);
  const dayIndex = today.getDay();
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);

    return {
      key: toDateKey(date),
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNumber: date.getDate(),
      isToday: date.toDateString() === today.toDateString(),
    };
  });
};

type CalendarCell = {
  key: string;
  date: Date;
  inMonth: boolean;
};

const getMonthCalendarCells = (monthDate: Date): CalendarCell[] => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlankDays = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1;

  const cells: CalendarCell[] = [];

  for (let i = leadingBlankDays; i > 0; i -= 1) {
    const date = new Date(year, month, 1 - i);
    cells.push({ key: toDateKey(date), date, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ key: toDateKey(date), date, inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const previousDate = cells[cells.length - 1].date;
    const date = new Date(previousDate);
    date.setDate(date.getDate() + 1);
    cells.push({ key: toDateKey(date), date, inMonth: false });
  }

  return cells;
};

const getNthWeekdayOfMonth = (year: number, month: number, weekday: number, n: number): Date => {
  const firstOfMonth = new Date(year, month, 1);
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
};

const getLastWeekdayOfMonth = (year: number, month: number, weekday: number): Date => {
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const offset = (lastDayOfMonth.getDay() - weekday + 7) % 7;
  return new Date(year, month, lastDayOfMonth.getDate() - offset);
};

const getEasterSunday = (year: number): Date => {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher) for the Gregorian Easter date.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monthNumber = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, monthNumber - 1, day);
};

const getUsHolidaysForYear = (year: number): { date: Date; name: string }[] => {
  const thanksgiving = getNthWeekdayOfMonth(year, 10, 4, 4);
  const blackFriday = new Date(year, thanksgiving.getMonth(), thanksgiving.getDate() + 1);

  return [
    { date: new Date(year, 0, 1), name: "New Year's Day" },
    { date: getNthWeekdayOfMonth(year, 0, 1, 3), name: 'Martin Luther King Jr. Day' },
    { date: new Date(year, 1, 2), name: 'Groundhog Day' },
    { date: new Date(year, 1, 14), name: "Valentine's Day" },
    { date: getNthWeekdayOfMonth(year, 1, 1, 3), name: "Presidents' Day" },
    { date: new Date(year, 2, 17), name: "St. Patrick's Day" },
    { date: getEasterSunday(year), name: 'Easter Sunday' },
    { date: new Date(year, 3, 1), name: "April Fools' Day" },
    { date: new Date(year, 4, 5), name: 'Cinco de Mayo' },
    { date: getNthWeekdayOfMonth(year, 4, 0, 2), name: "Mother's Day" },
    { date: getLastWeekdayOfMonth(year, 4, 1), name: 'Memorial Day' },
    { date: new Date(year, 5, 14), name: 'Flag Day' },
    { date: new Date(year, 5, 19), name: 'Juneteenth' },
    { date: getNthWeekdayOfMonth(year, 5, 0, 3), name: "Father's Day" },
    { date: new Date(year, 6, 4), name: 'Independence Day' },
    { date: getNthWeekdayOfMonth(year, 8, 1, 1), name: 'Labor Day' },
    { date: new Date(year, 8, 11), name: 'Patriot Day' },
    { date: getNthWeekdayOfMonth(year, 9, 1, 2), name: 'Columbus Day' },
    { date: new Date(year, 9, 31), name: 'Halloween' },
    { date: new Date(year, 10, 11), name: 'Veterans Day' },
    { date: thanksgiving, name: 'Thanksgiving' },
    { date: blackFriday, name: 'Black Friday' },
    { date: new Date(year, 11, 24), name: 'Christmas Eve' },
    { date: new Date(year, 11, 25), name: 'Christmas Day' },
    { date: new Date(year, 11, 31), name: "New Year's Eve" },
  ];
};

const getUsHolidayMapForYears = (years: number[]): Map<string, string> => {
  const map = new Map<string, string>();
  years.forEach((year) => {
    getUsHolidaysForYear(year).forEach((holiday) => {
      map.set(toDateKey(holiday.date), holiday.name);
    });
  });
  return map;
};

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type BmiCategoryLabel = 'Underweight' | 'Healthy' | 'Overweight' | 'Obese';

const getBmiCategory = (bmi: number): BmiCategoryLabel => {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
};

const BMI_SCALE_MIN = 15;
const BMI_SCALE_MAX = 40;

const bmiCategoryRanges: { label: BmiCategoryLabel; min: number; max: number }[] = [
  { label: 'Underweight', min: BMI_SCALE_MIN, max: 18.5 },
  { label: 'Healthy', min: 18.5, max: 25 },
  { label: 'Overweight', min: 25, max: 30 },
  { label: 'Obese', min: 30, max: BMI_SCALE_MAX },
];

const bmiCategoryBarColors: Record<BmiCategoryLabel, string> = {
  Underweight: 'var(--surface-strong)',
  Healthy: 'var(--accent-soft)',
  Overweight: 'var(--accent)',
  Obese: 'var(--accent-strong)',
};

// Average adult height/BMI used as the silhouette's neutral starting point before any data is entered.
const SILHOUETTE_BASE_HEIGHT_INCHES = 66;
const SILHOUETTE_BASE_BMI = 22;

const getSilhouetteMetrics = (heightInches: number | null, bmi: number | null, scale = 1) => {
  const figureHeight =
    (heightInches ? clampNumber(170 + (heightInches - SILHOUETTE_BASE_HEIGHT_INCHES) * 2, 140, 220) : 170) * scale;
  const bodyWidth = (bmi ? clampNumber(52 + (bmi - SILHOUETTE_BASE_BMI) * 2.6, 34, 100) : 52) * scale;

  const headRadius = figureHeight * 0.105;
  const headCy = 8 * scale + headRadius;
  const bodyY = headCy + headRadius + 4 * scale;
  const legHeight = figureHeight * 0.36;
  const bodyHeight = Math.max(figureHeight - bodyY - legHeight, 30 * scale);
  const svgWidth = Math.max(bodyWidth, headRadius * 2) + 28 * scale;
  const legWidth = bodyWidth * 0.3;
  const legGap = bodyWidth * 0.12;
  const legY = bodyY + bodyHeight;

  return {
    svgWidth,
    svgHeight: legY + legHeight + 8 * scale,
    headCx: svgWidth / 2,
    headCy,
    headRadius,
    bodyX: (svgWidth - bodyWidth) / 2,
    bodyY,
    bodyWidth,
    bodyHeight,
    bodyRadius: bodyWidth * 0.3,
    legY,
    legHeight,
    legWidth,
    legRadius: legWidth * 0.4,
    leftLegX: svgWidth / 2 - legGap / 2 - legWidth,
    rightLegX: svgWidth / 2 + legGap / 2,
  };
};

const WEIGHT_CHART_WIDTH = 240;
const WEIGHT_CHART_HEIGHT = 100;
const WEIGHT_CHART_PADDING = 12;

type MetricChartPoint = { x: number; y: number; value: number; logDate: string };

// Shared by any single-value-per-entry trend chart (weight, steps, and future metrics like water).
// `referenceValues` lets a fixed line (e.g. a step goal) be included in the Y-axis scale even when
// it falls outside the actual logged data's min/max range.
const getMetricChartPoints = (
  history: HealthLogRow[],
  referenceValues: number[] = []
): { points: MetricChartPoint[]; valueToY: (value: number) => number } => {
  if (history.length === 0) {
    return { points: [], valueToY: () => WEIGHT_CHART_HEIGHT / 2 };
  }

  const allValues = [...history.map((entry) => entry.value), ...referenceValues];
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;
  const innerWidth = WEIGHT_CHART_WIDTH - WEIGHT_CHART_PADDING * 2;
  const innerHeight = WEIGHT_CHART_HEIGHT - WEIGHT_CHART_PADDING * 2;

  const valueToY = (value: number) => WEIGHT_CHART_PADDING + innerHeight - ((value - minValue) / valueRange) * innerHeight;

  const points = history.map((entry, index) => ({
    x: history.length === 1 ? WEIGHT_CHART_WIDTH / 2 : WEIGHT_CHART_PADDING + (index / (history.length - 1)) * innerWidth,
    y: valueToY(entry.value),
    value: entry.value,
    logDate: entry.log_date,
  }));

  return { points, valueToY };
};

const formatShortDate = (dayKey: string): string => {
  const date = parseDayKeyToDate(dayKey);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : dayKey;
};

const combineDateAndTimeSlot = (dateKey: string, timeSlot: string, meridiem: 'AM' | 'PM'): Date => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [slotHour, slotMinute] = timeSlot.split(':').map(Number);

  let hour = slotHour % 12;
  if (meridiem === 'PM') {
    hour += 12;
  }

  return new Date(year, (month || 1) - 1, day || 1, hour, slotMinute || 0);
};

const getNearestTimeSlot = (date: Date): { slot: string; meridiem: 'AM' | 'PM' } => {
  const hour24 = date.getHours();
  const roundedMinute = date.getMinutes() < 30 ? 0 : 30;
  const meridiem: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return { slot: `${hour12}:${roundedMinute === 0 ? '00' : '30'}`, meridiem };
};

const formatLogTimestamp = (createdAt: string): { dateLabel: string; timeLabel: string } => {
  const date = new Date(createdAt);
  return {
    dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    timeLabel: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
};

const STEPS_GOAL = 10000;

const formatStepsCount = (value: number): string => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value)));

const DEFAULT_WATER_GOAL = 101;

const getStoredWaterGoal = (): number => {
  if (typeof window === 'undefined') {
    return DEFAULT_WATER_GOAL;
  }

  const storedValue = Number(window.localStorage.getItem('mochiboard-water-goal'));
  return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : DEFAULT_WATER_GOAL;
};

const WATER_RING_SIZE = 140;
const WATER_RING_STROKE = 12;
const WATER_RING_RADIUS = (WATER_RING_SIZE - WATER_RING_STROKE) / 2;
const WATER_RING_CIRCUMFERENCE = 2 * Math.PI * WATER_RING_RADIUS;
const WATER_WAVE_HUMP_WIDTH = 35;

// Builds a repeating wavy top edge (two humps per cycle) closed down to the bottom of the box,
// used to clip a "liquid" fill inside the water ring. `width` should be a multiple of
// WATER_WAVE_HUMP_WIDTH * 2 so the pattern can loop seamlessly when animated.
const buildWavePath = (width: number, height: number, waveY: number, amplitude: number): string => {
  let d = `M 0 ${waveY}`;
  let x = 0;
  let up = true;
  while (x < width) {
    const controlY = up ? waveY - amplitude : waveY + amplitude;
    const nextX = x + WATER_WAVE_HUMP_WIDTH;
    d += ` Q ${x + WATER_WAVE_HUMP_WIDTH / 2} ${controlY} ${nextX} ${waveY}`;
    x = nextX;
    up = !up;
  }
  d += ` L ${width} ${height} L 0 ${height} Z`;
  return d;
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

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const value = hex.replace('#', '');
  const intValue = parseInt(value, 16);
  return { r: (intValue >> 16) & 255, g: (intValue >> 8) & 255, b: intValue & 255 };
};

const lerpChannel = (from: number, to: number, ratio: number): number => Math.round(from + (to - from) * ratio);

// Interpolates between the theme's accent-strong (far below goal) and accent-soft (at/above goal)
// so log entries read as a continuous pale-to-deep intensity scale rather than fixed buckets.
const getStepsEntryShade = (theme: ThemeKey, value: number): { background: string; text: string } => {
  const palette = themePalettes[theme];
  const ratio = Math.min(Math.max(value / STEPS_GOAL, 0), 1);
  const deep = hexToRgb(palette.accentStrong);
  const pale = hexToRgb(palette.accentSoft);
  const r = lerpChannel(deep.r, pale.r, ratio);
  const g = lerpChannel(deep.g, pale.g, ratio);
  const b = lerpChannel(deep.b, pale.b, ratio);
  const perceivedBrightness = (r * 299 + g * 587 + b * 114) / 1000;

  return {
    background: `rgb(${r}, ${g}, ${b})`,
    text: perceivedBrightness < 150 ? palette.accentContrast : palette.foreground,
  };
};

const orbRenderers: Record<ThemeKey, (gradId: string) => ReactElement> = {
  peach: (gradId) => (
    <>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#ffe9d6" />
          <stop offset="60%" stopColor="#f5b98a" />
          <stop offset="100%" stopColor="#e89a63" />
        </radialGradient>
      </defs>
      <path d="M20 100 Q10 55 40 35 Q70 15 100 35 Q130 55 120 100 Q120 118 70 118 Q20 118 20 100 Z" fill={`url(#${gradId})`} />
      <circle cx="35" cy="45" r="2" fill="#ffffff" />
      <circle cx="95" cy="40" r="2.5" fill="#ffffff" />
      <circle cx="105" cy="70" r="1.5" fill="#ffffff" />
      <circle cx="55" cy="72" r="4.5" fill="#5a3a28" />
      <circle cx="53" cy="70" r="1.5" fill="#ffffff" />
      <circle cx="85" cy="72" r="4.5" fill="#5a3a28" />
      <circle cx="83" cy="70" r="1.5" fill="#ffffff" />
      <ellipse cx="70" cy="85" rx="5" ry="3" fill="#7a3d1a" />
      <circle cx="42" cy="82" r="9" fill="#e8895c" opacity="0.55" />
      <circle cx="98" cy="82" r="9" fill="#e8895c" opacity="0.55" />
      <path d="M55 30 Q65 8 90 15 Q80 30 55 30 Z" fill="#8fbf5e" />
    </>
  ),
  strawberry: (gradId) => (
    <>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#ffe0ea" />
          <stop offset="60%" stopColor="#f6a6c0" />
          <stop offset="100%" stopColor="#ee85a8" />
        </radialGradient>
      </defs>
      <path d="M20 100 Q10 55 40 35 Q70 15 100 35 Q130 55 120 100 Q120 118 70 118 Q20 118 20 100 Z" fill={`url(#${gradId})`} />
      <circle cx="35" cy="45" r="2" fill="#ffffff" />
      <circle cx="95" cy="40" r="2.5" fill="#ffffff" />
      <circle cx="105" cy="70" r="1.5" fill="#ffffff" />
      <circle cx="55" cy="72" r="4.5" fill="#5a3a28" />
      <circle cx="53" cy="70" r="1.5" fill="#ffffff" />
      <circle cx="85" cy="72" r="4.5" fill="#5a3a28" />
      <circle cx="83" cy="70" r="1.5" fill="#ffffff" />
      <ellipse cx="70" cy="85" rx="5" ry="3" fill="#7a1d3d" />
      <circle cx="42" cy="82" r="9" fill="#e85c8a" opacity="0.55" />
      <circle cx="98" cy="82" r="9" fill="#e85c8a" opacity="0.55" />
      <path d="M55 30 Q65 8 90 15 Q80 30 55 30 Z" fill="#8fbf5e" />
    </>
  ),
  matcha: (gradId) => (
    <>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#eaf5d6" />
          <stop offset="60%" stopColor="#b6d68a" />
          <stop offset="100%" stopColor="#98c266" />
        </radialGradient>
      </defs>
      <path d="M20 100 Q10 55 40 35 Q70 15 100 35 Q130 55 120 100 Q120 118 70 118 Q20 118 20 100 Z" fill={`url(#${gradId})`} />
      <circle cx="35" cy="45" r="2" fill="#ffffff" />
      <circle cx="95" cy="40" r="2.5" fill="#ffffff" />
      <circle cx="105" cy="70" r="1.5" fill="#ffffff" />
      <circle cx="55" cy="72" r="4.5" fill="#5a3a28" />
      <circle cx="53" cy="70" r="1.5" fill="#ffffff" />
      <circle cx="85" cy="72" r="4.5" fill="#5a3a28" />
      <circle cx="83" cy="70" r="1.5" fill="#ffffff" />
      <ellipse cx="70" cy="85" rx="5" ry="3" fill="#2f4a1a" />
      <circle cx="42" cy="82" r="9" fill="#e08850" opacity="0.4" />
      <circle cx="98" cy="82" r="9" fill="#e08850" opacity="0.4" />
    </>
  ),
  ube: (gradId) => (
    <>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#ede0fa" />
          <stop offset="60%" stopColor="#c6a3e8" />
          <stop offset="100%" stopColor="#b085dd" />
        </radialGradient>
      </defs>
      <path d="M20 100 Q10 55 40 35 Q70 15 100 35 Q130 55 120 100 Q120 118 70 118 Q20 118 20 100 Z" fill={`url(#${gradId})`} />
      <circle cx="35" cy="45" r="2" fill="#ffffff" />
      <circle cx="95" cy="40" r="2.5" fill="#ffffff" />
      <circle cx="105" cy="70" r="1.5" fill="#ffffff" />
      <circle cx="55" cy="72" r="4.5" fill="#5a3a28" />
      <circle cx="53" cy="70" r="1.5" fill="#ffffff" />
      <circle cx="85" cy="72" r="4.5" fill="#5a3a28" />
      <circle cx="83" cy="70" r="1.5" fill="#ffffff" />
      <ellipse cx="70" cy="85" rx="5" ry="3" fill="#4a2e6f" />
      <circle cx="42" cy="82" r="9" fill="#c98ae0" opacity="0.5" />
      <circle cx="98" cy="82" r="9" fill="#c98ae0" opacity="0.5" />
    </>
  ),
  'black-sesame': (gradId) => (
    <>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#5c5c5c" />
          <stop offset="60%" stopColor="#3a3a3a" />
          <stop offset="100%" stopColor="#242424" />
        </radialGradient>
      </defs>
      <path d="M20 100 Q10 55 40 35 Q70 15 100 35 Q130 55 120 100 Q120 118 70 118 Q20 118 20 100 Z" fill={`url(#${gradId})`} />
      <circle cx="35" cy="45" r="2" fill="#ffffff" opacity="0.7" />
      <circle cx="95" cy="40" r="2.5" fill="#ffffff" opacity="0.7" />
      <circle cx="60" cy="60" r="1.5" fill="#d4c9a8" />
      <circle cx="88" cy="65" r="1.5" fill="#d4c9a8" />
      <circle cx="70" cy="95" r="1.5" fill="#d4c9a8" />
      <circle cx="55" cy="72" r="4.5" fill="#e8ded0" />
      <circle cx="53" cy="70" r="1.5" fill="#8a7a5f" />
      <circle cx="85" cy="72" r="4.5" fill="#e8ded0" />
      <circle cx="83" cy="70" r="1.5" fill="#8a7a5f" />
      <ellipse cx="70" cy="85" rx="5" ry="3" fill="#d4c9a8" />
      <circle cx="42" cy="82" r="9" fill="#6a6a6a" opacity="0.5" />
      <circle cx="98" cy="82" r="9" fill="#6a6a6a" opacity="0.5" />
    </>
  ),
};

const twelveHourSequence = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const timeSlotOptions = twelveHourSequence.flatMap((hour) => [`${hour}:00`, `${hour}:30`]);

const ThemeOrb = ({ theme, className = 'h-8 w-8' }: { theme: ThemeKey; className?: string }) => {
  const gradId = useId();

  return (
    <svg viewBox="0 0 140 130" aria-hidden="true" className={`shrink-0 ${className}`}>
      {orbRenderers[theme](`orb-${gradId}`)}
    </svg>
  );
};

const SLEEP_GOAL = 8;

// Sleep is entered as separate hours/minutes but stored as decimal hours; this always renders
// the combined "Xh Ym" form, wherever a sleep duration is shown.
const formatSleepDuration = (value: number): string => {
  const totalMinutes = Math.round(Math.max(0, value) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const getPeriodDayCount = (period: 'day' | 'week' | 'month', anchor: Date): number => {
  const { start, end } = getPeriodRange(period, anchor);
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
};

const SLEEP_BATTERY_BODY_TOP = 22;
const SLEEP_BATTERY_BODY_BOTTOM = 116;
const SLEEP_BATTERY_INNER_LEFT = 30;
const SLEEP_BATTERY_INNER_RIGHT = 90;

const SleepBattery = ({ percent, className = 'h-24 w-24' }: { percent: number; className?: string }) => {
  const clipId = useId();
  const clampedPercent = clampNumber(percent, 0, 100);
  const innerBottom = SLEEP_BATTERY_BODY_BOTTOM - 4;
  const innerTop = SLEEP_BATTERY_BODY_TOP + 4;
  const fillHeight = ((innerBottom - innerTop) * clampedPercent) / 100;
  const fillY = innerBottom - fillHeight;
  const boltOpacity = 0.25 + (clampedPercent / 100) * 0.75;
  const boltColor = clampedPercent >= 100 ? 'var(--accent-contrast)' : 'var(--accent-strong)';

  return (
    <svg viewBox="0 0 120 140" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="48" y="8" width="24" height="14" rx="4" fill="none" stroke="var(--border)" strokeWidth="4" />
      <rect
        x="20"
        y={SLEEP_BATTERY_BODY_TOP}
        width="80"
        height={SLEEP_BATTERY_BODY_BOTTOM - SLEEP_BATTERY_BODY_TOP}
        rx="14"
        fill="var(--surface-soft)"
        stroke="var(--border)"
        strokeWidth="4"
      />
      <defs>
        <clipPath id={clipId}>
          <rect x={SLEEP_BATTERY_INNER_LEFT} y={innerTop} width={SLEEP_BATTERY_INNER_RIGHT - SLEEP_BATTERY_INNER_LEFT} height={innerBottom - innerTop} rx="8" />
        </clipPath>
      </defs>
      <rect
        x={SLEEP_BATTERY_INNER_LEFT}
        y={fillY}
        width={SLEEP_BATTERY_INNER_RIGHT - SLEEP_BATTERY_INNER_LEFT}
        height={fillHeight}
        fill="var(--accent)"
        clipPath={`url(#${clipId})`}
        style={{ transition: 'y 0.3s ease, height 0.3s ease' }}
      />
      <path
        d="M64 34 L40 76 L54 76 L48 108 L80 62 L64 62 Z"
        fill={boltColor}
        stroke="var(--surface)"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity={boltOpacity}
        style={{ transition: 'opacity 0.3s ease' }}
      />
    </svg>
  );
};

export default function MochiboardApp({ activeView = 'dashboard' }: { activeView?: ViewMode }) {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeKey>('peach');
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [selectedDay, setSelectedDay] = useState(() => {
    const initialWeekDays = getCurrentWeekDays();
    return initialWeekDays.find((day) => day.isToday)?.key ?? initialWeekDays[0].key;
  });
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('week');
  const [statsAnchorDate, setStatsAnchorDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [verse, setVerse] = useState<VerseOfTheDay>(upliftingVerses[0]);
  const weekDays = useMemo(() => {
    const [year, month, day] = selectedDay.split('-').map(Number);
    return getCurrentWeekDays(new Date(year, month - 1, day));
  }, [selectedDay]);
  const calendarCells = useMemo(() => getMonthCalendarCells(calendarMonth), [calendarMonth]);
  const holidaysByDateKey = useMemo(() => {
    const year = calendarMonth.getFullYear();
    return getUsHolidayMapForYears([year - 1, year, year + 1]);
  }, [calendarMonth]);
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskTimeSlot, setNewTaskTimeSlot] = useState('');
  const [newTaskTimeMeridiem, setNewTaskTimeMeridiem] = useState<'AM' | 'PM'>('AM');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskTime, setEditTaskTime] = useState('');
  const [editTaskDescription, setEditTaskDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null>(null);
  const currentUserId = session?.user?.id ?? null;
  const waterClipId = useId();
  const [latestHeightInches, setLatestHeightInches] = useState<number | null>(null);
  const [latestWeightLbs, setLatestWeightLbs] = useState<number | null>(null);
  const [heightFeetInput, setHeightFeetInput] = useState('');
  const [heightInchesInput, setHeightInchesInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [isLoadingBodyMetrics, setIsLoadingBodyMetrics] = useState(true);
  const [isSavingBodyMetrics, setIsSavingBodyMetrics] = useState(false);
  const [bodyMetricsError, setBodyMetricsError] = useState<string | null>(null);
  const [showBodyMetricsForm, setShowBodyMetricsForm] = useState(false);
  const [weightHistory, setWeightHistory] = useState<HealthLogRow[]>([]);
  const [defaultWeightTimeSlot] = useState(() => getNearestTimeSlot(new Date()));
  const [newWeightDate, setNewWeightDate] = useState('');
  const [newWeightTimeSlot, setNewWeightTimeSlot] = useState('');
  const [newWeightTimeMeridiem, setNewWeightTimeMeridiem] = useState<'AM' | 'PM'>(defaultWeightTimeSlot.meridiem);
  const [editingWeightLogId, setEditingWeightLogId] = useState<string | null>(null);
  const [editWeightValue, setEditWeightValue] = useState('');
  const [editWeightDate, setEditWeightDate] = useState('');
  const [editWeightTimeSlot, setEditWeightTimeSlot] = useState('');
  const [editWeightTimeMeridiem, setEditWeightTimeMeridiem] = useState<'AM' | 'PM'>('AM');
  const [isSavingWeightEdit, setIsSavingWeightEdit] = useState(false);
  const [deletingWeightLogId, setDeletingWeightLogId] = useState<string | null>(null);
  const [isDeletingWeightLog, setIsDeletingWeightLog] = useState(false);
  const [weightLogFilter, setWeightLogFilter] = useState<'day' | 'week' | 'month'>('week');
  const [weightLogAnchorDate, setWeightLogAnchorDate] = useState(() => new Date());
  const [stepsHistory, setStepsHistory] = useState<HealthLogRow[]>([]);
  const [stepsValueInput, setStepsValueInput] = useState('');
  const [newStepsDate, setNewStepsDate] = useState('');
  const [isSavingSteps, setIsSavingSteps] = useState(false);
  const [isLoadingSteps, setIsLoadingSteps] = useState(true);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [editingStepsLogId, setEditingStepsLogId] = useState<string | null>(null);
  const [editStepsValue, setEditStepsValue] = useState('');
  const [editStepsDate, setEditStepsDate] = useState('');
  const [isSavingStepsEdit, setIsSavingStepsEdit] = useState(false);
  const [deletingStepsLogId, setDeletingStepsLogId] = useState<string | null>(null);
  const [isDeletingStepsLog, setIsDeletingStepsLog] = useState(false);
  const [stepsLogFilter, setStepsLogFilter] = useState<'week' | 'month'>('week');
  const [stepsLogAnchorDate, setStepsLogAnchorDate] = useState(() => new Date());
  const [waterGoal, setWaterGoal] = useState(DEFAULT_WATER_GOAL);
  const [showWaterGoalEdit, setShowWaterGoalEdit] = useState(false);
  const [waterGoalInput, setWaterGoalInput] = useState('');
  const [waterHistory, setWaterHistory] = useState<HealthLogRow[]>([]);
  const [waterValueInput, setWaterValueInput] = useState('');
  const [newWaterDate, setNewWaterDate] = useState('');
  const [isLoadingWater, setIsLoadingWater] = useState(true);
  const [isSavingWater, setIsSavingWater] = useState(false);
  const [waterError, setWaterError] = useState<string | null>(null);
  const [editingWaterLogId, setEditingWaterLogId] = useState<string | null>(null);
  const [editWaterValue, setEditWaterValue] = useState('');
  const [editWaterDate, setEditWaterDate] = useState('');
  const [isSavingWaterEdit, setIsSavingWaterEdit] = useState(false);
  const [deletingWaterLogId, setDeletingWaterLogId] = useState<string | null>(null);
  const [isDeletingWaterLog, setIsDeletingWaterLog] = useState(false);
  const [waterLogFilter, setWaterLogFilter] = useState<'day' | 'week' | 'month'>('week');
  const [waterLogAnchorDate, setWaterLogAnchorDate] = useState(() => new Date());
  const [sleepHistory, setSleepHistory] = useState<HealthLogRow[]>([]);
  const [sleepHoursInput, setSleepHoursInput] = useState('');
  const [sleepMinutesInput, setSleepMinutesInput] = useState('');
  const [newSleepDate, setNewSleepDate] = useState('');
  const [isSavingSleep, setIsSavingSleep] = useState(false);
  const [isLoadingSleep, setIsLoadingSleep] = useState(true);
  const [sleepError, setSleepError] = useState<string | null>(null);
  const [editingSleepLogId, setEditingSleepLogId] = useState<string | null>(null);
  const [editSleepHours, setEditSleepHours] = useState('');
  const [editSleepMinutes, setEditSleepMinutes] = useState('');
  const [editSleepDate, setEditSleepDate] = useState('');
  const [isSavingSleepEdit, setIsSavingSleepEdit] = useState(false);
  const [deletingSleepLogId, setDeletingSleepLogId] = useState<string | null>(null);
  const [isDeletingSleepLog, setIsDeletingSleepLog] = useState(false);
  const [sleepLogFilter, setSleepLogFilter] = useState<'day' | 'week' | 'month'>('week');
  const [sleepLogAnchorDate, setSleepLogAnchorDate] = useState(() => new Date());
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutRow[]>([]);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [newWorkoutName, setNewWorkoutName] = useState('');
  const [newWorkoutType, setNewWorkoutType] = useState<string>(WORKOUT_TYPES[0]);
  const [newWorkoutDuration, setNewWorkoutDuration] = useState('');
  const [newWorkoutDate, setNewWorkoutDate] = useState('');
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editWorkoutName, setEditWorkoutName] = useState('');
  const [editWorkoutType, setEditWorkoutType] = useState<string>(WORKOUT_TYPES[0]);
  const [editWorkoutDuration, setEditWorkoutDuration] = useState('');
  const [editWorkoutDate, setEditWorkoutDate] = useState('');
  const [isSavingWorkoutEdit, setIsSavingWorkoutEdit] = useState(false);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null);
  const [isDeletingWorkout, setIsDeletingWorkout] = useState(false);
  const [workoutLogFilter, setWorkoutLogFilter] = useState<'day' | 'week' | 'month'>('week');
  const [workoutLogAnchorDate, setWorkoutLogAnchorDate] = useState(() => new Date());
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);
  const [exercisesByWorkout, setExercisesByWorkout] = useState<Record<string, WorkoutExerciseRow[]>>({});
  const [loadingExercisesWorkoutId, setLoadingExercisesWorkoutId] = useState<string | null>(null);
  const [exercisesError, setExercisesError] = useState<string | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseSets, setNewExerciseSets] = useState('');
  const [newExerciseReps, setNewExerciseReps] = useState('');
  const [newExerciseWeight, setNewExerciseWeight] = useState('');
  const [isSavingExercise, setIsSavingExercise] = useState(false);

  useEffect(() => {
    const initialTheme = getStoredTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const storedWaterGoal = getStoredWaterGoal();
    setWaterGoal(storedWaterGoal);
    setWaterGoalInput(String(storedWaterGoal));
  }, []);

  const handleThemeSelect = (nextTheme: ThemeKey) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem('mochiboard-theme', nextTheme);
  };

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setVerse(getVerseOfTheDay(new Date()));
  }, []);

  useEffect(() => {
    let active = true;

    const initializeSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) {
        return;
      }

      if (error) {
        setSession(null);
      } else {
        setSession(data.session);
      }

      setIsAuthLoading(false);
    };

    void initializeSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!active) {
        return;
      }

      setSession(currentSession);
      setIsAuthLoading(false);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !session) {
      router.replace('/login');
    }
  }, [isAuthLoading, router, session]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setTasks([]);
      setIsLoadingTasks(false);
      return;
    }

    const loadTasks = async () => {
      setIsLoadingTasks(true);
      setTaskError(null);

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: true });

      if (error) {
        setTaskError('Unable to load tasks right now.');
        setTasks([]);
      } else {
        setTasks(data ?? []);

        const legacyTasks = (data ?? []).filter((task) => !task.user_id);
        if (legacyTasks.length > 0) {
          const { error: assignError } = await supabase.from('tasks').update({ user_id: currentUserId }).in(
            'id',
            legacyTasks.map((task) => task.id)
          );

          if (assignError) {
            console.warn('Unable to assign legacy tasks to the current user.', assignError);
          }
        }
      }

      setIsLoadingTasks(false);
    };

    void loadTasks();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setIsLoadingBodyMetrics(false);
      return;
    }

    const loadBodyMetrics = async () => {
      setIsLoadingBodyMetrics(true);
      setBodyMetricsError(null);

      const { data, error } = await supabase
        .from('health_logs')
        .select('*')
        .eq('user_id', currentUserId)
        .in('metric_type', ['height', 'weight'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Unable to load health_logs:', error);
        setBodyMetricsError(`Unable to load your measurements (${error.message}).`);
      } else if (data) {
        const rows = data as HealthLogRow[];
        const latestHeight = rows.find((row) => row.metric_type === 'height');
        const latestWeight = rows.find((row) => row.metric_type === 'weight');

        if (latestHeight) {
          setLatestHeightInches(latestHeight.value);
          setHeightFeetInput(String(Math.floor(latestHeight.value / 12)));
          setHeightInchesInput(String(Math.round(latestHeight.value % 12)));
        }

        if (latestWeight) {
          setLatestWeightLbs(latestWeight.value);
          setWeightInput(String(latestWeight.value));
        }

        const weightRows = rows
          .filter((row) => row.metric_type === 'weight')
          .slice()
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        setWeightHistory(weightRows);
      }

      setIsLoadingBodyMetrics(false);
    };

    void loadBodyMetrics();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setIsLoadingSteps(false);
      return;
    }

    const loadSteps = async () => {
      setIsLoadingSteps(true);
      setStepsError(null);

      const { data, error } = await supabase
        .from('health_logs')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('metric_type', 'steps')
        .order('log_date', { ascending: true });

      if (error) {
        console.error('Unable to load health_logs steps:', error);
        setStepsError(`Unable to load your steps (${error.message}).`);
      } else if (data) {
        setStepsHistory(data as HealthLogRow[]);
      }

      setIsLoadingSteps(false);
    };

    void loadSteps();
  }, [currentUserId, isAuthLoading, todayKey]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setIsLoadingWater(false);
      return;
    }

    const loadWater = async () => {
      setIsLoadingWater(true);
      setWaterError(null);

      const { data, error } = await supabase
        .from('health_logs')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('metric_type', 'water')
        .order('log_date', { ascending: true });

      if (error) {
        console.error('Unable to load health_logs water:', error);
        setWaterError(`Unable to load your water intake (${error.message}).`);
      } else if (data) {
        setWaterHistory(data as HealthLogRow[]);
      }

      setIsLoadingWater(false);
    };

    void loadWater();
  }, [currentUserId, isAuthLoading, todayKey]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setIsLoadingSleep(false);
      return;
    }

    const loadSleep = async () => {
      setIsLoadingSleep(true);
      setSleepError(null);

      const { data, error } = await supabase
        .from('health_logs')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('metric_type', 'sleep')
        .order('log_date', { ascending: true });

      if (error) {
        console.error('Unable to load health_logs sleep:', error);
        setSleepError(`Unable to load your sleep (${error.message}).`);
      } else if (data) {
        setSleepHistory(data as HealthLogRow[]);
      }

      setIsLoadingSleep(false);
    };

    void loadSleep();
  }, [currentUserId, isAuthLoading, todayKey]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setIsLoadingWorkouts(false);
      return;
    }

    const loadWorkouts = async () => {
      setIsLoadingWorkouts(true);
      setWorkoutError(null);

      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', currentUserId)
        .order('workout_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Unable to load workouts:', error);
        setWorkoutError(`Unable to load your workouts (${error.message}).`);
      } else if (data) {
        setWorkoutsHistory(data as WorkoutRow[]);
      }

      setIsLoadingWorkouts(false);
    };

    void loadWorkouts();
  }, [currentUserId, isAuthLoading, todayKey]);

  const selectedDayMeta = weekDays.find((day) => day.key === selectedDay);
  const visibleTasks = tasks
    .filter((task) => task.day === selectedDay || (selectedDayMeta ? task.day === selectedDayMeta.label : false))
    .slice()
    .sort((a, b) => {
      const aTime = parseTaskTime(a.time_label);
      const bTime = parseTaskTime(b.time_label);
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return aTime.hour * 60 + aTime.minute - (bTime.hour * 60 + bTime.minute);
    });

  const monthlyTaskGroups = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const tasksInMonth = tasks.filter((task) => {
      const date = parseDayKeyToDate(task.day);
      return date ? date.getFullYear() === year && date.getMonth() === month : false;
    });

    const holidaysInMonth = getUsHolidaysForYear(year).filter((holiday) => holiday.date.getMonth() === month);

    const entries: { dateKey: string; sortMinutes: number; item: MonthlyAgendaItem }[] = [];

    tasksInMonth.forEach((task) => {
      const time = parseTaskTime(task.time_label);
      entries.push({
        dateKey: task.day,
        sortMinutes: time ? time.hour * 60 + time.minute : Number.MAX_SAFE_INTEGER,
        item: { type: 'task', id: task.id, task },
      });
    });

    holidaysInMonth.forEach((holiday) => {
      const dateKey = toDateKey(holiday.date);
      entries.push({
        dateKey,
        sortMinutes: -1,
        item: { type: 'holiday', id: `holiday-${dateKey}`, name: holiday.name, isPast: dateKey < todayKey },
      });
    });

    entries.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
      return a.sortMinutes - b.sortMinutes;
    });

    const groups: MonthlyAgendaGroup[] = [];
    entries.forEach((entry) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.dateKey === entry.dateKey) {
        lastGroup.items.push(entry.item);
        return;
      }

      const date = parseDayKeyToDate(entry.dateKey);
      groups.push({
        dateKey: entry.dateKey,
        dateLabel: date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : entry.dateKey,
        items: [entry.item],
      });
    });

    return groups;
  }, [tasks, calendarMonth, todayKey]);

  const taskStats = useMemo(() => {
    const currentRange = getPeriodRange(statsPeriod, statsAnchorDate);
    const previousRange = getPreviousPeriodRange(statsPeriod, statsAnchorDate);

    const tasksInRange = (range: { start: Date; end: Date }) =>
      tasks.filter((task) => {
        const taskDate = parseDayKeyToDate(task.day);
        return taskDate ? isDateWithinRange(taskDate, range.start, range.end) : false;
      });

    const countOverdue = (list: TaskRow[]) => list.filter((task) => !task.is_complete && isTaskOverdue(task, task.day, now)).length;

    const currentTasks = tasksInRange(currentRange);
    const previousTasks = tasksInRange(previousRange);

    return {
      created: { current: currentTasks.length, previous: previousTasks.length },
      completed: {
        current: currentTasks.filter((task) => task.is_complete).length,
        previous: previousTasks.filter((task) => task.is_complete).length,
      },
      overdue: {
        current: countOverdue(currentTasks),
        previous: countOverdue(previousTasks),
      },
    };
  }, [tasks, statsPeriod, statsAnchorDate, now]);

  const bmi = useMemo(() => {
    if (!latestHeightInches || !latestWeightLbs) {
      return null;
    }
    return (latestWeightLbs * 703) / (latestHeightInches * latestHeightInches);
  }, [latestHeightInches, latestWeightLbs]);

  const bmiCategory = bmi === null ? null : getBmiCategory(bmi);

  const bmiMarkerPercent =
    bmi === null ? null : clampNumber(((bmi - BMI_SCALE_MIN) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100, 0, 100);

  const silhouetteMetrics = useMemo(() => getSilhouetteMetrics(latestHeightInches, bmi, 0.55), [latestHeightInches, bmi]);
  const weightChart = useMemo(() => getMetricChartPoints(weightHistory), [weightHistory]);
  const stepsChart = useMemo(() => getMetricChartPoints(stepsHistory, [STEPS_GOAL]), [stepsHistory]);
  const stepsGoalLineY = stepsChart.valueToY(STEPS_GOAL);
  const filteredStepsHistory = useMemo(() => {
    const { start, end } = getPeriodRange(stepsLogFilter, stepsLogAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return stepsHistory.filter((row) => row.log_date >= startKey && row.log_date <= endKey);
  }, [stepsHistory, stepsLogFilter, stepsLogAnchorDate]);

  const waterChart = useMemo(() => getMetricChartPoints(waterHistory, [waterGoal]), [waterHistory, waterGoal]);
  const filteredWaterHistory = useMemo(() => {
    const { start, end } = getPeriodRange(waterLogFilter, waterLogAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return waterHistory.filter((row) => row.log_date >= startKey && row.log_date <= endKey);
  }, [waterHistory, waterLogFilter, waterLogAnchorDate]);
  const filteredWeightHistory = useMemo(() => {
    const { start, end } = getPeriodRange(weightLogFilter, weightLogAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return weightHistory.filter((row) => row.log_date >= startKey && row.log_date <= endKey);
  }, [weightHistory, weightLogFilter, weightLogAnchorDate]);
  const todayWaterEntry = useMemo(() => waterHistory.find((row) => row.log_date === todayKey), [waterHistory, todayKey]);
  const todayWaterOz = todayWaterEntry?.value ?? 0;
  const waterPercentRaw = (todayWaterOz / waterGoal) * 100;
  const waterPercentDisplay = Math.round(waterPercentRaw);
  const waterRingPercent = clampNumber(waterPercentRaw, 0, 100);
  const waterWaveY = WATER_RING_SIZE - (waterRingPercent / 100) * WATER_RING_SIZE;

  const sleepChart = useMemo(() => getMetricChartPoints(sleepHistory, [SLEEP_GOAL]), [sleepHistory]);
  const filteredSleepHistory = useMemo(() => {
    const { start, end } = getPeriodRange(sleepLogFilter, sleepLogAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return sleepHistory.filter((row) => row.log_date >= startKey && row.log_date <= endKey);
  }, [sleepHistory, sleepLogFilter, sleepLogAnchorDate]);
  const todaySleepEntry = useMemo(() => sleepHistory.find((row) => row.log_date === todayKey), [sleepHistory, todayKey]);
  const todaySleepHours = todaySleepEntry?.value ?? 0;
  const sleepPeriodDayCount = useMemo(
    () => getPeriodDayCount(sleepLogFilter, sleepLogAnchorDate),
    [sleepLogFilter, sleepLogAnchorDate]
  );
  const sleepPeriodGoal = SLEEP_GOAL * sleepPeriodDayCount;
  const sleepPeriodTotal = useMemo(
    () => filteredSleepHistory.reduce((sum, row) => sum + row.value, 0),
    [filteredSleepHistory]
  );
  const sleepDisplayHours = sleepLogFilter === 'day' ? todaySleepHours : sleepPeriodTotal;
  const sleepDisplayGoal = sleepLogFilter === 'day' ? SLEEP_GOAL : sleepPeriodGoal;
  const sleepBatteryPercent = sleepDisplayGoal > 0 ? (sleepDisplayHours / sleepDisplayGoal) * 100 : 0;

  const filteredWorkouts = useMemo(() => {
    const { start, end } = getPeriodRange(workoutLogFilter, workoutLogAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return workoutsHistory.filter((row) => row.workout_date >= startKey && row.workout_date <= endKey);
  }, [workoutsHistory, workoutLogFilter, workoutLogAnchorDate]);

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

  const handleStartEditTask = (task: TaskRow) => {
    setDeletingTaskId(null);
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskTime(task.time_label ?? '');
    setEditTaskDescription(task.description ?? '');
  };

  const handleCancelEditTask = () => {
    setEditingTaskId(null);
  };

  const handleSaveEditTask = async (event: FormEvent<HTMLFormElement>, taskId: string) => {
    event.preventDefault();

    const title = editTaskTitle.trim();
    if (!title) {
      return;
    }

    setIsSavingEdit(true);
    setTaskError(null);

    const updates = {
      title,
      time_label: editTaskTime.trim() || null,
      description: editTaskDescription.trim() || null,
    };

    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);

    if (error) {
      setTaskError('Unable to update that task.');
    } else {
      setTasks((currentTasks) => currentTasks.map((item) => (item.id === taskId ? { ...item, ...updates } : item)));
      setEditingTaskId(null);
    }

    setIsSavingEdit(false);
  };

  const handleStartDeleteTask = (taskId: string) => {
    setEditingTaskId(null);
    setDeletingTaskId(taskId);
  };

  const handleCancelDeleteTask = () => {
    setDeletingTaskId(null);
  };

  const handleConfirmDeleteTask = async (taskId: string) => {
    setIsDeletingTask(true);
    setTaskError(null);

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (error) {
      setTaskError('Unable to delete that task.');
    } else {
      setTasks((currentTasks) => currentTasks.filter((item) => item.id !== taskId));
    }

    setDeletingTaskId(null);
    setIsDeletingTask(false);
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = newTaskTitle.trim();
    if (!title) {
      return;
    }

    setIsSavingTask(true);
    setTaskError(null);

    if (!currentUserId) {
      setTaskError('Please sign in to add tasks.');
      setIsSavingTask(false);
      return;
    }

    const taskDay = newTaskDate || selectedDay;
    const combinedTime = newTaskTimeSlot ? `${newTaskTimeSlot} ${newTaskTimeMeridiem}` : newTaskTime.trim();

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        day: taskDay,
        time_label: combinedTime || null,
        description: newTaskDescription.trim() || null,
        is_complete: false,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      setTaskError('Unable to add that task.');
    } else if (data) {
      setTasks((currentTasks) => [...currentTasks, data]);
      setNewTaskTitle('');
      setNewTaskTime('');
      setNewTaskTimeSlot('');
      setNewTaskTimeMeridiem('AM');
      setNewTaskDate('');
      setNewTaskDescription('');
    }

    setIsSavingTask(false);
  };

  const handleSaveBodyMetrics = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBodyMetricsError(null);

    if (!currentUserId) {
      setBodyMetricsError('Please sign in to save your measurements.');
      return;
    }

    const feet = Number(heightFeetInput);
    const inches = Number(heightInchesInput || 0);
    const weight = Number(weightInput);

    const heightInches =
      Number.isFinite(feet) && Number.isFinite(inches) && (feet > 0 || inches > 0) ? feet * 12 + inches : null;
    const weightLbs = Number.isFinite(weight) && weight > 0 ? weight : null;

    if (heightInches === null && weightLbs === null) {
      setBodyMetricsError('Enter a height and/or weight to save.');
      return;
    }

    const rowsToInsert: { user_id: string; log_date: string; metric_type: string; value: number; unit: string; created_at?: string }[] = [];

    if (heightInches !== null && heightInches !== latestHeightInches) {
      rowsToInsert.push({ user_id: currentUserId, log_date: todayKey, metric_type: 'height', value: heightInches, unit: 'in' });
    }

    if (weightLbs !== null) {
      const weightTimestamp = combineDateAndTimeSlot(
        newWeightDate || todayKey,
        newWeightTimeSlot || defaultWeightTimeSlot.slot,
        newWeightTimeMeridiem
      );
      rowsToInsert.push({
        user_id: currentUserId,
        log_date: toDateKey(weightTimestamp),
        metric_type: 'weight',
        value: weightLbs,
        unit: 'lbs',
        created_at: weightTimestamp.toISOString(),
      });
    }

    if (rowsToInsert.length === 0) {
      return;
    }

    setIsSavingBodyMetrics(true);

    const { data: insertedRows, error } = await supabase.from('health_logs').insert(rowsToInsert).select();

    if (error) {
      console.error('Unable to save health_logs:', error);
      setBodyMetricsError(`Unable to save your measurements (${error.message}).`);
    } else {
      if (heightInches !== null) {
        setLatestHeightInches(heightInches);
      }

      const insertedWeightRow = (insertedRows as HealthLogRow[] | null)?.find((row) => row.metric_type === 'weight');
      if (insertedWeightRow) {
        const updatedHistory = [...weightHistory, insertedWeightRow].sort((a, b) => a.created_at.localeCompare(b.created_at));
        setWeightHistory(updatedHistory);

        const mostRecent = updatedHistory[updatedHistory.length - 1];
        setLatestWeightLbs(mostRecent.value);
        setWeightInput(String(mostRecent.value));

        setNewWeightDate('');
        setNewWeightTimeSlot('');
        setNewWeightTimeMeridiem(defaultWeightTimeSlot.meridiem);
      }
    }

    setIsSavingBodyMetrics(false);
  };

  const handleStartEditWeightLog = (entry: HealthLogRow) => {
    setDeletingWeightLogId(null);
    setEditingWeightLogId(entry.id);
    setEditWeightValue(String(entry.value));

    const entryDate = new Date(entry.created_at);
    setEditWeightDate(toDateKey(entryDate));

    const { slot, meridiem } = getNearestTimeSlot(entryDate);
    setEditWeightTimeSlot(slot);
    setEditWeightTimeMeridiem(meridiem);
  };

  const handleCancelEditWeightLog = () => {
    setEditingWeightLogId(null);
  };

  const handleSaveEditWeightLog = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setBodyMetricsError(null);

    const value = Number(editWeightValue);
    if (!Number.isFinite(value) || value <= 0) {
      setBodyMetricsError('Enter a valid weight.');
      return;
    }

    setIsSavingWeightEdit(true);

    const timestamp = combineDateAndTimeSlot(editWeightDate || todayKey, editWeightTimeSlot || defaultWeightTimeSlot.slot, editWeightTimeMeridiem);
    const updates = { value, log_date: toDateKey(timestamp), created_at: timestamp.toISOString() };

    const { error } = await supabase.from('health_logs').update(updates).eq('id', id);

    if (error) {
      console.error('Unable to update health_logs entry:', error);
      setBodyMetricsError(`Unable to update that entry (${error.message}).`);
    } else {
      const updatedHistory = weightHistory
        .map((row) => (row.id === id ? { ...row, ...updates } : row))
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      setWeightHistory(updatedHistory);

      const mostRecent = updatedHistory[updatedHistory.length - 1];
      if (mostRecent) {
        setLatestWeightLbs(mostRecent.value);
        setWeightInput(String(mostRecent.value));
      }

      setEditingWeightLogId(null);
    }

    setIsSavingWeightEdit(false);
  };

  const handleStartDeleteWeightLog = (id: string) => {
    setEditingWeightLogId(null);
    setDeletingWeightLogId(id);
  };

  const handleCancelDeleteWeightLog = () => {
    setDeletingWeightLogId(null);
  };

  const handleConfirmDeleteWeightLog = async (id: string) => {
    setIsDeletingWeightLog(true);
    setBodyMetricsError(null);

    const { error } = await supabase.from('health_logs').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete health_logs entry:', error);
      setBodyMetricsError(`Unable to delete that entry (${error.message}).`);
    } else {
      const updatedHistory = weightHistory.filter((row) => row.id !== id);
      setWeightHistory(updatedHistory);

      const mostRecent = updatedHistory[updatedHistory.length - 1];
      setLatestWeightLbs(mostRecent ? mostRecent.value : null);
      setWeightInput(mostRecent ? String(mostRecent.value) : '');
    }

    setDeletingWeightLogId(null);
    setIsDeletingWeightLog(false);
  };

  const handleSaveSteps = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStepsError(null);

    if (!currentUserId) {
      setStepsError('Please sign in to log your steps.');
      return;
    }

    const steps = Number(stepsValueInput);
    if (!Number.isFinite(steps) || steps < 0) {
      setStepsError('Enter a valid step count.');
      return;
    }

    const logDate = newStepsDate || todayKey;
    const existingEntry = stepsHistory.find((row) => row.log_date === logDate);

    setIsSavingSteps(true);

    if (existingEntry) {
      const { error } = await supabase.from('health_logs').update({ value: steps }).eq('id', existingEntry.id);

      if (error) {
        console.error('Unable to update steps:', error);
        setStepsError(`Unable to save your steps (${error.message}).`);
      } else {
        setStepsHistory((current) => current.map((row) => (row.id === existingEntry.id ? { ...row, value: steps } : row)));
        setStepsValueInput('');
        setNewStepsDate('');
      }
    } else {
      const { data: insertedRows, error } = await supabase
        .from('health_logs')
        .insert({ user_id: currentUserId, log_date: logDate, metric_type: 'steps', value: steps, unit: 'count' })
        .select();

      if (error) {
        console.error('Unable to save steps:', error);
        setStepsError(`Unable to save your steps (${error.message}).`);
      } else {
        const insertedRow = (insertedRows as HealthLogRow[] | null)?.[0];
        if (insertedRow) {
          setStepsHistory((current) => [...current, insertedRow].sort((a, b) => a.log_date.localeCompare(b.log_date)));
          setStepsValueInput('');
          setNewStepsDate('');
        }
      }
    }

    setIsSavingSteps(false);
  };

  const handleStartEditStepsLog = (entry: HealthLogRow) => {
    setDeletingStepsLogId(null);
    setEditingStepsLogId(entry.id);
    setEditStepsValue(String(entry.value));
    setEditStepsDate(entry.log_date);
  };

  const handleCancelEditStepsLog = () => {
    setEditingStepsLogId(null);
  };

  const handleSaveEditStepsLog = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setStepsError(null);

    const value = Number(editStepsValue);
    if (!Number.isFinite(value) || value < 0) {
      setStepsError('Enter a valid step count.');
      return;
    }

    const logDate = editStepsDate || todayKey;

    setIsSavingStepsEdit(true);

    const { error } = await supabase.from('health_logs').update({ value, log_date: logDate }).eq('id', id);

    if (error) {
      console.error('Unable to update steps entry:', error);
      setStepsError(`Unable to update that entry (${error.message}).`);
    } else {
      const updatedHistory = stepsHistory
        .map((row) => (row.id === id ? { ...row, value, log_date: logDate } : row))
        .sort((a, b) => a.log_date.localeCompare(b.log_date));
      setStepsHistory(updatedHistory);

      setEditingStepsLogId(null);
    }

    setIsSavingStepsEdit(false);
  };

  const handleStartDeleteStepsLog = (id: string) => {
    setEditingStepsLogId(null);
    setDeletingStepsLogId(id);
  };

  const handleCancelDeleteStepsLog = () => {
    setDeletingStepsLogId(null);
  };

  const handleConfirmDeleteStepsLog = async (id: string) => {
    setIsDeletingStepsLog(true);
    setStepsError(null);

    const { error } = await supabase.from('health_logs').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete steps entry:', error);
      setStepsError(`Unable to delete that entry (${error.message}).`);
    } else {
      setStepsHistory((current) => current.filter((row) => row.id !== id));
    }

    setDeletingStepsLogId(null);
    setIsDeletingStepsLog(false);
  };

  const handleSaveWater = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWaterError(null);

    if (!currentUserId) {
      setWaterError('Please sign in to log your water.');
      return;
    }

    const oz = Number(waterValueInput);
    if (!Number.isFinite(oz) || oz < 0) {
      setWaterError('Enter a valid amount of water.');
      return;
    }

    const logDate = newWaterDate || todayKey;
    const existingEntry = waterHistory.find((row) => row.log_date === logDate);

    setIsSavingWater(true);

    if (existingEntry) {
      const { error } = await supabase.from('health_logs').update({ value: oz }).eq('id', existingEntry.id);

      if (error) {
        console.error('Unable to update water:', error);
        setWaterError(`Unable to save your water intake (${error.message}).`);
      } else {
        setWaterHistory((current) => current.map((row) => (row.id === existingEntry.id ? { ...row, value: oz } : row)));
        setWaterValueInput('');
        setNewWaterDate('');
      }
    } else {
      const { data: insertedRows, error } = await supabase
        .from('health_logs')
        .insert({ user_id: currentUserId, log_date: logDate, metric_type: 'water', value: oz, unit: 'oz' })
        .select();

      if (error) {
        console.error('Unable to save water:', error);
        setWaterError(`Unable to save your water intake (${error.message}).`);
      } else {
        const insertedRow = (insertedRows as HealthLogRow[] | null)?.[0];
        if (insertedRow) {
          setWaterHistory((current) => [...current, insertedRow].sort((a, b) => a.log_date.localeCompare(b.log_date)));
          setWaterValueInput('');
          setNewWaterDate('');
        }
      }
    }

    setIsSavingWater(false);
  };

  const handleSaveWaterGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextGoal = Number(waterGoalInput);
    if (!Number.isFinite(nextGoal) || nextGoal <= 0) {
      return;
    }

    setWaterGoal(nextGoal);
    window.localStorage.setItem('mochiboard-water-goal', String(nextGoal));
    setShowWaterGoalEdit(false);
  };

  const handleStartEditWaterLog = (entry: HealthLogRow) => {
    setDeletingWaterLogId(null);
    setEditingWaterLogId(entry.id);
    setEditWaterValue(String(entry.value));
    setEditWaterDate(entry.log_date);
  };

  const handleCancelEditWaterLog = () => {
    setEditingWaterLogId(null);
  };

  const handleSaveEditWaterLog = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setWaterError(null);

    const value = Number(editWaterValue);
    if (!Number.isFinite(value) || value < 0) {
      setWaterError('Enter a valid amount of water.');
      return;
    }

    const logDate = editWaterDate || todayKey;

    setIsSavingWaterEdit(true);

    const { error } = await supabase.from('health_logs').update({ value, log_date: logDate }).eq('id', id);

    if (error) {
      console.error('Unable to update water entry:', error);
      setWaterError(`Unable to update that entry (${error.message}).`);
    } else {
      const updatedHistory = waterHistory
        .map((row) => (row.id === id ? { ...row, value, log_date: logDate } : row))
        .sort((a, b) => a.log_date.localeCompare(b.log_date));
      setWaterHistory(updatedHistory);

      setEditingWaterLogId(null);
    }

    setIsSavingWaterEdit(false);
  };

  const handleStartDeleteWaterLog = (id: string) => {
    setEditingWaterLogId(null);
    setDeletingWaterLogId(id);
  };

  const handleCancelDeleteWaterLog = () => {
    setDeletingWaterLogId(null);
  };

  const handleConfirmDeleteWaterLog = async (id: string) => {
    setIsDeletingWaterLog(true);
    setWaterError(null);

    const { error } = await supabase.from('health_logs').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete water entry:', error);
      setWaterError(`Unable to delete that entry (${error.message}).`);
    } else {
      setWaterHistory((current) => current.filter((row) => row.id !== id));
    }

    setDeletingWaterLogId(null);
    setIsDeletingWaterLog(false);
  };

  const handleSaveSleep = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSleepError(null);

    if (!currentUserId) {
      setSleepError('Please sign in to log your sleep.');
      return;
    }

    const hoursNum = Number(sleepHoursInput || 0);
    const minutesNum = Number(sleepMinutesInput || 0);
    if (!Number.isFinite(hoursNum) || hoursNum < 0 || !Number.isFinite(minutesNum) || minutesNum < 0 || minutesNum >= 60) {
      setSleepError('Enter a valid number of hours and minutes.');
      return;
    }

    const hours = hoursNum + minutesNum / 60;
    const logDate = newSleepDate || todayKey;
    const existingEntry = sleepHistory.find((row) => row.log_date === logDate);

    setIsSavingSleep(true);

    if (existingEntry) {
      const { error } = await supabase.from('health_logs').update({ value: hours }).eq('id', existingEntry.id);

      if (error) {
        console.error('Unable to update sleep:', error);
        setSleepError(`Unable to save your sleep (${error.message}).`);
      } else {
        setSleepHistory((current) => current.map((row) => (row.id === existingEntry.id ? { ...row, value: hours } : row)));
        setSleepHoursInput('');
        setSleepMinutesInput('');
        setNewSleepDate('');
      }
    } else {
      const { data: insertedRows, error } = await supabase
        .from('health_logs')
        .insert({ user_id: currentUserId, log_date: logDate, metric_type: 'sleep', value: hours, unit: 'hrs' })
        .select();

      if (error) {
        console.error('Unable to save sleep:', error);
        setSleepError(`Unable to save your sleep (${error.message}).`);
      } else {
        const insertedRow = (insertedRows as HealthLogRow[] | null)?.[0];
        if (insertedRow) {
          setSleepHistory((current) => [...current, insertedRow].sort((a, b) => a.log_date.localeCompare(b.log_date)));
          setSleepHoursInput('');
          setSleepMinutesInput('');
          setNewSleepDate('');
        }
      }
    }

    setIsSavingSleep(false);
  };

  const handleStartEditSleepLog = (entry: HealthLogRow) => {
    setDeletingSleepLogId(null);
    setEditingSleepLogId(entry.id);
    const totalMinutes = Math.round(entry.value * 60);
    setEditSleepHours(String(Math.floor(totalMinutes / 60)));
    setEditSleepMinutes(String(totalMinutes % 60));
    setEditSleepDate(entry.log_date);
  };

  const handleCancelEditSleepLog = () => {
    setEditingSleepLogId(null);
  };

  const handleSaveEditSleepLog = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setSleepError(null);

    const hoursNum = Number(editSleepHours || 0);
    const minutesNum = Number(editSleepMinutes || 0);
    if (!Number.isFinite(hoursNum) || hoursNum < 0 || !Number.isFinite(minutesNum) || minutesNum < 0 || minutesNum >= 60) {
      setSleepError('Enter a valid number of hours and minutes.');
      return;
    }

    const value = hoursNum + minutesNum / 60;
    const logDate = editSleepDate || todayKey;

    setIsSavingSleepEdit(true);

    const { error } = await supabase.from('health_logs').update({ value, log_date: logDate }).eq('id', id);

    if (error) {
      console.error('Unable to update sleep entry:', error);
      setSleepError(`Unable to update that entry (${error.message}).`);
    } else {
      const updatedHistory = sleepHistory
        .map((row) => (row.id === id ? { ...row, value, log_date: logDate } : row))
        .sort((a, b) => a.log_date.localeCompare(b.log_date));
      setSleepHistory(updatedHistory);

      setEditingSleepLogId(null);
    }

    setIsSavingSleepEdit(false);
  };

  const handleStartDeleteSleepLog = (id: string) => {
    setEditingSleepLogId(null);
    setDeletingSleepLogId(id);
  };

  const handleCancelDeleteSleepLog = () => {
    setDeletingSleepLogId(null);
  };

  const handleConfirmDeleteSleepLog = async (id: string) => {
    setIsDeletingSleepLog(true);
    setSleepError(null);

    const { error } = await supabase.from('health_logs').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete sleep entry:', error);
      setSleepError(`Unable to delete that entry (${error.message}).`);
    } else {
      setSleepHistory((current) => current.filter((row) => row.id !== id));
    }

    setDeletingSleepLogId(null);
    setIsDeletingSleepLog(false);
  };

  const sortWorkouts = (rows: WorkoutRow[]) =>
    [...rows].sort((a, b) => b.workout_date.localeCompare(a.workout_date) || b.created_at.localeCompare(a.created_at));

  const handleSaveWorkout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorkoutError(null);

    if (!currentUserId) {
      setWorkoutError('Please sign in to log a workout.');
      return;
    }

    const trimmedName = newWorkoutName.trim();
    if (!trimmedName) {
      setWorkoutError('Enter a workout name.');
      return;
    }

    const duration = Number(newWorkoutDuration);
    if (!Number.isFinite(duration) || duration < 0) {
      setWorkoutError('Enter a valid duration.');
      return;
    }

    const logDate = newWorkoutDate || todayKey;

    setIsSavingWorkout(true);

    const { data: insertedRows, error } = await supabase
      .from('workouts')
      .insert({
        user_id: currentUserId,
        workout_date: logDate,
        name: trimmedName,
        workout_type: newWorkoutType,
        duration_minutes: duration,
      })
      .select();

    if (error) {
      console.error('Unable to save workout:', error);
      setWorkoutError(`Unable to save your workout (${error.message}).`);
    } else {
      const insertedRow = (insertedRows as WorkoutRow[] | null)?.[0];
      if (insertedRow) {
        setWorkoutsHistory((current) => sortWorkouts([insertedRow, ...current]));
        setNewWorkoutName('');
        setNewWorkoutDuration('');
        setNewWorkoutDate('');
      }
    }

    setIsSavingWorkout(false);
  };

  const handleStartEditWorkout = (entry: WorkoutRow) => {
    setDeletingWorkoutId(null);
    setEditingWorkoutId(entry.id);
    setEditWorkoutName(entry.name);
    setEditWorkoutType(entry.workout_type ?? WORKOUT_TYPES[0]);
    setEditWorkoutDuration(entry.duration_minutes != null ? String(entry.duration_minutes) : '');
    setEditWorkoutDate(entry.workout_date);
  };

  const handleCancelEditWorkout = () => {
    setEditingWorkoutId(null);
  };

  const handleSaveEditWorkout = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setWorkoutError(null);

    const trimmedName = editWorkoutName.trim();
    if (!trimmedName) {
      setWorkoutError('Enter a workout name.');
      return;
    }

    const duration = Number(editWorkoutDuration);
    if (!Number.isFinite(duration) || duration < 0) {
      setWorkoutError('Enter a valid duration.');
      return;
    }

    const logDate = editWorkoutDate || todayKey;

    setIsSavingWorkoutEdit(true);

    const { error } = await supabase
      .from('workouts')
      .update({ name: trimmedName, workout_type: editWorkoutType, duration_minutes: duration, workout_date: logDate })
      .eq('id', id);

    if (error) {
      console.error('Unable to update workout:', error);
      setWorkoutError(`Unable to update that workout (${error.message}).`);
    } else {
      setWorkoutsHistory((current) =>
        sortWorkouts(
          current.map((row) =>
            row.id === id
              ? { ...row, name: trimmedName, workout_type: editWorkoutType, duration_minutes: duration, workout_date: logDate }
              : row
          )
        )
      );
      setEditingWorkoutId(null);
    }

    setIsSavingWorkoutEdit(false);
  };

  const handleStartDeleteWorkout = (id: string) => {
    setEditingWorkoutId(null);
    setDeletingWorkoutId(id);
  };

  const handleCancelDeleteWorkout = () => {
    setDeletingWorkoutId(null);
  };

  const handleConfirmDeleteWorkout = async (id: string) => {
    setIsDeletingWorkout(true);
    setWorkoutError(null);

    const { error } = await supabase.from('workouts').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete workout:', error);
      setWorkoutError(`Unable to delete that workout (${error.message}).`);
    } else {
      setWorkoutsHistory((current) => current.filter((row) => row.id !== id));
      setExercisesByWorkout((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }

    setDeletingWorkoutId(null);
    setIsDeletingWorkout(false);
  };

  const loadExercisesForWorkout = async (workoutId: string) => {
    setLoadingExercisesWorkoutId(workoutId);
    setExercisesError(null);

    const { data, error } = await supabase
      .from('workout_exercises')
      .select('*')
      .eq('workout_id', workoutId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Unable to load workout exercises:', error);
      setExercisesError(`Unable to load exercises (${error.message}).`);
    } else if (data) {
      setExercisesByWorkout((current) => ({ ...current, [workoutId]: data as WorkoutExerciseRow[] }));
    }

    setLoadingExercisesWorkoutId(null);
  };

  const handleToggleExpandWorkout = (workoutId: string) => {
    const willExpand = expandedWorkoutId !== workoutId;
    setExpandedWorkoutId(willExpand ? workoutId : null);
    setExercisesError(null);

    if (willExpand && !(workoutId in exercisesByWorkout)) {
      void loadExercisesForWorkout(workoutId);
    }
  };

  const handleAddExercise = async (event: FormEvent<HTMLFormElement>, workoutId: string) => {
    event.preventDefault();
    setExercisesError(null);

    if (!currentUserId) {
      setExercisesError('Please sign in to log exercises.');
      return;
    }

    const trimmedName = newExerciseName.trim();
    if (!trimmedName) {
      setExercisesError('Enter an exercise name.');
      return;
    }

    const sets = newExerciseSets.trim() ? Number(newExerciseSets) : null;
    const reps = newExerciseReps.trim() ? Number(newExerciseReps) : null;
    const weightLbs = newExerciseWeight.trim() ? Number(newExerciseWeight) : null;

    setIsSavingExercise(true);

    const { data: insertedRows, error } = await supabase
      .from('workout_exercises')
      .insert({ user_id: currentUserId, workout_id: workoutId, exercise_name: trimmedName, sets, reps, weight_lbs: weightLbs })
      .select();

    if (error) {
      console.error('Unable to save exercise:', error);
      setExercisesError(`Unable to save that exercise (${error.message}).`);
    } else {
      const insertedRow = (insertedRows as WorkoutExerciseRow[] | null)?.[0];
      if (insertedRow) {
        setExercisesByWorkout((current) => ({
          ...current,
          [workoutId]: [...(current[workoutId] ?? []), insertedRow],
        }));
        setNewExerciseName('');
        setNewExerciseSets('');
        setNewExerciseReps('');
        setNewExerciseWeight('');
      }
    }

    setIsSavingExercise(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    router.push('/login');
  };

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/planner', label: 'Planner' },
    { href: '/health', label: 'Health & Fitness' },
    { href: '/analytics', label: 'Analytics' },
  ];

  const buildStatCard = (key: 'created' | 'completed' | 'overdue', label: string, background: string, valueColor: string) => {
    const { current, previous } = taskStats[key];
    const change = computeStatChange(current, previous);
    const increaseIsGood = key !== 'overdue';

    let changeColor = 'var(--muted)';
    if (change.direction !== 'flat') {
      const isIncrease = change.direction === 'up';
      changeColor = isIncrease === increaseIsGood ? '#16a34a' : '#dc2626';
    }

    return { key, label, background, valueColor, value: current, changeText: change.text, changeColor };
  };

  const statCards = [
    buildStatCard('created', 'Created', 'var(--surface-strong)', 'var(--foreground)'),
    buildStatCard('completed', 'Completed', 'rgba(34, 197, 94, 0.14)', '#15803d'),
    buildStatCard('overdue', 'Overdue', 'rgba(220, 38, 38, 0.12)', '#dc2626'),
  ];

  const renderHeader = () => (
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

        <div className="flex flex-wrap items-end gap-3">
          <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
            {navItems.map((item) => {
              const isActive = item.href === (activeView === 'dashboard' ? '/' : `/${activeView}`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 transition ${
                    isActive
                      ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow-[var(--shadow-soft)]'
                      : 'hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">CHOOSE YOUR MOCHI</p>
            <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-3 py-2 shadow-[var(--shadow-soft)]">
              {themeOptions.map((option) => {
                const isActive = theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={`Switch to ${option.label}`}
                    onClick={() => handleThemeSelect(option.id)}
                    className={`h-6 w-6 rounded-full border transition ${isActive ? 'scale-110 border-[color:var(--foreground)]' : 'border-[color:var(--border)]'}`}
                    style={{ backgroundColor: option.swatch }}
                  />
                );
              })}
            </div>
          </div>

          {session ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm font-semibold text-[color:var(--accent-strong)] shadow-[var(--shadow-soft)] transition hover:bg-[color:var(--surface-strong)]"
            >
              Log out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] text-[color:var(--foreground)]">
        <div className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm font-medium shadow-[var(--shadow-soft)]">
          Checking your session…
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {renderHeader()}

        {activeView === 'dashboard' ? (
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
                <div className="max-w-xl">
                  <p className="text-sm leading-6 text-current/90">&ldquo;{verse.text}&rdquo;</p>
                  <p className="mt-1 text-right text-xs text-current/80">{verse.reference}</p>
                </div>
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
                  {weekDays.slice(0, 5).map((day) => {
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

                <div className="mt-6 max-h-[280px] space-y-4 overflow-y-auto pr-1">
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
                          <button
                            type="button"
                            onClick={() => void handleToggleTask(task)}
                            aria-label={task.is_complete ? 'Mark task incomplete' : 'Mark task complete'}
                            aria-pressed={task.is_complete}
                            className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 border-[color:var(--accent)] transition ${
                              task.is_complete ? 'bg-[color:var(--accent)]' : 'bg-transparent'
                            }`}
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
        ) : activeView === 'planner' ? (
          <main className="space-y-6">
            <section
              className="relative overflow-hidden rounded-[36px] border border-[color:var(--border)] p-6 shadow-[var(--shadow)]"
              style={{ background: 'linear-gradient(135deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
            >
              <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <ThemeOrb theme={theme} className="h-20 w-20 sm:h-28 sm:w-28 lg:h-[120px] lg:w-[120px]" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">Planner</p>
                    <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                      Your daily rhythm
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                      A calm space for your schedule, tasks, and notes in one place.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-[color:var(--surface-soft)] px-4 py-2 text-sm font-medium text-[color:var(--accent-strong)] shadow-[var(--shadow-soft)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                  <span className="tabular-nums">{formatFloridaTime(now)}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">ET</span>
                </div>
              </div>
            </section>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {weekDays.map((day) => {
                const isActive = selectedDay === day.key;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setSelectedDay(day.key)}
                    className={`min-w-[78px] flex-1 rounded-[22px] border px-3 py-2 text-center text-sm transition ${
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

            <section className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr_0.9fr]">
              <div className="relative overflow-hidden rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <ThemeOrb theme={theme} className="pointer-events-none absolute -bottom-3 -right-3 h-14 w-14 opacity-40" />
                <div className="relative z-10 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Calendar</h3>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    Full month
                  </span>
                </div>

                <div className="relative z-10 mt-5">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      aria-label="Previous month"
                      className="rounded-full px-2 py-1 text-sm text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      aria-label="Next month"
                      className="rounded-full px-2 py-1 text-sm text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>

                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {calendarCells.map((cell) => {
                      const isSelected = cell.key === selectedDay;
                      const isToday = cell.key === todayKey;
                      const holidayName = holidaysByDateKey.get(cell.key);
                      return (
                        <button
                          key={cell.key}
                          type="button"
                          onClick={() => setSelectedDay(cell.key)}
                          title={holidayName}
                          className={`relative aspect-square rounded-full text-xs transition ${
                            !cell.inMonth ? 'text-[color:var(--muted)]/40' : 'text-[color:var(--foreground)]'
                          } ${
                            isSelected
                              ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                              : isToday
                              ? 'border border-[color:var(--accent)]'
                              : 'hover:bg-[color:var(--surface-strong)]'
                          }`}
                        >
                          {cell.date.getDate()}
                          {holidayName ? (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                              style={{ backgroundColor: isSelected ? 'currentColor' : 'var(--accent)' }}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-[color:var(--foreground)]">To-do</h3>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {visibleTasks.length} tasks
                  </span>
                </div>

                <form onSubmit={handleCreateTask} className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 shadow-[var(--shadow-soft)]">
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
                      {isSavingTask ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      type="date"
                      value={newTaskDate || selectedDay}
                      onChange={(event) => setNewTaskDate(event.target.value)}
                      aria-label="Task date"
                      className="min-w-0 flex-1 basis-[150px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
                    <select
                      value={newTaskTimeSlot}
                      onChange={(event) => setNewTaskTimeSlot(event.target.value)}
                      aria-label="Task time"
                      className="min-w-0 flex-1 basis-[110px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    >
                      <option value="">Time</option>
                      {timeSlotOptions.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1">
                      {(['AM', 'PM'] as const).map((meridiem) => (
                        <button
                          key={meridiem}
                          type="button"
                          onClick={() => setNewTaskTimeMeridiem(meridiem)}
                          aria-pressed={newTaskTimeMeridiem === meridiem}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            newTaskTimeMeridiem === meridiem
                              ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                              : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                          }`}
                        >
                          {meridiem}
                        </button>
                      ))}
                    </div>
                    <input
                      value={newTaskDescription}
                      onChange={(event) => setNewTaskDescription(event.target.value)}
                      placeholder="Notes"
                      className="min-w-0 flex-1 basis-[180px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
                  </div>
                </form>

                {taskError ? <p className="mt-4 text-sm text-[color:var(--accent-strong)]">{taskError}</p> : null}

                <div className="mt-5 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                  {isLoadingTasks ? (
                    <p className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      Loading your tasks…
                    </p>
                  ) : visibleTasks.length === 0 ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      Nothing planned for this day yet.
                    </div>
                  ) : (
                    visibleTasks.map((task) => {
                      const overdue = isTaskOverdue(task, selectedDay, now);

                      if (editingTaskId === task.id) {
                        return (
                          <form
                            key={task.id}
                            onSubmit={(event) => void handleSaveEditTask(event, task.id)}
                            className="rounded-[20px] border border-[color:var(--accent)] bg-[color:var(--surface-soft)] p-3"
                          >
                            <input
                              value={editTaskTitle}
                              onChange={(event) => setEditTaskTitle(event.target.value)}
                              placeholder="Task name"
                              autoFocus
                              className="w-full rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                              <input
                                value={editTaskTime}
                                onChange={(event) => setEditTaskTime(event.target.value)}
                                placeholder="Time"
                                className="min-w-0 flex-1 basis-[120px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <input
                                value={editTaskDescription}
                                onChange={(event) => setEditTaskDescription(event.target.value)}
                                placeholder="Notes"
                                className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditTask}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingEdit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      if (deletingTaskId === task.id) {
                        return (
                          <div key={task.id} className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                            <p className="text-sm text-[color:var(--foreground)]">Delete &ldquo;{task.title}&rdquo;?</p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDeleteTask}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDeleteTask(task.id)}
                                disabled={isDeletingTask}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                {isDeletingTask ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                      <div key={task.id} className="flex items-start gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                        <button
                          type="button"
                          onClick={() => void handleToggleTask(task)}
                          aria-label={task.is_complete ? 'Mark task incomplete' : 'Mark task complete'}
                          aria-pressed={task.is_complete}
                          className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 border-[color:var(--accent)] transition ${
                            task.is_complete ? 'bg-[color:var(--accent)]' : 'bg-transparent'
                          }`}
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-sm font-semibold ${task.is_complete ? 'text-[color:var(--muted)] line-through' : 'text-[color:var(--foreground)]'}`}>
                              {task.title}
                            </p>
                            {overdue ? (
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={{ backgroundColor: 'rgba(220, 38, 38, 0.12)', color: '#dc2626' }}
                              >
                                Overdue
                              </span>
                            ) : null}
                          </div>
                          {task.time_label || task.description ? (
                            <div className="mt-1 text-sm text-[color:var(--muted)]">
                              {task.time_label ? <span>{task.time_label}</span> : null}
                              {task.time_label && task.description ? <span> · </span> : null}
                              {task.description ? <span>{task.description}</span> : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditTask(task)}
                            aria-label="Edit task"
                            className="rounded-full p-1.5 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-strong)]"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartDeleteTask(task.id)}
                            aria-label="Delete task"
                            className="rounded-full p-1.5 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-strong)]"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path
                                d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <ThemeOrb theme={theme} className="pointer-events-none absolute -bottom-3 -right-3 h-14 w-14 opacity-40" />
                <div className="relative z-10 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-[color:var(--foreground)]">This Month</h3>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long' })}
                  </span>
                </div>

                <div className="relative z-10 mt-5 max-h-[300px] space-y-4 overflow-y-auto pr-1">
                  {isLoadingTasks ? (
                    <p className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      Loading your tasks…
                    </p>
                  ) : monthlyTaskGroups.length === 0 ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      Nothing planned for {calendarMonth.toLocaleDateString('en-US', { month: 'long' })} yet.
                    </div>
                  ) : (
                    monthlyTaskGroups.map((group) => (
                      <div key={group.dateKey}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{group.dateLabel}</p>
                        <div className="mt-2 space-y-2">
                          {group.items.map((item) =>
                            item.type === 'holiday' ? (
                              <div
                                key={item.id}
                                className="flex items-start gap-3 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3"
                              >
                                <span
                                  aria-hidden="true"
                                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: 'var(--accent)' }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-sm font-semibold ${
                                      item.isPast ? 'text-[color:var(--muted)] line-through' : 'text-[color:var(--accent-strong)]'
                                    }`}
                                  >
                                    {item.name}
                                  </p>
                                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">Holiday</p>
                                </div>
                              </div>
                            ) : (
                              <div
                                key={item.id}
                                className="flex items-start gap-3 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3"
                              >
                                <button
                                  type="button"
                                  onClick={() => void handleToggleTask(item.task)}
                                  aria-label={item.task.is_complete ? 'Mark task incomplete' : 'Mark task complete'}
                                  aria-pressed={item.task.is_complete}
                                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-[color:var(--accent)] transition ${
                                    item.task.is_complete ? 'bg-[color:var(--accent)]' : 'bg-transparent'
                                  }`}
                                />
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-sm font-semibold ${
                                      item.task.is_complete ? 'text-[color:var(--muted)] line-through' : 'text-[color:var(--foreground)]'
                                    }`}
                                  >
                                    {item.task.title}
                                  </p>
                                  {item.task.time_label ? (
                                    <p className="mt-0.5 text-xs text-[color:var(--muted)]">{item.task.time_label}</p>
                                  ) : null}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </main>
        ) : activeView === 'health' ? (
          <main className="space-y-6">
            <section
              className="relative overflow-hidden rounded-[36px] border border-[color:var(--border)] p-6 shadow-[var(--shadow)]"
              style={{ background: 'linear-gradient(135deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
            >
              <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <ThemeOrb theme={theme} className="h-20 w-20 sm:h-28 sm:w-28 lg:h-[120px] lg:w-[120px]" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">Wellness</p>
                    <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                      Health & Fitness
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                      Track sleep, steps, water, weight, and workouts — one gentle habit at a time.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-[color:var(--surface-soft)] px-4 py-2 text-sm font-medium text-[color:var(--accent-strong)] shadow-[var(--shadow-soft)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                  <span className="tabular-nums">{formatFloridaTime(now)}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">ET</span>
                </div>
              </div>
            </section>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {weekDays.map((day) => {
                const isActive = selectedDay === day.key;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setSelectedDay(day.key)}
                    className={`min-w-[78px] flex-1 rounded-[22px] border px-3 py-2 text-center text-sm transition ${
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

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Body Mass Index</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBodyMetricsForm((value) => !value)}
                    aria-label={showBodyMetricsForm ? 'Hide height and weight fields' : 'Edit height and weight'}
                    aria-pressed={showBodyMetricsForm}
                    className={`rounded-full p-1.5 transition hover:bg-[color:var(--surface-strong)] ${
                      showBodyMetricsForm ? 'bg-[color:var(--surface-strong)] text-[color:var(--accent-strong)]' : 'text-[color:var(--accent)]'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mt-5 flex flex-col items-center gap-3 text-center">
                  <svg
                    width={silhouetteMetrics.svgWidth}
                    height={silhouetteMetrics.svgHeight}
                    viewBox={`0 0 ${silhouetteMetrics.svgWidth} ${silhouetteMetrics.svgHeight}`}
                    aria-hidden="true"
                    className="shrink-0 transition-all duration-300"
                  >
                    <rect
                      x={silhouetteMetrics.leftLegX}
                      y={silhouetteMetrics.legY}
                      width={silhouetteMetrics.legWidth}
                      height={silhouetteMetrics.legHeight}
                      rx={silhouetteMetrics.legRadius}
                      fill="var(--accent)"
                      opacity="0.85"
                    />
                    <rect
                      x={silhouetteMetrics.rightLegX}
                      y={silhouetteMetrics.legY}
                      width={silhouetteMetrics.legWidth}
                      height={silhouetteMetrics.legHeight}
                      rx={silhouetteMetrics.legRadius}
                      fill="var(--accent)"
                      opacity="0.85"
                    />
                    <rect
                      x={silhouetteMetrics.bodyX}
                      y={silhouetteMetrics.bodyY}
                      width={silhouetteMetrics.bodyWidth}
                      height={silhouetteMetrics.bodyHeight}
                      rx={silhouetteMetrics.bodyRadius}
                      fill="var(--accent)"
                      opacity="0.85"
                    />
                    <circle cx={silhouetteMetrics.headCx} cy={silhouetteMetrics.headCy} r={silhouetteMetrics.headRadius} fill="var(--accent)" opacity="0.85" />
                  </svg>

                  {bmi === null ? (
                    <p className="text-sm text-[color:var(--muted)]">Add your height and weight to calculate your BMI.</p>
                  ) : (
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                        {bmi.toFixed(1)}
                      </span>
                      <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent-strong)]">
                        {bmiCategory}
                      </span>
                    </div>
                  )}

                  <div className="w-full max-w-[240px]">
                    <div className="flex h-3 overflow-hidden rounded-full border border-[color:var(--border)]">
                      {bmiCategoryRanges.map((category) => (
                        <div
                          key={category.label}
                          style={{
                            width: `${((category.max - category.min) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100}%`,
                            backgroundColor: bmiCategoryBarColors[category.label],
                          }}
                        />
                      ))}
                    </div>
                    <div className="relative h-3">
                      {bmiMarkerPercent !== null ? (
                        <div
                          aria-hidden="true"
                          className="absolute -top-[22px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-[color:var(--surface)]"
                          style={{ left: `${bmiMarkerPercent}%`, backgroundColor: 'var(--foreground)' }}
                        />
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex justify-between whitespace-nowrap text-[9px] font-semibold uppercase text-[color:var(--muted)]">
                      {bmiCategoryRanges.map((category) => (
                        <span key={category.label}>{category.label}</span>
                      ))}
                    </div>
                  </div>

                  {bodyMetricsError ? <p className="text-xs text-[color:var(--accent-strong)]">{bodyMetricsError}</p> : null}
                </div>

                {showBodyMetricsForm ? (
                  <form
                    onSubmit={(event) => void handleSaveBodyMetrics(event)}
                    className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--muted)]">
                        Height
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={heightFeetInput}
                            onChange={(event) => setHeightFeetInput(event.target.value)}
                            placeholder="ft"
                            aria-label="Height feet"
                            className="w-16 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                          />
                          <span className="text-xs text-[color:var(--muted)]">ft</span>
                          <input
                            type="number"
                            min="0"
                            max="11"
                            inputMode="numeric"
                            value={heightInchesInput}
                            onChange={(event) => setHeightInchesInput(event.target.value)}
                            placeholder="in"
                            aria-label="Height inches"
                            className="w-16 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                          />
                          <span className="text-xs text-[color:var(--muted)]">in</span>
                        </div>
                      </label>

                      <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--muted)]">
                        Weight
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            inputMode="decimal"
                            value={weightInput}
                            onChange={(event) => setWeightInput(event.target.value)}
                            placeholder="lbs"
                            aria-label="Weight in pounds"
                            className="w-24 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                          />
                          <span className="text-xs text-[color:var(--muted)]">lbs</span>
                        </div>
                      </label>

                      <button
                        type="submit"
                        disabled={isSavingBodyMetrics || isLoadingBodyMetrics}
                        className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                      >
                        {isSavingBodyMetrics ? 'Saving…' : 'Save'}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[color:var(--muted)]">Weighed in at</span>
                      <input
                        type="date"
                        value={newWeightDate || todayKey}
                        onChange={(event) => setNewWeightDate(event.target.value)}
                        aria-label="Weigh-in date"
                        className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <select
                        value={newWeightTimeSlot || defaultWeightTimeSlot.slot}
                        onChange={(event) => setNewWeightTimeSlot(event.target.value)}
                        aria-label="Weigh-in time"
                        className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      >
                        {timeSlotOptions.map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                      <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1">
                        {(['AM', 'PM'] as const).map((meridiem) => (
                          <button
                            key={meridiem}
                            type="button"
                            onClick={() => setNewWeightTimeMeridiem(meridiem)}
                            aria-pressed={newWeightTimeMeridiem === meridiem}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              newWeightTimeMeridiem === meridiem
                                ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                                : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                            }`}
                          >
                            {meridiem}
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>
                ) : null}
              </section>

              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Weight Log</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {weightHistory.length} {weightHistory.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['day', 'week', 'month'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setWeightLogFilter(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          weightLogFilter === period
                            ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setWeightLogAnchorDate((prev) => shiftAnchorDate(weightLogFilter, prev, -1))}
                      aria-label={`Previous ${weightLogFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatCompactPeriodLabel(weightLogFilter, weightLogAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWeightLogAnchorDate((prev) => shiftAnchorDate(weightLogFilter, prev, 1))}
                      aria-label={`Next ${weightLogFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div className="mt-3 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                  {filteredWeightHistory.length === 0 ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      {weightHistory.length === 0 ? 'No weight entries yet.' : `No weight entries this ${weightLogFilter}.`}
                    </div>
                  ) : (
                    [...filteredWeightHistory].reverse().map((entry) => {
                      const { dateLabel, timeLabel } = formatLogTimestamp(entry.created_at);

                      if (editingWeightLogId === entry.id) {
                        return (
                          <form
                            key={entry.id}
                            onSubmit={(event) => void handleSaveEditWeightLog(event, entry.id)}
                            className="rounded-[20px] border border-[color:var(--accent)] bg-[color:var(--surface-soft)] p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                inputMode="decimal"
                                value={editWeightValue}
                                onChange={(event) => setEditWeightValue(event.target.value)}
                                placeholder="lbs"
                                autoFocus
                                aria-label="Weight in pounds"
                                className="w-20 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <span className="text-xs text-[color:var(--muted)]">lbs</span>
                              <input
                                type="date"
                                value={editWeightDate}
                                onChange={(event) => setEditWeightDate(event.target.value)}
                                aria-label="Entry date"
                                className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <select
                                value={editWeightTimeSlot}
                                onChange={(event) => setEditWeightTimeSlot(event.target.value)}
                                aria-label="Entry time"
                                className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              >
                                {timeSlotOptions.map((slot) => (
                                  <option key={slot} value={slot}>
                                    {slot}
                                  </option>
                                ))}
                              </select>
                              <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1">
                                {(['AM', 'PM'] as const).map((meridiem) => (
                                  <button
                                    key={meridiem}
                                    type="button"
                                    onClick={() => setEditWeightTimeMeridiem(meridiem)}
                                    aria-pressed={editWeightTimeMeridiem === meridiem}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                      editWeightTimeMeridiem === meridiem
                                        ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                                        : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                                    }`}
                                  >
                                    {meridiem}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditWeightLog}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingWeightEdit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingWeightEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      if (deletingWeightLogId === entry.id) {
                        return (
                          <div key={entry.id} className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                            <p className="text-sm text-[color:var(--foreground)]">
                              Delete the {entry.value} lbs entry from {dateLabel}?
                            </p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDeleteWeightLog}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDeleteWeightLog(entry.id)}
                                disabled={isDeletingWeightLog}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                {isDeletingWeightLog ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={entry.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                          <div>
                            <p className="text-sm font-semibold text-[color:var(--foreground)]">{entry.value} lbs</p>
                            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                              {dateLabel} · {timeLabel}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditWeightLog(entry)}
                              aria-label="Edit weight entry"
                              className="rounded-full p-1.5 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-strong)]"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartDeleteWeightLog(entry.id)}
                              aria-label="Delete weight entry"
                              className="rounded-full p-1.5 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-strong)]"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path
                                  d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Steps Log</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {stepsHistory.length} {stepsHistory.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>

                <form onSubmit={(event) => void handleSaveSteps(event)} className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={stepsValueInput}
                    onChange={(event) => setStepsValueInput(event.target.value)}
                    placeholder="Steps"
                    aria-label="Step count"
                    className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <input
                    type="date"
                    value={newStepsDate || todayKey}
                    onChange={(event) => setNewStepsDate(event.target.value)}
                    aria-label="Step count date"
                    className="min-w-0 max-w-[150px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingSteps || isLoadingSteps}
                    className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                  >
                    {isSavingSteps ? 'Saving…' : 'Add'}
                  </button>
                </form>

                {stepsError ? <p className="mt-2 text-xs text-[color:var(--accent-strong)]">{stepsError}</p> : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['week', 'month'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setStepsLogFilter(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          stepsLogFilter === period
                            ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setStepsLogAnchorDate((prev) => shiftAnchorDate(stepsLogFilter, prev, -1))}
                      aria-label={`Previous ${stepsLogFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatCompactPeriodLabel(stepsLogFilter, stepsLogAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStepsLogAnchorDate((prev) => shiftAnchorDate(stepsLogFilter, prev, 1))}
                      aria-label={`Next ${stepsLogFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div className="mt-3 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                  {filteredStepsHistory.length === 0 ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      {stepsHistory.length === 0 ? 'No step entries yet.' : `No step entries this ${stepsLogFilter}.`}
                    </div>
                  ) : (
                    [...filteredStepsHistory].reverse().map((entry) => {
                      if (editingStepsLogId === entry.id) {
                        return (
                          <form
                            key={entry.id}
                            onSubmit={(event) => void handleSaveEditStepsLog(event, entry.id)}
                            className="rounded-[20px] border border-[color:var(--accent)] bg-[color:var(--surface-soft)] p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={editStepsValue}
                                onChange={(event) => setEditStepsValue(event.target.value)}
                                placeholder="Steps"
                                autoFocus
                                aria-label="Step count"
                                className="w-24 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <span className="text-xs text-[color:var(--muted)]">steps</span>
                              <input
                                type="date"
                                value={editStepsDate}
                                onChange={(event) => setEditStepsDate(event.target.value)}
                                aria-label="Entry date"
                                className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditStepsLog}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingStepsEdit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingStepsEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      if (deletingStepsLogId === entry.id) {
                        return (
                          <div key={entry.id} className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                            <p className="text-sm text-[color:var(--foreground)]">
                              Delete the {entry.value} steps entry from {formatShortDate(entry.log_date)}?
                            </p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDeleteStepsLog}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDeleteStepsLog(entry.id)}
                                disabled={isDeletingStepsLog}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                {isDeletingStepsLog ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const entryShade = getStepsEntryShade(theme, entry.value);

                      return (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--border)] p-3"
                          style={{ backgroundColor: entryShade.background }}
                        >
                          <div>
                            <p className="text-sm font-semibold" style={{ color: entryShade.text }}>{entry.value} steps</p>
                            <p className="mt-0.5 text-xs" style={{ color: entryShade.text, opacity: 0.8 }}>{formatShortDate(entry.log_date)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditStepsLog(entry)}
                              aria-label="Edit steps entry"
                              className="rounded-full p-1.5 transition hover:opacity-70"
                              style={{ color: entryShade.text }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartDeleteStepsLog(entry.id)}
                              aria-label="Delete steps entry"
                              className="rounded-full p-1.5 transition hover:opacity-70"
                              style={{ color: entryShade.text }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path
                                  d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Water Intake</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {waterHistory.length} {waterHistory.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>

                <div className="mt-5 flex flex-col items-center gap-3 text-center">
                  <div className="relative" style={{ width: WATER_RING_SIZE, height: WATER_RING_SIZE }}>
                    <svg width={WATER_RING_SIZE} height={WATER_RING_SIZE} viewBox={`0 0 ${WATER_RING_SIZE} ${WATER_RING_SIZE}`} aria-hidden="true">
                      <defs>
                        <clipPath id={waterClipId}>
                          <circle cx={WATER_RING_SIZE / 2} cy={WATER_RING_SIZE / 2} r={WATER_RING_RADIUS - WATER_RING_STROKE / 2} />
                        </clipPath>
                      </defs>
                      <circle
                        cx={WATER_RING_SIZE / 2}
                        cy={WATER_RING_SIZE / 2}
                        r={WATER_RING_RADIUS}
                        fill="none"
                        stroke="var(--accent-soft)"
                        strokeWidth={WATER_RING_STROKE}
                      />
                      <g clipPath={`url(#${waterClipId})`}>
                        <rect x="0" y={waterWaveY} width={WATER_RING_SIZE} height={Math.max(0, WATER_RING_SIZE - waterWaveY)} fill="var(--accent)" opacity="0.3" />
                        <path
                          d={buildWavePath(WATER_RING_SIZE * 2, WATER_RING_SIZE, waterWaveY, 4)}
                          fill="var(--accent)"
                          opacity="0.55"
                          className="water-wave-path"
                        />
                      </g>
                      <circle
                        cx={WATER_RING_SIZE / 2}
                        cy={WATER_RING_SIZE / 2}
                        r={WATER_RING_RADIUS}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth={WATER_RING_STROKE}
                        strokeLinecap="round"
                        strokeDasharray={WATER_RING_CIRCUMFERENCE}
                        strokeDashoffset={WATER_RING_CIRCUMFERENCE * (1 - waterRingPercent / 100)}
                        transform={`rotate(-90 ${WATER_RING_SIZE / 2} ${WATER_RING_SIZE / 2})`}
                        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M6 4h12l-1.5 15a2 2 0 0 1-2 1.8H9.5a2 2 0 0 1-2-1.8L6 4z"
                          stroke="var(--accent-strong)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path d="M7 9h10" stroke="var(--accent-strong)" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span className="text-2xl font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                        {waterPercentDisplay}%
                      </span>
                      <span className="text-xs font-semibold text-[color:var(--muted)]">{todayWaterOz} oz</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1.5">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">Daily goal: {waterGoal} oz</span>
                    <button
                      type="button"
                      onClick={() => setShowWaterGoalEdit((value) => !value)}
                      aria-label={showWaterGoalEdit ? 'Cancel editing daily water goal' : 'Edit daily water goal'}
                      aria-pressed={showWaterGoalEdit}
                      className={`rounded-full p-1 transition hover:bg-[color:var(--surface-strong)] ${
                        showWaterGoalEdit ? 'bg-[color:var(--surface-strong)] text-[color:var(--accent-strong)]' : 'text-[color:var(--accent)]'
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  {showWaterGoalEdit ? (
                    <form onSubmit={handleSaveWaterGoal} className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={waterGoalInput}
                        onChange={(event) => setWaterGoalInput(event.target.value)}
                        aria-label="Daily water goal in ounces"
                        className="w-20 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1.5 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <span className="text-xs text-[color:var(--muted)]">oz</span>
                      <button
                        type="submit"
                        className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)]"
                      >
                        Save
                      </button>
                    </form>
                  ) : null}

                  {waterError ? <p className="text-xs text-[color:var(--accent-strong)]">{waterError}</p> : null}
                </div>

                <form onSubmit={(event) => void handleSaveWater(event)} className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={waterValueInput}
                    onChange={(event) => setWaterValueInput(event.target.value)}
                    placeholder="Oz"
                    aria-label="Water amount"
                    className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <input
                    type="date"
                    value={newWaterDate || todayKey}
                    onChange={(event) => setNewWaterDate(event.target.value)}
                    aria-label="Water entry date"
                    className="min-w-0 max-w-[150px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingWater || isLoadingWater}
                    className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                  >
                    {isSavingWater ? 'Saving…' : 'Add'}
                  </button>
                </form>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['day', 'week', 'month'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setWaterLogFilter(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          waterLogFilter === period
                            ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setWaterLogAnchorDate((prev) => shiftAnchorDate(waterLogFilter, prev, -1))}
                      aria-label={`Previous ${waterLogFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatCompactPeriodLabel(waterLogFilter, waterLogAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWaterLogAnchorDate((prev) => shiftAnchorDate(waterLogFilter, prev, 1))}
                      aria-label={`Next ${waterLogFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div className="mt-3 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                  {filteredWaterHistory.length === 0 ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      {waterHistory.length === 0 ? 'No water entries yet.' : `No water entries this ${waterLogFilter}.`}
                    </div>
                  ) : (
                    [...filteredWaterHistory].reverse().map((entry) => {
                      if (editingWaterLogId === entry.id) {
                        return (
                          <form
                            key={entry.id}
                            onSubmit={(event) => void handleSaveEditWaterLog(event, entry.id)}
                            className="rounded-[20px] border border-[color:var(--accent)] bg-[color:var(--surface-soft)] p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={editWaterValue}
                                onChange={(event) => setEditWaterValue(event.target.value)}
                                placeholder="Oz"
                                autoFocus
                                aria-label="Water amount"
                                className="w-24 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <span className="text-xs text-[color:var(--muted)]">oz</span>
                              <input
                                type="date"
                                value={editWaterDate}
                                onChange={(event) => setEditWaterDate(event.target.value)}
                                aria-label="Entry date"
                                className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditWaterLog}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingWaterEdit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingWaterEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      if (deletingWaterLogId === entry.id) {
                        return (
                          <div key={entry.id} className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                            <p className="text-sm text-[color:var(--foreground)]">
                              Delete the {entry.value} oz entry from {formatShortDate(entry.log_date)}?
                            </p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDeleteWaterLog}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDeleteWaterLog(entry.id)}
                                disabled={isDeletingWaterLog}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                {isDeletingWaterLog ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={entry.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                          <div>
                            <p className="text-sm font-semibold text-[color:var(--foreground)]">{entry.value} oz</p>
                            <p className="mt-0.5 text-xs text-[color:var(--muted)]">{formatShortDate(entry.log_date)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditWaterLog(entry)}
                              aria-label="Edit water entry"
                              className="rounded-full p-1.5 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-strong)]"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartDeleteWaterLog(entry.id)}
                              aria-label="Delete water entry"
                              className="rounded-full p-1.5 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-strong)]"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path
                                  d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Sleep</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {sleepHistory.length} {sleepHistory.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>

                <div className="mt-5 flex flex-col items-center gap-2 text-center">
                  <SleepBattery percent={sleepBatteryPercent} className="h-24 w-24" />
                  <span className="text-2xl font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                    {formatSleepDuration(sleepDisplayHours)}
                  </span>
                  <span className="text-xs font-semibold text-[color:var(--muted)]">of {sleepDisplayGoal}h goal</span>

                  {sleepError ? <p className="text-xs text-[color:var(--accent-strong)]">{sleepError}</p> : null}
                </div>

                <form onSubmit={(event) => void handleSaveSleep(event)} className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={sleepHoursInput}
                    onChange={(event) => setSleepHoursInput(event.target.value)}
                    placeholder="Hours"
                    aria-label="Hours slept"
                    className="w-20 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <span className="text-xs text-[color:var(--muted)]">h</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="1"
                    inputMode="numeric"
                    value={sleepMinutesInput}
                    onChange={(event) => setSleepMinutesInput(event.target.value)}
                    placeholder="Minutes"
                    aria-label="Minutes slept"
                    className="w-20 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <span className="text-xs text-[color:var(--muted)]">m</span>
                  <input
                    type="date"
                    value={newSleepDate || todayKey}
                    onChange={(event) => setNewSleepDate(event.target.value)}
                    aria-label="Sleep entry date"
                    className="min-w-0 max-w-[150px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingSleep || isLoadingSleep}
                    className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                  >
                    {isSavingSleep ? 'Saving…' : 'Add'}
                  </button>
                </form>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['day', 'week', 'month'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSleepLogFilter(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          sleepLogFilter === period
                            ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSleepLogAnchorDate((prev) => shiftAnchorDate(sleepLogFilter, prev, -1))}
                      aria-label={`Previous ${sleepLogFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatCompactPeriodLabel(sleepLogFilter, sleepLogAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSleepLogAnchorDate((prev) => shiftAnchorDate(sleepLogFilter, prev, 1))}
                      aria-label={`Next ${sleepLogFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div className="mt-3 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                  {filteredSleepHistory.length === 0 ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      {sleepHistory.length === 0 ? 'No sleep entries yet.' : `No sleep entries this ${sleepLogFilter}.`}
                    </div>
                  ) : (
                    [...filteredSleepHistory].reverse().map((entry) => {
                      if (editingSleepLogId === entry.id) {
                        return (
                          <form
                            key={entry.id}
                            onSubmit={(event) => void handleSaveEditSleepLog(event, entry.id)}
                            className="rounded-[20px] border border-[color:var(--accent)] bg-[color:var(--surface-soft)] p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                value={editSleepHours}
                                onChange={(event) => setEditSleepHours(event.target.value)}
                                placeholder="Hours"
                                autoFocus
                                aria-label="Hours slept"
                                className="w-20 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <span className="text-xs text-[color:var(--muted)]">h</span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                step="1"
                                inputMode="numeric"
                                value={editSleepMinutes}
                                onChange={(event) => setEditSleepMinutes(event.target.value)}
                                placeholder="Minutes"
                                aria-label="Minutes slept"
                                className="w-20 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <span className="text-xs text-[color:var(--muted)]">m</span>
                              <input
                                type="date"
                                value={editSleepDate}
                                onChange={(event) => setEditSleepDate(event.target.value)}
                                aria-label="Entry date"
                                className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditSleepLog}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingSleepEdit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingSleepEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      if (deletingSleepLogId === entry.id) {
                        return (
                          <div key={entry.id} className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                            <p className="text-sm text-[color:var(--foreground)]">
                              Delete the {formatSleepDuration(entry.value)} entry from {formatShortDate(entry.log_date)}?
                            </p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDeleteSleepLog}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDeleteSleepLog(entry.id)}
                                disabled={isDeletingSleepLog}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                {isDeletingSleepLog ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={entry.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                          <div>
                            <p className="text-sm font-semibold text-[color:var(--foreground)]">{formatSleepDuration(entry.value)}</p>
                            <p className="mt-0.5 text-xs text-[color:var(--muted)]">{formatShortDate(entry.log_date)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditSleepLog(entry)}
                              aria-label="Edit sleep entry"
                              className="rounded-full p-1.5 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-strong)]"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartDeleteSleepLog(entry.id)}
                              aria-label="Delete sleep entry"
                              className="rounded-full p-1.5 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-strong)]"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path
                                  d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Exercise</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {workoutsHistory.length} {workoutsHistory.length === 1 ? 'workout' : 'workouts'}
                  </span>
                </div>

                <form onSubmit={(event) => void handleSaveWorkout(event)} className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newWorkoutName}
                    onChange={(event) => setNewWorkoutName(event.target.value)}
                    placeholder="Workout name"
                    aria-label="Workout name"
                    className="min-w-0 max-w-[150px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <select
                    value={newWorkoutType}
                    onChange={(event) => setNewWorkoutType(event.target.value)}
                    aria-label="Workout type"
                    className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  >
                    {WORKOUT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={newWorkoutDuration}
                    onChange={(event) => setNewWorkoutDuration(event.target.value)}
                    placeholder="Min"
                    aria-label="Duration in minutes"
                    className="w-20 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <input
                    type="date"
                    value={newWorkoutDate || todayKey}
                    onChange={(event) => setNewWorkoutDate(event.target.value)}
                    aria-label="Workout date"
                    className="min-w-0 max-w-[150px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingWorkout || isLoadingWorkouts}
                    className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                  >
                    {isSavingWorkout ? 'Saving…' : 'Add'}
                  </button>
                </form>

                {workoutError ? <p className="mt-2 text-xs text-[color:var(--accent-strong)]">{workoutError}</p> : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['day', 'week', 'month'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setWorkoutLogFilter(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          workoutLogFilter === period
                            ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setWorkoutLogAnchorDate((prev) => shiftAnchorDate(workoutLogFilter, prev, -1))}
                      aria-label={`Previous ${workoutLogFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatCompactPeriodLabel(workoutLogFilter, workoutLogAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWorkoutLogAnchorDate((prev) => shiftAnchorDate(workoutLogFilter, prev, 1))}
                      aria-label={`Next ${workoutLogFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div className="mt-3 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                  {filteredWorkouts.length === 0 ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      {workoutsHistory.length === 0 ? 'No workouts logged yet.' : `No workouts this ${workoutLogFilter}.`}
                    </div>
                  ) : (
                    filteredWorkouts.map((entry) => {
                      if (editingWorkoutId === entry.id) {
                        return (
                          <form
                            key={entry.id}
                            onSubmit={(event) => void handleSaveEditWorkout(event, entry.id)}
                            className="rounded-[20px] border border-[color:var(--accent)] bg-[color:var(--surface-soft)] p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={editWorkoutName}
                                onChange={(event) => setEditWorkoutName(event.target.value)}
                                placeholder="Workout name"
                                autoFocus
                                aria-label="Workout name"
                                className="min-w-0 max-w-[150px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <select
                                value={editWorkoutType}
                                onChange={(event) => setEditWorkoutType(event.target.value)}
                                aria-label="Workout type"
                                className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              >
                                {WORKOUT_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={editWorkoutDuration}
                                onChange={(event) => setEditWorkoutDuration(event.target.value)}
                                placeholder="Min"
                                aria-label="Duration in minutes"
                                className="w-20 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <input
                                type="date"
                                value={editWorkoutDate}
                                onChange={(event) => setEditWorkoutDate(event.target.value)}
                                aria-label="Entry date"
                                className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditWorkout}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingWorkoutEdit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingWorkoutEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      if (deletingWorkoutId === entry.id) {
                        return (
                          <div key={entry.id} className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                            <p className="text-sm text-[color:var(--foreground)]">
                              Delete the &quot;{entry.name}&quot; workout from {formatShortDate(entry.workout_date)}?
                            </p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDeleteWorkout}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDeleteWorkout(entry.id)}
                                disabled={isDeletingWorkout}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                {isDeletingWorkout ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const isExpanded = expandedWorkoutId === entry.id;
                      const typeIcon = workoutTypeIcons[entry.workout_type ?? 'Other'] ?? workoutTypeIcons.Other;
                      const exercises = exercisesByWorkout[entry.id] ?? [];

                      return (
                        <div key={entry.id} className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleExpandWorkout(entry.id)}
                              className="flex flex-1 items-center gap-3 text-left"
                            >
                              <span className="shrink-0 text-[color:var(--accent)]">{typeIcon}</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{entry.name}</p>
                                <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                                  {entry.duration_minutes != null ? `${entry.duration_minutes} min · ` : ''}
                                  {formatShortDate(entry.workout_date)}
                                </p>
                              </div>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                aria-hidden="true"
                                className={`shrink-0 text-[color:var(--muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              >
                                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditWorkout(entry)}
                                aria-label="Edit workout"
                                className="rounded-full p-1.5 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path
                                    d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartDeleteWorkout(entry.id)}
                                aria-label="Delete workout"
                                className="rounded-full p-1.5 text-[color:var(--accent)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  <path
                                    d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {isExpanded ? (
                            <div className="mt-3 space-y-2 border-t border-[color:var(--border)] pt-3">
                              {loadingExercisesWorkoutId === entry.id ? (
                                <p className="text-xs text-[color:var(--muted)]">Loading exercises…</p>
                              ) : exercises.length === 0 ? (
                                <p className="text-xs text-[color:var(--muted)]">No exercises logged yet.</p>
                              ) : (
                                exercises.map((exercise) => (
                                  <div
                                    key={exercise.id}
                                    className="flex items-center justify-between rounded-[14px] bg-[color:var(--surface)] px-3 py-2"
                                  >
                                    <span className="text-xs font-semibold text-[color:var(--foreground)]">{exercise.exercise_name}</span>
                                    <span className="text-xs text-[color:var(--muted)]">
                                      {exercise.sets ?? '–'} × {exercise.reps ?? '–'} @ {exercise.weight_lbs ?? '–'} lbs
                                    </span>
                                  </div>
                                ))
                              )}

                              {exercisesError ? <p className="text-xs text-[color:var(--accent-strong)]">{exercisesError}</p> : null}

                              <form
                                onSubmit={(event) => void handleAddExercise(event, entry.id)}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={newExerciseName}
                                  onChange={(event) => setNewExerciseName(event.target.value)}
                                  placeholder="Exercise"
                                  aria-label="Exercise name"
                                  className="min-w-0 max-w-[120px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1.5 text-xs text-[color:var(--foreground)] outline-none"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  inputMode="numeric"
                                  value={newExerciseSets}
                                  onChange={(event) => setNewExerciseSets(event.target.value)}
                                  placeholder="Sets"
                                  aria-label="Sets"
                                  className="w-14 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1.5 text-xs text-[color:var(--foreground)] outline-none"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  inputMode="numeric"
                                  value={newExerciseReps}
                                  onChange={(event) => setNewExerciseReps(event.target.value)}
                                  placeholder="Reps"
                                  aria-label="Reps"
                                  className="w-14 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1.5 text-xs text-[color:var(--foreground)] outline-none"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  inputMode="numeric"
                                  value={newExerciseWeight}
                                  onChange={(event) => setNewExerciseWeight(event.target.value)}
                                  placeholder="lbs"
                                  aria-label="Weight in pounds"
                                  className="w-16 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1.5 text-xs text-[color:var(--foreground)] outline-none"
                                />
                                <button
                                  type="submit"
                                  disabled={isSavingExercise}
                                  className="shrink-0 rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                                >
                                  {isSavingExercise ? 'Adding…' : '+ Add exercise'}
                                </button>
                              </form>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </main>
        ) : (
          <main className="space-y-6">
            <section
              className="relative overflow-hidden rounded-[36px] border border-[color:var(--border)] p-6 shadow-[var(--shadow)]"
              style={{ background: 'linear-gradient(135deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
            >
              <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <ThemeOrb theme={theme} className="h-20 w-20 sm:h-28 sm:w-28 lg:h-[120px] lg:w-[120px]" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">Insights</p>
                    <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                      Analytics
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                      A closer look at your tasks, weight, and steps trends over time.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-[color:var(--surface-soft)] px-4 py-2 text-sm font-medium text-[color:var(--accent-strong)] shadow-[var(--shadow-soft)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                  <span className="tabular-nums">{formatFloridaTime(now)}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">ET</span>
                </div>
              </div>
            </section>

            <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Task Tracker</p>
                  <h3 className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                    How you&apos;re keeping up
                  </h3>
                </div>

                <div className="flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1">
                  {(['day', 'week', 'month', 'year'] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setStatsPeriod(period)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                        statsPeriod === period
                          ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                          : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setStatsAnchorDate((prev) => shiftAnchorDate(statsPeriod, prev, -1))}
                  aria-label="Previous period"
                  className="rounded-full px-2 py-1 text-sm text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                >
                  ‹
                </button>
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{formatPeriodLabel(statsPeriod, statsAnchorDate)}</p>
                <button
                  type="button"
                  onClick={() => setStatsAnchorDate((prev) => shiftAnchorDate(statsPeriod, prev, 1))}
                  aria-label="Next period"
                  className="rounded-full px-2 py-1 text-sm text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                >
                  ›
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {statCards.map((card) => (
                  <div key={card.key} className="rounded-[26px] p-5 text-center" style={{ backgroundColor: card.background }}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">{card.label}</p>
                    <p className="mt-2 text-3xl font-semibold" style={{ color: card.valueColor }}>
                      {card.value}
                    </p>
                    <p className="mt-2 text-xs font-semibold" style={{ color: card.changeColor }}>
                      {card.changeText}{' '}
                      <span className="font-normal normal-case text-[color:var(--muted)]">{formatComparisonLabel(statsPeriod, statsAnchorDate)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Weight Trend</p>
                  </div>
                  {weightHistory.length > 0 ? (
                    <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                      {weightHistory[weightHistory.length - 1].value} lbs
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-col items-center gap-2">
                  {weightHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">Log a weigh-in on the Health &amp; Fitness page to start tracking your trend.</p>
                  ) : weightHistory.length === 1 ? (
                    <>
                      <svg
                        width={WEIGHT_CHART_WIDTH}
                        height={WEIGHT_CHART_HEIGHT}
                        viewBox={`0 0 ${WEIGHT_CHART_WIDTH} ${WEIGHT_CHART_HEIGHT}`}
                        aria-hidden="true"
                      >
                        <circle cx={WEIGHT_CHART_WIDTH / 2} cy={WEIGHT_CHART_HEIGHT / 2} r="4" fill="var(--accent-strong)" />
                      </svg>
                      <p className="text-xs text-[color:var(--muted)]">Log another weigh-in to see a trend line.</p>
                    </>
                  ) : (
                    <>
                      <svg
                        width={WEIGHT_CHART_WIDTH}
                        height={WEIGHT_CHART_HEIGHT}
                        viewBox={`0 0 ${WEIGHT_CHART_WIDTH} ${WEIGHT_CHART_HEIGHT}`}
                        aria-hidden="true"
                      >
                        <polyline
                          points={weightChart.points.map((point) => `${point.x},${point.y}`).join(' ')}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {weightChart.points.map((point, index) => (
                          <circle
                            key={`${point.logDate}-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r={index === weightChart.points.length - 1 ? 3.5 : 2.5}
                            fill={index === weightChart.points.length - 1 ? 'var(--accent-strong)' : 'var(--accent)'}
                          />
                        ))}
                      </svg>
                      <div className="flex w-full justify-between text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                        <span>{formatShortDate(weightHistory[0].log_date)}</span>
                        <span>{formatShortDate(weightHistory[weightHistory.length - 1].log_date)}</span>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Steps Trend</p>
                  </div>
                  {stepsHistory.length > 0 ? (
                    <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                      {formatStepsCount(stepsHistory[stepsHistory.length - 1].value)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-col items-center gap-2">
                  {stepsHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">Log your steps on the Health &amp; Fitness page to start tracking your trend.</p>
                  ) : stepsHistory.length === 1 ? (
                    <>
                      <svg
                        width={WEIGHT_CHART_WIDTH}
                        height={WEIGHT_CHART_HEIGHT}
                        viewBox={`0 0 ${WEIGHT_CHART_WIDTH} ${WEIGHT_CHART_HEIGHT}`}
                        aria-hidden="true"
                      >
                        <line
                          x1="0"
                          y1={stepsGoalLineY}
                          x2={WEIGHT_CHART_WIDTH}
                          y2={stepsGoalLineY}
                          stroke="var(--muted)"
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />
                        <circle cx={WEIGHT_CHART_WIDTH / 2} cy={WEIGHT_CHART_HEIGHT / 2} r="4" fill="var(--accent-strong)" />
                      </svg>
                      <p className="text-xs text-[color:var(--muted)]">Log another day to see a trend line.</p>
                    </>
                  ) : (
                    <>
                      <svg
                        width={WEIGHT_CHART_WIDTH}
                        height={WEIGHT_CHART_HEIGHT}
                        viewBox={`0 0 ${WEIGHT_CHART_WIDTH} ${WEIGHT_CHART_HEIGHT}`}
                        aria-hidden="true"
                      >
                        <line
                          x1="0"
                          y1={stepsGoalLineY}
                          x2={WEIGHT_CHART_WIDTH}
                          y2={stepsGoalLineY}
                          stroke="var(--muted)"
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />
                        <polyline
                          points={stepsChart.points.map((point) => `${point.x},${point.y}`).join(' ')}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {stepsChart.points.map((point, index) => (
                          <circle
                            key={`${point.logDate}-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r={index === stepsChart.points.length - 1 ? 3.5 : 2.5}
                            fill={index === stepsChart.points.length - 1 ? 'var(--accent-strong)' : 'var(--accent)'}
                          />
                        ))}
                      </svg>
                      <div className="flex w-full justify-between text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                        <span>{formatShortDate(stepsHistory[0].log_date)}</span>
                        <span>{formatShortDate(stepsHistory[stepsHistory.length - 1].log_date)}</span>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Water Trend</p>
                  </div>
                  {waterHistory.length > 0 ? (
                    <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                      {waterHistory[waterHistory.length - 1].value} oz
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-col items-center gap-2">
                  {waterHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">Log your water on the Health &amp; Fitness page to start tracking your trend.</p>
                  ) : waterHistory.length === 1 ? (
                    <>
                      <svg
                        width={WEIGHT_CHART_WIDTH}
                        height={WEIGHT_CHART_HEIGHT}
                        viewBox={`0 0 ${WEIGHT_CHART_WIDTH} ${WEIGHT_CHART_HEIGHT}`}
                        aria-hidden="true"
                      >
                        <line
                          x1="0"
                          y1={waterChart.valueToY(waterGoal)}
                          x2={WEIGHT_CHART_WIDTH}
                          y2={waterChart.valueToY(waterGoal)}
                          stroke="var(--muted)"
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />
                        <circle cx={WEIGHT_CHART_WIDTH / 2} cy={WEIGHT_CHART_HEIGHT / 2} r="4" fill="var(--accent-strong)" />
                      </svg>
                      <p className="text-xs text-[color:var(--muted)]">Log another day to see a trend line.</p>
                    </>
                  ) : (
                    <>
                      <svg
                        width={WEIGHT_CHART_WIDTH}
                        height={WEIGHT_CHART_HEIGHT}
                        viewBox={`0 0 ${WEIGHT_CHART_WIDTH} ${WEIGHT_CHART_HEIGHT}`}
                        aria-hidden="true"
                      >
                        <line
                          x1="0"
                          y1={waterChart.valueToY(waterGoal)}
                          x2={WEIGHT_CHART_WIDTH}
                          y2={waterChart.valueToY(waterGoal)}
                          stroke="var(--muted)"
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />
                        <polyline
                          points={waterChart.points.map((point) => `${point.x},${point.y}`).join(' ')}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {waterChart.points.map((point, index) => (
                          <circle
                            key={`${point.logDate}-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r={index === waterChart.points.length - 1 ? 3.5 : 2.5}
                            fill={index === waterChart.points.length - 1 ? 'var(--accent-strong)' : 'var(--accent)'}
                          />
                        ))}
                      </svg>
                      <div className="flex w-full justify-between text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                        <span>{formatShortDate(waterHistory[0].log_date)}</span>
                        <span>{formatShortDate(waterHistory[waterHistory.length - 1].log_date)}</span>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Sleep Trend</p>
                  </div>
                  {sleepHistory.length > 0 ? (
                    <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                      {formatSleepDuration(sleepHistory[sleepHistory.length - 1].value)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-col items-center gap-2">
                  {sleepHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">Log your sleep on the Health &amp; Fitness page to start tracking your trend.</p>
                  ) : sleepHistory.length === 1 ? (
                    <>
                      <svg
                        width={WEIGHT_CHART_WIDTH}
                        height={WEIGHT_CHART_HEIGHT}
                        viewBox={`0 0 ${WEIGHT_CHART_WIDTH} ${WEIGHT_CHART_HEIGHT}`}
                        aria-hidden="true"
                      >
                        <line
                          x1="0"
                          y1={sleepChart.valueToY(SLEEP_GOAL)}
                          x2={WEIGHT_CHART_WIDTH}
                          y2={sleepChart.valueToY(SLEEP_GOAL)}
                          stroke="var(--muted)"
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />
                        <circle cx={WEIGHT_CHART_WIDTH / 2} cy={WEIGHT_CHART_HEIGHT / 2} r="4" fill="var(--accent-strong)" />
                      </svg>
                      <p className="text-xs text-[color:var(--muted)]">Log another day to see a trend line.</p>
                    </>
                  ) : (
                    <>
                      <svg
                        width={WEIGHT_CHART_WIDTH}
                        height={WEIGHT_CHART_HEIGHT}
                        viewBox={`0 0 ${WEIGHT_CHART_WIDTH} ${WEIGHT_CHART_HEIGHT}`}
                        aria-hidden="true"
                      >
                        <line
                          x1="0"
                          y1={sleepChart.valueToY(SLEEP_GOAL)}
                          x2={WEIGHT_CHART_WIDTH}
                          y2={sleepChart.valueToY(SLEEP_GOAL)}
                          stroke="var(--muted)"
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />
                        <polyline
                          points={sleepChart.points.map((point) => `${point.x},${point.y}`).join(' ')}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {sleepChart.points.map((point, index) => (
                          <circle
                            key={`${point.logDate}-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r={index === sleepChart.points.length - 1 ? 3.5 : 2.5}
                            fill={index === sleepChart.points.length - 1 ? 'var(--accent-strong)' : 'var(--accent)'}
                          />
                        ))}
                      </svg>
                      <div className="flex w-full justify-between text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                        <span>{formatShortDate(sleepHistory[0].log_date)}</span>
                        <span>{formatShortDate(sleepHistory[sleepHistory.length - 1].log_date)}</span>
                      </div>
                    </>
                  )}
                </div>
              </section>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
