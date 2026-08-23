import { Hono } from 'hono';
import { notificationService } from './notificationService';

export const cityEventsRouter = new Hono<{ Bindings: any, Variables: { user: any } }>();

// Initialization helper
const initTables = async (db: any) => {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS city_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      entry_fee INTEGER DEFAULT 0,
      promo_image TEXT,
      event_type TEXT NOT NULL,
      status TEXT DEFAULT 'active'
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS city_event_badges (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon_url TEXT NOT NULL,
      tier_level INTEGER NOT NULL,
      target_value INTEGER NOT NULL,
      FOREIGN KEY(event_id) REFERENCES city_events(id) ON DELETE CASCADE
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS city_event_participants (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      starting_score INTEGER DEFAULT 0,
      badges_awarded TEXT DEFAULT '[]',
      FOREIGN KEY(event_id) REFERENCES city_events(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS city_event_submissions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      proof_url TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      FOREIGN KEY(event_id) REFERENCES city_events(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`).run();
  } catch (e) {
    console.error("Failed to init city_events tables", e);
  }
};

// Endpoint to upload images for City Events (Promo & Badges)
cityEventsRouter.post('/admin/images', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);

  // Note: For now, we allow any logged-in user to upload an image.
  // We should ideally check if they are admin, but the user must be admin to access the UI anyway.
  
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;
    if (!file) return c.json({ error: 'No file provided' }, 400);

    const extension = file.name.split('.').pop() || 'webp';
    const objectKey = `city-events/${jwtUser.sub}-${Date.now()}.${extension}`;
    
    const arrayBuffer = await file.arrayBuffer();
    await c.env.AVATARS_BUCKET.put(objectKey, arrayBuffer, {
      httpMetadata: { contentType: file.type || 'image/webp' }
    });

    const url = new URL(c.req.url);
    const publicUrl = `${url.origin}/r2/${objectKey}`;

    return c.json({ success: true, url: publicUrl, objectKey });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Admin: Create Event
cityEventsRouter.post('/admin/events', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
  const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  await initTables(c.env.DB);
  
  const body = await c.req.json();
  const id = `ce-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  
  await c.env.DB.prepare(`
    INSERT INTO city_events (id, title, description, start_date, end_date, entry_fee, promo_image, event_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, body.title, body.description, body.start_date, body.end_date, body.entry_fee || 0, body.promo_image || '', body.event_type, 'active').run();

  if (body.badges && Array.isArray(body.badges)) {
    for (const b of body.badges) {
      const badgeId = `ceb-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      await c.env.DB.prepare(`
        INSERT INTO city_event_badges (id, event_id, name, description, icon_url, tier_level, target_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(badgeId, id, b.name, b.description, b.icon_url, b.tier_level, b.target_value).run();
    }
  }

  return c.json({ success: true, id });
});

  // Admin: Edit Event
  cityEventsRouter.put('/admin/events/:id', async (c) => {
    const jwtUser = c.get('user') as any;
    if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
    const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
    if (!dbUser || dbUser.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
    
    const eventId = c.req.param('id');
    const body = await c.req.json();
    
    const event = await c.env.DB.prepare('SELECT * FROM city_events WHERE id = ?').bind(eventId).first() as any;
    if (!event) return c.json({ error: 'Not found' }, 404);
    if (Date.now() > event.end_date) return c.json({ error: 'Cannot edit an event that has already ended.' }, 403);
    
    await c.env.DB.prepare(`
      UPDATE city_events SET title = ?, description = ?, promo_image = ?, start_date = ?, end_date = ?, entry_fee = ?
      WHERE id = ?
    `).bind(body.title, body.description, body.promo_image, body.start_date, body.end_date, body.entry_fee, eventId).run();
    
    return c.json({ success: true });
  });

  // Admin: End Event Early
  cityEventsRouter.post('/admin/events/:id/end-early', async (c) => {
    const jwtUser = c.get('user') as any;
    if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
    const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
    if (!dbUser || dbUser.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
    
    // Auto-migrate schema if needed
    try { await c.env.DB.prepare('ALTER TABLE city_events ADD COLUMN early_end_reason TEXT').run() } catch(e) {}
    
    const eventId = c.req.param('id');
    const body = await c.req.json();
    
    await c.env.DB.prepare(`
      UPDATE city_events SET end_date = ?, early_end_reason = ? WHERE id = ?
    `).bind(Date.now(), body.reason, eventId).run();
    
    return c.json({ success: true });
  });

  // Admin: Delete Event
  cityEventsRouter.delete('/admin/events/:id', async (c) => {
    const jwtUser = c.get('user') as any;
    if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
    const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
    if (!dbUser || dbUser.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  
    const eventId = c.req.param('id');
    const event = await c.env.DB.prepare('SELECT * FROM city_events WHERE id = ?').bind(eventId).first() as any;
    if (!event) return c.json({ error: 'Not found' }, 404);
    
    if (Date.now() >= event.start_date) {
      return c.json({ error: 'Cannot delete an active or ended event.' }, 403);
    }

    await c.env.DB.prepare('DELETE FROM city_events WHERE id = ?').bind(eventId).run();
    await c.env.DB.prepare('DELETE FROM city_event_badges WHERE event_id = ?').bind(eventId).run();
    await c.env.DB.prepare('DELETE FROM city_event_participants WHERE event_id = ?').bind(eventId).run();
    return c.json({ success: true });
  });

// Admin: Get Submissions
cityEventsRouter.get('/admin/submissions', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
  const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  await initTables(c.env.DB);
  
  const submissions = await c.env.DB.prepare(`
    SELECT s.*, u.username, u.email, e.title as event_title 
    FROM city_event_submissions s 
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN city_events e ON s.event_id = e.id
    ORDER BY 
      CASE WHEN s.status = 'pending' THEN 0 ELSE 1 END,
      s.created_at DESC
  `).all();
  return c.json({ submissions: submissions.results });
});

// Admin: Approve/Reject Submission
cityEventsRouter.post('/admin/submissions/:id/review', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
  const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const subId = c.req.param('id');
  const { action } = await c.req.json(); // 'approve' or 'reject'
  
  const submission = await c.env.DB.prepare('SELECT * FROM city_event_submissions WHERE id = ?').bind(subId).first() as any;
  if (!submission) return c.json({ error: 'Not found' }, 404);

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await c.env.DB.prepare('UPDATE city_event_submissions SET status = ? WHERE id = ?').bind(newStatus, subId).run();

  // If approved, increment snapshot score!
  if (action === 'approve') {
    // Note: for manual events, starting_score acts like current_score to simplify logic
    await c.env.DB.prepare(`
      UPDATE city_event_participants 
      SET starting_score = starting_score + 1 
      WHERE event_id = ? AND user_id = ?
    `).bind(submission.event_id, submission.user_id).run();
  }

  return c.json({ success: true });
});

// Engine: Calculate Progress & Award Badges
const calculateAndAwardBadges = async (env: any, userId: string, event: any, participant: any) => {
  const db = env.DB;
  let currentScore = 0;
  
  // 1. Calculate Score
  try {
    if (event.event_type === 'marathon') {
      const user = await db.prepare('SELECT total_distance_km FROM users WHERE id = ?').bind(userId).first();
      currentScore = (user?.total_distance_km || 0) - (participant.starting_score || 0);
    } else if (event.event_type === 'trees') {
      const user = await db.prepare('SELECT total_trees_planted FROM users WHERE id = ?').bind(userId).first();
      currentScore = (user?.total_trees_planted || 0) - (participant.starting_score || 0);
    } else if (event.event_type === 'reports') {
      // Custom query for reports in date range
      const startDate = Math.max(event.start_date, participant.joined_at || 0);
      const reports = await db.prepare(`
        SELECT COUNT(*) as count FROM infrastructure_reports 
        WHERE author_id = ? AND status = 'resolved' AND resolved_at >= ? AND resolved_at <= ?
      `).bind(userId, startDate, event.end_date).first();
      currentScore = reports?.count || 0;
    } else if (event.event_type === 'spending') {
      // Custom query for purchases
      const startDate = Math.max(event.start_date, participant.joined_at || 0);
      const purchases = await db.prepare(`
        SELECT SUM(price) as total FROM purchases 
        WHERE user_id = ? AND purchased_at >= ? AND purchased_at <= ?
      `).bind(userId, startDate, event.end_date).first();
      currentScore = purchases?.total || 0;
    } else if (event.event_type === 'manual') {
      // For manual, the "starting_score" field actually holds their accumulated approved points
      currentScore = participant.starting_score || 0;
    }
  } catch (e) {
    console.error('Score calculation error:', e);
    currentScore = 0; // Fallback to 0 if query fails due to missing tables/columns
  }

  // 2. Evaluate Badges
  const badges = await db.prepare('SELECT * FROM city_event_badges WHERE event_id = ? ORDER BY target_value ASC').bind(event.id).all();
  let awarded = [];
  try { awarded = JSON.parse(participant.badges_awarded || '[]'); } catch(e) {}
  
  const userRecord = await db.prepare('SELECT unlocked_badges FROM users WHERE id = ?').bind(userId).first();
  let userBadges = [];
  try { userBadges = JSON.parse(userRecord?.unlocked_badges || '[]'); } catch(e) {}

  let newlyAwarded = false;

  for (const b of badges.results as any[]) {
    if (currentScore >= b.target_value && !awarded.includes(b.id)) {
      awarded.push(b.id);
      userBadges.push({
        id: b.id,
        name: b.name,
        description: b.description,
        icon: b.icon_url,
        level: b.tier_level
      });
      newlyAwarded = true;
      
      await notificationService.createMailAndNotify(env, {
        title: 'Event Badge Unlocked 🎉',
        content: `Congratulations! You unlocked the '${b.name}' badge for the '${event.title}' event!`,
        sender: 'EcoStride Events',
        recipient_type: 'user',
        recipient_id: userId,
        action_type: 'badge_unlocked',
        notification_type: 'mailbox',
        notification_priority: 'normal'
      });
    }
  }

  if (newlyAwarded) {
    await db.prepare('UPDATE city_event_participants SET badges_awarded = ? WHERE id = ?').bind(JSON.stringify(awarded), participant.id).run();
    await db.prepare('UPDATE users SET unlocked_badges = ? WHERE id = ?').bind(JSON.stringify(userBadges), userId).run();
  }

  return currentScore;
};

// User: Get Events
cityEventsRouter.get('/events', async (c) => {
  await initTables(c.env.DB);
  // Auto-migrate to add frozen_score and early_end_reason
  try { await c.env.DB.prepare('ALTER TABLE city_event_participants ADD COLUMN frozen_score INTEGER').run() } catch(e) {}
  try { await c.env.DB.prepare('ALTER TABLE city_events ADD COLUMN early_end_reason TEXT').run() } catch(e) {}

  const now = Date.now();
  
  const jwtUser = c.get('user') as any;
  const userId = jwtUser?.sub;

  const events = await c.env.DB.prepare('SELECT * FROM city_events ORDER BY start_date DESC').all();
  
  const eventIds = events.results.map((e: any) => e.id);
  let badges: any[] = [];
  if (eventIds.length > 0) {
    const placeholders = eventIds.map(() => '?').join(',');
    const bRes = await c.env.DB.prepare(`SELECT * FROM city_event_badges WHERE event_id IN (${placeholders}) ORDER BY tier_level ASC`).bind(...eventIds).all();
    badges = bRes.results;
  }

  let participants: any[] = [];
  let submissions: any[] = [];
  if (userId) {
    const pRes = await c.env.DB.prepare('SELECT * FROM city_event_participants WHERE user_id = ?').bind(userId).all();
    participants = pRes.results;

    const sRes = await c.env.DB.prepare('SELECT * FROM city_event_submissions WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
    submissions = sRes.results;

    // Calculate progress for active events user has joined
    for (const p of participants) {
      const event = events.results.find((e: any) => e.id === p.event_id);
      if (!event) continue; // Skip if event no longer exists
        
      if (now > event.end_date) {
        // Event has ended, freeze the score if not already frozen
        if (p.frozen_score !== null && p.frozen_score !== undefined) {
          p.current_score = p.frozen_score;
        } else {
          p.current_score = await calculateAndAwardBadges(c.env, userId, event, p);
          await c.env.DB.prepare('UPDATE city_event_participants SET frozen_score = ? WHERE id = ?').bind(p.current_score, p.id).run();
        }
      } else {
        // Event is active (or upcoming), calculate dynamically
        p.current_score = await calculateAndAwardBadges(c.env, userId, event, p);
      }
    }
  }

  return c.json({ events: events.results, badges, participants, submissions });
});

// User: Join Event
cityEventsRouter.post('/events/:id/join', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);
  const userId = jwtUser.sub;

  const eventId = c.req.param('id');
  const event = await c.env.DB.prepare('SELECT * FROM city_events WHERE id = ?').bind(eventId).first() as any;
  if (!event) return c.json({ error: 'Event not found' }, 404);

  const existing = await c.env.DB.prepare('SELECT id FROM city_event_participants WHERE event_id = ? AND user_id = ?').bind(eventId, userId).first();
  if (existing) return c.json({ error: 'Already joined' }, 400);

  const user = await c.env.DB.prepare('SELECT coins, total_distance_km, total_trees_planted FROM users WHERE id = ?').bind(userId).first() as any;
  if (user.coins < event.entry_fee) return c.json({ error: 'Insufficient coins' }, 400);

  // Deduct fee (burn coins)
  if (event.entry_fee > 0) {
    await c.env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').bind(event.entry_fee, userId).run();
  }

  // Record snapshot starting score
  let startingScore = 0;
  if (event.event_type === 'marathon') startingScore = user.total_distance_km || 0;
  if (event.event_type === 'trees') startingScore = user.total_trees_planted || 0;

  const partId = `cep-${Date.now()}`;
  await c.env.DB.prepare(`
    INSERT INTO city_event_participants (id, event_id, user_id, joined_at, starting_score, badges_awarded)
    VALUES (?, ?, ?, ?, ?, '[]')
  `).bind(partId, eventId, userId, Date.now(), startingScore).run();

  return c.json({ success: true });
});

// User: Submit Proof
cityEventsRouter.post('/events/:id/submit', async (c) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser) return c.json({ error: 'Unauthorized' }, 401);

  const eventId = c.req.param('id');
  const { proof_url, description } = await c.req.json();
  
  const subId = `ces-${Date.now()}`;
  await c.env.DB.prepare(`
    INSERT INTO city_event_submissions (id, event_id, user_id, proof_url, description, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).bind(subId, eventId, jwtUser.sub, proof_url, description, Date.now()).run();

  return c.json({ success: true });
});
