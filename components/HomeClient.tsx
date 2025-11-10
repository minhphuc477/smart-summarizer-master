"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { Session } from '@supabase/supabase-js';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import SummarizerApp from '@/components/SummarizerApp';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { canGuestUse, getRemainingUsage } from '@/lib/guestMode';
import { UserCircle2 } from 'lucide-react';

export default function HomeClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [remainingUses, setRemainingUses] = useState(5);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setIsLoading(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setRemainingUses(getRemainingUsage());
    }
  }, [session]);

  if (isLoading) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      </ThemeProvider>
    );
  }

  if (!session && !isGuestMode) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ErrorBoundary>
          <main id="main-content" className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
            <div className="absolute top-4 right-4">
              <ThemeToggle />
            </div>
            <div className="w-full max-w-4xl space-y-8">
              <div className="text-center space-y-4">
                <h1 className="text-5xl font-bold text-foreground tracking-tight">
                  Smart Note Summarizer
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Transform your messy notes into clear summaries
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-6 mt-12">
                <div className="p-8 bg-card border rounded-xl shadow-sm space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <UserCircle2 className="h-8 w-8 text-primary" />
                    <h2 className="text-2xl font-bold text-card-foreground">Sign In</h2>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                    <li>✅ Unlimited summaries</li>
                    <li>✅ Save history forever</li>
                    <li>✅ Organize with folders</li>
                  </ul>
                  <Auth
                    supabaseClient={supabase}
                    appearance={{ theme: ThemeSupa }}
                    providers={['google', 'github']}
                    theme="default"
                  />
                </div>
                <div className="p-8 bg-accent/30 border rounded-xl shadow-sm space-y-4">
                  <h2 className="text-2xl font-bold text-foreground mb-4">Try as Guest</h2>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                    <li>🔹 {remainingUses} free summaries</li>
                    <li>🔹 Temporary history</li>
                    <li>🔹 All AI features</li>
                  </ul>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsGuestMode(true)}
                    disabled={!canGuestUse()}
                  >
                    {canGuestUse() ? 'Continue as Guest' : 'Guest Limit Reached'}
                  </Button>
                </div>
              </div>
            </div>
          </main>
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ErrorBoundary>
        <SummarizerApp session={session!} isGuestMode={isGuestMode} />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
