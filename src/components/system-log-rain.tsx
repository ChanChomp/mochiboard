'use client';

import { useMemo } from 'react';

const COLUMN_COUNT = 2;
const LINES_PER_COLUMN = 80;

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomOctet = () => randomInt(0, 255);
const randomIp = () => `${randomOctet()}.${randomOctet()}.${randomOctet()}.${randomOctet()}`;
const randomSubnet = () => `${randomOctet()}.${randomOctet()}.${randomOctet()}`;
const randomPort = () => randomInt(20, 65000);
const randomHex = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
const randomPercent = () => (Math.random() * 2).toFixed(1);
const randomMac = () => Array.from({ length: 6 }, () => randomHex(2)).join(':');

const buildLineTemplates = () => [
  `${randomIp()} :: probing port ${randomPort()} :: ACK`,
  `scanning subnet ${randomSubnet()}.0/24...`,
  `${randomIp()} :: handshake failed`,
  `resolving hostname mochiboard.com`,
  `packet loss: ${randomPercent()}%`,
  `checksum verified 0x${randomHex(4)}`,
  `injecting payload... blocked`,
  `firewall rule triggered`,
  `logging session id [${randomHex(8)}]`,
  `escalating to tier 2 response`,
  `${randomIp()} :: port ${randomPort()} closed`,
  `decrypting packet stream... failed`,
  `spoofing MAC address ${randomMac()}`,
  `route trace: ${randomIp()} -> ${randomIp()} -> timeout`,
  `webcam access granted`,
  `microphone stream initiated`,
  `location pinpointed: accurate to 3 meters`,
  `downloading browser history...`,
  `cross-referencing known aliases...`,
  `contacting local field office...`,
  `encryption bypass: successful`,
  `identity confirmed: flagged individual`,
  `deploying countermeasures`,
  `access logs archived permanently`,
];

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildColumnLines = (): string[] => {
  const lines: string[] = [];
  while (lines.length < LINES_PER_COLUMN) {
    lines.push(...shuffle(buildLineTemplates()));
  }
  return lines.slice(0, LINES_PER_COLUMN);
};

type Column = {
  left: string;
  duration: string;
  delay: string;
  lines: string[];
};

const buildColumns = (): Column[] =>
  Array.from({ length: COLUMN_COUNT }, (_, index) => ({
    left: `${(index / COLUMN_COUNT) * 100 + 8}%`,
    duration: `${110 + Math.random() * 40}s`,
    delay: `${-Math.random() * 120}s`,
    lines: buildColumnLines(),
  }));

export default function SystemLogRain() {
  const columns = useMemo(buildColumns, []);

  return (
    <div className="pointer-events-none absolute inset-0 flex justify-center overflow-hidden opacity-20" aria-hidden="true">
      <div className="relative h-full w-full max-w-[min(90vw,32rem)] sm:max-w-lg md:max-w-2xl">
        {columns.map((column, index) => (
          <div
            key={index}
            className="log-rain-column absolute top-0 flex flex-col gap-2 whitespace-nowrap font-mono text-[10px] text-[#33ff66] sm:text-[11px]"
            style={{
              left: column.left,
              animationDuration: column.duration,
              animationDelay: column.delay,
            }}
          >
            {[...column.lines, ...column.lines].map((line, lineIndex) => (
              <span key={lineIndex}>{line}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
