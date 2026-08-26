import { create } from 'zustand'

interface MapState {
  signposts: any[]
  setSignposts: (signposts: any[]) => void
  
  issues: any[]
  setIssues: (issues: any[]) => void

  activeSignpost: any | null
  activeIssue: any | null
  setActiveIssue: (issue: any | null) => void
  territoryConquered: boolean
  plantedTrees: any[]
  setActiveSignpost: (signpost: any | null) => void
  setTerritoryConquered: (conquered: boolean) => void
  addTree: (tree: any) => void
  resetTrees: () => void
  isPlantingMode: boolean
  setIsPlantingMode: (mode: boolean) => void
  
  // Real App States
  liveLocation: [number, number] | null // [longitude, latitude]
  setLiveLocation: (loc: [number, number] | null) => void
  
  merchants: any[]
  setMerchants: (merchants: any[]) => void
  
  selectedMerchant: any | null
  setSelectedMerchant: (merchant: any | null) => void
  
  activeRouteGeoJSON: any | null
  setActiveRouteGeoJSON: (geojson: any | null) => void
  
  distanceToTarget: number | null // in km
  setDistanceToTarget: (dist: number | null) => void
  
  flyToLocation: [number, number] | null
  setFlyToLocation: (loc: [number, number] | null) => void

  mapDisplayMode: 'normal' | 'guild' | 'my_guild'
  setMapDisplayMode: (mode: 'normal' | 'guild' | 'my_guild') => void

  isWalkModeActive: boolean
  setIsWalkModeActive: (active: boolean) => void
  
  walkedDistanceKm: number
  setWalkedDistanceKm: (dist: number | ((prev: number) => number)) => void
  
  isFreeWalk: boolean
  setIsFreeWalk: (active: boolean) => void
}

export const useMapStore = create<MapState>((set) => ({
  signposts: [],
  setSignposts: (signposts) => set({ signposts }),
  
  issues: [],
  setIssues: (issues) => set({ issues }),

  activeSignpost: null,
  activeIssue: null,
  setActiveIssue: (activeIssue) => set({ activeIssue }),
  territoryConquered: false,
  plantedTrees: [],
  setActiveSignpost: (activeSignpost) => set({ activeSignpost }),
  setTerritoryConquered: (territoryConquered) => set({ territoryConquered }),
  addTree: (tree) => set((state) => ({ plantedTrees: [...state.plantedTrees, tree] })),
  resetTrees: () => set({ plantedTrees: [] }),
  isPlantingMode: false,
  setIsPlantingMode: (isPlantingMode) => set({ isPlantingMode }),
  
  liveLocation: null,
  setLiveLocation: (liveLocation) => set({ liveLocation }),
  
  merchants: [],
  setMerchants: (merchants) => set({ merchants }),
  
  selectedMerchant: null,
  setSelectedMerchant: (selectedMerchant) => set({ selectedMerchant }),
  
  activeRouteGeoJSON: null,
  setActiveRouteGeoJSON: (activeRouteGeoJSON) => set({ activeRouteGeoJSON }),
  
  distanceToTarget: null,
  setDistanceToTarget: (distanceToTarget) => set({ distanceToTarget }),
  
  flyToLocation: null,
  setFlyToLocation: (flyToLocation) => set({ flyToLocation }),

  mapDisplayMode: 'normal',
  setMapDisplayMode: (mapDisplayMode) => set({ mapDisplayMode }),

  isWalkModeActive: false,
  setIsWalkModeActive: (isWalkModeActive) => set({ isWalkModeActive }),
  
  walkedDistanceKm: 0,
  setWalkedDistanceKm: (dist) => set((state) => ({ 
    walkedDistanceKm: typeof dist === 'function' ? dist(state.walkedDistanceKm) : dist 
  })),
  
  isFreeWalk: false,
  setIsFreeWalk: (isFreeWalk) => set({ isFreeWalk })
}))
