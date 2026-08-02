import { create } from 'zustand'

interface MapState {
  signposts: any[]
  setSignposts: (signposts: any[]) => void
  
  activeSignpost: any | null
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

  mapDisplayMode: 'normal' | 'guild'
  setMapDisplayMode: (mode: 'normal' | 'guild') => void
}

export const useMapStore = create<MapState>((set) => ({
  signposts: [],
  setSignposts: (signposts) => set({ signposts }),
  
  activeSignpost: null,
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
}))
