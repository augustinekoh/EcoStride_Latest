import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';

type Bindings = {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());



// Authentication Middleware
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return next();
  }
  
  // Public routes
  if (c.req.path === '/api/check-username') {
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

// GET user
app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const user: any = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
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
    if (body.username !== undefined) { updates.push('username = ?'); values.push(body.username); }
    if (body.role !== undefined) { updates.push('role = ?'); values.push(body.role); }
    if (body.coins !== undefined) { updates.push('coins = ?'); values.push(body.coins); }
    if (body.totalDistanceKm !== undefined) { updates.push('total_distance_km = ?'); values.push(body.totalDistanceKm); }
    
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

  const trees = await c.env.DB.prepare('SELECT trees.*, users.username as authorUsername, users.email as authorEmail FROM trees LEFT JOIN users ON trees.author_id = users.id').all();
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

app.get('/api/leaderboard', async (c) => {
  const users = await c.env.DB.prepare("SELECT id, username, guild_id, coins, total_distance_km, total_trees_planted FROM users WHERE role != 'admin' ORDER BY total_distance_km DESC LIMIT 50").all();
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

app.post('/api/admin/cleanup', async (c) => {
  // Clean up trees, signposts, and demo requests older than 3 days
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  
  await c.env.DB.prepare('DELETE FROM trees WHERE planted_at < ?').bind(threeDaysAgo).run();
  await c.env.DB.prepare('DELETE FROM signposts WHERE created_at < ?').bind(threeDaysAgo).run();
  await c.env.DB.prepare('DELETE FROM demo_requests WHERE requested_at < ?').bind(threeDaysAgo).run();

  return c.json({ success: true, message: 'Cleanup complete' });
});

app.get('/api/admin/dashboard', async (c) => {
  const users = await c.env.DB.prepare('SELECT * FROM users').all();
  const trees = await c.env.DB.prepare('SELECT * FROM trees').all();
  const signposts = await c.env.DB.prepare('SELECT * FROM signposts').all();
  const storeItems = await c.env.DB.prepare("SELECT * FROM point_store WHERE status = 'active' OR status IS NULL").all();
  const categories = await c.env.DB.prepare('SELECT * FROM store_categories').all();
  const merchants = await c.env.DB.prepare('SELECT * FROM merchants').all();
  const applications = await c.env.DB.prepare('SELECT * FROM applications').all();
  const demoRequests = await c.env.DB.prepare('SELECT * FROM demo_requests').all();
  const mail = await c.env.DB.prepare('SELECT * FROM mail ORDER BY created_at DESC').all();

  return c.json({
    users: users.results,
    trees: trees.results,
    signposts: signposts.results,
    storeItems: storeItems.results,
    categories: categories.results,
    merchants: merchants.results,
    applications: applications.results,
    demoRequests: demoRequests.results,
    sentMails: mail.results
  });
});

app.post('/api/admin/cleanup', async (c) => {
  // Ensure table exists to prevent 500 on fresh startup
  await c.env.DB.prepare('CREATE TABLE IF NOT EXISTS global_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  
  // Fetch tree reset interval setting
  let treeIntervalDays = 7; // default
  const setting = await c.env.DB.prepare('SELECT value FROM global_settings WHERE key = ?').bind('tree_reset_interval_days').first();
  if (setting && setting.value) {
    treeIntervalDays = parseInt(setting.value as string) || 7;
  }
  
  // Trees > configured days
  const treeThreshold = Date.now() - (treeIntervalDays * 24 * 60 * 60 * 1000);
  await c.env.DB.prepare('DELETE FROM trees WHERE planted_at < ?').bind(treeThreshold).run();
  
  // Signposts > 3 days (fixed)
  const spThreshold = Date.now() - (3 * 24 * 60 * 60 * 1000);
  await c.env.DB.prepare('DELETE FROM signposts WHERE created_at < ?').bind(spThreshold).run();
  
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
  try { await c.env.DB.prepare('ALTER TABLE mail ADD COLUMN recipient_name TEXT').run(); } catch(e) {}
  const mail = await c.env.DB.prepare('SELECT * FROM mail ORDER BY created_at DESC').all();
  return c.json({ mail: mail.results });
});
app.post('/api/mail', async (c) => {
  const body = await c.req.json();
  const id = `mail-${Date.now()}`;
  
  try { await c.env.DB.prepare('ALTER TABLE mail ADD COLUMN recipient_name TEXT').run(); } catch(e) {}

  let finalRecipientId = body.recipientId || null;
  let finalRecipientName = null;

  if (body.recipientType === 'user' && body.recipientId) {
    const user: any = await c.env.DB.prepare('SELECT id, username FROM users WHERE username = ? OR player_id = ? OR id = ?').bind(body.recipientId, body.recipientId, body.recipientId).first();
    if (!user) {
      return c.json({ success: false, error: 'User not found matching Username or UID' }, 404);
    }
    finalRecipientId = user.id;
    finalRecipientName = user.username;
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

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    // 24 hours ago
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    try {
      // Delete users from D1 who are older than 24h and unverified.
      // This frees up their username and player_id.
      await env.DB.prepare('DELETE FROM users WHERE verified_email = 0 AND created_at < ?')
        .bind(twentyFourHoursAgo)
        .run();
      console.log('Successfully ran unverified user cleanup cron job.');
    } catch (e) {
      console.error('Cron job error:', e);
    }
  }
};
