import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { auth } from '../firebase'
import { apiClient } from '../lib/api'

interface UserState {
  userCoins: number
  totalCarbonSaved: number
  totalDistanceKm: number
  streaks: number
  vouchersCollected: number
  challengesCompleted: number
  username: string
  firstName: string
  lastName: string
  email: string
  player_id?: string
  bio: string
  country: string
  state: string
  city: string
  avatar: string | null
  guildId: string | null
  guildName: string | null
  bannedUntil?: number
  communityUnreadCount: number
  friendsUnreadCount: number
  issuesUnreadCount: number
  authorityUnreadCount: number
  setCoins: (coins: number | ((prev: number) => number)) => void
  setGuildId: (id: string | null) => void
  totalTreesPlanted: number
  pushEnabled: boolean
  mailboxEnabled: boolean
  socialEnabled: boolean
  newsEnabled: boolean
  dailyReminderEnabled: boolean
  newFollowerEnabled: boolean
  shareActivity: boolean
  shareActivityStatus: boolean
  isPublicProfile: boolean
  allowFriendRequests: boolean
  doNotDisturb: boolean
  isDarkMode: boolean
  hasSeenTutorial: boolean
  notifications: { id: string; title: string; message: string; icon: string; time: string }[]
  unlockedBadges: string[]
  showcasedBadges: string[]
  activityHistory: { date: string; distance: number }[]
  createdAt?: number
  setUserData: (data: Partial<UserState>) => void
  setLocalData: (data: Partial<UserState>) => void
  addCoins: (amount: number) => void
  deductCoins: (amount: number) => void
  addCarbonSaved: (amount: number) => void
  addActivity: (distance: number) => void
  addNotification: (notif: { title: string; message: string; icon: string }) => void
  clearNotifications: () => void
  hasReadAlerts: boolean
  setHasReadAlerts: (read: boolean) => void
  setHasSeenTutorial: (seen: boolean) => void
  clearUser: () => void
}

const syncToAPI = async (data: any) => {
  if (auth.currentUser) {
    try {
      // Map flat boolean preference flags to nested preferences object for backend
      const payload = { ...data };
      const prefsKeys = ['pushEnabled', 'mailboxEnabled', 'socialEnabled', 'newsEnabled', 'dailyReminderEnabled', 'newFollowerEnabled'];
      
      let hasPrefs = false;
      const preferences: any = {};
      
      for (const key of prefsKeys) {
        if (payload[key] !== undefined) {
          // Convert camelCase to snake_case for DB
          const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          preferences[snakeKey] = payload[key];
          delete payload[key];
          hasPrefs = true;
        }
      }
      
      if (hasPrefs) {
        payload.preferences = preferences;
      }

      await apiClient(`/users/${auth.currentUser.uid}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Failed to sync to API:", e);
    }
  }
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userCoins: 0,
      totalCarbonSaved: 0, 
      totalDistanceKm: 0, 
      streaks: 0, 
      vouchersCollected: 0, 
      challengesCompleted: 0, 
      username: '',
      firstName: '',
      lastName: '',
      email: '',
      bio: '',
      country: '',
      state: '',
      city: '',
      avatar: null,
      guildId: null,
      guildName: null,
      bannedUntil: undefined,
      communityUnreadCount: 0,
      friendsUnreadCount: 0,
      issuesUnreadCount: 0,
      authorityUnreadCount: 0,
      setCoins: (coins) => set((state) => ({ 
        userCoins: typeof coins === 'function' ? coins(state.userCoins) : coins 
      })),
      setGuildId: (id) => set({ guildId: id }),
      totalTreesPlanted: 0,
      pushEnabled: true,
      mailboxEnabled: true,
      socialEnabled: true,
      newsEnabled: false,
      dailyReminderEnabled: true,
      newFollowerEnabled: true,
      shareActivity: true,
      shareActivityStatus: true,
      isPublicProfile: true,
      allowFriendRequests: true,
      doNotDisturb: false,
      isDarkMode: false,
      notifications: [],
      unlockedBadges: [],
      showcasedBadges: [],
      activityHistory: [],
      createdAt: undefined,
      hasSeenTutorial: false,
      hasReadAlerts: false,
      setHasSeenTutorial: (seen) => set({ hasSeenTutorial: seen }),
      setHasReadAlerts: (read) => set({ hasReadAlerts: read }),
      setLocalData: (data) => set((state) => ({ ...state, ...data })),
      setUserData: (data) => set((state) => {
        const newState = { ...state, ...data };
        // Always include username and email in case the backend needs to upsert a missing user
        syncToAPI({ ...data, username: newState.username, email: newState.email });
        return newState;
      }),
      
      addCoins: (amount) => set((state) => {
        const newCoins = state.userCoins + amount;
        syncToAPI({ coins: newCoins });
        return { userCoins: newCoins };
      }),
      deductCoins: (amount) => set((state) => {
        const newCoins = state.userCoins - amount;
        syncToAPI({ coins: newCoins });
        return { userCoins: newCoins };
      }),
      addCarbonSaved: (amount) => set((state) => {
        const newTotal = state.totalCarbonSaved + amount;
        syncToAPI({ totalCarbonSaved: newTotal });
        return { totalCarbonSaved: newTotal };
      }),
      addActivity: (distance) => set((state) => {
        if (distance <= 0) return state;
        const newTotal = state.totalDistanceKm + distance;
        
        syncToAPI({ totalDistanceKm: newTotal });
        
        // Log individual activity to backend
        if (auth.currentUser) {
          apiClient('/activity', {
            method: 'POST',
            body: JSON.stringify({
              userId: auth.currentUser.uid,
              date: new Date().toISOString(),
              distance
            })
          }).catch(e => console.error(e));
        }
        
        return { 
          totalDistanceKm: newTotal,
          activityHistory: [...state.activityHistory, { date: new Date().toISOString(), distance }]
        };
      }),
      addNotification: (notif) => set((state) => ({ 
        notifications: [{ ...notif, id: Math.random().toString(), time: new Date().toISOString() }, ...state.notifications],
        hasReadAlerts: false
      })),
      clearNotifications: () => set({ notifications: [] }),
      clearUser: () => {
        localStorage.removeItem('ecostride-user-store');
        set({
          userCoins: 0, totalCarbonSaved: 0, totalDistanceKm: 0, streaks: 0, vouchersCollected: 0,
          challengesCompleted: 0, username: '', firstName: '', lastName: '', email: '',
          player_id: undefined, bio: '', country: '', state: '', city: '', avatar: null, guildId: null, guildName: null,
          bannedUntil: undefined,
          communityUnreadCount: 0,
          friendsUnreadCount: 0,
          issuesUnreadCount: 0,
          authorityUnreadCount: 0,
          totalTreesPlanted: 0, newsEnabled: false, dailyReminderEnabled: true,
          newFollowerEnabled: true, shareActivity: true, doNotDisturb: false, isDarkMode: false,
          shareActivityStatus: true, isPublicProfile: true, allowFriendRequests: true,
          notifications: [], unlockedBadges: [], showcasedBadges: [], activityHistory: [],
          createdAt: undefined, hasReadAlerts: false, hasSeenTutorial: false
        });
      }
    }),
    {
      name: 'ecostride-user-store',
    }
  )
)
