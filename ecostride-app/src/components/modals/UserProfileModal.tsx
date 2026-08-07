import React, { useState, useEffect } from 'react';
import { X, User, UserPlus, UserMinus, Check, Clock, TreePine, Award, Footprints, Users, AlertTriangle } from 'lucide-react';
import { auth } from '../../firebase';
import { apiClient } from '../../lib/api';
import { BadgeInfoModal } from './BadgeInfoModal';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: any | null;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, player }) => {
  const [stats, setStats] = useState<any>(null);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [loading, setLoading] = useState(false);
  const [isAvatarExpanded, setIsAvatarExpanded] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [selectedBadge, setSelectedBadge] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen || !player?.id) return;
    const currentUserId = auth.currentUser?.uid;
    
    const loadProfile = async () => {
      setLoading(true);
      try {
        const [userRes, friendsRes] = await Promise.all([
          apiClient(`/users/${player.id}`),
          currentUserId ? apiClient(`/friends/${currentUserId}`) : Promise.resolve({ friends: [] })
        ]);
        
        if (userRes.user) setStats(userRes.user);
        
        if (friendsRes.friends) {
          const friend = friendsRes.friends.find((f: any) => f.id === player.id);
          if (friend) {
            setFriendStatus(friend.status);
          } else {
            setFriendStatus('none');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [isOpen, player]);

  const handleAddFriend = async () => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId || !player?.id) return;
    
    try {
      await apiClient(`/friends/${currentUserId}`, {
        method: 'POST',
        body: JSON.stringify({ friendId: player.id })
      });
      setFriendStatus('pending');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnfriend = async () => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId || !player?.id) return;
    
    try {
      await apiClient(`/friends/${currentUserId}/${player.id}`, {
        method: 'DELETE'
      });
      setFriendStatus('none');
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen || !player) return null;

  const displayUser = stats || player;
  const isMe = auth.currentUser?.uid === player.id;
  
  // Robust data fetching from DB/Store keys
  const treesPlanted = displayUser.total_trees_planted ?? displayUser.treesPlanted ?? displayUser.totalTreesPlanted ?? 0;
  const distanceRaw = displayUser.total_distance_km ?? displayUser.totalDistanceKm ?? displayUser.total_distance_walked ?? displayUser.distanceWalked ?? 0;
  const distanceWalked = typeof distanceRaw === 'number' ? `${distanceRaw.toFixed(2)}km` : (distanceRaw || '0km');
  const communityJoined = displayUser.guildName ?? displayUser.guild_name ?? displayUser.guild_id ?? displayUser.guildId ?? displayUser.community ?? 'None';
  const casesReported = displayUser.cases_reported ?? displayUser.casesReported ?? 0;
  const nationality = displayUser.nationality || 'Global Citizen';
  const bio = displayUser.bio || "This user hasn't written a bio yet.";

  let badges: any[] = [];
  try {
    badges = JSON.parse(displayUser.unlocked_badges || '[]');
  } catch (e) {}

  let showcased: string[] = [];
  try {
    showcased = JSON.parse(displayUser.showcased_badges || '[]');
  } catch (e) {}

  let badgesToRender: any[] = [];
  if (showcased.length > 0) {
    badgesToRender = badges.filter(b => showcased.includes(b.id));
  } else {
    badgesToRender = [...badges].sort((a, b) => b.level - a.level).slice(0, 4);
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      {/* Main Modal Wrapper with Vibrant Gradient and Glassmorphism borders */}
      <div 
        className="rounded-[2.5rem] w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-90 duration-300 relative border-4 border-[#1d3539] shadow-comic"
        style={{ background: 'linear-gradient(135deg, #e9efce, #fff4d6, #e9efce, #d8e2bc)' }}
      >
        
        {/* Header - Glassmorphic */}
        <div className="bg-white/10 backdrop-blur-md border-b border-white/30 p-4 flex justify-between items-center text-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <User className="text-slate-800" size={24} />
            <h2 className="text-xl font-black uppercase tracking-wider text-slate-800 drop-shadow-sm">User Profile</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors border border-transparent hover:border-white/30">
            <X size={24} className="text-slate-800" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center gap-5 text-center overflow-y-auto custom-scrollbar">
          
          {/* Profile Picture - Frosted Border */}
          <div 
            onClick={() => setIsAvatarExpanded(true)}
            className="w-24 h-24 rounded-full border-4 border-white/40 bg-white/20 backdrop-blur-lg flex items-center justify-center text-5xl shadow-lg overflow-hidden shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          >
            {displayUser.avatar && (displayUser.avatar.startsWith('http') || displayUser.avatar.startsWith('/')) ? (
              <img src={displayUser.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              displayUser.avatar || '👤'
            )}
          </div>
          
          <div className="flex flex-col items-center gap-1 w-full text-slate-900">
            <h3 className="text-2xl font-black flex items-center justify-center gap-2 leading-tight drop-shadow-sm">
              {displayUser.username || displayUser.name || displayUser.email?.split('@')[0] || 'Jane Doe'}
            </h3>
            
            {/* UID */}
            <div className="bg-white/20 backdrop-blur-md rounded-full px-4 py-1 inline-block border border-white/40 mt-1 shadow-sm">
              <span className="text-xs font-black tracking-wide">UID: {displayUser.player_id || '10101010'}</span>
            </div>
            
            {/* Nationality */}
            <p className="text-sm font-bold mt-2 drop-shadow-sm">
              {nationality}
            </p>

            {/* Bio */}
            <p className="text-sm font-medium italic px-4 mt-2 mb-2 leading-snug drop-shadow-sm">
              {bio}
            </p>
          </div>

          {loading ? (
            <div className="py-8"><div className="animate-spin text-2xl text-slate-800">⌛</div></div>
          ) : (
            <div className="w-full flex flex-col gap-4">
              {/* 4 Stats Blocks - Heavy Glass */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-2xl p-4 flex flex-col items-center justify-center shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-transform hover:-translate-y-1">
                  <Footprints className="text-slate-800 mb-1" size={20} />
                  <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight drop-shadow-sm">Total Distance<br/>Walked</span>
                  <span className="text-xl font-black text-slate-900 mt-1 drop-shadow-sm">{distanceWalked}</span>
                </div>
                <div className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-2xl p-4 flex flex-col items-center justify-center shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-transform hover:-translate-y-1">
                  <TreePine className="text-emerald-700 mb-1" size={20} />
                  <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight drop-shadow-sm">Total Trees<br/>Planted</span>
                  <span className="text-xl font-black text-emerald-800 mt-1 drop-shadow-sm">{treesPlanted}</span>
                </div>
                <div 
                  className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-2xl p-4 flex flex-col items-center justify-center shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-transform hover:-translate-y-1 cursor-pointer active:scale-95"
                  onClick={() => {
                    if (communityJoined !== 'None') {
                      try {
                        if (navigator.clipboard && window.isSecureContext) {
                          navigator.clipboard.writeText(communityJoined).catch(() => {});
                        }
                      } catch (e) {
                        console.warn('Clipboard write failed', e);
                      }
                      // Always show copied state for UX even if clipboard fails (mobile http workaround)
                      setCopyMsg('Copied!');
                      setTimeout(() => setCopyMsg(''), 2000);
                    }
                  }}
                  title={communityJoined !== 'None' ? "Click to copy full name" : ""}
                >
                  <Users className="text-blue-700 mb-1" size={20} />
                  <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight drop-shadow-sm">Community<br/>Joined</span>
                  {copyMsg ? (
                    <span className="text-sm font-black text-emerald-600 mt-1 drop-shadow-sm">{copyMsg}</span>
                  ) : (
                    <span className="text-xl font-black text-blue-800 mt-1 drop-shadow-sm truncate w-full text-center">{communityJoined}</span>
                  )}
                </div>
                <div className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-2xl p-4 flex flex-col items-center justify-center shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-transform hover:-translate-y-1">
                  <AlertTriangle className="text-amber-700 mb-1" size={20} />
                  <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight drop-shadow-sm">Total Cases<br/>Reported</span>
                  <span className="text-xl font-black text-amber-800 mt-1 drop-shadow-sm">{casesReported}</span>
                </div>
              </div>

              {/* Achievements - Heavy Glass */}
              <div className="w-full bg-white/20 backdrop-blur-2xl border border-white/40 rounded-2xl p-5 text-left shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-2 text-slate-800 font-black mb-4 drop-shadow-sm">
                  <Award size={22} className="text-amber-600" />
                  <span className="text-lg">Achievements</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {badgesToRender.length > 0 ? badgesToRender.map((badge, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedBadge(badge)}
                      className="aspect-[4/3] w-full bg-white/40 backdrop-blur-md border border-white/50 rounded-2xl flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-105 relative cursor-pointer group"
                    >
                      <span className="text-3xl mb-1 drop-shadow-sm group-hover:scale-110 transition-transform">{badge.icon}</span>
                      <span className="text-[10px] font-black text-slate-800 text-center uppercase tracking-wider leading-tight px-2 line-clamp-2">{badge.name}</span>
                      {badge.level > 1 && (
                        <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border border-white shadow-sm">
                          Lv.{badge.level}
                        </div>
                      )}
                    </div>
                  )) : (
                    <span className="text-sm font-bold text-slate-700/60 w-full text-center py-4">No achievements yet</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {!isMe && (
                <div className="w-full mt-2">
                  {friendStatus === 'none' && (
                    <button 
                      onClick={handleAddFriend}
                      className="w-full bg-emerald-400/80 backdrop-blur-lg text-emerald-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-400 border border-white/50 shadow-[0_4px_20px_rgba(52,211,153,0.3)] hover:shadow-[0_6px_25px_rgba(52,211,153,0.4)] transition-all hover:-translate-y-1"
                    >
                      <UserPlus size={22} />
                      <span className="text-lg">Add Friend</span>
                    </button>
                  )}
                  {friendStatus === 'pending' && (
                    <div className="w-full bg-white/30 backdrop-blur-lg text-slate-700 font-black py-4 rounded-2xl flex items-center justify-center gap-2 border border-white/50 shadow-sm">
                      <Clock size={22} />
                      <span className="text-lg">Request Sent</span>
                    </div>
                  )}
                  {friendStatus === 'accepted' && (
                    <button 
                      onClick={handleUnfriend}
                      className="w-full bg-rose-400/80 backdrop-blur-lg text-rose-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-400 border border-white/50 shadow-[0_4px_20px_rgba(244,63,94,0.3)] hover:shadow-[0_6px_25px_rgba(244,63,94,0.4)] transition-all hover:-translate-y-1"
                    >
                      <UserMinus size={22} />
                      <span className="text-lg">Unfriend</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
        
        {/* Badge Info Modal */}
        <BadgeInfoModal 
          badge={selectedBadge}
          onClose={() => setSelectedBadge(null)}
        />
      </div>
      
      {/* Full Screen Avatar Preview Popup */}
      {isAvatarExpanded && (
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
              {displayUser.avatar && (displayUser.avatar.startsWith('http') || displayUser.avatar.startsWith('/')) ? (
                <img src={displayUser.avatar} alt="avatar full" className="w-full h-full object-cover" />
              ) : (
                displayUser.avatar || 'dY` '
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
