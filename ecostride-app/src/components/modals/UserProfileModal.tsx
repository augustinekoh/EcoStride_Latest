import React from 'react';
import { X, User } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: any | null;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, player }) => {
  if (!isOpen || !player) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
      <div className="bg-[#faf9f6] border-4 border-[#1d3539] shadow-[8px_8px_0px_0px_#1d3539] rounded-3xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-90 duration-300 relative">
        
        {/* Header */}
        <div className="bg-[#1d3539] p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-2">
            <User className="text-[#fff4d6]" size={24} />
            <h2 className="text-xl font-black uppercase tracking-wider text-[#fff4d6]">User Profile</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#5496a2] rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content - Placeholder */}
        <div className="p-6 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-24 h-24 rounded-full border-4 border-[#1d3539] bg-white flex items-center justify-center text-5xl shadow-[4px_4px_0px_0px_#1d3539]">
            {player.avatar || '👤'}
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#1d3539]">{player.name || player.email}</h3>
            <p className="text-sm font-bold text-[#5496a2]">{player.guildName || 'Independent Explorer'}</p>
          </div>
          
          <div className="bg-white/50 border-2 border-[#1d3539] border-dashed rounded-xl p-4 w-full mt-4 opacity-70">
            <p className="text-[#5496a2] font-bold text-sm uppercase mb-2">Profile Stats</p>
            <p className="text-xs text-[#1d3539]/70">Detailed user profile, activity timeline, and achievements will be displayed here.</p>
            <p className="text-xs font-black text-[#1d3539] mt-2">(Coming in Phase 2)</p>
          </div>
        </div>

      </div>
    </div>
  );
};
