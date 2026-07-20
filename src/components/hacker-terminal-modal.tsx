'use client';

import { useEffect, useState } from 'react';

import SystemLogRain from '@/components/system-log-rain';

type LineColor = 'green' | 'red' | 'white';

type Segment = {
  text: string;
  color: LineColor;
};

type TerminalLine = Segment[];

const terminalLines: TerminalLine[] = [
  [{ text: '> connecting to mochiboard.com...', color: 'green' }],
  [{ text: '> user not recognized', color: 'green' }],
  [
    { text: '> tracing IP address... ', color: 'red' },
    { text: 'done', color: 'green' },
  ],
  [
    { text: '> notifying FBI Cyber Division... ', color: 'red' },
    { text: 'done', color: 'green' },
  ],
  [{ text: '> ⚠ do not close this window', color: 'red' }],
  [{ text: '> this incident has been logged. good luck.', color: 'white' }],
];

const colorClasses: Record<LineColor, string> = {
  green: 'text-[#33ff66]',
  red: 'text-[#ff4d4d]',
  white: 'text-white',
};

const CHAR_DELAY_MS = 25;
const LINE_PAUSE_MS = 350;

const lineLength = (line: TerminalLine) => line.reduce((total, segment) => total + segment.text.length, 0);

const sliceLine = (line: TerminalLine, charCount: number): TerminalLine => {
  const sliced: TerminalLine = [];
  let remaining = charCount;

  for (const segment of line) {
    if (remaining <= 0) break;
    const takeLength = Math.min(remaining, segment.text.length);
    sliced.push({ text: segment.text.slice(0, takeLength), color: segment.color });
    remaining -= takeLength;
  }

  return sliced;
};

function TerminalLineText({ line }: { line: TerminalLine }) {
  return (
    <>
      {line.map((segment, index) => (
        <span key={index} className={colorClasses[segment.color]}>
          {segment.text}
        </span>
      ))}
    </>
  );
}

export default function HackerTerminalModal({ onClose }: { onClose: () => void }) {
  const [typedLines, setTypedLines] = useState<TerminalLine[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (lineIndex >= terminalLines.length) {
      return;
    }

    const line = terminalLines[lineIndex];
    const totalLength = lineLength(line);

    if (charIndex < totalLength) {
      const timeout = setTimeout(() => setCharIndex((count) => count + 1), CHAR_DELAY_MS);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => {
      setTypedLines((lines) => [...lines, line]);
      setLineIndex((index) => index + 1);
      setCharIndex(0);
    }, LINE_PAUSE_MS);
    return () => clearTimeout(timeout);
  }, [lineIndex, charIndex]);

  const activeLine = terminalLines[lineIndex];
  const activeSlicedLine = activeLine ? sliceLine(activeLine, charIndex) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
      role="alertdialog"
      aria-modal="true"
      onClick={onClose}
    >
      <SystemLogRain />
      <div
        className="relative z-10 w-full max-w-[92vw] rounded-md border border-[#1f3d1f] bg-[#0a0a0a] p-3 font-mono text-[11px] leading-snug shadow-[0_0_40px_rgba(51,255,102,0.15)] sm:max-w-sm sm:p-4 sm:text-xs md:max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ff5f56]" />
          <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
          <span className="h-2 w-2 rounded-full bg-[#27c93f]" />
        </div>
        <div className="min-h-[120px] space-y-1 break-words">
          {typedLines.map((line, index) => (
            <p key={index}>
              <TerminalLineText line={line} />
            </p>
          ))}
          {activeSlicedLine ? (
            <p>
              <TerminalLineText line={activeSlicedLine} />
              <span className="animate-pulse text-[#33ff66]">▍</span>
            </p>
          ) : (
            <p className="text-[#33ff66]">
              <span className="animate-pulse">▍</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-full border border-[#33ff66]/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-[#33ff66] transition hover:bg-[#33ff66]/10"
        >
          close
        </button>
      </div>
    </div>
  );
}
