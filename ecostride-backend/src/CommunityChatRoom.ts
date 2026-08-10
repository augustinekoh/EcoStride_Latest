import { DurableObject } from "cloudflare:workers";

const MAX_MESSAGE_SIZE = 1024 * 10; // 10KB

export interface Env {
  DB: D1Database;
  CHAT_ROOM: DurableObjectNamespace;
}

export class CommunityChatRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async publish(guildId: string, data: any) {
    try {
      const websockets = this.ctx.getWebSockets();
      if (websockets.length < 1) {
        return;
      }
      for (const ws of websockets) {
        const state = ws.deserializeAttachment() || {};
        // Although this DO is scoped per guild, we add the check for extra safety
        if (state.guildId === guildId) {
          ws.send(JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("publish err", err);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Internal API to publish system messages to connected clients
    if (request.method === 'POST' && url.pathname.endsWith('/system_message')) {
      try {
        const body = await request.json() as any;
        await this.publish(body.guild_id, { type: 'message', message: body });
        
        // If it's a mute action, we might also want to broadcast status
        if (body.action === 'mute') {
           // We can notify the specific user they are muted if they are connected
           const websockets = this.ctx.getWebSockets();
           for (const ws of websockets) {
             const state = ws.deserializeAttachment() || {};
             if (state.guildId === body.guild_id && state.userId === body.target_user_id) {
               ws.send(JSON.stringify({ type: 'status', muted: true }));
             }
           }
        } else if (body.action === 'unmute') {
           const websockets = this.ctx.getWebSockets();
           for (const ws of websockets) {
             const state = ws.deserializeAttachment() || {};
             if (state.guildId === body.guild_id && state.userId === body.target_user_id) {
               ws.send(JSON.stringify({ type: 'status', muted: false }));
             }
           }
        }
        
        return new Response('Published', { status: 200 });
      } catch (err) {
        return new Response('Error parsing body', { status: 400 });
      }
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }
    
    // Original request url: /api/chat/community/:guildId
    const guildId = url.searchParams.get('guildId') || url.pathname.split('/').pop()?.split('?')[0];
    const token = url.searchParams.get('token');

    if (!guildId || !token) {
      return new Response('Missing token or guildId', { status: 400 });
    }

    // Decode JWT payload (signature already verified by index.ts)
    const payloadBase64 = token.split('.')[1];
    let base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payloadJson = atob(base64);
    const userId = JSON.parse(payloadJson).sub;

    if (!userId) {
      return new Response('Missing userId', { status: 400 });
    }

    const webSocketPair = new WebSocketPair();
    const client = webSocketPair[0];
    const server = webSocketPair[1];

    // Accept the WebSocket connection with Hibernation API
    this.ctx.acceptWebSocket(server, [userId, guildId]);
    
    server.serializeAttachment({ userId, guildId });

    // Send initial status
    // @ts-ignore
    this.env.DB.prepare('SELECT muted_until FROM users WHERE id = ?').bind(userId).first().then((userCheck: any) => {
       if (userCheck && !guildId.startsWith('1to1_') && userCheck.muted_until && (userCheck.muted_until === -1 || userCheck.muted_until > Date.now())) {
          server.send(JSON.stringify({ type: 'status', muted: true }));
       } else {
          server.send(JSON.stringify({ type: 'status', muted: false }));
       }
    }).catch((err: any) => console.error("Failed to fetch initial mute status", err));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const attachment = ws.deserializeAttachment();
    if (!attachment) {
      ws.close(1003, "Missing attachment");
      return;
    }
    const { userId, guildId } = attachment;

    // Validate message type and size
    if (typeof message !== "string") {
      console.error(`Invalid message type: ${typeof message}`);
      ws.close(1003, "Invalid message type");
      return;
    }
    
    if (message.length > MAX_MESSAGE_SIZE) {
      console.error(`Message too large: ${message.length} bytes`);
      ws.close(1009, "Message too large");
      return;
    }

    try {
      const data = JSON.parse(message);
      
      if (data.type === 'message') {
        const content = data.content;
        const attachmentKey = data.attachmentKey || null;
        if (typeof content !== 'string' || content.trim().length === 0) {
          throw new Error("Invalid chat message");
        }

        // @ts-ignore
        const userCheck = await this.env.DB.prepare('SELECT username, avatar, muted_until FROM users WHERE id = ?').bind(userId).first();
        if (userCheck) {
          if (!guildId.startsWith('1to1_') && userCheck.muted_until && (userCheck.muted_until === -1 || userCheck.muted_until > Date.now())) {
            ws.send(JSON.stringify({ type: 'error', error: 'You have been muted by the admin.' }));
            return;
          }
        }
        
        const msgId = crypto.randomUUID();
        const createdAt = Date.now();

        const payload = {
          type: 'message',
          message: {
            id: msgId,
            guild_id: guildId,
            user_id: userId,
            username: userCheck ? userCheck.username : 'Unknown User',
            avatar: userCheck ? userCheck.avatar : null,
            content: content,
            created_at: createdAt,
            is_edited: 0,
            attachment_key: attachmentKey
          }
        };

        // Persist to D1 BEFORE broadcast
        // @ts-ignore
        await this.env.DB.prepare(
          "INSERT INTO chat_messages (id, guild_id, sender_id, sender_name, content, timestamp, attachment_key) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(msgId, guildId, userId, userCheck ? userCheck.username : 'Unknown User', content, createdAt, attachmentKey).run();

        // Broadcast to all connected clients in this DO using the centralized publish method
        this.publish(guildId, payload);
        
      } else if (data.type === 'edit') {
        const { messageId, content } = data;
        if (!messageId || typeof content !== 'string' || content.trim().length === 0) {
          throw new Error("Invalid edit payload");
        }
        
        // Fetch original message
        // @ts-ignore
        const msg = await this.env.DB.prepare('SELECT sender_id, timestamp, content FROM chat_messages WHERE id = ?').bind(messageId).first();
        
        if (!msg) {
          ws.send(JSON.stringify({ type: 'error', error: 'Message not found' }));
          return;
        }
        
        if (msg.sender_id !== userId) {
          ws.send(JSON.stringify({ type: 'error', error: 'You can only edit your own messages' }));
          return;
        }
        
        if (msg.content.includes('[IMAGE:')) {
          ws.send(JSON.stringify({ type: 'error', error: 'Cannot edit image messages' }));
          return;
        }
        
        const ageMs = Date.now() - msg.timestamp;
        if (ageMs > 5 * 60 * 1000) {
          ws.send(JSON.stringify({ type: 'error', error: 'Messages can only be edited within 5 minutes' }));
          return;
        }
        
        // Commit update
        // @ts-ignore
        await this.env.DB.prepare('UPDATE chat_messages SET content = ?, is_edited = 1 WHERE id = ?').bind(content, messageId).run();
        
        // Broadcast
        this.publish(guildId, { type: 'edit', messageId, content });
        
      } else if (data.type === 'delete') {
        const { messageId } = data;
        if (!messageId) throw new Error("Invalid delete payload");
        
        // Fetch original message
        // @ts-ignore
        const msg = await this.env.DB.prepare('SELECT sender_id FROM chat_messages WHERE id = ?').bind(messageId).first();
        
        if (!msg) return; // already deleted or not found
        
        if (msg.sender_id !== userId) {
          ws.send(JSON.stringify({ type: 'error', error: 'You can only delete your own messages' }));
          return;
        }
        
        // Commit delete
        // @ts-ignore
        await this.env.DB.prepare('DELETE FROM chat_messages WHERE id = ?').bind(messageId).run();
        
        // Broadcast
        this.publish(guildId, { type: 'delete', messageId });
        
      } else {
        throw new Error("Unknown message type");
      }
    } catch (e) {
      console.error("Message processing error:", e);
      ws.close(1003, "Invalid message format");
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    // Handle error if necessary
  }
}
