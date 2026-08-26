import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { decodeJwt, SignJWT, importPKCS8 } from 'jose';
import { checkAndAwardBadges } from './badgeEngine';
import { AwsClient } from 'aws4fetch';
import { authoritiesRouter } from './authorities';
import { cityEventsRouter } from './cityEvents';
import { isValidLocation } from './locationData';
import { notificationService } from './notificationService';

export { CommunityChatRoom } from './CommunityChatRoom';
export { IssueConversationDO } from './IssueConversationDO';

export function parseFirebaseJwt(token: string): any | null {
  try {
    if (!token) return null;
    const payload = decodeJwt(token);
    if (!payload || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

type Bindings = {
  DB: D1Database;
  AI: any;
  FIREBASE_PROJECT_ID: string;
  RESEND_API_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
  CHAT_ROOM: DurableObjectNamespace;
  ISSUE_CHAT: DurableObjectNamespace;
  AVATARS_BUCKET: R2Bucket;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
};

type Variables = {
  user: any;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.use('*', cors());

export async function deleteFirebaseAuthUser(env: Bindings, uid: string) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
  }
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

  const privateKey = await importPKCS8(sa.private_key, 'RS256');
  const jwt = await new SignJWT({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/identitytoolkit'
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  if (!tokenRes.ok) throw new Error('Failed to get Google OAuth token');
  const tokenData = await tokenRes.json() as any;
  const accessToken = tokenData.access_token;

  const delRes = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:delete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ localId: uid })
  });

  if (!delRes.ok) {
    const errData = await delRes.text();
    console.error('Failed to delete Firebase user:', errData);
    throw new Error('Failed to delete user from Firebase Auth');
  }
}

app.get('/api/debug-schema', async (c) => {
  const schema = await c.env.DB.prepare('PRAGMA table_info(chat_messages)').all();
  return c.json(schema.results);
});

// Authentication Middleware
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return next();
  }

  // Public routes
  if (
    c.req.path === '/api/check-username' ||
    c.req.path.startsWith('/api/authorities/verify-token') ||
    c.req.path.startsWith('/api/chat/community/') ||
    (c.req.path.startsWith('/api/guilds') && c.req.method === 'GET')
  ) {
    return next();
  }

  let token = '';
  const authHeader = c.req.header('Authorization');
  const wsProtocol = c.req.header('Sec-WebSocket-Protocol');
  const tokenFromQuery = c.req.query('wsToken');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (tokenFromQuery) {
    // WebSocket connections pass the token as a query param (JWT dots are invalid in Sec-WebSocket-Protocol)
    token = tokenFromQuery;
  } else if (wsProtocol) {
    token = wsProtocol.split(',')[0].trim();
  }

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = parseFirebaseJwt(token);
  if (!payload || !payload.sub) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('user', payload);
  await next();
});

// GET verify authority token
app.get('/api/authorities/verify-token/:token', async (c) => {
  const rawToken = c.req.param('token');
  if (!rawToken) return c.json({ error: 'Token is required' }, 400);

  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const invitation: any = await c.env.DB.prepare(
    'SELECT email, expires_at, used, country, state, city FROM authority_invitations WHERE token_hash = ?'
  ).bind(tokenHash).first();

  if (!invitation) return c.json({ error: 'Invalid token' }, 404);
  if (invitation.used === 1) return c.json({ error: 'Token has already been used' }, 400);
  if (invitation.expires_at < Date.now()) return c.json({ error: 'Token has expired' }, 400);

  return c.json({
    success: true,
    email: invitation.email,
    country: invitation.country,
    state: invitation.state,
    city: invitation.city
  });
});

// POST register authority
app.post('/api/authorities/register', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub || !jwtUser.email) return c.json({ error: 'Unauthorized. Valid Firebase session required.' }, 401);

  const body = await c.req.json();
  const rawToken = body.token;
  if (!rawToken) return c.json({ error: 'Invitation token is required' }, 400);

  const name = body.name || jwtUser.name || 'Authority';
  const position = body.position || '';
  const avatar = body.avatar || null;
  const country = body.country || '';
  const state = body.state || '';
  const city = body.city || '';

  if (!country || !state || !city || !isValidLocation(country, state, city)) {
    return c.json({ error: 'Valid country, state, and city jurisdiction are required' }, 400);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const invitation: any = await c.env.DB.prepare(
    'SELECT email FROM authority_invitations WHERE token_hash = ? AND used = 0 AND expires_at > ?'
  ).bind(tokenHash, Date.now()).first();

  if (!invitation) return c.json({ error: 'Invalid, used, or expired token' }, 400);

  if (invitation.email.toLowerCase() !== jwtUser.email.toLowerCase()) {
    return c.json({ error: 'Authenticated email does not match invitation email' }, 403);
  }

  // Atomic token consumption
  const updateResult = await c.env.DB.prepare(
    'UPDATE authority_invitations SET used = 1 WHERE token_hash = ? AND used = 0 AND expires_at > ?'
  ).bind(tokenHash, Date.now()).run();

  if (!updateResult.success || updateResult.meta.changes !== 1) {
    return c.json({ error: 'Failed to consume token. It may have just been used.' }, 400);
  }

  // Generate a player_id for the new user
  let playerId = '';
  let isUnique = false;
  while (!isUnique) {
    playerId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE player_id = ?').bind(playerId).first();
    if (!existing) isUnique = true;
  }

  // Ensure columns exist (auto-migration) to prevent 500 errors
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN position TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN bio TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN avatar TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN country TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN state TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN city TEXT').run(); } catch (e) { }

  // Upsert user as authority (match by id or email)
  const userExists = await c.env.DB.prepare('SELECT id FROM users WHERE id = ? OR email = ?').bind(jwtUser.sub, jwtUser.email).first() as any;

  // Ensure username uniqueness and validity
  if (!/^[a-zA-Z0-9@_-]+$/.test(name)) {
    return c.json({ error: 'Username contains invalid characters. Only letters, numbers, @, _, and - are allowed.' }, 400);
  }

  const existingName = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(name).first();
  if (existingName) {
    return c.json({ error: 'This username is already taken. Please choose another one.' }, 400);
  }

  if (userExists) {
    return c.json({ error: 'This email is already in use by a regular citizen or merchant. You must use a brand new official email to register as an Authority.' }, 400);
  }

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, username, player_id, role, created_at, position, bio, avatar, country, state, city, coins, total_distance_km) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)'
  ).bind(jwtUser.sub, jwtUser.email, name, playerId, 'authority', Date.now(), position, position, avatar, country, state, city).run();

  return c.json({ success: true });
});

// Mount Authorities Router
app.route('/api/authorities', authoritiesRouter);

// Mount City Events Router
app.route('/api/city-events', cityEventsRouter);

// POST chat image upload
app.post('/api/chat/upload', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const extension = file.name.split('.').pop() || 'webp';
    const objectKey = `chat-images/${jwtUser.sub}-${Date.now()}.${extension}`;

    await c.env.AVATARS_BUCKET.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });

    const publicUrl = `${new URL(c.req.url).origin}/r2/${objectKey}`;

    return c.json({
      success: true,
      publicUrl: publicUrl,
      objectKey: objectKey
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to upload image', details: error.message }, 500);
  }
});

// Check Username Uniqueness
app.get('/api/check-username', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ error: 'Username is required' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  return c.json({ available: !existing });
});

// GET /api/chat/messages/:guildId
app.get('/api/chat/messages/:guildId', async (c) => {
  const guildId = c.req.param('guildId');
  const jwtUser = c.get('user') as any;
  let lastReadAt = 0;
  if (jwtUser && jwtUser.sub) {
    const readRecord = await c.env.DB.prepare('SELECT last_read_at FROM user_chat_reads WHERE user_id = ? AND guild_id = ?').bind(jwtUser.sub, guildId).first() as any;
    if (readRecord) lastReadAt = readRecord.last_read_at;
  }
  const messages = await c.env.DB.prepare('SELECT c.id, c.guild_id, c.sender_id as user_id, u.username, u.avatar, c.content, c.timestamp as created_at, c.is_edited, c.attachment_key FROM chat_messages c LEFT JOIN users u ON c.sender_id = u.id WHERE c.guild_id = ? ORDER BY c.timestamp ASC').bind(guildId).all();
  return c.json({ messages: messages.results, last_read_at: lastReadAt });
});

// GET /api/chat/unread/:guildId
app.get('/api/chat/unread/:guildId', async (c) => {
  const guildId = c.req.param('guildId');
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);

  const readRecord = await c.env.DB.prepare('SELECT last_read_at FROM user_chat_reads WHERE user_id = ? AND guild_id = ?').bind(jwtUser.sub, guildId).first() as any;
  const lastReadAt = readRecord ? readRecord.last_read_at : 0;

  const unreadCountQuery = await c.env.DB.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE guild_id = ? AND timestamp > ?').bind(guildId, lastReadAt).first() as any;
  const unreadCount = unreadCountQuery ? unreadCountQuery.count : 0;

  return c.json({ unread_count: unreadCount });
});

// POST /api/chat/read/:roomId
app.post('/api/chat/read/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);

  const userId = jwtUser.sub;
  const now = Date.now();

  await c.env.DB.prepare(
    'INSERT INTO user_chat_reads (user_id, guild_id, last_read_at) VALUES (?, ?, ?) ON CONFLICT(user_id, guild_id) DO UPDATE SET last_read_at = ?'
  ).bind(userId, roomId, now, now).run();



  return c.json({ success: true });
});

// GET /api/guilds/recommended
app.get('/api/guilds/recommended', async (c) => {
  const guilds = await c.env.DB.prepare(
    'SELECT g.*, (SELECT COUNT(*) FROM users u WHERE u.guild_id = g.id) as member_count, (SELECT SUM(total_trees_planted) FROM users u WHERE u.guild_id = g.id) as total_trees, (SELECT SUM(total_distance_km) FROM users u WHERE u.guild_id = g.id) as total_distance FROM guilds g ORDER BY member_count DESC LIMIT 20'
  ).all();
  return c.json({ guilds: guilds.results });
});

// GET /api/guilds/search
app.get('/api/guilds/search', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ guilds: [] });
  const guilds = await c.env.DB.prepare(
    'SELECT g.*, (SELECT COUNT(*) FROM users u WHERE u.guild_id = g.id) as member_count, (SELECT SUM(total_trees_planted) FROM users u WHERE u.guild_id = g.id) as total_trees, (SELECT SUM(total_distance_km) FROM users u WHERE u.guild_id = g.id) as total_distance FROM guilds g WHERE g.name LIKE ? OR g.id LIKE ? ORDER BY member_count DESC LIMIT 20'
  ).bind(`%${q}%`, `%${q}%`).all();
  return c.json({ guilds: guilds.results });
});

// Serve R2 Objects
app.get('/r2/*', async (c) => {
  // Extract key after /r2/
  const url = new URL(c.req.url);
  const key = url.pathname.replace('/r2/', '');

  const object = await c.env.AVATARS_BUCKET.get(key);
  if (!object) return c.json({ error: 'Not found' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  // Add browser caching (1 year) since the filename has a unique timestamp
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body as any, { headers });
});

// GET user
app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id');

  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN player_id TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN country TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN state TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN city TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN bio TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN unlocked_badges TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN avatar TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN read_mails TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE purchases ADD COLUMN expires_at INTEGER').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN showcased_badges TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN banned_until INTEGER DEFAULT 0').run(); } catch (e) { }

  // Ensure badges are up to date (retroactive awards for existing users)
  await checkAndAwardBadges(c, id);

  const jwtUser = c.get('user') as any;

  let user: any = await c.env.DB.prepare(`
    SELECT users.*, guilds.name as guildName,
    (SELECT COUNT(*) FROM infrastructure_reports WHERE author_id = users.id AND deleted_at IS NULL AND (takedown_status IS NULL OR takedown_status != 'taken-down')) as cases_reported
    FROM users 
    LEFT JOIN guilds ON users.guild_id = guilds.id 
    WHERE users.id = ?
  `).bind(id).first();

  // If user is not found by ID, but caller is authenticated with matching email (e.g. Firebase UID changed/re-created)
  if (!user && jwtUser && jwtUser.email) {
    const userByEmail: any = await c.env.DB.prepare(`
      SELECT users.*, guilds.name as guildName,
      (SELECT COUNT(*) FROM infrastructure_reports WHERE author_id = users.id AND deleted_at IS NULL AND (takedown_status IS NULL OR takedown_status != 'taken-down')) as cases_reported
      FROM users 
      LEFT JOIN guilds ON users.guild_id = guilds.id 
      WHERE users.email = ?
    `).bind(jwtUser.email).first();

    if (userByEmail) {
      // Re-link the user record to the current Firebase UID
      await c.env.DB.prepare('UPDATE users SET id = ? WHERE id = ?').bind(jwtUser.sub, userByEmail.id).run();
      user = userByEmail;
      user.id = jwtUser.sub;
    } else if (jwtUser.email === 'admin123@gmail.com' || (jwtUser.email && jwtUser.email.startsWith('admin'))) {
      // Auto-create admin if it is admin123@gmail.com and no user row exists in D1
      const now = Date.now();
      await c.env.DB.prepare(`
        INSERT INTO users (id, email, username, player_id, role, coins, total_distance_km, total_trees_planted, created_at)
        VALUES (?, ?, 'Admin', '00000001', 'admin', 0, 0, 0, ?)
      `).bind(jwtUser.sub, jwtUser.email, now).run();

      user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.sub).first();
    }
  }

  if (user) {
    const history = await c.env.DB.prepare('SELECT date, distance FROM activity_history WHERE user_id = ? ORDER BY date ASC').bind(user.id).all();
    user.activityHistory = history.results;

    const prefs = await c.env.DB.prepare('SELECT * FROM user_notification_preferences WHERE user_id = ?').bind(user.id).first();
    user.preferences = prefs || {
      push_enabled: 1, mailbox_enabled: 1, social_enabled: 1, news_enabled: 0, daily_reminder_enabled: 1, new_follower_enabled: 1
    };
  }
  return c.json({ user });
});

