import { create } from 'zustand';
import type { User } from 'firebase/auth';

interface AuthState {
  user: any | null
  role: 'user' | 'merchant' | 'admin' | 'authority' | null
  loading: boolean;
  setUser: (user: any | null, role: 'user' | 'merchant' | 'admin' | 'authority' | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  loading: true,
  setUser: (user, role = 'user') => set({ user, role, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
