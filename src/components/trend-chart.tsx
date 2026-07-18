'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Chart from 'chart.js/auto';

/**
 * Persists a per-chart type choice to localStorage under `chartType:<chartKey>`,
 * the same pattern the theme picker uses for its own preference.
 */
export function useChartType<T extends string>(chartKey: string, defaultType: T): [T, (next: T) => void] {
  const [type, setType] = useState<T>(defaultType);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(`chartType:${chartKey}`);
      if (raw) setType(raw as T);
    } catch {
      // Malformed/inaccessible localStorage — keep the default.
    }
  }, [chartKey]);

  const update = (next: T) => {
    setType(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`chartType:${chartKey}`, next);
      } catch {
        // Ignore write failures (e.g. private browsing storage limits).
      }
    }
  };

  return [type, update];
}

/**
 * Persists a per-chart period choice (day/week/month/year) to localStorage under
 * `period:<chartKey>`, so each chart widget's period filter is independent of the others.
 */
export function usePeriod<T extends string>(chartKey: string, defaultPeriod: T): [T, (next: T) => void] {
  const [period, setPeriod] = useState<T>(defaultPeriod);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(`period:${chartKey}`);
      if (raw) setPeriod(raw as T);
    } catch {
      // Malformed/inaccessible localStorage — keep the default.
    }
  }, [chartKey]);

  const update = (next: T) => {
    setPeriod(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`period:${chartKey}`, next);
      } catch {
        // Ignore write failures (e.g. private browsing storage limits).
      }
    }
  };

  return [period, update];
}

export type ChartTypeOption<T extends string> = { value: T; label: string; icon: ReactNode };

export function ChartTypeToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ChartTypeOption<T>[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-label={option.label}
          aria-pressed={value === option.value}
          title={option.label}
          className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
            value === option.value
              ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
              : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]'
          }`}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

export const LineChartIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <polyline points="2,11 6,6 9,9 14,3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const BarChartIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="2" y="8" width="3" height="6" rx="1" fill="currentColor" />
    <rect x="6.5" y="4" width="3" height="10" rx="1" fill="currentColor" />
    <rect x="11" y="6" width="3" height="8" rx="1" fill="currentColor" />
  </svg>
);

export const AreaChartIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2,11 L6,6 L9,9 L14,3 L14,14 L2,14 Z" fill="currentColor" fillOpacity="0.35" />
    <polyline points="2,11 6,6 9,9 14,3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const HorizontalBarChartIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="2" y="2.5" width="10" height="3" rx="1" fill="currentColor" />
    <rect x="2" y="6.5" width="7" height="3" rx="1" fill="currentColor" />
    <rect x="2" y="10.5" width="12" height="3" rx="1" fill="currentColor" />
  </svg>
);

export const PieChartIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 8 L8 1.5 A6.5 6.5 0 0 1 13.8 11 Z" fill="currentColor" fillOpacity="0.55" />
    <path d="M8 8 L13.8 11 A6.5 6.5 0 1 1 8 1.5 Z" fill="currentColor" />
  </svg>
);

// Generates `count` visually distinct swatches derived from a single base hex color, by
// spreading hue and lightness around it — keeps categorical charts theme-consistent instead
// of needing a separate hardcoded palette per theme.
const hexToHsl = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
};

const hslToHex = (h: number, s: number, l: number): string => {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = lNorm - c / 2;
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
};

export const generateCategoryPalette = (baseHex: string, count: number): string[] => {
  const [h, s] = hexToHsl(baseHex);
  if (count <= 1) return [baseHex];
  return Array.from({ length: count }, (_, index) => {
    const hueShift = (index / (count - 1) - 0.5) * 70;
    const lightness = 42 + (index / (count - 1)) * 34;
    return hslToHex(h + hueShift, Math.min(s + 8, 85), lightness);
  });
};

export type TrendChartType = 'line' | 'bar' | 'area';

export type TrendHistoryPoint = { logDate: string; value: number };

export const TREND_CHART_TYPE_OPTIONS: ChartTypeOption<TrendChartType>[] = [
  { value: 'line', label: 'Line chart', icon: LineChartIcon },
  { value: 'bar', label: 'Bar chart', icon: BarChartIcon },
  { value: 'area', label: 'Area chart', icon: AreaChartIcon },
];

const defaultFormatValue = (value: number): string => String(value);
const defaultFormatDate = (logDate: string): string => logDate;

// A translucent version of a hex color, for the fill under an area chart's line.
const withAlpha = (hex: string, alpha: number): string => {
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${alphaHex}`;
};

