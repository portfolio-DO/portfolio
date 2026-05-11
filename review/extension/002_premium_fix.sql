-- ============================================================
-- 002_premium_fix.sql
-- Uruchom w: Supabase Dashboard → SQL Editor → New Query
-- Naprawia system Premium - dodaje brakujące kolumny i funkcje
-- ============================================================

-- Upewnij się że kolumna stripe_subscription_id istnieje
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS bonus_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_ai_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Funkcja sprawdzająca status premium (wywoływana przez rozszerzenie)
CREATE OR REPLACE FUNCTION public.get_user_plan(user_id UUID)
RETURNS TABLE(plan TEXT, premium_until TIMESTAMPTZ, is_premium BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.plan,
    u.premium_until,
    (u.plan = 'premium' AND u.premium_until > NOW()) AS is_premium
  FROM public.users u
  WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Uprawnienia dla service role (webhook)
GRANT ALL ON public.users TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_plan TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_plan TO service_role;

-- Upewnij się że RLS pozwala userowi czytać własne dane
DROP POLICY IF EXISTS "Users read own" ON public.users;
CREATE POLICY "Users read own" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service role full access" ON public.users;
CREATE POLICY "Service role full access" ON public.users
  USING (true) WITH CHECK (true);

-- Indeks dla szybszego wyszukiwania po stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON public.users(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Sprawdź czy użytkownik ma rekord (może go nie mieć jeśli trigger nie zadziałał)
-- Ta funkcja tworzy rekord jeśli nie istnieje
CREATE OR REPLACE FUNCTION public.ensure_user_exists(user_id UUID, user_email TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.users (id, email, plan)
  VALUES (user_id, user_email, 'free')
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.ensure_user_exists TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_exists TO service_role;
