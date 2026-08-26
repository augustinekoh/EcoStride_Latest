import { getAuth } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

export const getApiBaseUrl = () => {
  let envUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  
  // Reroute localhost to host machine's LAN IP for Android emulator
  if (Capacitor.isNativePlatform() && envUrl.includes('localhost')) {
    envUrl = envUrl.replace('localhost', '192.168.0.194');
  }

  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && envUrl.includes('localhost')) {
      return envUrl.replace('localhost', hostname);
    }
  }
  return envUrl;
};

export const getSessionId = () => {
  let sid = localStorage.getItem('ecostride_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem('ecostride_session_id', sid);
  }
  return sid;
};

export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
  const API_BASE_URL = getApiBaseUrl();
  const auth = getAuth();
  const user = auth.currentUser;
  
  const headers = new Headers(options.headers);
  // Don't set Content-Type if we pass FormData (let browser set it with boundary)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  headers.set('X-Session-ID', getSessionId());
  
  if (user) {
    const token = await user.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status} ${response.statusText}`;
    let isSessionExpired = false;
    try {
      const errorData = await response.json();
      if (errorData.error === 'SESSION_EXPIRED' || errorData.error === '401_SESSION_EXPIRED') isSessionExpired = true;
      errorMsg = errorData.error || errorMsg;
    } catch (e) {
      // Ignore JSON parse errors
    }
    
    if (response.status === 401 && isSessionExpired) {
      window.dispatchEvent(new Event('session_expired'));
    }
    
    throw new Error(errorMsg);
  }

  return response.json();
};

export const resolveImageUrl = (url: string | undefined | null, defaultUsername?: string) => {
  if (!url) return `https://api.dicebear.com/7.x/bottts/svg?seed=${defaultUsername || 'EcoStride'}`;
  
  let finalUrl = url;
  
  if (finalUrl.startsWith('/r2/')) {
    const baseUrl = getApiBaseUrl().replace('/api', '');
    finalUrl = `${baseUrl}${finalUrl}`;
  }
  
  // Fix hardcoded localhost URLs for Android Emulator
  if (Capacitor.isNativePlatform()) {
    const hostIp = '192.168.0.194'; // Use the same IP configured for the API
    finalUrl = finalUrl.replace('http://localhost:8787', `http://${hostIp}:8787`)
                       .replace('http://127.0.0.1:8787', `http://${hostIp}:8787`);
  }
  
  return finalUrl;
};

export const resolveAvatarUrl = resolveImageUrl; // alias for backward compatibility
