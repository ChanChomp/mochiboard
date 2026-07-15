import type { Metadata } from 'next';

import MochiboardApp from '@/components/mochiboard-app';

export const metadata: Metadata = {
  title: 'mochiboard | Health & Fitness',
  description: 'A dedicated health and fitness tracking view.',
};

export default function HealthPage() {
  return <MochiboardApp activeView="health" />;
}
