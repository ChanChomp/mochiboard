import type { Metadata } from 'next';

import AuthShell from '@/components/auth-shell';

export const metadata: Metadata = {
  title: 'mochiboard | Login',
  description: 'Log in to your mochiboard account.',
};

export default function LoginPage() {
  return <AuthShell mode="login" />;
}
