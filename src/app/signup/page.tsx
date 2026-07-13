import type { Metadata } from 'next';

import AuthShell from '@/components/auth-shell';

export const metadata: Metadata = {
  title: 'mochiboard | Sign up',
  description: 'Create a mochiboard account.',
};

export default function SignupPage() {
  return <AuthShell mode="signup" />;
}
