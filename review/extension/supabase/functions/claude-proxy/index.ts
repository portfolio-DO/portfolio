// supabase/functions/claude-proxy/index.ts
// Proxies requests to Claude API — API key never exposed to client
// Also enforces usage limits server-side

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CLAUDE_API_KEY   = Deno.env.get('CLAUDE_API_KEY')!
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLAUDE_MODEL     = 'claude-sonnet-4-20250514'
const MAX_TOKENS       = 300

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Brak autoryzacji' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check and increment usage limits (atomic in DB)
    const { data: usageResult, error: usageError } = await supabase
      .rpc('increment_ai_usage', { user_id: user.id })

    if (usageError) {
      console.error('Usage check error:', usageError)
      return new Response(JSON.stringify({ error: 'Błąd sprawdzania limitu' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const usage = usageResult?.[0]
    if (!usage?.allowed) {
      return new Response(JSON.stringify({
        error: 'Osiągnięto limit AI. Odblokuj 500 odpowiedzi miesięcznie w wersji Premium.',
        limitReached: true
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const { system, userMsg } = await req.json()
    if (!system || !userMsg) {
      return new Response(JSON.stringify({ error: 'Brak parametrów system/userMsg' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Call Claude API
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: userMsg }]
      })
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.json()
      throw new Error(err.error?.message || 'Claude API error')
    }

    const claudeData = await claudeRes.json()
    const reply = claudeData.content?.[0]?.text?.trim() || ''

    return new Response(JSON.stringify({ reply, usageCount: usage.new_count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    console.error('claude-proxy error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