/**
 * A line, bar, or area trend chart with real Chart.js scales — a y-axis with evenly spaced
 * gridlines/ticks, x-axis date ticks, and native hover tooltips — instead of hand-drawn shapes.
 * Colors must be actual hex values (not CSS custom properties): canvas drawing can't resolve
 * `var(...)`, so callers pass the active theme's palette directly.
 */
type ChartJsDataset = NonNullable<ConstructorParameters<typeof Chart>[1]['data']>['datasets'][number];

function buildDatasets(
  history: TrendHistoryPoint[],
  type: TrendChartType,
  goalValue: number | undefined,
  accent: string,
  accentStrong: string,
  muted: string
): ChartJsDataset[] {
  const values = history.map((point) => point.value);
  const isBar = type === 'bar';

  const datasets: ChartJsDataset[] = [
    {
      label: 'Value',
      data: values,
      borderColor: accent,
      backgroundColor: isBar
        ? values.map((_, index) => (index === values.length - 1 ? accentStrong : accent))
        : type === 'area'
        ? withAlpha(accent, 0.25)
        : accent,
      fill: type === 'area',
      tension: isBar ? 0 : 0.3,
      borderWidth: 2,
      borderRadius: isBar ? 6 : 0,
      maxBarThickness: isBar ? 22 : undefined,
      pointRadius: isBar ? 0 : 3,
      pointHoverRadius: isBar ? 0 : 5,
      pointBackgroundColor: accent,
    },
  ];

  if (goalValue !== undefined) {
    datasets.push({
      label: 'Goal',
      data: history.map(() => goalValue),
      borderColor: muted,
      borderDash: [5, 4],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      tension: 0,
    });
  }

  return datasets;
}

export function TrendChartCanvas({
  history,
  type,
  goalValue,
  accent,
  accentStrong,
  muted,
  border,
  formatValue = defaultFormatValue,
  formatDateLabel = defaultFormatDate,
  height = 200,
}: {
  history: TrendHistoryPoint[];
  type: TrendChartType;
  goalValue?: number;
  accent: string;
  accentStrong: string;
  muted: string;
  border: string;
  formatValue?: (value: number) => string;
  formatDateLabel?: (logDate: string) => string;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  // formatValue/formatDateLabel are read via refs (not effect deps) so passing a fresh inline
  // arrow function each render doesn't trigger a chart rebuild — only real data/type/color
  // changes should.
  const formatValueRef = useRef(formatValue);
  formatValueRef.current = formatValue;
  const formatDateLabelRef = useRef(formatDateLabel);
  formatDateLabelRef.current = formatDateLabel;

  // Created once per canvas mount, and only recreated if the fundamental chart `type` changes
  // (Chart.js can't hot-swap between 'bar' and 'line' renderers). Data/color updates below go
  // through chart.update() instead, so the entrance animation doesn't replay on every re-render.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isBar = type === 'bar';
    const chart = new Chart(canvas, {
      type: isBar ? 'bar' : 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        resizeDelay: 100,
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (item) => item.datasetIndex === 0,
            callbacks: {
              title: (items) => items[0]?.label ?? '',
              label: (context) => formatValueRef.current(Number(context.parsed.y) || 0),
            },
          },
        },
        scales: {
          x: {
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
            grid: { display: false },
          },
          y: {
            ticks: { maxTicksLimit: 5, callback: (value) => formatValueRef.current(Number(value)) },
            grid: {},
          },
        },
      },
    });
    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [type]);

  // Pushes data/goal/color/theme changes into the existing chart instance without recreating it.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.data.labels = history.map((point) => formatDateLabelRef.current(point.logDate));
    chart.data.datasets = buildDatasets(history, type, goalValue, accent, accentStrong, muted) as typeof chart.data.datasets;

    const xScale = chart.options.scales?.x;
    const yScale = chart.options.scales?.y;
    if (xScale?.ticks) xScale.ticks.color = muted;
    if (yScale?.ticks) yScale.ticks.color = muted;
    if (yScale?.grid) yScale.grid.color = border;

    chart.update('none');
  }, [history, type, goalValue, accent, accentStrong, muted, border]);

  if (history.length === 0) return null;

  return (
    <div className="relative w-full" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label="Trend chart" />
    </div>
  );
}
