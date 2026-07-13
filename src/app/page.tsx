import type { Metadata } from 'next';

import MochiboardApp from '@/components/mochiboard-app';

export const metadata: Metadata = {
  title: 'mochiboard | Dashboard',
  description: 'A polished dashboard homepage for mochiboard with planning, wellness, and budgeting summaries.',
};

export default function Home() {
  return <MochiboardApp activeView="dashboard" />;
}
