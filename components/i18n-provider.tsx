"use client";

import { useEffect } from 'react';
import i18n from '@/lib/i18n';
import { I18nextProvider } from 'react-i18next';

// The i18n instance is already initialized in lib/i18n.ts.
// Here we just restore the user's preferred language (if any).
export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('preferredLanguage') : null;
      const supported = ['en', 'vi', 'zh', 'ja', 'ko'];
      if (saved && supported.includes(saved) && saved !== i18n.language) {
        i18n.changeLanguage(saved);
      } else if (!saved && i18n.language !== 'en') {
        // Force English as default if nothing saved
        i18n.changeLanguage('en');
      }
    } catch {
      // no-op
    }
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
}
