import { getAuth } from 'firebase/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
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
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${r2Path}`;
  }
  
  return url;
};
