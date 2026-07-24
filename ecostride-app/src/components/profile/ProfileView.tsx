import React, { useState } from 'react';
import { useUserStore } from '../../stores/useUserStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { Settings, Edit2, Check, Globe, Building2, TreePine, Users, Award } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { 
    username, 
    bio, 
    nationality, 
    totalTreesPlanted, 
    streaks, 
    unlockedBadges,
    setUserData
  } = useUserStore();
  
  const { setActiveView } = useDemoStore();
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editBioText, setEditBioText] = useState(bio);

  const saveBio = () => {
    setUserData({ bio: editBioText });
    setIsEditingBio(false);
  };

  return (
    <div className="h-full w-full p-4 md:p-8 pb-32 overflow-y-auto relative bg-brand-cream">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-pastel-yellow)] rounded-full mix-blend-overlay filter blur-3xl opacity-60 animate-pulse pointer-events-none"></div>
      
      {/* Top Navigation */}
      <div className="flex justify-end mb-4 relative z-10">
        <button 
          onClick={() => setActiveView('settings')}
          className="w-12 h-12 glass-card rounded-full flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Settings size={24} className="text-[var(--color-text-main)]" />
        </button>
      </div>

      {/* Profile Header (Large Avatar & Username) */}
      <div className="flex flex-col items-center mb-8 relative z-10">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-white/50 backdrop-blur-sm shrink-0 border-4 border-white/80 shadow-md flex items-center justify-center p-2 mb-4">
          <img 
            src="https://api.dicebear.com/7.x/bottts/svg?seed=EcoStride" 
            alt="Profile" 
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-[var(--color-text-main)]">{username}</h2>
      </div>

      {/* Bio Section */}
      <div className="glass-card p-6 mb-6 relative z-10">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-black text-[var(--color-text-muted)] uppercase tracking-widest">About Me</h3>
          {isEditingBio ? (
            <button onClick={saveBio} className="w-8 h-8 glass-active rounded-full flex items-center justify-center text-[var(--color-teal-dark)] hover:scale-105">
              <Check size={16} />
            </button>
          ) : (
            <button onClick={() => setIsEditingBio(true)} className="w-8 h-8 glass-active rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:scale-105">
              <Edit2 size={14} />
            </button>
          )}
        </div>
        
        {isEditingBio ? (
          <textarea 
            value={editBioText}
            onChange={(e) => setEditBioText(e.target.value)}
            className="w-full bg-white/40 border border-white/50 rounded-xl p-3 text-[var(--color-text-main)] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-dark)] resize-none"
            rows={3}
            autoFocus
          />
        ) : (
          <p className="text-[var(--color-text-main)] font-bold text-sm leading-relaxed">{bio}</p>
        )}
      </div>

      {/* Overview Grid */}
      <h3 className="text-sm font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-3 pl-2 relative z-10">Overview</h3>
      <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
        <div className="glass-card p-4 flex flex-col gap-2">
          <div className="w-8 h-8 glass-active rounded-full flex items-center justify-center text-[var(--color-teal-dark)]"><Globe size={16}/></div>
          <span className="text-xs font-bold text-[var(--color-text-muted)]">Nationality</span>
          <span className="text-lg font-black text-[var(--color-text-main)] truncate">{nationality}</span>
        </div>
        <div className="glass-card p-4 flex flex-col gap-2">
          <div className="w-8 h-8 glass-active rounded-full flex items-center justify-center text-orange-500"><Building2 size={16}/></div>
          <span className="text-xs font-bold text-[var(--color-text-muted)]">Cases Reported</span>
          <span className="text-lg font-black text-[var(--color-text-main)]">{streaks}</span>
        </div>
        <div 
          onClick={() => setActiveView('map')}
          className="glass-card p-4 flex flex-col gap-2 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all group"
        >
          <div className="w-8 h-8 glass-active rounded-full flex items-center justify-center text-green-600 group-hover:bg-green-100 transition-colors"><TreePine size={16}/></div>
          <span className="text-xs font-bold text-[var(--color-text-muted)]">Trees Planted</span>
          <span className="text-lg font-black text-[var(--color-text-main)]">{totalTreesPlanted}</span>
          <span className="text-[10px] text-[var(--color-teal-dark)] font-bold mt-1">Go to Let's Walk &rarr;</span>
        </div>
        <div className="glass-card p-4 flex flex-col gap-2">
          <div className="w-8 h-8 glass-active rounded-full flex items-center justify-center text-blue-500"><Users size={16}/></div>
          <span className="text-xs font-bold text-[var(--color-text-muted)]">Group Joined</span>
          <span className="text-lg font-black text-[var(--color-text-main)] truncate">TestGroup</span>
        </div>
      </div>

      {/* Achievement Badges */}
      <h3 className="text-sm font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-3 pl-2 relative z-10">Achievements</h3>
      <div className="glass-card p-5 relative z-10 mb-8">
        <div className="flex flex-wrap gap-3">
          {unlockedBadges.length > 0 ? (
            unlockedBadges.map((badge, idx) => (
              <div key={idx} className="w-16 h-16 glass-active rounded-2xl flex flex-col items-center justify-center border border-white/50 shadow-sm hover:-translate-y-1 transition-transform">
                <Award size={24} className="text-[var(--color-teal-dark)] mb-1" />
                <span className="text-[10px] font-bold text-[var(--color-text-main)]">Pioneer</span>
              </div>
            ))
          ) : (
            <p className="text-sm font-bold text-[var(--color-text-muted)] py-4 w-full text-center">No badges unlocked yet.</p>
          )}
          
          {/* Add a placeholder empty badge slot to show there's more to unlock */}
          <div className="w-16 h-16 glass-card rounded-2xl flex items-center justify-center border-dashed border-2 border-white/40 opacity-50">
            <Award size={24} className="text-[var(--color-text-muted)]" />
          </div>
        </div>
      </div>
    </div>
  );
};
