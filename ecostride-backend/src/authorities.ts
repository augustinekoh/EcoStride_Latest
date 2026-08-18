import { Hono } from 'hono';

export const authoritiesRouter = new Hono<{ Bindings: any, Variables: { user: any } }>();

// 1. requireAuthority middleware
authoritiesRouter.use('/*', async (c, next) => {
  const jwtUser = c.get('user') as any;
  if (!jwtUser || !jwtUser.sub) return c.json({ error: 'Unauthorized' }, 401);
  
  let dbUser = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!dbUser && jwtUser.email) {
    dbUser = await c.env.DB.prepare('SELECT id, role FROM users WHERE email = ?').bind(jwtUser.email).first() as any;
    if (dbUser) {
      await c.env.DB.prepare('UPDATE users SET id = ? WHERE id = ?').bind(jwtUser.sub, dbUser.id).run();
    }
  }

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
  const jwtUser = c.get('user') as any;
  const now = new Date();
  
  // Get authority jurisdiction
  const authUser: any = await c.env.DB.prepare('SELECT country, state, city FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const authCountry = authUser?.country || '';
  const authState = authUser?.state || '';
  const authCity = authUser?.city || '';

  // Calculate KL time boundaries (UTC+8)
  const klDateString = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [month, day, year] = klDateString.split('/');
  
  const klMidnightStr = `${year}-${month}-${day}T00:00:00.000+08:00`;
  const startOfTodayMs = new Date(klMidnightStr).getTime();
  
  const klStartOfMonthStr = `${year}-${month}-01T00:00:00.000+08:00`;
  const startOfMonthMs = new Date(klStartOfMonthStr).getTime();

  // Queries for today by status matching authority jurisdiction OR assigned to this authority
  const todayRecords = await c.env.DB.prepare(`
    SELECT status FROM infrastructure_reports 
    WHERE created_at >= ? AND deleted_at IS NULL
      AND (((country = ? AND state = ? AND city = ?) OR authority_id = ?))
  `).bind(startOfTodayMs, authCountry, authState, authCity, jwtUser.sub).all();

  const todayStats = { pending: 0, 'in-progress': 0, resolved: 0 };
  for (const r of todayRecords.results) {
    const status = (r as any).status;
    if (status === 'pending') todayStats.pending++;
    else if (status === 'in-progress') todayStats['in-progress']++;
    else if (status === 'resolved') todayStats.resolved++;
  }

  // Monthly stats by severity matching authority jurisdiction OR assigned to this authority
  const monthlyRecords = await c.env.DB.prepare(`
    SELECT severity FROM infrastructure_reports 
    WHERE created_at >= ? AND deleted_at IS NULL
      AND (((country = ? AND state = ? AND city = ?) OR authority_id = ?))
  `).bind(startOfMonthMs, authCountry, authState, authCity, jwtUser.sub).all();

  const monthlySeverity = { Minor: 0, Major: 0, Critical: 0 };
  let monthlyReported = 0;
  for (const r of monthlyRecords.results) {
    monthlyReported++;
    const sev = (r as any).severity || 'Minor';
    if (sev === 'Minor') monthlySeverity.Minor++;
    else if (sev === 'Major') monthlySeverity.Major++;
    else if (sev === 'Critical') monthlySeverity.Critical++;
  }

  // Response Ratio matching authority jurisdiction OR assigned to this authority
  const totalCases = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM infrastructure_reports 
    WHERE deleted_at IS NULL
      AND (((country = ? AND state = ? AND city = ?) OR authority_id = ?))
  `).bind(authCountry, authState, authCity, jwtUser.sub).first() as any;

  const respondedCases = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM infrastructure_reports 
    WHERE authority_response IS NOT NULL AND authority_response != "" AND deleted_at IS NULL
      AND (((country = ? AND state = ? AND city = ?) OR authority_id = ?))
  `).bind(authCountry, authState, authCity, jwtUser.sub).first() as any;
  
  const respondedCount = respondedCases?.count || 0;
  const totalCount = totalCases?.count || 0;
  const unrespondedCount = totalCount - respondedCount;
  const respondedPercentage = totalCount > 0 ? (respondedCount / totalCount) * 100 : 0;

  return c.json({
    today: todayStats,
    monthly: {
      reported: monthlyReported,
      severity: monthlySeverity
    },
    response: {
      responded: respondedCount,
      unresponded: unrespondedCount,
      respondedPercentage: parseFloat(respondedPercentage.toFixed(2))
    }
  });
});