// POST user (sync auth user to DB or update fields)
app.post('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const jwtUser = c.get('user') as any;

  // Verify identity OR allow if the requesting user is an admin
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
  const requestingDbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const isAdmin = requestingDbUser && requestingDbUser.role === 'admin';

  if (jwtUser.sub !== id && !isAdmin) {
    return c.json({ error: 'Forbidden: Cannot modify other user data' }, 403);
  }

  // Basic upsert or update
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!user) {
    if (!body.username) return c.json({ error: 'Username is required for new users' }, 400);
    if (!/^[a-zA-Z0-9@_-]+$/.test(body.username)) return c.json({ error: 'Username can only contain English letters, numbers, @, _, and -. Spaces and Chinese characters are not allowed.' }, 400);

    // Check if username is already taken
    const existingUsername = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(body.username).first();
    if (existingUsername) return c.json({ error: 'Username is already taken' }, 400);

    // Generate unique 8-digit player_id
    let playerId = '';
    let isUnique = false;
    while (!isUnique) {
      playerId = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 digits
      const existing = await c.env.DB.prepare('SELECT id FROM users WHERE player_id = ?').bind(playerId).first();
      if (!existing) isUnique = true;
    }

    await c.env.DB.prepare(
      'INSERT INTO users (id, email, username, player_id, role, created_at, coins, total_distance_km, country, state, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, body.email || '', body.username, playerId, body.role || 'user', Date.now(), body.coins || 0, body.totalDistanceKm || 0, body.country || null, body.state || null, body.city || null).run();
  } else {
    // Dynamic update
    const updates: string[] = [];
    const values: any[] = [];

    if (body.email !== undefined) { updates.push('email = ?'); values.push(body.email); }
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN player_id TEXT').run(); } catch (e) { }
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN country TEXT').run(); } catch (e) { }
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN state TEXT').run(); } catch (e) { }
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN city TEXT').run(); } catch (e) { }
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN avatar TEXT').run(); } catch (e) { }
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN read_mails TEXT').run(); } catch (e) { }
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN showcased_badges TEXT').run(); } catch (e) { }
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN banned_until INTEGER DEFAULT 0').run(); } catch (e) { }

    if (body.username !== undefined) {
      if (!/^[a-zA-Z0-9@_-]+$/.test(body.username)) return c.json({ error: 'Username contains invalid characters' }, 400);
      const existingUsername = await c.env.DB.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(body.username, id).first();
      if (existingUsername) return c.json({ error: 'Username is already taken' }, 400);
      updates.push('username = ?'); values.push(body.username);
    }
    if (body.role !== undefined) { updates.push('role = ?'); values.push(body.role); }
    if (body.coins !== undefined) { updates.push('coins = ?'); values.push(body.coins); }
    if (body.totalDistanceKm !== undefined) { updates.push('total_distance_km = ?'); values.push(body.totalDistanceKm); }
    if (body.country !== undefined) { updates.push('country = ?'); values.push(body.country); }
    if (body.state !== undefined) { updates.push('state = ?'); values.push(body.state); }
    if (body.city !== undefined) { updates.push('city = ?'); values.push(body.city); }
    if (body.bio !== undefined) { updates.push('bio = ?'); values.push(body.bio); }
    if (body.avatar !== undefined) { updates.push('avatar = ?'); values.push(body.avatar); }
    if (body.unlockedBadges !== undefined) { updates.push('unlocked_badges = ?'); values.push(JSON.stringify(body.unlockedBadges)); }
    if (body.showcasedBadges !== undefined) { updates.push('showcased_badges = ?'); values.push(JSON.stringify(body.showcasedBadges)); }
    if (body.readMails !== undefined) { updates.push('read_mails = ?'); values.push(JSON.stringify(body.readMails)); }

    if (updates.length > 0) {
      values.push(id);
      await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

      await checkAndAwardBadges(c, id);
    }
  }

  if (body.preferences !== undefined) {
    const p = body.preferences;
    await c.env.DB.prepare(`
        INSERT INTO user_notification_preferences (user_id, push_enabled, mailbox_enabled, social_enabled, news_enabled, daily_reminder_enabled, new_follower_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
        push_enabled = excluded.push_enabled,
        mailbox_enabled = excluded.mailbox_enabled,
        social_enabled = excluded.social_enabled,
        news_enabled = excluded.news_enabled,
        daily_reminder_enabled = excluded.daily_reminder_enabled,
        new_follower_enabled = excluded.new_follower_enabled
    `).bind(
      id,
      p.push_enabled ? 1 : 0,
      p.mailbox_enabled ? 1 : 0,
      p.social_enabled ? 1 : 0,
      p.news_enabled ? 1 : 0,
      p.daily_reminder_enabled ? 1 : 0,
      p.new_follower_enabled ? 1 : 0
    ).run();
  }

  return c.json({ success: true });
});

// GET user reported issues
app.get('/api/users/:id/issues', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  if (!jwtUser || jwtUser.sub !== id) return c.json({ error: 'Unauthorized' }, 401);

  const issues = await c.env.DB.prepare(`
    SELECT r.*, u.username as author_username, auth.username as authority_username 
    FROM infrastructure_reports r 
    LEFT JOIN users u ON r.author_id = u.id 
    LEFT JOIN users auth ON r.authority_id = auth.id
    WHERE r.author_id = ? AND r.deleted_at IS NULL 
    ORDER BY r.created_at DESC
  `).bind(id).all();

  const issuesWithUnread = await Promise.all(issues.results.map(async (issue: any) => {
    const guildId = `issue_${issue.id}`;
    const lastReadRecord = await c.env.DB.prepare('SELECT last_read_at FROM user_chat_reads WHERE user_id = ? AND guild_id = ?').bind(id, guildId).first() as any;
    const lastReadAt = lastReadRecord ? lastReadRecord.last_read_at : 0;

    const unreadRecord = await c.env.DB.prepare('SELECT COUNT(*) as unread_count FROM issue_messages WHERE issue_id = ? AND created_at > ? AND sender_id != ?').bind(issue.id, lastReadAt, id).first() as any;

    return {
      ...issue,
      unread_count: unreadRecord ? unreadRecord.unread_count : 0
    };
  }));

  return c.json({ issues: issuesWithUnread });
});

// POST user avatar upload
app.post('/api/users/:id/avatar', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;

  if (!jwtUser || jwtUser.sub !== id) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const formData = await c.req.parseBody();
  const file = formData['file'] as File;

  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }

  // File should already be compressed WebP/JPEG by the frontend
  const extension = file.name.split('.').pop() || 'webp';
  const objectKey = `avatars/${id}-${Date.now()}.${extension}`;

  // Try to delete old avatar to save space
  try {
    const user = await c.env.DB.prepare('SELECT avatar FROM users WHERE id = ?').bind(id).first() as any;
    if (user && user.avatar && user.avatar.includes('/r2/')) {
      const oldUrl = new URL(user.avatar);
      const oldKey = oldUrl.pathname.replace('/r2/', '');
      await c.env.AVATARS_BUCKET.delete(oldKey);
    }
  } catch (err) {
    console.warn("Failed to delete old avatar:", err);
  }

  // Convert File to ArrayBuffer for R2
  const arrayBuffer = await file.arrayBuffer();

  // Upload to R2 Bucket
  await c.env.AVATARS_BUCKET.put(objectKey, arrayBuffer, {
    httpMetadata: { contentType: file.type }
  });

  // Construct the public URL using the Worker's domain to ensure it works in local dev and prod
  const url = new URL(c.req.url);
  const publicUrl = `${url.origin}/r2/${objectKey}`;

  // Update Database
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN avatar TEXT').run(); } catch (e) { }
  await c.env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(publicUrl, id).run();

  return c.json({ success: true, avatarUrl: publicUrl });
});

// GET chat image presigned URL
app.get('/api/chat/presigned-url', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const extension = c.req.query('ext') || 'webp';

  if (!c.env.R2_ACCOUNT_ID || !c.env.R2_ACCESS_KEY_ID || !c.env.R2_SECRET_ACCESS_KEY) {
    return c.json({ error: 'R2 API Credentials not configured' }, 500);
  }

  const objectKey = `chat-images/${jwtUser.sub}-${Date.now()}.${extension}`;

  const aws = new AwsClient({
    accessKeyId: c.env.R2_ACCESS_KEY_ID,
    secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
  });

  const endpoint = new URL(`https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/ecostride/${objectKey}`);
  endpoint.searchParams.set('X-Amz-Expires', '3600');

  try {
    const signed = await aws.sign(endpoint, {
      method: 'PUT',
      aws: { signQuery: true }
    });

    const url = new URL(c.req.url);
    const publicUrl = `${url.origin}/r2/${objectKey}`;

    return c.json({
      success: true,
      uploadUrl: signed.url,
      publicUrl: publicUrl,
      objectKey: objectKey
    });
  } catch (err: any) {
    console.error('Error generating presigned URL:', err);
    return c.json({ error: 'Failed to generate upload URL' }, 500);
  }
});

// DELETE user
app.delete('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;

  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
  const requestingDbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const isAdmin = requestingDbUser && requestingDbUser.role === 'admin';

  if (jwtUser.sub !== id && !isAdmin) {
    return c.json({ error: 'Forbidden: Cannot delete other user data' }, 403);
  }

  try {
    // Check if the user is a merchant
    const userRoleCheck: any = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
    if (userRoleCheck && userRoleCheck.role === 'merchant') {
      const ownedMerchants = await c.env.DB.prepare('SELECT id, store_name FROM merchants WHERE owner_id = ?').bind(id).all();
      for (const m of (ownedMerchants.results as any[])) {
        const storeName = m.store_name || 'a merchant';
        // 1. Find all items owned by this specific merchant shop
        const items = await c.env.DB.prepare('SELECT id, name, price FROM point_store WHERE merchant_id = ? OR merchant_id = ?').bind(m.id, id).all();
        const itemIds = items.results.map((i: any) => i.id);

        // 2. Soft delete items from point_store
        await c.env.DB.prepare('UPDATE point_store SET status = ? WHERE merchant_id = ? OR merchant_id = ?').bind('disabled', m.id, id).run();

        // 3. Process active purchases and refund users
        if (itemIds.length > 0) {
          for (const itemId of itemIds) {
            const item = items.results.find((i: any) => i.id === itemId);
            if (!item) continue;
            const purchases = await c.env.DB.prepare('SELECT id, user_id FROM purchases WHERE item_id = ? AND status = ?').bind(itemId, 'active').all();

            for (const p of purchases.results as any[]) {
              // Refund user
              await c.env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(item.price, p.user_id).run();

              // Disable purchase
              await c.env.DB.prepare('UPDATE purchases SET status = ? WHERE id = ?').bind('disabled_by_admin', p.id).run();

              // Send mail notification
              const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              const content = `We're sorry, but the voucher "${item.name}" from ${storeName} has been disabled because the merchant has closed their account. Your ${item.price} Eco-Coins have been refunded to your account.`;
              await notificationService.createMailAndNotify(c.env, {
                id: mailId,
                title: 'Voucher Disabled & Refunded',
                content: content,
                sender: 'System Admin',
                recipient_type: 'user',
                recipient_id: p.user_id,
                notification_type: 'mailbox',
                notification_priority: 'high'
              });
            }
          }
        }
      }

      // 4. Delete the merchant records and their pending applications
      await c.env.DB.prepare('DELETE FROM merchants WHERE owner_id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM applications WHERE owner_id = ?').bind(id).run();
    }

    // Delete from related tables first
    await c.env.DB.prepare('DELETE FROM activity_history WHERE user_id = ?').bind(id).run();

    // To avoid SQLite FOREIGN KEY constraint violations, we must reassign trees and signposts 
    // rather than just leaving them pointing to a deleted user ID.
    await c.env.DB.prepare(`
    INSERT OR IGNORE INTO users (id, email, username, player_id, role, created_at, coins, total_distance_km) 
    VALUES ('deleted_user', 'deleted@ecostride.app', 'Unknown Player', '00000000', 'user', 0, 0, 0)
  `).run();

    await c.env.DB.prepare('UPDATE trees SET author_id = ? WHERE author_id = ?').bind('deleted_user', id).run();
    await c.env.DB.prepare('UPDATE signposts SET author_id = ? WHERE author_id = ?').bind('deleted_user', id).run();

    // ONLY delete purchases from the system point store. 
    // Purchases from a merchant store (merchant_id IS NOT NULL) are retained so the merchant can still see their sales history.
    // Reassign retained purchases to 'deleted_user' to avoid FK violation
    await c.env.DB.prepare('UPDATE purchases SET user_id = ? WHERE user_id = ? AND merchant_id IS NOT NULL').bind('deleted_user', id).run();
    await c.env.DB.prepare('DELETE FROM purchases WHERE user_id = ? AND merchant_id IS NULL').bind(id).run();

    // Reassign authority-related tables to 'deleted_user' to avoid FK violations
    await c.env.DB.prepare('UPDATE infrastructure_reports SET author_id = ? WHERE author_id = ?').bind('deleted_user', id).run();
    await c.env.DB.prepare("UPDATE infrastructure_reports SET authority_id = NULL, status = CASE WHEN status = 'in-progress' THEN 'pending' ELSE status END WHERE authority_id = ?").bind(id).run();
    await c.env.DB.prepare('UPDATE authority_tasks SET created_by = ? WHERE created_by = ?').bind('deleted_user', id).run();
    await c.env.DB.prepare('UPDATE issue_messages SET sender_id = ? WHERE sender_id = ?').bind('deleted_user', id).run();
    await c.env.DB.prepare('UPDATE report_activity SET actor_id = ? WHERE actor_id = ?').bind('deleted_user', id).run();
    await c.env.DB.prepare('UPDATE authority_invitations SET created_by = ? WHERE created_by = ?').bind('deleted_user', id).run();

    // Try to delete Firebase Auth user. (If not configured or errors, we log it but don't fail the DB deletion)
    try {
      await deleteFirebaseAuthUser(c.env, id);
    } catch (authErr) {
      console.error("Failed to delete Firebase Auth user (could be local dev or already deleted):", authErr);
    }

    // Then delete user from D1
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    return c.json({ success: true });
  } catch (err: any) {
    console.error("DELETE user error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// POST ban user
app.post('/api/admin/users/:id/ban', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);

  const requestingDbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const isAdmin = requestingDbUser && requestingDbUser.role === 'admin';
  if (!isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json();
  const bannedUntil = body.bannedUntil || 0;

  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN banned_until INTEGER DEFAULT 0').run(); } catch (e) { }
  await c.env.DB.prepare('UPDATE users SET banned_until = ? WHERE id = ?').bind(bannedUntil, id).run();

  return c.json({ success: true, bannedUntil });
});

// POST invite authority
app.post('/api/admin/invite-authority', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);

  const requestingDbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const isAdmin = requestingDbUser && (requestingDbUser as any).role === 'admin';
  if (!isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json();
  const email = body.email;
  const country = body.country || null;
  const state = body.state || null;
  const city = body.city || null;

  const locationParts = [city, state, country].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : null;

  if (!email || typeof email !== 'string') return c.json({ error: 'Valid email is required' }, 400);

  const rawToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');

  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO authority_invitations (id, email, token_hash, expires_at, used, created_at, created_by, country, state, city) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)'
  ).bind(id, email, tokenHash, expiresAt, now, jwtUser.sub, country, state, city).run();

  const reqOrigin = c.req.header('origin') || c.req.header('referer')?.replace(/\/$/, '') || new URL(c.req.url).origin;
  const registrationUrl = `${reqOrigin}/authority/register/${rawToken}`;

  const resendApiKey = c.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 32px; text-align: center;">
            <h1 style="color: #3b82f6; margin: 0; font-size: 28px;">EcoStride <span style="color:white;">Admin</span></h1>
          </div>
          <div style="padding: 32px; background-color: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">Official Authority Invitation</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">
              You have been invited by the EcoStride administration team to join as an official Authority.
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">
              By accepting this invitation, you will be able to manage reported environmental issues, communicate with citizens, and oversee your jurisdiction.
            </p>
            ${location ? `
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0;">
              <p style="color: #334155; font-size: 15px; margin: 0;">
                <strong>Assigned Jurisdiction:</strong> ${location}
              </p>
            </div>
            ` : ''}
            <div style="text-align: center; margin: 32px 0;">
              <a href="${registrationUrl}" style="background-color: #3b82f6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Accept Invitation & Register
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 0;">
              This link is unique to you and will expire in 7 days. If you did not expect this invitation, please ignore this email.
            </p>
          </div>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'EcoStride <admin@ecostride.cc>',
          to: [email],
          subject: 'You are invited to join EcoStride as an Authority',
          html: emailHtml
        })
      });
    } catch (e) {
      console.error('Failed to send invitation email:', e);
      // We still return success since the token was created in DB, 
      // but maybe the email failed due to sandbox limits.
    }
  }

  return c.json({ success: true, registrationUrl, expiresAt, emailSent: !!resendApiKey });
});


