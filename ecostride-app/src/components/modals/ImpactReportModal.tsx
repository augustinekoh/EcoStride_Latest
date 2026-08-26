import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useDemoStore } from '../../stores/useDemoStore';
import { useUserStore } from '../../stores/useUserStore';
import { auth } from '../../firebase';
// firestore import removed
import merchantsData from '../../mock/merchants.json';

export const ImpactReportModal: React.FC = () => {
  const { showReportModal, setShowReportModal, setProgress, completedDistanceKm, completedCheatDistanceKm, completedCoins, penaltyStatus, penaltyReason } = useDemoStore();
  const { addCoins, addCarbonSaved, addActivity } = useUserStore();

  const [stats, setStats] = useState({ distance: 0, carbon: 0, coins: 0, cheatDistance: 0 });

  useEffect(() => {
    if (showReportModal) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#86efac', '#fde047', '#7dd3fc', '#f472b6']
      });

      const dist = completedDistanceKm || 0;
      const cheatDist = completedCheatDistanceKm || 0;
      let carbon = dist / 5.88;
      let coins = completedCoins || Math.floor(carbon * 100); // Use backend coins if available

      if (penaltyStatus === 'CHEATER_SPOOFING' || penaltyStatus === 'CHEATER_SHAKER' || penaltyStatus === 'VEHICLE_ONLY') {
        carbon = 0;
        coins = 0;
      }

      setStats({ distance: dist, carbon, coins, cheatDistance: cheatDist });

      // Optimistic local update & sync to API (only if normal or mixed)
      if (coins > 0) {
        addCoins(coins);
        addCarbonSaved(carbon);
      }
      if (dist > 0) {
        addActivity(dist);
      }
    }
  }, [showReportModal, completedDistanceKm, addCoins, addCarbonSaved, addActivity]);

  if (!showReportModal) return null;

  return (
    <div className="absolute inset-0 z-[400] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className={`bg-[#faf9f6] border-2 ${penaltyStatus === 'NORMAL' ? 'border-[#1d3539]' : penaltyStatus === 'MIXED_COMMUTE' ? 'border-amber-500' : 'border-red-600'} rounded-3xl p-8 max-w-md w-[calc(100%-8px)] sm:w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,0.8)] animate-in zoom-in duration-300`}>

        {penaltyStatus === 'NORMAL' && (
          <h2 className="text-3xl font-black text-center mb-6 uppercase tracking-tight text-[#1d3539] drop-shadow-[2px_2px_0px_#80abb1]">
            Journey Complete!
          </h2>
        )}

        {penaltyStatus === 'MIXED_COMMUTE' && (
          <div className="bg-amber-100 border-2 border-amber-500 text-amber-900 p-4 rounded-xl mb-6 text-center shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
            <h2 className="text-xl font-black uppercase mb-1">⚠️ Mixed Commute</h2>
            <p className="text-sm font-bold">{penaltyReason}</p>
          </div>
        )}

        {(penaltyStatus === 'CHEATER_SPOOFING' || penaltyStatus === 'CHEATER_SHAKER' || penaltyStatus === 'VEHICLE_ONLY') && (
          <div className="bg-red-100 border-2 border-red-600 text-red-900 p-4 rounded-xl mb-6 text-center shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]">
            <h2 className="text-xl font-black uppercase mb-1">🚫 Invalid Session</h2>
            <p className="text-sm font-bold">{penaltyReason}</p>
            <p className="text-xs mt-2 opacity-80">All rewards for this session have been forfeited.</p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {penaltyStatus === 'MIXED_COMMUTE' && stats.cheatDistance > 0 && (
            <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-500 flex justify-between items-center opacity-80">
              <span className="font-bold text-red-700">Vehicle (Deducted)</span>
              <span className="font-black text-xl text-red-600">-{stats.cheatDistance.toFixed(2)} km</span>
            </div>
          )}
          <div className="bg-white p-4 rounded-2xl border-2 border-[#1d3539] flex justify-between items-center">
            <span className="font-bold text-slate-500">Valid Distance</span>
            <span className={`font-black text-xl ${penaltyStatus.startsWith('CHEATER') || penaltyStatus === 'VEHICLE_ONLY' ? 'text-red-500 line-through' : 'text-[#1d3539]'}`}>{stats.distance.toFixed(2)} km</span>
          </div>
          <div className="bg-[#e9efce] p-4 rounded-2xl border-2 border-[#1d3539] flex justify-between items-center">
            <span className="font-bold text-slate-500">CO2 Saved</span>
            <span className="font-black text-xl text-[#5496a2]">{stats.carbon.toFixed(2)} kg</span>
          </div>
          <div className="bg-[#fff4d6] p-4 rounded-2xl border-2 border-[#1d3539] flex justify-between items-center">
            <span className="font-bold text-slate-500">Coins Earned</span>
            <span className={`font-black text-xl ${stats.coins === 0 ? 'text-red-600' : 'text-[#1d3539]'}`}>+{stats.coins} 🪙</span>
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
          className={`w-full text-white border-2 border-[#1d3539] py-3 rounded-full font-black uppercase tracking-wide shadow-[4px_4px_0px_0px_#1d3539] active:translate-y-1 active:shadow-none transition-all ${penaltyStatus !== 'NORMAL' ? 'bg-slate-800 hover:bg-slate-700' : 'bg-[#5496a2] hover:bg-[#80abb1]'}`}
        >
          {penaltyStatus !== 'NORMAL' ? 'Close' : 'Claim Rewards & Continue'}
        </button>
      </div>
    </div>
  );
};
