import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export { CommunityChatRoom } from './CommunityChatRoom';

type Bindings = {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  CHAT_ROOM: DurableObjectNamespace;
  AVATARS_BUCKET: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

app.get('/api/debug-schema', async (c) => {
  const schema = await c.env.DB.prepare('PRAGMA table_info(chat_messages)').all();
  return c.json({ schema });
});



// Authentication Middleware
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return next();
  }
  
  // Public routes
  if (
    c.req.path === '/api/check-username' || 
    c.req.path.startsWith('/api/chat/community/') ||
    (c.req.path.startsWith('/api/guilds') && c.req.method === 'GET')
  ) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const projectId = c.env.FIREBASE_PROJECT_ID || 'ecostride-d4aec';

  try {
    const JWKS = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
    );
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    
    c.set('user', payload);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
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
    const readRecord = await c.env.DB.prepare('SELECT last_read_at FROM user_chat_reads WHERE user_id = ? AND guild_id = ?').bind(jwtUser.sub, guildId).first();
    if (readRecord) lastReadAt = readRecord.last_read_at;
  }
  const messages = await c.env.DB.prepare('SELECT c.id, c.guild_id, c.sender_id as user_id, u.username, u.avatar, c.content, c.timestamp as created_at FROM chat_messages c LEFT JOIN users u ON c.sender_id = u.id WHERE c.guild_id = ? ORDER BY c.timestamp ASC').bind(guildId).all();
  return c.json({ messages: messages.results, last_read_at: lastReadAt });
});

