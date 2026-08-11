import { Hono } from 'hono';

export const authoritiesRouter = new Hono<{ Bindings: any }>();

// 1. requireAuthority middleware
authoritiesRouter.use('/*', async (c, next) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);
  const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!dbUser || dbUser.role !== 'authority') {
    return c.json({ error: 'Forbidden: requires authority role' }, 403);
  }
  await next();
});

// Rate limiting map (in-memory, lightweight per-worker instance)
const rateLimitMap = new Map<string, { count: number, resetAt: number }>();

// Helper for rate limiting mutation endpoints
const applyRateLimit = (ip: string, limit: number, windowMs: number) => {
  const now = Date.now();
  let record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + windowMs };
    rateLimitMap.set(ip, record);
    return true; // Allowed
  }
  if (record.count >= limit) {
    return false; // Denied
  }
  record.count++;
  return true; // Allowed
};

authoritiesRouter.use('/*', async (c, next) => {
  // Apply lightweight rate limiting for mutation endpoints
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(c.req.method)) {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown-ip';
    // 20 mutations per minute per IP for authorities should be plenty
    if (!applyRateLimit(ip, 20, 60000)) {
      return c.json({ error: 'Too many requests' }, 429);
    }
  }
  await next();
});

// 2. GET /dashboard/stats
authoritiesRouter.get('/dashboard/stats', async (c) => {
  const now = new Date();
  
  // Calculate KL time boundaries (UTC+8)
  const klDateString = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [month, day, year] = klDateString.split('/');
  
  const klMidnightStr = `${year}-${month}-${day}T00:00:00.000+08:00`;
  const startOfTodayMs = new Date(klMidnightStr).getTime();
  
  const klStartOfMonthStr = `${year}-${month}-01T00:00:00.000+08:00`;
  const startOfMonthMs = new Date(klStartOfMonthStr).getTime();

  // Queries
  const todayReported = await c.env.DB.prepare('SELECT COUNT(*) as count FROM infrastructure_reports WHERE created_at >= ?').bind(startOfTodayMs).first() as any;
  const monthlyTotal = await c.env.DB.prepare('SELECT COUNT(*) as count FROM infrastructure_reports WHERE created_at >= ?').bind(startOfMonthMs).first() as any;
  const monthlyResolved = await c.env.DB.prepare('SELECT COUNT(*) as count FROM infrastructure_reports WHERE created_at >= ? AND status = ?').bind(startOfMonthMs, 'resolved').first() as any;
  
  // Group monthly records by day for chart data
  const monthRecords = await c.env.DB.prepare('SELECT created_at, status FROM infrastructure_reports WHERE created_at >= ?').bind(startOfMonthMs).all();
  const daysMap: Record<string, { reported: number, resolved: number }> = {};
  
  for (const r of monthRecords.results) {
    const row = r as any;
    // Get YYYY-MM-DD in KL time
    const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.created_at));
    if (!daysMap[dStr]) daysMap[dStr] = { reported: 0, resolved: 0 };
    daysMap[dStr].reported++;
    if (row.status === 'resolved') daysMap[dStr].resolved++;
  }
  const monthlyDataArray = Object.keys(daysMap).sort().map(d => ({ date: d, ...daysMap[d] }));

  // Response Ratio
  const totalCases = await c.env.DB.prepare('SELECT COUNT(*) as count FROM infrastructure_reports').first() as any;
  const respondedCases = await c.env.DB.prepare('SELECT COUNT(*) as count FROM infrastructure_reports WHERE authority_response IS NOT NULL AND authority_response != ""').first() as any;
  
  const respondedCount = respondedCases.count || 0;
  const totalCount = totalCases.count || 0;
  const unrespondedCount = totalCount - respondedCount;
  const respondedPercentage = totalCount > 0 ? (respondedCount / totalCount) * 100 : 0;

  return c.json({
    today: {
      reported: todayReported.count
    },
    monthly: {
      reported: monthlyTotal.count,
      resolved: monthlyResolved.count,
      data: monthlyDataArray
    },
    response: {
      responded: respondedCount,
      unresponded: unrespondedCount,
      respondedPercentage: parseFloat(respondedPercentage.toFixed(2))
    }
  });
});

