import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (e) {
    console.error('Failed to set VAPID details:', e);
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
}

export async function sendPushNotificationToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys not configured, skipping push notification');
    return { sent: 0, failed: 0 };
  }

  // RLSをバイパスして相手の端末トークンを確実に取得するため、Service RoleがあればAdmin Clientを使用
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const queryClient = (supabaseUrl && serviceRoleKey)
    ? createSupabaseClient(supabaseUrl, serviceRoleKey)
    : supabase;

  const { data: subs, error } = await queryClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to fetch push subscriptions:', error);
    return { sent: 0, failed: 0 };
  }

  if (!subs || subs.length === 0) {
    console.log(`No push subscriptions found for user ${userId}`);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];
  const jsonPayload = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          jsonPayload
        );
        sent++;
        console.log(`Successfully sent push notification to ${userId}`);
      } catch (err: any) {
        failed++;
        console.error('WebPush send error:', err?.statusCode, err?.message);
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredIds.push(sub.id);
        }
      }
    })
  );

  if (expiredIds.length > 0) {
    await queryClient.from('push_subscriptions').delete().in('id', expiredIds);
  }

  return { sent, failed };
}