app.post('/api/walks/start', async (c) => {
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);

  // BUG 4 FIX: Auto-close any existing active walk for this user
  const existing = await c.env.DB.prepare(
    'SELECT id FROM walk_sessions WHERE user_id = ? AND status = ?'
  ).bind(user.sub, 'active').first();

  if (existing) {
    await c.env.DB.prepare(
      'UPDATE walk_sessions SET status = ?, ended_at = ?, updated_at = ? WHERE id = ?'
    ).bind('completed', new Date().toISOString(), new Date().toISOString(), existing.id).run();
  }

  const walkId = `walk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const startedAt = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO walk_sessions (id, user_id, started_at, status) VALUES (?, ?, ?, ?)'
  ).bind(walkId, user.sub, startedAt, 'active').run();

  return c.json({ walkId, startedAt });
});

app.post('/api/walks/:walkId/end', async (c) => {
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const walkId = c.req.param('walkId');
  const body = await c.req.json();
  const reportedDistance = body.distance_km || 0;
  const cheatDistance = body.cheat_distance_km || 0;
  const spoofedCount = body.spoofed_count || 0;

  const activityTime = body.activity_time_minutes || {};

  try { await c.env.DB.prepare('ALTER TABLE walk_sessions ADD COLUMN cheat_distance_km REAL DEFAULT 0').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE walk_sessions ADD COLUMN spoofed_count INTEGER DEFAULT 0').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE walk_sessions ADD COLUMN activity_time_minutes TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE walk_sessions ADD COLUMN penalty_status TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE walk_sessions ADD COLUMN steps INTEGER DEFAULT 0').run(); } catch (e) { }

  const walkRecord = await c.env.DB.prepare('SELECT * FROM walk_sessions WHERE id = ?').bind(walkId).first();

  if (!walkRecord) return c.json({ error: 'Walk session not found' }, 404);
  if (walkRecord.user_id !== user.sub) return c.json({ error: 'Unauthorized' }, 401);
  if (walkRecord.status !== 'active') return c.json({ error: 'Walk session already completed' }, 400);

  const startedAt = new Date(walkRecord.started_at as string);
  const endedAt = new Date();
  const durationSec = (endedAt.getTime() - startedAt.getTime()) / 1000;
  const durationMinutes = Math.round(durationSec / 60);

  let coinsAwarded = 0;
  let penaltyStatus = 'NORMAL';
  let penaltyReason = '';
  
  // Total physical distance moved
  const totalDistanceKm = reportedDistance + cheatDistance;
  const distanceMeters = totalDistanceKm * 1000;

  // Multi-Sensor Deterministic Classification
  const speedKmh = durationSec > 0 ? (totalDistanceKm) / (durationSec / 3600) : 0;

  let validatedDistance = reportedDistance;

  // 1. Zero Tolerance: Mock Location / Spoofing
  if (spoofedCount > 0) {
    penaltyStatus = 'CHEATER_SPOOFING';
    penaltyReason = 'Mock location provider or developer simulation detected.';
    validatedDistance = 0;
    coinsAwarded = 0;
  } 
  // 2. Zero Tolerance: Phone Shaker
  // Removed CHEATER_SHAKER due to pedometer removal.
  const totalDistance = validatedDistance + cheatDistance;
  
  if (cheatDistance <= 0) {
    // Normal session
    penaltyStatus = 'NORMAL';
    penaltyReason = '';
    coinsAwarded = Math.floor(validatedDistance * 17);
  } else if (validatedDistance <= 0) {
    // 100% Cheat
    penaltyStatus = 'VEHICLE_ONLY';
    penaltyReason = '100% vehicle usage detected.';
    validatedDistance = 0;
    coinsAwarded = 0;
  } else {
    // Mixed: cheatDistance > 0 && validatedDistance > 0
    const cheatRatio = cheatDistance / totalDistance;
    if (cheatRatio >= 0.95) {
      penaltyStatus = 'VEHICLE_ONLY';
      penaltyReason = 'Excessive vehicle usage detected (>95%).';
      validatedDistance = 0;
      coinsAwarded = 0;
    } else {
      penaltyStatus = 'MIXED_COMMUTE';
      penaltyReason = 'Vehicle usage detected and deducted.';
      coinsAwarded = Math.floor(validatedDistance * 17);
    }
  }

  await c.env.DB.prepare(
    'UPDATE walk_sessions SET ended_at = ?, distance_km = ?, cheat_distance_km = ?, spoofed_count = ?, activity_time_minutes = ?, penalty_status = ?, status = ?, coins_awarded = ?, updated_at = ? WHERE id = ?'
  ).bind(
    endedAt.toISOString(),
    validatedDistance,
    cheatDistance,
    spoofedCount,
    JSON.stringify(activityTime),
    penaltyStatus,
    'completed',
    coinsAwarded,
    endedAt.toISOString(),
    walkId
  ).run();

  if (coinsAwarded > 0) {
    await c.env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?')
      .bind(coinsAwarded, user.sub).run();
  }

  return c.json({
    success: true,
    distance_km: validatedDistance,
    cheat_distance_km: cheatDistance,
    coinsAwarded,
    penaltyStatus,
    penaltyReason
  });
});

app.get('/api/map-data', async (c) => {
  // Ensure columns exist (fail silently if they already exist)
  try { await c.env.DB.prepare('ALTER TABLE signposts ADD COLUMN likes INTEGER DEFAULT 0').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE signposts ADD COLUMN liked_by TEXT DEFAULT "[]"').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE signposts ADD COLUMN images TEXT DEFAULT "[]"').run(); } catch (e) { }

  const trees = await c.env.DB.prepare('SELECT trees.*, users.username as authorUsername, users.email as authorEmail, guilds.name as guildName FROM trees LEFT JOIN users ON trees.author_id = users.id LEFT JOIN guilds ON trees.guild_id = guilds.id').all();
  const signposts = await c.env.DB.prepare('SELECT signposts.*, users.username as authorUsername, users.email as authorEmail FROM signposts LEFT JOIN users ON signposts.author_id = users.id').all();
  return c.json({ trees: trees.results, signposts: signposts.results });
});

app.post('/api/trees', async (c) => {
  const body = await c.req.json();
  const id = `tree-${Date.now()}`;
  await c.env.DB.prepare(
    'INSERT INTO trees (id, author_id, lng, lat, guild_id, planted_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, body.authorId, body.lng, body.lat, body.guildId, Date.now()).run();

  // Only increment total_trees_planted, frontend handles coin deduction
  await c.env.DB.prepare('UPDATE users SET total_trees_planted = total_trees_planted + 1 WHERE id = ?').bind(body.authorId).run();

  await checkAndAwardBadges(c, body.authorId);

  return c.json({ success: true, id });
});

app.delete('/api/trees/:id', async (c) => {
  const id = c.req.param('id');
  // Need to get the author to refund
  const tree = await c.env.DB.prepare('SELECT author_id FROM trees WHERE id = ?').bind(id).first();
  if (tree) {
    await c.env.DB.prepare('DELETE FROM trees WHERE id = ?').bind(id).run();
    await c.env.DB.prepare('UPDATE users SET coins = coins + 100, total_trees_planted = MAX(0, total_trees_planted - 1) WHERE id = ?').bind(tree.author_id).run();
  }
  return c.json({ success: true });
});

app.post('/api/signposts', async (c) => {
  const body = await c.req.json();
  const id = `sp-${Date.now()}`;

  try { await c.env.DB.prepare('ALTER TABLE signposts ADD COLUMN images TEXT DEFAULT "[]"').run(); } catch (e) { }

  await c.env.DB.prepare(
    'INSERT INTO signposts (id, author_id, lng, lat, message, emoji, category, created_at, expires_at, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.authorId, body.lng, body.lat, body.message, body.emoji, body.category, Date.now(), Date.now() + 24 * 60 * 60 * 1000, JSON.stringify(body.images || [])).run();

  return c.json({ success: true, id });
});

app.post('/api/signposts/images', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);

  const formData = await c.req.parseBody();
  const file = formData['file'] as File;
  if (!file) return c.json({ error: 'No file provided' }, 400);

  const extension = file.name.split('.').pop() || 'webp';
  const objectKey = `signposts/${jwtUser.sub}-${Date.now()}.${extension}`;

  const arrayBuffer = await file.arrayBuffer();
  await c.env.AVATARS_BUCKET.put(objectKey, arrayBuffer, {
    httpMetadata: { contentType: file.type }
  });

  const url = new URL(c.req.url);
  const publicUrl = `${url.origin}/r2/${objectKey}`;

  return c.json({ success: true, url: publicUrl });
});

app.delete('/api/signposts/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const userId = user.sub;

  const signpost: any = await c.env.DB.prepare('SELECT author_id FROM signposts WHERE id = ?').bind(id).first();
  if (!signpost) return c.json({ error: 'Not found' }, 404);
  if (signpost.author_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  await c.env.DB.prepare('DELETE FROM signposts WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

app.get('/api/signposts/:id', async (c) => {
  const id = c.req.param('id');
  const signpost = await c.env.DB.prepare('SELECT signposts.*, users.username as authorUsername, users.email as authorEmail FROM signposts LEFT JOIN users ON signposts.author_id = users.id WHERE signposts.id = ?').bind(id).first();
  if (!signpost) return c.json({ error: 'Not found' }, 404);
  return c.json({ signpost });
});

app.post('/api/signposts/:id/share', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const userId = user.sub;

  const body = await c.req.json();
  const { targetId } = body;
  if (!targetId) return c.json({ error: 'Target ID required' }, 400);

  const signpost: any = await c.env.DB.prepare('SELECT emoji, message FROM signposts WHERE id = ?').bind(id).first();
  if (!signpost) return c.json({ error: 'Signpost not found' }, 404);

  const userCheck: any = await c.env.DB.prepare('SELECT username, avatar FROM users WHERE id = ?').bind(userId).first();
  const username = userCheck ? userCheck.username : 'Unknown User';
  const avatar = userCheck ? userCheck.avatar : null;

  const content = `[SIGNPOST:${id}:${signpost.emoji || '📍'}:${signpost.message || 'Shared a signpost'}]`;
  const msgId = crypto.randomUUID();
  const createdAt = Date.now();

  await c.env.DB.prepare(
    "INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp, attachment_key) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(msgId, targetId, userId, username, content, createdAt, null).run();

  const payload = {
    action: 'message',
    guild_id: targetId,
    id: msgId,
    user_id: userId,
    username: username,
    avatar: avatar,
    content: content,
    created_at: createdAt,
    is_edited: 0,
    attachment_key: null
  };

  const url = new URL(c.req.url);
  const DOUrl = `${url.origin}/api/chat/community/${targetId}/system_message`;
  await c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(targetId)).fetch(new Request(DOUrl, {
    method: 'POST',
    body: JSON.stringify(payload)
  }));

  return c.json({ success: true, messageId: msgId });
});

app.post('/api/signposts/:id/like', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const userId = body.userId;

  if (!userId) return c.json({ error: 'User ID required' }, 400);

  const signpost: any = await c.env.DB.prepare('SELECT likes, liked_by, author_id FROM signposts WHERE id = ?').bind(id).first();
  if (!signpost) return c.json({ error: 'Signpost not found' }, 404);

  let likedBy = [];
  try { likedBy = JSON.parse(signpost.liked_by || '[]'); } catch (e) { }

  if (likedBy.includes(userId)) {
    return c.json({ error: 'Already liked' }, 400);
  }

  likedBy.push(userId);
  const newLikes = (signpost.likes || 0) + 1;

  await c.env.DB.prepare('UPDATE signposts SET likes = ?, liked_by = ? WHERE id = ?')
    .bind(newLikes, JSON.stringify(likedBy), id).run();

  await checkAndAwardBadges(c, signpost.author_id);

  return c.json({ success: true, likes: newLikes, likedBy });
});

// POST /api/issues/images (Direct Multipart Upload for Issue Photos)
app.post('/api/issues/images', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);

  const formData = await c.req.parseBody();
  const file = formData['file'] as File;
  if (!file) return c.json({ error: 'No file provided' }, 400);

  const extension = file.name.split('.').pop() || 'webp';
  const objectKey = `issues/${jwtUser.sub}-${Date.now()}.${extension}`;

  const arrayBuffer = await file.arrayBuffer();
  await c.env.AVATARS_BUCKET.put(objectKey, arrayBuffer, {
    httpMetadata: { contentType: file.type || 'image/webp' }
  });

  const url = new URL(c.req.url);
  const publicUrl = `${url.origin}/r2/${objectKey}`;

  return c.json({ success: true, url: publicUrl, objectKey });
});

// POST /api/issues
app.post('/api/issues', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();

  if (!body.title || !body.lat || !body.lng) return c.json({ error: 'Missing fields' }, 400);

  const country = body.country || null;
  const state = body.state || null;
  const city = body.city || null;

  if (!country || !state || !city || !isValidLocation(country, state, city)) {
    return c.json({ error: 'Valid country, state, and city jurisdiction are required' }, 400);
  }

  try { await c.env.DB.prepare('ALTER TABLE infrastructure_reports ADD COLUMN country TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE infrastructure_reports ADD COLUMN state TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE infrastructure_reports ADD COLUMN city TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE infrastructure_reports ADD COLUMN takedown_status TEXT').run(); } catch (e) { }
  try { await c.env.DB.prepare('ALTER TABLE infrastructure_reports ADD COLUMN takedown_reason TEXT').run(); } catch (e) { }

  const now = Date.now();

  // Calculate start of today in UTC+8
  const dateObj = new Date(now);
  const offsetMs = 8 * 60 * 60 * 1000;
  const localNow = new Date(dateObj.getTime() + offsetMs);

  const yy = String(localNow.getUTCFullYear()).slice(-2);
  const m = String(localNow.getUTCMonth() + 1);
  const d = String(localNow.getUTCDate());
  const dateStr = `${yy}${m}${d}`;

  const startOfDayUTC = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate())).getTime() - offsetMs;

  const { results: countResults } = await c.env.DB.prepare('SELECT COUNT(*) as c FROM infrastructure_reports WHERE created_at >= ?').bind(startOfDayUTC).all();
  const todayCount = (countResults[0]?.c as number) || 0;
  const sequence = todayCount;

  const id = `ISSUE-${sequence}-${dateStr}`;

  const insertIssue = c.env.DB.prepare(`
    INSERT INTO infrastructure_reports 
    (id, author_id, title, description, lat, lng, photos, specific_location, country, state, city, status, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).bind(id, jwtUser.sub, body.title, body.description || '', body.lat, body.lng, JSON.stringify(body.photos || []), body.specific_location || null, country, state, city, now, now);

  const activityId = crypto.randomUUID();
  const insertActivity = c.env.DB.prepare(`
    INSERT INTO report_activity 
    (id, report_id, actor_id, actor_type, activity_type, title, description, created_at) 
    VALUES (?, ?, ?, 'user', 'REPORT_CREATED', 'Report Submitted', ?, ?)
  `).bind(activityId, id, jwtUser.sub, 'The user submitted the initial report.', now);

  await c.env.DB.batch([insertIssue, insertActivity]);

  return c.json({ success: true, id });
});

// GET /api/issues/:id/timeline
app.get('/api/issues/:id/timeline', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);

  // Security: check if user can view timeline (author or authority within jurisdiction/assigned)
  const issue: any = await c.env.DB.prepare('SELECT author_id, authority_id, country, state, city FROM infrastructure_reports WHERE id = ?').bind(id).first();
  if (!issue) return c.json({ error: 'Not found' }, 404);

  const userRoleQuery: any = await c.env.DB.prepare('SELECT role, country, state, city FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const isAuthority = userRoleQuery?.role === 'authority';
  const isJurisdictionOrAssigned = isAuthority && (
    (userRoleQuery.country === issue.country && userRoleQuery.state === issue.state && userRoleQuery.city === issue.city) ||
    issue.authority_id === jwtUser.sub
  );

  if (!isAuthority && issue.author_id !== jwtUser.sub) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (isAuthority && !isJurisdictionOrAssigned && issue.author_id !== jwtUser.sub) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Return events newest first (DESC)
  const timeline = await c.env.DB.prepare(`
    SELECT a.*, u.username as actor_username, u.avatar as actor_avatar 
    FROM report_activity a 
    LEFT JOIN users u ON a.actor_id = u.id 
    WHERE a.report_id = ? 
    ORDER BY a.created_at DESC
  `).bind(id).all();

  return c.json({ timeline: timeline.results });
});

// POST /api/issues/:id/take-down (User take down issue)
app.post('/api/issues/:id/take-down', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json();
  const reason = body.reason?.trim();
  if (!reason) return c.json({ error: 'Reason is required' }, 400);

  const issue: any = await c.env.DB.prepare('SELECT id, author_id, authority_id, status FROM infrastructure_reports WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!issue) return c.json({ error: 'Issue not found' }, 404);
  if (issue.author_id !== jwtUser.sub) return c.json({ error: 'Forbidden' }, 403);

  const now = Date.now();
  const activityId = crypto.randomUUID();

  if (issue.authority_id || issue.status !== 'pending') {
    // Requires authority approval
    const updateIssue = c.env.DB.prepare('UPDATE infrastructure_reports SET takedown_status = ?, takedown_reason = ?, updated_at = ? WHERE id = ?')
      .bind('requested', reason, now, id);
    const insertActivity = c.env.DB.prepare(`
      INSERT INTO report_activity (id, report_id, actor_id, actor_type, activity_type, title, description, created_at) 
      VALUES (?, ?, ?, 'user', 'TAKEDOWN_REQUESTED', 'Takedown Requested', ?, ?)
    `).bind(activityId, id, jwtUser.sub, `User requested to take down the report. Reason: ${reason}`, now);

    await c.env.DB.batch([updateIssue, insertActivity]);
    return c.json({ success: true, message: 'Takedown request sent for approval', takedown_status: 'requested' });
  } else {
    // Direct takedown
    const updateIssue = c.env.DB.prepare('UPDATE infrastructure_reports SET takedown_status = ?, takedown_reason = ?, updated_at = ? WHERE id = ?')
      .bind('taken-down', reason, now, id);
    const insertActivity = c.env.DB.prepare(`
      INSERT INTO report_activity (id, report_id, actor_id, actor_type, activity_type, title, description, created_at) 
      VALUES (?, ?, ?, 'user', 'ISSUE_TAKEN_DOWN', 'Issue Taken Down', ?, ?)
    `).bind(activityId, id, jwtUser.sub, `User took down the report. Reason: ${reason}`, now);

    await c.env.DB.batch([updateIssue, insertActivity]);
    return c.json({ success: true, message: 'Issue taken down successfully', takedown_status: 'taken-down' });
  }
});

