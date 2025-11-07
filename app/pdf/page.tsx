"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NavigationMenu from "@/components/NavigationMenu";
import PDFManager from "@/components/PDFManager";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function PDFPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </ThemeProvider>
    );
  }

  if (!session) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
          <h1 className="text-4xl font-bold mb-4">PDF Manager</h1>
          <p className="text-xl text-muted-foreground mb-8">Sign in to upload and manage PDFs</p>
          <Button onClick={() => window.location.href = '/'}>
            Go to Sign In
          </Button>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ErrorBoundary>
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
            <div className="container mx-auto px-6 py-4 flex items-center justify-between">
              <NavigationMenu />
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {session.user.email}
                </span>
                <ThemeToggle />
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main>
            <PDFManager session={session} />
          </main>
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
