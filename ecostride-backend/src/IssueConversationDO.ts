import { DurableObject } from "cloudflare:workers";

const MAX_MESSAGE_SIZE = 1024 * 10; // 10KB

export interface Env {
  DB: D1Database;
  ISSUE_CHAT: DurableObjectNamespace;
}

export class IssueConversationDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async publish(issueId: string, data: any) {
    try {
      const websockets = this.ctx.getWebSockets();
      if (websockets.length < 1) return;
      
      for (const ws of websockets) {
        const state = ws.deserializeAttachment() || {};
        if (state.issueId === issueId) {
          ws.send(JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("publish err", err);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }
    
    // Internal URL: /api/issues/:issueId/chat?userId=...
    const url = new URL(request.url);
    const issueId = url.pathname.split('/')[3]; // e.g. /api/issues/123/chat
    const userId = url.searchParams.get('userId');

    if (!issueId || !userId) {
      return new Response('Missing userId or issueId', { status: 400 });
    }

    const webSocketPair = new WebSocketPair();
    const client = webSocketPair[0];
    const server = webSocketPair[1];

    this.ctx.acceptWebSocket(server, [userId, issueId]);
    server.serializeAttachment({ userId, issueId });

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
    const { userId, issueId } = attachment;

    if (typeof message !== "string") {
      ws.close(1003, "Invalid message type");
      return;
    }
    
    if (message.length > MAX_MESSAGE_SIZE) {
      ws.close(1009, "Message too large");
      return;
    }

    try {
      const data = JSON.parse(message);
      
      if (data.type === 'message') {
        const content = typeof data.content === 'string' ? data.content.trim() : '';
        const imageUrl = data.imageUrl || null;
        const tempId = data.tempId || null;
        
        if (!content && !imageUrl) {
          throw new Error("Invalid chat message: content or image required");
        }

        // Fetch sender details
        // @ts-ignore
        const userCheck = await this.env.DB.prepare('SELECT username, avatar, role FROM users WHERE id = ?').bind(userId).first();
        if (!userCheck) {
            throw new Error("User not found");
        }

        const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2,7);
        const createdAt = Date.now();

        const payload = {
          type: 'message',
          message: {
            id: msgId,
            issue_id: issueId,
            sender_id: userId,
            sender_name: userCheck.username,
            sender_role: userCheck.role,
            content: content,
            created_at: createdAt,
            image_url: imageUrl,
            tempId: tempId
          }
        };

        // Persist to D1 BEFORE broadcast
        // @ts-ignore
        await this.env.DB.prepare(
          "INSERT INTO issue_messages (id, issue_id, sender_id, content, created_at, image_url) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(msgId, issueId, userId, content, createdAt, imageUrl).run();

        // Broadcast to all connected clients in this DO
        this.publish(issueId, payload);
      } else {
        throw new Error("Unknown message type");
      }
    } catch (e) {
      console.error("Message processing error:", e);
      ws.send(JSON.stringify({ type: 'error', error: 'Failed to process message' }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    // Handle error if necessary
  }
}