// GET /api/issues
app.get('/api/issues', async (c) => {
  const minLat = c.req.query('minLat');
  const maxLat = c.req.query('maxLat');
  const minLng = c.req.query('minLng');
  const maxLng = c.req.query('maxLng');

  if (!minLat || !maxLat || !minLng || !maxLng) {
    return c.json({ error: 'Bounding box required' }, 400);
  }

  const issues = await c.env.DB.prepare(`
    SELECT r.*, u.username as author_username, auth.username as authority_username
    FROM infrastructure_reports r
    LEFT JOIN users u ON r.author_id = u.id
    LEFT JOIN users auth ON r.authority_id = auth.id
    WHERE r.deleted_at IS NULL AND (r.takedown_status IS NULL OR r.takedown_status != 'taken-down')
      AND r.status != 'resolved'
      AND r.lat >= ? AND r.lat <= ?
      AND r.lng >= ? AND r.lng <= ?
  `).bind(Number(minLat), Number(maxLat), Number(minLng), Number(maxLng)).all();

  return c.json({ issues: issues.results });
});

// GET /api/issues/:id/messages
app.get('/api/issues/:id/messages', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);

  const issue: any = await c.env.DB.prepare('SELECT author_id, authority_id, country, state, city FROM infrastructure_reports WHERE id = ?').bind(id).first();
  if (!issue) return c.json({ error: 'Not found' }, 404);

  const userRoleQuery: any = await c.env.DB.prepare('SELECT role, country, state, city FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const isAuthority = userRoleQuery?.role === 'authority';
  const isJurisdictionOrAssigned = isAuthority && (
    (userRoleQuery.country === issue.country && userRoleQuery.state === issue.state && userRoleQuery.city === issue.city) ||
    issue.authority_id === jwtUser.sub
  );

  if (!isAuthority && issue.author_id !== jwtUser.sub) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  if (isAuthority && !isJurisdictionOrAssigned && issue.author_id !== jwtUser.sub) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const messages = await c.env.DB.prepare('SELECT m.*, u.username as sender_name, u.role as sender_role FROM issue_messages m LEFT JOIN users u ON m.sender_id = u.id WHERE issue_id = ? ORDER BY created_at ASC').bind(id).all();
  return c.json({ messages: messages.results });
});

// POST /api/issues/:id/read
app.post('/api/issues/:id/read', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);

  const guildId = `issue_${id}`;

  await c.env.DB.prepare(`
    INSERT INTO user_chat_reads (user_id, guild_id, last_read_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, guild_id) DO UPDATE SET last_read_at = ?
  `).bind(jwtUser.sub, guildId, Date.now(), Date.now()).run();

  return c.json({ success: true });
});


// GET /api/issues/:id/chat (WebSocket Upgrade)
app.get('/api/issues/:id/chat', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);

  const issue: any = await c.env.DB.prepare('SELECT author_id, authority_id, country, state, city FROM infrastructure_reports WHERE id = ?').bind(id).first();
  if (!issue) return c.json({ error: 'Not found' }, 404);

  const userRoleQuery: any = await c.env.DB.prepare('SELECT role, country, state, city FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const isAuthority = userRoleQuery?.role === 'authority';
  const isJurisdictionOrAssigned = isAuthority && (
    (userRoleQuery.country === issue.country && userRoleQuery.state === issue.state && userRoleQuery.city === issue.city) ||
    issue.authority_id === jwtUser.sub
  );

  if (!isAuthority && issue.author_id !== jwtUser.sub) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (isAuthority && !isJurisdictionOrAssigned && issue.author_id !== jwtUser.sub) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const doId = c.env.ISSUE_CHAT.idFromName(id);
  const stub = c.env.ISSUE_CHAT.get(doId);

  const url = new URL(c.req.url);
  url.searchParams.set('userId', jwtUser.sub);
  // Remove the wsToken before forwarding to the DO - auth is already done
  url.searchParams.delete('wsToken');

  const modifiedRequest = new Request(url.toString(), c.req.raw);
  return stub.fetch(modifiedRequest);
});

// GET /api/issues/:id
app.get('/api/issues/:id', async (c) => {
  const id = c.req.param('id');
  const issue = await c.env.DB.prepare(`
    SELECT r.*, u.username as author_username, u.avatar as author_avatar, auth.username as authority_username
    FROM infrastructure_reports r
    LEFT JOIN users u ON r.author_id = u.id
    LEFT JOIN users auth ON r.authority_id = auth.id
    WHERE r.id = ? AND r.deleted_at IS NULL
  `).bind(id).first();
  if (!issue) return c.json({ error: 'Issue not found' }, 404);
  return c.json({ issue });
});

