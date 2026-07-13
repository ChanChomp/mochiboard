import type { Metadata } from 'next';

import MochiboardApp from '@/components/mochiboard-app';

export const metadata: Metadata = {
  title: 'mochiboard | Planner',
  description: 'A dedicated planner view with schedule, to-dos, and notes.',
};

export default function PlannerPage() {
  return <MochiboardApp activeView="planner" />;
}
