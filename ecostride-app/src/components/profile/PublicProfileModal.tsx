import React, { useState, useEffect } from 'react';
import { X, Award, Globe, TreePine, MapPin } from 'lucide-react';
import { apiClient } from '../../lib/api';

interface Props {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PublicProfileModal: React.FC<Props> = ({ userId, isOpen, onClose }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      apiClient(`/users/${userId}`)
        .then(res => {
          if (res.user) setUser(res.user);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#faf9f6] w-full max-w-sm rounded-3xl border-4 border-[#1d3539] shadow-[8px_8px_0px_0px_#1d3539] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden relative">
        
        {/* Header Background */}
        <div className="h-24 bg-[#5496a2] border-b-4 border-[#1d3539] relative">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-white hover:scale-110 transition-transform bg-[#1d3539] p-1.5 rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 font-bold">Loading profile...</div>
        ) : !user ? (
          <div className="p-8 text-center text-slate-500 font-bold">User not found.</div>
        ) : (
          <div className="px-6 pb-6 relative flex flex-col items-center">
            {/* Avatar */}
            <div className="-mt-12 mb-3 relative">
              <div className="w-24 h-24 bg-[#fff4d6] rounded-full border-4 border-[#1d3539] flex items-center justify-center text-4xl shadow-md overflow-hidden bg-white">
                {user.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  '🏃'
                )}
              </div>
            </div>

            {/* User Info */}
            <h2 className="text-xl font-black text-[#1d3539]">{user.username || user.email?.split('@')[0] || 'Explorer'}</h2>
            <p className="text-sm font-bold text-[#5496a2] mb-4">#{user.player_id || '00000000'}</p>

            {user.bio && (
              <p className="text-sm font-bold text-slate-600 text-center mb-6 bg-slate-100 p-3 rounded-xl border border-slate-200 w-full">
                "{user.bio}"
              </p>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 w-full mb-6">
              <div className="bg-white border-2 border-[#1d3539] rounded-2xl p-3 flex flex-col items-center shadow-[2px_2px_0px_0px_#1d3539]">
                <MapPin className="text-[#5496a2] mb-1" size={24} />
                <span className="text-[10px] uppercase font-black text-slate-400">Distance</span>
                <span className="text-lg font-black text-[#1d3539]">{user.total_distance_km || 0} km</span>
              </div>
              
              <div className="bg-white border-2 border-[#1d3539] rounded-2xl p-3 flex flex-col items-center shadow-[2px_2px_0px_0px_#1d3539]">
                <TreePine className="text-[#84a98c] mb-1" size={24} />
                <span className="text-[10px] uppercase font-black text-slate-400">Trees Planted</span>
                <span className="text-lg font-black text-[#1d3539]">{user.total_trees_planted || 0}</span>
              </div>

              {user.nationality && (
                <div className="bg-white border-2 border-[#1d3539] rounded-2xl p-3 flex flex-col items-center shadow-[2px_2px_0px_0px_#1d3539] col-span-2">
                  <Globe className="text-[#e07a5f] mb-1" size={24} />
                  <span className="text-[10px] uppercase font-black text-slate-400">Nationality</span>
                  <span className="text-lg font-black text-[#1d3539]">{user.nationality}</span>
                </div>
              )}
            </div>

            {/* Badges */}
            {(() => {
              let badges: any[] = [];
              try { badges = JSON.parse(user.unlocked_badges || '[]'); } catch (e) {}
              if (badges.length > 0) {
                return (
                  <div className="w-full">
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-2">Unlocked Badges ({badges.length})</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {badges.map((badge: any, idx: number) => (
                        <div key={idx} className="w-12 h-12 shrink-0 bg-[#fff4d6] border-2 border-[#1d3539] rounded-full flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_#1d3539]" title={badge.name}>
                          {badge.icon}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

          </div>
        )}
      </div>
    </div>
  );
};