// POST /api/issues/:id/share
app.post('/api/issues/:id/share', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const userId = user.sub;

  const body = await c.req.json();
  const { targetId } = body;
  if (!targetId) return c.json({ error: 'Target ID required' }, 400);

  const issue: any = await c.env.DB.prepare('SELECT author_id FROM infrastructure_reports WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!issue) return c.json({ error: 'Issue not found' }, 404);

  const userCheck: any = await c.env.DB.prepare('SELECT username, avatar FROM users WHERE id = ?').bind(userId).first();
  const username = userCheck ? userCheck.username : 'Unknown User';
  const avatar = userCheck ? userCheck.avatar : null;

  const content = `[ISSUE:${id}]`;
  const msgId = crypto.randomUUID();
  const createdAt = Date.now();

  await c.env.DB.prepare(
    "INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp, attachment_key) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(msgId, targetId, userId, username, content, createdAt, null).run();

  const payload = {
    action: 'message',
    guild_id: targetId,
    id: msgId,
    user_id: userId,
    username: username,
    avatar: avatar,
    content: content,
    created_at: createdAt,
    is_edited: 0,
    attachment_key: null
  };

  const idQuery: any = await c.env.DB.prepare('SELECT id FROM guilds WHERE id = ?').bind(targetId).first();
  if (idQuery) {
    const doId = c.env.CHAT_ROOM.idFromName(targetId);
    const room = c.env.CHAT_ROOM.get(doId);
    await room.fetch('http://internal/system_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  return c.json({ success: true, messageId: msgId });
});

// --- END ISSUES ---

app.get('/api/settings', async (c) => {
  await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS global_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  const settings = await c.env.DB.prepare('SELECT * FROM global_settings').all();
  const config = settings.results.reduce((acc: any, curr: any) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
  return c.json({ config });
});

app.post('/api/settings', async (c) => {
  try {
    const body = await c.req.json();
    await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS global_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
    if (body.treeResetInterval !== undefined) {
      await c.env.DB.prepare('INSERT INTO global_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind('tree_reset_interval_days', body.treeResetInterval.toString()).run();
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Settings save error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get('/api/leaderboard', async (c) => {
  const userId = c.req.query('userId');

  try { await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_distance ON users(total_distance_km DESC)').run(); } catch (e) { }
  try { await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_coins ON users(coins DESC)').run(); } catch (e) { }

  const baseSelect = "SELECT users.id, users.username, users.guild_id, guilds.name as guildName, users.coins, users.total_distance_km, users.total_trees_planted, users.avatar, users.player_id FROM users LEFT JOIN guilds ON users.guild_id = guilds.id WHERE users.role NOT IN ('admin', 'authority')";

  const topDistance = await c.env.DB.prepare(`${baseSelect} ORDER BY users.total_distance_km DESC, users.id ASC LIMIT 50`).all();
  const topCoins = await c.env.DB.prepare(`${baseSelect} ORDER BY users.coins DESC, users.id ASC LIMIT 50`).all();

  let userRank = null;
  if (userId) {
    const user = await c.env.DB.prepare("SELECT total_distance_km, coins FROM users WHERE id = ?").bind(userId).first();
    if (user) {
      const dist = user.total_distance_km || 0;
      const cns = user.coins || 0;

      const distCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role NOT IN ('admin', 'authority') AND (total_distance_km > ? OR (total_distance_km = ? AND id < ?))").bind(dist, dist, userId).first() as any;
      const coinsCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role NOT IN ('admin', 'authority') AND (coins > ? OR (coins = ? AND id < ?))").bind(cns, cns, userId).first() as any;

      userRank = {
        distanceRank: (distCount?.count || 0) + 1,
        distanceScore: dist,
        coinsRank: (coinsCount?.count || 0) + 1,
        coinsScore: cns
      };
    }
  }

  // Fetch Top Guilds (by territory trees, or just all guilds)
  const topGuilds = await c.env.DB.prepare('SELECT g.id, g.name, (SELECT COUNT(*) FROM trees t JOIN users u ON t.author_id = u.id WHERE u.guild_id = g.id) as territory_trees, (SELECT COUNT(*) FROM users u WHERE u.guild_id = g.id) as member_count FROM guilds g ORDER BY territory_trees DESC LIMIT 50').all();

  return c.json({ topDistance: topDistance.results, topCoins: topCoins.results, userRank, topGuilds: topGuilds.results });
});

app.get('/api/store', async (c) => {
  try {
    try {
      await c.env.DB.prepare("ALTER TABLE point_store ADD COLUMN link TEXT").run();
    } catch (e) {
      // Column likely exists, ignore
    }
    const items = await c.env.DB.prepare("SELECT * FROM point_store WHERE status = 'active' OR status IS NULL").all();
    return c.json({ items: items.results });
  } catch (err: any) {
    console.error("GET /api/store ERROR:", err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/store/buy', async (c) => {
  const body = await c.req.json();
  const { userId, userEmail, itemId, itemName, price, icon } = body;

  const item: any = await c.env.DB.prepare('SELECT merchant_id FROM point_store WHERE id = ?').bind(itemId).first();
  const merchantId = item ? item.merchant_id : null;

  // Frontend handles the coin deduction via syncToAPI, so we only update the stock
  await c.env.DB.prepare('UPDATE point_store SET stock = stock - 1 WHERE id = ? AND stock > 0').bind(itemId).run();

  // Merchant earned coins are kept separate from standard user coins for future use (e.g. subscription discounts)
  // They are calculated dynamically from the purchases table on the merchant dashboard.

  const purchaseId = `purchase-${Date.now()}`;
  await c.env.DB.prepare(
    'INSERT INTO purchases (id, user_id, merchant_id, item_id, item_name, price, status, purchased_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(purchaseId, userId, merchantId, itemId, itemName, price, 'active', Date.now()).run();

  return c.json({ success: true, purchaseId });
});



app.post('/api/activity', async (c) => {
  const body = await c.req.json();
  const jwtUser = c.get('user') as any;
  if (!jwtUser || jwtUser.sub !== body.userId) {
    return c.json({ error: 'Forbidden: Cannot modify other user data' }, 403);
  }

  const id = `act-${Date.now()}`;
  await c.env.DB.prepare(
    'INSERT INTO activity_history (id, user_id, date, distance) VALUES (?, ?, ?, ?)'
  ).bind(id, body.userId, body.date, body.distance).run();

  return c.json({ success: true, id });
});

// Mail
app.get('/api/mail', async (c) => {
  try { await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS user_deleted_mail (user_id TEXT, mail_id TEXT, deleted_at INTEGER, PRIMARY KEY (user_id, mail_id))').run(); } catch (e) { }
  try { await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS user_read_mail (user_id TEXT, mail_id TEXT, read_at INTEGER, PRIMARY KEY (user_id, mail_id))').run(); } catch (e) { }

  let deletedMailIds: string[] = [];
  let readMailIds: string[] = [];
  const jwtUser = c.get('user') as any;
  if (jwtUser && jwtUser.sub) {
    const deleted = await c.env.DB.prepare('SELECT mail_id FROM user_deleted_mail WHERE user_id = ?').bind(jwtUser.sub).all();
    deletedMailIds = deleted.results.map((r: any) => r.mail_id);
    const read = await c.env.DB.prepare('SELECT mail_id FROM user_read_mail WHERE user_id = ?').bind(jwtUser.sub).all();
    readMailIds = read.results.map((r: any) => r.mail_id);
  }

  const mail = await c.env.DB.prepare('SELECT * FROM mail ORDER BY created_at DESC').all();
  let filteredMail = mail.results;
  if (deletedMailIds.length > 0) {
    filteredMail = filteredMail.filter(m => !deletedMailIds.includes(m.id as string));
  }

  const socialTitles = [
    'Friend Request', 'Friend Request Accepted', 'Friend Request Rejected', 'Friend Request Sent', 'Friend Removed',
    'New Join Request', 'Join Request Approved', 'Join Request Rejected', 'Kicked from Community', 'Promoted to Admin'
  ];
  filteredMail = filteredMail.map((m: any) => {
    m.category = (m.action_type === 'guild_join_request' || m.action_type === 'friend_request' || socialTitles.includes(m.title)) ? 'social' : 'mail';
    return m;
  });

  return c.json({ mail: filteredMail, read_mail_ids: readMailIds });
});
app.post('/api/mail', async (c) => {
  const body = await c.req.json();

  let finalRecipientId = body.recipientId || null;
  let finalRecipientName = null;

  if (body.recipientType === 'user' && body.recipientId) {
    const user: any = await c.env.DB.prepare('SELECT id, username FROM users WHERE username = ? OR player_id = ? OR id = ?').bind(body.recipientId, body.recipientId, body.recipientId).first();
    if (!user) {
      return c.json({ success: false, error: 'User not found matching Username or UID' }, 404);
    }
    finalRecipientId = user.id;
    finalRecipientName = user.username;
  } else if (body.recipientType === 'guild' && body.recipientId) {
    const guild: any = await c.env.DB.prepare('SELECT id, name FROM guilds WHERE name = ? OR id = ?').bind(body.recipientId, body.recipientId).first();
    if (!guild) {
      return c.json({ success: false, error: 'Community not found matching name or UID' }, 404);
    }
    finalRecipientId = guild.id;
    finalRecipientName = guild.name;
  }

  // 1. Insert the mail record (broadcasts go to 'all' with no specific recipient_id)
  const mailId = `mail-${Date.now()}`;
  const now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, recipient_name, expires_for_new_users, created_at, notification_type, notification_priority, notification_sent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'
  ).bind(mailId, body.title, body.content, body.sender, body.recipientType, finalRecipientId, finalRecipientName, body.expiresForNewUsers ? 1 : 0, now, 'mailbox', 'high').run();

  // 2. Send push notifications
  if (body.recipientType === 'user' && finalRecipientId) {
    // Targeted: send push to a single user
    await notificationService.sendGroupedPush(c.env, finalRecipientId, 'mailbox', mailId, 0, body.title, body.content);
  } else if (body.recipientType === 'all' || !body.recipientType || body.recipientType === 'everyone') {
    // Broadcast: fan out push to ALL registered devices
    try {
      const accessToken = await notificationService.getFcmAccessToken(c.env);
      if (accessToken) {
        const allDevices = await c.env.DB.prepare('SELECT DISTINCT fcm_token FROM user_devices WHERE active = 1').all();
        for (const device of (allDevices.results || [])) {
          try {
            const response = await fetch(`https://fcm.googleapis.com/v1/projects/${c.env.FIREBASE_PROJECT_ID}/messages:send`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: {
                  token: (device as any).fcm_token,
                  notification: { title: body.title, body: body.content },
                  data: { type: 'mailbox', mailId }
                }
              })
            });
            if (!response.ok) {
              const err = await response.json() as any;
              if (err.error?.status === 'NOT_FOUND' || err.error?.status === 'UNREGISTERED') {
                await c.env.DB.prepare('UPDATE user_devices SET active = 0 WHERE fcm_token = ?').bind((device as any).fcm_token).run();
              }
            }
          } catch (e) { console.error('Failed to send push to device', e); }
        }
      }
    } catch (e) { console.error('Broadcast push failed', e); }
  }

  return c.json({ success: true });
});
app.delete('/api/mail/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM mail WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

app.delete('/api/mail/user/:id', async (c) => {
  const user = c.get('user') as any;
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');

  await c.env.DB.prepare('INSERT OR IGNORE INTO user_deleted_mail (user_id, mail_id, deleted_at) VALUES (?, ?, ?)').bind(user.sub, id, Date.now()).run();
  return c.json({ success: true });
});

app.post('/api/mail/user/batch-delete', async (c) => {
  const user = c.get('user') as any;
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  if (!body.ids || !Array.isArray(body.ids)) return c.json({ error: 'Invalid input' }, 400);

  const now = Date.now();
  for (const mailId of body.ids) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO user_deleted_mail (user_id, mail_id, deleted_at) VALUES (?, ?, ?)').bind(user.sub, mailId, now).run();
  }

  return c.json({ success: true });
});

app.post('/api/mail/user/:id/read', async (c) => {
  const user = c.get('user') as any;
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');

  await c.env.DB.prepare('INSERT OR IGNORE INTO user_read_mail (user_id, mail_id, read_at) VALUES (?, ?, ?)').bind(user.sub, id, Date.now()).run();
  return c.json({ success: true });
});

app.post('/api/mail/user/batch-read', async (c) => {
  const user = c.get('user') as any;
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  if (!body.ids || !Array.isArray(body.ids)) return c.json({ error: 'Invalid input' }, 400);

  const now = Date.now();
  for (const mailId of body.ids) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO user_read_mail (user_id, mail_id, read_at) VALUES (?, ?, ?)').bind(user.sub, mailId, now).run();
  }

  return c.json({ success: true });
});

app.delete('/api/trees', async (c) => {
  await c.env.DB.prepare('DELETE FROM trees').run();
  return c.json({ success: true });
});
app.post('/api/mail/batch-delete', async (c) => {
  const body = await c.req.json();
  if (!body.ids || !Array.isArray(body.ids)) return c.json({ error: 'Invalid input' }, 400);

  // D1 batch delete is best done via individual deletes in a batch or using IN clause.
  // SQLite max variables is usually 999, so for small batches IN clause is fine.
  if (body.ids.length === 0) return c.json({ success: true });

  const placeholders = body.ids.map(() => '?').join(',');
  await c.env.DB.prepare(`DELETE FROM mail WHERE id IN (${placeholders})`).bind(...body.ids).run();

  return c.json({ success: true });
});

// Demo Requests
// Demo Requests
app.get('/api/demo_requests/:id', async (c) => {
  const id = c.req.param('id');
  const req = await c.env.DB.prepare('SELECT * FROM demo_requests WHERE id = ?').bind(id).first();
  return c.json({ demoRequest: req });
});
app.post('/api/demo_requests', async (c) => {
  const body = await c.req.json();
  const { id, email, ipAddress } = body;
  try { await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS demo_requests (id TEXT PRIMARY KEY, email TEXT, ip_address TEXT, status TEXT, requested_at INTEGER)').run(); } catch (e) { }
  await c.env.DB.prepare(
    'REPLACE INTO demo_requests (id, email, ip_address, status, requested_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, email, ipAddress || 'Unknown', 'pending', Date.now()).run();
  return c.json({ success: true });
});
app.put('/api/demo_requests/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare('UPDATE demo_requests SET status = ? WHERE id = ?').bind(body.status, id).run();
  return c.json({ success: true });
});
app.delete('/api/demo_requests/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM demo_requests WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Centralized Merchant Resolution & Authorization Helper
async function resolveAndAuthorizeMerchant(
  c: any,
  merchantSelector: string,
  requireOwnership: boolean = true
): Promise<{ error?: string; status?: number; merchant?: any }> {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) {
    return { error: 'Unauthorized: Authentication required', status: 401 };
  }

  if (!merchantSelector || typeof merchantSelector !== 'string') {
    return { error: 'Invalid merchant ID', status: 400 };
  }

  const cleanId = merchantSelector.trim();

  // 1. Primary lookup by canonical merchants.id
  let merchant: any = await c.env.DB.prepare('SELECT * FROM merchants WHERE id = ?').bind(cleanId).first();

  // 2. Legacy fallback lookup by owner_id ONLY if not found by canonical ID
  if (!merchant) {
    const matchingMerchants = await c.env.DB.prepare('SELECT * FROM merchants WHERE owner_id = ?').bind(cleanId).all();
    if (matchingMerchants.results.length === 1) {
      merchant = matchingMerchants.results[0];
    } else if (matchingMerchants.results.length > 1) {
      return { error: 'Ambiguous merchant selector. Please specify the canonical merchant ID.', status: 400 };
    }
  }

  if (!merchant) {
    return { error: 'Merchant shop not found', status: 404 };
  }

  if (requireOwnership) {
    const isOwner = merchant.owner_id === jwtUser.sub;
    const isAdmin = jwtUser.role === 'admin';
    if (!isOwner && !isAdmin) {
      return { error: 'Forbidden: You do not have permission to manage this merchant shop', status: 403 };
    }
  }

  return { merchant };
}

// Merchants
app.get('/api/merchants', async (c) => {
  const merchants = await c.env.DB.prepare('SELECT * FROM merchants').all();
  return c.json({ merchants: merchants.results });
});
app.post('/api/merchants', async (c) => {
  const body = await c.req.json();
  const id = `merchant-${Date.now()}`;
  await c.env.DB.prepare(
    'INSERT INTO merchants (id, owner_id, store_name, menu_link, location, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.ownerId, body.storeName, body.menuLink || '', body.location ? JSON.stringify(body.location) : null, body.status || 'pending', Date.now()).run();
  return c.json({ success: true, merchantId: id });
});
app.put('/api/merchants/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  if (body.storeName) {
    await c.env.DB.prepare('UPDATE merchants SET status = ?, store_name = ?, menu_link = ?, location = ? WHERE id = ?').bind(body.status, body.storeName, body.menuLink || '', body.location ? JSON.stringify(body.location) : null, id).run();
  } else {
    await c.env.DB.prepare('UPDATE merchants SET status = ? WHERE id = ?').bind(body.status, id).run();
  }
  return c.json({ success: true });
});
app.delete('/api/merchants/:id', async (c) => {
  try {
    const id = c.req.param('id');

    // Find the merchant to get their owner_id and store_name
    const merchant: any = await c.env.DB.prepare('SELECT id, owner_id, store_name FROM merchants WHERE id = ?').bind(id).first();
    if (merchant && merchant.owner_id) {
      const storeName = merchant.store_name;

      // Find all items owned by this specific merchant shop
      const items = await c.env.DB.prepare('SELECT id, name, price FROM point_store WHERE merchant_id = ? OR (merchant_id = ? AND NOT EXISTS (SELECT 1 FROM merchants WHERE owner_id = ? AND id != ?))').bind(merchant.id, merchant.owner_id, merchant.owner_id, merchant.id).all();
      const itemIds = items.results.map((i: any) => i.id);

      // Soft delete items from point_store
      if (itemIds.length > 0) {
        for (const itemId of itemIds) {
          await c.env.DB.prepare('UPDATE point_store SET status = ? WHERE id = ?').bind('disabled', itemId).run();
        }
      }

      // Process purchases and refunds
      if (itemIds.length > 0) {
        for (const itemId of itemIds) {
          const item = items.results.find((i: any) => i.id === itemId);
          if (!item) continue;
          const purchases = await c.env.DB.prepare('SELECT id, user_id FROM purchases WHERE item_id = ? AND status = ?').bind(itemId, 'active').all();

          for (const p of purchases.results as any[]) {
            // Refund user
            await c.env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(item.price, p.user_id).run();

            // Disable purchase
            await c.env.DB.prepare('UPDATE purchases SET status = ? WHERE id = ?').bind('disabled_by_admin', p.id).run();

            // Send mail
            const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const content = `We're sorry, but the voucher "${item.name}" from ${storeName} has been disabled because the shop was taken down. Your ${item.price} Eco-Coins have been refunded to your account.`;
            await notificationService.createMailAndNotify(c.env, {
              id: mailId,
              title: 'Voucher Disabled & Refunded',
              content: content,
              sender: 'System Admin',
              recipient_type: 'user',
              recipient_id: p.user_id,
              notification_type: 'mailbox',
              notification_priority: 'high'
            });
          }
        }
      }

      // Email merchant owner
      const mailId = crypto.randomUUID();
      const isMerchant = c.req.query('actor') === 'merchant';
      const reason = c.req.query('reason');

      const title = isMerchant ? 'Shop Successfully Taken Down' : 'Shop Taken Down';
      let content = isMerchant
        ? `You have successfully taken down your shop "${storeName}". All your active vouchers have been disabled.`
        : `Your shop "${storeName}" has been taken down by the administrator.`;

      if (!isMerchant && reason) {
        content += `\n\nReason: ${reason}`;
      }

      await notificationService.createMailAndNotify(c.env, {
        id: mailId,
        title: title,
        content: content,
        sender: isMerchant ? 'System' : 'System Admin',
        recipient_type: 'user',
        recipient_id: merchant.owner_id,
        notification_type: 'mailbox',
        notification_priority: 'high'
      });

      // Hard delete merchant record
      await c.env.DB.prepare('DELETE FROM merchants WHERE id = ?').bind(id).run();
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Applications
app.post('/api/applications', async (c) => {
  try {
    const body = await c.req.json();
    const id = `app-${Date.now()}`;

    // Fallback: Ensure user exists in case of DB wipe
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.ownerId).first();
    if (!user) {
      await c.env.DB.prepare(
        'INSERT INTO users (id, email, username, role, created_at, coins, total_distance_km) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(body.ownerId, 'unknown@example.com', 'Unknown', 'user', Date.now(), 0, 0).run();
    }

    await c.env.DB.prepare(
      'INSERT INTO applications (id, owner_id, type, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, body.ownerId, body.type || 'new_merchant', body.details, 'pending', Date.now()).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
app.put('/api/applications/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    if (body.status === 'rejected' && body.rejectReason) {
      const app: any = await c.env.DB.prepare('SELECT * FROM applications WHERE id = ?').bind(id).first();
      if (app) {
        let details: any = {};
        try { details = JSON.parse(app.details); } catch (e) { }
        details.rejectReason = body.rejectReason;
        await c.env.DB.prepare('UPDATE applications SET status = ?, details = ? WHERE id = ?')
          .bind(body.status, JSON.stringify(details), id).run();
      } else {
        await c.env.DB.prepare('UPDATE applications SET status = ? WHERE id = ?').bind(body.status, id).run();
      }
    } else {
      await c.env.DB.prepare('UPDATE applications SET status = ? WHERE id = ?').bind(body.status, id).run();
    }

    if (body.status === 'approved') {
      const app: any = await c.env.DB.prepare('SELECT * FROM applications WHERE id = ?').bind(id).first();
      if (app) {
        let details: any = {};
        try { details = JSON.parse(app.details); } catch (e) { }

        if (app.type === 'new_merchant') {
          const merchantId = `merchant-${Date.now()}`;
          await c.env.DB.prepare(
            'INSERT INTO merchants (id, owner_id, store_name, menu_link, location, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(merchantId, app.owner_id, details.storeName || '', details.menuLink || '', details.location ? JSON.stringify(details.location) : null, 'approved', Date.now()).run();

          await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind('merchant', app.owner_id).run();

          if (details.vouchers && Array.isArray(details.vouchers)) {
            for (const v of details.vouchers) {
              const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              await c.env.DB.prepare(
                'INSERT INTO point_store (id, merchant_id, category, name, desc, price, stock, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(itemId, merchantId, 'Vouchers', v.name, v.desc, v.price, v.stock, v.icon).run();
            }
          }
        } else if (app.type === 'modification') {
          const targetMerchantId = details.merchantId || (await c.env.DB.prepare('SELECT id FROM merchants WHERE owner_id = ? LIMIT 1').bind(app.owner_id).first() as any)?.id;
          if (!targetMerchantId) {
            return c.json({ error: 'No merchant found for this modification' }, 400);
          }

          if (details.location) {
            await c.env.DB.prepare(
              'UPDATE merchants SET store_name = ?, menu_link = ?, location = ? WHERE id = ?'
            ).bind(details.storeName || '', details.menuLink || '', JSON.stringify(details.location), targetMerchantId).run();
          } else {
            await c.env.DB.prepare(
              'UPDATE merchants SET store_name = ?, menu_link = ? WHERE id = ?'
            ).bind(details.storeName || '', details.menuLink || '', targetMerchantId).run();
          }

          if (details.vouchers && Array.isArray(details.vouchers)) {
            const keepIds = details.vouchers.filter((v: any) => v.originalId).map((v: any) => v.originalId);
            const currentVouchers = await c.env.DB.prepare("SELECT id, name, price FROM point_store WHERE merchant_id = ? AND (status != 'disabled' OR status IS NULL)").bind(targetMerchantId).all();

            for (const cv of currentVouchers.results as any[]) {
              if (!keepIds.includes(cv.id)) {
                await c.env.DB.prepare("UPDATE point_store SET status = 'disabled' WHERE id = ?").bind(cv.id).run();

                const purchases = await c.env.DB.prepare("SELECT id, user_id FROM purchases WHERE item_id = ? AND status = 'active'").bind(cv.id).all();
                for (const p of purchases.results as any[]) {
                  await c.env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(cv.price, p.user_id).run();
                  await c.env.DB.prepare("UPDATE purchases SET status = 'disabled_by_admin' WHERE id = ?").bind(p.id).run();

                  const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                  const content = `We're sorry, but the voucher "${cv.name}" has been removed by the merchant. Your ${cv.price} Eco-Coins have been refunded to your account.`;
                  await notificationService.createMailAndNotify(c.env, {
                    id: mailId,
                    title: 'Voucher Removed & Refunded',
                    content: content,
                    sender: 'System Admin',
                    recipient_type: 'user',
                    recipient_id: p.user_id,
                    notification_type: 'mailbox',
                    notification_priority: 'high'
                  });
                }
              }
            }

            for (const v of details.vouchers) {
              const safeDesc = v.desc || v.description || '';
              if (v.originalId) {
                await c.env.DB.prepare(
                  'UPDATE point_store SET name = ?, desc = ?, price = ?, stock = ?, icon = ? WHERE id = ? AND merchant_id = ?'
                ).bind(v.name, safeDesc, v.price, v.stock, v.icon, v.originalId, targetMerchantId).run();
              } else {
                const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                await c.env.DB.prepare(
                  'INSERT INTO point_store (id, merchant_id, category, name, desc, price, stock, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(itemId, targetMerchantId, 'Vouchers', v.name, safeDesc, v.price, v.stock, v.icon).run();
              }
            }
          }
        }
      }
    }

    // Send Notification
    const updatedApp: any = await c.env.DB.prepare('SELECT owner_id, type, details FROM applications WHERE id = ?').bind(id).first();
    if (updatedApp && (body.status === 'approved' || body.status === 'rejected')) {
      let details: any = {};
      try { details = JSON.parse(updatedApp.details); } catch (e) { }

      const isMod = updatedApp.type === 'modification';
      const storeName = details.storeName || 'your store';

      let title = isMod ? `Modification ${body.status === 'approved' ? 'Approved' : 'Rejected'}`
        : `Application ${body.status === 'approved' ? 'Approved' : 'Rejected'}`;
      let content = isMod ? `Your information modification for ${storeName} was ${body.status}.`
        : `Your merchant application for ${storeName} was ${body.status}.`;

      if (body.status === 'rejected' && body.rejectReason) {
        content += `\n\nReason: ${body.rejectReason}`;
      }

      await notificationService.createMailAndNotify(c.env, {
        id: crypto.randomUUID(),
        title: title,
        content: content,
        sender: 'System Admin',
        recipient_type: 'user',
        recipient_id: updatedApp.owner_id,
        notification_type: 'mailbox',
        notification_priority: 'high'
      });
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Store Categories
app.post('/api/store_categories', async (c) => {
  const body = await c.req.json();
  const id = `cat-${Date.now()}`;
  await c.env.DB.prepare('INSERT INTO store_categories (id, name) VALUES (?, ?)').bind(id, body.name).run();
  return c.json({ success: true });
});

// Store Admin CRUD
app.post('/api/store', async (c) => {
  const body = await c.req.json();
  const id = `item-${Date.now()}`;
  try {
    await c.env.DB.prepare("ALTER TABLE point_store ADD COLUMN link TEXT").run();
  } catch (e) { }
  await c.env.DB.prepare(
    'INSERT INTO point_store (id, merchant_id, category, name, desc, price, stock, icon, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.merchantId || null, body.category || '', body.itemName || 'Untitled', body.description || '', body.price || 0, body.stock || 0, body.icon || '🎟️', body.link || null).run();
  return c.json({ success: true });
});
app.put('/api/store/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE point_store SET category = ?, name = ?, desc = ?, price = ?, stock = ?, icon = ?, link = ? WHERE id = ?'
  ).bind(body.category || '', body.itemName || 'Untitled', body.description || '', body.price || 0, body.stock || 0, body.icon || '🎟️', body.link || null, id).run();
  return c.json({ success: true });
});
app.delete('/api/store/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const item: any = await c.env.DB.prepare('SELECT name, price FROM point_store WHERE id = ?').bind(id).first();

    if (item) {
      // 1. Disable the item
      await c.env.DB.prepare('UPDATE point_store SET status = ? WHERE id = ?').bind('disabled', id).run();

      // 2. Process purchases
      const purchases = await c.env.DB.prepare('SELECT id, user_id FROM purchases WHERE item_id = ? AND status = ?').bind(id, 'active').all();

      for (const p of purchases.results as any[]) {
        // Refund user
        await c.env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(item.price, p.user_id).run();

        // Disable purchase
        await c.env.DB.prepare('UPDATE purchases SET status = ? WHERE id = ?').bind('disabled_by_admin', p.id).run();

        // Send email
        const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const content = `We're sorry, but the voucher "${item.name}" has been disabled due to certain reason. Your ${item.price} Eco-Coins have been refunded to your account.`;
        await notificationService.createMailAndNotify(c.env, {
          id: mailId,
          title: 'Voucher Disabled & Refunded',
          content: content,
          sender: 'System Admin',
          recipient_type: 'user',
          recipient_id: p.user_id,
          notification_type: 'mailbox',
          notification_priority: 'high'
        });
      }
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Merchant Sales and Redemption


app.get('/api/merchants/:merchantId/sales', async (c) => {
  const merchantId = c.req.param('merchantId');
  const auth = await resolveAndAuthorizeMerchant(c, merchantId, true);
  if (auth.error) return c.json({ error: auth.error }, auth.status as any);
  const merchant = auth.merchant;

  const purchases = await c.env.DB.prepare(
    'SELECT purchases.*, users.username as buyerUsername, users.player_id as buyerUid FROM purchases LEFT JOIN users ON purchases.user_id = users.id WHERE purchases.merchant_id = ? ORDER BY purchases.purchased_at DESC'
  ).bind(merchant.id).all();
  return c.json({ purchases: purchases.results });
});

app.post('/api/merchants/redeem/:purchaseId', async (c) => {
  const purchaseId = c.req.param('purchaseId');
  const body = await c.req.json();
  const auth = await resolveAndAuthorizeMerchant(c, body.merchantId, true);
  if (auth.error) return c.json({ error: auth.error }, auth.status as any);
  const merchant = auth.merchant;

  const res = await c.env.DB.prepare(
    'UPDATE purchases SET status = ?, redeemed_at = ? WHERE id = ? AND (merchant_id = ? OR merchant_id = ?) AND status = ?'
  ).bind('redeemed', Date.now(), purchaseId, merchant.id, merchant.owner_id, 'active').run();

  if (res.meta.changes === 0) {
    return c.json({ error: 'Failed to redeem voucher. It may have already been redeemed, expired, or does not belong to this merchant shop.' }, 400);
  }
  return c.json({ success: true });
});

app.post('/api/users/:uid/verify', async (c) => {
  const uid = c.req.param('uid');
  await c.env.DB.prepare('UPDATE users SET verified_email = 1 WHERE id = ?').bind(uid).run();
  return c.json({ success: true });
});

// GET User's Vouchers
app.get('/api/users/:id/vouchers', async (c) => {
  try {
    const id = c.req.param('id');
    const vouchers = await c.env.DB.prepare(
      'SELECT purchases.*, point_store.name as item_name, point_store.desc as item_desc, point_store.icon, merchants.store_name FROM purchases LEFT JOIN point_store ON purchases.item_id = point_store.id LEFT JOIN merchants ON (purchases.merchant_id = merchants.id OR purchases.merchant_id = merchants.owner_id) WHERE purchases.user_id = ? ORDER BY purchases.purchased_at DESC'
    ).bind(id).all();
    return c.json({ vouchers: vouchers.results });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Start Redeem Voucher
app.put('/api/purchases/:id/redeem-start', async (c) => {
  try {
    const id = c.req.param('id');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
    await c.env.DB.prepare('UPDATE purchases SET expires_at = ? WHERE id = ?').bind(expiresAt, id).run();
    return c.json({ success: true, expiresAt });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Merchant Scan Voucher
app.post('/api/merchants/scan', async (c) => {
  try {
    const body = await c.req.json();
    const purchaseId = (body.purchaseId || '').trim();
    const merchantSelector = (body.merchantId || '').trim();

    if (!purchaseId || !merchantSelector) {
      return c.json({ error: 'Missing purchaseId or merchantId' }, 400);
    }

    const auth = await resolveAndAuthorizeMerchant(c, merchantSelector, true);
    if (auth.error) return c.json({ error: auth.error }, auth.status as any);
    const canonicalMerchant = auth.merchant;

    const purchase: any = await c.env.DB.prepare('SELECT * FROM purchases WHERE id = ?').bind(purchaseId).first();
    if (!purchase) return c.json({ error: 'Voucher not found' }, 404);

    // Strict Merchant Isolation: Verify this voucher belongs to this specific merchant shop
    const belongsToThisStore = purchase.merchant_id === canonicalMerchant.id || purchase.merchant_id === canonicalMerchant.owner_id;
    if (!belongsToThisStore || !purchase.merchant_id) {
      return c.json({ error: 'Invalid voucher for this shop. This voucher belongs to a different merchant.' }, 400);
    }
    if (purchase.status === 'redeemed') {
      return c.json({ error: 'Voucher has already been redeemed' }, 400);
    }
    if (purchase.status !== 'active') {
      return c.json({ error: `Voucher cannot be redeemed because it is ${purchase.status}` }, 400);
    }
    if (purchase.expires_at && Date.now() > purchase.expires_at) {
      await c.env.DB.prepare('UPDATE purchases SET status = ? WHERE id = ?').bind('expired', purchaseId).run();
      return c.json({ error: 'Voucher 15-minute redemption window has expired. Customer must re-initiate redeem.' }, 400);
    }

    // Valid! Atomically redeem with strict status and merchant match check
    const updateRes = await c.env.DB.prepare(
      'UPDATE purchases SET status = ?, redeemed_at = ? WHERE id = ? AND (merchant_id = ? OR merchant_id = ?) AND status = ?'
    ).bind('redeemed', Date.now(), purchaseId, canonicalMerchant.id, canonicalMerchant.owner_id, 'active').run();

    if (updateRes.meta.changes === 0) {
      return c.json({ error: 'Failed to redeem voucher. It may have just been redeemed.' }, 400);
    }

    return c.json({ success: true, message: 'Voucher successfully redeemed!' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/guilds', async (c) => {
  // @ts-ignore
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);

  const { name, description, icon, nationality, require_approval } = await c.req.json();
  if (!name) return c.json({ error: 'Name is required' }, 400);

  // Check if user is already in a community
  const dbUser = await c.env.DB.prepare('SELECT guild_id FROM users WHERE id = ?').bind(user.sub).first() as any;
  if (dbUser && dbUser.guild_id) {
    return c.json({ success: false, error: 'You are already in a community. Leave it first.' }, 400);
  }

  // Check uniqueness of name
  const existingName = await c.env.DB.prepare('SELECT id FROM guilds WHERE LOWER(name) = LOWER(?)').bind(name).first();
  if (existingName) {
    return c.json({ success: false, error: 'Community name already exists' }, 400);
  }

  let guildId = '';
  let isUnique = false;
  while (!isUnique) {
    guildId = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 digits
    const existingId = await c.env.DB.prepare('SELECT id FROM guilds WHERE id = ?').bind(guildId).first();
    if (!existingId) isUnique = true;
  }

  await c.env.DB.prepare(
    'INSERT INTO guilds (id, name, description, icon, nationality, require_approval, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(guildId, name, description || '', icon || '🌍', nationality || 'Global', require_approval ? 1 : 0, user.sub, Date.now()).run();

  // Automatically join the created guild
  await c.env.DB.prepare('UPDATE users SET guild_id = ? WHERE id = ?').bind(guildId, user.sub).run();
  await c.env.DB.prepare('UPDATE trees SET guild_id = ? WHERE author_id = ?').bind(guildId, user.sub).run();

  // Add system message
  const joinedUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(user.sub).first() as any;
  if (joinedUser) {
    {
      const _msgId = crypto.randomUUID();
      const _ts = Date.now();
      const _msgContent = `${joinedUser.username} has joined the community.`;
      await c.env.DB.prepare('INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)').bind(_msgId, guildId, 'system', 'System', _msgContent, _ts).run();
      const _stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(guildId));
      await _stub.fetch(new Request('http://internal/system_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: _msgId,
          guild_id: guildId,
          user_id: 'system',
          content: _msgContent,
          created_at: _ts

        })
      }));
    }
  }

  await checkAndAwardBadges(c, user.sub);

  return c.json({ success: true, guildId });
});

// PUT /api/guilds/:id
app.put('/api/guilds/:id', async (c) => {
  // @ts-ignore
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const guildId = c.req.param('id');

  const { name, description, icon, nationality, require_approval } = await c.req.json();
  if (!name) return c.json({ error: 'Name is required' }, 400);

  // Check if guild exists and user is admin
  const guild = await c.env.DB.prepare('SELECT admin_id FROM guilds WHERE id = ?').bind(guildId).first() as any;
  if (!guild) return c.json({ error: 'Guild not found' }, 404);
  if (guild.admin_id !== user.sub) return c.json({ error: 'Only the admin can edit the community' }, 403);

  // Check uniqueness of name (ignoring current guild)
  const existingName = await c.env.DB.prepare('SELECT id FROM guilds WHERE LOWER(name) = LOWER(?) AND id != ?').bind(name, guildId).first();
  if (existingName) {
    return c.json({ success: false, error: 'Community name already exists' }, 400);
  }

  await c.env.DB.prepare(
    'UPDATE guilds SET name = ?, description = ?, icon = ?, nationality = ?, require_approval = ? WHERE id = ?'
  ).bind(name, description || '', icon || '🌍', nationality || 'Global', require_approval ? 1 : 0, guildId).run();

  return c.json({ success: true, guildId });
});

// POST /api/guilds/:id/icon
app.post('/api/guilds/:id/icon', async (c) => {
  // @ts-ignore
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const guildId = c.req.param('id');

  // Check if guild exists and user is admin
  const guild = await c.env.DB.prepare('SELECT admin_id, icon FROM guilds WHERE id = ?').bind(guildId).first() as any;
  if (!guild) return c.json({ error: 'Guild not found' }, 404);
  if (guild.admin_id !== user.sub) return c.json({ error: 'Only the admin can edit the community icon' }, 403);

  const body = await c.req.parseBody();
  const file = body['icon_file'] as File;
  if (!file) return c.json({ error: 'No file uploaded' }, 400);

  const extension = file.name.split('.').pop();
  const objectKey = `guild_icons/${guildId}-${Date.now()}.${extension}`;

  // Try to delete old icon to save space
  try {
    if (guild.icon && guild.icon.includes('/r2/')) {
      const oldUrl = new URL(guild.icon);
      const oldKey = oldUrl.pathname.replace('/r2/', '');
      await c.env.AVATARS_BUCKET.delete(oldKey);
    }
  } catch (err) {
    console.warn("Failed to delete old guild icon:", err);
  }

  // Convert File to ArrayBuffer for R2
  const arrayBuffer = await file.arrayBuffer();

  // Upload to R2 Bucket
  await c.env.AVATARS_BUCKET.put(objectKey, arrayBuffer, {
    httpMetadata: { contentType: file.type }
  });

  // Construct the public URL
  const url = new URL(c.req.url);
  const publicUrl = `${url.origin}/r2/${objectKey}`;

  // Update Database
  await c.env.DB.prepare('UPDATE guilds SET icon = ? WHERE id = ?').bind(publicUrl, guildId).run();

  return c.json({ success: true, iconUrl: publicUrl });
});

// POST /api/guilds/:id/join
app.post('/api/guilds/:id/join', async (c) => {
  // @ts-ignore
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const guildId = c.req.param('id');

  // Check if user is already in a community
  const dbUser = await c.env.DB.prepare('SELECT guild_id FROM users WHERE id = ?').bind(user.sub).first() as any;
  if (dbUser && dbUser.guild_id) {
    return c.json({ error: 'You are already in a community. Leave it first.' }, 400);
  }

  const memberCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE guild_id = ?').bind(guildId).first() as any;
  if (memberCount && memberCount.count >= 75) {
    return c.json({ error: 'This community is full (max 75 members)' }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET guild_id = ? WHERE id = ?').bind(guildId, user.sub).run();
  await c.env.DB.prepare('UPDATE trees SET guild_id = ? WHERE author_id = ?').bind(guildId, user.sub).run();

  // Add system message
  const joinedUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(user.sub).first() as any;
  if (joinedUser) {
    {
      const _msgId = crypto.randomUUID();
      const _ts = Date.now();
      const _msgContent = `${joinedUser.username} has joined the community.`;
      await c.env.DB.prepare('INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)').bind(_msgId, guildId, 'system', 'System', _msgContent, _ts).run();
      const _stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(guildId));
      await _stub.fetch(new Request('http://internal/system_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: _msgId,
          guild_id: guildId,
          user_id: 'system',
          content: _msgContent,
          created_at: _ts

        })
      }));
    }
  }

  await checkAndAwardBadges(c, user.sub);

  return c.json({ success: true, guildId });
});

// POST /api/guilds/:id/request_join
app.post('/api/guilds/:id/request_join', async (c) => {
  // @ts-ignore
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const guildId = c.req.param('id');

  // Check if user is already in a community
  const dbUser = await c.env.DB.prepare('SELECT guild_id FROM users WHERE id = ?').bind(user.sub).first() as any;
  if (dbUser && dbUser.guild_id) {
    return c.json({ error: 'You are already in a community. Leave it first.' }, 400);
  }

  const guild = await c.env.DB.prepare('SELECT id, name, admin_id FROM guilds WHERE id = ?').bind(guildId).first();
  if (!guild) return c.json({ error: 'Guild not found' }, 404);
  if (!guild.admin_id) return c.json({ error: 'This community has no admin to accept requests' }, 400);

  const reqUser = await c.env.DB.prepare('SELECT username, email FROM users WHERE id = ?').bind(user.sub).first() as { username?: string, email?: string } | null;
  const username = reqUser?.username || (reqUser?.email ? reqUser.email.split('@')[0] : 'A user');

  // Check if a request already exists
  const existingReq = await c.env.DB.prepare(
    "SELECT id FROM mail WHERE action_type = 'guild_join_request' AND action_data LIKE ?"
  ).bind(`%"userId":"${user.sub}"%`).first();
  if (existingReq) {
    return c.json({ error: 'You already have a pending join request.' }, 400);
  }

  const mailId = crypto.randomUUID();
  await notificationService.createMailAndNotify(c.env, {
    id: mailId,
    title: 'New Join Request',
    content: `${username} wants to join ${guild.name}.`,
    sender: 'System',
    recipient_type: 'user',
    recipient_id: guild.admin_id as string,
    action_type: 'guild_join_request',
    action_data: JSON.stringify({ guildId: guild.id, userId: user.sub, username, guildName: guild.name }),
    notification_type: 'social',
    notification_priority: 'high'
  });

  return c.json({ success: true });
});

// POST /api/mail/:id/action
app.post('/api/mail/:id/action', async (c) => {
  // @ts-ignore
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
  const mailId = c.req.param('id');
  const { action } = await c.req.json();

  const mail = await c.env.DB.prepare('SELECT * FROM mail WHERE id = ? AND recipient_id = ?').bind(mailId, user.sub).first();
  if (!mail) return c.json({ error: 'Mail not found' }, 404);

  if (mail.action_type === 'guild_join_request') {
    const data = JSON.parse(mail.action_data as string);
    const { userId, guildId, username, guildName } = data;

    if (action === 'accept') {
      // Check if user already joined a guild
      const targetUser = await c.env.DB.prepare('SELECT guild_id FROM users WHERE id = ?').bind(userId).first();
      if (targetUser && targetUser.guild_id) {
        // Already joined
        await c.env.DB.prepare('UPDATE mail SET content = ?, action_type = NULL, action_data = NULL WHERE id = ?')
          .bind(`That user already joined another community.`, mailId).run();
        return c.json({ success: true, message: 'User already joined another community' });
      } else {
        // Check community member limit
        const memberCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE guild_id = ?').bind(guildId).first() as any;
        if (memberCount && memberCount.count >= 75) {
          await c.env.DB.prepare('UPDATE mail SET content = ?, action_type = NULL, action_data = NULL WHERE id = ?')
            .bind(`Failed to accept: community is full (max 75 members).`, mailId).run();
          return c.json({ success: false, message: 'Community is full' });
        }

        // Accept them
        await c.env.DB.prepare('UPDATE users SET guild_id = ? WHERE id = ?').bind(guildId, userId).run();
        await c.env.DB.prepare('UPDATE trees SET guild_id = ? WHERE author_id = ?').bind(guildId, userId).run();

        // Add system message
        {
          const _msgId = crypto.randomUUID();
          const _ts = Date.now();
          const _msgContent = `${username} has joined the community.`;
          await c.env.DB.prepare('INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)').bind(_msgId, guildId, 'system', 'System', _msgContent, _ts).run();
          const _stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(guildId));
          await _stub.fetch(new Request('http://internal/system_message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: _msgId,
              guild_id: guildId,
              user_id: 'system',
              content: _msgContent,
              created_at: _ts

            })
          }));
        }

        await c.env.DB.prepare('UPDATE mail SET content = ?, action_type = NULL, action_data = NULL WHERE id = ?')
          .bind(`You accepted ${username} into the community.`, mailId).run();

        // Notify user
        await notificationService.createMailAndNotify(c.env, {
          id: crypto.randomUUID(),
          title: 'Join Request Approved',
          content: `The admin approved your request to join ${guildName}.`,
          sender: 'System',
          recipient_type: 'user',
          recipient_id: userId,
          notification_type: 'social',
          notification_priority: 'high'
        });

        await checkAndAwardBadges(c, userId);
      }
    } else if (action === 'reject') {
      await c.env.DB.prepare('UPDATE mail SET content = ?, action_type = NULL, action_data = NULL WHERE id = ?')
        .bind(`You rejected ${username} to join the community.`, mailId).run();

      // Notify user
      await notificationService.createMailAndNotify(c.env, {
        id: crypto.randomUUID(),
        title: 'Join Request Rejected',
        content: `The admin rejected your request to join ${guildName}.`,
        sender: 'System',
        recipient_type: 'user',
        recipient_id: userId,
        notification_type: 'social',
        notification_priority: 'high'
      });
    }
  } else if (mail.action_type === 'friend_request') {
    const data = JSON.parse(mail.action_data as string);
    const { requester_id, requester_username } = data;
    const myUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(user.sub).first();
    const myUsername = myUser?.username || 'Someone';

    if (action === 'accept') {
      const now = Date.now();
      // Update original pending request
      await c.env.DB.prepare('UPDATE friends SET status = ? WHERE user_id = ? AND friend_id = ?').bind('accepted', requester_id, user.sub).run();
      // Create reciprocal accepted request
      await c.env.DB.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?)').bind(user.sub, requester_id, 'accepted', now).run();

      await c.env.DB.prepare('UPDATE mail SET content = ?, action_type = NULL, action_data = NULL WHERE id = ?')
        .bind(`You are now friends with ${requester_username || 'them'}! Say hi!`, mailId).run();

      await c.env.DB.prepare(
        'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), 'Friend Request Accepted', `Your friend request to ${myUsername} was accepted! Say hi!`, 'System', 'user', requester_id, 0, Date.now()).run();
    } else if (action === 'reject') {
      // Delete pending request
      await c.env.DB.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').bind(requester_id, user.sub).run();

      await c.env.DB.prepare('UPDATE mail SET content = ?, action_type = NULL, action_data = NULL WHERE id = ?')
        .bind(`You rejected the friend request from ${requester_username || 'them'}.`, mailId).run();

      await c.env.DB.prepare(
        'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), 'Friend Request Rejected', `Your friend request to ${myUsername} was rejected.`, 'System', 'user', requester_id, 0, Date.now()).run();
    }
  }
  return c.json({ success: true });
});

// POST /api/guilds/leave
app.post('/api/guilds/leave', async (c) => {
  // @ts-ignore
  const user = c.get('user');
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);

  // Check if user is in a guild
  const dbUser = await c.env.DB.prepare('SELECT guild_id FROM users WHERE id = ?').bind(user.sub).first() as any;
  if (!dbUser || !dbUser.guild_id) return c.json({ error: 'Not in a community' }, 400);

  const guildId = dbUser.guild_id;
  const guild = await c.env.DB.prepare('SELECT admin_id FROM guilds WHERE id = ?').bind(guildId).first() as any;

  // If admin is trying to leave
  if (guild && guild.admin_id === user.sub) {
    const memberCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE guild_id = ?').bind(guildId).first() as any;
    if (memberCount.count > 1) {
      return c.json({ error: 'Admin must transfer ownership before leaving' }, 400);
    } else {
      // Sole member, delete community
      await c.env.DB.prepare('DELETE FROM guilds WHERE id = ?').bind(guildId).run();
    }
  }

  await c.env.DB.prepare('UPDATE users SET guild_id = NULL, muted_until = NULL WHERE id = ?').bind(user.sub).run();
  await c.env.DB.prepare('UPDATE trees SET guild_id = NULL WHERE author_id = ?').bind(user.sub).run();

  // If guild still exists, add system message
  const remainingGuild = await c.env.DB.prepare('SELECT id FROM guilds WHERE id = ?').bind(guildId).first();
  if (remainingGuild) {
    const leftUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(user.sub).first() as any;
    if (leftUser) {
      {
        const _msgId = crypto.randomUUID();
        const _ts = Date.now();
        const _msgContent = `${leftUser.username} has left the community.`;
        await c.env.DB.prepare('INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)').bind(_msgId, guildId, 'system', 'System', _msgContent, _ts).run();
        const _stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(guildId));
        await _stub.fetch(new Request('http://internal/system_message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: _msgId,
            guild_id: guildId,
            user_id: 'system',
            content: _msgContent,
            created_at: _ts

          })
        }));
      }
    }
  }

  return c.json({ success: true });
});

// GET /api/guilds/:id
app.get('/api/guilds/:id', async (c) => {
  const guildId = c.req.param('id');

  const guild = await c.env.DB.prepare('SELECT * FROM guilds WHERE id = ?').bind(guildId).first();
  if (!guild) return c.json({ error: 'Not found' }, 404);

  const members = await c.env.DB.prepare(
    'SELECT id, username, email, avatar, total_trees_planted, muted_until FROM users WHERE guild_id = ? ORDER BY total_trees_planted DESC'
  ).bind(guildId).all();

  let hasPendingRequest = false;
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = parseFirebaseJwt(token);
    if (payload && payload.sub) {
      const existingReq = await c.env.DB.prepare(
        "SELECT id FROM mail WHERE action_type = 'guild_join_request' AND action_data LIKE ? AND action_data LIKE ?"
      ).bind(`%"guildId":"${guildId}"%`, `%"userId":"${payload.sub}"%`).first();
      if (existingReq) hasPendingRequest = true;
    }
  }

  return c.json({ guild, members: members.results, hasPendingRequest });
});

// WebSocket Upgrade route for Community Chat
app.get('/api/chat/community/:guildId', async (c) => {
  const guildId = c.req.param('guildId');
  const token = c.req.query('token');

  if (!token) {
    return c.text('Missing token', 401);
  }

  const payload = parseFirebaseJwt(token);
  if (!payload || !payload.sub) {
    return c.text('Invalid token', 401);
  }
  const userId = payload.sub as string;

  // Get the DO instance for this guildId
  const id = c.env.CHAT_ROOM.idFromName(guildId);
  const stub = c.env.CHAT_ROOM.get(id);

  // Rewrite URL to pass guildId and userId in query params so the DO can parse them easily
  const url = new URL(c.req.url);
  url.searchParams.set('guildId', guildId);
  url.searchParams.set('userId', userId);

  const modifiedRequest = new Request(url.toString(), c.req.raw);
  return stub.fetch(modifiedRequest);
});

// GET users search (for adding friends)
app.get('/api/users', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ users: [] });
  // Search by exact ID, exact player_id, or partial username
  const users = await c.env.DB.prepare(
    'SELECT id, username, email, player_id, guild_id, avatar FROM users WHERE id = ? OR player_id = ? OR username LIKE ? LIMIT 10'
  ).bind(q, q, `%${q}%`).all();
  return c.json({ users: users.results });
});

// GET friends
app.get('/api/friends/:id', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  if (!jwtUser || jwtUser.sub !== id) return c.json({ error: 'Unauthorized' }, 401);

  const friends = await c.env.DB.prepare(
    'SELECT u.id, u.username, u.email, u.player_id, u.guild_id, u.avatar, f.created_at, f.status FROM friends f JOIN users u ON f.friend_id = u.id WHERE f.user_id = ? ORDER BY f.created_at DESC'
  ).bind(id).all();

  const friendsWithUnread = await Promise.all(friends.results.map(async (friend: any) => {
    const roomSuffix = [id, friend.id].sort().join('_');
    const roomId = `1to1_${roomSuffix}`;

    const lastReadRecord = await c.env.DB.prepare('SELECT last_read_at FROM user_chat_reads WHERE user_id = ? AND guild_id = ?').bind(id, roomId).first();
    const lastReadAt = lastReadRecord ? lastReadRecord.last_read_at : 0;

    const unreadRecord = await c.env.DB.prepare('SELECT COUNT(*) as unread_count FROM chat_messages WHERE guild_id = ? AND timestamp > ? AND sender_id != ?').bind(roomId, lastReadAt, id).first();

    return {
      ...friend,
      unread_count: unreadRecord ? unreadRecord.unread_count : 0
    };
  }));

  return c.json({ friends: friendsWithUnread });
});

// POST friend
app.post('/api/friends/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const jwtUser = c.get('user') as any;
  if (!jwtUser || jwtUser.sub !== id) return c.json({ error: 'Unauthorized' }, 401);

  if (!body.friendId) return c.json({ error: 'Missing friendId' }, 400);
  if (id === body.friendId) return c.json({ error: 'Cannot add yourself' }, 400);

  // Check if friend exists
  const friendExists = await c.env.DB.prepare('SELECT id, username FROM users WHERE id = ?').bind(body.friendId).first();
  if (!friendExists) return c.json({ error: 'User not found' }, 404);

  // Check if already requested or friends
  const existing = await c.env.DB.prepare('SELECT status FROM friends WHERE user_id = ? AND friend_id = ?').bind(id, body.friendId).first();
  if (existing) return c.json({ error: 'Already requested or friends' }, 400);

  const now = Date.now();
  // Insert single unidirectional pending request
  await c.env.DB.prepare('INSERT INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?)').bind(id, body.friendId, 'pending', now).run();

  // Fetch my own username for the mail
  const me = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(id).first();

  // Send Mail to target user
  const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const content = `${me?.username || 'Someone'} has sent you a friend request.`;
  const actionData = JSON.stringify({ requester_id: id, requester_username: me?.username });

  await notificationService.createMailAndNotify(c.env, {
    id: mailId,
    title: 'Friend Request',
    content: content,
    sender: 'System',
    recipient_type: 'user',
    recipient_id: body.friendId,
    action_type: 'friend_request',
    action_data: actionData,
    notification_type: 'social',
    notification_priority: 'high'
  });

  // Send Mail to requester
  const senderMailId = `mail-${Date.now()}-snd-${Math.random().toString(36).substring(2, 7)}`;
  const targetUsername = friendExists.username || 'Someone';
  const senderContent = `Friend request sent to ${targetUsername}.`;
  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, action_type, action_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(senderMailId, 'Friend Request Sent', senderContent, 'System', 'user', id, 0, 'system', '{}', now).run();

  return c.json({ success: true });
});

// DELETE friend
app.delete('/api/friends/:id/:friendId', async (c) => {
  const id = c.req.param('id');
  const friendId = c.req.param('friendId');
  const jwtUser = c.get('user') as any;
  if (!jwtUser || jwtUser.sub !== id) return c.json({ error: 'Unauthorized' }, 401);

  // Delete bidirectionally
  await c.env.DB.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').bind(id, friendId, friendId, id).run();

  // Delete chat history for the 1-to-1 room
  const roomSuffix = [id, friendId].sort().join('_');
  const roomId = `1to1_${roomSuffix}`;
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE guild_id = ?').bind(roomId).run();

  // Unfriend Notifications
  const user1 = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(id).first();
  const user2 = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(friendId).first();
  const u1Name = user1?.username || 'Someone';
  const u2Name = user2?.username || 'Someone';
  const now = Date.now();

  const mailId1 = `mail-${now}-u1-${Math.random().toString(36).substring(2, 7)}`;
  const mailId2 = `mail-${now}-u2-${Math.random().toString(36).substring(2, 7)}`;

  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, action_type, action_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(mailId1, 'Friend Removed', `You have unfriended ${u2Name}.`, 'System', 'user', id, 0, 'system', '{}', now).run();

  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, action_type, action_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(mailId2, 'Friend Removed', `${u1Name} has unfriended you.`, 'System', 'user', friendId, 0, 'system', '{}', now).run();

  return c.json({ success: true });
});

// ==========================================
// Guild Moderation & Member Actions
// ==========================================

// POST /api/guilds/:id/members/:memberId/kick
app.post('/api/guilds/:id/members/:memberId/kick', async (c) => {
  const user = c.get('user') as any;
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);

  const guildId = c.req.param('id');
  const memberId = c.req.param('memberId');
  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason || 'No reason provided';

  const guild = await c.env.DB.prepare('SELECT admin_id, name FROM guilds WHERE id = ?').bind(guildId).first() as any;
  if (!guild || guild.admin_id !== user.sub) return c.json({ error: 'Unauthorized: Only guild admin can kick members' }, 403);

  await c.env.DB.prepare('UPDATE users SET guild_id = NULL, muted_until = NULL WHERE id = ? AND guild_id = ?').bind(memberId, guildId).run();
  await c.env.DB.prepare('UPDATE trees SET guild_id = NULL WHERE author_id = ? AND guild_id = ?').bind(memberId, guildId).run();

  // Add system message
  const kickedUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(memberId).first() as any;
  if (kickedUser) {
    const _msgId = crypto.randomUUID();
    const _ts = Date.now();
    const _msgContent = `${kickedUser.username} was kicked from the community.`;
    await c.env.DB.prepare('INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)').bind(_msgId, guildId, 'system', 'System', _msgContent, _ts).run();
    const _stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(guildId));
    await _stub.fetch(new Request('http://internal/system_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: _msgId,
        guild_id: guildId,
        user_id: 'system',
        content: _msgContent,
        created_at: _ts
      })
    }));
  }

  // Notify user
  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), 'Kicked from Community', `You have been removed from ${guild.name} by the admin. Reason: ${reason}`, 'System', 'user', memberId, 0, Date.now()).run();

  return c.json({ success: true });
});

// POST /api/guilds/:id/members/:memberId/mute
app.post('/api/guilds/:id/members/:memberId/mute', async (c) => {
  const user = c.get('user') as any;
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);

  const guildId = c.req.param('id');
  const memberId = c.req.param('memberId');
  const { durationMs, action } = await c.req.json();

  const guild = await c.env.DB.prepare('SELECT admin_id FROM guilds WHERE id = ?').bind(guildId).first() as any;
  if (!guild || guild.admin_id !== user.sub) return c.json({ error: 'Unauthorized: Only guild admin can mute members' }, 403);

  const targetUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(memberId).first() as any;
  const targetName = targetUser ? targetUser.username : 'A member';

  if (action === 'unmute') {
    await c.env.DB.prepare('UPDATE users SET muted_until = NULL WHERE id = ? AND guild_id = ?').bind(memberId, guildId).run();
    const _msgId = crypto.randomUUID();
    const _ts = Date.now();
    const _msgContent = `${targetName} has been unmuted.`;
    await c.env.DB.prepare('INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)').bind(_msgId, guildId, 'system', 'System', _msgContent, _ts).run();
    const _stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(guildId));
    await _stub.fetch(new Request('http://internal/system_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: _msgId,
        guild_id: guildId,
        user_id: 'system',
        content: _msgContent,
        created_at: _ts,
        action: 'unmute',
        target_user_id: memberId
      })
    }));
  } else {
    const mutedUntil = durationMs === -1 ? -1 : Date.now() + (durationMs || 0);
    await c.env.DB.prepare('UPDATE users SET muted_until = ? WHERE id = ? AND guild_id = ?').bind(mutedUntil, memberId, guildId).run();
    const _msgId = crypto.randomUUID();
    const _ts = Date.now();
    const _msgContent = `${targetName} has been muted by the admin.`;
    await c.env.DB.prepare('INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)').bind(_msgId, guildId, 'system', 'System', _msgContent, _ts).run();
    const _stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(guildId));
    await _stub.fetch(new Request('http://internal/system_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: _msgId,
        guild_id: guildId,
        user_id: 'system',
        content: _msgContent,
        created_at: _ts,
        action: 'mute',
        target_user_id: memberId
      })
    }));
  }

  return c.json({ success: true });
});

