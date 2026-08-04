import React, { useEffect, useState } from 'react';
import { useUserStore } from '../../stores/useUserStore';
import { apiClient } from '../../lib/api';
import { Trophy, TreeDeciduous, Users, MoreVertical, ShieldAlert, MicOff, Mic, UserMinus, UserIcon, Settings, X } from 'lucide-react';
import { auth } from '../../firebase';
import { UserProfileModal } from '../modals/UserProfileModal';
import { EditCommunityModal } from '../modals/EditCommunityModal';

interface Member {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  total_trees_planted: number;
  muted_until?: number | null;
}

interface Guild {
  id: string;
  name: string;
  description: string;
  icon: string;
  nationality?: string;
  admin_id?: string;
  created_at: number;
}

export function CommunityDashboard() {
  const { guildId, setGuildId } = useUserStore();
  const activeGuildId = guildId || 'guild_test_123';
  
  const [guild, setGuild] = useState<Guild | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Member | null>(null);
  const [isEditingCommunity, setIsEditingCommunity] = useState(false);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [muteMenuId, setMuteMenuId] = useState<string | null>(null);
  const [isAvatarExpanded, setIsAvatarExpanded] = useState(false);

  // We need current user's uid to determine if they are admin
  const currentUserId = auth.currentUser?.uid;
  const isAdmin = currentUserId === guild?.admin_id;

  const fetchGuild = () => {
    apiClient(`/guilds/${activeGuildId}`)
      .then(data => {
        if (data.guild) setGuild(data.guild);
        if (data.members) setMembers(data.members);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchGuild();
  }, [activeGuildId]);

  const handleLeave = async () => {
    if (!auth.currentUser) return;
    
    const isSoleMember = members.length === 1;
    if (isAdmin && !isSoleMember) {
      alert("You must transfer ownership to another member before leaving.");
      return;
    }

    const actionText = (isAdmin && isSoleMember) ? 'delete this community' : 'leave this community';
    if (!confirm(`Are you sure you want to ${actionText}?`)) return;
    
    setIsLeaving(true);
    try {
      if (isAdmin && isSoleMember) {
        await apiClient(`/guilds/${activeGuildId}`, {
          method: 'DELETE',
        });
      } else {
        await apiClient(`/guilds/leave`, {
          method: 'POST',
        });
      }
      setGuildId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleKick = async (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser || !confirm('Are you sure you want to kick this member?')) return;
    const reason = prompt('Reason for kicking:');
    if (reason === null) return; // User cancelled
    try {
      await apiClient(`/guilds/${activeGuildId}/members/${memberId}/kick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      fetchGuild();
    } catch (err) {
      console.error(err);
    }
    setActiveMenuId(null);
  };

  const handleMute = async (memberId: string, durationMs: number, e: React.MouseEvent, action?: 'unmute') => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    try {
      await apiClient(`/guilds/${activeGuildId}/members/${memberId}/mute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ durationMs, action })
      });
      alert(action === 'unmute' ? 'Member unmuted successfully.' : 'Member muted successfully.');
      fetchGuild(); // Re-fetch to update mute status in UI
    } catch (err) {
      console.error(err);
    }
    setMuteMenuId(null);
    setActiveMenuId(null);
  };

  const handleTransferAdmin = async (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    if (!confirm('WARNING: Are you sure you want to transfer ownership? You will be demoted to a regular member and this action cannot be undone.')) return;
    try {
      await apiClient(`/guilds/${activeGuildId}/transfer_admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newAdminId: memberId })
      });
      fetchGuild();
    } catch (err) {
      console.error(err);
    }
    setActiveMenuId(null);
  };

  return (
    <div className="w-full pb-24" onClick={() => { setActiveMenuId(null); setMuteMenuId(null); }}>
      
      {/* Hero Section */}
      <div className="relative pt-8 pb-10 px-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#5496a2] to-[#80abb1] p-1 shadow-[0_12px_40px_rgba(84,150,162,0.3)] mb-6 relative">
            <div 
              className="w-full h-full bg-white rounded-full flex items-center justify-center relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
              onClick={(e) => { e.stopPropagation(); setIsAvatarExpanded(true); }}
            >
              <div className="absolute inset-0 bg-[#5496a2]/5" />
              {guild?.icon ? (
                (guild.icon.startsWith('http') || guild.icon.startsWith('/')) ? (
                  <img src={guild.icon} alt={guild.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">{guild.icon}</span>
                )
              ) : (
                <Users size={48} className="text-[#5496a2]" />
              )}
            </div>
            <div className="absolute bottom-0 right-0 bg-white rounded-full p-2.5 border border-black/5 shadow-md">
              <TreeDeciduous size={18} className="text-emerald-500" />
            </div>
            {isAdmin && (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditingCommunity(true); }}
                className="absolute top-0 right-0 bg-white rounded-full p-2.5 border border-black/5 shadow-md hover:bg-slate-50 transition-colors"
                title="Edit Community Settings"
              >
                <Settings size={18} className="text-slate-600" />
              </button>
            )}
          </div>
          
          <h1 className="text-3xl font-black mb-1 text-slate-800 tracking-tight">
            {isLoading ? 'Loading...' : guild?.name || 'Community'}
          </h1>
          <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mb-4">
            ID: {guild?.id || '---'}
          </p>
          <p className="text-slate-500 text-sm max-w-xs mb-8 leading-relaxed">
            {isLoading ? 'Fetching details...' : guild?.description || 'Join us in making the world a greener place, one step at a time.'}
          </p>

          <div className="flex gap-4 w-full max-w-sm">
            <div className="flex-1 bg-white rounded-[1.5rem] py-4 flex flex-col items-center shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <span className="text-2xl font-black text-slate-800 mb-0.5">{members.length}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Members</span>
            </div>
            <div className="flex-1 bg-white rounded-[1.5rem] py-4 flex flex-col items-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-emerald-50">
              <span className="text-2xl font-black text-emerald-500 mb-0.5">
                {members.reduce((acc, m) => acc + (m.total_trees_planted || 0), 0)}
              </span>
              <span className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-widest">Trees</span>
            </div>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="px-6 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span className="flex items-center">
            Top Contributors <Trophy size={18} className="ml-2 text-yellow-500" />
          </span>
          <span className="text-xs font-normal text-slate-400">{members.length}/75 Members</span>
        </h2>
        
        <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-visible relative">
          {isLoading ? (
            <div className="animate-pulse space-y-4 p-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : (
            members.map((member, index) => (
              <div 
                key={member.id} 
                onClick={() => setSelectedProfile(member)}
                className={`flex items-center p-4 cursor-pointer hover:bg-slate-50 transition-colors relative border-b border-slate-50 last:border-b-0 ${activeMenuId === member.id ? 'z-50' : 'z-0'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mr-3 ${
                  index === 0 ? 'bg-yellow-100 text-yellow-600' :
                  index === 1 ? 'bg-slate-200 text-slate-600' :
                  index === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-slate-50 text-slate-400'
                }`}>
                  {index + 1}
                </div>

                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {member.avatar ? (
                    (member.avatar.startsWith('http') || member.avatar.startsWith('/')) ? (
                      <img src={member.avatar} alt={member.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">{member.avatar}</span>
                    )
                  ) : (
                    <UserIcon size={20} className="text-slate-400" />
                  )}
                </div>
                
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex items-center">
                    <h3 className="font-bold text-slate-800 truncate">{member.username || 'User'}</h3>
                    {guild?.admin_id === member.id && (
                      <span className="ml-2 px-2 py-0.5 bg-[var(--color-teal-dark)]/10 text-[var(--color-teal-dark)] border border-[var(--color-teal-dark)]/20 text-[10px] font-bold uppercase rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-right mr-2 shrink-0">
                  <span className="block font-bold text-[var(--color-teal-dark)]">{member.total_trees_planted || 0}</span>
                  <span className="block text-[10px] text-slate-400 uppercase">Trees</span>
                </div>

                {/* Admin Actions Button */}
                {isAdmin && member.id !== currentUserId && (
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === member.id ? null : member.id);
                        setMuteMenuId(null);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                    >
                      <MoreVertical size={20} />
                    </button>

                    {/* Main Dropdown */}
                    {activeMenuId === member.id && (
                      <div className="absolute right-0 top-10 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {muteMenuId !== member.id ? (
                          <>
                            {(member.muted_until && (member.muted_until === -1 || member.muted_until > Date.now())) ? (
                              <button onClick={(e) => handleMute(member.id, 0, e, 'unmute')} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center">
                                <Mic size={16} className="mr-2 text-emerald-500" /> Unmute
                              </button>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setMuteMenuId(member.id); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center">
                                <MicOff size={16} className="mr-2 text-slate-400" /> Mute
                              </button>
                            )}
                            <button onClick={(e) => handleKick(member.id, e)} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center">
                              <UserMinus size={16} className="mr-2 text-red-500" /> Kick
                            </button>
                            <div className="h-px bg-slate-100" />
                            <button onClick={(e) => handleTransferAdmin(member.id, e)} className="w-full text-left px-4 py-3 text-sm text-orange-600 hover:bg-orange-50 flex items-center">
                              <ShieldAlert size={16} className="mr-2 text-orange-500" /> Make Admin
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="px-4 py-2 bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">Mute Duration</div>
                            <button onClick={(e) => handleMute(member.id, 6 * 60 * 60 * 1000, e)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">6 Hours</button>
                            <button onClick={(e) => handleMute(member.id, 24 * 60 * 60 * 1000, e)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">1 Day</button>
                            <button onClick={(e) => handleMute(member.id, 7 * 24 * 60 * 60 * 1000, e)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">7 Days</button>
                            <button onClick={(e) => handleMute(member.id, 30 * 24 * 60 * 60 * 1000, e)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">1 Month</button>
                            <button onClick={(e) => handleMute(member.id, -1, e)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Forever</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <button 
          onClick={handleLeave}
          disabled={isLeaving || (isAdmin && members.length > 1)}
          className={`w-full mt-6 py-4 rounded-[1.5rem] font-bold transition-all text-[15px] ${
            (isAdmin && members.length > 1) 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : 'bg-white text-red-500 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:bg-red-50 active:scale-[0.98]'
          }`}
        >
          {isLeaving ? 'Processing...' : (isAdmin && members.length > 1) ? 'Transfer admin to leave' : (isAdmin && members.length === 1) ? 'Delete Community' : 'Leave Community'}
        </button>
      </div>

      {/* Profile Modal */}
      <UserProfileModal 
        isOpen={!!selectedProfile} 
        onClose={() => setSelectedProfile(null)} 
        player={selectedProfile ? { ...selectedProfile, guildName: guild?.name } : null} 
      />

      {/* Edit Community Modal */}
      {isEditingCommunity && guild && (
        <EditCommunityModal 
          guild={guild}
          onClose={() => setIsEditingCommunity(false)}
          onUpdated={() => {
            setIsEditingCommunity(false);
            fetchGuild();
          }}
        />
      )}

      {/* Full Screen Avatar Preview Popup */}
      {isAvatarExpanded && guild?.icon && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-in fade-in duration-200"
          onClick={() => setIsAvatarExpanded(false)}
        >
          <div className="relative max-w-sm w-full">
            <button 
              className="absolute -top-12 right-0 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
              onClick={() => setIsAvatarExpanded(false)}
            >
              <X size={28} />
            </button>
            <div className="w-full aspect-square rounded-full border-4 border-[#1d3539] overflow-hidden bg-white/10 shadow-comic flex items-center justify-center text-9xl">
              {(guild.icon.startsWith('http') || guild.icon.startsWith('/')) ? (
                <img src={guild.icon} alt="community full" className="w-full h-full object-cover" />
              ) : (
                guild.icon
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
