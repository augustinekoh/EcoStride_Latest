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
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 w-[400px] bg-white rounded-3xl border-comic shadow-comic p-4 flex flex-col gap-4">
      
      {/* Stats Row */}
      <div className="flex justify-between items-center px-4">
        <div className="text-center">
          <div className="text-[10px] text-slate-500 font-bold uppercase">Distance</div>
          <div className="text-lg font-bold text-slate-900">{currentDistance.toFixed(1)} / {distanceToTarget.toFixed(1)} km</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-slate-500 font-bold uppercase">CO2 Saved</div>
          <div className="text-lg font-bold text-brand-green">{currentCarbon.toFixed(2)} kg</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-slate-500 font-bold uppercase">Coins Earned</div>
          <div className="text-lg font-bold text-brand-orange">+{currentCoins}</div>
        </div>
      </div>

      {/* Play/Pause Button */}
      <button 
        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
        className={`w-full py-3 rounded-xl font-black text-lg flex items-center justify-center gap-2 border-2 border-slate-900 shadow-comic transition-transform active:translate-y-1 ${isAutoPlaying ? 'bg-brand-yellow text-slate-900' : 'bg-brand-green text-slate-900'}`}
      >
        {isAutoPlaying ? (
          <>
            <Pause fill="currentColor" /> PAUSE AUTO-WALK
          </>
        ) : (
          <>
            <Play fill="currentColor" /> RESUME AUTO-WALK
          </>
        )}
      </button>

      {/* Milestone Toast Popup */}
      {milestoneToast && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-brand-orange text-white font-bold px-6 py-2 rounded-xl border-2 border-slate-900 shadow-comic whitespace-nowrap animate-in slide-in-from-bottom-2 fade-in">
          {milestoneToast}
        </div>
      )}
    </div>
  );
};