// POST /api/guilds/:id/transfer_admin
app.post('/api/guilds/:id/transfer_admin', async (c) => {
  const user = c.get('user') as any;
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);

  const guildId = c.req.param('id');
  const { newAdminId } = await c.req.json();
  if (!newAdminId) return c.json({ error: 'Missing newAdminId' }, 400);

  const guild = await c.env.DB.prepare('SELECT admin_id, name FROM guilds WHERE id = ?').bind(guildId).first() as any;
  if (!guild || guild.admin_id !== user.sub) return c.json({ error: 'Unauthorized: Only current guild admin can transfer ownership' }, 403);

  const newAdminUser = await c.env.DB.prepare('SELECT id, username FROM users WHERE id = ? AND guild_id = ?').bind(newAdminId, guildId).first() as any;
  if (!newAdminUser) return c.json({ error: 'New admin must be an existing member of this community' }, 400);

  await c.env.DB.prepare('UPDATE guilds SET admin_id = ? WHERE id = ?').bind(newAdminId, guildId).run();

  // Add system message
  const _msgId = crypto.randomUUID();
  const _ts = Date.now();
  const _msgContent = `${newAdminUser.username} is now the admin of the community.`;
  await c.env.DB.prepare('INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)').bind(_msgId, guildId, 'system', 'System', _msgContent, _ts).run();
  const _stub = c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(guildId));
  await _stub.fetch(new Request('http://internal/system_message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: _msgId,
      guild_id: guildId,
      user_id: 'system',
      content: _msgContent,
      created_at: _ts
    })
  }));

  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), 'Promoted to Admin', `You have been promoted to become an admin of ${guild.name}.`, 'System', 'user', newAdminId, 0, Date.now()).run();

  return c.json({ success: true });
});

