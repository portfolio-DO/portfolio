// supabase/functions/verify-premium/index.ts
// Weryfikuje status Premium przez Stripe API
// Deploy: supabase functions deploy verify-premium

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Brak autoryzacji' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })

    // Pobierz dane użytkownika z bazy
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, plan, premium_until')
      .eq('id', user.id)
      .single()

    let customerId = userData?.stripe_customer_id

    // Jeśli nie mamy customer_id, szukaj po emailu w Stripe
    if (!customerId && user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 })
      if (customers.data.length > 0) {
        customerId = customers.data[0].id
        // Zapisz powiązanie
        await supabase.from('users').upsert({
          id: user.id, email: user.email, stripe_customer_id: customerId
        }, { onConflict: 'id' })
        console.log(`Found customer by email: ${customerId}`)
      }
    }

    if (!customerId) {
      return new Response(JSON.stringify({ isPremium: false, plan: 'free' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Sprawdź aktywne subskrypcje w Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId, status: 'active', limit: 1,
    })

    const activeSub = subscriptions.data[0]

    if (activeSub) {
      const periodEnd    = new Date(activeSub.current_period_end * 1000).toISOString()
      // Zaktualizuj bazę
      await supabase.from('users').upsert({
        id:                    user.id,
        plan:                  'premium',
        premium_until:         periodEnd,
        stripe_customer_id:    customerId,
        stripe_subscription_id: activeSub.id,
        monthly_ai_count:      0,
        updated_at:            new Date().toISOString()
      }, { onConflict: 'id' })
      console.log(`✓ Premium verified for ${user.email} until ${periodEnd}`)
      return new Response(JSON.stringify({ isPremium: true, plan: 'premium', premiumUntil: periodEnd }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ isPremium: false, plan: 'free' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    console.error('verify-premium error:', e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
