'use client';
import { useEffect, useState } from 'react';

const KEY = 'smiley_pro_email';

export function useSubscription() {
  const [isPro, setIsPro]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail]     = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successEmail = params.get('email');
    const status = params.get('pro');

    if (status === 'success' && successEmail) {
      localStorage.setItem(KEY, successEmail);
      window.history.replaceState({}, '', '/');
    }

    const stored = localStorage.getItem(KEY) || successEmail || '';
    setEmail(stored);

    if (!stored) { setLoading(false); return; }

    fetch(`/api/check-subscription?email=${encodeURIComponent(stored)}`)
      .then(r => r.json())
      .then(({ active }) => {
        setIsPro(active);
        if (!active) localStorage.removeItem(KEY);
      })
      .catch(() => setIsPro(false))
      .finally(() => setLoading(false));
  }, []);

  async function subscribe(userEmail: string) {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  async function restore(userEmail: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/check-subscription?email=${encodeURIComponent(userEmail)}`);
      const { active } = await res.json();
      if (active) {
        localStorage.setItem(KEY, userEmail);
        setEmail(userEmail);
        setIsPro(true);
      }
      return active;
    } catch {
      return false;
    }
  }

  return { isPro, loading, email, subscribe, restore };
}