// 2b. GET /dashboard/workload
authoritiesRouter.get('/dashboard/workload', async (c) => {
  const jwtUser = c.get('user') as any;
  const issues = await c.env.DB.prepare(`
    SELECT r.*,
           u.username as author_username,
           u.avatar as author_avatar,
           auth.username as authority_username
    FROM infrastructure_reports r
    LEFT JOIN users u ON r.author_id = u.id
    LEFT JOIN users auth ON r.authority_id = auth.id
    WHERE r.authority_id = ? AND r.status != 'resolved' AND r.deleted_at IS NULL
    ORDER BY r.created_at ASC
  `).bind(jwtUser.sub).all();
  
  const issuesWithUnread = await Promise.all(issues.results.map(async (issue: any) => {
    const guildId = `issue_${issue.id}`;
    const lastReadRecord = await c.env.DB.prepare('SELECT last_read_at FROM user_chat_reads WHERE user_id = ? AND guild_id = ?').bind(jwtUser.sub, guildId).first() as any;
    const lastReadAt = lastReadRecord ? lastReadRecord.last_read_at : 0;
    
    const unreadRecord = await c.env.DB.prepare('SELECT COUNT(*) as unread_count FROM issue_messages WHERE issue_id = ? AND created_at > ? AND sender_id != ?').bind(issue.id, lastReadAt, jwtUser.sub).first() as any;
    
    return {
      ...issue,
      unread_count: unreadRecord ? unreadRecord.unread_count : 0
    };
  }));

  return c.json({ workload: issuesWithUnread });
});

// 2c. GET /dashboard/critical
authoritiesRouter.get('/dashboard/critical', async (c) => {
  const jwtUser = c.get('user') as any;
  
  const authUser: any = await c.env.DB.prepare('SELECT country, state, city FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const authCountry = authUser?.country || '';
  const authState = authUser?.state || '';
  const authCity = authUser?.city || '';

  const issues = await c.env.DB.prepare(`
    SELECT r.id, r.title, r.status, r.severity, r.created_at, r.updated_at, r.specific_location as location, r.country, r.state, r.city, r.photos
    FROM infrastructure_reports r
    WHERE r.severity = 'Critical' AND r.status != 'resolved' AND r.deleted_at IS NULL
      AND (((r.country = ? AND r.state = ? AND r.city = ?) OR r.authority_id = ?))
    ORDER BY r.created_at ASC
    LIMIT 20
  `).bind(authCountry, authState, authCity, jwtUser.sub).all();
  return c.json({ critical: issues.results });
});

// 3. GET /tasks (filtered by logged-in authority)
authoritiesRouter.get('/tasks', async (c) => {
  const jwtUser = c.get('user') as any;
  const page = parseInt(c.req.query('page') || '1');
  let limit = parseInt(c.req.query('limit') || '10');
  
  if (isNaN(page) || page < 1) return c.json({ error: 'Invalid page' }, 400);
  if (isNaN(limit) || limit < 1 || limit > 100) limit = 10;
  
  const offset = (page - 1) * limit;

  const tasks = await c.env.DB.prepare('SELECT * FROM authority_tasks WHERE created_by = ? AND completed = 0 AND deleted_at IS NULL ORDER BY scheduled_at ASC LIMIT ? OFFSET ?')
    .bind(jwtUser.sub, limit, offset)
    .all();
    
  const countRes = await c.env.DB.prepare('SELECT COUNT(*) as c FROM authority_tasks WHERE created_by = ? AND completed = 0 AND deleted_at IS NULL').bind(jwtUser.sub).first() as any;

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
  
  if (body.importance && !['Low', 'Medium', 'High'].includes(body.importance)) {
    return c.json({ error: 'Invalid importance' }, 400);
  }
  
  const importance = body.importance || 'Medium';
  const taskId = crypto.randomUUID();
  const now = Date.now();
  
  await c.env.DB.prepare(
    'INSERT INTO authority_tasks (id, title, description, importance, scheduled_at, completed, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)'
  ).bind(taskId, body.title.trim(), body.description || '', importance, body.scheduled_at, jwtUser.sub, now, now).run();
  
  return c.json({ success: true, taskId });
});

// 5. PATCH /tasks/:id
authoritiesRouter.patch('/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
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
  if (body.importance !== undefined) {
    if (!['Low', 'Medium', 'High'].includes(body.importance)) return c.json({ error: 'Invalid importance' }, 400);
    updates.push('importance = ?'); values.push(body.importance);
  }
  if (body.completed !== undefined) {
    if (![0, 1].includes(body.completed)) return c.json({ error: 'Invalid completed state' }, 400);
    updates.push('completed = ?'); values.push(body.completed);
  }
  
  values.push(id);
  values.push(jwtUser.sub);
  
  await c.env.DB.prepare(`UPDATE authority_tasks SET ${updates.join(', ')} WHERE id = ? AND created_by = ?`).bind(...values).run();
  
  return c.json({ success: true });
});