// GET /api/chat/unread/:guildId
app.get('/api/chat/unread/:guildId', async (c) => {
  const guildId = c.req.param('guildId');
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
  
  const readRecord = await c.env.DB.prepare('SELECT last_read_at FROM user_chat_reads WHERE user_id = ? AND guild_id = ?').bind(jwtUser.sub, guildId).first();
  const lastReadAt = readRecord ? readRecord.last_read_at : 0;
  
  const unreadCountQuery = await c.env.DB.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE guild_id = ? AND timestamp > ?').bind(guildId, lastReadAt).first();
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
  
  // Send Mail to requester
    const senderMailId = `mail-${Date.now()}-snd-${Math.random().toString(36).substring(2,7)}`;
    const targetUsername = friendExists.username || 'Someone';
    const senderContent = `Friend request sent to ${targetUsername}.`;
    await c.env.DB.prepare(
      'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, action_type, action_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(senderMailId, 'Friend Request Sent', senderContent, 'System', 'user', id, 0, 'system', '{}', now).run();

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
  
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN player_id TEXT').run(); } catch(e) {}
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN nationality TEXT').run(); } catch(e) {}
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN bio TEXT').run(); } catch(e) {}
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN unlocked_badges TEXT').run(); } catch(e) {}
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN avatar TEXT').run(); } catch(e) {}
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN read_mails TEXT').run(); } catch(e) {}
  try { await c.env.DB.prepare('ALTER TABLE purchases ADD COLUMN expires_at INTEGER').run(); } catch(e) {}

  const user: any = await c.env.DB.prepare('SELECT users.*, guilds.name as guildName FROM users LEFT JOIN guilds ON users.guild_id = guilds.id WHERE users.id = ?').bind(id).first();
  if (user) {
    const history = await c.env.DB.prepare('SELECT date, distance FROM activity_history WHERE user_id = ? ORDER BY date ASC').bind(id).all();
    user.activityHistory = history.results;
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
      'INSERT INTO users (id, email, username, player_id, role, created_at, coins, total_distance_km) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, body.email || '', body.username, playerId, body.role || 'user', Date.now(), body.coins || 0, body.totalDistanceKm || 0).run();
  } else {
    // Dynamic update
    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.email !== undefined) { updates.push('email = ?'); values.push(body.email); }
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN player_id TEXT').run(); } catch(e) {}
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN avatar TEXT').run(); } catch(e) {}
    try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN read_mails TEXT').run(); } catch(e) {}
    
    if (body.username !== undefined) { updates.push('username = ?'); values.push(body.username); }
    if (body.role !== undefined) { updates.push('role = ?'); values.push(body.role); }
    if (body.coins !== undefined) { updates.push('coins = ?'); values.push(body.coins); }
    if (body.totalDistanceKm !== undefined) { updates.push('total_distance_km = ?'); values.push(body.totalDistanceKm); }
    if (body.nationality !== undefined) { updates.push('nationality = ?'); values.push(body.nationality); }
    if (body.bio !== undefined) { updates.push('bio = ?'); values.push(body.bio); }
    if (body.avatar !== undefined) { updates.push('avatar = ?'); values.push(body.avatar); }
    if (body.unlockedBadges !== undefined) { updates.push('unlocked_badges = ?'); values.push(JSON.stringify(body.unlockedBadges)); }
    if (body.readMails !== undefined) { updates.push('read_mails = ?'); values.push(JSON.stringify(body.readMails)); }
    
    if (updates.length > 0) {
      values.push(id);
      await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
    }
  }
  
  return c.json({ success: true });
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
    const user = await c.env.DB.prepare('SELECT avatar FROM users WHERE id = ?').bind(id).first();
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
  try { await c.env.DB.prepare('ALTER TABLE users ADD COLUMN avatar TEXT').run(); } catch(e) {}
  await c.env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(publicUrl, id).run();

  return c.json({ success: true, avatarUrl: publicUrl });
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
    const userRoleCheck = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
  if (userRoleCheck && userRoleCheck.role === 'merchant') {
    const merchant: any = await c.env.DB.prepare('SELECT store_name FROM merchants WHERE owner_id = ?').bind(id).first();
    const storeName = merchant ? merchant.store_name : 'a merchant';
    
    // 1. Find all items owned by this merchant
    const items = await c.env.DB.prepare('SELECT id, name, price FROM point_store WHERE merchant_id = ?').bind(id).all();
    const itemIds = items.results.map((i: any) => i.id);
    
    // 2. Soft delete their items from point_store
    await c.env.DB.prepare('UPDATE point_store SET status = ? WHERE merchant_id = ?').bind('disabled', id).run();
    
    // 3. Process active purchases
    if (itemIds.length > 0) {
      for (const itemId of itemIds) {
        const item = items.results.find((i: any) => i.id === itemId);
        const purchases = await c.env.DB.prepare('SELECT id, user_id FROM purchases WHERE item_id = ? AND status = ?').bind(itemId, 'active').all();
        
        for (const p of purchases.results as any[]) {
          // Refund user
          await c.env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(item.price, p.user_id).run();
          
          // Disable purchase
          await c.env.DB.prepare('UPDATE purchases SET status = ? WHERE id = ?').bind('disabled_by_admin', p.id).run();
          
          // Send mail
          const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
          const content = `We're sorry, but the voucher "${item.name}" from ${storeName} has been disabled because the merchant has closed their account. Your ${item.price} Eco-Coins have been refunded to your account.`;
          await c.env.DB.prepare(
            'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(mailId, 'Voucher Disabled & Refunded', content, 'System Admin', 'user', p.user_id, 0, Date.now()).run();
        }
      }
    }
    
    // 4. Delete the merchant record and their pending applications
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
  
    // Then delete user
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    
    return c.json({ success: true });
  } catch (err: any) {
    console.error("DELETE user error:", err);
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/map-data', async (c) => {
  // Ensure columns exist (fail silently if they already exist)
  try { await c.env.DB.prepare('ALTER TABLE signposts ADD COLUMN likes INTEGER DEFAULT 0').run(); } catch(e) {}
  try { await c.env.DB.prepare('ALTER TABLE signposts ADD COLUMN liked_by TEXT DEFAULT "[]"').run(); } catch(e) {}
  try { await c.env.DB.prepare('ALTER TABLE signposts ADD COLUMN images TEXT DEFAULT "[]"').run(); } catch(e) {}

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
  
  return c.json({ success: true, id });
});

app.delete('/api/trees/:id', async (c) => {
  const id = c.req.param('id');
  // Need to get the author to refund
  const tree = await c.env.DB.prepare('SELECT author_id FROM trees WHERE id = ?').bind(id).first();
  if (tree) {
    await c.env.DB.prepare('DELETE FROM trees WHERE id = ?').bind(id).run();
    await c.env.DB.prepare('UPDATE users SET coins = coins + 100, total_trees_planted = total_trees_planted - 1 WHERE id = ?').bind(tree.author_id).run();
  }
  return c.json({ success: true });
});

app.post('/api/signposts', async (c) => {
  const body = await c.req.json();
  const id = `sp-${Date.now()}`;
  
  try { await c.env.DB.prepare('ALTER TABLE signposts ADD COLUMN images TEXT DEFAULT "[]"').run(); } catch(e) {}

  await c.env.DB.prepare(
    'INSERT INTO signposts (id, author_id, lng, lat, message, emoji, category, created_at, expires_at, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.authorId, body.lng, body.lat, body.message, body.emoji, body.category, Date.now(), Date.now() + 24*60*60*1000, JSON.stringify(body.images || [])).run();
  
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
  await c.env.DB.prepare('DELETE FROM signposts WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

app.post('/api/signposts/:id/like', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const userId = body.userId;
  
  if (!userId) return c.json({ error: 'User ID required' }, 400);

  const signpost: any = await c.env.DB.prepare('SELECT likes, liked_by FROM signposts WHERE id = ?').bind(id).first();
  if (!signpost) return c.json({ error: 'Signpost not found' }, 404);

  let likedBy = [];
  try { likedBy = JSON.parse(signpost.liked_by || '[]'); } catch (e) {}

  if (likedBy.includes(userId)) {
    return c.json({ error: 'Already liked' }, 400);
  }

  likedBy.push(userId);
  const newLikes = (signpost.likes || 0) + 1;

  await c.env.DB.prepare('UPDATE signposts SET likes = ?, liked_by = ? WHERE id = ?')
    .bind(newLikes, JSON.stringify(likedBy), id).run();

  return c.json({ success: true, likes: newLikes, likedBy });
});

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
  const users = await c.env.DB.prepare("SELECT users.id, users.username, users.guild_id, guilds.name as guildName, users.coins, users.total_distance_km, users.total_trees_planted, users.avatar, users.player_id FROM users LEFT JOIN guilds ON users.guild_id = guilds.id WHERE users.role != 'admin' ORDER BY users.total_distance_km DESC LIMIT 50").all();
  return c.json({ users: users.results });
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
    
    try { await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS user_deleted_mail (user_id TEXT, mail_id TEXT, deleted_at INTEGER, PRIMARY KEY (user_id, mail_id))').run(); } catch(e) {}
      try { await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS user_read_mail (user_id TEXT, mail_id TEXT, read_at INTEGER, PRIMARY KEY (user_id, mail_id))').run(); } catch(e) {}
      // Check if user is authenticated (to filter out their deleted mails)
    let deletedMailIds: string[] = [];
    let readMailIds: string[] = [];
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
        const { payload } = await jwtVerify(token, JWKS, { 
          issuer: `https://securetoken.google.com/${c.env.FIREBASE_PROJECT_ID || 'ecostride-d4aec'}`,
          audience: c.env.FIREBASE_PROJECT_ID || 'ecostride-d4aec'
        });
        if (payload.sub) {
          const deleted = await c.env.DB.prepare('SELECT mail_id FROM user_deleted_mail WHERE user_id = ?').bind(payload.sub).all();
          deletedMailIds = deleted.results.map((r: any) => r.mail_id);
          const read = await c.env.DB.prepare('SELECT mail_id FROM user_read_mail WHERE user_id = ?').bind(payload.sub).all();
          readMailIds = read.results.map((r: any) => r.mail_id);
        }
      } catch (e) {
        // Just ignore if token is invalid, they'll just get all mail
      }
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
  const id = `mail-${Date.now()}`;

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

  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, recipient_name, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.title, body.content, body.sender, body.recipientType, finalRecipientId, finalRecipientName, body.expiresForNewUsers ? 1 : 0, Date.now()).run();
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
  try { await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS demo_requests (id TEXT PRIMARY KEY, email TEXT, ip_address TEXT, status TEXT, requested_at INTEGER)').run(); } catch(e) {}
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
  return c.json({ success: true });
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
    
    // Find the merchant to get their owner_id
    const merchant: any = await c.env.DB.prepare('SELECT owner_id, store_name FROM merchants WHERE id = ?').bind(id).first();
    if (merchant && merchant.owner_id) {
      const storeName = merchant.store_name;
      
      // Find all items owned by this merchant
      const items = await c.env.DB.prepare('SELECT id, name, price FROM point_store WHERE merchant_id = ?').bind(merchant.owner_id).all();
      const itemIds = items.results.map((i: any) => i.id);
      
      // Soft delete their items from point_store
      await c.env.DB.prepare('UPDATE point_store SET status = ? WHERE merchant_id = ?').bind('disabled', merchant.owner_id).run();
      
      // Process purchases
      if (itemIds.length > 0) {
        for (const itemId of itemIds) {
          const item = items.results.find((i: any) => i.id === itemId);
          const purchases = await c.env.DB.prepare('SELECT id, user_id FROM purchases WHERE item_id = ? AND status = ?').bind(itemId, 'active').all();
          
          for (const p of purchases.results as any[]) {
            // Refund user
            await c.env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(item.price, p.user_id).run();
            
            // Disable purchase
            await c.env.DB.prepare('UPDATE purchases SET status = ? WHERE id = ?').bind('disabled_by_admin', p.id).run();
            
            // Send mail
            const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
            const content = `We're sorry, but the voucher "${item.name}" from ${storeName} has been disabled because the shop was taken down. Your ${item.price} Eco-Coins have been refunded to your account.`;
            await c.env.DB.prepare(
              'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(mailId, 'Voucher Disabled & Refunded', content, 'System Admin', 'user', p.user_id, 0, Date.now()).run();
          }
        }
      }
      
      // Delete pending applications
      await c.env.DB.prepare('DELETE FROM applications WHERE owner_id = ?').bind(merchant.owner_id).run();
      
      // Email merchant
      const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
      const content = `Your shop "${storeName}" has been taken down by the administrator due to policy violations. All your active vouchers have been disabled.`;
      await c.env.DB.prepare(
        'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(mailId, 'Shop Taken Down', content, 'System Admin', 'user', merchant.owner_id, 0, Date.now()).run();
      // Hard delete merchant record so it disappears from Admin Dashboard and Map
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
        try { details = JSON.parse(app.details); } catch(e) {}
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
        try { details = JSON.parse(app.details); } catch(e) {}
        
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
              ).bind(itemId, app.owner_id, 'Vouchers', v.name, v.desc, v.price, v.stock, v.icon).run();
            }
          }
        } else if (app.type === 'modification') {
          if (details.location) {
            await c.env.DB.prepare(
              'UPDATE merchants SET store_name = ?, menu_link = ?, location = ? WHERE owner_id = ?'
            ).bind(details.storeName || '', details.menuLink || '', JSON.stringify(details.location), app.owner_id).run();
          } else {
            await c.env.DB.prepare(
              'UPDATE merchants SET store_name = ?, menu_link = ? WHERE owner_id = ?'
            ).bind(details.storeName || '', details.menuLink || '', app.owner_id).run();
          }
          
          if (details.vouchers && Array.isArray(details.vouchers)) {
            const keepIds = details.vouchers.filter((v: any) => v.originalId).map((v: any) => v.originalId);
            const currentVouchers = await c.env.DB.prepare("SELECT id, name, price FROM point_store WHERE merchant_id = ? AND (status != 'disabled' OR status IS NULL)").bind(app.owner_id).all();
            
            for (const cv of currentVouchers.results as any[]) {
              if (!keepIds.includes(cv.id)) {
                await c.env.DB.prepare("UPDATE point_store SET status = 'disabled' WHERE id = ?").bind(cv.id).run();
                
                const purchases = await c.env.DB.prepare("SELECT id, user_id FROM purchases WHERE item_id = ? AND status = 'active'").bind(cv.id).all();
                for (const p of purchases.results as any[]) {
                  await c.env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(cv.price, p.user_id).run();
                  await c.env.DB.prepare("UPDATE purchases SET status = 'disabled_by_admin' WHERE id = ?").bind(p.id).run();
                  
                  const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
                  const content = `We're sorry, but the voucher "${cv.name}" has been removed by the merchant. Your ${cv.price} Eco-Coins have been refunded to your account.`;
                  await c.env.DB.prepare(
                    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                  ).bind(mailId, 'Voucher Removed & Refunded', content, 'System Admin', 'user', p.user_id, 0, Date.now()).run();
                }
              }
            }

            for (const v of details.vouchers) {
              const safeDesc = v.desc || v.description || '';
              if (v.originalId) {
                await c.env.DB.prepare(
                  'UPDATE point_store SET name = ?, desc = ?, price = ?, stock = ?, icon = ? WHERE id = ? AND merchant_id = ?'
                ).bind(v.name, safeDesc, v.price, v.stock, v.icon, v.originalId, app.owner_id).run();
              } else {
                const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                await c.env.DB.prepare(
                  'INSERT INTO point_store (id, merchant_id, category, name, desc, price, stock, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(itemId, app.owner_id, 'Vouchers', v.name, safeDesc, v.price, v.stock, v.icon).run();
              }
            }
          }
        }
      }
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
  } catch(e) {}
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
        const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
        const content = `We're sorry, but the voucher "${item.name}" has been disabled due to certain reason. Your ${item.price} Eco-Coins have been refunded to your account.`;
        await c.env.DB.prepare(
          'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(mailId, 'Voucher Disabled & Refunded', content, 'System Admin', 'user', p.user_id, 0, Date.now()).run();
      }
    }
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Merchant Sales and Redemption


app.get('/api/merchants/sales/:ownerId', async (c) => {
  const ownerId = c.req.param('ownerId');
  const purchases = await c.env.DB.prepare('SELECT purchases.*, users.username as buyerUsername, users.player_id as buyerUid FROM purchases LEFT JOIN users ON purchases.user_id = users.id WHERE merchant_id = ? ORDER BY purchased_at DESC').bind(ownerId).all();
  return c.json({ purchases: purchases.results });
});

app.post('/api/merchants/redeem/:purchaseId', async (c) => {
  const purchaseId = c.req.param('purchaseId');
  const body = await c.req.json();
  await c.env.DB.prepare('UPDATE purchases SET status = ?, redeemed_at = ? WHERE id = ? AND merchant_id = ?')
    .bind('redeemed', Date.now(), purchaseId, body.ownerId).run();
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
      'SELECT purchases.*, point_store.name as item_name, point_store.desc as item_desc, point_store.icon, merchants.store_name FROM purchases LEFT JOIN point_store ON purchases.item_id = point_store.id LEFT JOIN merchants ON purchases.merchant_id = merchants.owner_id WHERE purchases.user_id = ? ORDER BY purchases.purchased_at DESC'
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
    const purchaseId = body.purchaseId;
    const merchantId = body.merchantId; // owner_id
    
    const purchase: any = await c.env.DB.prepare('SELECT * FROM purchases WHERE id = ?').bind(purchaseId).first();
    if (!purchase) return c.json({ error: 'Voucher not found' }, 404);
    
    if (purchase.merchant_id !== merchantId) {
      return c.json({ error: 'Invalid voucher for this shop' }, 400);
    }
    if (purchase.status === 'redeemed') {
      return c.json({ error: 'Voucher has already been redeemed' }, 400);
    }
    if (purchase.status !== 'active') {
      return c.json({ error: `Voucher is ${purchase.status}` }, 400);
    }
    if (purchase.expires_at && Date.now() > purchase.expires_at) {
      await c.env.DB.prepare('UPDATE purchases SET status = ? WHERE id = ?').bind('expired', purchaseId).run();
      return c.json({ error: 'Voucher redemption has expired' }, 400);
    }
    
    // Valid! Redeem it.
    await c.env.DB.prepare('UPDATE purchases SET status = ?, redeemed_at = ? WHERE id = ?').bind('redeemed', Date.now(), purchaseId).run();
    return c.json({ success: true });
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
  const file = body['icon_file'];
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
  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, action_type, action_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    mailId,
    'New Join Request',
    `${username} wants to join ${guild.name}.`,
    'System',
    'user',
    guild.admin_id,
    0,
    'guild_join_request',
    JSON.stringify({ guildId: guild.id, userId: user.sub, username, guildName: guild.name }),
    Date.now()
  ).run();

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
        await c.env.DB.prepare(
          'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), 'Join Request Approved', `The admin approved your request to join ${guildName}.`, 'System', 'user', userId, 0, Date.now()).run();
      }
    } else if (action === 'reject') {
      await c.env.DB.prepare('UPDATE mail SET content = ?, action_type = NULL, action_data = NULL WHERE id = ?')
        .bind(`You rejected ${username} to join the community.`, mailId).run();
        
      // Notify user
      await c.env.DB.prepare(
        'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), 'Join Request Rejected', `The admin rejected your request to join ${guildName}.`, 'System', 'user', userId, 0, Date.now()).run();
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
    try {
      const projectId = c.env.FIREBASE_PROJECT_ID || 'ecostride-d4aec';
      const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
      const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${projectId}`, audience: projectId });
      if (payload.sub) {
        const existingReq = await c.env.DB.prepare(
          "SELECT id FROM mail WHERE action_type = 'guild_join_request' AND action_data LIKE ? AND action_data LIKE ?"
        ).bind(`%"guildId":"${guildId}"%`, `%"userId":"${payload.sub}"%`).first();
        if (existingReq) hasPendingRequest = true;
      }
    } catch (e) {}
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

  const projectId = c.env.FIREBASE_PROJECT_ID || 'ecostride-d4aec';
  let userId = '';

  try {
    const JWKS = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
    );
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    userId = payload.sub as string;
  } catch (err) {
    console.error("JWT Verify Error:", err);
    return c.text('Invalid token', 401);
  }

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
    const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
    const content = `${me?.username || 'Someone'} has sent you a friend request.`;
    const actionData = JSON.stringify({ requester_id: id, requester_username: me?.username });
    
    await c.env.DB.prepare(
      'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, action_type, action_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(mailId, 'Friend Request', content, 'System', 'user', body.friendId, 0, 'friend_request', actionData, now).run();

    // Send Mail to requester
    const senderMailId = `mail-${Date.now()}-snd-${Math.random().toString(36).substring(2,7)}`;
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

  const mailId1 = `mail-${now}-u1-${Math.random().toString(36).substring(2,7)}`;
  const mailId2 = `mail-${now}-u2-${Math.random().toString(36).substring(2,7)}`;

  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, action_type, action_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(mailId1, 'Friend Removed', `You have unfriended ${u2Name}.`, 'System', 'user', id, 0, 'system', '{}', now).run();

  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, action_type, action_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(mailId2, 'Friend Removed', `${u1Name} has unfriended you.`, 'System', 'user', friendId, 0, 'system', '{}', now).run();
    
  return c.json({ success: true });
});

// GET user
app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const user: any = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (user) {
    const history = await c.env.DB.prepare('SELECT date, distance FROM activity_history WHERE user_id = ? ORDER BY date ASC').bind(id).all();
    user.activityHistory = history.results;
    
    if (user.guild_id) {
      const guild: any = await c.env.DB.prepare('SELECT name FROM guilds WHERE id = ?').bind(user.guild_id).first();
      if (guild) {
        user.guildName = guild.name;
      }
    }
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
      'INSERT INTO users (id, email, username, player_id, role, created_at, coins, total_distance_km) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, body.email || '', body.username, playerId, body.role || 'user', Date.now(), body.coins || 0, body.totalDistanceKm || 0).run();
  } else {
    // Dynamic update
    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.email !== undefined) { updates.push('email = ?'); values.push(body.email); }
    if (body.username !== undefined) { updates.push('username = ?'); values.push(body.username); }
    if (body.role !== undefined) { updates.push('role = ?'); values.push(body.role); }
    if (body.coins !== undefined) { updates.push('coins = ?'); values.push(body.coins); }
    if (body.totalDistanceKm !== undefined) { updates.push('total_distance_km = ?'); values.push(body.totalDistanceKm); }
    if (body.bio !== undefined) { updates.push('bio = ?'); values.push(body.bio); }
    if (body.nationality !== undefined) { updates.push('nationality = ?'); values.push(body.nationality); }
    if (body.unlocked_badges !== undefined) { updates.push('unlocked_badges = ?'); values.push(typeof body.unlocked_badges === 'string' ? body.unlocked_badges : JSON.stringify(body.unlocked_badges)); }
    if (body.avatar !== undefined) { updates.push('avatar = ?'); values.push(body.avatar); }
    
    if (updates.length > 0) {
      values.push(id);
      await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
    }
  }
  
  return c.json({ success: true });
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
    const userRoleCheck = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
  if (userRoleCheck && userRoleCheck.role === 'merchant') {
    const merchant: any = await c.env.DB.prepare('SELECT store_name FROM merchants WHERE owner_id = ?').bind(id).first();
    const storeName = merchant ? merchant.store_name : 'a merchant';
    
    // 1. Find all items owned by this merchant
    const items = await c.env.DB.prepare('SELECT id, name, price FROM point_store WHERE merchant_id = ?').bind(id).all();
    const itemIds = items.results.map((i: any) => i.id);
    
    // 2. Soft delete their items from point_store
    await c.env.DB.prepare('UPDATE point_store SET status = ? WHERE merchant_id = ?').bind('disabled', id).run();
    
    // 3. Process active purchases
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
          const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
          const content = `We're sorry, but the voucher "${item.name}" from ${storeName} has been disabled because the merchant has closed their account. Your ${item.price} Eco-Coins have been refunded to your account.`;
          await c.env.DB.prepare(
            'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(mailId, 'Voucher Disabled & Refunded', content, 'System Admin', 'user', p.user_id, 0, Date.now()).run();
        }
      }
    }
    
    // 4. Delete the merchant record and their pending applications
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
  
    // Then delete user
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    
    return c.json({ success: true });
  } catch (err: any) {
    console.error("DELETE user error:", err);
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/map-data', async (c) => {
  const trees = await c.env.DB.prepare('SELECT trees.*, users.username as authorUsername, users.email as authorEmail, guilds.name as guildName FROM trees LEFT JOIN users ON trees.author_id = users.id LEFT JOIN guilds ON users.guild_id = guilds.id').all();
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
  await c.env.DB.prepare(
    'INSERT INTO signposts (id, author_id, lng, lat, message, emoji, category, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.authorId, body.lng, body.lat, body.message, body.emoji, body.category, Date.now(), Date.now() + 24*60*60*1000).run();
  
  return c.json({ success: true, id });
});

app.delete('/api/signposts/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM signposts WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

app.post('/api/signposts/:id/like', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const userId = body.userId;
  
  if (!userId) return c.json({ error: 'User ID required' }, 400);

  const signpost: any = await c.env.DB.prepare('SELECT likes, liked_by FROM signposts WHERE id = ?').bind(id).first();
  if (!signpost) return c.json({ error: 'Signpost not found' }, 404);

  let likedBy = [];
  try { likedBy = JSON.parse(signpost.liked_by || '[]'); } catch (e) {}

  if (likedBy.includes(userId)) {
    return c.json({ error: 'Already liked' }, 400);
  }

  likedBy.push(userId);
  const newLikes = (signpost.likes || 0) + 1;

  await c.env.DB.prepare('UPDATE signposts SET likes = ?, liked_by = ? WHERE id = ?')
    .bind(newLikes, JSON.stringify(likedBy), id).run();

  return c.json({ success: true, likes: newLikes, likedBy });
});

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

app.get('/api/store', async (c) => {
  try {
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

  const item: any = await c.env.DB.prepare('SELECT merchant_id, price, stock, status FROM point_store WHERE id = ?').bind(itemId).first();
  if (!item) return c.json({ error: 'Item not found' }, 404);
  if (item.status === 'disabled') return c.json({ error: 'Item is no longer available' }, 400);
  if (item.stock === 0) return c.json({ error: 'Item is out of stock' }, 400);

  const merchantId = item.merchant_id;

  const user: any = await c.env.DB.prepare('SELECT coins FROM users WHERE id = ?').bind(userId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.coins < item.price) return c.json({ error: 'Insufficient coins' }, 400);

  // Deduct coins and update stock
  await c.env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').bind(item.price, userId).run();
  await c.env.DB.prepare('UPDATE point_store SET stock = stock - 1 WHERE id = ? AND stock > 0').bind(itemId).run();
  
  const purchaseId = `purchase-${Date.now()}`;
  await c.env.DB.prepare(
    'INSERT INTO purchases (id, user_id, merchant_id, item_id, item_name, price, status, purchased_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(purchaseId, userId, merchantId, itemId, itemName, item.price, 'active', Date.now()).run();

  return c.json({ success: true, purchaseId, remainingCoins: user.coins - item.price });
});

app.get('/api/admin/dashboard', async (c) => {
  const users = await c.env.DB.prepare('SELECT * FROM users').all();
  const trees = await c.env.DB.prepare('SELECT trees.*, users.username as authorUsername, users.email as authorEmail, guilds.name as guildName FROM trees LEFT JOIN users ON trees.author_id = users.id LEFT JOIN guilds ON users.guild_id = guilds.id').all();
  const signposts = await c.env.DB.prepare('SELECT * FROM signposts').all();
  const storeItems = await c.env.DB.prepare("SELECT * FROM point_store WHERE status = 'active' OR status IS NULL").all();
  const categories = await c.env.DB.prepare('SELECT * FROM store_categories').all();
  const merchants = await c.env.DB.prepare('SELECT * FROM merchants').all();
  const applications = await c.env.DB.prepare('SELECT * FROM applications').all();
  const demoRequests = await c.env.DB.prepare('SELECT * FROM demo_requests').all();
  const mail = await c.env.DB.prepare('SELECT * FROM mail ORDER BY created_at DESC').all();

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

app.post('/api/admin/users/:id/ban', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json(); // { duration: '3d' | '14d' | '3m' | 'forever' | null }
  let bannedUntil = null;
  if (body.duration) {
    const now = Date.now();
    if (body.duration === '3d') bannedUntil = now + (3 * 24 * 60 * 60 * 1000);
    else if (body.duration === '14d') bannedUntil = now + (14 * 24 * 60 * 60 * 1000);
    else if (body.duration === '3m') bannedUntil = now + (90 * 24 * 60 * 60 * 1000);
    else if (body.duration === 'forever') bannedUntil = -1; // -1 means forever
  }
  
  await c.env.DB.prepare('UPDATE users SET banned_until = ? WHERE id = ?').bind(bannedUntil, id).run();
  return c.json({ success: true, bannedUntil });
});

app.delete('/api/admin/guilds/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE users SET guild_id = NULL, muted_until = NULL WHERE guild_id = ?').bind(id).run();
  await c.env.DB.prepare('UPDATE trees SET guild_id = NULL WHERE guild_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE guild_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM guilds WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

app.put('/api/admin/guilds/:id/admin', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  if (!body.admin_id) return c.json({ error: 'Missing admin_id' }, 400);

  // Validate the user actually exists
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.admin_id).first();
  if (!user) return c.json({ error: 'User does not exist' }, 404);

  await c.env.DB.prepare('UPDATE guilds SET admin_id = ? WHERE id = ?').bind(body.admin_id, id).run();
  return c.json({ success: true });
});

app.post('/api/admin/cleanup', async (c) => {
  // Ensure table exists to prevent 500 on fresh startup
  await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS global_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  
  // Sync all existing trees to their author's current guild (migration/cleanup)
  await c.env.DB.prepare('UPDATE trees SET guild_id = (SELECT guild_id FROM users WHERE users.id = trees.author_id)').run();
  
  // Fetch tree reset interval setting
  let treeIntervalDays = 7; // default
  const setting = await c.env.DB.prepare('SELECT value FROM global_settings WHERE key = ?').bind('tree_reset_interval_days').first();
  if (setting && setting.value) {
    treeIntervalDays = parseInt(setting.value as string) || 7;
  }
  
  // Trees > configured days
  const treeThreshold = Date.now() - (treeIntervalDays * 24 * 60 * 60 * 1000);
  
  // Decrement total_trees_planted for users whose trees are being cleaned up
  const treesToDelete = await c.env.DB.prepare('SELECT author_id, COUNT(*) as count FROM trees WHERE planted_at < ? GROUP BY author_id').bind(treeThreshold).all();
  for (const row of treesToDelete.results as any[]) {
    await c.env.DB.prepare('UPDATE users SET total_trees_planted = MAX(total_trees_planted - ?, 0) WHERE id = ?').bind(row.count, row.author_id).run();
  }
  
  await c.env.DB.prepare('DELETE FROM trees WHERE planted_at < ?').bind(treeThreshold).run();
  
  // Signposts > 3 days (fixed)
  const spThreshold = Date.now() - (3 * 24 * 60 * 60 * 1000);
  await c.env.DB.prepare('DELETE FROM signposts WHERE created_at < ?').bind(spThreshold).run();
  
  // Guild Join Requests > 3 days
  await c.env.DB.prepare("DELETE FROM mail WHERE action_type = 'guild_join_request' AND created_at < ?").bind(spThreshold).run();
  
  // Recalibrate user stats from activity_history
  const users = await c.env.DB.prepare('SELECT id FROM users').all();
  for (const user of users.results) {
    const history = await c.env.DB.prepare('SELECT SUM(distance) as total_dist FROM activity_history WHERE user_id = ?').bind(user.id).first();
    if (history && history.total_dist) {
      const dist = Number(history.total_dist);
      const coins = Math.floor((dist / 5.88) * 100);
      await c.env.DB.prepare('UPDATE users SET total_distance_km = ?, coins = ? WHERE id = ?').bind(dist, coins, user.id).run();
    }
  }

  return c.json({ success: true });
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
    
    // Check if user is authenticated (to filter out their deleted mails)
    let deletedMailIds: string[] = [];
    let readMailIds: string[] = [];
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
        const { payload } = await jwtVerify(token, JWKS, { 
          issuer: `https://securetoken.google.com/${c.env.FIREBASE_PROJECT_ID || 'ecostride-d4aec'}`,
          audience: c.env.FIREBASE_PROJECT_ID || 'ecostride-d4aec'
        });
        if (payload.sub) {
          const deleted = await c.env.DB.prepare('SELECT mail_id FROM user_deleted_mail WHERE user_id = ?').bind(payload.sub).all();
          deletedMailIds = deleted.results.map((r: any) => r.mail_id);
          const read = await c.env.DB.prepare('SELECT mail_id FROM user_read_mail WHERE user_id = ?').bind(payload.sub).all();
          readMailIds = read.results.map((r: any) => r.mail_id);
        }
      } catch (e) {
        // Just ignore if token is invalid, they'll just get all mail
      }
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
  const id = `mail-${Date.now()}`;

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

  await c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, recipient_name, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.title, body.content, body.sender, body.recipientType, finalRecipientId, finalRecipientName, body.expiresForNewUsers ? 1 : 0, Date.now()).run();
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
app.get('/api/demo_requests/:id', async (c) => {
  const id = c.req.param('id');
  const req = await c.env.DB.prepare('SELECT * FROM demo_requests WHERE id = ?').bind(id).first();
  return c.json({ demoRequest: req });
});
app.post('/api/demo_requests', async (c) => {
  const body = await c.req.json();
  const { id, email, ipAddress } = body;
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
  return c.json({ success: true });
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
    
    // Find the merchant to get their owner_id
    const merchant: any = await c.env.DB.prepare('SELECT owner_id, store_name FROM merchants WHERE id = ?').bind(id).first();
    if (merchant && merchant.owner_id) {
      const storeName = merchant.store_name;
      
      // Find all items owned by this merchant
      const items = await c.env.DB.prepare('SELECT id, name, price FROM point_store WHERE merchant_id = ?').bind(merchant.owner_id).all();
      const itemIds = items.results.map((i: any) => i.id);
      
      // Soft delete their items from point_store
      await c.env.DB.prepare('UPDATE point_store SET status = ? WHERE merchant_id = ?').bind('disabled', merchant.owner_id).run();
      
      // Process purchases
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
            const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
            const content = `We're sorry, but the voucher "${item.name}" from ${storeName} has been disabled because the shop was taken down. Your ${item.price} Eco-Coins have been refunded to your account.`;
            await c.env.DB.prepare(
              'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(mailId, 'Voucher Disabled & Refunded', content, 'System Admin', 'user', p.user_id, 0, Date.now()).run();
          }
        }
      }
      
      // Delete pending applications
      await c.env.DB.prepare('DELETE FROM applications WHERE owner_id = ?').bind(merchant.owner_id).run();
      
      // Email merchant
      const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
      const content = `Your shop "${storeName}" has been taken down by the administrator due to policy violations. All your active vouchers have been disabled.`;
      await c.env.DB.prepare(
        'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(mailId, 'Shop Taken Down', content, 'System Admin', 'user', merchant.owner_id, 0, Date.now()).run();
      // Hard delete merchant record so it disappears from Admin Dashboard and Map
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
        try { details = JSON.parse(app.details); } catch(e) {}
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
        try { details = JSON.parse(app.details); } catch(e) {}
        
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
              ).bind(itemId, app.owner_id, 'Vouchers', v.name, v.desc, v.price, v.stock, v.icon).run();
            }
          }
        } else if (app.type === 'modification') {
          if (details.location) {
            await c.env.DB.prepare(
              'UPDATE merchants SET store_name = ?, menu_link = ?, location = ? WHERE owner_id = ?'
            ).bind(details.storeName || '', details.menuLink || '', JSON.stringify(details.location), app.owner_id).run();
          } else {
            await c.env.DB.prepare(
              'UPDATE merchants SET store_name = ?, menu_link = ? WHERE owner_id = ?'
            ).bind(details.storeName || '', details.menuLink || '', app.owner_id).run();
          }
          
          if (details.vouchers && Array.isArray(details.vouchers)) {
            for (const v of details.vouchers) {
              if (v.originalId) {
                await c.env.DB.prepare(
                  'UPDATE point_store SET name = ?, desc = ?, price = ?, stock = ?, icon = ? WHERE id = ? AND merchant_id = ?'
                ).bind(v.name, v.desc || v.description, v.price, v.stock, v.icon, v.originalId, app.owner_id).run();
              } else {
                const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                await c.env.DB.prepare(
                  'INSERT INTO point_store (id, merchant_id, category, name, desc, price, stock, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(itemId, app.owner_id, 'Vouchers', v.name, v.desc || v.description, v.price, v.stock, v.icon).run();
              }
            }
          }
        }
      }
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
app.get('/api/leaderboard', async (c) => {
  const users = await c.env.DB.prepare("SELECT * FROM users WHERE role != 'admin' ORDER BY coins DESC LIMIT 50").all();
  
  const players = users.results.map((u: any) => ({
    id: u.id,
    avatar: '🏃',
    name: u.username || (u.email ? u.email.split('@')[0] : 'Unknown'),
    guildName: 'Independent',
    weeklyPoints: u.coins || 0,
    monthlyPoints: u.coins || 0,
    totalMileageKm: u.total_distance_km || 0
  }));

  return c.json({ players });
});

// Store Admin CRUD
app.post('/api/store', async (c) => {
  const body = await c.req.json();
  const id = `item-${Date.now()}`;
  try {
    await c.env.DB.prepare("ALTER TABLE point_store ADD COLUMN link TEXT").run();
  } catch(e) {}
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
        const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
        const content = `We're sorry, but the voucher "${item.name}" has been disabled due to certain reason. Your ${item.price} Eco-Coins have been refunded to your account.`;
        await c.env.DB.prepare(
          'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(mailId, 'Voucher Disabled & Refunded', content, 'System Admin', 'user', p.user_id, 0, Date.now()).run();
      }
    }
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Merchant Sales and Redemption


app.get('/api/merchants/sales/:ownerId', async (c) => {
  const ownerId = c.req.param('ownerId');
  const purchases = await c.env.DB.prepare('SELECT purchases.*, users.username as buyerUsername, users.player_id as buyerUid FROM purchases LEFT JOIN users ON purchases.user_id = users.id WHERE merchant_id = ? ORDER BY purchased_at DESC').bind(ownerId).all();
  return c.json({ purchases: purchases.results });
});

app.post('/api/merchants/redeem/:purchaseId', async (c) => {
  const purchaseId = c.req.param('purchaseId');
  const body = await c.req.json();
  await c.env.DB.prepare('UPDATE purchases SET status = ?, redeemed_at = ? WHERE id = ? AND merchant_id = ?')
    .bind('redeemed', Date.now(), purchaseId, body.ownerId).run();
  return c.json({ success: true });
});

app.post('/api/users/:uid/verify', async (c) => {
  const uid = c.req.param('uid');
  await c.env.DB.prepare('UPDATE users SET verified_email = 1 WHERE id = ?').bind(uid).run();
  return c.json({ success: true });
});

  // Admin Actions
  app.post('/api/guilds/:id/members/:memberId/kick', async (c) => {
    const user = c.get('user') as any;
    if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
    
    const guildId = c.req.param('id');
    const memberId = c.req.param('memberId');
    const body = await c.req.json().catch(() => ({}));
    const reason = body.reason || 'No reason provided';
    
    const guild = await c.env.DB.prepare('SELECT admin_id, name FROM guilds WHERE id = ?').bind(guildId).first() as any;
    if (!guild || guild.admin_id !== user.sub) return c.json({ error: 'Unauthorized' }, 401);
    
    await c.env.DB.prepare('UPDATE users SET guild_id = NULL, muted_until = NULL WHERE id = ? AND guild_id = ?').bind(memberId, guildId).run();
    await c.env.DB.prepare('UPDATE trees SET guild_id = NULL WHERE author_id = ? AND guild_id = ?').bind(memberId, guildId).run();
    
    // Add system message
    const kickedUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(memberId).first();
    if (kickedUser) {
      {
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
    }
    
    // Notify user
    await c.env.DB.prepare(
      'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), 'Kicked from Community', `You have been removed from ${guild.name} by the admin. Reason: ${reason}`, 'System', 'user', memberId, 0, Date.now()).run();
    
    return c.json({ success: true });
  });

  app.post('/api/guilds/:id/members/:memberId/mute', async (c) => {
    const user = c.get('user') as any;
    if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
    
    const guildId = c.req.param('id');
    const memberId = c.req.param('memberId');
    const { durationMs, action } = await c.req.json();
    
    const guild = await c.env.DB.prepare('SELECT admin_id FROM guilds WHERE id = ?').bind(guildId).first() as any;
    if (!guild || guild.admin_id !== user.sub) return c.json({ error: 'Unauthorized' }, 401);
    
    const targetUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(memberId).first() as any;
    const targetName = targetUser ? targetUser.username : 'A member';
    
    if (action === 'unmute') {
      await c.env.DB.prepare('UPDATE users SET muted_until = NULL WHERE id = ? AND guild_id = ?').bind(memberId, guildId).run();
      {
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
          created_at: _ts
          , action: 'unmute', target_user_id: memberId
        })
      }));
    }
    } else {
      const mutedUntil = durationMs === -1 ? -1 : Date.now() + durationMs;
      await c.env.DB.prepare('UPDATE users SET muted_until = ? WHERE id = ? AND guild_id = ?').bind(mutedUntil, memberId, guildId).run();
      {
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
          created_at: _ts
          , action: 'mute', target_user_id: memberId
        })
      }));
    }
    }
    
    return c.json({ success: true });
  });

  app.post('/api/guilds/:id/transfer_admin', async (c) => {
    const user = c.get('user') as any;
    if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
    
    const guildId = c.req.param('id');
    const { newAdminId } = await c.req.json();
    
    const guild = await c.env.DB.prepare('SELECT admin_id, name FROM guilds WHERE id = ?').bind(guildId).first() as any;
    if (!guild || guild.admin_id !== user.sub) return c.json({ error: 'Unauthorized' }, 401);
    
    await c.env.DB.prepare('UPDATE guilds SET admin_id = ? WHERE id = ?').bind(newAdminId, guildId).run();
    
    // Add system message
    const newAdminUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(newAdminId).first() as any;
    if (newAdminUser) {
      {
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
    }
    }
    
    await c.env.DB.prepare(
      'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), 'Promoted to Admin', `You have been promoted to become an admin of ${guild.name}.`, 'System', 'user', newAdminId, 0, Date.now()).run();
    
    return c.json({ success: true });
  });

  app.delete('/api/guilds/:id', async (c) => {
    const user = c.get('user') as any;
    if (!user || !user.sub) return c.json({ error: 'Unauthorized' }, 401);
    
    const guildId = c.req.param('id');
    const guild = await c.env.DB.prepare('SELECT admin_id FROM guilds WHERE id = ?').bind(guildId).first() as any;
    if (!guild || guild.admin_id !== user.sub) return c.json({ error: 'Unauthorized' }, 401);
    
    const memberCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE guild_id = ?').bind(guildId).first() as any;
    if (memberCount.count > 1) {
      return c.json({ error: 'Cannot delete community with members. Transfer admin first.' }, 400);
    }
    
    await c.env.DB.prepare('UPDATE users SET guild_id = NULL, muted_until = NULL WHERE guild_id = ?').bind(guildId).run();
    await c.env.DB.prepare('UPDATE trees SET guild_id = NULL WHERE guild_id = ?').bind(guildId).run();
    await c.env.DB.prepare('DELETE FROM guilds WHERE id = ?').bind(guildId).run();
    
    return c.json({ success: true });
  });



export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  
    // Sync all existing trees to their author's current guild (migration/cleanup)
    await env.DB.prepare('UPDATE trees SET guild_id = (SELECT guild_id FROM users WHERE users.id = trees.author_id)').run();
    
    try {
      // Delete users from D1 who are older than 24h and unverified.
      // This frees up their username and player_id.
      await env.DB.prepare('DELETE FROM users WHERE verified_email = 0 AND created_at < ?')
        .bind(oneDayAgo)
        .run();
      console.log('Successfully ran unverified user cleanup cron job.');
    } catch (e) {
      console.error('Cron job error:', e);
    }
  }
};
