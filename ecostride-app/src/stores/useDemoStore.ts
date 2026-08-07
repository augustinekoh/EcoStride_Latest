import { create } from 'zustand'

interface DemoState {
  currentMode: 'explore' | 'demo'
  demoProgress: number
  isAutoPlaying: boolean
  activeView: 'landing' | 'map' | 'merchant_dashboard' | 'merchant_onboarding' | 'leaderboard' | 'group' | 'profile' | 'city' | 'settings'
  showReportModal: boolean
  completedDistanceKm: number
  isWaitingForApproval: boolean
  isChatExpanded: boolean
  activePrivateChat: any | null
  setIsChatExpanded: (val: boolean) => void
  setActivePrivateChat: (chat: any | null) => void
  setIsWaitingForApproval: (val: boolean) => void
  demoRequestRejected: boolean
  setDemoRequestRejected: (val: boolean) => void
  setMode: (mode: 'explore' | 'demo') => void
  setProgress: (progress: number | ((prev: number) => number)) => void
  setIsAutoPlaying: (playing: boolean) => void
  setActiveView: (view: 'landing' | 'map' | 'merchant_dashboard' | 'merchant_onboarding' | 'leaderboard' | 'group' | 'profile' | 'city' | 'settings') => void
  setShowReportModal: (show: boolean) => void
  setCompletedDistanceKm: (dist: number) => void
}

export const useDemoStore = create<DemoState>((set) => ({
  currentMode: 'explore',
  demoProgress: 0,
  isAutoPlaying: false,
  activeView: 'landing',
  showReportModal: false,
  completedDistanceKm: 0,
  isWaitingForApproval: false,
  isChatExpanded: false,
  activePrivateChat: null,
  demoRequestRejected: false,
  setDemoRequestRejected: (val) => set({ demoRequestRejected: val }),
  setIsWaitingForApproval: (val) => set({ isWaitingForApproval: val }),
  setIsChatExpanded: (val) => set({ isChatExpanded: val }),
  setActivePrivateChat: (chat) => set({ activePrivateChat: chat }),
  setMode: (mode) => set({ currentMode: mode }),
  setProgress: (progress) => set((state) => ({ 
    demoProgress: typeof progress === 'function' ? progress(state.demoProgress) : progress 
  })),
  setIsAutoPlaying: (playing) => set({ isAutoPlaying: playing }),
  setActiveView: (view) => set({ activeView: view }),
  setShowReportModal: (show) => set({ showReportModal: show }),
  setCompletedDistanceKm: (dist) => set({ completedDistanceKm: dist }),
}))
