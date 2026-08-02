import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useDemoStore } from '../../stores/useDemoStore';
import { useUserStore } from '../../stores/useUserStore';
import { auth } from '../../firebase';
// firestore import removed
import merchantsData from '../../mock/merchants.json';

export const ImpactReportModal: React.FC = () => {
  const { showReportModal, setShowReportModal, setProgress, completedDistanceKm } = useDemoStore();
  const { addCoins, addCarbonSaved, addActivity } = useUserStore();
  
  const [stats, setStats] = useState({ distance: 0, carbon: 0, coins: 0 });

  useEffect(() => {
    if (showReportModal) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#86efac', '#fde047', '#7dd3fc', '#f472b6']
      });

      const dist = completedDistanceKm || 0;
      const carbon = dist / 5.88;
      const coins = Math.floor(carbon * 100);
      
      setStats({ distance: dist, carbon, coins });

      // Optimistic local update & sync to API
      addCoins(coins);
      addCarbonSaved(carbon);
      addActivity(dist);
    }
  }, [showReportModal, completedDistanceKm, addCoins, addCarbonSaved, addActivity]);

  if (!showReportModal) return null;

  return (
    <div className="absolute inset-0 z-[400] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-[#faf9f6] border-2 border-[#1d3539] rounded-3xl p-8 max-w-md w-[calc(100%-8px)] sm:w-full shadow-[8px_8px_0px_0px_#1d3539] animate-in zoom-in duration-300">
        <h2 className="text-3xl font-black text-center mb-6 uppercase tracking-tight text-[#1d3539] drop-shadow-[2px_2px_0px_#80abb1]">
          Journey Complete!
        </h2>
        
        <div className="space-y-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border-2 border-[#1d3539] flex justify-between items-center">
            <span className="font-bold text-slate-500">Distance</span>
            <span className="font-black text-xl text-[#1d3539]">{stats.distance.toFixed(1)} km</span>
          </div>
          <div className="bg-[#e9efce] p-4 rounded-2xl border-2 border-[#1d3539] flex justify-between items-center">
            <span className="font-bold text-slate-500">CO2 Saved</span>
            <span className="font-black text-xl text-[#5496a2]">{stats.carbon.toFixed(2)} kg</span>
          </div>
          <div className="bg-[#fff4d6] p-4 rounded-2xl border-2 border-[#1d3539] flex justify-between items-center">
            <span className="font-bold text-slate-500">Coins Earned</span>
            <span className="font-black text-xl text-[#1d3539]">+{stats.coins} 🪙</span>
          </div>
        </div>

        {/* 
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-900 border-dashed mb-6 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-brand-pink text-white text-xs font-bold px-2 py-1 rounded-bl-lg">UNLOCKED</div>
          <div className="text-4xl mb-2">{merchantsData[0].icon}</div>
          <div className="font-bold">{merchantsData[0].voucherTitle}</div>
          <div className="text-sm text-slate-500 mt-1">at {merchantsData[0].name}</div>
        </div> 
        */}

        <button 
          onClick={() => {
            setShowReportModal(false);
            setProgress(0);
          }}
          className="w-full bg-[#5496a2] text-white hover:bg-[#80abb1] border-2 border-[#1d3539] py-3 rounded-full font-black uppercase tracking-wide shadow-[4px_4px_0px_0px_#1d3539] active:translate-y-1 active:shadow-none transition-all"
        >
          Claim Rewards & Continue
        </button>
      </div>
    </div>
  );
};
