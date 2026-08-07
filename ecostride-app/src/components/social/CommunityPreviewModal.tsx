import React, { useEffect, useState } from 'react';
import { X, Users, TreeDeciduous, Trophy, MapPin, User as UserIcon } from 'lucide-react';
import { auth } from '../../firebase';
import { UserProfileModal } from '../modals/UserProfileModal';

interface Member {
  id: string;
  username: string;
  email: string;
  total_trees_planted: number;
  avatar?: string;
}

interface Guild {
  id: string;
  name: string;
  description: string;
  icon: string;
  nationality: string;
  require_approval: number;
  admin_id?: string;
  created_at: number;
}

interface CommunityPreviewModalProps {
  guildId: string;
  onClose: () => void;
  onJoined: (guildId: string) => void;
}

import { apiClient } from '../../lib/api';

export function CommunityPreviewModal({ guildId, onClose, onJoined }: CommunityPreviewModalProps) {
  const [guild, setGuild] = useState<Guild | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Member | null>(null);

  useEffect(() => {
    const fetchGuild = () => {
      apiClient(`/guilds/${guildId}`)
        .then(data => {
          if (data.guild) setGuild(data.guild);
          if (data.members) setMembers(data.members);
          if (data.hasPendingRequest) setHasPendingRequest(true);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    };
    fetchGuild();
  }, [guildId]);

  const [toastMsg, setToastMsg] = useState('');
  const [dragY, setDragY] = useState(0);
  const [startY, setStartY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 100) {
      onClose();
    }
    setDragY(0);
  };

  const handleJoin = async () => {
    if (!auth.currentUser || !guild) return;
    setIsJoining(true);
    try {
      if (guild.require_approval) {
        await apiClient(`/guilds/${guildId}/request_join`, {
          method: 'POST'
        });
        setHasPendingRequest(true);
        setToastMsg('Join request sent');
        setTimeout(() => setToastMsg(''), 3000);
      } else {
        await apiClient(`/guilds/${guildId}/join`, {
          method: 'POST'
        });
        onJoined(guildId);
      }
    } catch (e) {
      console.error(e);
      setToastMsg('An error occurred');
      setTimeout(() => setToastMsg(''), 3000);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto touch-none overscroll-none">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div 
        className={`relative bg-[#faf9f6]/95 backdrop-blur-xl w-full h-[85vh] rounded-t-[2.5rem] shadow-[0_-8px_30px_rgba(29,53,57,0.1)] flex flex-col overflow-hidden border-t border-[#1d3539]/10 animate-in slide-in-from-bottom ${dragY === 0 ? 'transition-transform duration-300 ease-out' : ''}`}
        style={{ transform: `translateY(${dragY}px)` }}
      >
        <div 
          className="flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing touch-none w-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-14 h-1.5 bg-[#1d3539]/20 rounded-full pointer-events-none" />
        </div>
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#1d3539]/10 text-[#1d3539]/50 hover:text-[#1d3539] transition"
        >
          <X size={24} />
        </button>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : guild ? (
          <>
            <div className="px-6 pt-2 pb-6 border-b border-[#1d3539]/10 text-center">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-white/50 border border-[#1d3539]/10 flex items-center justify-center text-4xl shadow-md mb-4 shadow-[#1d3539]/5 overflow-hidden">
                {guild.icon ? (
                  (guild.icon.startsWith('http') || guild.icon.startsWith('/')) ? (
                    <img src={guild.icon} alt={guild.name} className="w-full h-full object-cover" />
                  ) : (
                    guild.icon
                  )
                ) : (
                  '🌍'
                )}
              </div>
              <h2 className="text-2xl font-black text-[#1d3539] mb-2">{guild.name}</h2>
              <div className="flex items-center justify-center space-x-2 text-sm font-bold text-[#5496a2] mb-4">
                <MapPin size={14} />
                <span>{guild.nationality || 'Global'}</span>
                <span>•</span>
                <Users size={14} />
                <span>{members.length} members</span>
              </div>
              <p className="text-[#1d3539]/70 font-medium text-sm max-w-md mx-auto leading-relaxed">
                {guild.description}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
              <h3 className="text-lg font-black flex items-center mb-4 text-[#1d3539]">
                <Trophy size={18} className="text-amber-500 mr-2" />
                Top Planters
              </h3>
              
              <div className="space-y-3">
                {members.map((member, index) => (
                  <div 
                    key={member.id}
                    onClick={() => setSelectedProfile(member)}
                    className="glass-card bg-white/50 border border-[#1d3539]/10 rounded-2xl p-3 flex items-center hover:-translate-y-0.5 transition-transform shadow-sm cursor-pointer"
                  >
                    <div className={`w-8 font-black text-sm text-center ${
                      index === 0 ? 'text-amber-500' : 
                      index === 1 ? 'text-slate-400' : 
                      index === 2 ? 'text-amber-700' : 'text-[#1d3539]/40'
                    }`}>
                      #{index + 1}
                    </div>
                    
                    <div className="w-10 h-10 rounded-full bg-[#1d3539]/10 flex items-center justify-center mr-3 shrink-0 overflow-hidden text-[#1d3539]">
                      {member.avatar ? (
                        (member.avatar.startsWith('http') || member.avatar.startsWith('/')) ? (
                          <img src={member.avatar} alt={member.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">{member.avatar}</span>
                        )
                      ) : (
                        <UserIcon size={18} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-[#1d3539] truncate text-sm">
                          {member.username || member.email.split('@')[0]}
                        </h4>
                        {guild.admin_id === member.id && (
                          <span className="bg-[#1d3539]/10 text-[#5496a2] text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">Admin</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center text-emerald-600 font-bold bg-emerald-100 px-2.5 py-1 rounded-lg text-sm ml-2">
                      <TreeDeciduous size={14} className="mr-1" />
                      {member.total_trees_planted || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-[#1d3539]/10 relative">
              {toastMsg && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#1d3539] text-white px-6 py-2 rounded-full text-sm font-bold shadow-xl animate-in fade-in slide-in-from-bottom-2">
                  {toastMsg}
                </div>
              )}
              <button 
                onClick={handleJoin}
                disabled={isJoining || hasPendingRequest}
                className="w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center transition-all bg-[var(--color-teal-dark)] text-white shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
              >
                {hasPendingRequest ? 'Request Sent' : isJoining ? 'Processing...' : guild.require_approval ? 'Request to Join' : 'Join Community'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Community not found.
          </div>
        )}
      </div>

      {/* Profile Modal */}
      <UserProfileModal 
        isOpen={!!selectedProfile} 
        onClose={() => setSelectedProfile(null)} 
        player={selectedProfile ? { ...selectedProfile, guildName: guild?.name } : null} 
      />
    </div>
  );
}
