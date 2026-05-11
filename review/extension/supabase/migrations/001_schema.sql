-- ============================================================
-- Review Responder Pro — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  plan            TEXT NOT NULL DEFAULT 'free',    -- 'free' | 'premium'
  premium_until   TIMESTAMPTZ,
  stripe_customer_id  TEXT,
  stripe_subscription_id TEXT,
  bonus_used      INTEGER NOT NULL DEFAULT 0,       -- one-time 15 bonus
  monthly_ai_count INTEGER NOT NULL DEFAULT 0,
  monthly_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create user row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Monthly reset function (called by Edge Function on each AI request)
CREATE OR REPLACE FUNCTION public.reset_monthly_if_needed(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET monthly_ai_count = 0,
      monthly_reset_at = date_trunc('month', NOW())
  WHERE id = user_id
    AND monthly_reset_at < date_trunc('month', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment AI usage (atomic)
CREATE OR REPLACE FUNCTION public.increment_ai_usage(user_id UUID)
RETURNS TABLE(allowed BOOLEAN, new_count INTEGER, plan TEXT) AS $$
DECLARE
  u public.users%ROWTYPE;
  bonus_limit   INTEGER := 15;
  free_limit    INTEGER := 5;
  premium_limit INTEGER := 500;
  is_premium    BOOLEAN;
  effective_limit INTEGER;
BEGIN
  -- Reset monthly counter if needed
  PERFORM public.reset_monthly_if_needed(user_id);

  SELECT * INTO u FROM public.users WHERE id = user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'free'::TEXT;
    RETURN;
  END IF;

  is_premium := u.plan = 'premium' AND u.premium_until > NOW();
  effective_limit := CASE WHEN is_premium THEN premium_limit ELSE free_limit END;

  -- Check bonus (free users only, first 15 generations ever)
  IF NOT is_premium AND u.bonus_used < bonus_limit THEN
    UPDATE public.users
    SET bonus_used = bonus_used + 1, updated_at = NOW()
    WHERE id = user_id;
    RETURN QUERY SELECT true, u.bonus_used + 1, u.plan;
    RETURN;
  END IF;

  -- Check monthly limit
  IF u.monthly_ai_count >= effective_limit THEN
    RETURN QUERY SELECT false, u.monthly_ai_count, u.plan;
    RETURN;
  END IF;

  UPDATE public.users
  SET monthly_ai_count = monthly_ai_count + 1, updated_at = NOW()
  WHERE id = user_id;

  RETURN QUERY SELECT true, u.monthly_ai_count + 1, u.plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own row
CREATE POLICY "Users read own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND plan = (SELECT plan FROM public.users WHERE id = auth.uid()));

-- Service role bypass (for Edge Functions)
-- This is automatic in Supabase for service_role key

-- ============================================================
-- Optional: analytics table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reply_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,  -- 'ai_generate' | 'template_use' | 'copy'
  reviewer    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reply_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own logs" ON public.reply_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own logs" ON public.reply_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