// 3. GET /tasks
authoritiesRouter.get('/tasks', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  let limit = parseInt(c.req.query('limit') || '10');
  
  if (isNaN(page) || page < 1) return c.json({ error: 'Invalid page' }, 400);
  if (isNaN(limit) || limit < 1 || limit > 100) limit = 10;
  
  const offset = (page - 1) * limit;

  const tasks = await c.env.DB.prepare('SELECT * FROM authority_tasks WHERE completed = 0 AND deleted_at IS NULL ORDER BY scheduled_at ASC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all();
    
  const countRes = await c.env.DB.prepare('SELECT COUNT(*) as c FROM authority_tasks WHERE completed = 0 AND deleted_at IS NULL').first() as any;

  return c.json({ 
    tasks: tasks.results,
    pagination: {
      total: countRes.c,
      page,
      limit,
      totalPages: Math.ceil(countRes.c / limit)
    }
  });
});

// 4. POST /tasks
authoritiesRouter.post('/tasks', async (c) => {
  const jwtUser = c.get('user') as any;
  const body = await c.req.json();
  
  // Validation
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '' || body.title.length > 200) {
    return c.json({ error: 'Invalid title' }, 400);
  }
  if (!body.scheduled_at || typeof body.scheduled_at !== 'number' || isNaN(new Date(body.scheduled_at).getTime())) {
    return c.json({ error: 'Invalid scheduled date' }, 400);
  }
  
  const taskId = crypto.randomUUID();
  const now = Date.now();
  
  await c.env.DB.prepare(
    'INSERT INTO authority_tasks (id, title, description, scheduled_at, completed, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
  ).bind(taskId, body.title.trim(), body.description || '', body.scheduled_at, jwtUser.sub, now, now).run();
  
  return c.json({ success: true, taskId });
});

// 5. PATCH /tasks/:id
authoritiesRouter.patch('/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = Date.now();
  
  const updates: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '' || body.title.length > 200) return c.json({ error: 'Invalid title' }, 400);
    updates.push('title = ?'); values.push(body.title.trim());
  }
  if (body.description !== undefined) {
    updates.push('description = ?'); values.push(body.description);
  }
  if (body.scheduled_at !== undefined) {
    if (typeof body.scheduled_at !== 'number' || isNaN(new Date(body.scheduled_at).getTime())) return c.json({ error: 'Invalid scheduled_at' }, 400);
    updates.push('scheduled_at = ?'); values.push(body.scheduled_at);
  }
  if (body.completed !== undefined) {
    if (![0, 1].includes(body.completed)) return c.json({ error: 'Invalid completed state' }, 400);
    updates.push('completed = ?'); values.push(body.completed);
  }
  
  values.push(id);
  
  await c.env.DB.prepare(`UPDATE authority_tasks SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  
  return c.json({ success: true });
});

// 6. DELETE /tasks/:id
authoritiesRouter.delete('/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const now = Date.now();
  
  // Soft delete
  await c.env.DB.prepare('UPDATE authority_tasks SET deleted_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, id)
    .run();
    
  return c.json({ success: true });
});

// 7. PATCH /reports/:id
authoritiesRouter.patch('/reports/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = Date.now();
  
  const updates: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  
  if (body.status !== undefined) {
    if (!['pending', 'in-progress', 'resolved'].includes(body.status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }
    updates.push('status = ?'); values.push(body.status);
  }
  if (body.authority_response !== undefined) {
    if (typeof body.authority_response !== 'string' || body.authority_response.length > 2000) {
      return c.json({ error: 'Invalid response' }, 400);
    }
    updates.push('authority_response = ?'); values.push(body.authority_response);
  }
  
  if (updates.length === 1) return c.json({ error: 'No fields to update' }, 400);
  
  values.push(id);
  
  await c.env.DB.prepare(`UPDATE infrastructure_reports SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  
  return c.json({ success: true });
});
