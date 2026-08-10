import { useUserStore } from '../stores/useUserStore';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../lib/api';

export interface ChatMessage {
  id: string;
  guild_id: string;
  user_id: string;
  username?: string;
  avatar?: string;
  content: string;
  created_at: number;
  is_edited?: boolean;
  attachment_key?: string | null;
}

// Use VITE_API_BASE_URL to be consistent, but strip the /api suffix for WS
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl.replace(/\/api$/, '');
  // Default to relative if no VITE_API_BASE_URL is provided, or the origin
  return window.location.origin;
};
const API_URL = getApiBaseUrl();

export function useCommunityChat(guildId: string | undefined | null, token: string | undefined | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!guildId || !token) return;
    
    apiClient(`/chat/messages/${guildId}`)
      .then(data => {
        if (data && data.messages) {
          setMessages(data.messages);
          if (data.last_read_at !== undefined) {
             const unreadCount = data.messages.filter((m: any) => m.created_at > data.last_read_at).length;
             useUserStore.getState().setUserData({ communityUnreadCount: unreadCount });
          }
        }
      })
      .catch(console.error);
  }, [guildId, token]);

  const connect = useCallback(() => {
    if (!guildId || !token) return;

    // Convert http/https to ws/wss
    const wsUrl = new URL(`${API_URL}/api/chat/community/${guildId}?token=${token}`);
    wsUrl.protocol = wsUrl.protocol.replace('http', 'ws');

    const ws = new WebSocket(wsUrl.toString());

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          setIsMuted(!!data.muted);
        } else if (data.type === 'message' && data.message) {
          setMessages(prev => {
            // Check for duplicates
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        } else if (data.type === 'edit') {
          setMessages(prev => prev.map(m => 
            m.id === data.messageId ? { ...m, content: data.content, is_edited: true } : m
          ));
        } else if (data.type === 'delete') {
          setMessages(prev => prev.filter(m => m.id !== data.messageId));
        } else if (data.type === 'error') {
          if (data.error === 'You have been muted by the admin.') {
            setIsMuted(true);
          } else {
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              guild_id: guildId as string,
              user_id: 'system',
              username: 'System',
              content: data.error,
              created_at: Date.now()
            }]);
          }
        }
      } catch (e) {
        console.error("Failed to parse message", e);
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      
      // Stop reconnecting on unauthorized or max retries
      if (event.code === 1008 || event.code === 4001 || event.code === 4003 || reconnectAttempts.current > 5) {
        return;
      }

      // Exponential backoff reconnect
      const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
      reconnectAttempts.current += 1;
      reconnectTimeoutRef.current = setTimeout(connect, timeout);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error", err);
    };

    wsRef.current = ws;
  }, [guildId, token]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        // Prevent reconnect loop on unmount
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((content: string, attachmentKey?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content, attachmentKey }));
    }
  }, []);

  const editMessage = useCallback((messageId: string, content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'edit', messageId, content }));
    }
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'delete', messageId }));
    }
  }, []);

  return {
    messages,
    isConnected,
    isMuted,
    sendMessage,
    editMessage,
    deleteMessage
  };
}
