import type { Metadata } from 'next';

import MochiboardApp from '@/components/mochiboard-app';

export const metadata: Metadata = {
  title: 'mochiboard | Projects',
  description: 'Track projects and their subtasks.',
};

export default function ProjectsPage() {
  return <MochiboardApp activeView="projects" />;
}
