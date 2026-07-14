'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactElement } from 'react';

import { supabase } from '@/lib/supabase';

type ViewMode = 'dashboard' | 'planner';

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

const ThemeOrb = ({ theme, className = 'h-8 w-8' }: { theme: ThemeKey; className?: string }) => {
  const gradId = useId();

  return (
    <svg viewBox="0 0 140 130" aria-hidden="true" className={`shrink-0 ${className}`}>
      {orbRenderers[theme](`orb-${gradId}`)}
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
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
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
  const [plannerNotes, setPlannerNotes] = useState('');
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null>(null);
  const currentUserId = session?.user?.id ?? null;

  useEffect(() => {
    const initialTheme = getStoredTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
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
    if (typeof window === 'undefined') {
      return;
    }

    const savedNotes = window.localStorage.getItem('mochiboard-planner-notes');
    if (savedNotes) {
      setPlannerNotes(savedNotes);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mochiboard-planner-notes', plannerNotes);
    }
  }, [plannerNotes]);

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

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        day: selectedDay,
        time_label: newTaskTime.trim() || null,
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
      setNewTaskDescription('');
    }

    setIsSavingTask(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    router.push('/login');
  };

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/planner', label: 'Planner' },
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
              const isActive = (activeView === 'dashboard' && item.href === '/') || (activeView === 'planner' && item.href === '/planner');
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
                      return (
                        <button
                          key={cell.key}
                          type="button"
                          onClick={() => setSelectedDay(cell.key)}
                          className={`aspect-square rounded-full text-xs transition ${
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
                  <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Notes</h3>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    Sticky note
                  </span>
                </div>
                <div className="relative z-10 mt-5 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 shadow-[var(--shadow-soft)]" style={{ transform: 'rotate(-1deg)' }}>
                  <textarea
                    value={plannerNotes}
                    onChange={(event) => setPlannerNotes(event.target.value)}
                    placeholder="Write a little reminder, quote, or idea..."
                    className="min-h-[220px] w-full resize-none rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm leading-6 text-[color:var(--foreground)] outline-none"
                  />
                </div>
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
