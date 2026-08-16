import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Map, { Source, Layer, Marker, Popup } from 'react-map-gl/mapbox';
import type { ViewState } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Leaf, X, ExternalLink, Gift, MapPin, ArrowLeft, Home, Navigation, Send, ChevronLeft, ChevronRight, ShieldCheck, Loader2, Trash2, AlertTriangle } from 'lucide-react';

import { useDemoStore } from '../../stores/useDemoStore';
import { useMapStore } from '../../stores/useMapStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUserStore } from '../../stores/useUserStore';
import { apiClient } from '../../lib/api';
import { MAPBOX_TOKEN, getWalkingRoute, getDistanceMeters } from '../../lib/mapboxAPI';
import * as turf from '@turf/turf';
import routesData from '../../mock/routes.json';
import leaderboardData from '../../mock/leaderboard.json';
import { CreateSignpostModal } from './CreateSignpostModal';
import { ShareSignpostModal } from './ShareSignpostModal';
import { DraggableMapWidget } from './DraggableMapWidget';
import { ImpactReportModal } from '../modals/ImpactReportModal';
import { CreateIssueModal } from './CreateIssueModal';
import { ShareIssueModal } from './ShareIssueModal';
import { PointsStoreModal } from '../modals/PointsStoreModal';
import { SignpostStoryViewer } from './SignpostStoryViewer';
import { UserProfileModal } from '../modals/UserProfileModal';
import { useMapGeolocation } from './useMapGeolocation';

const getDurationSince = (timestamp: number) => {
  const diffInSeconds = Math.floor((Date.now() - timestamp) / 1000);
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};

