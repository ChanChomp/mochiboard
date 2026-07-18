import type { Metadata } from 'next';

import MochiboardApp from '@/components/mochiboard-app';

export const metadata: Metadata = {
  title: 'mochiboard | Books',
  description: 'Track what you are reading, what you want to read, and what you have finished.',
};

export default function BooksPage() {
  return <MochiboardApp activeView="books" />;
}
