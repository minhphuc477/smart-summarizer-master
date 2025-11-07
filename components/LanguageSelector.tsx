"use client";

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Determine auth state (to avoid 401 spam when guest)
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthenticated(!!session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Load saved language preference; fall back to English
    try {
      const savedLang = localStorage.getItem('preferredLanguage');
      const supported = languages.map(l => l.code);
      if (savedLang && supported.includes(savedLang)) {
        if (savedLang !== i18n.language) {
          i18n.changeLanguage(savedLang);
          setCurrentLang(savedLang);
        }
      } else if (i18n.language !== 'en') {
        i18n.changeLanguage('en');
        setCurrentLang('en');
      }
    } catch {
      // ignore storage errors
      if (i18n.language !== 'en') {
        i18n.changeLanguage('en');
        setCurrentLang('en');
      }
    }
  }, [i18n]);

  const changeLanguage = async (langCode: string) => {
    await i18n.changeLanguage(langCode);
    setCurrentLang(langCode);
    try {
      localStorage.setItem('preferredLanguage', langCode);
    } catch {}
    // Save to backend only if authenticated (avoid 401 spam in guest mode)
    if (isAuthenticated) {
      try {
        const res = await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: langCode }),
        });
        // Ignore 401 and other non-fatal errors silently
        if (!res.ok && res.status !== 401) {
          // Optionally log once, but don't throw
          // console.warn('Failed to persist language preference:', res.status);
        }
      } catch {
        // ignore network errors
      }
    }
  };

  const currentLanguage = languages.find(lang => lang.code === currentLang);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Languages className="h-4 w-4" />
          <span>{currentLanguage?.flag}</span>
          <span className="hidden sm:inline">{currentLanguage?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span>{language.flag}</span>
              <span>{language.name}</span>
            </div>
            {currentLang === language.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
