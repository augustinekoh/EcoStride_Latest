import { SignJWT, importPKCS8 } from 'jose';

export interface MailData {
  id?: string;
  title: string;
  content: string;
  sender: string;
  sender_id?: string | null;
  recipient_type: string;
  recipient_id: string;
  recipient_name?: string | null;
  expires_for_new_users?: number;
  action_type?: string | null;
  action_data?: string | null;
  notification_type: 'mailbox' | 'social';
  notification_priority: 'high' | 'normal' | 'low' | 'none';
}

export const notificationService = {
  createMailAndNotify: async (env: any, mail: MailData) => {
    const now = Date.now();
    const mailId = mail.id || crypto.randomUUID();

    // 1. Insert into mail table
    await env.DB.prepare(`
      INSERT INTO mail (id, title, content, sender, sender_id, recipient_type, recipient_id, recipient_name, expires_for_new_users, action_type, action_data, created_at, notification_type, notification_priority, notification_sent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      mailId, mail.title, mail.content, mail.sender, mail.sender_id || null, 
      mail.recipient_type, mail.recipient_id, mail.recipient_name || null,
      mail.expires_for_new_users || 0, mail.action_type || null, mail.action_data || null, 
      now, mail.notification_type, mail.notification_priority
    ).run();

    // 2. Decide if push is appropriate
    if (mail.notification_priority === 'none') return;
    
    // Default preferences
    let prefs = await env.DB.prepare('SELECT * FROM user_notification_preferences WHERE user_id = ?').bind(mail.recipient_id).first();
    if (!prefs) {
      // Create default preferences row so subsequent UPDATEs work
      await env.DB.prepare(
        'INSERT OR IGNORE INTO user_notification_preferences (user_id, push_enabled, mailbox_enabled, social_enabled, last_notified_at, pending_notifications_count) VALUES (?, 1, 1, 1, 0, 0)'
      ).bind(mail.recipient_id).run();
      prefs = { push_enabled: 1, mailbox_enabled: 1, social_enabled: 1, last_notified_at: 0, pending_notifications_count: 0 };
    }

    if (!prefs.push_enabled) {
      console.log(`[Push] User ${mail.recipient_id} has push notifications disabled.`);
      return;
    }
    if (mail.notification_type === 'mailbox' && !prefs.mailbox_enabled) {
      console.log(`[Push] User ${mail.recipient_id} has mailbox notifications disabled.`);
      return;
    }
    if (mail.notification_type === 'social' && !prefs.social_enabled) {
      console.log(`[Push] User ${mail.recipient_id} has social notifications disabled.`);
      return;
    }

    // 3. Check Cooldown (Only apply cooldown to non-high priority notifications)
    const COOLDOWN_MS = 5 * 60 * 1000;
    if (mail.notification_priority !== 'high' && now - (prefs.last_notified_at || 0) < COOLDOWN_MS) {
      // Inside cooldown: increment pending and suppress
      console.log(`[Push] Cooldown active for user ${mail.recipient_id}. Queuing notification.`);
      await env.DB.prepare('UPDATE user_notification_preferences SET pending_notifications_count = pending_notifications_count + 1 WHERE user_id = ?').bind(mail.recipient_id).run();
      return;
    }

    // 4. Send Push
    console.log(`[Push] Sending push notification to user ${mail.recipient_id}: "${mail.title}"`);
    await notificationService.sendGroupedPush(env, mail.recipient_id, mail.notification_type, mailId, prefs.pending_notifications_count || 0, mail.title, mail.content);

    // 5. Update state
    await env.DB.prepare('UPDATE user_notification_preferences SET last_notified_at = ?, pending_notifications_count = 0 WHERE user_id = ?').bind(now, mail.recipient_id).run();
    await env.DB.prepare('UPDATE mail SET notification_sent = 1 WHERE id = ?').bind(mailId).run();
    
    return mailId;
  },

  sendGroupedPush: async (env: any, userId: string, type: string, mailId: string, pendingCount: number, originalTitle: string, originalContent: string) => {
    let title = originalTitle;
    let body = originalContent;
    
    if (pendingCount > 0) {
      title = 'EcoStride';
      body = `You have ${pendingCount + 1} new notifications.`;
    }

    const devices = await env.DB.prepare('SELECT fcm_token FROM user_devices WHERE user_id = ? AND active = 1').bind(userId).all();
    if (!devices.results || devices.results.length === 0) {
      console.warn(`[Push] No active devices found registered for user: ${userId}`);
      return;
    }

    const tokens = devices.results.map((r: any) => r.fcm_token);
    const accessToken = await notificationService.getFcmAccessToken(env);
    if (!accessToken) {
      console.error('[Push] Could not generate FCM access token.');
      return;
    }

    for (const token of tokens) {
      try {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: {
              token: token,
              notification: { title, body },
              data: { type, mailId },
              android: {
                priority: "high"
              }
            }
          })
        });

        if (!response.ok) {
          const err = await response.json() as any;
          console.error(`[Push] FCM send error for token ${token.substring(0, 15)}...:`, err);
          if (err.error?.status === 'NOT_FOUND' || err.error?.status === 'UNREGISTERED') {
            // Token invalid, mark inactive
            await env.DB.prepare('UPDATE user_devices SET active = 0 WHERE fcm_token = ?').bind(token).run();
          }
        } else {
          console.log(`[Push] Successfully dispatched FCM push to device: ${token.substring(0, 15)}...`);
        }
      } catch (fcmErr) {
        console.error('[Push] Network/HTTP error sending FCM push:', fcmErr);
      }
    }
  },

  getFcmAccessToken: async (env: any) => {
    if (!env.FIREBASE_SERVICE_ACCOUNT) {
      console.warn('FIREBASE_SERVICE_ACCOUNT not configured');
      return null;
    }
    try {
      const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
      const privateKey = await importPKCS8(sa.private_key, 'RS256');
      
      const jwt = await new SignJWT({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token'
      })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
      });

      const data = await resp.json() as any;
      return data.access_token;
    } catch (e) {
      console.error('Failed to get FCM token', e);
      return null;
    }
  },
  
  flushPendingNotifications: async (env: any) => {
    // Find users with pending_notifications_count > 0 who haven't been notified in 5 mins
    const COOLDOWN_MS = 5 * 60 * 1000;
    const now = Date.now();
    const threshold = now - COOLDOWN_MS;
    
    try {
      const users = await env.DB.prepare('SELECT user_id, pending_notifications_count FROM user_notification_preferences WHERE pending_notifications_count > 0 AND last_notified_at < ?').bind(threshold).all();
      
      for (const u of users.results as any[]) {
        await notificationService.sendGroupedPush(env, u.user_id, 'mailbox', 'grouped', u.pending_notifications_count - 1, 'EcoStride', 'You have new notifications.');
        await env.DB.prepare('UPDATE user_notification_preferences SET pending_notifications_count = 0, last_notified_at = ? WHERE user_id = ?').bind(now, u.user_id).run();
      }
    } catch(e) {}
  }
};
