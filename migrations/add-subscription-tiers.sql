-- Add subscription_tier column to user_preferences
-- This allows tracking user subscription levels for rate limiting and feature access

ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'personal', 'pro', 'team'));

-- Add subscription metadata
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_subscription_tier 
ON public.user_preferences(subscription_tier);

-- Add comment
COMMENT ON COLUMN public.user_preferences.subscription_tier IS 'User subscription tier: free, personal, pro, or team';
COMMENT ON COLUMN public.user_preferences.subscription_expires_at IS 'When the subscription expires (NULL for lifetime or free tier)';
COMMENT ON COLUMN public.user_preferences.subscription_started_at IS 'When the current subscription started';

-- Update existing rows to have default tier if needed
UPDATE public.user_preferences 
SET subscription_tier = 'free' 
WHERE subscription_tier IS NULL;
