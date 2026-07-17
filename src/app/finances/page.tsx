import type { Metadata } from 'next';

import MochiboardApp from '@/components/mochiboard-app';

export const metadata: Metadata = {
  title: 'mochiboard | Finances',
  description: 'A dedicated finances and budgeting view.',
};

export default function FinancesPage() {
  return <MochiboardApp activeView="finances" />;
}