// DELETE /api/guilds/:id
app.delete('/api/guilds/:id', async (c) => {
  const user = c.get('user') as any;
  if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);

  const guildId = c.req.param('id');
  const guild = await c.env.DB.prepare('SELECT admin_id FROM guilds WHERE id = ?').bind(guildId).first() as any;
  if (!guild || guild.admin_id !== user.sub) return c.json({ error: 'Unauthorized: Only guild admin can delete the community' }, 401);

  const memberCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE guild_id = ?').bind(guildId).first() as any;
  if (memberCount && memberCount.count > 1) {
    return c.json({ error: 'Cannot delete community with other active members. Transfer admin first.' }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET guild_id = NULL, muted_until = NULL WHERE guild_id = ?').bind(guildId).run();
  await c.env.DB.prepare('UPDATE trees SET guild_id = NULL WHERE guild_id = ?').bind(guildId).run();
  await c.env.DB.prepare('DELETE FROM guilds WHERE id = ?').bind(guildId).run();

  return c.json({ success: true });
});

// ==========================================

app.get('/api/merchants/dashboard/:uid', async (c) => {
  const uid = c.req.param('uid');
  const jwtUser = c.get('user') as any;
  if (!jwtUser || jwtUser.sub !== uid) return c.json({ error: 'Unauthorized' }, 401);

  const merchants = await c.env.DB.prepare('SELECT * FROM merchants WHERE owner_id = ?').bind(uid).all();
  const apps = await c.env.DB.prepare('SELECT * FROM applications WHERE owner_id = ?').bind(uid).all();

  return c.json({
    merchants: merchants.results,
    applications: apps.results,
    storeItems: [] // Deprecated at this level, fetched per-merchant now
  });
});

app.get('/api/merchants/:merchantId/store', async (c) => {
  const merchantId = c.req.param('merchantId');
  const auth = await resolveAndAuthorizeMerchant(c, merchantId, true);
  if (auth.error) return c.json({ error: auth.error }, auth.status as any);
  const merchant = auth.merchant;

  const storeItems = await c.env.DB.prepare(
    'SELECT * FROM point_store WHERE merchant_id = ? OR merchant_id = ?'
  ).bind(merchant.id, merchant.owner_id).all();
  return c.json({ storeItems: storeItems.results });
});

// Admin Dashboard & System Management Endpoints

// ==========================================

// GET /api/admin/dashboard
app.get('/api/admin/dashboard', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);
  const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return c.json({ error: 'Forbidden: Requires admin role' }, 403);

  const users = await c.env.DB.prepare('SELECT * FROM users').all();
  const trees = await c.env.DB.prepare('SELECT trees.*, users.username as authorUsername, users.email as authorEmail, guilds.name as guildName FROM trees LEFT JOIN users ON trees.author_id = users.id LEFT JOIN guilds ON users.guild_id = guilds.id').all();
  const signposts = await c.env.DB.prepare('SELECT * FROM signposts').all();
  const storeItems = await c.env.DB.prepare("SELECT * FROM point_store WHERE status = 'active' OR status IS NULL").all();
  const categories = await c.env.DB.prepare('SELECT * FROM store_categories').all();
  const merchants = await c.env.DB.prepare('SELECT * FROM merchants').all();
  const applications = await c.env.DB.prepare('SELECT * FROM applications').all();
  const demoRequests = await c.env.DB.prepare('SELECT * FROM demo_requests').all();
  const mail = await c.env.DB.prepare("SELECT * FROM mail WHERE recipient_type NOT IN ('admin', 'authority') ORDER BY created_at DESC").all();
  const guilds = await c.env.DB.prepare('SELECT g.*, (SELECT COUNT(*) FROM users u WHERE u.guild_id = g.id) as member_count FROM guilds g').all();

  return c.json({
    users: users.results,
    trees: trees.results,
    signposts: signposts.results,
    storeItems: storeItems.results,
    categories: categories.results,
    merchants: merchants.results,
    applications: applications.results,
    demoRequests: demoRequests.results,
    sentMails: mail.results,
    guilds: guilds.results
  });
});

