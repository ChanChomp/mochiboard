'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import HackerTerminalModal from '@/components/hacker-terminal-modal';
import { supabase } from '@/lib/supabase';

type AuthMode = 'login' | 'signup';

type ThemeKey = 'peach' | 'strawberry' | 'matcha' | 'ube' | 'black-sesame';

type ThemeOption = {
  id: ThemeKey;
  label: string;
  swatch: string;
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
};

const themeOptions: ThemeOption[] = [
  { id: 'peach', label: 'Peach', swatch: '#d97a4d' },
  { id: 'strawberry', label: 'Strawberry', swatch: '#dd6f8f' },
  { id: 'matcha', label: 'Matcha', swatch: '#86b06f' },
  { id: 'ube', label: 'Ube', swatch: '#a57ad8' },
  { id: 'black-sesame', label: 'Black Sesame', swatch: '#4a4a4a' },
];

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
  },
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

  document.body.style.backgroundColor = palette.background;
  document.body.style.color = palette.foreground;
};

export default function AuthShell({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeKey>('peach');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showHackerModal, setShowHackerModal] = useState(false);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const accessCheck = await fetch('/api/auth/check-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const { authorized } = await accessCheck.json();

      if (!authorized) {
        setShowHackerModal(true);
        setIsSubmitting(false);
        return;
      }
    } catch {
      setMessage('Something went wrong. Please try again.');
      setIsSubmitting(false);
      return;
    }

    const action = mode === 'signup' ? supabase.auth.signUp({ email, password }) : supabase.auth.signInWithPassword({ email, password });
    const { data, error } = await action;

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    if (mode === 'signup' && data.session) {
      router.replace('/');
      return;
    }

    if (mode === 'login' && data.session) {
      router.replace('/');
      return;
    }

    setMessage(mode === 'signup' ? 'Check your inbox for a confirmation email.' : 'You are signed in.');
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-4 py-3 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
            <span className="rounded-full bg-[color:var(--accent-soft)] px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">mochiboard</span>
            <span>{mode === 'login' ? 'Welcome back' : 'Create your account'}</span>
          </div>
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

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section
            className="rounded-[36px] border border-[color:var(--border)] p-8 shadow-[var(--shadow)]"
            style={{ background: 'linear-gradient(135deg, var(--surface-strong) 0%, var(--surface) 100%)' }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">Sign in to your cozy planner</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)]" style={{ fontFamily: 'var(--font-display)' }}>
              {mode === 'login' ? 'Come back to your little routine.' : 'Start your soft little planning ritual.'}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[color:var(--muted)]">
              Keep your week, tasks, and notes all in one warm, pastel home.
            </p>
            <div className="mt-8 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5 text-sm text-[color:var(--muted)]">
              <p className="font-semibold text-[color:var(--foreground)]">Why sign in?</p>
              <ul className="mt-3 space-y-2">
                <li>• Keep your planner tasks synced to Supabase</li>
                <li>• Stay logged in across refreshes</li>
                <li>• Access Dashboard and Planner from anywhere</li>
              </ul>
            </div>
          </section>

          <section className="rounded-[36px] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-soft)]">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[color:var(--foreground)]" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--foreground)] outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[color:var(--foreground)]" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--foreground)] outline-none"
                />
              </div>

              {message ? <p className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-3 text-sm text-[color:var(--accent-strong)]">{message}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-full bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)] disabled:opacity-70"
              >
                {isSubmitting ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>

            <p className="mt-5 text-sm text-[color:var(--muted)]">
              {mode === 'login' ? "Need an account?" : 'Already have one?'}{' '}
              <Link href={mode === 'login' ? '/signup' : '/login'} className="font-semibold text-[color:var(--accent-strong)]">
                {mode === 'login' ? 'Create one' : 'Log in'}
              </Link>
            </p>
          </section>
        </div>
      </div>

      {showHackerModal ? <HackerTerminalModal onClose={() => setShowHackerModal(false)} /> : null}
    </div>
  );
}
