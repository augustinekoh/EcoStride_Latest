import { getAuth } from 'firebase/auth';

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && envUrl.includes('localhost')) {
      return envUrl.replace('localhost', hostname);
    }
  }
  return envUrl;
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
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch (e) {
      // Ignore JSON parse errors
    }
    throw new Error(errorMsg);
  }

  return response.json();
};

export const resolveAvatarUrl = (url: string | undefined | null, defaultUsername?: string) => {
  if (!url) return `https://api.dicebear.com/7.x/bottts/svg?seed=${defaultUsername || 'EcoStride'}`;
  
  if (url.includes('/r2/')) {
    const r2Path = url.substring(url.indexOf('/r2/'));
    const baseUrl = getApiBaseUrl().replace('/api', '');
    return `${baseUrl}${r2Path}`;
  }
  
  return url;
};
