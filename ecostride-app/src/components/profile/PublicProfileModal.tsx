import React, { useState, useEffect } from 'react';
import { X, Award, Globe, TreePine, MapPin } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { BadgeInfoModal } from '../modals/BadgeInfoModal';
import { formatLocation } from '../../lib/locationData';

interface Props {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PublicProfileModal: React.FC<Props> = ({ userId, isOpen, onClose }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<any | null>(null);

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
      <div className="bg-[#faf9f6] w-[calc(100%-8px)] sm:w-full max-w-sm mr-2 sm:mr-0 rounded-3xl border-4 border-[#1d3539] shadow-[8px_8px_0px_0px_#1d3539] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden relative">
        
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

              {formatLocation(user.city, user.state, user.country) && (
                <div className="bg-white border-2 border-[#1d3539] rounded-2xl p-3 flex flex-col items-center shadow-[2px_2px_0px_0px_#1d3539] col-span-2">
                  <Globe className="text-[#e07a5f] mb-1" size={24} />
                  <span className="text-[10px] uppercase font-black text-slate-400">Location</span>
                  <span className="text-sm font-black text-[#1d3539] text-center">{formatLocation(user.city, user.state, user.country)}</span>
                </div>
              )}
            </div>

            {/* Badges */}
            {(() => {
              let badges: any[] = [];
              try { badges = JSON.parse(user.unlocked_badges || '[]'); } catch (e) {}

              let showcased: string[] = [];
              try { showcased = JSON.parse(user.showcased_badges || '[]'); } catch (e) {}

              let badgesToRender: any[] = [];
              if (showcased.length > 0) {
                badgesToRender = badges.filter(b => showcased.includes(b.id));
              } else {
                badgesToRender = [...badges].sort((a, b) => b.level - a.level).slice(0, 4);
              }

              if (badgesToRender.length > 0) {
                return (
                  <div className="w-full">
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-2">Showcase ({badgesToRender.length})</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {badgesToRender.map((badge: any, idx: number) => (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedBadge(badge)}
                          className="w-12 h-12 shrink-0 bg-[#fff4d6] border-2 border-[#1d3539] rounded-full flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_#1d3539] relative cursor-pointer hover:-translate-y-0.5 transition-transform" 
                          title={badge.name}
                        >
                          {badge.icon}
                          {badge.level > 1 && (
                            <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black px-1 rounded-full border border-[#1d3539] shadow-[1px_1px_0px_0px_#1d3539]">
                              Lv.{badge.level}
                            </div>
                          )}
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

      {/* Badge Info Modal */}
      <BadgeInfoModal 
        badge={selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </div>
  );
};
