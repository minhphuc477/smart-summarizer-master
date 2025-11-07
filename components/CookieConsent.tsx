"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem('cookie-consent');
      if (accepted !== 'true') setVisible(true);
    } catch {
      // ignore
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem('cookie-consent', 'true');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-lg border bg-background text-foreground shadow-lg p-4 sm:flex sm:items-center sm:justify-between gap-3">
        <p className="text-sm">
          We use cookies for basic functionality and to improve your experience. By using this app, you agree to our cookie policy.
        </p>
        <div className="mt-3 sm:mt-0 flex items-center gap-2">
          <a href="#" className="text-sm underline">Learn more</a>
          <Button size="sm" onClick={accept}>Accept</Button>
        </div>
      </div>
    </div>
  );
}
