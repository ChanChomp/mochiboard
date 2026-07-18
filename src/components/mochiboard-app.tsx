'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import Chart from 'chart.js/auto';

import { supabase } from '@/lib/supabase';
import { DraggableWidget, EditLayoutControls, useWidgetLayout, WidgetGrid } from '@/components/widget-layout';
import {
  BarChartIcon,
  ChartTypeToggle,
  generateCategoryPalette,
  HorizontalBarChartIcon,
  PieChartIcon,
  TREND_CHART_TYPE_OPTIONS,
  TrendChartCanvas,
  useChartType,
  usePeriod,
  type ChartTypeOption,
  type TrendChartType,
  type TrendHistoryPoint,
} from '@/components/trend-chart';

type ViewMode = 'dashboard' | 'planner' | 'health' | 'finances' | 'projects' | 'books' | 'analytics';

const WIDGET_DEFAULT_ORDER: Record<ViewMode, string[]> = {
  dashboard: ['planner', 'wellness', 'finances'],
  planner: ['calendar', 'todo', 'thisMonth', 'appointments'],
  health: ['bmi', 'weightLog', 'stepsLog', 'waterIntake', 'sleep', 'exercise'],
  finances: ['balance', 'creditCards', 'subscriptions', 'loans', 'savings'],
  projects: ['projects'],
  books: ['books', 'favoriteBooks'],
  analytics: ['spendingByCategory', 'incomeTracker', 'weightTrend', 'stepsTrend', 'waterTrend', 'sleepTrend'],
};

const PROJECT_STATUSES = ['Not Started', 'In Progress', 'Done'] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const projectStatusStyles: Record<ProjectStatus, { background: string; color: string }> = {
  'Not Started': { background: 'var(--surface-strong)', color: 'var(--muted)' },
  'In Progress': { background: 'rgba(217, 119, 6, 0.12)', color: '#d97706' },
  Done: { background: 'rgba(34, 197, 94, 0.14)', color: '#15803d' },
};

type SpendingChartType = 'bar-horizontal' | 'bar-vertical' | 'pie';

const SPENDING_CHART_TYPE_OPTIONS: ChartTypeOption<SpendingChartType>[] = [
  { value: 'bar-horizontal', label: 'Horizontal bar chart', icon: HorizontalBarChartIcon },
  { value: 'bar-vertical', label: 'Vertical bar chart', icon: BarChartIcon },
  { value: 'pie', label: 'Pie chart', icon: PieChartIcon },
];

type IncomeChartType = TrendChartType | 'pie';

const INCOME_CHART_TYPE_OPTIONS: ChartTypeOption<IncomeChartType>[] = [
  ...TREND_CHART_TYPE_OPTIONS,
  { value: 'pie', label: 'Pie chart', icon: PieChartIcon },
];

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

type TransactionRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  transaction_date: string;
  description: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  vendor: string | null;
  sender_name: string | null;
  price_per_gallon: number | null;
  gallons: number | null;
};

type TransactionItemRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  transaction_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  item_total: number;
};

type CreditCardRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  card_name: string;
  credit_limit: number;
  card_color: string;
  due_day: number | null;
};

type CardChargeRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  card_id: string;
  charge_date: string;
  description: string;
  amount: number;
};

type LoanRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  loan_name: string;
  original_amount: number;
  remaining_balance: number;
  monthly_payment: number;
  due_day: number | null;
};

type SavingsGoalRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  goal_name: string;
  target_amount: number;
  current_amount: number;
};

type BookStatus = 'Want to Read' | 'Currently Reading' | 'Finished';

const BOOK_STATUSES: BookStatus[] = ['Want to Read', 'Currently Reading', 'Finished'];

type BookRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  title: string;
  author: string | null;
  genre: string | null;
  description: string | null;
  cover_image_url: string | null;
  status: BookStatus;
  current_page: number | null;
  total_pages: number | null;
  rating: number | null;
  finished_date: string | null;
};

// Deterministic per-book gradient (falls back for the cover swatch when no cover image
// has been uploaded), derived from the book id so it stays stable regardless of list order.
const getBookGradient = (id: string): CardColorOption => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % cardColorOptions.length;
  }
  return cardColorOptions[Math.abs(hash) % cardColorOptions.length];
};

const uploadBookCover = async (userId: string, file: File): Promise<{ url: string | null; error: string | null }> => {
  const fileExt = file.name.split('.').pop() ?? 'jpg';
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from('book-covers').upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from('book-covers').getPublicUrl(filePath);
  return { url: data.publicUrl, error: null };
};

type SubscriptionBillingCycle = 'Monthly' | 'Yearly' | 'Weekly';

const SUBSCRIPTION_BILLING_CYCLES: SubscriptionBillingCycle[] = ['Monthly', 'Yearly', 'Weekly'];

type SubscriptionRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  subscription_name: string;
  amount: number;
  billing_cycle: SubscriptionBillingCycle;
  card_color: string;
  renewal_day: number | null;
  renewal_weekday: number | null;
  renewal_month: number | null;
};

const SUBSCRIPTION_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toMonthlySubscriptionAmount = (amount: number, cycle: SubscriptionBillingCycle): number => {
  if (cycle === 'Yearly') return amount / 12;
  if (cycle === 'Weekly') return (amount * 52) / 12;
  return amount;
};

const subscriptionCycleAbbreviation = (cycle: SubscriptionBillingCycle): string => {
  if (cycle === 'Yearly') return 'yr';
  if (cycle === 'Weekly') return 'wk';
  return 'mo';
};

// Calculates the next upcoming occurrence of a subscription's renewal from its
// simplified recurrence fields (day-of-month, day-of-week, or month+day), rather
// than a stored full date — so it never goes stale as time passes.
const getNextSubscriptionRenewal = (subscription: SubscriptionRow, today: Date): Date | null => {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (subscription.billing_cycle === 'Monthly') {
    if (subscription.renewal_day == null) return null;
    const dayThisMonth = Math.min(subscription.renewal_day, getDaysInMonth(todayStart));
    let candidate = new Date(todayStart.getFullYear(), todayStart.getMonth(), dayThisMonth);
    if (candidate < todayStart) {
      const nextMonthAnchor = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 1);
      const dayNextMonth = Math.min(subscription.renewal_day, getDaysInMonth(nextMonthAnchor));
      candidate = new Date(nextMonthAnchor.getFullYear(), nextMonthAnchor.getMonth(), dayNextMonth);
    }
    return candidate;
  }

  if (subscription.billing_cycle === 'Weekly') {
    if (subscription.renewal_weekday == null) return null;
    const todayWeekdayMon0 = (todayStart.getDay() + 6) % 7;
    const diff = (subscription.renewal_weekday - todayWeekdayMon0 + 7) % 7;
    return new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + diff);
  }

  if (subscription.billing_cycle === 'Yearly') {
    if (subscription.renewal_month == null || subscription.renewal_day == null) return null;
    const monthIndex = subscription.renewal_month - 1;
    const daysInTargetMonth = getDaysInMonth(new Date(todayStart.getFullYear(), monthIndex, 1));
    const day = Math.min(subscription.renewal_day, daysInTargetMonth);
    let candidate = new Date(todayStart.getFullYear(), monthIndex, day);
    if (candidate < todayStart) {
      const nextYearDays = getDaysInMonth(new Date(todayStart.getFullYear() + 1, monthIndex, 1));
      candidate = new Date(todayStart.getFullYear() + 1, monthIndex, Math.min(subscription.renewal_day, nextYearDays));
    }
    return candidate;
  }

  return null;
};

type AppointmentRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  title: string;
  appointment_date: string;
  time_label: string;
  location: string | null;
  category: string;
};

type ProjectRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  project_name: string;
  icon: string | null;
  status: string;
  start_date: string | null;
  finish_date: string | null;
};

type ProjectSubtaskRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  project_id: string;
  title: string;
  is_complete: boolean;
};

type BodyMeasurementRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  measurement_type: string;
  side: string | null;
  value: number;
  log_date: string;
};

type BodyMeasurementType = 'neck' | 'chest' | 'waist' | 'hips' | 'thighs' | 'arms' | 'calf';
type BodyMeasurementSide = 'left' | 'right';

type BodyMeasurementRowConfig = {
  type: BodyMeasurementType;
  label: string;
  sides: (BodyMeasurementSide | null)[];
};

const BODY_MEASUREMENT_ROWS: BodyMeasurementRowConfig[] = [
  { type: 'neck', label: 'Neck', sides: [null] },
  { type: 'chest', label: 'Chest', sides: [null] },
  { type: 'waist', label: 'Waist', sides: [null] },
  { type: 'hips', label: 'Hips', sides: [null] },
  { type: 'thighs', label: 'Thighs', sides: ['left', 'right'] },
  { type: 'arms', label: 'Biceps', sides: ['left', 'right'] },
  { type: 'calf', label: 'Calf', sides: ['left', 'right'] },
];

const getBodyMeasurementSlotKey = (type: BodyMeasurementType, side: BodyMeasurementSide | null): string =>
  side ? `${type}-${side}` : type;

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

const TRANSACTION_CATEGORIES = [
  'Housing',
  'Groceries',
  'Dining Out',
  'Transportation',
  'Beauty & Self Care',
  'Clothing',
  'Health & Wellness',
  'Entertainment',
  'Travel',
  'Shopping/Misc',
  'Financial',
  'Gifts & Donations',
  'Subscriptions',
  'Income',
] as const;

const transactionSubcategoryOptions: Record<string, string[]> = {
  Housing: ['Rent', 'Utilities', 'HOA/Parking/Storage', 'Other'],
  Groceries: ['Produce/Meat/Dairy', 'Pantry/Snacks', 'Household Supplies', 'Other'],
  'Dining Out': ['Restaurants', 'Fast Food/Delivery', 'Coffee/Cafés', 'Other'],
  Transportation: ['Gas', 'Car Payment/Insurance', 'Maintenance', 'Rideshare/Transit', 'Other'],
  'Beauty & Self Care': ['Skincare/Makeup', 'Hair/Nails', 'Beauty Services', 'Other'],
  Clothing: ['Clothes', 'Shoes', 'Accessories', 'Other'],
  'Health & Wellness': ['Medical/Insurance', 'Fitness', 'Wellness/Therapy', 'Other'],
  Entertainment: ['Streaming/Subscriptions', 'Movies/Events', 'Hobbies', 'Other'],
  Travel: ['Other'],
  'Shopping/Misc': ['Other'],
  Financial: ['Loan/CC Payments', 'Savings Transfers', 'Other'],
  'Gifts & Donations': ['Other'],
  Subscriptions: ['Streaming', 'Software/Apps', 'Memberships', 'Other'],
  Income: ['Paycheck', 'Bonus', 'Refund', 'Gift', 'Interest/Dividends', 'Mobile payments', 'Other'],
};

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

