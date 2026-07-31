import React, { useState, useEffect } from 'react';
import { X, UserPlus, Award, MapPin, TreePine } from 'lucide-react';
import { apiClient } from '../../lib/api';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: any | null;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, player }) => {
  const [playerDetails, setPlayerDetails] = useState<any>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    if (isOpen && player?.id) {
      // Fetch full details
      apiClient(`/users/${player.id}`).then(res => {
        setPlayerDetails(res.user);
      }).catch(e => console.error("Failed to fetch user details", e));
    } else {
      setPlayerDetails(null);
    }
  }, [isOpen, player]);

  if (!isOpen || !player) return null;

  const username = playerDetails?.username || player.username || player.name || player.email?.split('@')[0];
  const playerId = playerDetails?.player_id || player.player_id;
  const bio = playerDetails?.bio;
  const avatar = playerDetails?.avatar || player.avatar;
  const badges = playerDetails?.unlocked_badges ? JSON.parse(playerDetails.unlocked_badges) : [];

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div 
        className="bg-gradient-to-br from-[#7ccbed] via-[#c2ecd6] to-[#e7ffc9] rounded-[2rem] w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 relative shadow-2xl border-2 border-white/60"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-full h-40 bg-gradient-to-br from-[#3aaeff]/20 to-[#e7ffc9]/10 rounded-b-[40px] pointer-events-none"></div>
        
        {/* Header Button */}
        <div className="absolute top-4 right-4 z-[100]">
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-transform border border-white"
          >
            <X size={20} className="text-slate-700" />
          </button>
        </div>

        <div className="p-6 pt-12 flex flex-col items-center justify-center text-center relative z-10 overflow-y-auto">
          {/* Avatar */}
          <div 
            onClick={() => setShowFullImage(true)}
            className="w-28 h-28 rounded-[2rem] overflow-hidden bg-white/40 backdrop-blur-md shrink-0 border-4 border-white shadow-xl flex items-center justify-center p-1 mb-4 rotate-3 hover:rotate-0 transition-transform duration-300 cursor-pointer"
          >
            <img 
              src={avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`} 
              alt="Avatar" 
              className="w-full h-full object-cover rounded-2xl bg-white/60"
            />
          </div>
          
          {/* Name & ID */}
          <h3 className="text-2xl font-black text-slate-800 flex flex-col items-center justify-center gap-1">
            {username}
            {playerId && (
              <span className="text-sm font-bold text-[#3aaeff] bg-white/60 backdrop-blur-md border border-white/80 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">#{playerId}</span>
            )}
          </h3>
          <p className="text-sm font-bold text-slate-600 mt-2 flex items-center gap-1 bg-white/30 px-3 py-1 rounded-full border border-white/40">
            {playerDetails?.nationality || 'Global Citizen'}
          </p>

          {/* Stats */}
          <div className="flex gap-4 mt-4 w-full px-4">
            <div className="flex-1 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm">
              <MapPin size={20} className="text-[#3aaeff] mb-1" />
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Distance</span>
              <span className="text-lg font-black text-slate-800">{playerDetails?.total_distance_km || player?.totalMileageKm || 0} km</span>
            </div>
            <div className="flex-1 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm">
              <TreePine size={20} className="text-[#84a98c] mb-1" />
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Trees</span>
              <span className="text-lg font-black text-slate-800">{playerDetails?.total_trees_planted || player?.treesPlanted || 0}</span>
            </div>
          </div>
          
          
          {/* Add Friend Button */}
          <button 
            onClick={() => alert("Feature coming soon!")}
            className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-[#59bcf6] to-[#3aaeff] hover:from-[#3aaeff] hover:to-[#59bcf6] text-white rounded-2xl font-black transition-all shadow-lg shadow-[#3aaeff]/30 border border-white/40 hover:-translate-y-1"
          >
            <UserPlus size={20} /> Add Friend
          </button>

          {/* Bio */}
          <div className="w-full mt-6 bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 text-left shadow-sm">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Bio</h4>
            <p className="text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">
              {bio || <span className="text-slate-500 italic">No bio provided.</span>}
            </p>
          </div>

          {/* Achievements */}
          <div className="w-full mt-6">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 text-left">Achievements</h4>
            <div className="flex flex-wrap gap-3">
              {badges.length > 0 ? (
                badges.map((badge: string, idx: number) => (
                  <div key={idx} className="w-16 h-16 bg-white/40 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center border border-white/80 shadow-sm hover:scale-105 transition-transform">
                    <Award size={24} className="text-[#3aaeff] mb-1 drop-shadow-sm" />
                    <span className="text-[10px] font-bold text-slate-700 text-center uppercase tracking-wider leading-tight">{badge.replace('_', ' ')}</span>
                  </div>
                ))
              ) : (
                <div className="w-full bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-white/50 border-dashed text-center">
                  <p className="text-sm font-bold text-slate-600">No badges unlocked yet.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Full Image Preview Modal */}
      {showFullImage && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setShowFullImage(false);
          }}
        >
          <button 
            onClick={() => setShowFullImage(false)}
            className="absolute top-6 right-6 w-12 h-12 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X size={24} />
          </button>
          <img 
            src={avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`} 
            alt="Full Avatar" 
            className="max-w-full max-h-[80vh] object-contain rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
