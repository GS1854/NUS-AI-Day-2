'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function signIn() {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/dev-login', { method: 'POST' });
      if (!response.ok) throw new Error('Development login is unavailable. Configure authentication before continuing.');
      router.push('/');
    } catch (reason) {
      setLoading(false);
      window.alert(reason instanceof Error ? reason.message : 'Login failed');
    }
  }
  return <main className="login-shell"><section className="login-panel"><p className="eyebrow">DAYLIGHT TASKS</p><h1>Make room for what matters.</h1><p className="muted">A calm, Singapore-timezone task list for the work in front of you.</p><button className="primary-button" onClick={signIn} disabled={loading}>{loading ? 'Opening...' : 'Enter workspace'}</button><small>Local development access. Passkey sign-in arrives in the authentication phase.</small></section></main>;
}
