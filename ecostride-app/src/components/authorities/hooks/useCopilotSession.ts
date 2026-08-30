import { useState, useCallback } from 'react';
import { apiClient } from '../../../lib/api';

export interface CopilotSession {
  sessionId: string;
  title: string;
  selectedReportIds: string[];
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface CopilotMessage {
  sender_role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export const useCopilotSession = () => {
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isResumingSession, setIsResumingSession] = useState(false);

  const createSession = useCallback(async (reportIds: string[]): Promise<string> => {
    setIsCreatingSession(true);
    try {
      const response = await apiClient('/authorities/copilot/sessions', {
        method: 'POST',
        body: JSON.stringify({ reportIds })
      });
      return response.sessionId;
    } finally {
      setIsCreatingSession(false);
    }
  }, []);

  const getSessionHistory = useCallback(async (limit: number = 20): Promise<CopilotSession[]> => {
    setIsFetchingHistory(true);
    try {
      const response = await apiClient(`/authorities/copilot/sessions?limit=${limit}`);
      return response.sessions;
    } finally {
      setIsFetchingHistory(false);
    }
  }, []);

  const getSession = useCallback(async (sessionId: string): Promise<{ session: CopilotSession, messages: CopilotMessage[] }> => {
    setIsResumingSession(true);
    try {
      const response = await apiClient(`/authorities/copilot/sessions/${sessionId}`);
      return response;
    } finally {
      setIsResumingSession(false);
    }
  }, []);

  const getSocketTicket = useCallback(async (sessionId: string): Promise<{ ticket: string, expiresAt: number }> => {
    const response = await apiClient('/authorities/copilot/socket-ticket', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
    return { ticket: response.ticket, expiresAt: response.expiresAt };
  }, []);

  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    await apiClient(`/authorities/copilot/sessions/${sessionId}`, {
      method: 'DELETE'
    });
  }, []);

  return {
    isCreatingSession,
    isFetchingHistory,
    isResumingSession,
    createSession,
    getSessionHistory,
    getSession,
    deleteSession,
    getSocketTicket
  };
};
