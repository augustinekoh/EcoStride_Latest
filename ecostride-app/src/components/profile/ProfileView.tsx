import React, { useState, useEffect, useRef } from 'react';
import { useUserStore } from '../../stores/useUserStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { Settings, Edit2, Check, Globe, Building2, TreePine, Users, Award, Ticket, X, QrCode, Clock, Store, Camera, Loader2, Coins } from 'lucide-react';
import { apiClient, resolveAvatarUrl } from '../../lib/api';
import { formatLocation } from '../../lib/locationData';
import QRCode from 'react-qr-code';
import imageCompression from 'browser-image-compression';
import { AvatarCropModal } from '../modals/AvatarCropModal';
import { BadgeInfoModal } from '../modals/BadgeInfoModal';
import { BadgeShowcaseModal } from '../modals/BadgeShowcaseModal';
import { PointsStoreModal } from '../modals/PointsStoreModal';
import { PullCord } from 'pullcord';
import 'pullcord/pullcord.css';
import { useAppRefresh } from '../../hooks/useAppRefresh';

export const ProfileView: React.FC = () => {
  const { 
    username, 
    player_id,
    bio, 
    country,
    state,
    city,
    totalTreesPlanted, 
    streaks, 
    unlockedBadges,
    avatar,
    guildName,
    guildId,
    newsEnabled,
    dailyReminderEnabled,
    newFollowerEnabled,
    shareActivity,
    doNotDisturb,
    isDarkMode,
    activityHistory,
    setUserData,
    showcasedBadges,
    userCoins
  } = useUserStore();
  
  const { user } = useAuthStore();
  const { setActiveView } = useDemoStore();
  const issuesUnreadCount = useUserStore(state => state.issuesUnreadCount) || 0;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editBioText, setEditBioText] = useState(bio || '');
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'vouchers'>('overview');
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  
  // Redeem State
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  
  // Badge Info Modal
  const [selectedBadge, setSelectedBadge] = useState<any | null>(null);
  const [isEditingShowcase, setIsEditingShowcase] = useState(false);
  
  // Store Modal
  const [showStore, setShowStore] = useState(false);
  const [reportedCasesCount, setReportedCasesCount] = useState<number>(0);

  const fetchProfileCasesCount = async () => {
    if (!user?.uid) return;
    try {
      const res = await apiClient(`/users/${user.uid}/issues`);
      if (res.issues) {
        const activeIssues = res.issues.filter((i: any) => i.takedown_status !== 'taken-down');
        setReportedCasesCount(activeIssues.length);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshProfileData = async () => {
    if (user?.uid) {
      await Promise.allSettled([
        fetchVouchers(),
        fetchProfileCasesCount()
      ]);
    }
  };

  useAppRefresh(refreshProfileData);

  useEffect(() => {
    if (user?.uid) {
      fetchVouchers();
      fetchProfileCasesCount();
    }
  }, [user]);

  useEffect(() => {
    let timer: any;
    if (showRedeemModal && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            fetchVouchers(); // Refresh status
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showRedeemModal, countdown]);

  // Poll for successful redemption
  useEffect(() => {
    let pollTimer: any;
    if (showRedeemModal && selectedVoucher) {
      pollTimer = setInterval(async () => {
        try {
          const res = await apiClient(`/users/${user?.uid}/vouchers`);
          const updatedVoucher = res.vouchers?.find((v: any) => v.id === selectedVoucher.id);
          if (updatedVoucher && updatedVoucher.status === 'redeemed') {
            setShowRedeemModal(false);
            setSelectedVoucher(null);
            alert('🎉 Successfully redeemed!');
            setVouchers(res.vouchers || []);
          }
        } catch (e) {
          console.error(e);
        }
      }, 3000);
    }
    return () => clearInterval(pollTimer);
  }, [showRedeemModal, selectedVoucher, user?.uid]);

  const fetchVouchers = async () => {
    try {
      const res = await apiClient(`/users/${user?.uid}/vouchers`);
      setVouchers(res.vouchers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVouchers(false);
    }
  };

  const saveBio = async () => {
    setIsSavingBio(true);
    try {
      if (user) {
        await apiClient(`/users/${user.uid}`, {
          method: 'POST',
          body: JSON.stringify({ bio: editBioText })
        });
      }
      setUserData({ bio: editBioText });
      setIsEditingBio(false);
    } catch (e) {
      console.error(e);
      alert('Failed to save bio');
    } finally {
      setIsSavingBio(false);
    }
  };

  const handleStartRedeem = async () => {
    if (!selectedVoucher) return;
    setRedeemLoading(true);
    try {
      const res = await apiClient(`/purchases/${selectedVoucher.id}/redeem-start`, { method: 'PUT' });
      const timeLeft = Math.floor((res.expiresAt - Date.now()) / 1000);
      setCountdown(timeLeft > 0 ? timeLeft : 0);
      setShowRedeemModal(true);
      fetchVouchers(); // Refresh state to get updated expires_at if modal closed
    } catch (e: any) {
      alert(e.message || 'Failed to start redemption');
    } finally {
      setRedeemLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAvatarCropped = async (croppedBlob: Blob) => {
    if (!user) return;
    setCropImageSrc(null);
    setIsUploadingAvatar(true);
    
    try {
      const fileToCompress = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
      const options = {
        maxSizeMB: 0.05,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(fileToCompress, options);
      
      const formData = new FormData();
      formData.append('file', compressedFile, compressedFile.name);
      
      const res = await apiClient(`/users/${user.uid}/avatar`, {
        method: 'POST',
        body: formData
      });
      
      if (res.avatarUrl) {
         setUserData({ avatar: res.avatarUrl });
      }
    } catch (e) {
      console.error('Error uploading avatar:', e);
      alert('Failed to upload avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Bio Section */}
      <div className="glass-card p-6 relative z-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-[var(--color-text-muted)] uppercase tracking-widest">About Me</h3>
          {isEditingBio ? (
            <button onClick={saveBio} disabled={isSavingBio} className="w-8 h-8 glass-active rounded-full flex items-center justify-center text-[var(--color-teal-dark)] hover:-translate-y-1 transition-transform disabled:opacity-50">
              <Check size={16} />
            </button>
          ) : (
            <button onClick={() => setIsEditingBio(true)} className="w-8 h-8 glass-card rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:-translate-y-1 transition-transform border border-white/60 shadow-sm">
              <Edit2 size={14} />
            </button>
          )}
        </div>
        
        {isEditingBio ? (
          <textarea 
            value={editBioText}
            onChange={(e) => setEditBioText(e.target.value)}
            className="w-full glass-active border border-white/80 rounded-xl p-3 text-[var(--color-text-main)] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-dark)] resize-none transition-all"
            rows={3}
            autoFocus
            disabled={isSavingBio}
          />
        ) : (
          <p className="text-[var(--color-text-main)] font-bold text-sm leading-relaxed whitespace-pre-wrap">{bio || <span className="text-[var(--color-text-muted)] italic font-medium">No bio added yet...</span>}</p>
        )}
      </div>

      {/* Eco Coins & Group (Social) */}
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div onClick={() => setShowStore(true)} className="glass-card p-4 flex flex-col gap-2 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-transform group border border-white/60 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12 scale-150">
            <Coins size={100} />
          </div>
          <div className="w-10 h-10 bg-amber-100/50 rounded-full flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform shadow-sm relative z-10"><Coins size={20}/></div>
          <span className="text-xs font-bold text-[var(--color-text-muted)] relative z-10">Eco Coins</span>
          <span className="text-2xl font-black text-[var(--color-text-main)] relative z-10">{userCoins || 0}</span>
          <span className="text-[10px] text-amber-600 font-bold mt-1 group-hover:underline relative z-10 flex items-center gap-1">Spend in Store <Store size={10}/></span>
        </div>
        <div onClick={() => setActiveView('group')} className="glass-card p-4 flex flex-col gap-2 group cursor-pointer hover:shadow-md hover:-translate-y-1 transition-transform border border-white/60 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12 scale-150">
            <Building2 size={100} />
          </div>
          <div className="w-10 h-10 bg-blue-100/50 rounded-full flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform shadow-sm relative z-10"><Building2 size={20}/></div>
          <span className="text-xs font-bold text-[var(--color-text-muted)] relative z-10">Group</span>
          <span className="text-xl font-black text-[var(--color-text-main)] truncate relative z-10">{guildName || (guildId && guildId !== 'None' ? guildId : 'None')}</span>
          <span className="text-[10px] text-blue-600 font-bold mt-1 group-hover:underline relative z-10 flex items-center gap-1">View Group &rarr;</span>
        </div>
      </div>

      {/* Activity Stats */}
      <h3 className="text-sm font-black text-[var(--color-text-muted)] uppercase tracking-widest pl-2 relative z-10 mt-6">Activity Stats</h3>
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div 
          onClick={() => setActiveView('cases')}
          className="glass-card p-4 flex flex-col gap-2 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-transform group border border-white/60 relative"
        >
          {(issuesUnreadCount || 0) > 0 && (
            <div className="absolute -top-2 -right-2 shrink-0 min-w-[20px] h-[20px] bg-rose-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-20">
              <span className="text-[10px] font-bold text-white leading-none pt-[1px] px-1">{issuesUnreadCount > 99 ? '99+' : issuesUnreadCount}</span>
            </div>
          )}
          <div className="w-10 h-10 bg-orange-100/50 rounded-full flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform"><Building2 size={20}/></div>
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-[var(--color-text-muted)]">Cases Reported</span>
          </div>
          <span className="text-xl font-black text-[var(--color-text-main)] flex items-center gap-2">
            {reportedCasesCount} 
            <span className="text-[10px] text-orange-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">View Reports &rarr;</span>
          </span>
        </div>
        <div 
          onClick={() => setActiveView('map')}
          className="glass-card p-4 flex flex-col gap-2 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-transform group border border-white/60"
        >
          <div className="w-10 h-10 bg-[var(--color-soft-green)] rounded-full flex items-center justify-center text-[var(--color-teal-dark)] group-hover:scale-110 transition-transform"><TreePine size={20}/></div>
          <span className="text-xs font-bold text-[var(--color-text-muted)]">Trees Planted</span>
          <span className="text-xl font-black text-[var(--color-text-main)]">{totalTreesPlanted}</span>
        </div>
      </div>

      {/* Achievement Badges */}
      <div className="flex items-center gap-2 pl-2 mt-6 relative z-10 mb-2">
        <h3 className="text-sm font-black text-[var(--color-text-muted)] uppercase tracking-widest">Achievements</h3>
        <button onClick={() => setIsEditingShowcase(true)} className="p-1.5 glass-card rounded-md hover:text-[var(--color-text-main)] transition-colors text-[var(--color-text-muted)] flex items-center justify-center">
          <Edit2 size={12} />
        </button>
      </div>
      <div className="glass-card p-5 relative z-10 border border-white/60">
        <div className="flex flex-wrap gap-4">
          {(() => {
            let parsedUnlocked: any[] = [];
            if (typeof unlockedBadges === 'string') {
              try { parsedUnlocked = JSON.parse(unlockedBadges); } catch(e) {}
            } else if (Array.isArray(unlockedBadges)) {
              parsedUnlocked = unlockedBadges;
            }

            let parsedShowcased: string[] = [];
            if (typeof showcasedBadges === 'string') {
              try { parsedShowcased = JSON.parse(showcasedBadges); } catch(e) {}
            } else if (Array.isArray(showcasedBadges)) {
              parsedShowcased = showcasedBadges;
            }

            let badgesToRender: any[] = [];
            if (parsedShowcased.length > 0) {
              // Filter unlocked to only showcased
              badgesToRender = parsedUnlocked.filter(b => parsedShowcased.includes(b.id));
            } else {
              // Default: top 4 highest level, or first 4
              badgesToRender = [...parsedUnlocked].sort((a, b) => b.level - a.level).slice(0, 4);
            }
            
            return badgesToRender.length > 0 ? (
              badgesToRender.map((badge: any, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedBadge(badge)}
                  className="w-20 h-20 bg-gradient-to-br from-[var(--color-soft-green)] to-white rounded-2xl flex flex-col items-center justify-center border border-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-transform relative cursor-pointer"
                >
                  <div className="w-full h-full rounded-[15px] overflow-hidden flex items-center justify-center">
                    {badge.icon?.startsWith('http') ? (
                      <img src={badge.icon} alt={badge.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl drop-shadow-sm">{badge.icon}</span>
                    )}
                  </div>
                  {badge.level > 1 && (
                    <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white shadow-sm z-10">
                      Lv.{badge.level}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm font-bold text-[var(--color-text-muted)] py-4 w-full text-center">No badges unlocked yet.</p>
            );
          })()}
          <div className="w-20 h-20 bg-white/40 rounded-2xl flex items-center justify-center border-dashed border-2 border-white/80 opacity-60">
            <Award size={28} className="text-[var(--color-text-muted)]" />
          </div>
        </div>
      </div>

      {/* Avatar Cropper Modal */}
      <AvatarCropModal 
        isOpen={!!cropImageSrc}
        onClose={() => setCropImageSrc(null)}
        imageSrc={cropImageSrc}
        onConfirm={handleAvatarCropped}
      />
      
      {/* Badge Info Modal */}
      <BadgeInfoModal 
        badge={selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
      
      {/* Badge Showcase Modal */}
      {isEditingShowcase && (
        <BadgeShowcaseModal onClose={() => setIsEditingShowcase(false)} />
      )}
    </div>
  );

  const renderVouchers = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 relative z-10">
      {loadingVouchers ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[var(--color-teal-dark)] border-t-transparent rounded-full animate-spin"></div></div>
      ) : vouchers.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center border-dashed border-2 border-white/80">
          <Ticket size={48} className="text-[var(--color-text-muted)] mb-4 opacity-50" />
          <h3 className="text-lg font-black text-[var(--color-text-muted)] mb-2">No Vouchers Found</h3>
          <p className="text-sm text-[var(--color-text-muted)] font-medium">You haven't purchased any vouchers from the Point Store yet.</p>
        </div>
      ) : (
        vouchers.map((v, i) => {
          let statusColor = 'glass-card border-white/60';
          let statusBadge = 'bg-[var(--color-teal-dark)] text-white';
          if (v.status === 'redeemed') {
            statusColor = 'glass-active border-white/40 opacity-70';
            statusBadge = 'bg-[var(--color-text-muted)] text-white';
          } else if (v.status === 'expired' || v.status === 'disabled' || v.status === 'disabled_by_admin') {
            statusColor = 'bg-red-50/50 backdrop-blur-md border border-red-200/50 opacity-80';
            statusBadge = 'bg-red-500 text-white shadow-sm';
          } else if (v.expires_at && Date.now() < v.expires_at) {
            statusColor = 'bg-orange-50/50 backdrop-blur-md border border-orange-200/50';
            statusBadge = 'bg-orange-500 text-white shadow-sm';
          }

          return (
            <div 
              key={i} 
              onClick={() => {
                if (v.status === 'active' || (v.status === 'active' && v.expires_at && Date.now() < v.expires_at)) {
                  setSelectedVoucher(v);
                  if (v.expires_at && Date.now() < v.expires_at) {
                    setCountdown(Math.floor((v.expires_at - Date.now()) / 1000));
                    setShowRedeemModal(true);
                  }
                }
              }}
              className={`border p-4 rounded-[1.5rem] flex flex-col gap-3 relative overflow-hidden transition-all shadow-sm ${(v.status === 'active' && (!v.expires_at || Date.now() > v.expires_at)) ? 'hover:-translate-y-1 hover:shadow-md cursor-pointer' : ''} ${statusColor}`}
            >
              <div className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-wider flex items-center">
                <span className={`px-2.5 py-1.5 rounded-full ${statusBadge} shadow-sm border border-black/5`}>
                  {v.status === 'active' && v.expires_at && Date.now() < v.expires_at ? 'PENDING REDEEM' : v.status === 'disabled_by_admin' ? 'DISABLED' : v.status.replace(/_/g, ' ')}
                </span>
              </div>
              
              <div className="flex items-start gap-4 pr-24">
                <div className="w-16 h-16 bg-white/60 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-white/80 shrink-0">
                  {v.icon || '🎟️'}
                </div>
                <div>
                  <h4 className="font-black text-[var(--color-text-main)] text-base leading-tight mb-1">{v.item_name}</h4>
                  <p className="text-xs font-bold text-[var(--color-text-muted)] flex items-center gap-1 mb-1">
                    <Store size={12}/> {v.store_name}
                  </p>
                  <p className="text-xs text-[var(--color-text-main)] opacity-80 line-clamp-2 leading-relaxed">{v.item_desc}</p>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <div 
      className="h-full w-full overflow-y-auto pb-32 relative bg-[var(--color-bg-main)] transition-colors duration-500 custom-scrollbar"
    >
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-[var(--color-pastel-yellow)]/30 to-transparent pointer-events-none transition-colors duration-500"></div>

      <div className="absolute top-20 right-0 w-64 h-64 bg-[var(--color-pastel-yellow)] rounded-full mix-blend-overlay filter blur-3xl opacity-60 animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-40 left-[-2rem] w-80 h-80 bg-[var(--color-soft-green-2)] rounded-full mix-blend-overlay filter blur-3xl opacity-40 pointer-events-none"></div>
      
      {/* Header Nav */}
      <div className="relative flex justify-between items-center p-4 md:p-8 z-50">
        <div className="flex items-center gap-2 px-3 py-1.5 glass-card rounded-full shadow-sm border border-white/60">
          <Globe size={14} className="text-[var(--color-teal-dark)]"/>
          <span className="text-xs font-black text-[var(--color-text-main)] uppercase tracking-widest">{formatLocation(city, state, country) || 'Location Unassigned'}</span>
        </div>
        
        <div className="relative" style={{ transform: 'translateZ(0)', '--pullcord-top': '-15px', '--pullcord-right': '20px', '--pullcord-z': 0 } as React.CSSProperties}>
          {/* Easter Egg Theme Toggle anchored to Settings button */}
          <PullCord 
            onPull={() => setUserData({ isDarkMode: !isDarkMode })}
            pulled={isDarkMode}
            ariaLabel="Toggle theme"
          />
          <button 
            onClick={() => setActiveView('settings')}
            className="w-10 h-10 glass-card rounded-full flex items-center justify-center hover:-translate-y-1 transition-transform border border-white/60 shadow-sm relative z-10"
          >
            <Settings size={20} className="text-[var(--color-text-main)]" />
          </button>
        </div>
      </div>

      <div className="px-4 md:px-8 mt-2">
        {/* Profile Info */}
        <div className="flex flex-col items-center mb-8 relative z-20">
          <label className={`w-28 h-28 rounded-full overflow-hidden glass-card shrink-0 flex items-center justify-center p-1 mb-4 shadow-lg border border-white/60 hover:-translate-y-1 transition-transform duration-300 relative group ${isUploadingAvatar ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileSelect}
              ref={fileInputRef}
              disabled={isUploadingAvatar}
            />
            <img 
              src={resolveAvatarUrl(avatar, username)} 
              alt="Avatar" 
              className="w-full h-full object-cover rounded-full bg-white/30 backdrop-blur-sm"
            />
            {/* Upload Overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full m-1 backdrop-blur-[2px]">
              {isUploadingAvatar ? <Loader2 className="text-white animate-spin" size={24} /> : <Camera className="text-white" size={24} />}
            </div>
          </label>
          <h2 className="text-2xl font-black tracking-tight text-[var(--color-text-main)] flex flex-col items-center gap-1">
            {username}
            <span className="text-sm font-bold text-[var(--color-teal-dark)] bg-white/50 backdrop-blur-md px-3 py-1 rounded-full uppercase tracking-widest border border-white/60 shadow-sm">#{player_id}</span>
          </h2>
        </div>

        {/* Custom Tabs */}
        <div className="flex glass-card p-1.5 rounded-2xl border border-white/60 shadow-sm mb-6 relative z-20">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === 'overview' ? 'bg-[var(--color-teal-dark)] text-white shadow-md' : 'text-[var(--color-text-muted)] hover:bg-white/40'}`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('vouchers')}
            className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === 'vouchers' ? 'bg-[var(--color-teal-dark)] text-white shadow-md' : 'text-[var(--color-text-muted)] hover:bg-white/40'}`}
          >
            My Vouchers
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' ? renderOverview() : renderVouchers()}
      </div>

      {/* Redeem Confirmation / QR Modal */}
      {selectedVoucher && (
        <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pointer-events-none transition-opacity duration-300 ${activeTab === 'vouchers' && selectedVoucher && !showRedeemModal ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto" onClick={() => setSelectedVoucher(null)}></div>
          <div className="glass-card w-full max-w-md rounded-[2rem] p-6 pb-12 sm:pb-6 relative z-10 pointer-events-auto transform transition-transform duration-300 translate-y-0 shadow-2xl border-2 border-white/60">
            <div className="w-12 h-1.5 bg-white/50 rounded-full mx-auto mb-6 sm:hidden backdrop-blur-md"></div>
            
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-[var(--color-soft-green)] rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner border border-white/80">
                {selectedVoucher.icon}
              </div>
              <h3 className="text-2xl font-black text-[var(--color-text-main)] mb-2">{selectedVoucher.item_name}</h3>
              <p className="text-sm font-bold text-[var(--color-text-muted)] mb-1 flex items-center justify-center gap-1"><Store size={14}/> {selectedVoucher.store_name}</p>
            </div>
            
            <div className="glass-active p-4 rounded-2xl mb-8 border border-white/40">
              <p className="text-sm font-bold text-[var(--color-text-main)] text-center">Are you sure you want to redeem this voucher? Once started, you have 15 minutes to scan it at the shop.</p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setSelectedVoucher(null)}
                className="flex-1 py-4 font-black rounded-2xl text-[var(--color-text-muted)] glass-active hover:text-[var(--color-text-main)] hover:bg-white/40 transition-colors border border-white/40"
              >
                Cancel
              </button>
              <button 
                onClick={handleStartRedeem}
                disabled={redeemLoading}
                className="flex-1 py-4 font-black rounded-2xl text-white bg-[var(--color-teal-dark)] hover:bg-teal-700 transition-colors shadow-lg disabled:opacity-50 border border-[var(--color-teal-dark)]"
              >
                {redeemLoading ? 'Starting...' : 'Confirm Redeem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live QR Modal */}
      {showRedeemModal && selectedVoucher && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-xl p-4 animate-in fade-in">
          <button 
            onClick={() => { setShowRedeemModal(false); setSelectedVoucher(null); fetchVouchers(); }}
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="text-center mb-8 animate-in slide-in-from-bottom-4">
            <h3 className="text-2xl font-black text-white mb-2">{selectedVoucher.item_name}</h3>
            <p className="text-[var(--color-pastel-yellow)] font-bold flex items-center justify-center gap-2"><Store size={16}/> {selectedVoucher.store_name}</p>
          </div>

          <div className="bg-white/90 p-6 rounded-[2rem] shadow-[0_0_40px_rgba(20,184,166,0.2)] mb-8 relative animate-in zoom-in-95 border-4 border-white/50">
            <QRCode value={selectedVoucher.id} size={250} level="H" fgColor="#0f172a" bgColor="transparent" />
            
            {/* Countdown Overlay */}
            {countdown === 0 && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-md rounded-[2rem] flex flex-col items-center justify-center border-2 border-red-100">
                <X size={48} className="text-red-500 mb-2"/>
                <h4 className="font-black text-xl text-[var(--color-text-main)]">QR Expired</h4>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 glass-card px-6 py-3 rounded-full border border-white/20">
            <Clock size={20} className={countdown > 60 ? 'text-[var(--color-pastel-yellow)]' : 'text-red-400 animate-pulse'} />
            <span className={`font-black tracking-widest text-xl ${countdown > 60 ? 'text-white' : 'text-red-400'}`}>
              {formatTime(countdown)}
            </span>
          </div>
          
          <p className="text-slate-300 text-sm font-bold mt-6 text-center max-w-xs leading-relaxed">
            Present this QR code to the cashier to scan before the timer runs out.
          </p>
        </div>
      )}
      {showStore && <PointsStoreModal onClose={() => setShowStore(false)} />}
    </div>
  );
};

