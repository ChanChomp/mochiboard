import type { Metadata } from 'next';

import MochiboardApp from '@/components/mochiboard-app';

export const metadata: Metadata = {
  title: 'mochiboard | Reports',
  description: 'A closer look at task, weight, and steps trends over time.',
};

export default function AnalyticsPage() {
  return <MochiboardApp activeView="analytics" />;
}