const getStoredTransactionType = (): 'income' | 'expense' => {
  if (typeof window === 'undefined') {
    return 'expense';
  }

  const storedValue = window.localStorage.getItem('mochiboard-transaction-type');
  return storedValue === 'income' ? 'income' : 'expense';
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
type TrendPeriod = StatsPeriod | 'all';

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

const parseDayKeyToDate = (dayKey: string): Date | null => {
  const matched = dayKey.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  return new Date(year, month - 1, day);
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


const formatShortDate = (dayKey: string): string => {
  const date = parseDayKeyToDate(dayKey);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : dayKey;
};

const historySpansMultipleYears = (history: TrendHistoryPoint[]): boolean => {
  const years = new Set(history.map((point) => point.logDate.slice(0, 4)));
  return years.size > 1;
};

const formatTrendDateLabel = (dayKey: string, includeYear: boolean): string => {
  const date = parseDayKeyToDate(dayKey);
  if (!date) return dayKey;
  return includeYear
    ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatMonthYearLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  return `${monthNamesFull[(month ?? 1) - 1]} ${year}`;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (amount: number): string => currencyFormatter.format(amount);

const formatOrdinalDay = (day: number): string => {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${day}th`;
  }

  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
};

const getDaysInMonth = (date: Date): number => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const isDueDaySoon = (dueDay: number, currentDay: number, daysInMonth: number): boolean => {
  let diff = dueDay - currentDay;
  if (diff < 0) {
    diff += daysInMonth;
  }
  return diff <= 7;
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

type CardColorOption = {
  id: string;
  label: string;
  swatch: string;
  from: string;
  to: string;
};

const cardColorOptions: CardColorOption[] = [
  { id: 'peach', label: 'Peach', swatch: '#d97a4d', from: '#d97a4d', to: '#b95d31' },
  { id: 'strawberry', label: 'Strawberry', swatch: '#dd6f8f', from: '#e58aa4', to: '#c95f7a' },
  { id: 'matcha', label: 'Matcha', swatch: '#86b06f', from: '#8bbd78', to: '#5d8d57' },
  { id: 'ube', label: 'Ube', swatch: '#a57ad8', from: '#a77edc', to: '#7d56b6' },
  { id: 'black-sesame', label: 'Black Sesame', swatch: '#4a4a4a', from: '#6b6b6b', to: '#3a3a3a' },
  { id: 'sky', label: 'Sky', swatch: '#8ec5e8', from: '#8ec5e8', to: '#5089b0' },
  { id: 'mint', label: 'Mint', swatch: '#7ecbb0', from: '#7ecbb0', to: '#439378' },
  { id: 'lemon', label: 'Lemon', swatch: '#eccb5a', from: '#eccb5a', to: '#c9a52e' },
  { id: 'lavender', label: 'Lavender', swatch: '#b3b8f0', from: '#b3b8f0', to: '#7a80c9' },
  { id: 'coral', label: 'Coral', swatch: '#f2a488', from: '#f2a488', to: '#d67856' },
  { id: 'rose', label: 'Rose', swatch: '#e3a9b8', from: '#e3a9b8', to: '#c17a8d' },
  { id: 'seafoam', label: 'Seafoam', swatch: '#9ad6c4', from: '#9ad6c4', to: '#5fa892' },
  { id: 'sand', label: 'Sand', swatch: '#d9c2a3', from: '#d9c2a3', to: '#ad8f66' },
];


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

const APPOINTMENT_CATEGORIES = ['Medical', 'Work', 'Social', 'Other'] as const;
const appointmentCategoryColors: Record<string, string> = {
  Medical: '#e8828f',
  Work: '#8ec5e8',
  Social: '#b3b8f0',
  Other: '#d9c2a3',
};

const parseTimeLabelToMinutes = (timeLabel: string): number => {
  const match = timeLabel.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return 0;
  }
  let hour = Number(match[1]) % 12;
  const minute = Number(match[2]);
  if (match[3].toUpperCase() === 'PM') {
    hour += 12;
  }
  return hour * 60 + minute;
};

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
  const widgetLayout = useWidgetLayout(activeView, WIDGET_DEFAULT_ORDER[activeView]);
  const [weightChartType, setWeightChartType] = useChartType<TrendChartType>('weightTrend', 'line');
  const [stepsChartType, setStepsChartType] = useChartType<TrendChartType>('stepsTrend', 'bar');
  const [sleepChartType, setSleepChartType] = useChartType<TrendChartType>('sleepTrend', 'bar');
  const [waterChartType, setWaterChartType] = useChartType<TrendChartType>('waterTrend', 'line');
  const [spendingChartType, setSpendingChartType] = useChartType<SpendingChartType>('spendingByCategory', 'bar-horizontal');
  const [incomeChartType, setIncomeChartType] = useChartType<IncomeChartType>('incomeTracker', 'bar');
  const [incomeTrendPeriod, setIncomeTrendPeriod] = usePeriod<TrendPeriod>('incomeTracker', 'week');
  const [incomeTrendAnchorDate, setIncomeTrendAnchorDate] = useState(() => new Date());
  const [weightTrendPeriod, setWeightTrendPeriod] = usePeriod<TrendPeriod>('weightTrend', 'week');
  const [weightTrendAnchorDate, setWeightTrendAnchorDate] = useState(() => new Date());
  const [stepsTrendPeriod, setStepsTrendPeriod] = usePeriod<TrendPeriod>('stepsTrend', 'week');
  const [stepsTrendAnchorDate, setStepsTrendAnchorDate] = useState(() => new Date());
  const [sleepTrendPeriod, setSleepTrendPeriod] = usePeriod<TrendPeriod>('sleepTrend', 'week');
  const [sleepTrendAnchorDate, setSleepTrendAnchorDate] = useState(() => new Date());
  const [waterTrendPeriod, setWaterTrendPeriod] = usePeriod<TrendPeriod>('waterTrend', 'week');
  const [waterTrendAnchorDate, setWaterTrendAnchorDate] = useState(() => new Date());
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [selectedDay, setSelectedDay] = useState(() => {
    const initialWeekDays = getCurrentWeekDays();
    return initialWeekDays.find((day) => day.isToday)?.key ?? initialWeekDays[0].key;
  });
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
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
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [newAppointmentDate, setNewAppointmentDate] = useState('');
  const [newAppointmentTimeSlot, setNewAppointmentTimeSlot] = useState('');
  const [newAppointmentTimeMeridiem, setNewAppointmentTimeMeridiem] = useState<'AM' | 'PM'>('AM');
  const [newAppointmentTitle, setNewAppointmentTitle] = useState('');
  const [newAppointmentLocation, setNewAppointmentLocation] = useState('');
  const [newAppointmentCategory, setNewAppointmentCategory] = useState<string>('Other');
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [editAppointmentDate, setEditAppointmentDate] = useState('');
  const [editAppointmentTimeSlot, setEditAppointmentTimeSlot] = useState('');
  const [editAppointmentTimeMeridiem, setEditAppointmentTimeMeridiem] = useState<'AM' | 'PM'>('AM');
  const [editAppointmentTitle, setEditAppointmentTitle] = useState('');
  const [editAppointmentLocation, setEditAppointmentLocation] = useState('');
  const [editAppointmentCategory, setEditAppointmentCategory] = useState<string>('Other');
  const [isSavingAppointmentEdit, setIsSavingAppointmentEdit] = useState(false);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<string | null>(null);
  const [isDeletingAppointment, setIsDeletingAppointment] = useState(false);
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null>(null);
  const currentUserId = session?.user?.id ?? null;
  const waterClipId = useId();
  const [latestHeightInches, setLatestHeightInches] = useState<number | null>(null);
  const [heightFeetInput, setHeightFeetInput] = useState('');
  const [heightInchesInput, setHeightInchesInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [isLoadingBodyMetrics, setIsLoadingBodyMetrics] = useState(true);
  const [isSavingBodyMetrics, setIsSavingBodyMetrics] = useState(false);
  const [bodyMetricsError, setBodyMetricsError] = useState<string | null>(null);
  const [showBodyMetricsForm, setShowBodyMetricsForm] = useState(false);
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurementRow[]>([]);
  const [isLoadingBodyMeasurements, setIsLoadingBodyMeasurements] = useState(true);
  const [bodyMeasurementError, setBodyMeasurementError] = useState<string | null>(null);
  const [addingMeasurementSlot, setAddingMeasurementSlot] = useState<string | null>(null);
  const [newMeasurementValue, setNewMeasurementValue] = useState('');
  const [measurementEntryDate, setMeasurementEntryDate] = useState('');
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);
  const [historyMeasurementSlot, setHistoryMeasurementSlot] = useState<string | null>(null);
  const [measurementHistoryFilter, setMeasurementHistoryFilter] = useState<'day' | 'week' | 'month'>('week');
  const [measurementHistoryAnchorDate, setMeasurementHistoryAnchorDate] = useState(() => new Date());
  const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(null);
  const [editMeasurementValue, setEditMeasurementValue] = useState('');
  const [isSavingMeasurementEdit, setIsSavingMeasurementEdit] = useState(false);
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<string | null>(null);
  const [isDeletingMeasurement, setIsDeletingMeasurement] = useState(false);
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
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [newTransactionDate, setNewTransactionDate] = useState('');
  const [newTransactionDescription, setNewTransactionDescription] = useState('');
  const [newTransactionAmount, setNewTransactionAmount] = useState('');
  const [newTransactionType, setNewTransactionType] = useState<'income' | 'expense'>('expense');
  const [newTransactionCategory, setNewTransactionCategory] = useState('');
  const [newTransactionSubcategory, setNewTransactionSubcategory] = useState('');
  const [newTransactionCustomSubcategory, setNewTransactionCustomSubcategory] = useState('');
  const [newTransactionVendor, setNewTransactionVendor] = useState('');
  const [newTransactionSenderName, setNewTransactionSenderName] = useState('');
  const [newTransactionPricePerGallon, setNewTransactionPricePerGallon] = useState('');
  const [newTransactionGallons, setNewTransactionGallons] = useState('');
  const [transactionItems, setTransactionItems] = useState<TransactionItemRow[]>([]);
  const [isLoadingTransactionItems, setIsLoadingTransactionItems] = useState(true);
  const [itemError, setItemError] = useState<string | null>(null);
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [isSavingItemEdit, setIsSavingItemEdit] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [gasPricePerGallonInput, setGasPricePerGallonInput] = useState('');
  const [gasGallonsInput, setGasGallonsInput] = useState('');
  const [isSavingGasDetails, setIsSavingGasDetails] = useState(false);
  const [gasDetailsError, setGasDetailsError] = useState<string | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<'day' | 'week' | 'month'>('month');
  const [transactionFilterAnchorDate, setTransactionFilterAnchorDate] = useState(() => new Date());
  const [spendingPeriod, setSpendingPeriod] = useState<StatsPeriod | 'custom' | 'all'>('month');
  const [spendingAnchorDate, setSpendingAnchorDate] = useState(() => new Date());
  const [spendingCustomStart, setSpendingCustomStart] = useState('');
  const [spendingCustomEnd, setSpendingCustomEnd] = useState('');
  const spendingChartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const incomeSourceChartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editTransactionDate, setEditTransactionDate] = useState('');
  const [editTransactionDescription, setEditTransactionDescription] = useState('');
  const [editTransactionAmount, setEditTransactionAmount] = useState('');
  const [isSavingTransactionEdit, setIsSavingTransactionEdit] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false);
  const [creditCards, setCreditCards] = useState<CreditCardRow[]>([]);
  const [isLoadingCreditCards, setIsLoadingCreditCards] = useState(true);
  const [creditCardError, setCreditCardError] = useState<string | null>(null);
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardColor, setNewCardColor] = useState<string>('peach');
  const [newCardDueDay, setNewCardDueDay] = useState('');
  const [isSavingCreditCard, setIsSavingCreditCard] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardLimit, setEditCardLimit] = useState('');
  const [editCardColor, setEditCardColor] = useState<string>('peach');
  const [editCardDueDay, setEditCardDueDay] = useState('');
  const [isSavingCardEdit, setIsSavingCardEdit] = useState(false);
  const [cardCharges, setCardCharges] = useState<CardChargeRow[]>([]);
  const [isLoadingCardCharges, setIsLoadingCardCharges] = useState(true);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [newChargeDate, setNewChargeDate] = useState('');
  const [newChargeDescription, setNewChargeDescription] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [isSavingCharge, setIsSavingCharge] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [editChargeDate, setEditChargeDate] = useState('');
  const [editChargeDescription, setEditChargeDescription] = useState('');
  const [editChargeAmount, setEditChargeAmount] = useState('');
  const [isSavingChargeEdit, setIsSavingChargeEdit] = useState(false);
  const [deletingChargeId, setDeletingChargeId] = useState<string | null>(null);
  const [isDeletingCharge, setIsDeletingCharge] = useState(false);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [showAddLoanForm, setShowAddLoanForm] = useState(false);
  const [newLoanName, setNewLoanName] = useState('');
  const [newLoanOriginalAmount, setNewLoanOriginalAmount] = useState('');
  const [newLoanRemainingBalance, setNewLoanRemainingBalance] = useState('');
  const [newLoanMonthlyPayment, setNewLoanMonthlyPayment] = useState('');
  const [newLoanDueDay, setNewLoanDueDay] = useState('');
  const [isSavingLoan, setIsSavingLoan] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [editLoanName, setEditLoanName] = useState('');
  const [editLoanOriginalAmount, setEditLoanOriginalAmount] = useState('');
  const [editLoanRemainingBalance, setEditLoanRemainingBalance] = useState('');
  const [editLoanMonthlyPayment, setEditLoanMonthlyPayment] = useState('');
  const [editLoanDueDay, setEditLoanDueDay] = useState('');
  const [isSavingLoanEdit, setIsSavingLoanEdit] = useState(false);
  const [deletingLoanId, setDeletingLoanId] = useState<string | null>(null);
  const [isDeletingLoan, setIsDeletingLoan] = useState(false);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalRow[]>([]);
  const [isLoadingSavingsGoals, setIsLoadingSavingsGoals] = useState(true);
  const [savingsGoalError, setSavingsGoalError] = useState<string | null>(null);
  const [showAddGoalForm, setShowAddGoalForm] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTargetAmount, setNewGoalTargetAmount] = useState('');
  const [newGoalCurrentAmount, setNewGoalCurrentAmount] = useState('');
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editGoalTargetAmount, setEditGoalTargetAmount] = useState('');
  const [editGoalCurrentAmount, setEditGoalCurrentAmount] = useState('');
  const [isSavingGoalEdit, setIsSavingGoalEdit] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [isDeletingGoal, setIsDeletingGoal] = useState(false);
  const [depositingGoalId, setDepositingGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [isSavingDeposit, setIsSavingDeposit] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [showAddSubscriptionForm, setShowAddSubscriptionForm] = useState(false);
  const [newSubscriptionName, setNewSubscriptionName] = useState('');
  const [newSubscriptionAmount, setNewSubscriptionAmount] = useState('');
  const [newSubscriptionCycle, setNewSubscriptionCycle] = useState<SubscriptionBillingCycle>('Monthly');
  const [newSubscriptionRenewalDay, setNewSubscriptionRenewalDay] = useState('1');
  const [newSubscriptionRenewalWeekday, setNewSubscriptionRenewalWeekday] = useState('0');
  const [newSubscriptionRenewalMonth, setNewSubscriptionRenewalMonth] = useState('1');
  const [newSubscriptionColor, setNewSubscriptionColor] = useState<string>('peach');
  const [isSavingSubscription, setIsSavingSubscription] = useState(false);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null);
  const [editSubscriptionName, setEditSubscriptionName] = useState('');
  const [editSubscriptionAmount, setEditSubscriptionAmount] = useState('');
  const [editSubscriptionCycle, setEditSubscriptionCycle] = useState<SubscriptionBillingCycle>('Monthly');
  const [editSubscriptionRenewalDay, setEditSubscriptionRenewalDay] = useState('1');
  const [editSubscriptionRenewalWeekday, setEditSubscriptionRenewalWeekday] = useState('0');
  const [editSubscriptionRenewalMonth, setEditSubscriptionRenewalMonth] = useState('1');
  const [editSubscriptionColor, setEditSubscriptionColor] = useState<string>('peach');
  const [isSavingSubscriptionEdit, setIsSavingSubscriptionEdit] = useState(false);
  const [deletingSubscriptionId, setDeletingSubscriptionId] = useState<string | null>(null);
  const [isDeletingSubscription, setIsDeletingSubscription] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectSubtasks, setProjectSubtasks] = useState<Record<string, ProjectSubtaskRow[]>>({});
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectIcon, setNewProjectIcon] = useState('');
  const [newProjectStartDate, setNewProjectStartDate] = useState('');
  const [newProjectFinishDate, setNewProjectFinishDate] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectIcon, setEditProjectIcon] = useState('');
  const [editProjectStartDate, setEditProjectStartDate] = useState('');
  const [editProjectFinishDate, setEditProjectFinishDate] = useState('');
  const [isSavingProjectEdit, setIsSavingProjectEdit] = useState(false);
  const [completedProjectsFilter, setCompletedProjectsFilter] = useState('all');
  const [promptFinishDateProjectId, setPromptFinishDateProjectId] = useState<string | null>(null);
  const [promptFinishDateValue, setPromptFinishDateValue] = useState('');
  const [promptFinishDateError, setPromptFinishDateError] = useState<string | null>(null);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [bookError, setBookError] = useState<string | null>(null);
  const [showAddBookForm, setShowAddBookForm] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookGenre, setNewBookGenre] = useState('');
  const [newBookDescription, setNewBookDescription] = useState('');
  const [newBookCoverFile, setNewBookCoverFile] = useState<File | null>(null);
  const [newBookStatus, setNewBookStatus] = useState<BookStatus>('Want to Read');
  const [newBookTotalPages, setNewBookTotalPages] = useState('');
  const [newBookRating, setNewBookRating] = useState(0);
  const [newBookFinishedDate, setNewBookFinishedDate] = useState('');
  const [isSavingBook, setIsSavingBook] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editBookTitle, setEditBookTitle] = useState('');
  const [editBookAuthor, setEditBookAuthor] = useState('');
  const [editBookGenre, setEditBookGenre] = useState('');
  const [editBookDescription, setEditBookDescription] = useState('');
  const [editBookCoverFile, setEditBookCoverFile] = useState<File | null>(null);
  const [editBookStatus, setEditBookStatus] = useState<BookStatus>('Want to Read');
  const [editBookCurrentPage, setEditBookCurrentPage] = useState('');
  const [editBookTotalPages, setEditBookTotalPages] = useState('');
  const [editBookRating, setEditBookRating] = useState(0);
  const [editBookFinishedDate, setEditBookFinishedDate] = useState('');
  const [isSavingBookEdit, setIsSavingBookEdit] = useState(false);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [isDeletingBook, setIsDeletingBook] = useState(false);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [isMarkingProjectComplete, setIsMarkingProjectComplete] = useState(false);
  const [newSubtaskTitleByProject, setNewSubtaskTitleByProject] = useState<Record<string, string>>({});
  const [isSavingSubtaskByProject, setIsSavingSubtaskByProject] = useState<Record<string, boolean>>({});
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editSubtaskTitle, setEditSubtaskTitle] = useState('');
  const [isSavingSubtaskEdit, setIsSavingSubtaskEdit] = useState(false);
  const [deletingSubtaskId, setDeletingSubtaskId] = useState<string | null>(null);
  const [isDeletingSubtask, setIsDeletingSubtask] = useState(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initialTheme = getStoredTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const storedWaterGoal = getStoredWaterGoal();
    setWaterGoal(storedWaterGoal);
    setWaterGoalInput(String(storedWaterGoal));

    setNewTransactionType(getStoredTransactionType());
  }, []);

  const handleThemeSelect = (nextTheme: ThemeKey) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem('mochiboard-theme', nextTheme);
  };

  const handleSelectTransactionType = (nextType: 'income' | 'expense') => {
    setNewTransactionType(nextType);
    window.localStorage.setItem('mochiboard-transaction-type', nextType);
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
      setAppointments([]);
      setIsLoadingAppointments(false);
      return;
    }

    const loadAppointments = async () => {
      setIsLoadingAppointments(true);
      setAppointmentError(null);

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', currentUserId)
        .order('appointment_date', { ascending: true });

      if (error) {
        console.error('Unable to load appointments:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        setAppointmentError(`Unable to load your appointments (${error.message}).`);
        setAppointments([]);
      } else {
        setAppointments(data ?? []);
      }

      setIsLoadingAppointments(false);
    };

    void loadAppointments();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setTransactions([]);
      setIsLoadingTransactions(false);
      return;
    }

    const loadTransactions = async () => {
      setIsLoadingTransactions(true);
      setTransactionError(null);

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUserId)
        .order('transaction_date', { ascending: false });

      if (error) {
        console.error('Unable to load transactions:', error);
        setTransactionError(`Unable to load your transactions (${error.message}).`);
        setTransactions([]);
      } else {
        setTransactions(data ?? []);
      }

      setIsLoadingTransactions(false);
    };

    void loadTransactions();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setTransactionItems([]);
      setIsLoadingTransactionItems(false);
      return;
    }

    const loadTransactionItems = async () => {
      setIsLoadingTransactionItems(true);
      setItemError(null);

      const { data, error } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Unable to load transaction_items:', error);
        setItemError(`Unable to load item details (${error.message}).`);
        setTransactionItems([]);
      } else {
        setTransactionItems(data ?? []);
      }

      setIsLoadingTransactionItems(false);
    };

    void loadTransactionItems();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setCreditCards([]);
      setIsLoadingCreditCards(false);
      return;
    }

    const loadCreditCards = async () => {
      setIsLoadingCreditCards(true);
      setCreditCardError(null);

      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Unable to load credit_cards:', error);
        setCreditCardError(`Unable to load your credit cards (${error.message}).`);
        setCreditCards([]);
      } else {
        setCreditCards(data ?? []);
      }

      setIsLoadingCreditCards(false);
    };

    void loadCreditCards();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setCardCharges([]);
      setIsLoadingCardCharges(false);
      return;
    }

    const loadCardCharges = async () => {
      setIsLoadingCardCharges(true);
      setChargeError(null);

      const { data, error } = await supabase
        .from('card_charges')
        .select('*')
        .eq('user_id', currentUserId)
        .order('charge_date', { ascending: false });

      if (error) {
        console.error('Unable to load card_charges:', error);
        setChargeError(`Unable to load your card charges (${error.message}).`);
        setCardCharges([]);
      } else {
        setCardCharges(data ?? []);
      }

      setIsLoadingCardCharges(false);
    };

    void loadCardCharges();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setLoans([]);
      setIsLoadingLoans(false);
      return;
    }

    const loadLoans = async () => {
      setIsLoadingLoans(true);
      setLoanError(null);

      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Unable to load loans:', error);
        setLoanError(`Unable to load your loans (${error.message}).`);
        setLoans([]);
      } else {
        setLoans(data ?? []);
      }

      setIsLoadingLoans(false);
    };

    void loadLoans();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setSavingsGoals([]);
      setIsLoadingSavingsGoals(false);
      return;
    }

    const loadSavingsGoals = async () => {
      setIsLoadingSavingsGoals(true);
      setSavingsGoalError(null);

      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Unable to load savings_goals:', error);
        setSavingsGoalError(`Unable to load your savings goals (${error.message}).`);
        setSavingsGoals([]);
      } else {
        setSavingsGoals(data ?? []);
      }

      setIsLoadingSavingsGoals(false);
    };

    void loadSavingsGoals();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setSubscriptions([]);
      setIsLoadingSubscriptions(false);
      return;
    }

    const loadSubscriptions = async () => {
      setIsLoadingSubscriptions(true);
      setSubscriptionError(null);

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Unable to load subscriptions:', error);
        setSubscriptionError(`Unable to load your subscriptions (${error.message}).`);
        setSubscriptions([]);
      } else {
        setSubscriptions(data ?? []);
      }

      setIsLoadingSubscriptions(false);
    };

    void loadSubscriptions();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setProjects([]);
      setProjectSubtasks({});
      setIsLoadingProjects(false);
      return;
    }

    const loadProjects = async () => {
      setIsLoadingProjects(true);
      setProjectError(null);

      const [{ data: projectData, error: projectsError }, { data: subtaskData, error: subtasksError }] = await Promise.all([
        supabase.from('projects').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true }),
        supabase.from('project_subtasks').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true }),
      ]);

      if (projectsError || subtasksError) {
        const failure = projectsError ?? subtasksError;
        console.error('Unable to load projects:', failure);
        setProjectError(`Unable to load your projects (${failure?.message}).`);
        setProjects([]);
        setProjectSubtasks({});
      } else {
        setProjects(projectData ?? []);
        const grouped: Record<string, ProjectSubtaskRow[]> = {};
        (subtaskData ?? []).forEach((row) => {
          const list = grouped[row.project_id] ?? [];
          list.push(row);
          grouped[row.project_id] = list;
        });
        setProjectSubtasks(grouped);
      }

      setIsLoadingProjects(false);
    };

    void loadProjects();
  }, [currentUserId, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || !currentUserId) {
      setBooks([]);
      setIsLoadingBooks(false);
      return;
    }

    const loadBooks = async () => {
      setIsLoadingBooks(true);
      setBookError(null);

      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Unable to load books:', error);
        setBookError(`Unable to load your books (${error.message}).`);
        setBooks([]);
      } else {
        setBooks(data ?? []);
      }

      setIsLoadingBooks(false);
    };

    void loadBooks();
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
      setIsLoadingBodyMeasurements(false);
      return;
    }

    const loadBodyMeasurements = async () => {
      setIsLoadingBodyMeasurements(true);
      setBodyMeasurementError(null);

      const { data, error } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Unable to load body_measurements:', error);
        setBodyMeasurementError(`Unable to load your measurements (${error.message}).`);
      } else if (data) {
        setBodyMeasurements(data as BodyMeasurementRow[]);
      }

      setIsLoadingBodyMeasurements(false);
    };

    void loadBodyMeasurements();
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
        .order('created_at', { ascending: true });

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

  const tomorrowKey = useMemo(() => {
    const parsed = parseDayKeyToDate(todayKey);
    if (!parsed) {
      return todayKey;
    }
    parsed.setDate(parsed.getDate() + 1);
    return toDateKey(parsed);
  }, [todayKey]);

  const appointmentDateKeys = useMemo(() => new Set(appointments.map((appointment) => appointment.appointment_date)), [appointments]);

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.appointment_date >= todayKey)
        .slice()
        .sort(
          (a, b) =>
            a.appointment_date.localeCompare(b.appointment_date) ||
            parseTimeLabelToMinutes(a.time_label) - parseTimeLabelToMinutes(b.time_label)
        ),
    [appointments, todayKey]
  );

  const dashboardActiveProjectsCount = projects.filter((project) => project.status !== 'Done').length;
  const { start: dashboardMonthStart, end: dashboardMonthEnd } = getPeriodRange('month', now);
  const dashboardMonthStartKey = toDateKey(dashboardMonthStart);
  const dashboardMonthEndKey = toDateKey(dashboardMonthEnd);
  const dashboardAppointmentsThisMonthCount = appointments.filter(
    (appointment) => appointment.appointment_date >= dashboardMonthStartKey && appointment.appointment_date <= dashboardMonthEndKey
  ).length;
  const dashboardSavingsTotal = savingsGoals.reduce((sum, goal) => sum + goal.current_amount, 0);

  const formatAppointmentDateLabel = (dateKey: string): string => {
    if (dateKey === todayKey) {
      return 'TODAY';
    }
    if (dateKey === tomorrowKey) {
      return 'TOMORROW';
    }
    const date = parseDayKeyToDate(dateKey);
    if (!date) {
      return dateKey;
    }
    return `${monthNamesShort[date.getMonth()].toUpperCase()} ${date.getDate()}`;
  };

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

  const latestLoggedWeightLbs = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].value : null;

  const bmi = useMemo(() => {
    if (!latestHeightInches || !latestLoggedWeightLbs) {
      return null;
    }
    return (latestLoggedWeightLbs * 703) / (latestHeightInches * latestHeightInches);
  }, [latestHeightInches, latestLoggedWeightLbs]);

  const bmiCategory = bmi === null ? null : getBmiCategory(bmi);

  const bmiMarkerPercent =
    bmi === null ? null : clampNumber(((bmi - BMI_SCALE_MIN) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100, 0, 100);

  const silhouetteMetrics = useMemo(() => getSilhouetteMetrics(latestHeightInches, bmi, 0.55), [latestHeightInches, bmi]);
  const weightTrendHistory = useMemo(
    () => weightHistory.map((entry) => ({ logDate: entry.log_date, value: entry.value })),
    [weightHistory]
  );
  const filteredWeightTrendHistory = useMemo(() => {
    if (weightTrendPeriod === 'all') return weightTrendHistory;
    const { start, end } = getPeriodRange(weightTrendPeriod, weightTrendAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return weightTrendHistory.filter((point) => point.logDate >= startKey && point.logDate <= endKey);
  }, [weightTrendHistory, weightTrendPeriod, weightTrendAnchorDate]);
  const stepsTrendHistory = useMemo(
    () => stepsHistory.map((entry) => ({ logDate: entry.log_date, value: entry.value })),
    [stepsHistory]
  );
  const filteredStepsTrendHistory = useMemo(() => {
    if (stepsTrendPeriod === 'all') return stepsTrendHistory;
    const { start, end } = getPeriodRange(stepsTrendPeriod, stepsTrendAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return stepsTrendHistory.filter((point) => point.logDate >= startKey && point.logDate <= endKey);
  }, [stepsTrendHistory, stepsTrendPeriod, stepsTrendAnchorDate]);
  const filteredStepsHistory = useMemo(() => {
    const { start, end } = getPeriodRange(stepsLogFilter, stepsLogAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return stepsHistory.filter((row) => row.log_date >= startKey && row.log_date <= endKey);
  }, [stepsHistory, stepsLogFilter, stepsLogAnchorDate]);

  const filteredWaterHistory = useMemo(() => {
    const { start, end } = getPeriodRange(waterLogFilter, waterLogAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return waterHistory.filter((row) => row.log_date >= startKey && row.log_date <= endKey);
  }, [waterHistory, waterLogFilter, waterLogAnchorDate]);
  const waterTrendHistory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of waterHistory) {
      totals.set(entry.log_date, (totals.get(entry.log_date) ?? 0) + entry.value);
    }
    return [...totals.entries()]
      .map(([logDate, value]) => ({ logDate, value }))
      .sort((a, b) => a.logDate.localeCompare(b.logDate));
  }, [waterHistory]);
  const filteredWaterTrendHistory = useMemo(() => {
    if (waterTrendPeriod === 'all') return waterTrendHistory;
    const { start, end } = getPeriodRange(waterTrendPeriod, waterTrendAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return waterTrendHistory.filter((point) => point.logDate >= startKey && point.logDate <= endKey);
  }, [waterTrendHistory, waterTrendPeriod, waterTrendAnchorDate]);
  const filteredWeightHistory = useMemo(() => {
    const { start, end } = getPeriodRange(weightLogFilter, weightLogAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return weightHistory.filter((row) => row.log_date >= startKey && row.log_date <= endKey);
  }, [weightHistory, weightLogFilter, weightLogAnchorDate]);
  const currentBalance = useMemo(() => transactions.reduce((sum, row) => sum + row.amount, 0), [transactions]);
  const subscriptionMonthlyTotal = useMemo(
    () => subscriptions.reduce((sum, row) => sum + toMonthlySubscriptionAmount(row.amount, row.billing_cycle), 0),
    [subscriptions]
  );
  const subscriptionYearlyTotal = subscriptionMonthlyTotal * 12;
  const incomeTrendHistory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of transactions) {
      if (row.amount <= 0) continue;
      totals.set(row.transaction_date, (totals.get(row.transaction_date) ?? 0) + row.amount);
    }
    return [...totals.entries()]
      .map(([logDate, value]) => ({ logDate, value }))
      .sort((a, b) => a.logDate.localeCompare(b.logDate));
  }, [transactions]);
  const filteredIncomeTrendHistory = useMemo(() => {
    if (incomeTrendPeriod === 'all') return incomeTrendHistory;
    const { start, end } = getPeriodRange(incomeTrendPeriod, incomeTrendAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return incomeTrendHistory.filter((point) => point.logDate >= startKey && point.logDate <= endKey);
  }, [incomeTrendHistory, incomeTrendPeriod, incomeTrendAnchorDate]);
  const incomeTrendTotal = useMemo(
    () => filteredIncomeTrendHistory.reduce((sum, point) => sum + point.value, 0),
    [filteredIncomeTrendHistory]
  );
  const incomeBySource = useMemo(() => {
    let startKey: string | null = null;
    let endKey: string | null = null;
    if (incomeTrendPeriod !== 'all') {
      const { start, end } = getPeriodRange(incomeTrendPeriod, incomeTrendAnchorDate);
      startKey = toDateKey(start);
      endKey = toDateKey(end);
    }

    const totals = new Map<string, number>();
    for (const row of transactions) {
      if (row.amount <= 0) continue;
      if (startKey && endKey && (row.transaction_date < startKey || row.transaction_date > endKey)) continue;

      const subcategory = row.subcategory || 'Other';
      const source = subcategory === 'Refund' ? row.vendor : subcategory === 'Mobile payments' ? row.sender_name : null;
      const label = source ? `${subcategory} — ${source}` : subcategory;
      totals.set(label, (totals.get(label) ?? 0) + row.amount);
    }

    return [...totals.entries()]
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, incomeTrendPeriod, incomeTrendAnchorDate]);
  const filteredTransactions = useMemo(() => {
    const { start, end } = getPeriodRange(transactionFilter, transactionFilterAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return transactions.filter((row) => row.transaction_date >= startKey && row.transaction_date <= endKey);
  }, [transactions, transactionFilter, transactionFilterAnchorDate]);
  const spendingByCategory = useMemo(() => {
    let startKey: string | null = null;
    let endKey: string | null = null;
    const includeAll = spendingPeriod === 'all';

    if (spendingPeriod === 'custom') {
      if (spendingCustomStart && spendingCustomEnd) {
        startKey = spendingCustomStart <= spendingCustomEnd ? spendingCustomStart : spendingCustomEnd;
        endKey = spendingCustomStart <= spendingCustomEnd ? spendingCustomEnd : spendingCustomStart;
      }
    } else if (!includeAll) {
      const { start, end } = getPeriodRange(spendingPeriod, spendingAnchorDate);
      startKey = toDateKey(start);
      endKey = toDateKey(end);
    }

    const totals = new Map<string, number>();
    TRANSACTION_CATEGORIES.forEach((category) => {
      if (category !== 'Income') {
        totals.set(category, 0);
      }
    });

    if (includeAll || (startKey && endKey)) {
      for (const row of transactions) {
        if (row.amount >= 0 || !row.category || !totals.has(row.category)) {
          continue;
        }
        if (!includeAll && (row.transaction_date < startKey! || row.transaction_date > endKey!)) {
          continue;
        }
        totals.set(row.category, (totals.get(row.category) ?? 0) + Math.abs(row.amount));
      }
    }

    return [...totals.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, spendingPeriod, spendingAnchorDate, spendingCustomStart, spendingCustomEnd]);
  const dashboardMonthlySpending = useMemo(() => {
    const { start, end } = getPeriodRange('month', now);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);

    const totals = new Map<string, number>();
    TRANSACTION_CATEGORIES.forEach((category) => {
      if (category !== 'Income') {
        totals.set(category, 0);
      }
    });

    for (const row of transactions) {
      if (row.amount >= 0 || !row.category || !totals.has(row.category)) {
        continue;
      }
      if (row.transaction_date < startKey || row.transaction_date > endKey) {
        continue;
      }
      totals.set(row.category, (totals.get(row.category) ?? 0) + Math.abs(row.amount));
    }

    return [...totals.entries()]
      .map(([category, total]) => ({ category, total }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [transactions, now]);

  useEffect(() => {
    const canvas = spendingChartCanvasRef.current;
    if (!canvas) {
      return;
    }

    const palette = themePalettes[theme];
    const chart =
      spendingChartType === 'pie'
        ? (() => {
            const pieCategories = spendingByCategory.filter((entry) => entry.total > 0);
            const pieColors = generateCategoryPalette(palette.accent, pieCategories.length);
            return new Chart(canvas, {
              type: 'pie',
              data: {
                labels: pieCategories.map((entry) => entry.category),
                datasets: [
                  {
                    data: pieCategories.map((entry) => entry.total),
                    backgroundColor: pieColors,
                    borderColor: palette.surface,
                    borderWidth: 2,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: 'right',
                    labels: { color: palette.foreground, boxWidth: 12, font: { size: 11 } },
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => `${context.label}: ${formatCurrency(Number(context.parsed) || 0)}`,
                    },
                  },
                },
              },
            });
          })()
        : (() => {
            const isHorizontal = spendingChartType === 'bar-horizontal';
            const valueScale = {
              beginAtZero: true,
              ticks: { color: palette.muted, callback: (value: string | number) => formatCurrency(Number(value)) },
              grid: { color: palette.border },
            };
            const categoryScale = {
              ticks: { color: palette.foreground },
              grid: { display: false },
            };
            return new Chart(canvas, {
              type: 'bar',
              data: {
                labels: spendingByCategory.map((entry) => entry.category),
                datasets: [
                  {
                    data: spendingByCategory.map((entry) => entry.total),
                    backgroundColor: palette.accent,
                    hoverBackgroundColor: palette.accentStrong,
                    borderRadius: 8,
                    maxBarThickness: 18,
                  },
                ],
              },
              options: {
                indexAxis: isHorizontal ? 'y' : 'x',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (context) => formatCurrency((isHorizontal ? context.parsed.x : context.parsed.y) ?? 0),
                    },
                  },
                },
                scales: isHorizontal ? { x: valueScale, y: categoryScale } : { x: categoryScale, y: valueScale },
              },
            });
          })();

    return () => {
      chart.destroy();
    };
  }, [spendingByCategory, theme, activeView, spendingChartType]);

  useEffect(() => {
    const canvas = incomeSourceChartCanvasRef.current;
    if (!canvas || incomeChartType !== 'pie') {
      return;
    }

    const palette = themePalettes[theme];
    const sources = incomeBySource.filter((entry) => entry.total > 0);
    const sourceColors = generateCategoryPalette(palette.accent, sources.length);
    const chart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: sources.map((entry) => `${entry.label}: ${formatCurrency(entry.total)}`),
        datasets: [
          {
            data: sources.map((entry) => entry.total),
            backgroundColor: sourceColors,
            borderColor: palette.surface,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: { color: palette.foreground, boxWidth: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (context) => `${sources[context.dataIndex]?.label ?? ''}: ${formatCurrency(Number(context.parsed) || 0)}`,
            },
          },
        },
      },
    });

    return () => {
      chart.destroy();
    };
  }, [incomeBySource, incomeChartType, theme, activeView]);
  const todayWaterEntries = useMemo(() => waterHistory.filter((row) => row.log_date === todayKey), [waterHistory, todayKey]);
  const todayWaterOz = todayWaterEntries.reduce((sum, row) => sum + row.value, 0);
  const waterPeriodDayCount = useMemo(
    () => getPeriodDayCount(waterLogFilter, waterLogAnchorDate),
    [waterLogFilter, waterLogAnchorDate]
  );
  const waterPeriodGoal = waterGoal * waterPeriodDayCount;
  const waterPeriodTotal = useMemo(
    () => filteredWaterHistory.reduce((sum, row) => sum + row.value, 0),
    [filteredWaterHistory]
  );
  const waterDisplayOz = waterLogFilter === 'day' ? todayWaterOz : waterPeriodTotal;
  const waterDisplayGoal = waterLogFilter === 'day' ? waterGoal : waterPeriodGoal;
  const waterPercentRaw = waterDisplayGoal > 0 ? (waterDisplayOz / waterDisplayGoal) * 100 : 0;
  const waterPercentDisplay = Math.round(waterPercentRaw);
  const waterRingPercent = clampNumber(waterPercentRaw, 0, 100);
  const waterWaveY = WATER_RING_SIZE - (waterRingPercent / 100) * WATER_RING_SIZE;

  const filteredSleepHistory = useMemo(() => {
    const { start, end } = getPeriodRange(sleepLogFilter, sleepLogAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return sleepHistory.filter((row) => row.log_date >= startKey && row.log_date <= endKey);
  }, [sleepHistory, sleepLogFilter, sleepLogAnchorDate]);
  const sleepTrendHistory = useMemo(
    () => sleepHistory.map((entry) => ({ logDate: entry.log_date, value: entry.value })),
    [sleepHistory]
  );
  const filteredSleepTrendHistory = useMemo(() => {
    if (sleepTrendPeriod === 'all') return sleepTrendHistory;
    const { start, end } = getPeriodRange(sleepTrendPeriod, sleepTrendAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return sleepTrendHistory.filter((point) => point.logDate >= startKey && point.logDate <= endKey);
  }, [sleepTrendHistory, sleepTrendPeriod, sleepTrendAnchorDate]);
  const todaySleepEntry = useMemo(() => sleepHistory.find((row) => row.log_date === todayKey), [sleepHistory, todayKey]);
  const todaySleepHours = todaySleepEntry?.value ?? 0;
  const todayStepsEntry = useMemo(() => stepsHistory.find((row) => row.log_date === todayKey), [stepsHistory, todayKey]);
  const todayStepsCount = todayStepsEntry?.value ?? 0;
  const todayWorkoutEntry = useMemo(
    () => workoutsHistory.find((row) => row.workout_date === todayKey),
    [workoutsHistory, todayKey]
  );
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

  const handleCreateAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppointmentError(null);

    if (!currentUserId) {
      setAppointmentError('Please sign in to add an appointment.');
      return;
    }

    const title = newAppointmentTitle.trim();
    if (!title) {
      setAppointmentError('Enter a title.');
      return;
    }

    if (!newAppointmentTimeSlot) {
      setAppointmentError('Choose a time.');
      return;
    }

    const appointmentDate = newAppointmentDate || todayKey;
    const timeLabel = `${newAppointmentTimeSlot} ${newAppointmentTimeMeridiem}`;

    setIsSavingAppointment(true);

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        title,
        appointment_date: appointmentDate,
        time_label: timeLabel,
        location: newAppointmentLocation.trim() || null,
        category: newAppointmentCategory,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Unable to save appointment:', error);
      setAppointmentError(`Unable to add that appointment (${error.message}).`);
    } else if (data) {
      setAppointments((current) => [...current, data]);
      setNewAppointmentDate('');
      setNewAppointmentTimeSlot('');
      setNewAppointmentTimeMeridiem('AM');
      setNewAppointmentTitle('');
      setNewAppointmentLocation('');
      setNewAppointmentCategory('Other');
    }

    setIsSavingAppointment(false);
  };

  const handleStartEditAppointment = (appointment: AppointmentRow) => {
    setDeletingAppointmentId(null);
    setEditingAppointmentId(appointment.id);
    setEditAppointmentDate(appointment.appointment_date);
    const [slot, meridiem] = appointment.time_label.split(' ');
    setEditAppointmentTimeSlot(slot ?? '');
    setEditAppointmentTimeMeridiem(meridiem === 'PM' ? 'PM' : 'AM');
    setEditAppointmentTitle(appointment.title);
    setEditAppointmentLocation(appointment.location ?? '');
    setEditAppointmentCategory(appointment.category);
    setAppointmentError(null);
  };

  const handleCancelEditAppointment = () => {
    setEditingAppointmentId(null);
  };

  const handleSaveEditAppointment = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setAppointmentError(null);

    const title = editAppointmentTitle.trim();
    if (!title) {
      setAppointmentError('Enter a title.');
      return;
    }

    if (!editAppointmentTimeSlot) {
      setAppointmentError('Choose a time.');
      return;
    }

    const appointmentDate = editAppointmentDate || todayKey;
    const timeLabel = `${editAppointmentTimeSlot} ${editAppointmentTimeMeridiem}`;
    const location = editAppointmentLocation.trim() || null;

    setIsSavingAppointmentEdit(true);

    const { error } = await supabase
      .from('appointments')
      .update({
        title,
        appointment_date: appointmentDate,
        time_label: timeLabel,
        location,
        category: editAppointmentCategory,
      })
      .eq('id', id);

    if (error) {
      console.error('Unable to update appointment:', error);
      setAppointmentError(`Unable to update that appointment (${error.message}).`);
    } else {
      setAppointments((current) =>
        current.map((row) =>
          row.id === id
            ? { ...row, title, appointment_date: appointmentDate, time_label: timeLabel, location, category: editAppointmentCategory }
            : row
        )
      );
      setEditingAppointmentId(null);
    }

    setIsSavingAppointmentEdit(false);
  };

  const handleStartDeleteAppointment = (id: string) => {
    setEditingAppointmentId(null);
    setDeletingAppointmentId(id);
  };

  const handleCancelDeleteAppointment = () => {
    setDeletingAppointmentId(null);
  };

  const handleConfirmDeleteAppointment = async (id: string) => {
    setIsDeletingAppointment(true);
    setAppointmentError(null);

    const { error } = await supabase.from('appointments').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete appointment:', error);
      setAppointmentError(`Unable to delete that appointment (${error.message}).`);
    } else {
      setAppointments((current) => current.filter((row) => row.id !== id));
    }

    setDeletingAppointmentId(null);
    setIsDeletingAppointment(false);
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

  const sortTransactions = (rows: TransactionRow[]) =>
    [...rows].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at));

  const handleCreateTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTransactionError(null);

    if (!currentUserId) {
      setTransactionError('Please sign in to add a transaction.');
      return;
    }

    const description = newTransactionDescription.trim();

    const enteredAmount = Number(newTransactionAmount);
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      setTransactionError('Enter a positive amount.');
      return;
    }

    const amount = newTransactionType === 'income' ? enteredAmount : -enteredAmount;
    const transactionDate = newTransactionDate || todayKey;
    const category = newTransactionCategory || null;
    const subcategory =
      newTransactionSubcategory === 'Other'
        ? newTransactionCustomSubcategory.trim() || 'Other'
        : newTransactionSubcategory || null;
    const vendor = newTransactionVendor.trim() || null;
    const senderName = newTransactionCategory === 'Income' ? newTransactionSenderName.trim() || null : null;

    const isGasEntry = newTransactionCategory === 'Transportation' && newTransactionSubcategory === 'Gas';
    let pricePerGallon: number | null = null;
    let gallons: number | null = null;

    if (isGasEntry) {
      if (newTransactionPricePerGallon.trim()) {
        pricePerGallon = Number(newTransactionPricePerGallon);
        if (!Number.isFinite(pricePerGallon) || pricePerGallon <= 0) {
          setTransactionError('Enter a valid price per gallon.');
          return;
        }
      }

      if (newTransactionGallons.trim()) {
        gallons = Number(newTransactionGallons);
        if (!Number.isFinite(gallons) || gallons <= 0) {
          setTransactionError('Enter a valid number of gallons.');
          return;
        }
      }
    }

    setIsSavingTransaction(true);

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        transaction_date: transactionDate,
        description,
        amount,
        category,
        subcategory,
        vendor,
        sender_name: senderName,
        price_per_gallon: pricePerGallon,
        gallons,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Unable to save transaction:', error);
      setTransactionError(`Unable to add that transaction (${error.message}).`);
    } else if (data) {
      setTransactions((current) => sortTransactions([...current, data]));
      setNewTransactionDate('');
      setNewTransactionDescription('');
      setNewTransactionAmount('');
      setNewTransactionCategory('');
      setNewTransactionSubcategory('');
      setNewTransactionCustomSubcategory('');
      setNewTransactionVendor('');
      setNewTransactionSenderName('');
      setNewTransactionPricePerGallon('');
      setNewTransactionGallons('');
    }

    setIsSavingTransaction(false);
  };

  const handleStartEditTransaction = (entry: TransactionRow) => {
    setDeletingTransactionId(null);
    setEditingTransactionId(entry.id);
    setEditTransactionDate(entry.transaction_date);
    setEditTransactionDescription(entry.description);
    setEditTransactionAmount(String(entry.amount));
  };

  const handleCancelEditTransaction = () => {
    setEditingTransactionId(null);
  };

  const handleSaveEditTransaction = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setTransactionError(null);

    const description = editTransactionDescription.trim();

    const amount = Number(editTransactionAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      setTransactionError('Enter a non-zero amount.');
      return;
    }

    const transactionDate = editTransactionDate || todayKey;

    setIsSavingTransactionEdit(true);

    const { error } = await supabase
      .from('transactions')
      .update({ description, amount, transaction_date: transactionDate })
      .eq('id', id);

    if (error) {
      console.error('Unable to update transaction:', error);
      setTransactionError(`Unable to update that transaction (${error.message}).`);
    } else {
      setTransactions((current) =>
        sortTransactions(
          current.map((row) => (row.id === id ? { ...row, description, amount, transaction_date: transactionDate } : row))
        )
      );
      setEditingTransactionId(null);
    }

    setIsSavingTransactionEdit(false);
  };

  const handleStartDeleteTransaction = (id: string) => {
    setEditingTransactionId(null);
    setDeletingTransactionId(id);
  };

  const handleCancelDeleteTransaction = () => {
    setDeletingTransactionId(null);
  };

  const handleConfirmDeleteTransaction = async (id: string) => {
    setIsDeletingTransaction(true);
    setTransactionError(null);

    const { error } = await supabase.from('transactions').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete transaction:', error);
      setTransactionError(`Unable to delete that transaction (${error.message}).`);
    } else {
      setTransactions((current) => current.filter((row) => row.id !== id));
      setTransactionItems((current) => current.filter((row) => row.transaction_id !== id));
    }

    setDeletingTransactionId(null);
    setIsDeletingTransaction(false);
  };

  const handleToggleExpandTransaction = (entry: TransactionRow) => {
    const willExpand = expandedTransactionId !== entry.id;
    setExpandedTransactionId(willExpand ? entry.id : null);
    setItemError(null);
    setEditingItemId(null);
    setDeletingItemId(null);
    setNewItemName('');
    setNewItemPrice('');
    setGasDetailsError(null);
    setGasPricePerGallonInput(willExpand && entry.price_per_gallon != null ? String(entry.price_per_gallon) : '');
    setGasGallonsInput(willExpand && entry.gallons != null ? String(entry.gallons) : '');
  };

  const handleSaveGasDetails = async (event: FormEvent<HTMLFormElement>, transactionId: string) => {
    event.preventDefault();
    setGasDetailsError(null);

    let pricePerGallon: number | null = null;
    if (gasPricePerGallonInput.trim()) {
      pricePerGallon = Number(gasPricePerGallonInput);
      if (!Number.isFinite(pricePerGallon) || pricePerGallon <= 0) {
        setGasDetailsError('Enter a valid price per gallon.');
        return;
      }
    }

    let gallons: number | null = null;
    if (gasGallonsInput.trim()) {
      gallons = Number(gasGallonsInput);
      if (!Number.isFinite(gallons) || gallons <= 0) {
        setGasDetailsError('Enter a valid number of gallons.');
        return;
      }
    }

    setIsSavingGasDetails(true);

    const { error } = await supabase
      .from('transactions')
      .update({ price_per_gallon: pricePerGallon, gallons })
      .eq('id', transactionId);

    if (error) {
      console.error('Unable to save gas details:', error);
      setGasDetailsError(`Unable to save gas details (${error.message}).`);
    } else {
      setTransactions((current) =>
        current.map((row) => (row.id === transactionId ? { ...row, price_per_gallon: pricePerGallon, gallons } : row))
      );
    }

    setIsSavingGasDetails(false);
  };

  const handleCreateTransactionItem = async (event: FormEvent<HTMLFormElement>, transactionId: string) => {
    event.preventDefault();
    setItemError(null);

    if (!currentUserId) {
      setItemError('Please sign in to add item details.');
      return;
    }

    const itemName = newItemName.trim();
    if (!itemName) {
      setItemError('Enter an item name.');
      return;
    }

    const price = Number(newItemPrice);
    if (!Number.isFinite(price) || price < 0) {
      setItemError('Enter a valid price.');
      return;
    }

    setIsSavingItem(true);

    const { data, error } = await supabase
      .from('transaction_items')
      .insert({
        transaction_id: transactionId,
        item_name: itemName,
        unit_price: price,
        quantity: 1,
        item_total: price,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Unable to save transaction item:', error);
      setItemError(`Unable to add that item (${error.message}).`);
    } else if (data) {
      setTransactionItems((current) => [...current, data]);
      setNewItemName('');
      setNewItemPrice('');
    }

    setIsSavingItem(false);
  };

  const handleStartEditItem = (item: TransactionItemRow) => {
    setDeletingItemId(null);
    setEditingItemId(item.id);
    setEditItemName(item.item_name);
    setEditItemPrice(String(item.item_total));
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
  };

  const handleSaveEditItem = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setItemError(null);

    const itemName = editItemName.trim();
    if (!itemName) {
      setItemError('Enter an item name.');
      return;
    }

    const price = Number(editItemPrice);
    if (!Number.isFinite(price) || price < 0) {
      setItemError('Enter a valid price.');
      return;
    }

    setIsSavingItemEdit(true);

    const { error } = await supabase
      .from('transaction_items')
      .update({ item_name: itemName, unit_price: price, quantity: 1, item_total: price })
      .eq('id', id);

    if (error) {
      console.error('Unable to update transaction item:', error);
      setItemError(`Unable to update that item (${error.message}).`);
    } else {
      setTransactionItems((current) =>
        current.map((row) => (row.id === id ? { ...row, item_name: itemName, unit_price: price, quantity: 1, item_total: price } : row))
      );
      setEditingItemId(null);
    }

    setIsSavingItemEdit(false);
  };

  const handleStartDeleteItem = (id: string) => {
    setEditingItemId(null);
    setDeletingItemId(id);
  };

  const handleCancelDeleteItem = () => {
    setDeletingItemId(null);
  };

  const handleConfirmDeleteItem = async (id: string) => {
    setIsDeletingItem(true);
    setItemError(null);

    const { error } = await supabase.from('transaction_items').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete transaction item:', error);
      setItemError(`Unable to delete that item (${error.message}).`);
    } else {
      setTransactionItems((current) => current.filter((row) => row.id !== id));
    }

    setDeletingItemId(null);
    setIsDeletingItem(false);
  };

  const sortCardCharges = (rows: CardChargeRow[]) =>
    [...rows].sort((a, b) => b.charge_date.localeCompare(a.charge_date) || b.created_at.localeCompare(a.created_at));

  const handleCreateCreditCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreditCardError(null);

    if (!currentUserId) {
      setCreditCardError('Please sign in to add a card.');
      return;
    }

    const cardName = newCardName.trim();
    if (!cardName) {
      setCreditCardError('Enter a card name.');
      return;
    }

    const creditLimit = Number(newCardLimit);
    if (!Number.isFinite(creditLimit) || creditLimit <= 0) {
      setCreditCardError('Enter a valid credit limit.');
      return;
    }

    let dueDay: number | null = null;
    if (newCardDueDay.trim()) {
      dueDay = Number(newCardDueDay);
      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        setCreditCardError('Enter a due day between 1 and 31.');
        return;
      }
    }

    setIsSavingCreditCard(true);

    const { data, error } = await supabase
      .from('credit_cards')
      .insert({
        card_name: cardName,
        credit_limit: creditLimit,
        card_color: newCardColor,
        due_day: dueDay,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Unable to save credit card:', error);
      setCreditCardError(`Unable to add that card (${error.message}).`);
    } else if (data) {
      setCreditCards((current) => [...current, data]);
      setNewCardName('');
      setNewCardLimit('');
      setNewCardColor('peach');
      setNewCardDueDay('');
      setShowAddCardForm(false);
    }

    setIsSavingCreditCard(false);
  };

  const handleStartEditCard = (card: CreditCardRow) => {
    setEditingCardId(card.id);
    setEditCardName(card.card_name);
    setEditCardLimit(String(card.credit_limit));
    setEditCardColor(cardColorOptions.find((option) => option.id === card.card_color)?.id ?? cardColorOptions[0].id);
    setEditCardDueDay(card.due_day != null ? String(card.due_day) : '');
    setCreditCardError(null);
  };

  const handleCancelEditCard = () => {
    setEditingCardId(null);
  };

  const handleSaveEditCard = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setCreditCardError(null);

    const cardName = editCardName.trim();
    if (!cardName) {
      setCreditCardError('Enter a card name.');
      return;
    }

    const creditLimit = Number(editCardLimit);
    if (!Number.isFinite(creditLimit) || creditLimit <= 0) {
      setCreditCardError('Enter a valid credit limit.');
      return;
    }

    let dueDay: number | null = null;
    if (editCardDueDay.trim()) {
      dueDay = Number(editCardDueDay);
      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        setCreditCardError('Enter a due day between 1 and 31.');
        return;
      }
    }

    setIsSavingCardEdit(true);

    const { error } = await supabase
      .from('credit_cards')
      .update({
        card_name: cardName,
        credit_limit: creditLimit,
        card_color: editCardColor,
        due_day: dueDay,
      })
      .eq('id', id);

    if (error) {
      console.error('Unable to update credit card:', error);
      setCreditCardError(`Unable to update that card (${error.message}).`);
    } else {
      setCreditCards((current) =>
        current.map((row) =>
          row.id === id ? { ...row, card_name: cardName, credit_limit: creditLimit, card_color: editCardColor, due_day: dueDay } : row
        )
      );
      setEditingCardId(null);
    }

    setIsSavingCardEdit(false);
  };

  const handleToggleExpandCard = (cardId: string) => {
    const willExpand = expandedCardId !== cardId;
    setExpandedCardId(willExpand ? cardId : null);
    setEditingCardId(null);
    setChargeError(null);
    setEditingChargeId(null);
    setDeletingChargeId(null);
    setNewChargeDate('');
    setNewChargeDescription('');
    setNewChargeAmount('');
  };

  const handleCreateCharge = async (event: FormEvent<HTMLFormElement>, cardId: string) => {
    event.preventDefault();
    setChargeError(null);

    if (!currentUserId) {
      setChargeError('Please sign in to add a charge.');
      return;
    }

    const description = newChargeDescription.trim();
    if (!description) {
      setChargeError('Enter a description.');
      return;
    }

    const amount = Number(newChargeAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      setChargeError('Enter a non-zero amount.');
      return;
    }

    const chargeDate = newChargeDate || todayKey;

    setIsSavingCharge(true);

    const { data, error } = await supabase
      .from('card_charges')
      .insert({
        card_id: cardId,
        charge_date: chargeDate,
        description,
        amount,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Unable to save card charge:', error);
      setChargeError(`Unable to add that charge (${error.message}).`);
    } else if (data) {
      setCardCharges((current) => sortCardCharges([...current, data]));
      setNewChargeDate('');
      setNewChargeDescription('');
      setNewChargeAmount('');
    }

    setIsSavingCharge(false);
  };

  const handleStartEditCharge = (entry: CardChargeRow) => {
    setDeletingChargeId(null);
    setEditingChargeId(entry.id);
    setEditChargeDate(entry.charge_date);
    setEditChargeDescription(entry.description);
    setEditChargeAmount(String(entry.amount));
  };

  const handleCancelEditCharge = () => {
    setEditingChargeId(null);
  };

  const handleSaveEditCharge = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setChargeError(null);

    const description = editChargeDescription.trim();
    if (!description) {
      setChargeError('Enter a description.');
      return;
    }

    const amount = Number(editChargeAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      setChargeError('Enter a non-zero amount.');
      return;
    }

    const chargeDate = editChargeDate || todayKey;

    setIsSavingChargeEdit(true);

    const { error } = await supabase
      .from('card_charges')
      .update({ description, amount, charge_date: chargeDate })
      .eq('id', id);

    if (error) {
      console.error('Unable to update card charge:', error);
      setChargeError(`Unable to update that charge (${error.message}).`);
    } else {
      setCardCharges((current) =>
        sortCardCharges(current.map((row) => (row.id === id ? { ...row, description, amount, charge_date: chargeDate } : row)))
      );
      setEditingChargeId(null);
    }

    setIsSavingChargeEdit(false);
  };

  const handleStartDeleteCharge = (id: string) => {
    setEditingChargeId(null);
    setDeletingChargeId(id);
  };

  const handleCancelDeleteCharge = () => {
    setDeletingChargeId(null);
  };

  const handleConfirmDeleteCharge = async (id: string) => {
    setIsDeletingCharge(true);
    setChargeError(null);

    const { error } = await supabase.from('card_charges').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete card charge:', error);
      setChargeError(`Unable to delete that charge (${error.message}).`);
    } else {
      setCardCharges((current) => current.filter((row) => row.id !== id));
    }

    setDeletingChargeId(null);
    setIsDeletingCharge(false);
  };

  const validateLoanFields = (
    name: string,
    originalAmount: string,
    remainingBalance: string,
    monthlyPayment: string,
    dueDay: string
  ): { name: string; originalAmount: number; remainingBalance: number; monthlyPayment: number; dueDay: number | null } | null => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setLoanError('Enter a loan name.');
      return null;
    }

    const original = Number(originalAmount);
    if (!Number.isFinite(original) || original <= 0) {
      setLoanError('Enter a valid original amount.');
      return null;
    }

    const remaining = Number(remainingBalance);
    if (!Number.isFinite(remaining) || remaining < 0) {
      setLoanError('Enter a valid remaining balance.');
      return null;
    }

    const payment = Number(monthlyPayment);
    if (!Number.isFinite(payment) || payment < 0) {
      setLoanError('Enter a valid monthly payment.');
      return null;
    }

    let parsedDueDay: number | null = null;
    if (dueDay.trim()) {
      parsedDueDay = Number(dueDay);
      if (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) {
        setLoanError('Enter a due day between 1 and 31.');
        return null;
      }
    }

    return { name: trimmedName, originalAmount: original, remainingBalance: remaining, monthlyPayment: payment, dueDay: parsedDueDay };
  };

  const handleCreateLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoanError(null);

    if (!currentUserId) {
      setLoanError('Please sign in to add a loan.');
      return;
    }

    const validated = validateLoanFields(
      newLoanName,
      newLoanOriginalAmount,
      newLoanRemainingBalance,
      newLoanMonthlyPayment,
      newLoanDueDay
    );
    if (!validated) {
      return;
    }

    setIsSavingLoan(true);

    const { data, error } = await supabase
      .from('loans')
      .insert({
        loan_name: validated.name,
        original_amount: validated.originalAmount,
        remaining_balance: validated.remainingBalance,
        monthly_payment: validated.monthlyPayment,
        due_day: validated.dueDay,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Unable to save loan:', error);
      setLoanError(`Unable to add that loan (${error.message}).`);
    } else if (data) {
      setLoans((current) => [...current, data]);
      setNewLoanName('');
      setNewLoanOriginalAmount('');
      setNewLoanRemainingBalance('');
      setNewLoanMonthlyPayment('');
      setNewLoanDueDay('');
      setShowAddLoanForm(false);
    }

    setIsSavingLoan(false);
  };

  const handleStartEditLoan = (loan: LoanRow) => {
    setDeletingLoanId(null);
    setEditingLoanId(loan.id);
    setEditLoanName(loan.loan_name);
    setEditLoanOriginalAmount(String(loan.original_amount));
    setEditLoanRemainingBalance(String(loan.remaining_balance));
    setEditLoanMonthlyPayment(String(loan.monthly_payment));
    setEditLoanDueDay(loan.due_day != null ? String(loan.due_day) : '');
    setLoanError(null);
  };

  const handleCancelEditLoan = () => {
    setEditingLoanId(null);
  };

  const handleSaveEditLoan = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setLoanError(null);

    const validated = validateLoanFields(editLoanName, editLoanOriginalAmount, editLoanRemainingBalance, editLoanMonthlyPayment, editLoanDueDay);
    if (!validated) {
      return;
    }

    setIsSavingLoanEdit(true);

    const { error } = await supabase
      .from('loans')
      .update({
        loan_name: validated.name,
        original_amount: validated.originalAmount,
        remaining_balance: validated.remainingBalance,
        monthly_payment: validated.monthlyPayment,
        due_day: validated.dueDay,
      })
      .eq('id', id);

    if (error) {
      console.error('Unable to update loan:', error);
      setLoanError(`Unable to update that loan (${error.message}).`);
    } else {
      setLoans((current) =>
        current.map((row) =>
          row.id === id
            ? {
                ...row,
                loan_name: validated.name,
                original_amount: validated.originalAmount,
                remaining_balance: validated.remainingBalance,
                monthly_payment: validated.monthlyPayment,
                due_day: validated.dueDay,
              }
            : row
        )
      );
      setEditingLoanId(null);
    }

    setIsSavingLoanEdit(false);
  };

  const handleStartDeleteLoan = (id: string) => {
    setEditingLoanId(null);
    setDeletingLoanId(id);
  };

  const handleCancelDeleteLoan = () => {
    setDeletingLoanId(null);
  };

  const handleConfirmDeleteLoan = async (id: string) => {
    setIsDeletingLoan(true);
    setLoanError(null);

    const { error } = await supabase.from('loans').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete loan:', error);
      setLoanError(`Unable to delete that loan (${error.message}).`);
    } else {
      setLoans((current) => current.filter((row) => row.id !== id));
    }

    setDeletingLoanId(null);
    setIsDeletingLoan(false);
  };

  const validateGoalFields = (
    name: string,
    targetAmount: string,
    currentAmount: string
  ): { name: string; targetAmount: number; currentAmount: number } | null => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSavingsGoalError('Enter a goal name.');
      return null;
    }

    const target = Number(targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      setSavingsGoalError('Enter a valid target amount.');
      return null;
    }

    const current = currentAmount.trim() ? Number(currentAmount) : 0;
    if (!Number.isFinite(current) || current < 0) {
      setSavingsGoalError('Enter a valid current amount.');
      return null;
    }

    return { name: trimmedName, targetAmount: target, currentAmount: current };
  };

  const handleCreateSavingsGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingsGoalError(null);

    if (!currentUserId) {
      setSavingsGoalError('Please sign in to add a savings goal.');
      return;
    }

    const validated = validateGoalFields(newGoalName, newGoalTargetAmount, newGoalCurrentAmount);
    if (!validated) {
      return;
    }

    setIsSavingGoal(true);

    const { data, error } = await supabase
      .from('savings_goals')
      .insert({
        goal_name: validated.name,
        target_amount: validated.targetAmount,
        current_amount: validated.currentAmount,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Unable to save savings goal:', error);
      setSavingsGoalError(`Unable to add that goal (${error.message}).`);
    } else if (data) {
      setSavingsGoals((current) => [...current, data]);
      setNewGoalName('');
      setNewGoalTargetAmount('');
      setNewGoalCurrentAmount('');
      setShowAddGoalForm(false);
    }

    setIsSavingGoal(false);
  };

  const handleStartEditGoal = (goal: SavingsGoalRow) => {
    setDeletingGoalId(null);
    setDepositingGoalId(null);
    setEditingGoalId(goal.id);
    setEditGoalName(goal.goal_name);
    setEditGoalTargetAmount(String(goal.target_amount));
    setEditGoalCurrentAmount(String(goal.current_amount));
    setSavingsGoalError(null);
  };

  const handleCancelEditGoal = () => {
    setEditingGoalId(null);
  };

  const handleSaveEditGoal = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setSavingsGoalError(null);

    const validated = validateGoalFields(editGoalName, editGoalTargetAmount, editGoalCurrentAmount);
    if (!validated) {
      return;
    }

    setIsSavingGoalEdit(true);

    const { error } = await supabase
      .from('savings_goals')
      .update({
        goal_name: validated.name,
        target_amount: validated.targetAmount,
        current_amount: validated.currentAmount,
      })
      .eq('id', id);

    if (error) {
      console.error('Unable to update savings goal:', error);
      setSavingsGoalError(`Unable to update that goal (${error.message}).`);
    } else {
      setSavingsGoals((current) =>
        current.map((row) =>
          row.id === id
            ? { ...row, goal_name: validated.name, target_amount: validated.targetAmount, current_amount: validated.currentAmount }
            : row
        )
      );
      setEditingGoalId(null);
    }

    setIsSavingGoalEdit(false);
  };

  const handleStartDeleteGoal = (id: string) => {
    setEditingGoalId(null);
    setDepositingGoalId(null);
    setDeletingGoalId(id);
  };

  const handleCancelDeleteGoal = () => {
    setDeletingGoalId(null);
  };

  const handleConfirmDeleteGoal = async (id: string) => {
    setIsDeletingGoal(true);
    setSavingsGoalError(null);

    const { error } = await supabase.from('savings_goals').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete savings goal:', error);
      setSavingsGoalError(`Unable to delete that goal (${error.message}).`);
    } else {
      setSavingsGoals((current) => current.filter((row) => row.id !== id));
    }

    setDeletingGoalId(null);
    setIsDeletingGoal(false);
  };

  const handleStartDeposit = (goalId: string) => {
    setEditingGoalId(null);
    setDeletingGoalId(null);
    setDepositingGoalId(goalId);
    setDepositAmount('');
    setSavingsGoalError(null);
  };

  const handleCancelDeposit = () => {
    setDepositingGoalId(null);
    setDepositAmount('');
  };

  const handleSaveDeposit = async (event: FormEvent<HTMLFormElement>, goal: SavingsGoalRow) => {
    event.preventDefault();
    setSavingsGoalError(null);

    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSavingsGoalError('Enter a valid deposit amount.');
      return;
    }

    setIsSavingDeposit(true);

    const nextAmount = goal.current_amount + amount;

    const { error } = await supabase.from('savings_goals').update({ current_amount: nextAmount }).eq('id', goal.id);

    if (error) {
      console.error('Unable to save deposit:', error);
      setSavingsGoalError(`Unable to add that deposit (${error.message}).`);
    } else {
      setSavingsGoals((current) => current.map((row) => (row.id === goal.id ? { ...row, current_amount: nextAmount } : row)));
      setDepositingGoalId(null);
      setDepositAmount('');
    }

    setIsSavingDeposit(false);
  };

  const validateSubscriptionFields = (
    name: string,
    amount: string,
    cycle: SubscriptionBillingCycle,
    renewalDay: string,
    renewalWeekday: string,
    renewalMonth: string
  ): {
    name: string;
    amount: number;
    cycle: SubscriptionBillingCycle;
    renewalDay: number | null;
    renewalWeekday: number | null;
    renewalMonth: number | null;
  } | null => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubscriptionError('Enter a subscription name.');
      return null;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setSubscriptionError('Enter a valid amount.');
      return null;
    }

    if (cycle === 'Weekly') {
      const weekday = Number(renewalWeekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        setSubscriptionError('Pick a renewal day of the week.');
        return null;
      }
      return { name: trimmedName, amount: parsedAmount, cycle, renewalDay: null, renewalWeekday: weekday, renewalMonth: null };
    }

    const day = Number(renewalDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setSubscriptionError('Enter a renewal day between 1 and 31.');
      return null;
    }

    if (cycle === 'Yearly') {
      const month = Number(renewalMonth);
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        setSubscriptionError('Pick a renewal month.');
        return null;
      }
      return { name: trimmedName, amount: parsedAmount, cycle, renewalDay: day, renewalWeekday: null, renewalMonth: month };
    }

    return { name: trimmedName, amount: parsedAmount, cycle, renewalDay: day, renewalWeekday: null, renewalMonth: null };
  };

  const handleToggleActiveSubscription = (id: string) => {
    setActiveSubscriptionId((current) => (current === id ? null : id));
  };

  const handleCreateSubscription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubscriptionError(null);

    if (!currentUserId) {
      setSubscriptionError('Please sign in to add a subscription.');
      return;
    }

    const validated = validateSubscriptionFields(
      newSubscriptionName,
      newSubscriptionAmount,
      newSubscriptionCycle,
      newSubscriptionRenewalDay,
      newSubscriptionRenewalWeekday,
      newSubscriptionRenewalMonth
    );
    if (!validated) {
      return;
    }

    setIsSavingSubscription(true);

    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        subscription_name: validated.name,
        amount: validated.amount,
        billing_cycle: validated.cycle,
        renewal_day: validated.renewalDay,
        renewal_weekday: validated.renewalWeekday,
        renewal_month: validated.renewalMonth,
        card_color: newSubscriptionColor,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Unable to save subscription:', error);
      setSubscriptionError(`Unable to add that subscription (${error.message}).`);
    } else if (data) {
      setSubscriptions((current) => [...current, data]);
      setNewSubscriptionName('');
      setNewSubscriptionAmount('');
      setNewSubscriptionCycle('Monthly');
      setNewSubscriptionRenewalDay('1');
      setNewSubscriptionRenewalWeekday('0');
      setNewSubscriptionRenewalMonth('1');
      setNewSubscriptionColor('peach');
      setShowAddSubscriptionForm(false);
    }

    setIsSavingSubscription(false);
  };

  const handleStartEditSubscription = (subscription: SubscriptionRow) => {
    setActiveSubscriptionId(null);
    setDeletingSubscriptionId(null);
    setEditingSubscriptionId(subscription.id);
    setEditSubscriptionName(subscription.subscription_name);
    setEditSubscriptionAmount(String(subscription.amount));
    setEditSubscriptionCycle(subscription.billing_cycle);
    setEditSubscriptionRenewalDay(subscription.renewal_day != null ? String(subscription.renewal_day) : '1');
    setEditSubscriptionRenewalWeekday(subscription.renewal_weekday != null ? String(subscription.renewal_weekday) : '0');
    setEditSubscriptionRenewalMonth(subscription.renewal_month != null ? String(subscription.renewal_month) : '1');
    setEditSubscriptionColor(subscription.card_color);
    setSubscriptionError(null);
  };

  const handleCancelEditSubscription = () => {
    setEditingSubscriptionId(null);
    setSubscriptionError(null);
  };

  const handleSaveEditSubscription = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setSubscriptionError(null);

    const validated = validateSubscriptionFields(
      editSubscriptionName,
      editSubscriptionAmount,
      editSubscriptionCycle,
      editSubscriptionRenewalDay,
      editSubscriptionRenewalWeekday,
      editSubscriptionRenewalMonth
    );
    if (!validated) {
      return;
    }

    setIsSavingSubscriptionEdit(true);

    const { error } = await supabase
      .from('subscriptions')
      .update({
        subscription_name: validated.name,
        amount: validated.amount,
        billing_cycle: validated.cycle,
        renewal_day: validated.renewalDay,
        renewal_weekday: validated.renewalWeekday,
        renewal_month: validated.renewalMonth,
        card_color: editSubscriptionColor,
      })
      .eq('id', id);

    if (error) {
      console.error('Unable to update subscription:', error);
      setSubscriptionError(`Unable to update that subscription (${error.message}).`);
    } else {
      setSubscriptions((current) =>
        current.map((row) =>
          row.id === id
            ? {
                ...row,
                subscription_name: validated.name,
                amount: validated.amount,
                billing_cycle: validated.cycle,
                renewal_day: validated.renewalDay,
                renewal_weekday: validated.renewalWeekday,
                renewal_month: validated.renewalMonth,
                card_color: editSubscriptionColor,
              }
            : row
        )
      );
      setEditingSubscriptionId(null);
    }

    setIsSavingSubscriptionEdit(false);
  };

  const handleStartDeleteSubscription = (id: string) => {
    setActiveSubscriptionId(null);
    setEditingSubscriptionId(null);
    setDeletingSubscriptionId(id);
    setSubscriptionError(null);
  };

  const handleCancelDeleteSubscription = () => {
    setDeletingSubscriptionId(null);
    setSubscriptionError(null);
  };

  const handleConfirmDeleteSubscription = async (id: string) => {
    setIsDeletingSubscription(true);
    setSubscriptionError(null);

    const { error } = await supabase.from('subscriptions').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete subscription:', error);
      setSubscriptionError(`Unable to delete that subscription (${error.message}).`);
    } else {
      setSubscriptions((current) => current.filter((row) => row.id !== id));
    }

    setDeletingSubscriptionId(null);
    setIsDeletingSubscription(false);
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProjectError(null);

    if (!currentUserId) {
      setProjectError('Please sign in to add a project.');
      return;
    }

    const projectName = newProjectName.trim();
    if (!projectName) return;

    setIsSavingProject(true);

    const { data, error } = await supabase
      .from('projects')
      .insert({
        project_name: projectName,
        icon: newProjectIcon.trim() || null,
        status: 'Not Started',
        start_date: newProjectStartDate || null,
        finish_date: newProjectFinishDate || null,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Unable to create project:', error);
      setProjectError(`Unable to add that project (${error.message}).`);
    } else if (data) {
      setProjects((current) => [...current, data]);
      setNewProjectName('');
      setNewProjectIcon('');
      setNewProjectStartDate('');
      setNewProjectFinishDate('');
      setShowAddProjectForm(false);
    }

    setIsSavingProject(false);
  };

  const handleStartEditProject = (project: ProjectRow) => {
    setPromptFinishDateProjectId(null);
    setEditingProjectId(project.id);
    setEditProjectName(project.project_name);
    setEditProjectIcon(project.icon ?? '');
    setEditProjectStartDate(project.start_date ?? '');
    setEditProjectFinishDate(project.finish_date ?? '');
    setProjectError(null);
  };

  const handleCancelEditProject = () => {
    setEditingProjectId(null);
  };

  const handleSaveEditProject = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setProjectError(null);

    const projectName = editProjectName.trim();
    if (!projectName) {
      setProjectError('Enter a project name.');
      return;
    }

    setIsSavingProjectEdit(true);

    const updatedFields = {
      project_name: projectName,
      icon: editProjectIcon.trim() || null,
      start_date: editProjectStartDate || null,
      finish_date: editProjectFinishDate || null,
    };

    const { error } = await supabase.from('projects').update(updatedFields).eq('id', id);

    if (error) {
      console.error('Unable to update project:', error);
      setProjectError(`Unable to update that project (${error.message}).`);
    } else {
      setProjects((current) => current.map((row) => (row.id === id ? { ...row, ...updatedFields } : row)));
      setEditingProjectId(null);
    }

    setIsSavingProjectEdit(false);
  };

  const handleCycleProjectStatus = async (project: ProjectRow) => {
    const currentIndex = PROJECT_STATUSES.indexOf(project.status as ProjectStatus);
    const nextStatus = PROJECT_STATUSES[(currentIndex + 1) % PROJECT_STATUSES.length] ?? PROJECT_STATUSES[0];

    setProjects((current) => current.map((row) => (row.id === project.id ? { ...row, status: nextStatus } : row)));

    const { error } = await supabase.from('projects').update({ status: nextStatus }).eq('id', project.id);

    if (error) {
      console.error('Unable to update project status:', error);
      setProjectError(`Unable to update that project's status (${error.message}).`);
      setProjects((current) => current.map((row) => (row.id === project.id ? { ...row, status: project.status } : row)));
    }
  };

  const commitProjectCompletion = async (project: ProjectRow, finishDate: string | null) => {
    setIsMarkingProjectComplete(true);

    const { error } = await supabase
      .from('projects')
      .update({ status: 'Done', finish_date: finishDate })
      .eq('id', project.id);

    if (error) {
      console.error('Unable to mark project completed:', error);
      setProjectError(`Unable to mark that project completed (${error.message}).`);
    } else {
      setProjects((current) =>
        current.map((row) => (row.id === project.id ? { ...row, status: 'Done', finish_date: finishDate } : row))
      );
      setPromptFinishDateProjectId(null);
      setPromptFinishDateValue('');
      setPromptFinishDateError(null);
    }

    setIsMarkingProjectComplete(false);
  };

  const handleMarkProjectCompleted = (project: ProjectRow) => {
    if (project.finish_date) {
      void commitProjectCompletion(project, project.finish_date);
      return;
    }
    setEditingProjectId(null);
    setPromptFinishDateError(null);
    setPromptFinishDateValue(todayKey);
    setPromptFinishDateProjectId(project.id);
  };

  const handleCancelPromptFinishDate = () => {
    setPromptFinishDateProjectId(null);
    setPromptFinishDateError(null);
  };

  const handleConfirmPromptFinishDate = (project: ProjectRow) => {
    if (!promptFinishDateValue) {
      setPromptFinishDateError('Enter a finish date.');
      return;
    }
    void commitProjectCompletion(project, promptFinishDateValue);
  };

  const handleAddSubtask = async (projectId: string) => {
    setProjectError(null);

    if (!currentUserId) {
      setProjectError('Please sign in to add a subtask.');
      return;
    }

    const title = (newSubtaskTitleByProject[projectId] ?? '').trim();
    if (!title) return;

    setIsSavingSubtaskByProject((current) => ({ ...current, [projectId]: true }));

    const { data, error } = await supabase
      .from('project_subtasks')
      .insert({ project_id: projectId, title, is_complete: false, user_id: currentUserId })
      .select()
      .single();

    if (error) {
      console.error('Unable to add subtask:', error);
      setProjectError(`Unable to add that subtask (${error.message}).`);
    } else if (data) {
      setProjectSubtasks((current) => ({
        ...current,
        [projectId]: [...(current[projectId] ?? []), data],
      }));
      setNewSubtaskTitleByProject((current) => ({ ...current, [projectId]: '' }));
    }

    setIsSavingSubtaskByProject((current) => ({ ...current, [projectId]: false }));
  };

  const handleToggleSubtask = async (subtask: ProjectSubtaskRow) => {
    const nextComplete = !subtask.is_complete;

    setProjectSubtasks((current) => ({
      ...current,
      [subtask.project_id]: (current[subtask.project_id] ?? []).map((row) =>
        row.id === subtask.id ? { ...row, is_complete: nextComplete } : row
      ),
    }));

    const { error } = await supabase.from('project_subtasks').update({ is_complete: nextComplete }).eq('id', subtask.id);

    if (error) {
      console.error('Unable to update subtask:', error);
      setProjectError(`Unable to update that subtask (${error.message}).`);
      setProjectSubtasks((current) => ({
        ...current,
        [subtask.project_id]: (current[subtask.project_id] ?? []).map((row) =>
          row.id === subtask.id ? { ...row, is_complete: subtask.is_complete } : row
        ),
      }));
    }
  };

  const handleStartEditSubtask = (subtask: ProjectSubtaskRow) => {
    setDeletingSubtaskId(null);
    setEditingSubtaskId(subtask.id);
    setEditSubtaskTitle(subtask.title);
  };

  const handleCancelEditSubtask = () => {
    setEditingSubtaskId(null);
    setEditSubtaskTitle('');
  };

  const handleSaveEditSubtask = async (subtask: ProjectSubtaskRow) => {
    const title = editSubtaskTitle.trim();
    if (!title) return;

    setIsSavingSubtaskEdit(true);

    const { error } = await supabase.from('project_subtasks').update({ title }).eq('id', subtask.id);

    if (error) {
      console.error('Unable to save subtask:', error);
      setProjectError(`Unable to save that subtask (${error.message}).`);
    } else {
      setProjectSubtasks((current) => ({
        ...current,
        [subtask.project_id]: (current[subtask.project_id] ?? []).map((row) =>
          row.id === subtask.id ? { ...row, title } : row
        ),
      }));
      setEditingSubtaskId(null);
      setEditSubtaskTitle('');
    }

    setIsSavingSubtaskEdit(false);
  };

  const handleStartDeleteSubtask = (id: string) => {
    setEditingSubtaskId(null);
    setDeletingSubtaskId(id);
  };

  const handleCancelDeleteSubtask = () => {
    setDeletingSubtaskId(null);
  };

  const handleConfirmDeleteSubtask = async (subtask: ProjectSubtaskRow) => {
    setIsDeletingSubtask(true);

    const { error } = await supabase.from('project_subtasks').delete().eq('id', subtask.id);

    if (error) {
      console.error('Unable to delete subtask:', error);
      setProjectError(`Unable to delete that subtask (${error.message}).`);
    } else {
      setProjectSubtasks((current) => ({
        ...current,
        [subtask.project_id]: (current[subtask.project_id] ?? []).filter((row) => row.id !== subtask.id),
      }));
    }

    setDeletingSubtaskId(null);
    setIsDeletingSubtask(false);
  };

  const handleToggleExpandProject = (projectId: string) => {
    setExpandedProjectIds((current) => ({ ...current, [projectId]: !current[projectId] }));
  };

  const validateBookFields = (
    title: string,
    status: BookStatus,
    currentPage: string,
    totalPages: string,
    rating: number,
    finishedDate: string
  ): {
    title: string;
    status: BookStatus;
    currentPage: number | null;
    totalPages: number | null;
    rating: number | null;
    finishedDate: string | null;
  } | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setBookError('Enter a book title.');
      return null;
    }

    let parsedCurrentPage: number | null = null;
    let parsedTotalPages: number | null = null;

    if (status === 'Currently Reading' || status === 'Finished') {
      if (totalPages.trim()) {
        parsedTotalPages = Number(totalPages);
        if (!Number.isInteger(parsedTotalPages) || parsedTotalPages <= 0) {
          setBookError('Enter a valid total page count.');
          return null;
        }
      }
    }

    if (status === 'Currently Reading') {
      if (currentPage.trim()) {
        parsedCurrentPage = Number(currentPage);
        if (!Number.isInteger(parsedCurrentPage) || parsedCurrentPage < 0) {
          setBookError('Enter a valid current page.');
          return null;
        }
      } else {
        parsedCurrentPage = 0;
      }
    }

    const parsedRating = status === 'Finished' && rating > 0 ? rating : null;
    const parsedFinishedDate = status === 'Finished' ? finishedDate.trim() || null : null;

    return {
      title: trimmedTitle,
      status,
      currentPage: parsedCurrentPage,
      totalPages: parsedTotalPages,
      rating: parsedRating,
      finishedDate: parsedFinishedDate,
    };
  };

  const handleCreateBook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBookError(null);

    if (!currentUserId) {
      setBookError('Please sign in to add a book.');
      return;
    }

    const validated = validateBookFields(newBookTitle, newBookStatus, '0', newBookTotalPages, newBookRating, newBookFinishedDate);
    if (!validated) {
      return;
    }

    setIsSavingBook(true);

    let coverImageUrl: string | null = null;
    if (newBookCoverFile) {
      const uploaded = await uploadBookCover(currentUserId, newBookCoverFile);
      if (!uploaded.url) {
        console.error('Unable to upload cover image:', uploaded.error);
        setBookError(`Unable to upload that cover image (${uploaded.error}).`);
        setIsSavingBook(false);
        return;
      }
      coverImageUrl = uploaded.url;
    }

    const { data, error } = await supabase
      .from('books')
      .insert({
        title: validated.title,
        author: newBookAuthor.trim() || null,
        genre: newBookGenre.trim() || null,
        description: newBookDescription.trim() || null,
        cover_image_url: coverImageUrl,
        status: validated.status,
        current_page: validated.currentPage,
        total_pages: validated.totalPages,
        rating: validated.rating,
        finished_date: validated.finishedDate,
        user_id: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Unable to save book:', error);
      setBookError(`Unable to add that book (${error.message}).`);
    } else if (data) {
      setBooks((current) => [...current, data]);
      setNewBookTitle('');
      setNewBookAuthor('');
      setNewBookGenre('');
      setNewBookDescription('');
      setNewBookCoverFile(null);
      setNewBookStatus('Want to Read');
      setNewBookTotalPages('');
      setNewBookRating(0);
      setNewBookFinishedDate('');
      setShowAddBookForm(false);
    }

    setIsSavingBook(false);
  };

  const handleStartEditBook = (book: BookRow) => {
    setDeletingBookId(null);
    setExpandedBookId(null);
    setEditingBookId(book.id);
    setEditBookTitle(book.title);
    setEditBookAuthor(book.author ?? '');
    setEditBookGenre(book.genre ?? '');
    setEditBookDescription(book.description ?? '');
    setEditBookCoverFile(null);
    setEditBookStatus(book.status);
    setEditBookCurrentPage(book.current_page != null ? String(book.current_page) : '0');
    setEditBookTotalPages(book.total_pages != null ? String(book.total_pages) : '');
    setEditBookRating(book.rating ?? 0);
    setEditBookFinishedDate(book.finished_date ?? '');
    setBookError(null);
  };

  const handleCancelEditBook = () => {
    setEditingBookId(null);
    setBookError(null);
  };

  const handleSaveEditBook = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setBookError(null);

    const validated = validateBookFields(
      editBookTitle,
      editBookStatus,
      editBookCurrentPage,
      editBookTotalPages,
      editBookRating,
      editBookFinishedDate
    );
    if (!validated) {
      return;
    }

    if (editBookCoverFile && !currentUserId) {
      setBookError('Please sign in to upload a cover image.');
      return;
    }

    setIsSavingBookEdit(true);

    let coverImageUrl: string | undefined;
    if (editBookCoverFile && currentUserId) {
      const uploaded = await uploadBookCover(currentUserId, editBookCoverFile);
      if (!uploaded.url) {
        console.error('Unable to upload cover image:', uploaded.error);
        setBookError(`Unable to upload that cover image (${uploaded.error}).`);
        setIsSavingBookEdit(false);
        return;
      }
      coverImageUrl = uploaded.url;
    }

    const updatedFields = {
      title: validated.title,
      author: editBookAuthor.trim() || null,
      genre: editBookGenre.trim() || null,
      description: editBookDescription.trim() || null,
      status: validated.status,
      current_page: validated.currentPage,
      total_pages: validated.totalPages,
      rating: validated.rating,
      finished_date: validated.finishedDate,
      ...(coverImageUrl ? { cover_image_url: coverImageUrl } : {}),
    };

    const { error } = await supabase.from('books').update(updatedFields).eq('id', id);

    if (error) {
      console.error('Unable to update book:', error);
      setBookError(`Unable to update that book (${error.message}).`);
    } else {
      setBooks((current) => current.map((row) => (row.id === id ? { ...row, ...updatedFields } : row)));
      setEditingBookId(null);
      setEditBookCoverFile(null);
    }

    setIsSavingBookEdit(false);
  };

  const handleStartDeleteBook = (id: string) => {
    setEditingBookId(null);
    setDeletingBookId(id);
    setBookError(null);
  };

  const handleToggleExpandBook = (id: string) => {
    setExpandedBookId((current) => (current === id ? null : id));
  };

  const handleCancelDeleteBook = () => {
    setDeletingBookId(null);
    setBookError(null);
  };

  const handleConfirmDeleteBook = async (id: string) => {
    setIsDeletingBook(true);
    setBookError(null);

    const { error } = await supabase.from('books').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete book:', error);
      setBookError(`Unable to delete that book (${error.message}).`);
    } else {
      setBooks((current) => current.filter((row) => row.id !== id));
    }

    setDeletingBookId(null);
    setIsDeletingBook(false);
  };

  const handleSetBookRating = async (book: BookRow, rating: number) => {
    const previousRating = book.rating;
    setBooks((current) => current.map((row) => (row.id === book.id ? { ...row, rating } : row)));

    const { error } = await supabase.from('books').update({ rating }).eq('id', book.id);

    if (error) {
      console.error('Unable to update rating:', error);
      setBookError(`Unable to update that rating (${error.message}).`);
      setBooks((current) => current.map((row) => (row.id === book.id ? { ...row, rating: previousRating } : row)));
    }
  };

  const wantToReadBooks = books.filter((book) => book.status === 'Want to Read');
  const currentlyReadingBooks = books.filter((book) => book.status === 'Currently Reading');
  const finishedBooks = books.filter((book) => book.status === 'Finished');
  const favoriteBooks = books.filter((book) => book.rating === 5);

  const renderStarIcon = (filled: boolean) =>
    filled ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5l2.9 6.06 6.6.77-4.86 4.55 1.28 6.52L12 17.9l-5.92 3.5 1.28-6.52-4.86-4.55 6.6-.77L12 2.5z" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2.5l2.9 6.06 6.6.77-4.86 4.55 1.28 6.52L12 17.9l-5.92 3.5 1.28-6.52-4.86-4.55 6.6-.77L12 2.5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );

  const renderBookRow = (book: BookRow) => {
    const isEditingThisBook = editingBookId === book.id;
    const isDeletingThisBook = deletingBookId === book.id;
    const isExpanded = expandedBookId === book.id;
    const gradient = getBookGradient(book.id);
    const progressPercent =
      book.total_pages && book.total_pages > 0
        ? Math.min(100, Math.round(((book.current_page ?? 0) / book.total_pages) * 100))
        : 0;
    const coverSwatch = (
      <div
        className="h-28 w-20 shrink-0 overflow-hidden rounded-[14px]"
        style={book.cover_image_url ? undefined : { background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)` }}
      >
        {book.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
    );

    if (isDeletingThisBook) {
      return (
        <div key={book.id} className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
          <p className="text-sm text-[color:var(--foreground)]">Delete &ldquo;{book.title}&rdquo;?</p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancelDeleteBook}
              className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmDeleteBook(book.id)}
              disabled={isDeletingBook}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
              style={{ backgroundColor: '#dc2626' }}
            >
              {isDeletingBook ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      );
    }

    if (isEditingThisBook) {
      return (
        <form
          key={book.id}
          onSubmit={(event) => void handleSaveEditBook(event, book.id)}
          className="space-y-2 rounded-[20px] border border-[color:var(--accent)] bg-[color:var(--surface-soft)] p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={editBookTitle}
              onChange={(event) => setEditBookTitle(event.target.value)}
              placeholder="Title"
              autoFocus
              aria-label="Book title"
              className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
            />
            <input
              value={editBookAuthor}
              onChange={(event) => setEditBookAuthor(event.target.value)}
              placeholder="Author (optional)"
              aria-label="Author"
              className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
            />
            <input
              value={editBookGenre}
              onChange={(event) => setEditBookGenre(event.target.value)}
              placeholder="Genre (optional)"
              aria-label="Genre"
              className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
            />
          </div>

          <textarea
            value={editBookDescription}
            onChange={(event) => setEditBookDescription(event.target.value)}
            placeholder="Description (optional)"
            aria-label="Description"
            rows={3}
            className="w-full resize-none rounded-[16px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
          />

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Cover image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setEditBookCoverFile(event.target.files?.[0] ?? null)}
              aria-label="Cover image"
              className="min-w-0 flex-1 text-xs text-[color:var(--muted)] file:mr-2 file:rounded-full file:border-0 file:bg-[color:var(--accent-soft)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[color:var(--accent-strong)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={editBookStatus}
              onChange={(event) => setEditBookStatus(event.target.value as BookStatus)}
              aria-label="Status"
              className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
            >
              {BOOK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {editBookStatus === 'Currently Reading' ? (
              <input
                type="number"
                min="0"
                step="1"
                value={editBookCurrentPage}
                onChange={(event) => setEditBookCurrentPage(event.target.value)}
                placeholder="Current page"
                aria-label="Current page"
                className="min-w-0 max-w-[120px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
              />
            ) : null}
            {editBookStatus === 'Currently Reading' || editBookStatus === 'Finished' ? (
              <input
                type="number"
                min="1"
                step="1"
                value={editBookTotalPages}
                onChange={(event) => setEditBookTotalPages(event.target.value)}
                placeholder="Total pages"
                aria-label="Total pages"
                className="min-w-0 max-w-[120px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
              />
            ) : null}
            {editBookStatus === 'Finished' ? (
              <input
                type="date"
                value={editBookFinishedDate}
                onChange={(event) => setEditBookFinishedDate(event.target.value)}
                aria-label="Finished date"
                className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
              />
            ) : null}
          </div>

          {editBookStatus === 'Finished' ? (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setEditBookRating(star)}
                  aria-label={`Set rating to ${star} star${star === 1 ? '' : 's'}`}
                  className="text-[color:var(--accent)] transition hover:scale-110"
                >
                  {renderStarIcon(star <= editBookRating)}
                </button>
              ))}
            </div>
          ) : null}

          {bookError ? <p className="text-xs font-medium text-red-500">{bookError}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancelEditBook}
              className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingBookEdit}
              className="rounded-full bg-[color:var(--accent)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
            >
              {isSavingBookEdit ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      );
    }

    return (
      <div
        key={book.id}
        className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-start gap-3">
          {coverSwatch}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              {book.description ? (
                <button
                  type="button"
                  onClick={() => handleToggleExpandBook(book.id)}
                  aria-expanded={isExpanded}
                  className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{book.title}</p>
                    {book.author ? <p className="truncate text-xs text-[color:var(--muted)]">{book.author}</p> : null}
                    {book.genre ? (
                      <span className="mt-1 inline-block rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--accent-strong)]">
                        {book.genre}
                      </span>
                    ) : null}
                    <p className="mt-1 truncate text-xs italic text-[color:var(--muted)]">{book.description}</p>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className={`mt-1 shrink-0 text-[color:var(--muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{book.title}</p>
                  {book.author ? <p className="truncate text-xs text-[color:var(--muted)]">{book.author}</p> : null}
                  {book.genre ? (
                    <span className="mt-1 inline-block rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--accent-strong)]">
                      {book.genre}
                    </span>
                  ) : null}
                </div>
              )}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStartEditBook(book)}
                  aria-label="Edit book"
                  className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--accent-strong)]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                  onClick={() => handleStartDeleteBook(book.id)}
                  aria-label="Delete book"
                  className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--accent-strong)]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                  </svg>
                </button>
              </div>
            </div>

            {isExpanded && book.description ? (
              <p className="mt-2 whitespace-pre-line rounded-[14px] bg-[color:var(--surface-soft)] p-3 text-xs leading-5 text-[color:var(--muted)]">
                {book.description}
              </p>
            ) : null}

            {book.status === 'Currently Reading' ? (
              <>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full transition-[width]"
                    style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #ffb199 0%, #ff6f91 100%)' }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-[color:var(--muted)]">
                  {progressPercent}% · page {book.current_page ?? 0} of {book.total_pages ?? '?'}
                </p>
              </>
            ) : null}

            {book.status === 'Finished' ? (
              <>
                {book.finished_date ? (
                  <p className="mt-2 text-xs text-[color:var(--muted)]">Finished {formatShortDate(book.finished_date)}</p>
                ) : null}
                {book.total_pages ? (
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">{book.total_pages} pages</p>
                ) : null}
                <div className="mt-1.5 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => void handleSetBookRating(book, star)}
                      aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                      className="text-[color:var(--accent)] transition hover:scale-110"
                    >
                      {renderStarIcon(star <= (book.rating ?? 0))}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const activeProjects = projects.filter((project) => project.status !== 'Done');
  const completedProjects = projects.filter((project) => project.status === 'Done');
  const completedProjectMonthKeys = [
    ...new Set(
      completedProjects
        .filter((project): project is ProjectRow & { finish_date: string } => Boolean(project.finish_date))
        .map((project) => project.finish_date.slice(0, 7))
    ),
  ].sort((a, b) => b.localeCompare(a));
  const completedProjectsHaveNoDate = completedProjects.some((project) => !project.finish_date);
  const filteredCompletedProjects = completedProjects.filter((project) => {
    if (completedProjectsFilter === 'all') return true;
    if (completedProjectsFilter === 'no-date') return !project.finish_date;
    return project.finish_date ? project.finish_date.slice(0, 7) === completedProjectsFilter : false;
  });

  const renderProjectCard = (project: ProjectRow) => {
    const subtasksForProject = projectSubtasks[project.id] ?? [];
    const completedCount = subtasksForProject.filter((subtask) => subtask.is_complete).length;
    const totalCount = subtasksForProject.length;
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    const status = (
      PROJECT_STATUSES.includes(project.status as ProjectStatus) ? project.status : 'Not Started'
    ) as ProjectStatus;
    const statusStyle = projectStatusStyles[status];
    const isExpanded = Boolean(expandedProjectIds[project.id]);
    const isEditingProject = editingProjectId === project.id;

    return (
      <div
        key={project.id}
        className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-soft)]"
      >
        {isEditingProject ? (
          <form
            onSubmit={(event) => {
              void handleSaveEditProject(event, project.id);
            }}
            className="space-y-3"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={editProjectIcon}
                onChange={(event) => setEditProjectIcon(event.target.value)}
                placeholder="🎯"
                maxLength={4}
                className="w-16 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-center text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <input
                type="text"
                value={editProjectName}
                onChange={(event) => setEditProjectName(event.target.value)}
                placeholder="Project name"
                autoFocus
                className="flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="min-w-[140px] flex-1 text-xs font-medium text-[color:var(--muted)]">
                Start date
                <div className="mt-1 flex items-center gap-1">
                  <input
                    type="date"
                    value={editProjectStartDate}
                    onChange={(event) => setEditProjectStartDate(event.target.value)}
                    className="flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  />
                  {editProjectStartDate ? (
                    <button
                      type="button"
                      onClick={() => setEditProjectStartDate('')}
                      className="shrink-0 text-xs font-semibold text-[color:var(--muted)] underline-offset-2 hover:underline"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </label>
              <label className="min-w-[140px] flex-1 text-xs font-medium text-[color:var(--muted)]">
                Finish date
                <div className="mt-1 flex items-center gap-1">
                  <input
                    type="date"
                    value={editProjectFinishDate}
                    onChange={(event) => setEditProjectFinishDate(event.target.value)}
                    className="flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  />
                  {editProjectFinishDate ? (
                    <button
                      type="button"
                      onClick={() => setEditProjectFinishDate('')}
                      className="shrink-0 text-xs font-semibold text-[color:var(--muted)] underline-offset-2 hover:underline"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelEditProject}
                className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProjectEdit || !editProjectName.trim()}
                className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-[color:var(--accent-contrast)] disabled:opacity-70"
              >
                {isSavingProjectEdit ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleToggleExpandProject(project.id)}
                aria-expanded={isExpanded}
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-[color:var(--foreground)]"
              >
                <span className="text-xl" aria-hidden="true">
                  {project.icon || '📁'}
                </span>
                <span className="truncate font-semibold">{project.project_name}</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleCycleProjectStatus(project)}
                  title="Click to change status"
                  className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition"
                  style={{ backgroundColor: statusStyle.background, color: statusStyle.color }}
                >
                  {status}
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEditProject(project)}
                  aria-label="Edit project"
                  className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
            </div>

            {project.start_date || project.finish_date ? (
              <p className="mt-1.5 text-xs text-[color:var(--muted)]">
                {project.start_date ? `Started ${formatShortDate(project.start_date)}` : null}
                {project.start_date && project.finish_date ? ' · ' : null}
                {project.finish_date ? `Finished ${formatShortDate(project.finish_date)}` : null}
              </p>
            ) : null}

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full transition-[width]"
                style={{ width: `${percent}%`, background: 'linear-gradient(90deg, #ffb199 0%, #ff6f91 100%)' }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[color:var(--muted)]">
              {completedCount} of {totalCount} tasks done
            </p>

            {promptFinishDateProjectId === project.id ? (
              <div className="mt-3 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
                <p className="text-sm text-[color:var(--foreground)]">When did you finish this project?</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={promptFinishDateValue}
                    onChange={(event) => setPromptFinishDateValue(event.target.value)}
                    autoFocus
                    className="flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={handleCancelPromptFinishDate}
                    className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmPromptFinishDate(project)}
                    disabled={isMarkingProjectComplete}
                    className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] disabled:opacity-70"
                  >
                    {isMarkingProjectComplete ? 'Saving…' : 'Mark Completed'}
                  </button>
                </div>
                {promptFinishDateError ? <p className="mt-1.5 text-xs text-[#dc2626]">{promptFinishDateError}</p> : null}
              </div>
            ) : status !== 'Done' ? (
              <button
                type="button"
                onClick={() => handleMarkProjectCompleted(project)}
                disabled={isMarkingProjectComplete}
                className="mt-3 w-full rounded-full border border-[color:var(--border)] py-2 text-xs font-semibold text-[color:var(--accent-strong)] transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] disabled:opacity-70"
              >
                ✓ Mark Completed
              </button>
            ) : null}

            {isExpanded ? (
              <>
                <div className="mt-3 space-y-2">
                  {subtasksForProject.map((subtask) =>
                    deletingSubtaskId === subtask.id ? (
                      <div
                        key={subtask.id}
                        className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
                      >
                        <p className="text-sm text-[color:var(--foreground)]">
                          Delete &ldquo;{subtask.title}&rdquo;?
                        </p>
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleCancelDeleteSubtask}
                            className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:text-[color:var(--accent-strong)]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleConfirmDeleteSubtask(subtask)}
                            disabled={isDeletingSubtask}
                            className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                            style={{ backgroundColor: '#dc2626' }}
                          >
                            {isDeletingSubtask ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ) : editingSubtaskId === subtask.id ? (
                      <form
                        key={subtask.id}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleSaveEditSubtask(subtask);
                        }}
                        className="flex items-center gap-2 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface)] p-2"
                      >
                        <input
                          type="text"
                          value={editSubtaskTitle}
                          onChange={(event) => setEditSubtaskTitle(event.target.value)}
                          autoFocus
                          className="flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                        <button
                          type="button"
                          onClick={handleCancelEditSubtask}
                          className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingSubtaskEdit}
                          className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] disabled:opacity-70"
                        >
                          {isSavingSubtaskEdit ? 'Saving…' : 'Save'}
                        </button>
                      </form>
                    ) : (
                      <div
                        key={subtask.id}
                        className="flex items-center gap-2 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => void handleToggleSubtask(subtask)}
                          aria-pressed={subtask.is_complete}
                          aria-label={`Mark "${subtask.title}" as ${subtask.is_complete ? 'incomplete' : 'complete'}`}
                          className={`h-5 w-5 shrink-0 rounded-full border-2 border-[color:var(--accent)] transition ${
                            subtask.is_complete ? 'bg-[color:var(--accent)]' : 'bg-transparent'
                          }`}
                        />
                        <span
                          className={`flex-1 text-sm ${
                            subtask.is_complete ? 'text-[color:var(--muted)] line-through' : 'text-[color:var(--foreground)]'
                          }`}
                        >
                          {subtask.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartEditSubtask(subtask)}
                          aria-label="Edit subtask"
                          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                          onClick={() => handleStartDeleteSubtask(subtask.id)}
                          aria-label="Delete subtask"
                          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                    )
                  )}
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleAddSubtask(project.id);
                  }}
                  className="mt-2 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newSubtaskTitleByProject[project.id] ?? ''}
                    onChange={(event) =>
                      setNewSubtaskTitleByProject((current) => ({ ...current, [project.id]: event.target.value }))
                    }
                    placeholder="Add subtask"
                    className="flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  />
                  <button
                    type="submit"
                    disabled={isSavingSubtaskByProject[project.id]}
                    className="shrink-0 rounded-full bg-[color:var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-strong)] transition hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-contrast)] disabled:opacity-70"
                  >
                    {isSavingSubtaskByProject[project.id] ? 'Adding…' : '+ Add subtask'}
                  </button>
                </form>
              </>
            ) : null}
          </>
        )}
      </div>
    );
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
        setWeightInput(String(mostRecent.value));

        setNewWeightDate('');
        setNewWeightTimeSlot('');
        setNewWeightTimeMeridiem(defaultWeightTimeSlot.meridiem);
      }
    }

    setIsSavingBodyMetrics(false);
  };

  const getLatestMeasurement = (type: BodyMeasurementType, side: BodyMeasurementSide | null): BodyMeasurementRow | null => {
    const matches = bodyMeasurements.filter((row) => row.measurement_type === type && row.side === side);
    return matches.length === 0 ? null : matches[matches.length - 1];
  };

  const getMeasurementHistory = (type: BodyMeasurementType, side: BodyMeasurementSide | null): BodyMeasurementRow[] => {
    const { start, end } = getPeriodRange(measurementHistoryFilter, measurementHistoryAnchorDate);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    return bodyMeasurements
      .filter(
        (row) =>
          row.measurement_type === type && row.side === side && row.log_date >= startKey && row.log_date <= endKey
      )
      .slice()
      .reverse();
  };

  const handleStartAddMeasurement = (slotKey: string) => {
    setHistoryMeasurementSlot(null);
    setAddingMeasurementSlot(slotKey);
    setNewMeasurementValue('');
    setBodyMeasurementError(null);
  };

  const handleCancelAddMeasurement = () => {
    setAddingMeasurementSlot(null);
  };

  const handleSaveMeasurement = async (
    event: FormEvent<HTMLFormElement>,
    type: BodyMeasurementType,
    side: BodyMeasurementSide | null
  ) => {
    event.preventDefault();
    setBodyMeasurementError(null);

    if (!currentUserId) {
      setBodyMeasurementError('Please sign in to log your measurements.');
      return;
    }

    const value = Number(newMeasurementValue);
    if (!Number.isFinite(value) || value <= 0) {
      setBodyMeasurementError('Enter a valid measurement.');
      return;
    }

    const logDate = measurementEntryDate || todayKey;

    setIsSavingMeasurement(true);

    const { data: insertedRows, error } = await supabase
      .from('body_measurements')
      .insert({ user_id: currentUserId, measurement_type: type, side, value, log_date: logDate })
      .select();

    if (error) {
      console.error('Unable to save body measurement:', error);
      setBodyMeasurementError(`Unable to save that measurement (${error.message}).`);
    } else {
      const insertedRow = (insertedRows as BodyMeasurementRow[] | null)?.[0];
      if (insertedRow) {
        setBodyMeasurements((current) => [...current, insertedRow].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        setAddingMeasurementSlot(null);
        setNewMeasurementValue('');
      }
    }

    setIsSavingMeasurement(false);
  };

  const handleToggleMeasurementHistory = (slotKey: string) => {
    setAddingMeasurementSlot(null);
    setHistoryMeasurementSlot((current) => (current === slotKey ? null : slotKey));
  };

  const handleStartEditMeasurement = (entry: BodyMeasurementRow) => {
    setDeletingMeasurementId(null);
    setEditingMeasurementId(entry.id);
    setEditMeasurementValue(String(entry.value));
  };

  const handleCancelEditMeasurement = () => {
    setEditingMeasurementId(null);
  };

  const handleSaveEditMeasurement = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    setBodyMeasurementError(null);

    const value = Number(editMeasurementValue);
    if (!Number.isFinite(value) || value <= 0) {
      setBodyMeasurementError('Enter a valid measurement.');
      return;
    }

    setIsSavingMeasurementEdit(true);

    const { error } = await supabase.from('body_measurements').update({ value }).eq('id', id);

    if (error) {
      console.error('Unable to update body measurement:', error);
      setBodyMeasurementError(`Unable to update that entry (${error.message}).`);
    } else {
      setBodyMeasurements((current) => current.map((row) => (row.id === id ? { ...row, value } : row)));
      setEditingMeasurementId(null);
    }

    setIsSavingMeasurementEdit(false);
  };

  const handleStartDeleteMeasurement = (id: string) => {
    setEditingMeasurementId(null);
    setDeletingMeasurementId(id);
  };

  const handleCancelDeleteMeasurement = () => {
    setDeletingMeasurementId(null);
  };

  const handleConfirmDeleteMeasurement = async (id: string) => {
    setIsDeletingMeasurement(true);
    setBodyMeasurementError(null);

    const { error } = await supabase.from('body_measurements').delete().eq('id', id);

    if (error) {
      console.error('Unable to delete body measurement:', error);
      setBodyMeasurementError(`Unable to delete that entry (${error.message}).`);
    } else {
      setBodyMeasurements((current) => current.filter((row) => row.id !== id));
    }

    setDeletingMeasurementId(null);
    setIsDeletingMeasurement(false);
  };

  const renderMeasurementSlot = (type: BodyMeasurementType, side: BodyMeasurementSide | null) => {
    const slotKey = getBodyMeasurementSlotKey(type, side);
    const latest = getLatestMeasurement(type, side);
    const sideLabel = side ? `${side === 'left' ? 'L' : 'R'} ` : '';

    return (
      <div key={slotKey} className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleToggleMeasurementHistory(slotKey)}
          className="text-sm font-semibold text-[color:var(--foreground)] underline-offset-2 hover:underline"
        >
          {sideLabel}
          {latest ? `${latest.value}"` : '—'}
        </button>
        <button
          type="button"
          onClick={() => handleStartAddMeasurement(slotKey)}
          aria-label={`Log new ${side ?? ''} ${type} measurement`.trim()}
          className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    );
  };

  const renderMeasurementPanel = (type: BodyMeasurementType, side: BodyMeasurementSide | null) => {
    const slotKey = getBodyMeasurementSlotKey(type, side);
    const isAdding = addingMeasurementSlot === slotKey;
    const isHistoryOpen = historyMeasurementSlot === slotKey;

    if (!isAdding && !isHistoryOpen) {
      return null;
    }

    if (isAdding) {
      return (
        <form
          key={slotKey}
          onSubmit={(event) => void handleSaveMeasurement(event, type, side)}
          className="mt-1.5 space-y-1.5 rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface)] p-2"
        >
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={newMeasurementValue}
              onChange={(event) => setNewMeasurementValue(event.target.value)}
              placeholder="in"
              autoFocus
              aria-label={`${type} measurement in inches`}
              className="w-16 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1 text-xs text-[color:var(--foreground)] outline-none"
            />
            <span className="text-[10px] text-[color:var(--muted)]">in</span>
          </div>
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={handleCancelAddMeasurement}
              className="rounded-full border border-[color:var(--border)] px-2 py-1 text-[10px] font-semibold text-[color:var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingMeasurement}
              className="rounded-full bg-[color:var(--accent)] px-2 py-1 text-[10px] font-semibold text-[color:var(--accent-contrast)] disabled:opacity-70"
            >
              {isSavingMeasurement ? '…' : 'Save'}
            </button>
          </div>
        </form>
      );
    }

    const history = getMeasurementHistory(type, side);

    return (
      <div key={slotKey} className="mt-1.5 rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface)] p-2">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setMeasurementHistoryAnchorDate((prev) => shiftAnchorDate(measurementHistoryFilter, prev, -1))}
            aria-label={`Previous ${measurementHistoryFilter}`}
            className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
          >
            ‹
          </button>
          <span className="text-[9px] font-semibold text-[color:var(--foreground)]">
            {formatCompactPeriodLabel(measurementHistoryFilter, measurementHistoryAnchorDate)}
          </span>
          <button
            type="button"
            onClick={() => setMeasurementHistoryAnchorDate((prev) => shiftAnchorDate(measurementHistoryFilter, prev, 1))}
            aria-label={`Next ${measurementHistoryFilter}`}
            className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
          >
            ›
          </button>
        </div>

        <div className="mt-1.5 max-h-[140px] space-y-1.5 overflow-y-auto pr-1">
          {history.length === 0 ? (
            <p className="text-[10px] text-[color:var(--muted)]">No entries this {measurementHistoryFilter}.</p>
          ) : (
            history.map((entry) =>
              deletingMeasurementId === entry.id ? (
                <div key={entry.id} className="rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1.5">
                  <p className="text-[10px] text-[color:var(--foreground)]">
                    Delete {entry.value}&quot; from {formatShortDate(entry.log_date)}?
                  </p>
                  <div className="mt-1 flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={handleCancelDeleteMeasurement}
                      className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--muted)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirmDeleteMeasurement(entry.id)}
                      disabled={isDeletingMeasurement}
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-70"
                      style={{ backgroundColor: '#dc2626' }}
                    >
                      {isDeletingMeasurement ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : editingMeasurementId === entry.id ? (
                <form
                  key={entry.id}
                  onSubmit={(event) => void handleSaveEditMeasurement(event, entry.id)}
                  className="flex items-center justify-between gap-1 rounded-[10px] border border-[color:var(--accent)] bg-[color:var(--surface-soft)] px-2 py-1"
                >
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={editMeasurementValue}
                      onChange={(event) => setEditMeasurementValue(event.target.value)}
                      autoFocus
                      aria-label="Measurement in inches"
                      className="w-12 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-1.5 py-0.5 text-[10px] text-[color:var(--foreground)] outline-none"
                    />
                    <span className="text-[10px] text-[color:var(--muted)]">in</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={handleCancelEditMeasurement}
                      aria-label="Cancel edit"
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--muted)] transition hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingMeasurementEdit}
                      aria-label="Save"
                      className="rounded-full bg-[color:var(--accent)] px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--accent-contrast)] disabled:opacity-70"
                    >
                      {isSavingMeasurementEdit ? '…' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-1 rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1"
                >
                  <span className="text-[10px] text-[color:var(--foreground)]">
                    {entry.value}&quot; · {formatShortDate(entry.log_date)}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleStartEditMeasurement(entry)}
                      aria-label="Edit entry"
                      className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                      onClick={() => handleStartDeleteMeasurement(entry.id)}
                      aria-label="Delete entry"
                      className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
              )
            )
          )}
        </div>
      </div>
    );
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
    if (!Number.isFinite(oz) || oz <= 0) {
      setWaterError('Enter a valid amount of water.');
      return;
    }

    const logDate = newWaterDate || todayKey;

    setIsSavingWater(true);

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
        setWaterHistory((current) => [...current, insertedRow].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        setWaterValueInput('');
        setNewWaterDate('');
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
    if (!Number.isFinite(value) || value <= 0) {
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
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
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
    { href: '/finances', label: 'Finances' },
    { href: '/projects', label: 'Projects' },
    { href: '/books', label: 'Books' },
    { href: '/analytics', label: 'Reports' },
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

        <datalist id="time-slot-suggestions">
          {timeSlotOptions.map((slot) => (
            <option key={slot} value={slot} />
          ))}
        </datalist>

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
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Projects</span>
                    <span className="mt-2 block text-2xl font-semibold text-[color:var(--foreground)]">{dashboardActiveProjectsCount}</span>
                  </div>
                  <div className="rounded-[24px] bg-[color:var(--surface-soft)] px-4 py-4 text-center shadow-[var(--shadow-soft)]">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Appointments</span>
                    <span className="mt-2 block text-2xl font-semibold text-[color:var(--foreground)]">{dashboardAppointmentsThisMonthCount}</span>
                    <span className="mt-1 block text-[10px] font-medium text-[color:var(--muted)]">This Month</span>
                  </div>
                  <div className="rounded-[24px] bg-[color:var(--surface-soft)] px-4 py-4 text-center shadow-[var(--shadow-soft)]">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Savings</span>
                    <span className="mt-2 block text-2xl font-semibold text-[color:var(--foreground)]">{formatCurrency(dashboardSavingsTotal)}</span>
                  </div>
                </div>
              </div>
            </section>

            <EditLayoutControls layout={widgetLayout} />

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

            <WidgetGrid className="grid gap-6 xl:grid-cols-3" order={widgetLayout.order} isEditing={widgetLayout.isEditing} onReorder={widgetLayout.moveWidget}>
              <DraggableWidget id="planner" key="planner">
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
              </DraggableWidget>

              <DraggableWidget id="wellness" key="wellness">
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
                      <p className="text-3xl font-semibold text-[color:var(--foreground)]">{formatSleepDuration(todaySleepHours)}</p>
                      <p className="text-sm text-[color:var(--muted)]">goal {formatSleepDuration(SLEEP_GOAL)}</p>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--accent-soft)]">
                      <div
                        className="h-2 rounded-full bg-[color:var(--accent)] transition-[width]"
                        style={{ width: `${clampNumber((todaySleepHours / SLEEP_GOAL) * 100, 0, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow-soft)]">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">Steps</p>
                    <div className="mt-3 flex items-end gap-3">
                      <p className="text-3xl font-semibold text-[color:var(--foreground)]">{formatStepsCount(todayStepsCount)}</p>
                      <p className="text-sm text-[color:var(--muted)]">goal {formatStepsCount(STEPS_GOAL)}</p>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--accent-soft)]">
                      <div
                        className="h-2 rounded-full bg-[color:var(--accent)] transition-[width]"
                        style={{ width: `${clampNumber((todayStepsCount / STEPS_GOAL) * 100, 0, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow-soft)]">
                      <p className="text-sm font-medium text-[color:var(--foreground)]">Water</p>
                      <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">{todayWaterOz} oz</p>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">Goal {waterGoal} oz</p>
                    </div>
                    <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow-soft)]">
                      <p className="text-sm font-medium text-[color:var(--foreground)]">Workout</p>
                      <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">
                        {todayWorkoutEntry ? todayWorkoutEntry.name : 'None yet'}
                      </p>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">{todayWorkoutEntry ? 'Logged today' : 'Not logged today'}</p>
                    </div>
                  </div>
                </div>
              </section>
              </DraggableWidget>

              <DraggableWidget id="finances" key="finances">
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
                    <p className="text-sm font-medium text-[color:var(--foreground)]">Available balance</p>
                    <p
                      className="mt-2 text-3xl font-semibold"
                      style={{ color: currentBalance >= 0 ? 'var(--foreground)' : '#dc2626' }}
                    >
                      {formatCurrency(currentBalance)}
                    </p>
                  </div>
                  <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5 shadow-[var(--shadow-soft)]">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">Spending categories</p>
                    <div className="mt-5 space-y-4">
                      {dashboardMonthlySpending.length === 0 ? (
                        <p className="text-sm text-[color:var(--muted)]">No spending logged this month yet.</p>
                      ) : (
                        dashboardMonthlySpending.map((item) => (
                          <div key={item.category} className="space-y-2">
                            <div className="flex items-center justify-between text-sm text-[color:var(--muted)]">
                              <span>{item.category}</span>
                              <span>{formatCurrency(item.total)}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[color:var(--accent-soft)]">
                              <div
                                className="h-2 rounded-full bg-[color:var(--accent)]"
                                style={{ width: `${(item.total / dashboardMonthlySpending[0].total) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
              </DraggableWidget>
            </WidgetGrid>
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

            <EditLayoutControls layout={widgetLayout} />

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

            <WidgetGrid className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr_0.9fr]" order={widgetLayout.order} isEditing={widgetLayout.isEditing} onReorder={widgetLayout.moveWidget}>
              <DraggableWidget id="calendar" key="calendar">
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
                      const hasAppointment = appointmentDateKeys.has(cell.key);
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
                          <span className="relative inline-block leading-none">
                            {cell.date.getDate()}
                            {hasAppointment ? (
                              <span
                                aria-hidden="true"
                                className="absolute -bottom-1 left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full"
                                style={{ backgroundColor: isSelected ? 'currentColor' : '#6d83d6' }}
                              />
                            ) : null}
                          </span>
                          {holidayName ? (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-[7px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                              style={{ backgroundColor: isSelected ? 'currentColor' : 'var(--accent)' }}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              </DraggableWidget>

              <DraggableWidget id="todo" key="todo">
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
                    <input
                      type="text"
                      inputMode="numeric"
                      list="time-slot-suggestions"
                      value={newTaskTimeSlot}
                      onChange={(event) => setNewTaskTimeSlot(event.target.value)}
                      placeholder="H:MM"
                      aria-label="Task time"
                      className="min-w-0 flex-1 basis-[110px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
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
              </DraggableWidget>

              <DraggableWidget id="thisMonth" key="thisMonth">
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
              </DraggableWidget>

              <DraggableWidget id="appointments" key="appointments">
              <div className="rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Appointments</h3>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {upcomingAppointments.length} upcoming
                  </span>
                </div>

                {appointmentError ? <p className="mt-3 text-xs font-medium text-red-500">{appointmentError}</p> : null}

                <div className="mt-4 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                  {isLoadingAppointments ? (
                    <p className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      Loading your appointments…
                    </p>
                  ) : upcomingAppointments.length === 0 ? (
                    <div className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      Nothing upcoming yet.
                    </div>
                  ) : (
                    upcomingAppointments.map((appointment) => {
                      if (editingAppointmentId === appointment.id) {
                        return (
                          <form
                            key={appointment.id}
                            onSubmit={(event) => void handleSaveEditAppointment(event, appointment.id)}
                            className="rounded-[18px] border border-[color:var(--accent)] bg-[color:var(--surface-soft)] p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={editAppointmentTitle}
                                onChange={(event) => setEditAppointmentTitle(event.target.value)}
                                placeholder="Title"
                                autoFocus
                                aria-label="Appointment title"
                                className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <input
                                type="date"
                                value={editAppointmentDate}
                                onChange={(event) => setEditAppointmentDate(event.target.value)}
                                aria-label="Appointment date"
                                className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                list="time-slot-suggestions"
                                value={editAppointmentTimeSlot}
                                onChange={(event) => setEditAppointmentTimeSlot(event.target.value)}
                                placeholder="H:MM"
                                aria-label="Appointment time"
                                className="min-w-0 flex-1 basis-[110px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1">
                                {(['AM', 'PM'] as const).map((meridiem) => (
                                  <button
                                    key={meridiem}
                                    type="button"
                                    onClick={() => setEditAppointmentTimeMeridiem(meridiem)}
                                    aria-pressed={editAppointmentTimeMeridiem === meridiem}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                      editAppointmentTimeMeridiem === meridiem
                                        ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                                        : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                                    }`}
                                  >
                                    {meridiem}
                                  </button>
                                ))}
                              </div>
                              <select
                                value={editAppointmentCategory}
                                onChange={(event) => setEditAppointmentCategory(event.target.value)}
                                aria-label="Appointment category"
                                className="min-w-0 flex-1 basis-[110px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              >
                                {APPOINTMENT_CATEGORIES.map((category) => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <input
                              value={editAppointmentLocation}
                              onChange={(event) => setEditAppointmentLocation(event.target.value)}
                              placeholder="Location (optional)"
                              aria-label="Appointment location"
                              className="mt-2 w-full rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditAppointment}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingAppointmentEdit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingAppointmentEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      if (deletingAppointmentId === appointment.id) {
                        return (
                          <div key={appointment.id} className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                            <p className="text-sm text-[color:var(--foreground)]">Delete &ldquo;{appointment.title}&rdquo;?</p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDeleteAppointment}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDeleteAppointment(appointment.id)}
                                disabled={isDeletingAppointment}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                {isDeletingAppointment ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={appointment.id}
                          className="flex items-start gap-3 overflow-hidden rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3"
                          style={{ borderLeft: `4px solid ${appointmentCategoryColors[appointment.category] ?? appointmentCategoryColors.Other}` }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                              {formatAppointmentDateLabel(appointment.appointment_date)} · {appointment.time_label}
                            </p>
                            <p className="mt-1 truncate text-sm font-semibold text-[color:var(--foreground)]">{appointment.title}</p>
                            {appointment.location ? (
                              <p className="mt-0.5 truncate text-xs text-[color:var(--muted)]">{appointment.location}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditAppointment(appointment)}
                              aria-label="Edit appointment"
                              className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                              onClick={() => handleStartDeleteAppointment(appointment.id)}
                              aria-label="Delete appointment"
                              className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

                <form
                  onSubmit={handleCreateAppointment}
                  className="mt-4 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={newAppointmentTitle}
                      onChange={(event) => setNewAppointmentTitle(event.target.value)}
                      placeholder="+ Add appointment"
                      aria-label="Appointment title"
                      className="min-w-0 flex-1 basis-[160px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSavingAppointment}
                      className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                    >
                      {isSavingAppointment ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={newAppointmentDate || todayKey}
                      onChange={(event) => setNewAppointmentDate(event.target.value)}
                      aria-label="Appointment date"
                      className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      list="time-slot-suggestions"
                      value={newAppointmentTimeSlot}
                      onChange={(event) => setNewAppointmentTimeSlot(event.target.value)}
                      placeholder="H:MM"
                      aria-label="Appointment time"
                      className="min-w-0 flex-1 basis-[110px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
                    <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1">
                      {(['AM', 'PM'] as const).map((meridiem) => (
                        <button
                          key={meridiem}
                          type="button"
                          onClick={() => setNewAppointmentTimeMeridiem(meridiem)}
                          aria-pressed={newAppointmentTimeMeridiem === meridiem}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            newAppointmentTimeMeridiem === meridiem
                              ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                              : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                          }`}
                        >
                          {meridiem}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={newAppointmentLocation}
                      onChange={(event) => setNewAppointmentLocation(event.target.value)}
                      placeholder="Location (optional)"
                      aria-label="Appointment location"
                      className="min-w-0 flex-1 basis-[160px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
                    <select
                      value={newAppointmentCategory}
                      onChange={(event) => setNewAppointmentCategory(event.target.value)}
                      aria-label="Appointment category"
                      className="min-w-0 flex-1 basis-[110px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    >
                      {APPOINTMENT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </form>
              </div>
              </DraggableWidget>
            </WidgetGrid>
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

            <EditLayoutControls layout={widgetLayout} />

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

            <WidgetGrid className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" order={widgetLayout.order} isEditing={widgetLayout.isEditing} onReorder={widgetLayout.moveWidget}>
              <DraggableWidget id="bmi" key="bmi">
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
                      <input
                        type="text"
                        inputMode="numeric"
                        list="time-slot-suggestions"
                        value={newWeightTimeSlot || defaultWeightTimeSlot.slot}
                        onChange={(event) => setNewWeightTimeSlot(event.target.value)}
                        placeholder="H:MM"
                        aria-label="Weigh-in time"
                        className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
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

                <div className="mt-6 border-t border-[color:var(--border)] pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Body Measurements</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5">
                        {(['day', 'week', 'month'] as const).map((period) => (
                          <button
                            key={period}
                            type="button"
                            onClick={() => setMeasurementHistoryFilter(period)}
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize transition ${
                              measurementHistoryFilter === period
                                ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                                : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                            }`}
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[color:var(--muted)]">
                        Date
                        <input
                          type="date"
                          value={measurementEntryDate || todayKey}
                          onChange={(event) => setMeasurementEntryDate(event.target.value)}
                          aria-label="Date to log measurements for"
                          className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-[10px] text-[color:var(--foreground)] outline-none"
                        />
                      </label>
                    </div>
                  </div>
                  {bodyMeasurementError ? <p className="mt-2 text-xs text-[color:var(--accent-strong)]">{bodyMeasurementError}</p> : null}
                  {isLoadingBodyMeasurements ? (
                    <p className="mt-3 text-xs text-[color:var(--muted)]">Loading measurements…</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {BODY_MEASUREMENT_ROWS.map((row) => (
                        <div
                          key={row.type}
                          className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2"
                        >
                          <p className="text-xs font-semibold text-[color:var(--foreground)]">{row.label}</p>
                          <div className={row.sides.length > 1 ? 'mt-1.5 flex flex-wrap items-center justify-between gap-2' : 'mt-1.5'}>
                            {row.sides.map((side) => renderMeasurementSlot(row.type, side))}
                          </div>
                          {row.sides.map((side) => renderMeasurementPanel(row.type, side))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
              </DraggableWidget>

              <DraggableWidget id="weightLog" key="weightLog">
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
                              <input
                                type="text"
                                inputMode="numeric"
                                list="time-slot-suggestions"
                                value={editWeightTimeSlot}
                                onChange={(event) => setEditWeightTimeSlot(event.target.value)}
                                placeholder="H:MM"
                                aria-label="Entry time"
                                className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
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
              </DraggableWidget>

              <DraggableWidget id="stepsLog" key="stepsLog">
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
              </DraggableWidget>

              <DraggableWidget id="waterIntake" key="waterIntake">
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
                      <span className="text-xs font-semibold text-[color:var(--muted)]">
                        {waterDisplayOz} of {waterDisplayGoal} oz
                      </span>
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
                    step="any"
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

                <div className="mt-3 max-h-[240px] space-y-3 overflow-y-auto pr-1">
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
              </DraggableWidget>

              <DraggableWidget id="sleep" key="sleep">
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

                <div className="mt-3 max-h-[160px] space-y-3 overflow-y-auto pr-1">
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
              </DraggableWidget>

              <DraggableWidget id="exercise" key="exercise">
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
              </DraggableWidget>
            </WidgetGrid>
          </main>
        ) : activeView === 'finances' ? (
          <main className="space-y-6">
            <section
              className="relative overflow-hidden rounded-[36px] border border-[color:var(--border)] p-6 shadow-[var(--shadow)]"
              style={{ background: 'linear-gradient(135deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
            >
              <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <ThemeOrb theme={theme} className="h-20 w-20 sm:h-28 sm:w-28 lg:h-[120px] lg:w-[120px]" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">Money</p>
                    <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                      Finances
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                      Log income and expenses to keep a gentle eye on your balance.
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

            <EditLayoutControls layout={widgetLayout} />

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

            <WidgetGrid className="grid gap-6 sm:grid-cols-2" order={widgetLayout.order} isEditing={widgetLayout.isEditing} onReorder={widgetLayout.moveWidget}>
              <DraggableWidget id="balance" key="balance">
              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Balance</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
                  </span>
                </div>

                <div className="mt-4 flex flex-col items-center gap-1 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Current balance</p>
                  <p
                    className="text-4xl font-semibold tracking-tight tabular-nums"
                    style={{ fontFamily: 'var(--font-display)', color: currentBalance >= 0 ? 'var(--foreground)' : '#dc2626' }}
                  >
                    {formatCurrency(currentBalance)}
                  </p>
                </div>

                <form
                  onSubmit={handleCreateTransaction}
                  className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={newTransactionDate || todayKey}
                      onChange={(event) => setNewTransactionDate(event.target.value)}
                      aria-label="Transaction date"
                      className="min-w-0 max-w-[160px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
                    <input
                      value={newTransactionDescription}
                      onChange={(event) => setNewTransactionDescription(event.target.value)}
                      placeholder="Description (optional)"
                      aria-label="Transaction description"
                      className="min-w-0 flex-1 basis-[180px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newTransactionAmount}
                      onChange={(event) => setNewTransactionAmount(event.target.value)}
                      placeholder="Amount"
                      aria-label="Transaction amount"
                      className="min-w-0 max-w-[130px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
                    <div className="flex shrink-0 items-center gap-1.5">
                      {(['income', 'expense'] as const).map((type) => {
                        const isActive = newTransactionType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleSelectTransactionType(type)}
                            aria-pressed={isActive}
                            className={`rounded-full border px-3 py-2 text-xs font-semibold capitalize transition ${
                              isActive
                                ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                                : 'border-[color:var(--border)] bg-white text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                            }`}
                          >
                            {type === 'income' ? 'Income' : 'Expense'}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="submit"
                      disabled={isSavingTransaction}
                      className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                    >
                      {isSavingTransaction ? 'Adding…' : 'Add'}
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={newTransactionCategory}
                      onChange={(event) => {
                        setNewTransactionCategory(event.target.value);
                        setNewTransactionSubcategory('');
                        setNewTransactionCustomSubcategory('');
                      }}
                      aria-label="Category"
                      className="min-w-0 flex-1 basis-[150px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    >
                      <option value="">Category (optional)</option>
                      {TRANSACTION_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {newTransactionCategory ? (
                      <select
                        value={newTransactionSubcategory}
                        onChange={(event) => setNewTransactionSubcategory(event.target.value)}
                        aria-label="Subcategory"
                        className="min-w-0 flex-1 basis-[150px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      >
                        <option value="">Subcategory (optional)</option>
                        {(transactionSubcategoryOptions[newTransactionCategory] ?? ['Other']).map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {newTransactionSubcategory === 'Other' ? (
                      <input
                        value={newTransactionCustomSubcategory}
                        onChange={(event) => setNewTransactionCustomSubcategory(event.target.value)}
                        placeholder="Custom subcategory"
                        aria-label="Custom subcategory"
                        className="min-w-0 flex-1 basis-[150px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                    ) : null}
                    <input
                      value={newTransactionVendor}
                      onChange={(event) => setNewTransactionVendor(event.target.value)}
                      placeholder="Vendor/place (optional)"
                      aria-label="Vendor or place"
                      className="min-w-0 flex-1 basis-[150px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />
                    {newTransactionCategory === 'Income' ? (
                      <input
                        value={newTransactionSenderName}
                        onChange={(event) => setNewTransactionSenderName(event.target.value)}
                        placeholder="From (sender name, optional)"
                        aria-label="From (sender name)"
                        className="min-w-0 flex-1 basis-[150px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                    ) : null}
                  </div>

                  {newTransactionCategory === 'Transportation' && newTransactionSubcategory === 'Gas' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={newTransactionPricePerGallon}
                        onChange={(event) => setNewTransactionPricePerGallon(event.target.value)}
                        placeholder="Price per gallon"
                        aria-label="Price per gallon"
                        className="min-w-0 flex-1 basis-[150px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={newTransactionGallons}
                        onChange={(event) => setNewTransactionGallons(event.target.value)}
                        placeholder="Gallons"
                        aria-label="Gallons"
                        className="min-w-0 flex-1 basis-[150px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                    </div>
                  ) : null}

                  <p className="mt-2 text-xs text-[color:var(--muted)]">Choose Income or Expense to set the sign automatically.</p>
                  {transactionError ? <p className="mt-2 text-xs font-medium text-red-500">{transactionError}</p> : null}
                </form>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['day', 'week', 'month'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setTransactionFilter(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          transactionFilter === period
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
                      onClick={() => setTransactionFilterAnchorDate((prev) => shiftAnchorDate(transactionFilter, prev, -1))}
                      aria-label={`Previous ${transactionFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatCompactPeriodLabel(transactionFilter, transactionFilterAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTransactionFilterAnchorDate((prev) => shiftAnchorDate(transactionFilter, prev, 1))}
                      aria-label={`Next ${transactionFilter}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div className="mt-3 max-h-[280px] space-y-3 overflow-y-auto pr-1">
                  {isLoadingTransactions ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      Loading your transactions…
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      {transactions.length === 0 ? 'No transactions yet.' : `No transactions this ${transactionFilter}.`}
                    </div>
                  ) : (
                    filteredTransactions.map((entry) => {
                      const hasDescription = entry.description.trim().length > 0;
                      const categoryLabel = entry.category
                        ? `${entry.category}${entry.subcategory ? ` · ${entry.subcategory}` : ''}`
                        : null;
                      const senderLabel = entry.sender_name ? `from ${entry.sender_name}` : null;
                      const identityTokens = [categoryLabel, senderLabel, entry.vendor].filter((token): token is string => Boolean(token));
                      const fallbackTitle = !hasDescription && identityTokens.length > 0 ? identityTokens[0] : null;
                      const displayTitle = hasDescription ? entry.description : fallbackTitle || 'Transaction';

                      if (editingTransactionId === entry.id) {
                        return (
                          <form
                            key={entry.id}
                            onSubmit={(event) => void handleSaveEditTransaction(event, entry.id)}
                            className="rounded-[20px] border border-[color:var(--accent)] bg-[color:var(--surface-soft)] p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={editTransactionDescription}
                                onChange={(event) => setEditTransactionDescription(event.target.value)}
                                placeholder="Description (optional)"
                                autoFocus
                                aria-label="Transaction description"
                                className="min-w-0 flex-1 basis-[160px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <input
                                type="date"
                                value={editTransactionDate}
                                onChange={(event) => setEditTransactionDate(event.target.value)}
                                aria-label="Transaction date"
                                className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                              <input
                                type="number"
                                step="0.01"
                                value={editTransactionAmount}
                                onChange={(event) => setEditTransactionAmount(event.target.value)}
                                placeholder="Amount"
                                aria-label="Transaction amount"
                                className="w-28 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                              />
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditTransaction}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingTransactionEdit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingTransactionEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      if (deletingTransactionId === entry.id) {
                        return (
                          <div key={entry.id} className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                            <p className="text-sm text-[color:var(--foreground)]">
                              Delete &ldquo;{displayTitle}&rdquo; from {formatShortDate(entry.transaction_date)}?
                            </p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDeleteTransaction}
                                className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDeleteTransaction(entry.id)}
                                disabled={isDeletingTransaction}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                {isDeletingTransaction ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const isPositive = entry.amount >= 0;
                      const isItemsExpanded = expandedTransactionId === entry.id;
                      const entryItems = transactionItems.filter((item) => item.transaction_id === entry.id);
                      const isGasTransaction = entry.category === 'Transportation' && entry.subcategory === 'Gas';
                      const hasItems = entryItems.length > 0;
                      const canExpand = isGasTransaction || hasItems;
                      const metaParts = [
                        formatShortDate(entry.transaction_date),
                        ...identityTokens.filter((token) => token !== fallbackTitle),
                      ].filter(Boolean);

                      return (
                        <div key={entry.id} className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{displayTitle}</p>
                              <p className="mt-0.5 truncate text-xs text-[color:var(--muted)]">{metaParts.join(' · ')}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className="text-sm font-semibold tabular-nums"
                                style={{ color: isPositive ? '#16a34a' : '#dc2626' }}
                              >
                                {isPositive ? '+' : ''}
                                {formatCurrency(entry.amount)}
                              </span>
                              {canExpand ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleExpandTransaction(entry)}
                                  aria-label={isItemsExpanded ? 'Collapse details' : 'Expand details'}
                                  aria-expanded={isItemsExpanded}
                                  className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                    className={`transition-transform ${isItemsExpanded ? 'rotate-180' : ''}`}
                                  >
                                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleStartEditTransaction(entry)}
                                aria-label="Edit transaction"
                                className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
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
                                onClick={() => handleStartDeleteTransaction(entry.id)}
                                aria-label="Delete transaction"
                                className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
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

                          {canExpand ? (
                            hasItems ? (
                              <p className="mt-2 text-xs font-semibold text-[color:var(--muted)]">
                                {entryItems.length} {entryItems.length === 1 ? 'item' : 'items'}
                              </p>
                            ) : null
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleExpandTransaction(entry)}
                              className="mt-2 text-xs font-semibold text-[color:var(--accent-strong)] transition hover:underline"
                            >
                              + Add item details
                            </button>
                          )}

                          {isItemsExpanded && isGasTransaction ? (
                            <div className="mt-2 space-y-2 border-t border-[color:var(--border)] pt-2">
                              {entry.price_per_gallon != null || entry.gallons != null ? (
                                <p className="text-xs font-medium text-[color:var(--foreground)]">
                                  {entry.price_per_gallon != null ? `${formatCurrency(entry.price_per_gallon)}/gal` : null}
                                  {entry.price_per_gallon != null && entry.gallons != null ? ' · ' : ''}
                                  {entry.gallons != null ? `${entry.gallons} gal` : null}
                                </p>
                              ) : (
                                <p className="text-xs text-[color:var(--muted)]">No gas details entered yet.</p>
                              )}

                              {gasDetailsError ? <p className="text-xs font-medium text-red-500">{gasDetailsError}</p> : null}

                              <form
                                onSubmit={(event) => void handleSaveGasDetails(event, entry.id)}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={gasPricePerGallonInput}
                                  onChange={(event) => setGasPricePerGallonInput(event.target.value)}
                                  placeholder="Price per gallon"
                                  aria-label="Price per gallon"
                                  className="min-w-0 flex-1 basis-[130px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs text-[color:var(--foreground)] outline-none"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={gasGallonsInput}
                                  onChange={(event) => setGasGallonsInput(event.target.value)}
                                  placeholder="Gallons"
                                  aria-label="Gallons"
                                  className="min-w-0 flex-1 basis-[110px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs text-[color:var(--foreground)] outline-none"
                                />
                                <button
                                  type="submit"
                                  disabled={isSavingGasDetails}
                                  className="shrink-0 rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                                >
                                  {isSavingGasDetails ? 'Saving…' : '+ Add item details'}
                                </button>
                              </form>
                            </div>
                          ) : null}

                          {isItemsExpanded && !isGasTransaction ? (
                            <div className="mt-2 space-y-2 border-t border-[color:var(--border)] pt-2">
                              {itemError ? <p className="text-xs font-medium text-red-500">{itemError}</p> : null}

                              <div className="max-h-[200px] space-y-2 overflow-y-auto pr-1">
                              {isLoadingTransactionItems ? (
                                <p className="text-xs text-[color:var(--muted)]">Loading items…</p>
                              ) : (
                                entryItems.map((item) => {
                                  if (editingItemId === item.id) {
                                    return (
                                      <form
                                        key={item.id}
                                        onSubmit={(event) => void handleSaveEditItem(event, item.id)}
                                        className="rounded-[14px] border border-[color:var(--accent)] bg-[color:var(--surface)] p-2"
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <input
                                            value={editItemName}
                                            onChange={(event) => setEditItemName(event.target.value)}
                                            placeholder="Item name"
                                            autoFocus
                                            aria-label="Item name"
                                            className="min-w-0 flex-1 basis-[120px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1.5 text-xs text-[color:var(--foreground)] outline-none"
                                          />
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={editItemPrice}
                                            onChange={(event) => setEditItemPrice(event.target.value)}
                                            placeholder="Price"
                                            aria-label="Item price"
                                            className="w-20 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1.5 text-xs text-[color:var(--foreground)] outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={handleCancelEditItem}
                                            className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="submit"
                                            disabled={isSavingItemEdit}
                                            className="rounded-full bg-[color:var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                                          >
                                            {isSavingItemEdit ? 'Saving…' : 'Save'}
                                          </button>
                                        </div>
                                      </form>
                                    );
                                  }

                                  if (deletingItemId === item.id) {
                                    return (
                                      <div key={item.id} className="rounded-[14px] bg-[color:var(--surface)] p-2">
                                        <p className="text-xs text-[color:var(--foreground)]">Delete &ldquo;{item.item_name}&rdquo;?</p>
                                        <div className="mt-1.5 flex justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={handleCancelDeleteItem}
                                            className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void handleConfirmDeleteItem(item.id)}
                                            disabled={isDeletingItem}
                                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition disabled:opacity-70"
                                            style={{ backgroundColor: '#dc2626' }}
                                          >
                                            {isDeletingItem ? 'Deleting…' : 'Delete'}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-[14px] bg-[color:var(--surface)] px-3 py-1.5">
                                      <span className="truncate text-xs font-medium text-[color:var(--foreground)]">{item.item_name}</span>
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        <span className="text-xs font-semibold tabular-nums text-[color:var(--foreground)]">
                                          {formatCurrency(item.item_total)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditItem(item)}
                                          aria-label="Edit item"
                                          className="rounded-full p-1 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                                          onClick={() => handleStartDeleteItem(item.id)}
                                          aria-label="Delete item"
                                          className="rounded-full p-1 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

                              <form
                                onSubmit={(event) => void handleCreateTransactionItem(event, entry.id)}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <input
                                  value={newItemName}
                                  onChange={(event) => setNewItemName(event.target.value)}
                                  placeholder="Item name"
                                  aria-label="New item name"
                                  className="min-w-0 flex-1 basis-[120px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs text-[color:var(--foreground)] outline-none"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newItemPrice}
                                  onChange={(event) => setNewItemPrice(event.target.value)}
                                  placeholder="Price"
                                  aria-label="New item price"
                                  className="w-20 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs text-[color:var(--foreground)] outline-none"
                                />
                                <button
                                  type="submit"
                                  disabled={isSavingItem}
                                  className="shrink-0 rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                                >
                                  {isSavingItem ? 'Adding…' : '+ Add item'}
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
              </DraggableWidget>

              <DraggableWidget id="creditCards" key="creditCards">
              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Credit Cards</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {creditCards.length} {creditCards.length === 1 ? 'card' : 'cards'}
                  </span>
                </div>

                {creditCardError ? <p className="mt-3 text-xs font-medium text-red-500">{creditCardError}</p> : null}

                <div className="mt-4 space-y-3">
                  {isLoadingCreditCards ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      Loading your cards…
                    </div>
                  ) : creditCards.length === 0 ? (
                    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      No cards yet — add your first one below.
                    </div>
                  ) : (
                    creditCards.map((card, index) => {
                      const isExpanded = expandedCardId === card.id;
                      const isEditingCard = editingCardId === card.id;
                      const charges = cardCharges.filter((row) => row.card_id === card.id);
                      const cardBalance = charges.reduce((sum, row) => sum + row.amount, 0);
                      const usagePercent =
                        card.credit_limit > 0 ? Math.min(100, Math.max(0, (cardBalance / card.credit_limit) * 100)) : 0;
                      const activeColorId = isEditingCard ? editCardColor : card.card_color;
                      const gradient =
                        cardColorOptions.find((option) => option.id === activeColorId) ??
                        cardColorOptions[index % cardColorOptions.length];
                      const isDueSoon = card.due_day != null && isDueDaySoon(card.due_day, now.getDate(), getDaysInMonth(now));

                      return (
                        <div key={card.id} className="overflow-hidden rounded-[24px] shadow-[var(--shadow-soft)]">
                          <div
                            className="p-4 text-white transition"
                            style={{ background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)` }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleExpandCard(card.id)}
                                aria-expanded={isExpanded}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <span className="truncate text-sm font-semibold">{card.card_name}</span>
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  aria-hidden="true"
                                  className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                >
                                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditCard(card)}
                                aria-label="Edit card"
                                className="shrink-0 rounded-full p-1.5 text-white/90 transition hover:bg-white/20"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                            <div className="mt-3 flex items-end justify-between gap-2">
                              <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
                                {formatCurrency(cardBalance)}
                              </p>
                              <div className="text-right">
                                <p className="text-xs font-medium text-white/85">of {formatCurrency(card.credit_limit)}</p>
                                {card.due_day != null ? (
                                  <p className={`text-xs font-semibold ${isDueSoon ? 'text-amber-200' : 'text-white/85'}`}>
                                    Due on the {formatOrdinalDay(card.due_day)}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/30">
                              <div className="h-1.5 rounded-full bg-white transition-[width]" style={{ width: `${usagePercent}%` }} />
                            </div>
                          </div>

                          {isEditingCard ? (
                            <form
                              onSubmit={(event) => void handleSaveEditCard(event, card.id)}
                              className="rounded-b-[24px] border border-t-0 border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  value={editCardName}
                                  onChange={(event) => setEditCardName(event.target.value)}
                                  placeholder="Card name"
                                  autoFocus
                                  aria-label="Card name"
                                  className="min-w-0 flex-1 basis-[150px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editCardLimit}
                                  onChange={(event) => setEditCardLimit(event.target.value)}
                                  placeholder="Credit limit"
                                  aria-label="Credit limit"
                                  className="min-w-0 max-w-[130px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                />
                                <input
                                  type="number"
                                  min="1"
                                  max="31"
                                  step="1"
                                  value={editCardDueDay}
                                  onChange={(event) => setEditCardDueDay(event.target.value)}
                                  placeholder="Due day"
                                  aria-label="Due day"
                                  className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                />
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Color</span>
                                {cardColorOptions.map((option) => {
                                  const isActive = editCardColor === option.id;
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      aria-label={`Use ${option.label} color`}
                                      onClick={() => setEditCardColor(option.id)}
                                      className={`h-6 w-6 rounded-full border transition ${
                                        isActive ? 'scale-110 border-[color:var(--foreground)]' : 'border-[color:var(--border)]'
                                      }`}
                                      style={{ backgroundColor: option.swatch }}
                                    />
                                  );
                                })}
                              </div>

                              {creditCardError ? <p className="mt-2 text-xs font-medium text-red-500">{creditCardError}</p> : null}

                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelEditCard}
                                  className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={isSavingCardEdit}
                                  className="rounded-full bg-[color:var(--accent)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                                >
                                  {isSavingCardEdit ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </form>
                          ) : isExpanded ? (
                            <div className="rounded-b-[24px] border border-t-0 border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
                              <form onSubmit={(event) => void handleCreateCharge(event, card.id)} className="flex flex-wrap items-center gap-2">
                                <input
                                  type="date"
                                  value={newChargeDate || todayKey}
                                  onChange={(event) => setNewChargeDate(event.target.value)}
                                  aria-label="Charge date"
                                  className="min-w-0 max-w-[150px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                />
                                <input
                                  value={newChargeDescription}
                                  onChange={(event) => setNewChargeDescription(event.target.value)}
                                  placeholder="Description"
                                  aria-label="Charge description"
                                  className="min-w-0 flex-1 basis-[150px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  value={newChargeAmount}
                                  onChange={(event) => setNewChargeAmount(event.target.value)}
                                  placeholder="Amount"
                                  aria-label="Charge amount"
                                  className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                />
                                <button
                                  type="submit"
                                  disabled={isSavingCharge}
                                  className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                                >
                                  {isSavingCharge ? 'Adding…' : 'Add'}
                                </button>
                              </form>

                              {chargeError ? <p className="mt-2 text-xs font-medium text-red-500">{chargeError}</p> : null}

                              <div className="mt-3 space-y-2">
                                {isLoadingCardCharges ? (
                                  <p className="text-xs text-[color:var(--muted)]">Loading charges…</p>
                                ) : charges.length === 0 ? (
                                  <p className="text-xs text-[color:var(--muted)]">No charges logged yet.</p>
                                ) : (
                                  charges.map((entry) => {
                                    if (editingChargeId === entry.id) {
                                      return (
                                        <form
                                          key={entry.id}
                                          onSubmit={(event) => void handleSaveEditCharge(event, entry.id)}
                                          className="rounded-[18px] border border-[color:var(--accent)] bg-[color:var(--surface)] p-3"
                                        >
                                          <div className="flex flex-wrap items-center gap-2">
                                            <input
                                              value={editChargeDescription}
                                              onChange={(event) => setEditChargeDescription(event.target.value)}
                                              placeholder="Description"
                                              autoFocus
                                              aria-label="Charge description"
                                              className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                            />
                                            <input
                                              type="date"
                                              value={editChargeDate}
                                              onChange={(event) => setEditChargeDate(event.target.value)}
                                              aria-label="Charge date"
                                              className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                            />
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={editChargeAmount}
                                              onChange={(event) => setEditChargeAmount(event.target.value)}
                                              placeholder="Amount"
                                              aria-label="Charge amount"
                                              className="w-24 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                            />
                                          </div>
                                          <div className="mt-2 flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={handleCancelEditCharge}
                                              className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="submit"
                                              disabled={isSavingChargeEdit}
                                              className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                                            >
                                              {isSavingChargeEdit ? 'Saving…' : 'Save'}
                                            </button>
                                          </div>
                                        </form>
                                      );
                                    }

                                    if (deletingChargeId === entry.id) {
                                      return (
                                        <div key={entry.id} className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
                                          <p className="text-sm text-[color:var(--foreground)]">
                                            Delete &ldquo;{entry.description}&rdquo; from {formatShortDate(entry.charge_date)}?
                                          </p>
                                          <div className="mt-2 flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={handleCancelDeleteCharge}
                                              className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void handleConfirmDeleteCharge(entry.id)}
                                              disabled={isDeletingCharge}
                                              className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                              style={{ backgroundColor: '#dc2626' }}
                                            >
                                              {isDeletingCharge ? 'Deleting…' : 'Delete'}
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    }

                                    const isPositive = entry.amount >= 0;

                                    return (
                                      <div
                                        key={entry.id}
                                        className="flex items-center justify-between gap-3 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{entry.description}</p>
                                          <p className="mt-0.5 text-xs text-[color:var(--muted)]">{formatShortDate(entry.charge_date)}</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                          <span
                                            className="text-sm font-semibold tabular-nums"
                                            style={{ color: isPositive ? '#dc2626' : '#16a34a' }}
                                          >
                                            {isPositive ? '+' : ''}
                                            {formatCurrency(entry.amount)}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleStartEditCharge(entry)}
                                            aria-label="Edit charge"
                                            className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                                          >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                                            onClick={() => handleStartDeleteCharge(entry.id)}
                                            aria-label="Delete charge"
                                            className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                                          >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>

                {showAddCardForm ? (
                  <form
                    onSubmit={handleCreateCreditCard}
                    className="mt-4 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={newCardName}
                        onChange={(event) => setNewCardName(event.target.value)}
                        placeholder="Card name"
                        aria-label="Card name"
                        className="min-w-0 flex-1 basis-[160px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newCardLimit}
                        onChange={(event) => setNewCardLimit(event.target.value)}
                        placeholder="Credit limit"
                        aria-label="Credit limit"
                        className="min-w-0 max-w-[140px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={newCardDueDay}
                        onChange={(event) => setNewCardDueDay(event.target.value)}
                        placeholder="Due day"
                        aria-label="Due day"
                        className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Color</span>
                      {cardColorOptions.map((option) => {
                        const isActive = newCardColor === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-label={`Use ${option.label} color`}
                            onClick={() => setNewCardColor(option.id)}
                            className={`h-6 w-6 rounded-full border transition ${
                              isActive ? 'scale-110 border-[color:var(--foreground)]' : 'border-[color:var(--border)]'
                            }`}
                            style={{ backgroundColor: option.swatch }}
                          />
                        );
                      })}
                    </div>

                    <div
                      className="mt-3 rounded-[16px] p-3 text-sm font-semibold text-white transition"
                      style={{
                        background: `linear-gradient(135deg, ${
                          (cardColorOptions.find((option) => option.id === newCardColor) ?? cardColorOptions[0]).from
                        } 0%, ${(cardColorOptions.find((option) => option.id === newCardColor) ?? cardColorOptions[0]).to} 100%)`,
                      }}
                    >
                      {newCardName.trim() || 'Card preview'}
                    </div>

                    {creditCardError ? <p className="mt-2 text-xs font-medium text-red-500">{creditCardError}</p> : null}

                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddCardForm(false)}
                        className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingCreditCard}
                        className="rounded-full bg-[color:var(--accent)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                      >
                        {isSavingCreditCard ? 'Adding…' : 'Add card'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddCardForm(true)}
                    className="mt-4 w-full rounded-full border border-dashed border-[color:var(--border)] py-2 text-sm font-semibold text-[color:var(--accent-strong)] transition hover:bg-[color:var(--surface-strong)]"
                  >
                    + Add another card
                  </button>
                )}
              </section>
              </DraggableWidget>

              <DraggableWidget id="subscriptions" key="subscriptions">
              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">📺 Subscriptions</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {formatCurrency(subscriptionMonthlyTotal)}/mo · {formatCurrency(subscriptionYearlyTotal)}/yr
                  </span>
                </div>

                {subscriptionError ? <p className="mt-3 text-xs font-medium text-red-500">{subscriptionError}</p> : null}

                <div className="mt-4 grid grid-cols-2 items-start gap-3">
                  {isLoadingSubscriptions ? (
                    <div className="col-span-2 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
                      Loading your subscriptions…
                    </div>
                  ) : (
                    subscriptions.map((subscription, index) => {
                      const isActive = activeSubscriptionId === subscription.id;
                      const isEditingSubscription = editingSubscriptionId === subscription.id;
                      const isDeletingThisSubscription = deletingSubscriptionId === subscription.id;
                      const activeColorId = isEditingSubscription ? editSubscriptionColor : subscription.card_color;
                      const gradient =
                        cardColorOptions.find((option) => option.id === activeColorId) ??
                        cardColorOptions[index % cardColorOptions.length];
                      const nextRenewal = getNextSubscriptionRenewal(subscription, now);

                      return (
                        <div key={subscription.id} className="overflow-hidden rounded-[24px] shadow-[var(--shadow-soft)]">
                          <button
                            type="button"
                            onClick={() => handleToggleActiveSubscription(subscription.id)}
                            aria-expanded={isActive}
                            className="w-full p-4 text-left text-white transition"
                            style={{ background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)` }}
                          >
                            <p className="truncate text-sm font-semibold">{subscription.subscription_name}</p>
                            <p className="mt-2 text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
                              {formatCurrency(subscription.amount)}
                              <span className="ml-1 text-xs font-medium text-white/80">
                                /{subscriptionCycleAbbreviation(subscription.billing_cycle)}
                              </span>
                            </p>
                            {nextRenewal ? (
                              <p className="mt-1 text-xs font-medium text-white/85">Renews {formatShortDate(toDateKey(nextRenewal))}</p>
                            ) : null}
                          </button>

                          {isEditingSubscription ? (
                            <form
                              onSubmit={(event) => void handleSaveEditSubscription(event, subscription.id)}
                              className="rounded-b-[24px] border border-t-0 border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  value={editSubscriptionName}
                                  onChange={(event) => setEditSubscriptionName(event.target.value)}
                                  placeholder="Subscription name"
                                  autoFocus
                                  aria-label="Subscription name"
                                  className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editSubscriptionAmount}
                                  onChange={(event) => setEditSubscriptionAmount(event.target.value)}
                                  placeholder="Amount"
                                  aria-label="Amount"
                                  className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                />
                                <select
                                  value={editSubscriptionCycle}
                                  onChange={(event) => setEditSubscriptionCycle(event.target.value as SubscriptionBillingCycle)}
                                  aria-label="Billing cycle"
                                  className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                >
                                  {SUBSCRIPTION_BILLING_CYCLES.map((cycle) => (
                                    <option key={cycle} value={cycle}>
                                      {cycle}
                                    </option>
                                  ))}
                                </select>
                                {editSubscriptionCycle === 'Weekly' ? (
                                  <select
                                    value={editSubscriptionRenewalWeekday}
                                    onChange={(event) => setEditSubscriptionRenewalWeekday(event.target.value)}
                                    aria-label="Renewal day of week"
                                    className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                  >
                                    {SUBSCRIPTION_WEEKDAYS.map((label, weekdayIndex) => (
                                      <option key={label} value={weekdayIndex}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <>
                                    {editSubscriptionCycle === 'Yearly' ? (
                                      <select
                                        value={editSubscriptionRenewalMonth}
                                        onChange={(event) => setEditSubscriptionRenewalMonth(event.target.value)}
                                        aria-label="Renewal month"
                                        className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                      >
                                        {monthNamesShort.map((label, monthIndex) => (
                                          <option key={label} value={monthIndex + 1}>
                                            {label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : null}
                                    <input
                                      type="number"
                                      min="1"
                                      max="31"
                                      step="1"
                                      value={editSubscriptionRenewalDay}
                                      onChange={(event) => setEditSubscriptionRenewalDay(event.target.value)}
                                      placeholder="Renewal day"
                                      aria-label="Renewal day"
                                      className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                                    />
                                  </>
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Color</span>
                                {cardColorOptions.map((option) => {
                                  const isColorActive = editSubscriptionColor === option.id;
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      aria-label={`Use ${option.label} color`}
                                      onClick={() => setEditSubscriptionColor(option.id)}
                                      className={`h-6 w-6 rounded-full border transition ${
                                        isColorActive ? 'scale-110 border-[color:var(--foreground)]' : 'border-[color:var(--border)]'
                                      }`}
                                      style={{ backgroundColor: option.swatch }}
                                    />
                                  );
                                })}
                              </div>

                              {subscriptionError ? <p className="mt-2 text-xs font-medium text-red-500">{subscriptionError}</p> : null}

                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelEditSubscription}
                                  className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={isSavingSubscriptionEdit}
                                  className="rounded-full bg-[color:var(--accent)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                                >
                                  {isSavingSubscriptionEdit ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </form>
                          ) : isDeletingThisSubscription ? (
                            <div className="rounded-b-[24px] border border-t-0 border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                              <p className="text-sm text-[color:var(--foreground)]">Delete &ldquo;{subscription.subscription_name}&rdquo;?</p>
                              <div className="mt-2 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelDeleteSubscription}
                                  className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleConfirmDeleteSubscription(subscription.id)}
                                  disabled={isDeletingSubscription}
                                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                  style={{ backgroundColor: '#dc2626' }}
                                >
                                  {isDeletingSubscription ? 'Deleting…' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          ) : isActive ? (
                            <div className="flex items-center justify-end gap-1 rounded-b-[24px] border border-t-0 border-[color:var(--border)] bg-[color:var(--surface-soft)] p-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditSubscription(subscription)}
                                aria-label="Edit subscription"
                                className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                                onClick={() => handleStartDeleteSubscription(subscription.id)}
                                aria-label="Delete subscription"
                                className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                                </svg>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}

                  {!isLoadingSubscriptions && !showAddSubscriptionForm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSubscriptionError(null);
                        setShowAddSubscriptionForm(true);
                      }}
                      className="flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-[24px] border border-dashed border-[color:var(--border)] text-sm font-semibold text-[color:var(--accent-strong)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      <span className="text-xl leading-none">+</span>
                      <span>Add</span>
                    </button>
                  ) : null}
                </div>

                {showAddSubscriptionForm ? (
                  <form
                    onSubmit={handleCreateSubscription}
                    className="mt-4 space-y-3 rounded-[24px] border border-dashed border-[color:var(--border)] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={newSubscriptionName}
                        onChange={(event) => setNewSubscriptionName(event.target.value)}
                        placeholder="Subscription name"
                        autoFocus
                        aria-label="Subscription name"
                        className="min-w-0 flex-1 basis-[140px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newSubscriptionAmount}
                        onChange={(event) => setNewSubscriptionAmount(event.target.value)}
                        placeholder="Amount"
                        aria-label="Amount"
                        className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <select
                        value={newSubscriptionCycle}
                        onChange={(event) => setNewSubscriptionCycle(event.target.value as SubscriptionBillingCycle)}
                        aria-label="Billing cycle"
                        className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      >
                        {SUBSCRIPTION_BILLING_CYCLES.map((cycle) => (
                          <option key={cycle} value={cycle}>
                            {cycle}
                          </option>
                        ))}
                      </select>
                      {newSubscriptionCycle === 'Weekly' ? (
                        <select
                          value={newSubscriptionRenewalWeekday}
                          onChange={(event) => setNewSubscriptionRenewalWeekday(event.target.value)}
                          aria-label="Renewal day of week"
                          className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                        >
                          {SUBSCRIPTION_WEEKDAYS.map((label, weekdayIndex) => (
                            <option key={label} value={weekdayIndex}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          {newSubscriptionCycle === 'Yearly' ? (
                            <select
                              value={newSubscriptionRenewalMonth}
                              onChange={(event) => setNewSubscriptionRenewalMonth(event.target.value)}
                              aria-label="Renewal month"
                              className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                            >
                              {monthNamesShort.map((label, monthIndex) => (
                                <option key={label} value={monthIndex + 1}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <input
                            type="number"
                            min="1"
                            max="31"
                            step="1"
                            value={newSubscriptionRenewalDay}
                            onChange={(event) => setNewSubscriptionRenewalDay(event.target.value)}
                            placeholder="Renewal day"
                            aria-label="Renewal day"
                            className="min-w-0 max-w-[110px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                          />
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Color</span>
                      {cardColorOptions.map((option) => {
                        const isColorActive = newSubscriptionColor === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-label={`Use ${option.label} color`}
                            onClick={() => setNewSubscriptionColor(option.id)}
                            className={`h-6 w-6 rounded-full border transition ${
                              isColorActive ? 'scale-110 border-[color:var(--foreground)]' : 'border-[color:var(--border)]'
                            }`}
                            style={{ backgroundColor: option.swatch }}
                          />
                        );
                      })}
                    </div>

                    <div
                      className="rounded-[16px] p-3 text-sm font-semibold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${
                          (cardColorOptions.find((option) => option.id === newSubscriptionColor) ?? cardColorOptions[0]).from
                        } 0%, ${(cardColorOptions.find((option) => option.id === newSubscriptionColor) ?? cardColorOptions[0]).to} 100%)`,
                      }}
                    >
                      {newSubscriptionName.trim() || 'Subscription preview'}
                    </div>

                    {subscriptionError ? <p className="text-xs font-medium text-red-500">{subscriptionError}</p> : null}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddSubscriptionForm(false);
                          setSubscriptionError(null);
                        }}
                        className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingSubscription}
                        className="rounded-full bg-[color:var(--accent)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                      >
                        {isSavingSubscription ? 'Adding…' : 'Add subscription'}
                      </button>
                    </div>
                  </form>
                ) : null}
              </section>
              </DraggableWidget>

              <DraggableWidget id="loans" key="loans">
              <section className="rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden="true">🏦</span>
                    <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Loans</h3>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {loans.length} {loans.length === 1 ? 'loan' : 'loans'}
                  </span>
                </div>

                {loanError ? <p className="mt-3 text-xs font-medium text-red-500">{loanError}</p> : null}

                <div className="mt-4 space-y-3">
                  {isLoadingLoans ? (
                    <p className="text-sm text-[color:var(--muted)]">Loading your loans…</p>
                  ) : loans.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">No loans yet — add your first one below.</p>
                  ) : (
                    loans.map((loan) => {
                      if (editingLoanId === loan.id) {
                        return (
                          <form
                            key={loan.id}
                            onSubmit={(event) => void handleSaveEditLoan(event, loan.id)}
                            className="rounded-[20px] border border-[color:var(--accent)] bg-white p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={editLoanName}
                                onChange={(event) => setEditLoanName(event.target.value)}
                                placeholder="Loan name"
                                autoFocus
                                aria-label="Loan name"
                                className="min-w-0 flex-1 basis-[130px] rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editLoanOriginalAmount}
                                onChange={(event) => setEditLoanOriginalAmount(event.target.value)}
                                placeholder="Original amount"
                                aria-label="Original amount"
                                className="min-w-0 max-w-[130px] flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editLoanRemainingBalance}
                                onChange={(event) => setEditLoanRemainingBalance(event.target.value)}
                                placeholder="Remaining balance"
                                aria-label="Remaining balance"
                                className="min-w-0 max-w-[140px] flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editLoanMonthlyPayment}
                                onChange={(event) => setEditLoanMonthlyPayment(event.target.value)}
                                placeholder="Monthly payment"
                                aria-label="Monthly payment"
                                className="min-w-0 max-w-[130px] flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                              />
                              <input
                                type="number"
                                min="1"
                                max="31"
                                step="1"
                                value={editLoanDueDay}
                                onChange={(event) => setEditLoanDueDay(event.target.value)}
                                placeholder="Due day"
                                aria-label="Due day"
                                className="min-w-0 max-w-[100px] flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                              />
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditLoan}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingLoanEdit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingLoanEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      if (deletingLoanId === loan.id) {
                        return (
                          <div key={loan.id} className="rounded-[20px] bg-white p-3 shadow-[var(--shadow-soft)]">
                            <p className="text-sm text-slate-700">Delete &ldquo;{loan.loan_name}&rdquo;?</p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDeleteLoan}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDeleteLoan(loan.id)}
                                disabled={isDeletingLoan}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                {isDeletingLoan ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const percentPaid =
                        loan.original_amount > 0
                          ? Math.min(100, Math.max(0, ((loan.original_amount - loan.remaining_balance) / loan.original_amount) * 100))
                          : 0;

                      return (
                        <div key={loan.id} className="rounded-[20px] bg-white p-3 shadow-[var(--shadow-soft)]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-slate-700">
                              <span aria-hidden="true">🧾</span>
                              <span className="truncate">{loan.loan_name}</span>
                            </p>
                            <div className="flex shrink-0 items-center gap-1">
                              <p className="text-sm font-semibold tabular-nums text-slate-700">{formatCurrency(loan.remaining_balance)}</p>
                              <button
                                type="button"
                                onClick={() => handleStartEditLoan(loan)}
                                aria-label="Edit loan"
                                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                                onClick={() => handleStartDeleteLoan(loan.id)}
                                aria-label="Delete loan"
                                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-1.5 rounded-full transition-[width]"
                              style={{ width: `${percentPaid}%`, background: 'linear-gradient(90deg, #86e29b 0%, #2f9e56 100%)' }}
                            />
                          </div>
                          <p className="mt-1.5 text-xs text-slate-500">
                            {Math.round(percentPaid)}% paid off · {formatCurrency(loan.monthly_payment)}/mo
                            {loan.due_day != null ? ` · due the ${formatOrdinalDay(loan.due_day)}` : ''}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {showAddLoanForm ? (
                  <form
                    onSubmit={handleCreateLoan}
                    className="mt-4 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={newLoanName}
                        onChange={(event) => setNewLoanName(event.target.value)}
                        placeholder="Loan name"
                        aria-label="Loan name"
                        className="min-w-0 flex-1 basis-[130px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newLoanOriginalAmount}
                        onChange={(event) => setNewLoanOriginalAmount(event.target.value)}
                        placeholder="Original amount"
                        aria-label="Original amount"
                        className="min-w-0 max-w-[130px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newLoanRemainingBalance}
                        onChange={(event) => setNewLoanRemainingBalance(event.target.value)}
                        placeholder="Remaining balance"
                        aria-label="Remaining balance"
                        className="min-w-0 max-w-[140px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newLoanMonthlyPayment}
                        onChange={(event) => setNewLoanMonthlyPayment(event.target.value)}
                        placeholder="Monthly payment"
                        aria-label="Monthly payment"
                        className="min-w-0 max-w-[130px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={newLoanDueDay}
                        onChange={(event) => setNewLoanDueDay(event.target.value)}
                        placeholder="Due day"
                        aria-label="Due day"
                        className="min-w-0 max-w-[100px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddLoanForm(false)}
                        className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingLoan}
                        className="rounded-full bg-[color:var(--accent)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                      >
                        {isSavingLoan ? 'Adding…' : 'Add loan'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddLoanForm(true)}
                    className="mt-4 w-full rounded-full border border-dashed border-[color:var(--border)] py-2 text-sm font-semibold text-[color:var(--accent-strong)] transition hover:bg-[color:var(--surface-strong)]"
                  >
                    + Add loan
                  </button>
                )}
              </section>
              </DraggableWidget>

              <DraggableWidget id="savings" key="savings">
              <section className="rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden="true">🐷</span>
                    <h3 className="text-xl font-semibold text-[color:var(--foreground)]">Savings</h3>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {savingsGoals.length} {savingsGoals.length === 1 ? 'goal' : 'goals'}
                  </span>
                </div>

                {savingsGoalError ? <p className="mt-3 text-xs font-medium text-red-500">{savingsGoalError}</p> : null}

                <div className="mt-4 space-y-3">
                  {isLoadingSavingsGoals ? (
                    <p className="text-sm text-[color:var(--muted)]">Loading your goals…</p>
                  ) : savingsGoals.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">No goals yet — add your first one below.</p>
                  ) : (
                    savingsGoals.map((goal) => {
                      if (editingGoalId === goal.id) {
                        return (
                          <form
                            key={goal.id}
                            onSubmit={(event) => void handleSaveEditGoal(event, goal.id)}
                            className="rounded-[20px] border border-[color:var(--accent)] bg-white p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={editGoalName}
                                onChange={(event) => setEditGoalName(event.target.value)}
                                placeholder="Goal name"
                                autoFocus
                                aria-label="Goal name"
                                className="min-w-0 flex-1 basis-[130px] rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editGoalTargetAmount}
                                onChange={(event) => setEditGoalTargetAmount(event.target.value)}
                                placeholder="Target amount"
                                aria-label="Target amount"
                                className="min-w-0 max-w-[130px] flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editGoalCurrentAmount}
                                onChange={(event) => setEditGoalCurrentAmount(event.target.value)}
                                placeholder="Current amount"
                                aria-label="Current amount"
                                className="min-w-0 max-w-[130px] flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                              />
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditGoal}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingGoalEdit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingGoalEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      if (deletingGoalId === goal.id) {
                        return (
                          <div key={goal.id} className="rounded-[20px] bg-white p-3 shadow-[var(--shadow-soft)]">
                            <p className="text-sm text-slate-700">Delete &ldquo;{goal.goal_name}&rdquo;?</p>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelDeleteGoal}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleConfirmDeleteGoal(goal.id)}
                                disabled={isDeletingGoal}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-70"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                {isDeletingGoal ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (depositingGoalId === goal.id) {
                        return (
                          <form
                            key={goal.id}
                            onSubmit={(event) => void handleSaveDeposit(event, goal)}
                            className="rounded-[20px] border border-[color:var(--accent)] bg-white p-3"
                          >
                            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                              <span aria-hidden="true">🎯</span>
                              {goal.goal_name}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={depositAmount}
                                onChange={(event) => setDepositAmount(event.target.value)}
                                placeholder="Deposit amount"
                                autoFocus
                                aria-label="Deposit amount"
                                className="min-w-0 flex-1 basis-[140px] rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                              />
                              <button
                                type="button"
                                onClick={handleCancelDeposit}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSavingDeposit}
                                className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                              >
                                {isSavingDeposit ? 'Adding…' : 'Add deposit'}
                              </button>
                            </div>
                          </form>
                        );
                      }

                      const percent =
                        goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
                      const remaining = Math.max(0, goal.target_amount - goal.current_amount);

                      return (
                        <div key={goal.id} className="rounded-[20px] bg-white p-3 shadow-[var(--shadow-soft)]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-slate-700">
                              <span aria-hidden="true">🎯</span>
                              <span className="truncate">{goal.goal_name}</span>
                            </p>
                            <div className="flex shrink-0 items-center gap-1">
                              <p className="text-sm font-semibold tabular-nums text-slate-700">
                                {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleStartDeposit(goal.id)}
                                aria-label="Add deposit"
                                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                                  <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditGoal(goal)}
                                aria-label="Edit goal"
                                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                                onClick={() => handleStartDeleteGoal(goal.id)}
                                aria-label="Delete goal"
                                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-1.5 rounded-full transition-[width]"
                              style={{ width: `${percent}%`, background: 'linear-gradient(90deg, #ffb199 0%, #ff6f91 100%)' }}
                            />
                          </div>
                          <p className="mt-1.5 text-xs text-slate-500">
                            {percent}% there — {formatCurrency(remaining)} to go
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {showAddGoalForm ? (
                  <form
                    onSubmit={handleCreateSavingsGoal}
                    className="mt-4 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={newGoalName}
                        onChange={(event) => setNewGoalName(event.target.value)}
                        placeholder="Goal name"
                        aria-label="Goal name"
                        className="min-w-0 flex-1 basis-[130px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newGoalTargetAmount}
                        onChange={(event) => setNewGoalTargetAmount(event.target.value)}
                        placeholder="Target amount"
                        aria-label="Target amount"
                        className="min-w-0 max-w-[140px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newGoalCurrentAmount}
                        onChange={(event) => setNewGoalCurrentAmount(event.target.value)}
                        placeholder="Current amount"
                        aria-label="Current amount"
                        className="min-w-0 max-w-[140px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddGoalForm(false)}
                        className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingGoal}
                        className="rounded-full bg-[color:var(--accent)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                      >
                        {isSavingGoal ? 'Adding…' : 'Add goal'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddGoalForm(true)}
                    className="mt-4 w-full rounded-full border border-dashed border-[color:var(--border)] py-2 text-sm font-semibold text-[color:var(--accent-strong)] transition hover:bg-[color:var(--surface-strong)]"
                  >
                    + Add savings goal
                  </button>
                )}
              </section>
              </DraggableWidget>
            </WidgetGrid>
          </main>
        ) : activeView === 'projects' ? (
          <main className="space-y-6">
            <section
              className="relative overflow-hidden rounded-[36px] border border-[color:var(--border)] p-6 shadow-[var(--shadow)]"
              style={{ background: 'linear-gradient(135deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
            >
              <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <ThemeOrb theme={theme} className="h-20 w-20 sm:h-28 sm:w-28 lg:h-[120px] lg:w-[120px]" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">Focus</p>
                    <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                      Projects
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                      Track bigger projects and break them into small, satisfying steps.
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

            <EditLayoutControls layout={widgetLayout} />

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

            <WidgetGrid className="grid gap-6" order={widgetLayout.order} isEditing={widgetLayout.isEditing} onReorder={widgetLayout.moveWidget}>
              <DraggableWidget id="projects" key="projects">
              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                    Projects
                  </h3>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {activeProjects.length} {activeProjects.length === 1 ? 'project' : 'projects'}
                  </span>
                </div>

                {projectError ? <p className="mt-3 text-sm text-[#dc2626]">{projectError}</p> : null}

                {isLoadingProjects ? (
                  <p className="mt-4 text-sm text-[color:var(--muted)]">Loading projects…</p>
                ) : activeProjects.length === 0 ? (
                  <p className="mt-4 text-sm text-[color:var(--muted)]">No active projects — add one below to get started.</p>
                ) : (
                  <div className="mt-4 space-y-4">{activeProjects.map(renderProjectCard)}</div>
                )}

                <div className="mt-6 border-t border-[color:var(--border)] pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Completed Projects</h4>
                    <select
                      value={completedProjectsFilter}
                      onChange={(event) => setCompletedProjectsFilter(event.target.value)}
                      aria-label="Filter completed projects by month"
                      className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                    >
                      <option value="all">All</option>
                      {completedProjectMonthKeys.map((key) => (
                        <option key={key} value={key}>
                          {formatMonthYearLabel(key)}
                        </option>
                      ))}
                      {completedProjectsHaveNoDate ? <option value="no-date">No date</option> : null}
                    </select>
                  </div>

                  {completedProjects.length === 0 ? (
                    <p className="mt-3 text-sm text-[color:var(--muted)]">No completed projects yet.</p>
                  ) : filteredCompletedProjects.length === 0 ? (
                    <p className="mt-3 text-sm text-[color:var(--muted)]">No completed projects for that period.</p>
                  ) : (
                    <div className="mt-3 space-y-4">{filteredCompletedProjects.map(renderProjectCard)}</div>
                  )}
                </div>

                {showAddProjectForm ? (
                  <form onSubmit={handleCreateProject} className="mt-4 space-y-2 rounded-[24px] border border-dashed border-[color:var(--border)] p-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProjectIcon}
                        onChange={(event) => setNewProjectIcon(event.target.value)}
                        placeholder="🎯"
                        maxLength={4}
                        className="w-16 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-center text-sm outline-none focus:border-[color:var(--accent)]"
                      />
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(event) => setNewProjectName(event.target.value)}
                        placeholder="Project name"
                        autoFocus
                        className="flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <label className="min-w-[140px] flex-1 text-xs font-medium text-[color:var(--muted)]">
                        Start date
                        <input
                          type="date"
                          value={newProjectStartDate}
                          onChange={(event) => setNewProjectStartDate(event.target.value)}
                          className="mt-1 w-full rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                      </label>
                      <label className="min-w-[140px] flex-1 text-xs font-medium text-[color:var(--muted)]">
                        Finish date
                        <input
                          type="date"
                          value={newProjectFinishDate}
                          onChange={(event) => setNewProjectFinishDate(event.target.value)}
                          className="mt-1 w-full rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddProjectForm(false);
                          setNewProjectName('');
                          setNewProjectIcon('');
                          setNewProjectStartDate('');
                          setNewProjectFinishDate('');
                        }}
                        className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs font-semibold text-[color:var(--muted)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingProject || !newProjectName.trim()}
                        className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-[color:var(--accent-contrast)] disabled:opacity-70"
                      >
                        {isSavingProject ? 'Saving…' : 'Save project'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddProjectForm(true)}
                    className="mt-4 w-full rounded-[24px] border border-dashed border-[color:var(--border)] py-3 text-sm font-semibold text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                  >
                    + Add project
                  </button>
                )}
              </section>
              </DraggableWidget>
            </WidgetGrid>
          </main>
        ) : activeView === 'books' ? (
          <main className="space-y-6">
            <section
              className="relative overflow-hidden rounded-[36px] border border-[color:var(--border)] p-6 shadow-[var(--shadow)]"
              style={{ background: 'linear-gradient(135deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
            >
              <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <ThemeOrb theme={theme} className="h-20 w-20 sm:h-28 sm:w-28 lg:h-[120px] lg:w-[120px]" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">Reading</p>
                    <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                      Books
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                      Keep track of what you&apos;re reading, what&apos;s next, and what you&apos;ve finished.
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

            <EditLayoutControls layout={widgetLayout} />

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

            <WidgetGrid
              className="grid w-full max-w-[860px] grid-cols-1 gap-6 sm:grid-cols-[4fr_3fr]"
              order={widgetLayout.order}
              isEditing={widgetLayout.isEditing}
              onReorder={widgetLayout.moveWidget}
            >
              <DraggableWidget id="books" key="books">
              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                    Books
                  </h3>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {books.length} {books.length === 1 ? 'book' : 'books'}
                  </span>
                </div>

                {bookError ? <p className="mt-3 text-sm text-[#dc2626]">{bookError}</p> : null}

                {isLoadingBooks ? (
                  <p className="mt-4 text-sm text-[color:var(--muted)]">Loading books…</p>
                ) : (
                  <>
                    <div className="mt-5">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">📚 Currently Reading</h4>
                      {currentlyReadingBooks.length === 0 ? (
                        <p className="mt-3 text-sm text-[color:var(--muted)]">Nothing in progress — start a book below.</p>
                      ) : (
                        <div className="mt-3 space-y-3">{currentlyReadingBooks.map(renderBookRow)}</div>
                      )}
                    </div>

                    <div className="mt-6">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">✅ Finished</h4>
                      {finishedBooks.length === 0 ? (
                        <p className="mt-3 text-sm text-[color:var(--muted)]">No finished books yet.</p>
                      ) : (
                        <div className="mt-3 space-y-3">{finishedBooks.map(renderBookRow)}</div>
                      )}
                    </div>

                    <div className="mt-6">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Want to Read</h4>
                      {wantToReadBooks.length === 0 ? (
                        <p className="mt-3 text-sm text-[color:var(--muted)]">Your to-read list is empty.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {wantToReadBooks.map((book) => {
                            const isEditingThisBook = editingBookId === book.id;
                            const isDeletingThisBook = deletingBookId === book.id;
                            const isExpandedThisBook = expandedBookId === book.id;
                            if (isEditingThisBook || isDeletingThisBook || isExpandedThisBook) {
                              return renderBookRow(book);
                            }
                            const gradient = getBookGradient(book.id);
                            return (
                              <div
                                key={book.id}
                                className="flex items-start gap-3 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3"
                              >
                                <div
                                  className="h-28 w-20 shrink-0 overflow-hidden rounded-[14px]"
                                  style={
                                    book.cover_image_url
                                      ? undefined
                                      : { background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)` }
                                  }
                                >
                                  {book.cover_image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={book.cover_image_url} alt="" className="h-full w-full object-cover" />
                                  ) : null}
                                </div>
                                {book.description ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleExpandBook(book.id)}
                                    aria-expanded={isExpandedThisBook}
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{book.title}</p>
                                    {book.author ? <p className="truncate text-xs text-[color:var(--muted)]">{book.author}</p> : null}
                                    {book.genre ? (
                                      <span className="mt-1 inline-block rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--accent-strong)]">
                                        {book.genre}
                                      </span>
                                    ) : null}
                                    <p className="mt-1 truncate text-xs italic text-[color:var(--muted)]">{book.description}</p>
                                  </button>
                                ) : (
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{book.title}</p>
                                    {book.author ? <p className="truncate text-xs text-[color:var(--muted)]">{book.author}</p> : null}
                                    {book.genre ? (
                                      <span className="mt-1 inline-block rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--accent-strong)]">
                                        {book.genre}
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditBook(book)}
                                    aria-label="Edit book"
                                    className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                                    onClick={() => handleStartDeleteBook(book.id)}
                                    aria-label="Delete book"
                                    className="rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--accent-strong)]"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {showAddBookForm ? (
                  <form
                    onSubmit={handleCreateBook}
                    className="mt-6 space-y-2 rounded-[24px] border border-dashed border-[color:var(--border)] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={newBookTitle}
                        onChange={(event) => setNewBookTitle(event.target.value)}
                        placeholder="Title"
                        autoFocus
                        aria-label="Book title"
                        className="min-w-0 flex-1 basis-[160px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        value={newBookAuthor}
                        onChange={(event) => setNewBookAuthor(event.target.value)}
                        placeholder="Author (optional)"
                        aria-label="Author"
                        className="min-w-0 flex-1 basis-[160px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                      <input
                        value={newBookGenre}
                        onChange={(event) => setNewBookGenre(event.target.value)}
                        placeholder="Genre (optional)"
                        aria-label="Genre"
                        className="min-w-0 flex-1 basis-[160px] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      />
                    </div>

                    <textarea
                      value={newBookDescription}
                      onChange={(event) => setNewBookDescription(event.target.value)}
                      placeholder="Description (optional)"
                      aria-label="Description"
                      rows={3}
                      className="w-full resize-none rounded-[16px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Cover image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setNewBookCoverFile(event.target.files?.[0] ?? null)}
                        aria-label="Cover image"
                        className="min-w-0 flex-1 text-xs text-[color:var(--muted)] file:mr-2 file:rounded-full file:border-0 file:bg-[color:var(--accent-soft)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[color:var(--accent-strong)]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={newBookStatus}
                        onChange={(event) => setNewBookStatus(event.target.value as BookStatus)}
                        aria-label="Status"
                        className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                      >
                        {BOOK_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      {newBookStatus === 'Currently Reading' || newBookStatus === 'Finished' ? (
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={newBookTotalPages}
                          onChange={(event) => setNewBookTotalPages(event.target.value)}
                          placeholder="Total pages"
                          aria-label="Total pages"
                          className="min-w-0 max-w-[130px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                        />
                      ) : null}
                      {newBookStatus === 'Finished' ? (
                        <input
                          type="date"
                          value={newBookFinishedDate}
                          onChange={(event) => setNewBookFinishedDate(event.target.value)}
                          aria-label="Finished date"
                          className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                        />
                      ) : null}
                    </div>

                    {newBookStatus === 'Finished' ? (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewBookRating(star)}
                            aria-label={`Set rating to ${star} star${star === 1 ? '' : 's'}`}
                            className="text-[color:var(--accent)] transition hover:scale-110"
                          >
                            {renderStarIcon(star <= newBookRating)}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {bookError ? <p className="text-xs font-medium text-red-500">{bookError}</p> : null}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddBookForm(false);
                          setBookError(null);
                        }}
                        className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingBook}
                        className="rounded-full bg-[color:var(--accent)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
                      >
                        {isSavingBook ? 'Adding…' : 'Add book'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setBookError(null);
                      setShowAddBookForm(true);
                    }}
                    className="mt-6 w-full rounded-[24px] border border-dashed border-[color:var(--border)] py-3 text-sm font-semibold text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                  >
                    + Add book
                  </button>
                )}
              </section>
              </DraggableWidget>

              <DraggableWidget id="favoriteBooks" key="favoriteBooks">
              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                    Favorites
                  </h3>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {favoriteBooks.length} {favoriteBooks.length === 1 ? 'book' : 'books'}
                  </span>
                </div>

                {isLoadingBooks ? (
                  <p className="mt-4 text-sm text-[color:var(--muted)]">Loading favorites…</p>
                ) : favoriteBooks.length === 0 ? (
                  <p className="mt-4 text-sm text-[color:var(--muted)]">Rate a finished book 5 stars to see it here.</p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {favoriteBooks.map((book) => {
                      const gradient = getBookGradient(book.id);
                      return (
                        <div key={book.id} className="flex flex-col items-center gap-1.5 text-center">
                          <div
                            className="h-28 w-20 overflow-hidden rounded-[14px] shadow-[var(--shadow-soft)]"
                            style={
                              book.cover_image_url
                                ? undefined
                                : { background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)` }
                            }
                          >
                            {book.cover_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={book.cover_image_url} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <p className="w-full truncate text-xs font-semibold text-[color:var(--foreground)]">{book.title}</p>
                          {book.author ? (
                            <p className="w-full truncate text-[11px] text-[color:var(--muted)]">{book.author}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
              </DraggableWidget>
            </WidgetGrid>
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
                      Reports
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

            <EditLayoutControls layout={widgetLayout} />

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

            <WidgetGrid className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" order={widgetLayout.order} isEditing={widgetLayout.isEditing} onReorder={widgetLayout.moveWidget}>
              <DraggableWidget id="spendingByCategory" key="spendingByCategory" className="sm:col-span-2 xl:col-span-3">
              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Spending by category</p>
                  <h3 className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
                    Where your money goes
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1">
                  {(['day', 'week', 'month', 'year', 'all', 'custom'] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSpendingPeriod(period)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                        spendingPeriod === period
                          ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                          : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                      }`}
                    >
                      {period === 'custom' ? 'Custom range' : period}
                    </button>
                  ))}
                </div>

                <ChartTypeToggle value={spendingChartType} onChange={setSpendingChartType} options={SPENDING_CHART_TYPE_OPTIONS} />
              </div>

              {spendingPeriod === 'custom' ? (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <input
                    type="date"
                    value={spendingCustomStart}
                    onChange={(event) => setSpendingCustomStart(event.target.value)}
                    aria-label="Custom range start date"
                    className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  <span className="text-xs font-semibold text-[color:var(--muted)]">to</span>
                  <input
                    type="date"
                    value={spendingCustomEnd}
                    onChange={(event) => setSpendingCustomEnd(event.target.value)}
                    aria-label="Custom range end date"
                    className="min-w-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none"
                  />
                  {!spendingCustomStart || !spendingCustomEnd ? (
                    <span className="text-xs text-[color:var(--muted)]">Pick a start and end date to see spending.</span>
                  ) : null}
                </div>
              ) : spendingPeriod === 'all' ? null : (
                <div className="mt-5 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSpendingAnchorDate((prev) => shiftAnchorDate(spendingPeriod, prev, -1))}
                    aria-label="Previous period"
                    className="rounded-full px-2 py-1 text-sm text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                  >
                    ‹
                  </button>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{formatPeriodLabel(spendingPeriod, spendingAnchorDate)}</p>
                  <button
                    type="button"
                    onClick={() => setSpendingAnchorDate((prev) => shiftAnchorDate(spendingPeriod, prev, 1))}
                    aria-label="Next period"
                    className="rounded-full px-2 py-1 text-sm text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                  >
                    ›
                  </button>
                </div>
              )}

              <div className="relative mt-6 h-[340px]">
                <canvas
                  ref={spendingChartCanvasRef}
                  aria-label={
                    spendingChartType === 'pie'
                      ? 'Pie chart of spending by category'
                      : `${spendingChartType === 'bar-horizontal' ? 'Horizontal' : 'Vertical'} bar chart of spending by category`
                  }
                  role="img"
                />
              </div>
            </section>
              </DraggableWidget>

              <DraggableWidget id="incomeTracker" key="incomeTracker">
              <section className="rounded-[34px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {widgetIcons[theme]}
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Income Tracker</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    {formatCurrency(incomeTrendTotal)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['day', 'week', 'month', 'year', 'all'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setIncomeTrendPeriod(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          incomeTrendPeriod === period
                            ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                  <ChartTypeToggle value={incomeChartType} onChange={setIncomeChartType} options={INCOME_CHART_TYPE_OPTIONS} />
                </div>

                {incomeTrendPeriod === 'all' ? null : (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIncomeTrendAnchorDate((prev) => shiftAnchorDate(incomeTrendPeriod, prev, -1))}
                      aria-label={`Previous ${incomeTrendPeriod}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatPeriodLabel(incomeTrendPeriod, incomeTrendAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIncomeTrendAnchorDate((prev) => shiftAnchorDate(incomeTrendPeriod, prev, 1))}
                      aria-label={`Next ${incomeTrendPeriod}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                )}

                <div className="mt-3 flex flex-col items-center gap-2">
                  {incomeChartType === 'pie' ? (
                    incomeBySource.length === 0 ? (
                      <p className="text-sm text-[color:var(--muted)]">
                        {incomeTrendPeriod === 'all' ? 'No income logged yet.' : `No income this ${incomeTrendPeriod}.`}
                      </p>
                    ) : (
                      <div className="relative mt-1 h-[280px] w-full">
                        <canvas ref={incomeSourceChartCanvasRef} aria-label="Pie chart of income by source" role="img" />
                      </div>
                    )
                  ) : incomeTrendHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">Log income transactions on the Finances page to start tracking your trend.</p>
                  ) : filteredIncomeTrendHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">No income this {incomeTrendPeriod}.</p>
                  ) : (
                    <>
                      <TrendChartCanvas
                        history={filteredIncomeTrendHistory}
                        type={incomeChartType}
                        accent={themePalettes[theme].accent}
                        accentStrong={themePalettes[theme].accentStrong}
                        muted={themePalettes[theme].muted}
                        border={themePalettes[theme].border}
                        formatValue={(value) => formatCurrency(value)}
                        formatDateLabel={(dayKey) => formatTrendDateLabel(dayKey, historySpansMultipleYears(filteredIncomeTrendHistory))}
                      />
                      {filteredIncomeTrendHistory.length === 1 ? (
                        <p className="text-xs text-[color:var(--muted)]">Log another income transaction to see more of your trend.</p>
                      ) : null}
                    </>
                  )}
                </div>
              </section>
              </DraggableWidget>

              <DraggableWidget id="weightTrend" key="weightTrend">
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

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['day', 'week', 'month', 'year', 'all'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setWeightTrendPeriod(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          weightTrendPeriod === period
                            ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                  <ChartTypeToggle value={weightChartType} onChange={setWeightChartType} options={TREND_CHART_TYPE_OPTIONS} />
                </div>

                {weightTrendPeriod === 'all' ? null : (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => setWeightTrendAnchorDate((prev) => shiftAnchorDate(weightTrendPeriod, prev, -1))}
                      aria-label={`Previous ${weightTrendPeriod}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatPeriodLabel(weightTrendPeriod, weightTrendAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWeightTrendAnchorDate((prev) => shiftAnchorDate(weightTrendPeriod, prev, 1))}
                      aria-label={`Next ${weightTrendPeriod}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                )}

                <div className="mt-3 flex flex-col items-center gap-2">
                  {weightHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">Log a weigh-in on the Health &amp; Fitness page to start tracking your trend.</p>
                  ) : filteredWeightTrendHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">No weight entries this {weightTrendPeriod}.</p>
                  ) : (
                    <>
                      <TrendChartCanvas
                        history={filteredWeightTrendHistory}
                        type={weightChartType}
                        accent={themePalettes[theme].accent}
                        accentStrong={themePalettes[theme].accentStrong}
                        muted={themePalettes[theme].muted}
                        border={themePalettes[theme].border}
                        formatValue={(value) => `${value} lbs`}
                        formatDateLabel={(dayKey) => formatTrendDateLabel(dayKey, historySpansMultipleYears(filteredWeightTrendHistory))}
                      />
                      {filteredWeightTrendHistory.length === 1 ? (
                        <p className="text-xs text-[color:var(--muted)]">Log another weigh-in to see more of your trend.</p>
                      ) : null}
                    </>
                  )}
                </div>
              </section>
              </DraggableWidget>

              <DraggableWidget id="stepsTrend" key="stepsTrend">
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

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['day', 'week', 'month', 'year', 'all'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setStepsTrendPeriod(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          stepsTrendPeriod === period
                            ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                  <ChartTypeToggle value={stepsChartType} onChange={setStepsChartType} options={TREND_CHART_TYPE_OPTIONS} />
                </div>

                {stepsTrendPeriod === 'all' ? null : (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => setStepsTrendAnchorDate((prev) => shiftAnchorDate(stepsTrendPeriod, prev, -1))}
                      aria-label={`Previous ${stepsTrendPeriod}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatPeriodLabel(stepsTrendPeriod, stepsTrendAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStepsTrendAnchorDate((prev) => shiftAnchorDate(stepsTrendPeriod, prev, 1))}
                      aria-label={`Next ${stepsTrendPeriod}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                )}

                <div className="mt-3 flex flex-col items-center gap-2">
                  {stepsHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">Log your steps on the Health &amp; Fitness page to start tracking your trend.</p>
                  ) : filteredStepsTrendHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">No step entries this {stepsTrendPeriod}.</p>
                  ) : (
                    <>
                      <TrendChartCanvas
                        history={filteredStepsTrendHistory}
                        type={stepsChartType}
                        goalValue={STEPS_GOAL}
                        accent={themePalettes[theme].accent}
                        accentStrong={themePalettes[theme].accentStrong}
                        muted={themePalettes[theme].muted}
                        border={themePalettes[theme].border}
                        formatValue={formatStepsCount}
                        formatDateLabel={(dayKey) => formatTrendDateLabel(dayKey, historySpansMultipleYears(filteredStepsTrendHistory))}
                      />
                      {filteredStepsTrendHistory.length === 1 ? (
                        <p className="text-xs text-[color:var(--muted)]">Log another day to see more of your trend.</p>
                      ) : null}
                    </>
                  )}
                </div>
              </section>
              </DraggableWidget>

              <DraggableWidget id="waterTrend" key="waterTrend">
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

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['day', 'week', 'month', 'year', 'all'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setWaterTrendPeriod(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          waterTrendPeriod === period
                            ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                  <ChartTypeToggle value={waterChartType} onChange={setWaterChartType} options={TREND_CHART_TYPE_OPTIONS} />
                </div>

                {waterTrendPeriod === 'all' ? null : (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => setWaterTrendAnchorDate((prev) => shiftAnchorDate(waterTrendPeriod, prev, -1))}
                      aria-label={`Previous ${waterTrendPeriod}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatPeriodLabel(waterTrendPeriod, waterTrendAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWaterTrendAnchorDate((prev) => shiftAnchorDate(waterTrendPeriod, prev, 1))}
                      aria-label={`Next ${waterTrendPeriod}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                )}

                <div className="mt-3 flex flex-col items-center gap-2">
                  {waterHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">Log your water on the Health &amp; Fitness page to start tracking your trend.</p>
                  ) : filteredWaterTrendHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">No water entries this {waterTrendPeriod}.</p>
                  ) : (
                    <>
                      <TrendChartCanvas
                        history={filteredWaterTrendHistory}
                        type={waterChartType}
                        goalValue={waterGoal}
                        accent={themePalettes[theme].accent}
                        accentStrong={themePalettes[theme].accentStrong}
                        muted={themePalettes[theme].muted}
                        border={themePalettes[theme].border}
                        formatValue={(value) => `${value} oz`}
                        formatDateLabel={(dayKey) => formatTrendDateLabel(dayKey, historySpansMultipleYears(filteredWaterTrendHistory))}
                      />
                      {filteredWaterTrendHistory.length === 1 ? (
                        <p className="text-xs text-[color:var(--muted)]">Log another day to see more of your trend.</p>
                      ) : null}
                    </>
                  )}
                </div>
              </section>
              </DraggableWidget>

              <DraggableWidget id="sleepTrend" key="sleepTrend">
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

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-0.5 w-fit">
                    {(['day', 'week', 'month', 'year', 'all'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSleepTrendPeriod(period)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                          sleepTrendPeriod === period
                            ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                  <ChartTypeToggle value={sleepChartType} onChange={setSleepChartType} options={TREND_CHART_TYPE_OPTIONS} />
                </div>

                {sleepTrendPeriod === 'all' ? null : (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSleepTrendAnchorDate((prev) => shiftAnchorDate(sleepTrendPeriod, prev, -1))}
                      aria-label={`Previous ${sleepTrendPeriod}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-[color:var(--foreground)]">
                      {formatPeriodLabel(sleepTrendPeriod, sleepTrendAnchorDate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSleepTrendAnchorDate((prev) => shiftAnchorDate(sleepTrendPeriod, prev, 1))}
                      aria-label={`Next ${sleepTrendPeriod}`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)]"
                    >
                      ›
                    </button>
                  </div>
                )}

                <div className="mt-3 flex flex-col items-center gap-2">
                  {sleepHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">Log your sleep on the Health &amp; Fitness page to start tracking your trend.</p>
                  ) : filteredSleepTrendHistory.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted)]">No sleep entries this {sleepTrendPeriod}.</p>
                  ) : (
                    <>
                      <TrendChartCanvas
                        history={filteredSleepTrendHistory}
                        type={sleepChartType}
                        goalValue={SLEEP_GOAL}
                        accent={themePalettes[theme].accent}
                        accentStrong={themePalettes[theme].accentStrong}
                        muted={themePalettes[theme].muted}
                        border={themePalettes[theme].border}
                        formatValue={formatSleepDuration}
                        formatDateLabel={(dayKey) => formatTrendDateLabel(dayKey, historySpansMultipleYears(filteredSleepTrendHistory))}
                      />
                      {filteredSleepTrendHistory.length === 1 ? (
                        <p className="text-xs text-[color:var(--muted)]">Log another day to see more of your trend.</p>
                      ) : null}
                    </>
                  )}
                </div>
              </section>
              </DraggableWidget>
            </WidgetGrid>
          </main>
        )}
      </div>
    </div>
  );
}
