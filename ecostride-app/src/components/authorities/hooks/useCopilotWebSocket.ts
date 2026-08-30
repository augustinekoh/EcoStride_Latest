import { useState, useEffect, useRef, useCallback } from 'react';
import { getWebSocketBaseUrl } from '../../../lib/api';
import type { CopilotMessage } from './useCopilotSession';

export type ConnectionStatus =
  | 'idle'
  | 'creating_session'
  | 'acquiring_ticket'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

interface WebSocketMessage {
  type: string;
  payload?: any;
  message?: string;
  requestId?: string;
  content?: string;
}

export const useCopilotWebSocket = (sessionId: string | null, initialMessages: CopilotMessage[] = []) => {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [messages, setMessages] = useState<CopilotMessage[]>(initialMessages);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<false | 'analyzing' | 'thinking'>(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const isMounted = useRef(true);
  const MAX_RECONNECT = 3;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Initialize messages if we switch sessions
  useEffect(() => {
    setMessages(initialMessages);
  }, [sessionId, initialMessages]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setStatus('disconnected');
    reconnectCountRef.current = 0;
  }, []);

  const connect = useCallback((ticket: string, isResume: boolean = false, reportIds: string[] = []) => {
    if (!sessionId || !ticket || !isMounted.current) return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus(reconnectCountRef.current > 0 ? 'reconnecting' : 'connecting');
    setErrorDetails(null);

    const wsBase = getWebSocketBaseUrl();
    const wsUrl = `${wsBase}/authorities/copilot/chat?sessionId=${sessionId}&ticket=${ticket}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const hasMessages = reconnectCountRef.current > 0 || isResume;

    ws.onopen = () => {
      setStatus('connected');
      reconnectCountRef.current = 0;
      
      // If it's a new investigation, send start_investigation
      if (!hasMessages) {
        setIsProcessing('analyzing');
        ws.send(JSON.stringify({
          type: 'start_investigation',
          requestId: crypto.randomUUID(),
          payload: {
            reportIds
          }
        }));
      } else {
        // For phase 4, we don't strictly need a resume payload if history is fetched from HTTP,
        // but it's good practice to ping or sync if required by future backend features.
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        
        if (data.type === 'investigation_started') {
          if (data.payload?.content) {
            setMessages(prev => {
              if (prev.some(m => m.content === data.payload.content)) return prev;
              return [...prev, { sender_role: 'model', content: data.payload.content, timestamp: Date.now() }];
            });
            setIsProcessing(false);
          }
        } else if (data.type === 'assistant_message') {
          setMessages(prev => [...prev, { sender_role: 'model', content: data.payload.content, timestamp: Date.now() }]);
          setIsProcessing(false);
        } else if (data.type === 'error') {
          console.error('Copilot WS Error:', data.payload.message || data.message);
          setErrorDetails(data.payload.message || data.message || 'Unknown error occurred.');
          setIsProcessing(false);
        }
      } catch (e) {
        console.error('Failed to parse WS message:', event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      // Let onclose handle the state changes and reconnects
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      if (event.code === 1000) {
        setStatus('disconnected');
      } else {
        if (reconnectCountRef.current < MAX_RECONNECT) {
          reconnectCountRef.current += 1;
          setStatus('error');
          setErrorDetails(`Connection lost. Reconnecting (attempt ${reconnectCountRef.current}/${MAX_RECONNECT})...`);
          // Dispatch an event or callback so the parent component can fetch a NEW ticket and call connect() again
          // since tickets are single-use.
          window.dispatchEvent(new CustomEvent('copilot_reconnect_needed', { detail: { sessionId } }));
        } else {
          setStatus('error');
          setErrorDetails('Connection lost. Max reconnection attempts reached.');
        }
      }
    };
  }, [sessionId]);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsProcessing('thinking');
      wsRef.current.send(JSON.stringify({
        type: 'user_message',
        requestId: crypto.randomUUID(),
        payload: { content }
      }));
      setMessages(prev => [...prev, { sender_role: 'user', content, timestamp: Date.now() }]);
    }
  }, []);

  return {
    status,
    setStatus,
    messages,
    errorDetails,
    connect,
    disconnect,
    sendMessage,
    isProcessing
  };
};