// 6. DELETE /tasks/:id (only own tasks)
authoritiesRouter.delete('/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  const now = Date.now();
  
  // Soft delete — only allow deleting own tasks
  await c.env.DB.prepare('UPDATE authority_tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND created_by = ?')
    .bind(now, now, id, jwtUser.sub)
    .run();
    
  return c.json({ success: true });
});

// 7. GET /issues (Paginated list of issues for authorities)
authoritiesRouter.get('/issues', async (c) => {
  const jwtUser = c.get('user') as any;
  const page = parseInt(c.req.query('page') || '1');
  let limit = parseInt(c.req.query('limit') || '10');
  
  if (isNaN(page) || page < 1) return c.json({ error: 'Invalid page' }, 400);
  if (isNaN(limit) || limit < 1 || limit > 100) limit = 10;
  
  const offset = (page - 1) * limit;

  const authUser: any = await c.env.DB.prepare('SELECT country, state, city FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const authCountry = authUser?.country || '';
  const authState = authUser?.state || '';
  const authCity = authUser?.city || '';

  const issues = await c.env.DB.prepare(`
    SELECT r.*, 
           u.username as author_username,
           u.avatar as author_avatar,
           auth.username as authority_username
    FROM infrastructure_reports r 
    LEFT JOIN users u ON r.author_id = u.id 
    LEFT JOIN users auth ON r.authority_id = auth.id
    WHERE r.deleted_at IS NULL 
      AND (((r.country = ? AND r.state = ? AND r.city = ?) OR r.authority_id = ?))
    ORDER BY r.created_at DESC 
    LIMIT ? OFFSET ?
  `).bind(authCountry, authState, authCity, jwtUser.sub, limit, offset).all();
    
  const countRes = await c.env.DB.prepare(`
    SELECT COUNT(*) as c FROM infrastructure_reports 
    WHERE deleted_at IS NULL 
      AND (((country = ? AND state = ? AND city = ?) OR authority_id = ?))
  `).bind(authCountry, authState, authCity, jwtUser.sub).first() as any;

  return c.json({ 
    issues: issues.results,
    pagination: {
      total: countRes?.c || 0,
      page,
      limit,
      totalPages: Math.ceil((countRes?.c || 0) / limit)
    }
  });
});

// 8. PATCH /issues/:id/claim
authoritiesRouter.patch('/issues/:id/claim', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  const now = Date.now();
  
  const issue = await c.env.DB.prepare('SELECT status, authority_id, country, state, city FROM infrastructure_reports WHERE id = ?').bind(id).first() as any;
  if (!issue) return c.json({ error: 'Issue not found' }, 404);

  const authUser: any = await c.env.DB.prepare('SELECT country, state, city FROM users WHERE id = ?').bind(jwtUser.sub).first();
  const isSameJurisdiction = authUser && authUser.country === issue.country && authUser.state === issue.state && authUser.city === issue.city;
  const isAssigned = issue.authority_id === jwtUser.sub;

  if (!isSameJurisdiction && !isAssigned) {
    return c.json({ error: 'Forbidden: Report is outside your department jurisdiction' }, 403);
  }
  
  const isReassignment = issue.authority_id && issue.authority_id !== jwtUser.sub;
  const activityType = isReassignment ? 'REPORT_REASSIGNED' : 'REPORT_ASSIGNED';
  const activityTitle = isReassignment ? 'Report Reassigned' : 'Report Assigned';
  const activityDesc = isReassignment ? 'The report was reassigned to a new authority.' : 'An authority has been assigned to this report.';

  const updateIssue = c.env.DB.prepare('UPDATE infrastructure_reports SET status = ?, authority_id = ?, updated_at = ? WHERE id = ?')
    .bind('in-progress', jwtUser.sub, now, id);

  const activityId = crypto.randomUUID();
  const insertActivity = c.env.DB.prepare(`
    INSERT INTO report_activity 
    (id, report_id, actor_id, actor_type, activity_type, title, description, created_at) 
    VALUES (?, ?, ?, 'authority', ?, ?, ?, ?)
  `).bind(activityId, id, jwtUser.sub, activityType, activityTitle, activityDesc, now);
    
  await c.env.DB.batch([updateIssue, insertActivity]);
    
  return c.json({ success: true });
});

