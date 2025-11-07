"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, Crown, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

type GuestUpgradeDialogProps = {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function GuestUpgradeDialog({ trigger, open, onOpenChange }: GuestUpgradeDialogProps) {
  const [showAuth, setShowAuth] = useState(false);
  
  const features = [
    {
      name: 'Summaries',
      guest: '5 per day',
      premium: 'Unlimited',
      guestHas: false
    },
    {
      name: 'History',
      guest: 'Temporary (cleared on refresh)',
      premium: 'Saved forever',
      guestHas: false
    },
    {
      name: 'Folders & Organization',
      guest: 'Not available',
      premium: 'Full access',
      guestHas: false
    },
    {
      name: 'Workspaces & Collaboration',
      guest: 'Not available',
      premium: 'Share & collaborate',
      guestHas: false
    },
    {
      name: 'Semantic Search',
      guest: 'Not available',
      premium: 'AI-powered search',
      guestHas: false
    },
    {
      name: 'Custom Personas',
      guest: 'Not available',
      premium: 'Create & save personas',
      guestHas: false
    },
    {
      name: 'Note Encryption',
      guest: 'Not available',
      premium: 'Secure your notes',
      guestHas: false
    },
    {
      name: 'Analytics Dashboard',
      guest: 'Not available',
      premium: 'Track your productivity',
      guestHas: false
    },
    {
      name: 'Canvas Mind Maps',
      guest: 'Not available',
      premium: 'Visual note organization',
      guestHas: false
    },
    {
      name: 'Export & Sharing',
      guest: 'Basic',
      premium: 'Advanced options',
      guestHas: true
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            <DialogTitle className="text-2xl">Upgrade to Premium</DialogTitle>
          </div>
          <DialogDescription>
            Get unlimited access and unlock all features by signing in
          </DialogDescription>
        </DialogHeader>

        {!showAuth ? (
          <div className="space-y-6">
            {/* Feature Comparison Table */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 font-semibold">Feature</th>
                    <th className="text-center p-4 font-semibold">Guest Mode</th>
                    <th className="text-center p-4 font-semibold bg-primary/10">
                      <div className="flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>Premium (Free)</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-4 font-medium">{feature.name}</td>
                      <td className="p-4 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          {feature.guestHas ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">{feature.guest}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center bg-primary/5">
                        <div className="flex items-center justify-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">{feature.premium}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CTA Section */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-lg space-y-4">
              <h3 className="text-xl font-bold text-center">
                Sign up now — it&apos;s completely FREE! 🎉
              </h3>
              <p className="text-center text-muted-foreground">
                No credit card required. Get started in seconds with Google or GitHub.
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  size="lg"
                  onClick={() => setShowAuth(true)}
                  className="gap-2"
                >
                  <Crown className="h-5 w-5" />
                  Upgrade to Premium
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onOpenChange?.(false)}
                >
                  Maybe Later
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="ghost"
              onClick={() => setShowAuth(false)}
              className="mb-4"
            >
              ← Back to comparison
            </Button>
            <div className="p-6 bg-card border rounded-lg">
              <Auth
                supabaseClient={supabase}
                appearance={{ theme: ThemeSupa }}
                providers={['google', 'github']}
                theme="default"
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
