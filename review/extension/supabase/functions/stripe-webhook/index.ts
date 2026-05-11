// supabase/functions/stripe-webhook/index.ts
// WAŻNE: Deploy z flagą --no-verify-jwt:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// 
// Bez tej flagi Supabase blokuje webhooki Stripe błędem 401.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const STRIPE_SECRET_KEY     = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
    event = await stripe.webhooks.constructEventAsync(body, sig!, STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    console.error('Webhook signature error:', e.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const stripe   = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })

  console.log(`Event received: ${event.type}`)
  const obj = event.data.object as any

  // ── Znajdź supabase_user_id przez kilka metod ────────────────
  async function findUserId(): Promise<string | null> {
    // 1. Z metadata obiektu eventu (gdy zakup przez nasz checkout)
    if (obj?.metadata?.supabase_user_id) {
      console.log('UserId from event metadata:', obj.metadata.supabase_user_id)
      return obj.metadata.supabase_user_id
    }

    // 2. Z metadata subscription
    if (obj?.subscription) {
      try {
        const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id
        const sub = await stripe.subscriptions.retrieve(subId)
        if (sub?.metadata?.supabase_user_id) {
          console.log('UserId from subscription metadata:', sub.metadata.supabase_user_id)
          return sub.metadata.supabase_user_id
        }
      } catch (e) { console.error('sub retrieve error:', e.message) }
    }

    // 3. Z metadata customer (gdy zakup przez Payment Link)
    const customerId = obj?.customer
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
        if (customer?.metadata?.supabase_user_id) {
          console.log('UserId from customer metadata:', customer.metadata.supabase_user_id)
          return customer.metadata.supabase_user_id
        }

        // 4. Znajdź użytkownika po emailu klienta Stripe
        if (customer?.email) {
          console.log('Looking up user by email:', customer.email)
          const { data: authUsers } = await supabase.auth.admin.listUsers()
          const user = authUsers?.users?.find(u => u.email === customer.email)
          if (user?.id) {
            console.log('UserId found by email:', user.id)
            // Zapisz powiązanie żeby kolejny raz było szybciej
            await supabase.from('users')
              .upsert({ id: user.id, email: user.email, stripe_customer_id: customerId }, { onConflict: 'id' })
            return user.id
          }
        }
      } catch (e) { console.error('customer retrieve error:', e.message) }

      // 5. Szukaj po stripe_customer_id w tabeli users
      const { data } = await supabase
        .from('users').select('id').eq('stripe_customer_id', customerId).single()
      if (data?.id) {
        console.log('UserId from users table:', data.id)
        return data.id
      }
    }

    console.error('Could not find userId for event:', event.type, JSON.stringify(obj?.metadata || {}))
    return null
  }

  async function setPremium(userId: string, subId: string, periodEnd: number) {
    const premiumUntil = new Date(periodEnd * 1000).toISOString()
    const { error } = await supabase.from('users').upsert({
      id: userId,
      plan: 'premium',
      premium_until: premiumUntil,
      stripe_subscription_id: subId,
      monthly_ai_count: 0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    if (error) console.error('setPremium DB error:', JSON.stringify(error))
    else console.log(`✓ SET PREMIUM: user=${userId} until=${premiumUntil}`)
  }

  try {
    switch (event.type) {

      // Aktywacja Premium po zakupie
      case 'checkout.session.completed': {
        const userId = await findUserId()
        if (!userId) break
        const subId = obj.subscription
        if (!subId) { console.error('No subscription ID in checkout session'); break }
        const sub = await stripe.subscriptions.retrieve(subId)
        await setPremium(userId, subId, sub.current_period_end)
        break
      }

      // Aktywacja przez Payment Link (customer.subscription.created)
      case 'customer.subscription.created': {
        if (obj.status !== 'active') break
        const userId = await findUserId()
        if (!userId) break
        await setPremium(userId, obj.id, obj.current_period_end)
        break
      }

      // Odnowienie subskrypcji
      case 'invoice.payment_succeeded': {
        if (obj.billing_reason !== 'subscription_create' && obj.billing_reason !== 'subscription_cycle') break
        const userId = await findUserId()
        if (!userId) break
        const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id
        if (!subId) break
        const sub = await stripe.subscriptions.retrieve(subId)
        await setPremium(userId, subId, sub.current_period_end)
        break
      }

      // Anulowanie
      case 'customer.subscription.deleted': {
        const userId = await findUserId()
        if (!userId) break
        await supabase.from('users').update({
          plan: 'free', premium_until: null, updated_at: new Date().toISOString()
        }).eq('id', userId)
        console.log(`✓ SET FREE: user=${userId}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('Handler error:', e.message)
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
