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
  nationality: string
  totalTreesPlanted: number
  newsEnabled: boolean
  dailyReminderEnabled: boolean
  newFollowerEnabled: boolean
  shareActivity: boolean
  doNotDisturb: boolean
  isDarkMode: boolean
  notifications: { id: string; title: string; message: string; icon: string; time: string }[]
  unlockedBadges: string[]
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
}

const syncToAPI = async (data: any) => {
  if (auth.currentUser) {
    try {
      await apiClient(`/users/${auth.currentUser.uid}`, {
        method: 'POST',
        body: JSON.stringify(data)
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
      nationality: '',
      totalTreesPlanted: 0,
      newsEnabled: false,
      dailyReminderEnabled: true,
      newFollowerEnabled: true,
      shareActivity: true,
      doNotDisturb: false,
      isDarkMode: false,
      notifications: [],
      unlockedBadges: [],
      activityHistory: [],
      createdAt: undefined,
      hasReadAlerts: false,
      setHasReadAlerts: (read) => set({ hasReadAlerts: read }),
      setLocalData: (data) => set((state) => ({ ...state, ...data })),
      setUserData: (data) => set((state) => {
        const newState = { ...state, ...data };
        syncToAPI(data);
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
      clearNotifications: () => set({ notifications: [] })
    }),
    {
      name: 'ecostride-user-store',
    }
  )
)
