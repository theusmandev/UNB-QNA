import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  // Only accept GET and HEAD
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    })
  }

  try {
    const startTime = performance.now()

    // Query site_settings (lightweight 1-row table) to keep DB active
    const { data, error } = await supabase
      .from("site_settings")
      .select("id")
      .limit(1)

    const durationMs = Math.round(performance.now() - startTime)

    if (error) {
      console.error("Keep-alive DB query error:", error)
      return new Response(
        JSON.stringify({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString(),
          durationMs,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      )
    }

    const payload = JSON.stringify({
      status: "ok",
      message: "Supabase DB ping successful",
      timestamp: new Date().toISOString(),
      durationMs,
      rows: data?.length ?? 0,
    })

    // UptimeRobot often sends HEAD requests by default.
    // Per HTTP specs, HEAD must return the same headers as GET but without a response body.
    return new Response(req.method === "HEAD" ? null : payload, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    })
  } catch (err: any) {
    console.error("Unhandled keep-alive error:", err)
    return new Response(
      JSON.stringify({
        status: "error",
        message: err.message || "Internal Server Error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    )
  }
})