// 8.5 PATCH /issues/:id/unclaim
authoritiesRouter.patch('/issues/:id/unclaim', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  const now = Date.now();
  
  const issue = await c.env.DB.prepare('SELECT status, authority_id FROM infrastructure_reports WHERE id = ?').bind(id).first() as any;
  if (!issue) return c.json({ error: 'Issue not found' }, 404);

  // Allow unclaiming if the user is the assigned authority
  if (issue.authority_id !== jwtUser.sub) {
    return c.json({ error: 'Forbidden: You are not assigned to this report' }, 403);
  }

  // Can only unclaim if it's currently in progress
  if (issue.status !== 'in-progress') {
    return c.json({ error: 'Only in-progress issues can be unclaimed' }, 400);
  }

  const updateIssue = c.env.DB.prepare('UPDATE infrastructure_reports SET status = ?, authority_id = NULL, updated_at = ? WHERE id = ?')
    .bind('pending', now, id);

  const activityId = crypto.randomUUID();
  const insertActivity = c.env.DB.prepare(`
    INSERT INTO report_activity 
    (id, report_id, actor_id, actor_type, activity_type, title, description, created_at) 
    VALUES (?, ?, ?, 'authority', 'REPORT_UNCLAIMED', 'Report Unclaimed', 'The assigned authority has released this report back to the pending queue.', ?)
  `).bind(activityId, id, jwtUser.sub, now);
    
  await c.env.DB.batch([updateIssue, insertActivity]);
    
  return c.json({ success: true });
});

// 9. PATCH /issues/:id/resolve
authoritiesRouter.patch('/issues/:id/resolve', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  const now = Date.now();
  
  const issue = await c.env.DB.prepare('SELECT status, authority_id, author_id, title FROM infrastructure_reports WHERE id = ?').bind(id).first() as any;
  if (!issue) return c.json({ error: 'Issue not found' }, 404);
  if (issue.authority_id !== jwtUser.sub) return c.json({ error: 'You can only resolve issues you have claimed' }, 403);
  if (issue.status !== 'in-progress') return c.json({ error: 'Only in-progress issues can be resolved' }, 400);
  
  const updateIssue = c.env.DB.prepare('UPDATE infrastructure_reports SET status = ?, updated_at = ?, resolved_at = ? WHERE id = ?')
    .bind('resolved', now, now, id);

  const activityId = crypto.randomUUID();
  const insertActivity = c.env.DB.prepare(`
    INSERT INTO report_activity 
    (id, report_id, actor_id, actor_type, activity_type, title, description, created_at) 
    VALUES (?, ?, ?, 'authority', 'REPORT_RESOLVED', 'Report Resolved', 'The authority marked the report as resolved.', ?)
  `).bind(activityId, id, jwtUser.sub, now);

  const mailId = 'mail-' + now + '-' + Math.random().toString(36).substring(2, 7);
  const issueTitle = issue.title ? `"${issue.title}"` : 'your reported infrastructure issue';
  const mailContent = `Great news! Your issue report ${issueTitle} has been successfully resolved by the local authority.\n\nThank you for contributing to the community!`;
  
  const insertMail = c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
  ).bind(mailId, 'Issue Resolved', mailContent, 'Authority Office', 'user', issue.author_id, now);

  await c.env.DB.batch([updateIssue, insertActivity, insertMail]);
    
  return c.json({ success: true });
});