export const MapView: React.FC = () => {
  const { demoProgress, currentMode, setShowReportModal, setActiveView, setCompletedDistanceKm } = useDemoStore();
  const { 
    territoryConquered, 
    liveLocation, setLiveLocation,
    merchants, setMerchants,
    signposts, setSignposts,
    activeSignpost, setActiveSignpost,
    selectedMerchant, setSelectedMerchant,
    activeRouteGeoJSON: mapboxRouteGeoJSON, setActiveRouteGeoJSON,
    distanceToTarget, setDistanceToTarget,
    flyToLocation, setFlyToLocation,
    isPlantingMode, setIsPlantingMode,
    mapDisplayMode, setMapDisplayMode,
    issues, setIssues,
    activeIssue, setActiveIssue,
  } = useMapStore();
  
  const { userCoins, deductCoins, addCoins, guildName, guildId } = useUserStore();

  const mapRef = useRef(null);
  const location = useLocation();
  const [trees, setTrees] = useState<any[]>([]);
  const [mapFilter, setMapFilter] = useState<'all' | 'issues' | 'trees' | 'signposts'>('all');
  const [activeTree, setActiveTree] = useState<any | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCreateIssueModal, setShowCreateIssueModal] = useState(false);
  const [showShareIssueModal, setShowShareIssueModal] = useState(false);
  const [activeIssueImageIndex, setActiveIssueImageIndex] = useState(0);
  const [showTakeDownConfirm, setShowTakeDownConfirm] = useState(false);
  const [isTakingDownIssue, setIsTakingDownIssue] = useState(false);

  useEffect(() => {
    setActiveIssueImageIndex(0);
    setShowTakeDownConfirm(false);
  }, [activeIssue?.id]);
  const [showNavPrompt, setShowNavPrompt] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('hide_nav_instruction');
    }
    return true;
  });
  const [showNavPromptConfirm, setShowNavPromptConfirm] = useState(false);
  const [showFabTooltip, setShowFabTooltip] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 640) {
      return !sessionStorage.getItem('seen_fab_tooltip');
    }
    return false;
  });
  const [showMapHomeTooltip, setShowMapHomeTooltip] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('seen_map_home_tooltip');
    }
    return false;
  });
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [fabOffset, setFabOffset] = useState({ x: 0, y: 0 });
  const [isFabDragging, setIsFabDragging] = useState(false);
  const fabDragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLongPressedRef = useRef(false);

  const handleFabDragStart = (e: React.PointerEvent) => {
    hasLongPressedRef.current = false;
    fabDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: fabOffset.x,
      initY: fabOffset.y
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    longPressTimerRef.current = setTimeout(() => {
      if ((currentMode === 'explore' || currentMode === 'demo') && !mapboxRouteGeoJSON && !isFreeWalk && !selectedMerchant && !isPlantingMode) {
        hasLongPressedRef.current = true;
        setIsFreeWalk(true);
        setWalkedDistanceKm(0);
        setShowNavPrompt(false);
      }
    }, 600);
  };

  const handleFabDragMove = (e: React.PointerEvent) => {
    if (!fabDragRef.current) return;
    
    // Only set dragging if we've moved a bit
    if (!isFabDragging && (Math.abs(e.clientX - fabDragRef.current.startX) > 3 || Math.abs(e.clientY - fabDragRef.current.startY) > 3)) {
      setIsFabDragging(true);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
    
    const dx = e.clientX - fabDragRef.current.startX;
    const dy = e.clientY - fabDragRef.current.startY;
    setFabOffset({
      x: fabDragRef.current.initX + dx,
      y: fabDragRef.current.initY + dy
    });
  };

  const handleFabDragEnd = (e: React.PointerEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (fabDragRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      fabDragRef.current = null;
      setTimeout(() => setIsFabDragging(false), 50);
    }
  };

  const handleFabClick = () => {
    if (hasLongPressedRef.current) return;
    if (!isFabDragging) {
      setIsFabOpen(!isFabOpen);
      setShowFabTooltip(false);
      if (typeof window !== 'undefined') sessionStorage.setItem('seen_fab_tooltip', 'true');
    }
  };

  const [viewState, setViewState] = useState<ViewState>({
    longitude: 103.6400,
    latitude: 1.5600,
    zoom: 15,
    pitch: 45,
    bearing: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleTakeDownIssue = async () => {
    if (!activeIssue) return;
    setIsTakingDownIssue(true);
    try {
      await apiClient(`/authorities/issues/${activeIssue.id}/take-down`, {
        method: 'POST'
      });

      const removedId = activeIssue.id;
      setActiveIssue(null);
      setShowTakeDownConfirm(false);
      setIssues(issues.filter(i => i.id !== removedId));
      showToast('Issue taken down. Notification sent to user mailbox.');
    } catch (err: any) {
      console.error('Failed to take down issue:', err);
      showToast(err.message || 'Failed to take down issue');
    } finally {
      setIsTakingDownIssue(false);
    }
  };
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSignpostModal, setShowSignpostModal] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [merchantStoreFilter, setMerchantStoreFilter] = useState<string | null>(null);
  const [publicProfileUser, setPublicProfileUser] = useState<any | null>(null);
  const { user, role } = useAuthStore();
  const isAuthority = role === 'authority';
  const effectiveFilter = isAuthority ? 'issues' : mapFilter;

  const {
    currentCoordinate,
    walkedDistanceKm,
    setWalkedDistanceKm,
    isFreeWalk,
    setIsFreeWalk,
    bearing
  } = useMapGeolocation();

  // Fetch map data via API Polling
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const [data, merchantsRes] = await Promise.all([
          apiClient('/map-data'),
          apiClient('/merchants')
        ]);
        
        // Our backend returns { lng, lat }, we need to map it to { location: [lng, lat] } for the frontend
        const formattedTrees = data.trees.map((t: any) => ({
          ...t,
          location: [t.lng, t.lat],
          plantedAt: t.planted_at,
          authorId: t.author_id,
          guildId: t.guild_id
        }));
        const formattedSignposts = data.signposts.map((s: any) => {
          let likedByArr = [];
          try { likedByArr = JSON.parse(s.liked_by || '[]'); } catch (e) {}
          return {
            ...s,
            location: [s.lng, s.lat],
            authorId: s.author_id,
            createdAt: s.created_at,
            expiresAt: s.expires_at,
            likedBy: likedByArr
          };
        });
        setTrees(formattedTrees);
        setSignposts(formattedSignposts);
        
        if (merchantsRes.merchants) {
          const formattedMerchants = merchantsRes.merchants.map((m: any, idx: number) => {
             let loc = [103.6400 + (idx * 0.002), 1.5600 + (idx * 0.002)]; // fallback if null
             try { if (m.location) loc = JSON.parse(m.location); } catch(e) {}
             return {
               ...m,
               location: loc,
               icon: '🏪',
               offers: m.store_name
             };
          });
          setMerchants(formattedMerchants);
        }
      } catch (err) {
        console.error('Failed to fetch map data:', err);
      }
    };
    
    fetchMapData();
  }, [setSignposts, setTrees, setMerchants]);

  // Fetch issues bounded by map viewport
  const fetchIssues = async (mapInstance: any) => {
    if (!mapInstance) return;
    try {
      const bounds = mapInstance.getBounds();
      const res = await apiClient(`/issues?minLat=${bounds.getSouth()}&maxLat=${bounds.getNorth()}&minLng=${bounds.getWest()}&maxLng=${bounds.getEast()}`);
      if (res.issues) {
        setIssues(res.issues);
      }
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    }
  };

  // Initial fetch on map load
  useEffect(() => {
    if (mapRef.current) fetchIssues(mapRef.current);
  }, [mapRef.current]);

  // Handle flyToLocation state changes
  useEffect(() => {
    if (flyToLocation) {
      setViewState(prev => ({
        ...prev,
        longitude: flyToLocation[0],
        latitude: flyToLocation[1],
        zoom: 16
      }));
      setIsFreeWalk(false);
      setFlyToLocation(null);
    }
  }, [flyToLocation, setFlyToLocation, setIsFreeWalk]);

  useEffect(() => {
    if (showNavPrompt && currentMode === 'explore') {
      const timer = setTimeout(() => setShowNavPrompt(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [showNavPrompt, currentMode]);

  // Auto-follow user during active navigation or Free Walk
  useEffect(() => {
    if (((currentMode === 'explore' || currentMode === 'demo') && distanceToTarget !== null && mapboxRouteGeoJSON) || isFreeWalk) {
      setViewState(prev => ({
        ...prev,
        longitude: currentCoordinate[0],
        latitude: currentCoordinate[1],
        zoom: 20,
        pitch: 65,
        bearing: bearing !== null ? bearing : prev.bearing,
      }));
    }
  }, [currentCoordinate, currentMode, distanceToTarget, mapboxRouteGeoJSON, isFreeWalk, bearing]);

  // Active route line up to current progress (Demo Mode visual flair)
  const demoActiveRouteGeoJSON = useMemo(() => {
    if (!mapboxRouteGeoJSON) return null;
    const coords = mapboxRouteGeoJSON.geometry.coordinates;
    if (!coords || coords.length === 0) return null;
    
    if (demoProgress === 0) {
      return {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: [coords[0], coords[0]] }
      };
    }
    if (demoProgress >= 100) {
      return mapboxRouteGeoJSON;
    }

    const line = turf.lineString(coords);
    const startPoint = turf.point(coords[0]);
    const endPoint = turf.point(currentCoordinate);
    
    const sliced = turf.lineSlice(startPoint, endPoint, line);

    return {
      type: 'Feature' as const,
      properties: {},
      geometry: sliced.geometry
    };
  }, [demoProgress, currentCoordinate, mapboxRouteGeoJSON]);

  const activeRouteData = currentMode === 'demo' ? demoActiveRouteGeoJSON : mapboxRouteGeoJSON;

  const backgroundRouteGeoJSON = useMemo(() => {
    if (currentMode === 'demo' && mapboxRouteGeoJSON) return mapboxRouteGeoJSON;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: [] }
    };
  }, [currentMode, mapboxRouteGeoJSON]);

  // Update map center when in demo mode OR when live location changes for the first time
  const hasCentered = useRef(false);
  useEffect(() => {
    if (currentMode === 'demo') {
      setViewState((prev) => ({
        ...prev,
        longitude: currentCoordinate[0],
        latitude: currentCoordinate[1]
      }));
    } else if (currentMode === 'explore' && liveLocation && !hasCentered.current) {
      hasCentered.current = true;
      if (!flyToLocation) {
        setViewState((prev) => ({
          ...prev,
          longitude: currentCoordinate[0],
          latitude: currentCoordinate[1]
        }));
      }
    }
  }, [currentCoordinate, currentMode, liveLocation, flyToLocation]);

  const handleMerchantClick = (m: any) => {
    if (mapboxRouteGeoJSON) return;
    setSelectedMerchant(m);
    setActiveRouteGeoJSON(null);
    setDistanceToTarget(null);
  };

  const handleStartNavigation = async () => {
    if (selectedMerchant && selectedMerchant.location) {
      const startLoc: [number, number] = liveLocation || [101.6869, 3.1390]; // KL CC fallback
      const targetCoords: [number, number] = selectedMerchant.location;
      const res = await getWalkingRoute(startLoc, targetCoords);
      if (res) {
        setActiveRouteGeoJSON({ type: 'Feature', properties: {}, geometry: res.geoJson });
        setDistanceToTarget(parseFloat(res.distanceKm));
        
        if (currentMode === 'demo') {
          useDemoStore.getState().setProgress(0);
          useDemoStore.getState().setIsAutoPlaying(true);
        } else {
          // Auto-unlock if close enough (< 50 meters) and it's a real merchant (has offers)
          const distMeters = getDistanceMeters(startLoc, targetCoords);
          if (distMeters < 50 && selectedMerchant.offers) {
            setShowReportModal(true);
          }
        }
      }
    }
  };

  const handleMapClick = async (e: any) => {
    if (isPlantingMode) {
      if (!user) {
        alert("Please login to plant a tree!");
        setIsPlantingMode(false);
        return;
      }
      if (userCoins >= 100) {
        deductCoins(100);
        
        // Optimistic UI Update
        const newTree = {
          id: `temp-tree-${Date.now()}`,
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          location: [e.lngLat.lng, e.lngLat.lat],
          authorId: user.uid,
          guildId: guildId || 'None',
          guildName: guildName || 'None',
          plantedAt: Date.now()
        };
        setTrees(prev => [...prev, newTree]);

        try {
          await apiClient('/trees', {
            method: 'POST',
            body: JSON.stringify({
              authorId: user.uid,
              lng: e.lngLat.lng,
              lat: e.lngLat.lat,
              guildId: guildId || 'None'
            })
          });
          // Optimistically update trees array or just wait for the poll
        } catch (error) {
          console.error("Failed to plant tree", error);
        }
        setIsPlantingMode(false);
      } else {
        alert("Not enough Eco-Coins to plant a tree! Walk more to save CO2.");
        setIsPlantingMode(false);
      }
      return;
    }

    setActiveSignpost(null);
    setActiveTree(null);

    if (mapboxRouteGeoJSON) return;

    const customDest = {
      id: 'custom-destination',
      storeName: 'Custom Destination',
      category: 'Pinned Location',
      location: [e.lngLat.lng, e.lngLat.lat]
    };
    setSelectedMerchant(customDest);
    setActiveRouteGeoJSON(null);
    setDistanceToTarget(null);
  };

  const handleLikeSignpost = async (e: React.MouseEvent, sp: any) => {
    e.stopPropagation();
    if (!user) {
      alert("Please login to give Eco Energy!");
      return;
    }
    const likedByArray = sp.likedBy || [];
    if (likedByArray.includes(user.uid)) {
      // Quietly return if already liked (animation will still play in UI)
      return;
    }
    
    // Optimistic UI update
    const prevLikes = sp.likes;
    sp.likes = (sp.likes || 0) + 1;
    if (!sp.likedBy) sp.likedBy = [];
    sp.likedBy.push(user.uid);
    setSignposts([...signposts]); // Trigger re-render

    try {
      await apiClient(`/signposts/${sp.id}/like`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.uid })
      });
    } catch (err) {
      console.error('Failed to like signpost:', err);
      // Revert optimistic update on fail
      sp.likes = prevLikes;
      sp.likedBy = sp.likedBy.filter((id: string) => id !== user.uid);
      setSignposts([...signposts]);
    }
  };

  // Fetch autocomplete results from Mapbox
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const proximity = `${viewState.longitude},${viewState.latitude}`;
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?proximity=${proximity}&country=MY&access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`);
        const data = await res.json();
        setSearchResults(data.features || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, viewState.longitude, viewState.latitude, currentMode]);

  const handleDeleteSignpost = async (id: string) => {
    try {
      await apiClient(`/signposts/${id}`, { method: 'DELETE' });
      setSignposts(signposts.filter((s: any) => s.id !== id));
      setActiveSignpost(null);
      showToast('Signpost deleted.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete signpost');
    }
  };

  const handleSelectSearchResult = (feature: any) => {
    const [lng, lat] = feature.center;
    const placeName = feature.text;
    
    setViewState((prev) => ({ ...prev, longitude: lng, latitude: lat, zoom: 16 }));
    
    const customDest = {
      id: 'custom-destination',
      storeName: placeName,
      category: feature.place_name || 'Searched Location',
      location: [lng, lat]
    };
    setSelectedMerchant(customDest);
    setActiveRouteGeoJSON(null);
    setDistanceToTarget(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleUserSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      handleSelectSearchResult(searchResults[0]);
    }
  };

  const handleDeleteTree = async (treeId: string) => {
    try {
      setTrees(prev => prev.filter(t => t.id !== treeId));
      addCoins(100); // Refund optimistically
      setActiveTree(null);
      await apiClient(`/trees/${treeId}`, { method: 'DELETE' });
    } catch (err) {
      console.error("Failed to delete tree", err);
    }
  };

  useEffect(() => {
    if (location.state?.flyToSignpost) {
      const { lat, lng, id } = location.state.flyToSignpost;
      setFlyToLocation([lng, lat]);
      
      const checkAndOpen = setInterval(() => {
        const found = signposts.find((s: any) => s.id === id);
        if (found) {
          setActiveSignpost(found);
          clearInterval(checkAndOpen);
        }
      }, 500);
      
      setTimeout(() => clearInterval(checkAndOpen), 5000);
      
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.flyToSignpost, signposts]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-100">
      {/* User Search Bar */}
      {!isAuthority && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[200] w-11/12 max-w-sm">
          <div className="relative">
            <form onSubmit={handleUserSearch} className="flex items-center gap-2 glass-pill p-1.5 transition-all focus-within:-translate-y-1 relative z-50">
              <div className="relative">
                <button 
                  type="button" 
                  onClick={() => {
                    setActiveView('landing');
                    if (typeof window !== 'undefined') sessionStorage.setItem('seen_map_home_tooltip', 'true');
                    setShowMapHomeTooltip(false);
                  }} 
                  className="bg-white/50 text-[#1d3539] p-2 rounded-full border border-white/60 hover:bg-white/80 transition-colors shrink-0 relative z-10"
                >
                  <Home size={18} />
                </button>
                {showMapHomeTooltip && (
                  <div className="absolute top-12 left-0 bg-[#5496a2] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg w-36 text-center animate-bounce pointer-events-auto z-50">
                    <div className="absolute -top-1.5 left-4 w-3 h-3 bg-[#5496a2] rotate-45"></div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMapHomeTooltip(false);
                        if (typeof window !== 'undefined') sessionStorage.setItem('seen_map_home_tooltip', 'true');
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-[#1d3539] rounded-full flex items-center justify-center border border-[#5496a2] shadow-sm hover:scale-110 active:scale-95 transition-transform"
                    >
                      <X size={12} strokeWidth={3} className="text-white"/>
                    </button>
                    Back to Home
                  </div>
                )}
              </div>
              <input 
                type="text" 
                placeholder="Search destination..." 
                className="flex-1 bg-transparent px-2 font-bold text-[#1d3539] focus:outline-none min-w-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="bg-[#5496a2]/80 backdrop-blur-sm text-white p-2 rounded-full border border-white/40 hover:bg-[#5496a2] transition-colors">
                {isSearching ? '⏳' : '🔍'}
              </button>
            </form>
            
            {/* Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-12 left-0 w-full glass-card mt-2 overflow-hidden z-40 flex flex-col animate-in slide-in-from-top-2">
                {searchResults.map((feature, index) => (
                  <button
                    key={feature.id || index}
                    onClick={() => handleSelectSearchResult(feature)}
                    className="flex flex-col text-left px-4 py-3 hover:bg-white/40 border-b border-white/20 last:border-b-0 transition-colors"
                  >
                    <span className="font-bold text-slate-900 truncate">{feature.text}</span>
                    <span className="text-xs text-slate-500 truncate">{feature.place_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onMoveEnd={(evt) => fetchIssues(evt.target)}
        onClick={handleMapClick}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        attributionControl={false}
      >
        {/* Background Route */}
        <Source id="route-bg" type="geojson" data={backgroundRouteGeoJSON}>
          <Layer
            id="route-bg-line"
            type="line"
            paint={{
              'line-color': '#94a3b8',
              'line-width': 4,
              'line-dasharray': [1, 2]
            }}
          />
        </Source>

        {/* Active Route */}
        {activeRouteData && (
          <Source id="route-active" type="geojson" data={activeRouteData}>
            <Layer
              id="route-active-line"
              type="line"
              paint={{
                'line-color': '#86efac',
                'line-width': 8
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round'
              }}
            />
            <Layer
              id="route-active-outline"
              type="line"
              paint={{
                'line-color': '#0f172a',
                'line-width': 12,
                'line-opacity': 0.3,
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round'
              }}
              beforeId="route-active-line"
            />
          </Source>
        )}

        {/* Reported Issues */}
        {(effectiveFilter === 'all' || effectiveFilter === 'issues') && issues.filter(issue => issue.status !== 'resolved').map((issue) => (
          <Marker 
            key={issue.id} 
            longitude={issue.lng} 
            latitude={issue.lat} 
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setActiveIssue(issue);
            }}
          >
            <div className="text-3xl cursor-pointer hover:scale-110 transition-transform">
              🚨
            </div>
          </Marker>
        ))}

        {/* Issue Popup */}
        {activeIssue && (
          <Popup
            longitude={activeIssue.lng}
            latitude={activeIssue.lat}
            anchor="top"
            closeButton={false}
            closeOnClick={true}
            onClose={() => setActiveIssue(null)}
            offset={[0, 10]}
            className="signpost-story-popup z-50"
          >
            {(() => {
              let imgs: string[] = [];
              try {
                imgs = typeof activeIssue.photos === 'string' ? JSON.parse(activeIssue.photos) : (activeIssue.photos || []);
              } catch(e) {}
              const hasImage = imgs.length > 0;
              const isOwner = user?.uid === activeIssue.author_id;

              const nextImage = (e: React.MouseEvent) => {
                e.stopPropagation();
                setActiveIssueImageIndex((prev) => (prev + 1) % imgs.length);
              };
              
              const prevImage = (e: React.MouseEvent) => {
                e.stopPropagation();
                setActiveIssueImageIndex((prev) => (prev - 1 + imgs.length) % imgs.length);
              };

              return (
                <div className="glass-card p-4 rounded-[28px] flex flex-col gap-3 w-[360px] relative mt-2">
                  {/* Top: Image */}
                  <div className="w-full relative group">
                    {hasImage ? (
                      <>
                        <img src={imgs[activeIssueImageIndex]} alt="Issue preview" className="w-full h-64 object-cover rounded-[20px] shadow-sm" />
                        {imgs.length > 1 && (
                          <>
                            <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-transparent rounded-full flex items-center justify-center text-white hover:bg-black/20 transition-colors drop-shadow-md">
                              <ChevronLeft size={24} className="-ml-0.5 drop-shadow" />
                            </button>
                            <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-transparent rounded-full flex items-center justify-center text-white hover:bg-black/20 transition-colors drop-shadow-md">
                              <ChevronRight size={24} className="-mr-0.5 drop-shadow" />
                            </button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-medium pointer-events-none">
                              {activeIssueImageIndex + 1} / {imgs.length}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-64 bg-slate-100/50 rounded-[20px] flex items-center justify-center text-slate-500 shadow-inner border border-white/40">
                        No Image
                      </div>
                    )}
                  </div>
                  
                  {/* Title */}
                  <h3 className="font-bold text-slate-900 text-[22px] leading-tight px-1 mt-1">{activeIssue.title}</h3>
                  
                  {/* Description */}
                  {activeIssue.description && (
                    <div className="flex items-start gap-2 text-slate-800 px-1">
                      <span className="text-[15px] font-medium leading-snug line-clamp-3">
                        {activeIssue.description}
                      </span>
                    </div>
                  )}

                  {/* Official Authority Response if present */}
                  {activeIssue.authority_response && (
                    <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 mx-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                        <ShieldCheck size={14} className="text-emerald-600 flex-shrink-0" />
                        <span>Official Authority Response</span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        {activeIssue.authority_response}
                      </p>
                    </div>
                  )}
                  
                  {/* Footer */}
                  <div className="flex items-center justify-between mt-1 px-1">
                    <div className="flex items-center gap-2">
                      <div className={`px-3 py-1.5 rounded-xl font-bold text-xs tracking-wide ${
                        activeIssue.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                        activeIssue.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {activeIssue.status === 'pending' ? 'PENDING' : activeIssue.status.toUpperCase()}
                      </div>

                      {/* Take Down Button (Only on authority map) */}
                      {isAuthority && !showTakeDownConfirm && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTakeDownConfirm(true);
                          }}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Take down this issue due to incorrect location"
                        >
                          <Trash2 size={13} />
                          <span>Take Down</span>
                        </button>
                      )}
                    </div>

                    {isOwner && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowShareIssueModal(true); }}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors shadow-sm border border-slate-200"
                        title="Share to Community"
                      >
                        <Send size={16} />
                      </button>
                    )}
                  </div>

                  {/* Authority Take Down Confirmation Box */}
                  {isAuthority && showTakeDownConfirm && (
                    <div className="mt-2 p-3 bg-red-50/95 border border-red-200 rounded-2xl flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-red-900 leading-tight">Take Down Issue Report?</p>
                          <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
                            This will remove the issue from the map and send an official notification to the reporter's mailbox stating that the assigned location is incorrect.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-1 pt-2 border-t border-red-200/60">
                        <button
                          onClick={() => setShowTakeDownConfirm(false)}
                          disabled={isTakingDownIssue}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleTakeDownIssue}
                          disabled={isTakingDownIssue}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                        >
                          {isTakingDownIssue ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          <span>Confirm Take Down</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </Popup>
        )}

        {/* Real Signposts */}
        {!isAuthority && mapDisplayMode === 'normal' && signposts.map((sp) => (
          <Marker 
            key={sp.id} 
            longitude={sp.location[0]} 
            latitude={sp.location[1]} 
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setActiveSignpost(sp);
            }}
            style={{ zIndex: activeSignpost?.id === sp.id ? 10 : 1 }}
          >
            <div className="relative flex flex-col items-center group animate-in zoom-in-95 duration-200">
              {/* Hover Username Pill */}
              <div className="absolute -top-6 whitespace-nowrap bg-white/90 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-800 shadow-sm border border-slate-200 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                {sp.authorUsername || sp.authorEmail || 'Guest'}
              </div>
              {/* Original Marker Icon */}
              <div className="bg-white px-2 py-1 rounded-t-xl rounded-br-xl border-2 border-slate-900 shadow-comic cursor-pointer group-hover:-translate-y-1 transition-transform">
                <span className="text-xl">{sp.emoji}</span>
              </div>
            </div>
          </Marker>
        ))}

        {/* Signpost Popup */}
        {!isAuthority && activeSignpost && (
          <Popup
            longitude={activeSignpost.location[0]}
            latitude={activeSignpost.location[1]}
            anchor="bottom"
            onClose={() => setActiveSignpost(null)}
            closeButton={false}
            className={`z-50 ${(() => {
              try {
                const imgs = typeof activeSignpost.images === 'string' ? JSON.parse(activeSignpost.images) : (activeSignpost.images || []);
                if (imgs.length > 0) return 'signpost-story-popup hidden sm:block';
              } catch(e) {}
              return '';
            })()}`}
            offset={[0, -40]}
          >
            {(() => {
              let imgs: string[] = [];
              try {
                imgs = typeof activeSignpost.images === 'string' ? JSON.parse(activeSignpost.images) : (activeSignpost.images || []);
              } catch(e) {}

              if (imgs.length > 0) {
                // IG STORY STYLE
                return (
                  <SignpostStoryViewer 
                    signpost={activeSignpost}
                    images={imgs}
                    onClose={() => setActiveSignpost(null)}
                    onLike={handleLikeSignpost}
                    onViewProfile={(authorId, username) => setPublicProfileUser({ id: authorId, username })}
                    onFullScreen={(img) => setFullScreenImage(img)}
                    onDelete={handleDeleteSignpost}
                    onShare={() => setShowShareModal(true)}
                    isPausedExternal={showShareModal}
                  />
                );
              }

              // STANDARD STYLE (No images)
              return (
                <div className="bg-white border-2 border-slate-900 shadow-comic p-3 rounded-2xl flex flex-col gap-2 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl bg-slate-100 p-1.5 rounded-xl border border-slate-300">{activeSignpost.emoji}</span>
                    <div className="flex-1">
                      <p 
                        className="text-xs text-[#5496a2] font-bold truncate max-w-[120px] cursor-pointer hover:underline"
                        onClick={() => setPublicProfileUser({ id: activeSignpost.authorId, username: activeSignpost.authorUsername || activeSignpost.authorEmail || 'Guest' })}
                      >
                        {activeSignpost.authorUsername || activeSignpost.authorEmail || 'Guest'}
                      </p>
                      <p className="text-sm font-black text-slate-900">{activeSignpost.message}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => handleLikeSignpost(e, activeSignpost)}
                    className="w-full bg-brand-yellow hover:bg-yellow-400 border-2 border-slate-900 rounded-xl py-1.5 font-bold text-slate-900 text-sm transition-colors flex items-center justify-center gap-1 active:scale-95"
                  >
                    👍 +1 Eco Energy <span className="bg-white px-1.5 rounded-full border border-slate-900 text-xs ml-1 font-black">{activeSignpost.likes || 0}</span>
                  </button>
                </div>
              );
            })()}
          </Popup>
        )}

        {/* Real Merchants from Firestore */}
        {!isAuthority && merchants.map((m) => (
          <Marker 
            key={m.id} 
            longitude={m.location[0]} 
            latitude={m.location[1]} 
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMerchantClick(m);
            }}
            style={{ zIndex: selectedMerchant?.id === m.id ? 10 : 1 }}
          >
            <div className={`w-12 h-12 rounded-full border-2 border-[#1d3539] shadow-[0_4px_12px_rgba(0,0,0,0.15)] flex items-center justify-center text-2xl cursor-pointer transition-all ${selectedMerchant?.id === m.id ? 'bg-[#fff4d6] animate-bounce scale-110' : 'bg-white hover:bg-[#e9efce]'}`}>
              {m.icon || '🏪'}
            </div>
            {m.offers && (
              <div className="absolute top-[-36px] left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#5496a2] text-white text-xs font-black px-3 py-1.5 rounded-xl border border-[#1d3539] shadow-md z-10">
                {m.offers}
              </div>
            )}
          </Marker>
        ))}

        {/* Custom Pinned Destination */}
        {!isAuthority && selectedMerchant?.id === 'custom-destination' && (
          <Marker longitude={selectedMerchant.location[0]} latitude={selectedMerchant.location[1]} anchor="bottom">
            <div className="text-4xl animate-bounce">📍</div>
          </Marker>
        )}

        {/* Planted Trees */}
        {!isAuthority && (mapDisplayMode === 'guild' || mapDisplayMode === 'my_guild') && trees
          .filter(tree => mapDisplayMode === 'my_guild' ? tree.guildId === guildId : true)
          .map((tree) => (
          <Marker 
            key={tree.id} 
            longitude={tree.location[0]} 
            latitude={tree.location[1]} 
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setActiveTree(tree);
            }}
          >
            <div className="relative group cursor-pointer animate-in zoom-in-50 spring duration-500">
              <div className="text-4xl">🌲</div>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-brand-green text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-slate-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                {tree.guildName || 'None'}
              </div>
            </div>
          </Marker>
        ))}

        {/* Tree Popup */}
        {!isAuthority && activeTree && (
          <Popup
            longitude={activeTree.location[0]}
            latitude={activeTree.location[1]}
            anchor="bottom"
            onClose={() => setActiveTree(null)}
            closeButton={false}
            className="z-50"
            offset={[0, -40]}
          >
            <div className="bg-white border-2 border-slate-900 shadow-comic px-3 py-2 rounded-xl flex flex-col gap-1 min-w-[120px] text-center">
              <p className="text-xs font-black text-slate-900">{activeTree.guildName || 'None'}</p>
              {user && user.uid === activeTree.authorId && (Date.now() - activeTree.plantedAt < 5 * 60 * 1000) ? (
                <button 
                  onClick={() => handleDeleteTree(activeTree.id)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded-lg text-[10px]"
                >
                  Recall (Refund 100)
                </button>
              ) : (
                <p className="text-[10px] text-slate-500 leading-tight">Territory Tree</p>
              )}
            </div>
          </Popup>
        )}

        {/* Player Avatar */}
        {!isAuthority && (
        <Marker longitude={currentCoordinate[0]} latitude={currentCoordinate[1]} anchor="center" style={{ transition: 'all 50ms linear' }}>
          <div className="relative flex items-center justify-center">
            <div className="w-5 h-5 bg-[#5496a2] border-[3px] border-[#1d3539] rounded-full shadow-lg z-10 relative"></div>
            {currentMode === 'demo' && demoProgress > 0 && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-[#5496a2] rounded-full opacity-30 animate-ping"></div>
            )}
            {(currentMode === 'explore' || currentMode === 'demo') && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-[#5496a2] rounded-full opacity-30 animate-ping"></div>
            )}
          </div>
        </Marker>
        )}

      </Map>

      {/* Navigation Prompt */}
      {!isAuthority && showNavPrompt && liveLocation && !activeRouteData && !selectedMerchant && !isPlantingMode && !isFreeWalk && (
        <div className="absolute top-1/2 sm:top-24 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-y-0 bg-[#fff4d6] border-2 border-[#1d3539] shadow-[4px_4px_0px_0px_#1d3539] px-6 py-3 rounded-full flex items-center justify-center gap-3 z-[80] animate-bounce w-[90%] sm:w-auto text-center pointer-events-auto">
          <p className="text-sm font-black text-[#1d3539]">Click anywhere to navigate, or long press 🍃 for Free Walk!</p>
          <button 
            onClick={() => setShowNavPromptConfirm(true)} 
            className="absolute -top-2 -right-2 bg-white text-[#1d3539] w-7 h-7 rounded-full text-sm font-black border-2 border-[#1d3539] shadow-sm hover:scale-110 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hide Navigation Instruction Confirm Modal */}
      {!isAuthority && showNavPromptConfirm && (
        <div className="fixed inset-0 z-[200] bg-[#1d3539]/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#fff4d6] border-2 border-[#1d3539] rounded-[2rem] p-6 max-w-sm w-full shadow-[8px_8px_0px_0px_#1d3539] text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-[#1d3539] uppercase tracking-wider mb-2">Hide Instruction?</h3>
            <p className="text-sm font-bold text-[#1d3539]/70 mb-6">Do you want to permanently hide this navigation tip?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowNavPromptConfirm(false)}
                className="flex-1 py-3 bg-white border-2 border-[#1d3539] text-[#1d3539] font-black rounded-xl hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(29,53,57,0.2)] transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowNavPrompt(false);
                  setShowNavPromptConfirm(false);
                  if (typeof window !== 'undefined') sessionStorage.setItem('hide_nav_instruction', 'true');
                }}
                className="flex-1 py-3 bg-[#5496a2] border-2 border-[#1d3539] text-white font-black rounded-xl hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#1d3539] transition-all"
              >
                Don't Show
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Radial FAB (Frosted Glass) */}
      {!isAuthority && (
      <div 
        className={`absolute right-8 flex flex-col items-center justify-end z-50 touch-none ${isFabDragging ? '' : 'transition-all duration-300 ease-in-out'} ${isFreeWalk || mapboxRouteGeoJSON ? 'bottom-[220px]' : 'bottom-32'}`}
        style={{ transform: `translate(${fabOffset.x}px, ${fabOffset.y}px)` }}
      >
        
        {/* Expanded Options */}
        <div className={`flex flex-col items-center gap-4 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isFabOpen ? 'opacity-100 translate-y-0 mb-4' : 'opacity-0 translate-y-10 pointer-events-none mb-0'}`}>
          
          {/* My Location Option */}
          <div className="relative group">
            <button 
              onClick={() => {
                if (liveLocation) {
                  setViewState(prev => ({
                    ...prev,
                    longitude: liveLocation[0],
                    latitude: liveLocation[1],
                    zoom: 16
                  }));
                } else {
                  showToast('Waiting for GPS signal...');
                }
                setIsFabOpen(false);
              }}
              className="w-14 h-14 glass-pill flex items-center justify-center text-2xl hover:scale-110 hover:-translate-y-1 transition-all active:scale-95"
            >
              🧭
            </button>
            <div className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              My Location
            </div>
          </div>

          {/* Drop Signpost Option */}
          <div className="relative group">
            <button 
              onClick={() => {
                setShowSignpostModal(true);
                setIsFabOpen(false);
              }}
              className="w-14 h-14 glass-pill flex items-center justify-center text-2xl hover:scale-110 hover:-translate-y-1 transition-all active:scale-95"
            >
              📍
            </button>
            <div className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              Drop Signpost
            </div>
          </div>
          
          {/* Report Issue Option */}
          <div className="relative group">
            <button 
              onClick={() => {
                setShowCreateIssueModal(true);
                setIsFabOpen(false);
              }}
              className="w-14 h-14 bg-red-100/90 backdrop-blur-md shadow-lg border border-red-200 rounded-full flex items-center justify-center text-2xl hover:scale-110 hover:-translate-y-1 transition-all active:scale-95"
            >
              🚨
            </button>
            <div className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap bg-white text-slate-900 border border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] text-xs font-black px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
              Report Issue
            </div>
          </div>

          {/* Plant Tree Option */}
          <div className="relative group">
            <button 
              onClick={() => {
                setIsPlantingMode(true);
                setIsFabOpen(false);
              }}
              className="w-14 h-14 glass-pill flex items-center justify-center text-2xl hover:scale-110 hover:-translate-y-1 transition-all active:scale-95"
            >
              🌳
            </button>
            <div className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap bg-white text-slate-900 border border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] text-xs font-black px-3 py-1.5 rounded-xl flex flex-col items-end opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Plant Tree for {(user as any)?.guildId && (user as any).guildId !== 'None' ? (user as any).guildId : 'Your Guild'}</span>
              <span className="text-[10px] text-brand-green font-bold flex items-center gap-1 mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>100 Coins</span>
            </div>
          </div>
        </div>

        {/* Main Dreamy Leaf FAB */}
        <div className="relative">
          <button 
            onPointerDown={handleFabDragStart}
            onPointerMove={handleFabDragMove}
            onPointerUp={handleFabDragEnd}
            onPointerCancel={handleFabDragEnd}
            onClick={handleFabClick}
            className={`w-16 h-16 rounded-full bg-gradient-to-br from-white/80 via-emerald-50/70 to-teal-100/60 backdrop-blur-xl border border-white/60 flex items-center justify-center transition-all duration-500 hover:scale-105 hover:bg-white/90 hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] active:scale-95 z-10 relative cursor-grab active:cursor-grabbing ${isFabOpen ? 'shadow-[0_0_40px_rgba(52,211,153,0.6)] rotate-180' : 'shadow-[0_8px_32px_rgba(15,23,42,0.12),inset_0_2px_4px_rgba(255,255,255,0.8)]'}`}
          >
            <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-tr from-emerald-400 to-teal-300 shadow-[inset_0_-2px_6px_rgba(0,0,0,0.1),0_4px_10px_rgba(52,211,153,0.4)] flex items-center justify-center text-white overflow-hidden relative">
              <div className={`absolute transition-all duration-500 ease-in-out ${isFabOpen ? 'scale-0 opacity-0 rotate-90' : 'scale-100 opacity-100 rotate-0'}`}>
                <Leaf size={24} strokeWidth={2.5} className="text-white drop-shadow-sm filter animate-[pulse_3s_ease-in-out_infinite]" />
              </div>
              <div className={`absolute transition-all duration-500 ease-in-out ${isFabOpen ? 'scale-100 opacity-100 rotate-180' : 'scale-0 opacity-0 -rotate-90'}`}>
                <X size={26} strokeWidth={2.5} className="text-white drop-shadow-sm" />
              </div>
            </div>
          </button>
          
          {/* Onboarding Tooltip for FAB */}
          {showFabTooltip && !isFabOpen && (
            <div className="absolute bottom-16 right-4 bg-[#5496a2] text-white text-xs font-black px-4 py-3 rounded-xl shadow-lg w-[170px] text-center animate-bounce z-50 pointer-events-auto leading-tight">
              <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-[#5496a2] rotate-45"></div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFabTooltip(false);
                  if (typeof window !== 'undefined') sessionStorage.setItem('seen_fab_tooltip', 'true');
                }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-[#1d3539] rounded-full flex items-center justify-center border border-[#5496a2] shadow-sm hover:scale-110 active:scale-95 transition-transform"
              >
                <X size={12} strokeWidth={3} className="text-white"/>
              </button>
              Tap for 📍, 🌳 & 🧭,<br/>Long Press for Free Walk!
            </div>
          )}
        </div>

        {/* Planting Mode Active Tooltip */}
        {isPlantingMode && (
          <div className="absolute top-1/2 right-20 -translate-y-1/2 bg-[#fff4d6] text-[#1d3539] border-2 border-[#1d3539] p-3 rounded-xl font-black text-sm shadow-[4px_4px_0px_0px_#1d3539] animate-pulse w-48 text-center pointer-events-auto">
            Click anywhere on the map to plant! 📍
            <div className="mt-2">
              <button onClick={() => setIsPlantingMode(false)} className="underline text-xs text-slate-600">Cancel</button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Merchant Confirmation Overlay */}
      {!isAuthority && selectedMerchant && !activeRouteData && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#fff4d6] border-2 border-[#80abb1] shadow-2xl p-6 rounded-3xl flex flex-col items-center gap-4 z-50 w-[340px] sm:w-[400px] text-center animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-auto">
          <button 
            onClick={(e) => { e.stopPropagation(); setSelectedMerchant(null); }} 
            className="absolute top-4 right-4 text-[#80abb1] hover:text-[#1d3539] transition-colors bg-white/50 backdrop-blur rounded-full p-2 hover:bg-white z-50 cursor-pointer"
          >
            <X size={20} strokeWidth={3} />
          </button>

          <div className="mt-2 w-full">
            <div className="w-20 h-20 bg-white border-2 border-[#5496a2] shadow-inner rounded-3xl mx-auto flex items-center justify-center text-4xl mb-4">
              {selectedMerchant.icon || '🏪'}
            </div>
            <h3 className="text-2xl font-black text-[#1d3539] leading-tight">{selectedMerchant.storeName}</h3>
            <p className="text-sm font-bold text-[#5496a2] uppercase tracking-widest mt-1">{selectedMerchant.category}</p>
            
            {selectedMerchant.offers && (
              <div className="bg-[#5496a2] text-white text-xs font-bold px-4 py-2 rounded-xl mt-4 inline-block shadow-sm uppercase tracking-wider">
                🎁 {selectedMerchant.offers}
              </div>
            )}
            
            {selectedMerchant.menuLink && (
              <div className="mt-5 bg-white/60 rounded-xl p-3 border border-white">
                <a href={selectedMerchant.menuLink} target="_blank" rel="noreferrer" className="text-[#5496a2] text-sm font-bold hover:text-[#1d3539] flex items-center justify-center gap-2">
                  View Menu / Details <ExternalLink size={16} />
                </a>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 w-full mt-3">
            <button onClick={() => setMerchantStoreFilter(selectedMerchant.owner_id)} className="flex-1 bg-[#fff4d6] border-2 border-[#80abb1] text-[#1d3539] font-black py-3 rounded-xl hover:bg-[#e9efce] hover:border-[#5496a2] transition-all uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              <Gift size={18} /> Vouchers
            </button>
            <button onClick={handleStartNavigation} className="flex-1 bg-[#5496a2] text-white font-black py-3 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              <MapPin size={18} /> Go Here
            </button>
          </div>
        </div>
      )}

      {/* Distance Overlay (Navigation Active) */}
      {!isAuthority && currentMode === 'explore' && distanceToTarget !== null && selectedMerchant && activeRouteData && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] sm:w-auto bg-white border-2 border-slate-900 shadow-comic px-4 sm:px-6 py-3 rounded-2xl sm:rounded-full flex items-center gap-3 sm:gap-4 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase leading-tight truncate">Navigating to:</p>
            <p className="text-sm sm:text-base font-black text-slate-900 truncate leading-tight">{selectedMerchant.storeName}</p>
            <p className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">{distanceToTarget} km <span className="text-[10px] sm:text-sm font-bold text-slate-500">remaining</span></p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-green rounded-full border-2 border-slate-900 flex items-center justify-center font-bold text-lg sm:text-xl animate-pulse shrink-0">
            🚶
          </div>
          <button 
            onClick={() => {
              setCompletedDistanceKm(walkedDistanceKm);
              setShowReportModal(true);
              setActiveRouteGeoJSON(null); 
              setDistanceToTarget(null);
              setWalkedDistanceKm(0);
            }} 
            className="ml-1 sm:ml-2 text-xs sm:text-sm font-black text-red-500 hover:text-red-700 underline shrink-0 bg-red-50 px-2 py-1.5 rounded-lg border border-red-200"
          >
            Stop
          </button>
        </div>
      )}

      {/* Free Walk Active Overlay */}
      {!isAuthority && isFreeWalk && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] sm:w-auto bg-white border-2 border-[#1d3539] shadow-[4px_4px_0px_0px_#1d3539] px-4 sm:px-6 py-3 rounded-2xl sm:rounded-3xl flex items-center gap-3 sm:gap-6 z-[90] animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex-1 min-w-0 flex gap-4 sm:gap-8 justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase leading-tight truncate">Distance</p>
              <p className="text-sm sm:text-lg font-black text-[#1d3539] truncate leading-tight">{walkedDistanceKm.toFixed(2)} <span className="text-xs">km</span></p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase leading-tight truncate">Saved</p>
              <p className="text-sm sm:text-lg font-black text-[#5496a2] truncate leading-tight">{(walkedDistanceKm / 5.88).toFixed(2)} <span className="text-xs">kg CO2</span></p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase leading-tight truncate">Energy</p>
              <p className="text-sm sm:text-lg font-black text-brand-pink truncate leading-tight">{Math.floor((walkedDistanceKm / 5.88) * 100)} <span className="text-xs">🪙</span></p>
            </div>
          </div>
          <button 
            onClick={() => { 
              setCompletedDistanceKm(walkedDistanceKm);
              setShowReportModal(true);
              setIsFreeWalk(false);
              setWalkedDistanceKm(0);
              // reset demo mode state if needed
              if (currentMode === 'demo') {
                useDemoStore.getState().setProgress(0);
                useDemoStore.getState().setIsAutoPlaying(false);
              }
            }} 
            className="ml-1 sm:ml-2 text-xs sm:text-sm font-black text-red-500 hover:text-red-700 uppercase px-4 py-2 rounded-2xl border-2 border-red-500 bg-red-50 hover:bg-red-100 transition-colors shrink-0 shadow-[2px_2px_0px_0px_rgba(239,68,68,1)] active:translate-y-0.5 active:shadow-none"
          >
            Stop
          </button>
        </div>
      )}

      {showSignpostModal && (
        <CreateSignpostModal 
          isOpen={showSignpostModal} 
          onClose={() => setShowSignpostModal(false)} 
          currentLocation={liveLocation}
        />
      )}

      {showCreateIssueModal && (
        <CreateIssueModal
          isOpen={showCreateIssueModal}
          onClose={() => setShowCreateIssueModal(false)}
          currentLocation={liveLocation}
          onSuccess={() => {
            if (mapRef.current) fetchIssues(mapRef.current);
          }}
        />
      )}

      {showShareIssueModal && activeIssue && (
        <ShareIssueModal
          issueId={activeIssue.id}
          isOpen={showShareIssueModal}
          onClose={() => setShowShareIssueModal(false)}
        />
      )}

      {/* Points Store Modal Filtered */}
      {merchantStoreFilter && (
        <PointsStoreModal 
          merchantFilter={merchantStoreFilter} 
          onClose={() => setMerchantStoreFilter(null)} 
        />
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[500] animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 px-4 py-2 rounded-full shadow-lg text-sm font-bold backdrop-blur-sm">
            {toastMsg}
          </div>
        </div>
      )}

      {/* Floating Left Widget */}
      {!isAuthority && <DraggableMapWidget />}
      {/* Full Screen Image Modal */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFullScreenImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white bg-white/20 hover:bg-white/40 p-2 rounded-full"
            onClick={() => setFullScreenImage(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={fullScreenImage} 
            alt="Full size signpost" 
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Mobile Full Screen Story Viewer */}
      {activeSignpost && (
        <div className="sm:hidden">
          {(() => {
            let imgs: string[] = [];
            try {
              imgs = typeof activeSignpost.images === 'string' ? JSON.parse(activeSignpost.images) : (activeSignpost.images || []);
            } catch(e) {}
            if (imgs.length > 0) {
              return (
                <div className="fixed inset-0 z-[400] bg-black">
                  <SignpostStoryViewer 
                    signpost={activeSignpost}
                    images={imgs}
                    onClose={() => setActiveSignpost(null)}
                    onLike={handleLikeSignpost}
                    onViewProfile={(authorId, username) => {
                      setActiveSignpost(null);
                      setPublicProfileUser({ id: authorId, username });
                    }}
                    onFullScreen={(img) => setFullScreenImage(img)}
                    onDelete={handleDeleteSignpost}
                    onShare={() => setShowShareModal(true)}
                    isPausedExternal={showShareModal}
                  />
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Public Profile Modal */}
      <UserProfileModal 
        player={publicProfileUser} 
        isOpen={!!publicProfileUser} 
        onClose={() => setPublicProfileUser(null)} 
      />
      {/* Share Signpost Modal */}
      {activeSignpost && (
        <ShareSignpostModal 
          signpostId={activeSignpost.id} 
          isOpen={showShareModal} 
          onClose={() => setShowShareModal(false)}
          onShared={() => showToast('Signpost shared!')}
        />
      )}
    </div>
  );
};
