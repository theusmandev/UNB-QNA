import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import webPush from "https://esm.sh/web-push@3.6.7"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const vapidPublicKey = Deno.env.get("VITE_VAPID_PUBLIC_KEY")!
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!

webPush.setVapidDetails(
  "mailto:admin@urdunovelbank.com",
  vapidPublicKey,
  vapidPrivateKey
)

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record
    const oldRecord = payload.old_record

    // Only fire when going from NO reply to HAVING a reply
    if (!record.visitor_id || !record.reply_text || oldRecord?.reply_text) {
      return new Response("Skipped: Not a new reply or missing visitor_id", { status: 200 })
    }

    // Get all subscriptions for this visitor
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('visitor_id', record.visitor_id)

    if (error || !subs || subs.length === 0) {
      return new Response("No subscriptions found", { status: 200 })
    }

    const qRes = await supabase.from('questions').select('slug').eq('id', record.question_id).single()
    const url = qRes.data?.slug ? `/q/${qRes.data.slug}` : '/'

    const notificationPayload = JSON.stringify({
      title: 'Admin replied to your question!',
      body: record.reply_text.length > 100 ? record.reply_text.substring(0, 100) + '...' : record.reply_text,
      data: { url }
    })

    const pushPromises = subs.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }

      try {
        await webPush.sendNotification(pushSubscription, notificationPayload)
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or revoked, delete it
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('Error sending push:', err)
        }
      }
    })

    await Promise.all(pushPromises)
    return new Response("Notifications sent", { status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