// 10. POST /issues/:id/updates
authoritiesRouter.post('/issues/:id/updates', async (c) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  const body = await c.req.json();
  const now = Date.now();

  if (!body.description || typeof body.description !== 'string' || body.description.trim() === '') {
    return c.json({ error: 'Description is required' }, 400);
  }

  const issue = await c.env.DB.prepare('SELECT status, authority_id FROM infrastructure_reports WHERE id = ?').bind(id).first() as any;
  if (!issue) return c.json({ error: 'Issue not found' }, 404);
  if (issue.authority_id !== jwtUser.sub) return c.json({ error: 'You can only post updates to issues you have claimed' }, 403);
  if (issue.status === 'resolved') return c.json({ error: 'Cannot post updates to resolved issues' }, 400);

  const activityId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO report_activity 
    (id, report_id, actor_id, actor_type, activity_type, title, description, created_at) 
    VALUES (?, ?, ?, 'authority', 'TASK_UPDATE', 'Task Update', ?, ?)
  `).bind(activityId, id, jwtUser.sub, body.description.trim(), now).run();

  return c.json({ success: true, activityId });
});

// 10c. POST /issues/:id/take-down & DELETE /issues/:id (Authority Take Down Issue)
const handleTakeDownIssue = async (c: any) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  const now = Date.now();
  let body: any = {};
  try {
    body = await c.req.json();
  } catch(e) {}
  const reason = body.reason?.trim() || "The current issue location is incorrect with the actual location assigned.";

  // Validate that caller is an authority or admin
  let dbUser = await c.env.DB.prepare('SELECT id, role, username FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  if (!dbUser && jwtUser.email) {
    dbUser = await c.env.DB.prepare('SELECT id, role, username FROM users WHERE email = ?').bind(jwtUser.email).first() as any;
  }
  if (!dbUser || (dbUser.role !== 'authority' && dbUser.role !== 'admin')) {
    return c.json({ error: 'Forbidden. Only authorities can take down issues.' }, 403);
  }

  const issue = await c.env.DB.prepare('SELECT id, title, author_id, lng, lat FROM infrastructure_reports WHERE id = ? AND deleted_at IS NULL').bind(id).first() as any;
  if (!issue) return c.json({ error: 'Issue report not found or already removed' }, 404);

  // 1. Mark as taken down
  const updateIssue = c.env.DB.prepare(
    'UPDATE infrastructure_reports SET takedown_status = ?, takedown_reason = ?, updated_at = ? WHERE id = ?'
  ).bind('taken-down', reason, now, id);

  // 2. Insert audit activity entry
  const activityId = crypto.randomUUID();
  const insertActivity = c.env.DB.prepare(`
    INSERT INTO report_activity 
    (id, report_id, actor_id, actor_type, activity_type, title, description, created_at) 
    VALUES (?, ?, ?, 'authority', 'ISSUE_TAKEN_DOWN', 'Issue Report Taken Down', ?, ?)
  `).bind(activityId, id, jwtUser.sub, `The report was taken down by the authority. Reason: ${reason}`, now);

  // 3. System auto-generates a message to the user's mailbox
  const mailId = 'mail-' + now + '-' + Math.random().toString(36).substring(2, 7);
  const issueTitle = issue.title ? `"${issue.title}"` : 'your reported infrastructure issue';
  const mailContent = `Your issue report ${issueTitle} has been taken down by the local authority.\n\nReason: ${reason}\n\nPlease verify your GPS location or adjust the map marker accurately before submitting a new report.`;
  
  const insertMail = c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
  ).bind(mailId, 'Issue Report Notice', mailContent, 'Authority Office', 'user', issue.author_id, now);

  await c.env.DB.batch([updateIssue, insertActivity, insertMail]);

  return c.json({ 
    success: true, 
    message: 'Issue taken down successfully and notification sent to user mailbox.',
    mailId 
  });
};

authoritiesRouter.post('/issues/:id/take-down', handleTakeDownIssue);
authoritiesRouter.delete('/issues/:id', handleTakeDownIssue);

authoritiesRouter.post('/issues/:id/approve-takedown', async (c: any) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  const now = Date.now();
  
  const issue = await c.env.DB.prepare('SELECT id, title, author_id, takedown_status FROM infrastructure_reports WHERE id = ? AND deleted_at IS NULL').bind(id).first() as any;
  if (!issue) return c.json({ error: 'Issue not found' }, 404);
  if (issue.takedown_status !== 'requested') return c.json({ error: 'No takedown requested' }, 400);

  const updateIssue = c.env.DB.prepare('UPDATE infrastructure_reports SET takedown_status = ?, updated_at = ? WHERE id = ?').bind('taken-down', now, id);
  const activityId = crypto.randomUUID();
  const insertActivity = c.env.DB.prepare(`
    INSERT INTO report_activity (id, report_id, actor_id, actor_type, activity_type, title, description, created_at) 
    VALUES (?, ?, ?, 'authority', 'ISSUE_TAKEN_DOWN', 'Takedown Approved', 'Authority approved the user takedown request.', ?)
  `).bind(activityId, id, jwtUser.sub, now);
  
  const mailId = 'mail-' + now + '-' + Math.random().toString(36).substring(2, 7);
  const insertMail = c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
  ).bind(mailId, 'Takedown Approved', `Your request to take down issue "${issue.title}" has been approved.`, 'Authority Office', 'user', issue.author_id, now);

  await c.env.DB.batch([updateIssue, insertActivity, insertMail]);
  return c.json({ success: true, message: 'Takedown approved' });
});

authoritiesRouter.post('/issues/:id/reject-takedown', async (c: any) => {
  const id = c.req.param('id');
  const jwtUser = c.get('user') as any;
  const now = Date.now();
  let body: any = {};
  try { body = await c.req.json(); } catch(e) {}
  const reason = body.reason?.trim() || 'No reason provided.';

  const issue = await c.env.DB.prepare('SELECT id, title, author_id, takedown_status FROM infrastructure_reports WHERE id = ? AND deleted_at IS NULL').bind(id).first() as any;
  if (!issue) return c.json({ error: 'Issue not found' }, 404);
  if (issue.takedown_status !== 'requested') return c.json({ error: 'No takedown requested' }, 400);

  const updateIssue = c.env.DB.prepare('UPDATE infrastructure_reports SET takedown_status = NULL, takedown_reason = NULL, updated_at = ? WHERE id = ?').bind(now, id);
  const activityId = crypto.randomUUID();
  const insertActivity = c.env.DB.prepare(`
    INSERT INTO report_activity (id, report_id, actor_id, actor_type, activity_type, title, description, created_at) 
    VALUES (?, ?, ?, 'authority', 'TAKEDOWN_REJECTED', 'Takedown Rejected', ?, ?)
  `).bind(activityId, id, jwtUser.sub, `Authority rejected the takedown request. Reason: ${reason}`, now);

  const mailId = 'mail-' + now + '-' + Math.random().toString(36).substring(2, 7);
  const insertMail = c.env.DB.prepare(
    'INSERT INTO mail (id, title, content, sender, recipient_type, recipient_id, expires_for_new_users, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
  ).bind(mailId, 'Takedown Rejected', `Your request to take down issue "${issue.title}" has been rejected.\n\nReason: ${reason}`, 'Authority Office', 'user', issue.author_id, now);

  await c.env.DB.batch([updateIssue, insertActivity, insertMail]);
  return c.json({ success: true, message: 'Takedown rejected' });
});

// Legacy 7. PATCH /reports/:id (Keeping for backwards compatibility with Phase 1 frontend if any)
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

// 11. PATCH /profile
authoritiesRouter.patch('/profile', async (c) => {
  const jwtUser = c.get('user') as any;
  const body = await c.req.json();
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (body.username !== undefined) {
    if (typeof body.username !== 'string' || body.username.trim() === '') return c.json({ error: 'Invalid username' }, 400);
    updates.push('username = ?'); values.push(body.username.trim());
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string' || body.bio.length > 500) return c.json({ error: 'Invalid position' }, 400);
    updates.push('bio = ?'); values.push(body.bio.trim());
    updates.push('position = ?'); values.push(body.bio.trim());
  }
  if (body.position !== undefined && body.bio === undefined) {
    if (typeof body.position !== 'string' || body.position.length > 500) return c.json({ error: 'Invalid position' }, 400);
    updates.push('position = ?'); values.push(body.position.trim());
    updates.push('bio = ?'); values.push(body.position.trim());
  }
  if (body.avatar !== undefined) {
    if (typeof body.avatar !== 'string' || body.avatar.length > 2000) return c.json({ error: 'Invalid avatar url' }, 400);
    updates.push('avatar = ?'); values.push(body.avatar.trim());
  }
  
  if (updates.length === 0) return c.json({ error: 'No fields to update' }, 400);
  
  values.push(jwtUser.sub);
  
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  
  const updatedUser = await c.env.DB.prepare('SELECT email, username, bio, position, avatar, country, state, city, role FROM users WHERE id = ?').bind(jwtUser.sub).first();
  return c.json({ success: true, user: updatedUser });
});

// 12. POST /admin-message
authoritiesRouter.post('/admin-message', async (c) => {
  const jwtUser = c.get('user') as any;
  const body = await c.req.json();
  const now = Date.now();
  
  if (!body.title || !body.content || typeof body.content !== 'string' || body.content.trim() === '') {
    return c.json({ error: 'Message title and content are required' }, 400);
  }
  
  const mailId = crypto.randomUUID();
  try { await c.env.DB.prepare('ALTER TABLE mail ADD COLUMN sender_id TEXT').run(); } catch(e) {}

  const authUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(jwtUser.sub).first() as any;
  const senderName = authUser?.username || 'Authority';

  await c.env.DB.prepare(`
    INSERT INTO mail 
    (id, title, content, sender, sender_id, recipient_type, expires_for_new_users, created_at) 
    VALUES (?, ?, ?, ?, ?, 'admin', 0, ?)
  `).bind(mailId, body.title.trim(), body.content.trim(), senderName, jwtUser.sub, now).run();
  
  return c.json({ success: true, mailId });
});

// 13. GET /admin-messages
authoritiesRouter.get('/admin-messages', async (c) => {
  const jwtUser = c.get('user') as any;
  
  try { await c.env.DB.prepare('ALTER TABLE mail ADD COLUMN sender_id TEXT').run(); } catch(e) {}

  const messages = await c.env.DB.prepare(`
    SELECT m.*, u.username as sender_name, u.avatar as sender_avatar 
    FROM mail m 
    LEFT JOIN users u ON m.sender_id = u.id 
    WHERE (m.recipient_id = ? AND m.recipient_type = 'authority') 
       OR (m.sender_id = ? AND m.recipient_type = 'admin')
    ORDER BY m.created_at DESC
  `).bind(jwtUser.sub, jwtUser.sub).all();
  
  const inbox = messages.results.filter((m: any) => m.recipient_type === 'authority');
  const sent = messages.results.filter((m: any) => m.recipient_type === 'admin');
  
  return c.json({ success: true, inbox, sent });
});
