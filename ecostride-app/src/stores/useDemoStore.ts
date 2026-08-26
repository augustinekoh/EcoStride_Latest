import { create } from 'zustand'

interface DemoState {
  currentMode: 'explore' | 'demo'
  demoProgress: number
  isAutoPlaying: boolean
  activeView: 'landing' | 'map' | 'merchant_dashboard' | 'merchant_onboarding' | 'leaderboard' | 'group' | 'profile' | 'city' | 'settings' | 'cases'
  viewHistory: ('landing' | 'map' | 'merchant_dashboard' | 'merchant_onboarding' | 'leaderboard' | 'group' | 'profile' | 'city' | 'settings' | 'cases')[]
  goBack: () => void
  showReportModal: boolean
  completedDistanceKm: number
  isWaitingForApproval: boolean
  isChatExpanded: boolean
  isMobileMenuOpen: boolean
  activePrivateChat: any | null
  setIsChatExpanded: (val: boolean) => void
  setIsMobileMenuOpen: (val: boolean) => void
  setActivePrivateChat: (chat: any | null) => void
  setIsWaitingForApproval: (val: boolean) => void
  demoRequestRejected: boolean
  setDemoRequestRejected: (val: boolean) => void
  setMode: (mode: 'explore' | 'demo') => void
  setProgress: (progress: number | ((prev: number) => number)) => void
  setIsAutoPlaying: (playing: boolean) => void
  setActiveView: (view: 'landing' | 'map' | 'merchant_dashboard' | 'merchant_onboarding' | 'leaderboard' | 'group' | 'profile' | 'city' | 'settings' | 'cases') => void
  setShowReportModal: (show: boolean) => void
  setCompletedDistanceKm: (dist: number) => void
  completedCheatDistanceKm: number
  setCompletedCheatDistanceKm: (dist: number) => void
  completedCoins: number
  setCompletedCoins: (coins: number) => void
  penaltyStatus: string
  penaltyReason: string
  setPenaltyStatus: (status: string) => void
  setPenaltyReason: (reason: string) => void
}

export const useDemoStore = create<DemoState>((set) => ({
  currentMode: 'explore',
  demoProgress: 0,
  isAutoPlaying: false,
  activeView: 'landing',
  viewHistory: [],
  showReportModal: false,
  completedDistanceKm: 0,
  isWaitingForApproval: false,
  isChatExpanded: false,
  isMobileMenuOpen: false,
  activePrivateChat: null,
  demoRequestRejected: false,
  setDemoRequestRejected: (val) => set({ demoRequestRejected: val }),
  setIsWaitingForApproval: (val) => set({ isWaitingForApproval: val }),
  setIsChatExpanded: (val) => set({ isChatExpanded: val }),
  setIsMobileMenuOpen: (val) => set({ isMobileMenuOpen: val }),
  setActivePrivateChat: (chat) => set({ activePrivateChat: chat }),
  setMode: (mode) => set({ currentMode: mode }),
  setProgress: (progress) => set((state) => ({
    demoProgress: typeof progress === 'function' ? progress(state.demoProgress) : progress
  })),
  setIsAutoPlaying: (playing) => set({ isAutoPlaying: playing }),
  setActiveView: (view) => set((state) => ({
    viewHistory: state.activeView !== view ? [...state.viewHistory, state.activeView] : state.viewHistory,
    activeView: view
  })),
  goBack: () => set((state) => {
    const history = [...state.viewHistory];
    if (history.length > 0) {
      const prev = history.pop();
      return { viewHistory: history, activeView: prev as any };
    }
    return { activeView: 'landing' };
  }),
  setShowReportModal: (show) => set({ showReportModal: show }),
  setCompletedDistanceKm: (dist) => set({ completedDistanceKm: dist }),
  completedCheatDistanceKm: 0,
  setCompletedCheatDistanceKm: (dist) => set({ completedCheatDistanceKm: dist }),
  completedCoins: 0,
  setCompletedCoins: (coins) => set({ completedCoins: coins }),
  penaltyStatus: 'NORMAL',
  penaltyReason: '',
  setPenaltyStatus: (status) => set({ penaltyStatus: status }),
  setPenaltyReason: (reason) => set({ penaltyReason: reason }),
}))
