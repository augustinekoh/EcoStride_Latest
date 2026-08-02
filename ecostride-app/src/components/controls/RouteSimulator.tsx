import React, { useEffect, useState, useRef } from 'react';
import { useDemoStore } from '../../stores/useDemoStore';
import { useMapStore } from '../../stores/useMapStore';
import { Play, Pause } from 'lucide-react';

export const RouteSimulator: React.FC = () => {
  const { demoProgress, setProgress, isAutoPlaying, setIsAutoPlaying, currentMode, setShowReportModal, setCompletedDistanceKm } = useDemoStore();
  const { distanceToTarget, activeRouteGeoJSON } = useMapStore();
  
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const lastMilestoneRef = useRef<number>(0);

  useEffect(() => {
    let interval: number;
    if (isAutoPlaying && currentMode === 'demo' && activeRouteGeoJSON && distanceToTarget !== null) {
      interval = window.setInterval(() => {
        setProgress((prev: number) => {
          if (prev >= 100) {
            setIsAutoPlaying(false);
            setCompletedDistanceKm(distanceToTarget);
            setShowReportModal(true);
            // clear active route so RouteSimulator unmounts automatically
            useMapStore.getState().setActiveRouteGeoJSON(null);
            useMapStore.getState().setDistanceToTarget(null);
            return 100;
          }
          return prev + 0.5; // adjust speed here
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, setProgress, setIsAutoPlaying, setShowReportModal, distanceToTarget, currentMode, activeRouteGeoJSON]);

  const currentDistance = distanceToTarget ? (distanceToTarget * demoProgress) / 100 : 0;
  const currentCarbon = currentDistance / 5.88;
  const currentCoins = Math.floor(currentCarbon * 100);

  useEffect(() => {
    if (demoProgress === 0) {
      lastMilestoneRef.current = 0;
    }
    const currentMilestone = Math.floor(currentDistance);
    if (currentMilestone > lastMilestoneRef.current && currentMilestone >= 1) {
      lastMilestoneRef.current = currentMilestone;
      setMilestoneToast(`Awesome! You walked ${currentMilestone}km, saved ${(currentMilestone / 5.88).toFixed(2)}kg CO2 & earned ${Math.floor((currentMilestone / 5.88) * 100)} Coins!`);
      setTimeout(() => setMilestoneToast(null), 4000);
    }
  }, [currentDistance, demoProgress]);

  // If we are not in demo mode, or there's no active route being navigated, hide this panel
  if (currentMode !== 'demo' || !activeRouteGeoJSON || distanceToTarget === null) {
    return null;
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] sm:w-[450px] bg-white border-2 border-[#1d3539] shadow-[4px_4px_0px_0px_#1d3539] px-4 sm:px-6 py-4 rounded-3xl flex flex-col gap-4 z-[90] animate-in slide-in-from-bottom-10 fade-in duration-300">
      
      {/* Stats Row */}
      <div className="flex justify-between items-center gap-4 sm:gap-6">
        <div className="text-left">
          <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase truncate">Distance</div>
          <div className="text-sm sm:text-lg font-black text-[#1d3539] whitespace-nowrap">{currentDistance.toFixed(1)} <span className="text-xs">/ {distanceToTarget.toFixed(1)} km</span></div>
        </div>
        <div className="text-left">
          <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase truncate">CO2 Saved</div>
          <div className="text-sm sm:text-lg font-black text-[#5496a2] whitespace-nowrap">{currentCarbon.toFixed(2)} <span className="text-xs">kg</span></div>
        </div>
        <div className="text-left">
          <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase truncate">Coins Earned</div>
          <div className="text-sm sm:text-lg font-black text-brand-pink whitespace-nowrap">+{currentCoins} <span className="text-xs">🪙</span></div>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex gap-2 w-full">
        <button 
          onClick={() => {
            setIsAutoPlaying(false);
            setProgress(0);
            setCompletedDistanceKm(currentDistance);
            setShowReportModal(true);
            useMapStore.getState().setActiveRouteGeoJSON(null);
            useMapStore.getState().setDistanceToTarget(null);
          }}
          className="flex-1 py-2.5 sm:py-3 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 border-2 border-red-500 bg-red-50 text-red-500 shadow-[2px_2px_0px_0px_rgba(239,68,68,1)] hover:bg-red-100 active:translate-y-0.5 active:shadow-none transition-all uppercase tracking-wide"
        >
          Stop
        </button>
        <button 
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className={`flex-[2] py-2.5 sm:py-3 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 border-2 border-[#1d3539] shadow-[2px_2px_0px_0px_rgba(29,53,57,1)] active:translate-y-0.5 active:shadow-none transition-all uppercase tracking-wide ${isAutoPlaying ? 'bg-[#fff4d6] text-[#1d3539]' : 'bg-[#5496a2] text-white'}`}
        >
          {isAutoPlaying ? (
            <>
              <Pause size={18} fill="currentColor" /> Pause
            </>
          ) : (
            <>
              <Play size={18} fill="currentColor" /> Resume
            </>
          )}
        </button>
      </div>

      {/* Milestone Toast Popup */}
      {milestoneToast && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-[#e9efce] text-[#1d3539] font-bold px-4 sm:px-6 py-2 rounded-2xl border-2 border-[#1d3539] shadow-[2px_2px_0px_0px_#1d3539] whitespace-nowrap text-xs sm:text-sm animate-in slide-in-from-bottom-2 fade-in">
          {milestoneToast}
        </div>
      )}
    </div>
  );
};
