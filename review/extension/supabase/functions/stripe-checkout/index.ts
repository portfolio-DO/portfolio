// supabase/functions/stripe-checkout/index.ts
// Tworzy sesję Stripe Checkout dla subskrypcji Premium

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_PRICE_ID   = Deno.env.get('STRIPE_PRICE_ID')!
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// SUCCESS_URL musi być prawdziwą stroną — ustaw jako np. https://twojadomena.pl/sukces
// lub użyj np. https://google.com jeśli nie masz strony
const SUCCESS_URL = Deno.env.get('STRIPE_SUCCESS_URL') || 'https://google.com'
const CANCEL_URL  = Deno.env.get('STRIPE_CANCEL_URL')  || 'https://google.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    // Pobierz lub utwórz klienta Stripe
    const { data: userData } = await supabase
      .from('users').select('stripe_customer_id').eq('id', user.id).single()

    let customerId = userData?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }  // KLUCZOWE: zapisz user.id w customer
      })
      customerId = customer.id
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    // Utwórz sesję checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: SUCCESS_URL + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: CANCEL_URL,
      // metadata na sesji — dla checkout.session.completed
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        // metadata na subskrypcji — dla invoice.payment_succeeded
        metadata: { supabase_user_id: user.id }
      },
      // Automatyczne podatki (opcjonalne)
      // automatic_tax: { enabled: true },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('stripe-checkout error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