// GET /api/admin/messages
app.get('/api/admin/messages', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);
  const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return c.json({ error: 'Forbidden: Requires admin role' }, 403);

  const messages = await c.env.DB.prepare(`
    SELECT m.*, u.username as sender_name, u.bio as sender_position, u.avatar as sender_avatar 
    FROM mail m 
    LEFT JOIN users u ON u.id = m.sender_id OR (m.sender_id IS NULL AND u.id = m.sender)
    WHERE m.recipient_type = 'admin' 
    ORDER BY m.created_at DESC
  `).all();

  let readMailIds: string[] = [];
  try {
    const read = await c.env.DB.prepare('SELECT mail_id FROM user_read_mail WHERE user_id = ?').bind(jwtUser.sub).all();
    readMailIds = read.results.map((r: any) => r.mail_id);
  } catch (e) { }

  return c.json({ success: true, messages: messages.results, read_mail_ids: readMailIds });
});

// POST /api/admin/authority-message (Direct admin message to an authority)
app.post('/api/admin/authority-message', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);
  const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return c.json({ error: 'Forbidden: Requires admin role' }, 403);

  const body = await c.req.json();
  const { authorityId, title, content } = body;
  if (!authorityId || !content || !content.trim()) {
    return c.json({ error: 'Authority ID and message content are required' }, 400);
  }

  // Verify recipient is an authority (lookup by id or email)
  const targetUser: any = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ? OR email = ?').bind(authorityId, authorityId).first();
  if (!targetUser || targetUser.role !== 'authority') {
    return c.json({ error: 'Recipient is not an authority' }, 400);
  }

  const mailId = crypto.randomUUID();
  const now = Date.now();

  try { await c.env.DB.prepare('ALTER TABLE mail ADD COLUMN sender_id TEXT').run(); } catch (e) { }

  await notificationService.createMailAndNotify(c.env, {
    id: mailId,
    title: title?.trim() || 'Admin Notice',
    content: content.trim(),
    sender: 'EcoStride Admin',
    recipient_type: 'authority',
    recipient_id: targetUser.id,
    notification_type: 'mailbox',
    notification_priority: 'high'
  });

  return c.json({ success: true, mailId });
});

// GET /api/admin/messages/sent (Fetch messages sent by admin to authorities)
app.get('/api/admin/messages/sent', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);
  const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return c.json({ error: 'Forbidden: Requires admin role' }, 403);

  try { await c.env.DB.prepare('ALTER TABLE mail ADD COLUMN sender_id TEXT').run(); } catch (e) { }

  const messages = await c.env.DB.prepare(`
    SELECT m.*, u.username as recipient_name, u.bio as recipient_position, u.avatar as recipient_avatar 
    FROM mail m 
    LEFT JOIN users u ON m.recipient_id = u.id 
    WHERE m.sender_id = ? AND m.recipient_type = 'authority' 
    ORDER BY m.created_at DESC
  `).bind(jwtUser.sub).all();

  return c.json({ success: true, messages: messages.results });
});

// DELETE /api/messages/:id (Recall a sent message)
app.delete('/api/messages/:id', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);

  // Allow deleting if sender_id matches
  const mail = await c.env.DB.prepare('SELECT id, sender_id FROM mail WHERE id = ?').bind(id).first() as any;
  if (!mail) return c.json({ error: 'Message not found' }, 404);
  if (mail.sender_id !== jwtUser.sub) return c.json({ error: 'Forbidden: You can only recall your own messages' }, 403);

  await c.env.DB.prepare('DELETE FROM mail WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: 'Message recalled successfully' });
});

// POST /api/users/:id/devices
app.post('/api/users/:id/devices', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  if (!jwtUser || jwtUser.sub !== id) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const token = body.token;
  const platform = body.platform || 'android';
  if (!token) return c.json({ error: 'Token required' }, 400);

  const deviceId = crypto.randomUUID();
  const now = Date.now();

  await c.env.DB.prepare(`
    INSERT INTO user_devices (id, user_id, fcm_token, platform, active, last_seen_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(fcm_token) DO UPDATE SET
    user_id = excluded.user_id,
    active = 1,
    last_seen_at = excluded.last_seen_at,
    updated_at = excluded.updated_at
  `).bind(deviceId, id, token, platform, now, now, now).run();

  return c.json({ success: true });
});

app.delete('/api/users/:id/devices/:token', async (c) => {
  const id = c.req.param('id');
  const token = c.req.param('token');
  const jwtUser = c.get('user') as any;
  if (!jwtUser || jwtUser.sub !== id) return c.json({ error: 'Unauthorized' }, 401);

  await c.env.DB.prepare('DELETE FROM user_devices WHERE user_id = ? AND fcm_token = ?').bind(id, token).run();
  return c.json({ success: true });
});

// POST /api/admin/users/:id/coins
app.post('/api/admin/users/:id/coins', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);
  const requestingDbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!requestingDbUser || requestingDbUser.role !== 'admin') {
    return c.json({ error: 'Forbidden: Requires admin role' }, 403);
  }

  if (body.coins !== undefined) {
    await c.env.DB.prepare('UPDATE users SET coins = ? WHERE id = ?').bind(body.coins, id).run();
  }
  return c.json({ success: true });
});

// DELETE /api/admin/guilds/:id
app.delete('/api/admin/guilds/:id', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);
  const requestingDbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!requestingDbUser || requestingDbUser.role !== 'admin') {
    return c.json({ error: 'Forbidden: Requires admin role' }, 403);
  }

  await c.env.DB.prepare('UPDATE users SET guild_id = NULL, muted_until = NULL WHERE guild_id = ?').bind(id).run();
  await c.env.DB.prepare('UPDATE trees SET guild_id = NULL WHERE guild_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE guild_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM guilds WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// PUT /api/admin/guilds/:id/admin
app.put('/api/admin/guilds/:id/admin', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);
  const requestingDbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!requestingDbUser || requestingDbUser.role !== 'admin') {
    return c.json({ error: 'Forbidden: Requires admin role' }, 403);
  }

  if (!body.admin_id) return c.json({ error: 'Missing admin_id' }, 400);

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.admin_id).first();
  if (!user) return c.json({ error: 'User does not exist' }, 404);

  await c.env.DB.prepare('UPDATE guilds SET admin_id = ? WHERE id = ?').bind(body.admin_id, id).run();
  return c.json({ success: true });
});

// POST /api/admin/cleanup
app.post('/api/admin/cleanup', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);
  const requestingDbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!requestingDbUser || requestingDbUser.role !== 'admin') {
    return c.json({ error: 'Forbidden: Requires admin role' }, 403);
  }

  await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS global_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();

  // Sync all existing trees to their author's current guild
  await c.env.DB.prepare('UPDATE trees SET guild_id = (SELECT guild_id FROM users WHERE users.id = trees.author_id)').run();

  let treeIntervalDays = 0;
  const setting = await c.env.DB.prepare('SELECT value FROM global_settings WHERE key = ?').bind('tree_reset_interval_days').first() as any;
  if (setting && setting.value !== undefined && setting.value !== null) {
    treeIntervalDays = parseInt(setting.value as string);
    if (isNaN(treeIntervalDays)) treeIntervalDays = 0;
  }

  if (treeIntervalDays > 0) {
    const treeThreshold = Date.now() - (treeIntervalDays * 24 * 60 * 60 * 1000);
    const treesToDelete = await c.env.DB.prepare('SELECT author_id, COUNT(*) as count FROM trees WHERE planted_at < ? GROUP BY author_id').bind(treeThreshold).all();
    for (const row of treesToDelete.results as any[]) {
      await c.env.DB.prepare('UPDATE users SET total_trees_planted = MAX(total_trees_planted - ?, 0) WHERE id = ?').bind(row.count, row.author_id).run();
    }

    await c.env.DB.prepare('DELETE FROM trees WHERE planted_at < ?').bind(treeThreshold).run();
  }

  const spThreshold = Date.now() - (3 * 24 * 60 * 60 * 1000);
  await c.env.DB.prepare('DELETE FROM signposts WHERE created_at < ?').bind(spThreshold).run();
  await c.env.DB.prepare("DELETE FROM mail WHERE action_type = 'guild_join_request' AND created_at < ?").bind(spThreshold).run();

  const users = await c.env.DB.prepare('SELECT id FROM users').all();
  for (const user of users.results as any[]) {
    const history = await c.env.DB.prepare('SELECT SUM(distance) as total_dist FROM activity_history WHERE user_id = ?').bind(user.id).first() as any;
    if (history && history.total_dist) {
      const dist = Number(history.total_dist);
      await c.env.DB.prepare('UPDATE users SET total_distance_km = ? WHERE id = ?').bind(dist, user.id).run();
    }
  }

  return c.json({ success: true });
});

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    await env.DB.prepare('UPDATE trees SET guild_id = (SELECT guild_id FROM users WHERE users.id = trees.author_id)').run();

    try {
      await env.DB.prepare('DELETE FROM users WHERE verified_email = 0 AND created_at < ?')
        .bind(oneDayAgo)
        .run();
      console.log('Successfully ran unverified user cleanup cron job.');

      await notificationService.flushPendingNotifications(env);
    } catch (e) {
      console.error('Cron job error:', e);
    }
  }
};
