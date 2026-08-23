import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { apiClient, resolveImageUrl } from '../../lib/api';
import { Calendar, Coins, ArrowRight, Upload, MapPin, Activity, CheckCircle, Info, AlertTriangle, Image as ImageIcon, Loader2, Filter } from 'lucide-react';
import { AvatarCropModal } from '../modals/AvatarCropModal';
import { compressImage } from '../../lib/imageUtils';
import { useAppRefresh } from '../../hooks/useAppRefresh';

export const CityView: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View State
  const [activeTab, setActiveTab] = useState<'explore' | 'my-events' | 'past-events' | 'community'>('explore');
  const [isTabsExpanded, setIsTabsExpanded] = useState(false);

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showSubmissionPanel, setShowSubmissionPanel] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Celebration State
  const [celebratingEvent, setCelebratingEvent] = useState<any | null>(null);

  const fetchEvents = async () => {
    try {
      const res = await apiClient(`/city-events/events?t=${Date.now()}`);
      setEvents(res.events || []);
      setBadges(res.badges || []);
      setParticipants(res.participants || []);
      setSubmissions(res.submissions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useAppRefresh(fetchEvents);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Check for completed events to celebrate
  useEffect(() => {
    if (loading || events.length === 0 || participants.length === 0 || badges.length === 0) return;
    
    try {
      const stored = localStorage.getItem('celebrated_events');
      const celebratedIds: string[] = stored ? JSON.parse(stored) : [];

      const now = Date.now();
      const completedEvents = events.filter(e => {
        if (now > e.end_date) return false; // Event has passed
        if (celebratedIds.includes(e.id)) return false;
        const part = participants.find(p => p.event_id === e.id);
        if (!part) return false;
        
        const eventBadges = badges.filter(b => b.event_id === e.id).sort((a, b) => a.target_value - b.target_value);
        const maxTarget = eventBadges.length > 0 ? eventBadges[eventBadges.length - 1].target_value : 1;
        
        return part.current_score >= maxTarget;
      });

      if (completedEvents.length > 0) {
        setCelebratingEvent(completedEvents[0]);
        triggerConfetti();
      }
    } catch(e) {
      console.error(e);
    }
  }, [events, participants, badges, loading, celebratingEvent]);

  const triggerConfetti = () => {
    const duration = 4 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#34d399', '#fbbf24', '#60a5fa'], zIndex: 1005 });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#34d399', '#fbbf24', '#60a5fa'], zIndex: 1005 });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const handleCloseCelebration = () => {
    if (!celebratingEvent) return;
    const stored = localStorage.getItem('celebrated_events');
    const celebratedIds: string[] = stored ? JSON.parse(stored) : [];
    celebratedIds.push(celebratingEvent.id);
    localStorage.setItem('celebrated_events', JSON.stringify(celebratedIds));
    setCelebratingEvent(null);
  };

  const handleJoin = async (e: any) => {
    if (!window.confirm(`Join ${e.title} for ${e.entry_fee} coins?`)) return;
    try {
      await apiClient(`/city-events/events/${e.id}/join`, { method: 'POST' });
      alert('Joined successfully!');
      setSelectedEvent(null);
      fetchEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to join');
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropModalOpen(false);
    setUploadingImage(true);
    try {
      const file = new File([blob], 'proof.jpg', { type: 'image/jpeg' });
      const compressedFile = await compressImage(file, 800, 800, 0.8, false);
      const formData = new FormData();
      formData.append('file', compressedFile);
      
      const res = await apiClient('/city-events/admin/images', {
        method: 'POST',
        body: formData
      });
      
      if (res.success && res.url) {
        setUploadUrl(res.url);
      } else {
        throw new Error(res.error || 'Upload failed');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      setCropImageSrc(null);
    }
  };

  const handleUploadProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!uploadUrl) {
      alert('Please select and upload a photo first!');
      return;
    }
    try {
      await apiClient(`/city-events/events/${selectedEvent.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ proof_url: uploadUrl, description: uploadDesc })
      });
      alert('Proof submitted for review!');
      setUploadUrl('');
      setUploadDesc('');
      fetchEvents();
    } catch (err) {
      alert('Failed to submit proof');
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center font-bold text-slate-500 animate-pulse">Loading City Events...</div>;

  const now = Date.now();
  
  // Logic for Explore Tab: Active and Upcoming events the user has NOT joined
  const exploreEvents = events.filter(e => now <= e.end_date && !participants.find(p => p.event_id === e.id));
  
  // Logic for My Events: Active and Upcoming events the user HAS joined
  const myEvents = events.filter(e => now <= e.end_date && participants.find(p => p.event_id === e.id));

  // Logic for Past Events: Expired events the user HAS joined
  const pastEvents = events.filter(e => now > e.end_date && participants.find(p => p.event_id === e.id));

  const getTimeRemainingText = (e: any) => {
    const _now = Date.now();
    if (_now < e.start_date) {
      const diff = e.start_date - _now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? `Starts in ${days}d` : `Starts in ${Math.floor(diff / (1000 * 60 * 60))}h`;
    } else if (_now <= e.end_date) {
      const diff = e.end_date - _now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? `Ends in ${days}d` : `Ends in ${Math.floor(diff / (1000 * 60 * 60))}h`;
    } else {
      return 'Ended';
    }
  };

  const getStatusBadge = (e: any) => {
    const _now = Date.now();
    if (_now < e.start_date) return { text: 'Upcoming', color: 'bg-blue-100 text-blue-700' };
    if (_now > e.end_date) return { text: 'Ended', color: 'bg-slate-100 text-slate-500' };
    return { text: 'Active', color: 'bg-emerald-100 text-emerald-700' };
  };

  return (
    <div className="h-full w-full bg-brand-cream p-4 md:p-8 font-sans overflow-y-auto pb-48 custom-scrollbar">
      <div className="max-w-6xl mx-auto px-1 sm:px-8 py-4 sm:py-8 md:py-12 relative z-10 min-h-screen flex flex-col">
        
        {/* Header */}
        <div className="text-left md:text-center animate-in slide-in-from-bottom-4 duration-500 mb-6 md:mb-8 md:bg-white/40 md:backdrop-blur-md md:p-6 md:rounded-[2rem] md:border md:border-white/60 md:shadow-sm mx-auto w-full max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-black text-teal-950 mb-1 sm:mb-3 tracking-tight drop-shadow-sm flex items-center md:justify-center gap-2">
            City Hub <span className="text-emerald-500 text-2xl md:hidden">✨</span>
          </h2>
          <p className="text-xs md:text-base font-bold text-teal-700/60 md:text-teal-800/80 max-w-xl md:mx-auto">
            Participate in official city campaigns, challenge yourself, and earn exclusive badges!
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex md:justify-center mb-6 md:mb-8 items-center w-full relative">
          <div className="flex-1 overflow-x-auto md:overflow-visible no-scrollbar flex items-center gap-3 md:gap-1 md:bg-white/60 md:backdrop-blur-md md:p-1.5 md:rounded-2xl md:shadow-sm md:border md:border-teal-100 md:w-max md:flex-none md:mx-auto pb-1 md:pb-0">
            <button 
              onClick={() => setActiveTab('explore')}
              className={`whitespace-nowrap px-4 py-1.5 md:px-6 md:py-2.5 rounded-full md:rounded-xl font-bold text-sm transition-all shadow-sm md:shadow-none ${activeTab === 'explore' ? 'bg-teal-500 text-white md:bg-teal-600 md:shadow-md' : 'max-md:bg-white/60 max-md:backdrop-blur-md max-md:border max-md:border-white/50 text-teal-700 md:hover:bg-teal-50'}`}
            >
              Explore
            </button>
            <button 
              onClick={() => setActiveTab('my-events')}
              className={`whitespace-nowrap px-4 py-1.5 md:px-6 md:py-2.5 rounded-full md:rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 shadow-sm md:shadow-none ${activeTab === 'my-events' ? 'bg-teal-500 text-white md:bg-teal-600 md:shadow-md' : 'max-md:bg-white/60 max-md:backdrop-blur-md max-md:border max-md:border-white/50 text-teal-700 md:hover:bg-teal-50'}`}
            >
              My Campaigns
              {myEvents.length > 0 && (
                <span className={`w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full text-[10px] sm:text-xs ${activeTab === 'my-events' ? 'bg-white text-teal-500 md:text-teal-700' : 'max-md:bg-teal-100/50 text-teal-700 md:bg-teal-600 md:text-white'}`}>{myEvents.length}</span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('past-events')}
              className={`whitespace-nowrap px-4 py-1.5 md:px-6 md:py-2.5 rounded-full md:rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 shadow-sm md:shadow-none ${activeTab === 'past-events' ? 'bg-teal-500 text-white md:bg-teal-600 md:shadow-md' : 'max-md:bg-white/60 max-md:backdrop-blur-md max-md:border max-md:border-white/50 text-teal-700 md:hover:bg-teal-50'}`}
            >
              History
              {pastEvents.length > 0 && (
                <span className={`w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full text-[10px] sm:text-xs ${activeTab === 'past-events' ? 'bg-white text-teal-500 md:text-teal-700' : 'max-md:bg-teal-100/50 text-teal-700 md:bg-teal-600 md:text-white'}`}>{pastEvents.length}</span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('community')}
              className={`whitespace-nowrap px-4 py-1.5 md:px-6 md:py-2.5 rounded-full md:rounded-xl font-bold text-sm transition-all shadow-sm md:shadow-none ${activeTab === 'community' ? 'bg-teal-500 text-white md:bg-teal-600 md:shadow-md' : 'max-md:bg-white/60 max-md:backdrop-blur-md max-md:border max-md:border-white/50 text-teal-700 md:hover:bg-teal-50'}`}
            >
              Community
            </button>
          </div>
        </div>

        {/* TAB: EXPLORE */}
        {activeTab === 'explore' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
            <section>
              <h3 className="text-2xl font-black text-teal-900 mb-6 flex items-center gap-2">
                <Activity className="text-emerald-500" /> New Campaigns
              </h3>
              {exploreEvents.length === 0 ? (
                <div className="bg-white/50 border-2 border-dashed border-teal-200/50 rounded-3xl p-8 text-center text-teal-700/50 italic font-bold">
                  You've joined all active campaigns, or there are none available right now!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {exploreEvents.map(e => {
                    const status = getStatusBadge(e);
                    return (
                      <div key={e.id} onClick={() => setSelectedEvent(e)} className="group cursor-pointer bg-white md:rounded-3xl rounded-2xl shadow-sm md:shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-slate-100 md:hover:-translate-y-1 flex flex-row md:flex-col p-2 md:p-0 gap-2 md:gap-0">
                        <div className="w-[140px] aspect-video md:w-full bg-slate-100 relative rounded-xl md:rounded-none overflow-hidden shrink-0">
                          {e.promo_image ? (
                            <img src={resolveImageUrl(e.promo_image)} alt={e.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center">
                              <Calendar size={32} className="text-white/50 md:w-12 md:h-12" />
                            </div>
                          )}
                          <div className="absolute top-2 left-2 md:top-3 md:left-3">
                            <span className={`text-[8px] md:text-[10px] font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded-full uppercase tracking-wider shadow-sm ${status.color}`}>
                              {status.text}
                            </span>
                          </div>
                          <div className="absolute bottom-2 right-2 md:top-3 md:right-3 md:bottom-auto bg-slate-900/60 backdrop-blur-sm text-white text-[9px] md:text-xs font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg">
                            {getTimeRemainingText(e)}
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col min-w-0 md:p-6 justify-center py-1">
                          <h4 className="text-sm md:text-xl font-bold text-slate-800 line-clamp-1 mb-1 md:mb-2">{e.title}</h4>
                          <p className="text-[10px] md:text-sm text-slate-500 line-clamp-2 mb-2 md:mb-4">{e.description}</p>
                          <div className="flex items-center justify-between mt-auto">
                            <span className="flex items-center gap-1 text-[10px] md:text-sm font-bold text-amber-600 bg-amber-50 px-2 py-0.5 md:px-3 md:py-1 rounded-full">
                              <Coins size={12} className="md:w-4 md:h-4" /> {e.entry_fee}
                            </span>
                            <span className="text-white bg-teal-500 text-[10px] md:text-sm font-bold md:bg-transparent md:text-teal-600 px-3 py-1 rounded-full md:px-0 flex items-center md:group-hover:gap-2 transition-all">
                              <span className="md:hidden">Details</span>
                              <span className="hidden md:inline">Details</span>
                              <ArrowRight size={16} className="hidden md:inline" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB: COMMUNITY */}
        {activeTab === 'community' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-300">
            <section>
              <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-2 border-dashed border-indigo-200/50 rounded-[3rem] p-16 text-center flex flex-col items-center justify-center transition-all min-h-[50vh] hover:bg-white/40">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-indigo-500/20 rotate-3">
                  <MapPin className="text-white" size={40} />
                </div>
                <h3 className="text-4xl font-black text-indigo-950 mb-4 drop-shadow-sm">Community Events</h3>
                <p className="text-lg text-indigo-800/70 font-bold max-w-xl">
                  Local community-driven events, territory battles, and special gameplay mechanics are currently under construction. Stay tuned for a massive update!
                </p>
              </div>
            </section>
          </div>
        )}

        {/* TAB: MY EVENTS */}
        {activeTab === 'my-events' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-2xl font-black text-teal-900 flex items-center gap-2">
              <CheckCircle className="text-emerald-500" /> My Active Campaigns
            </h3>
            {myEvents.length === 0 ? (
              <div className="bg-white/50 border-2 border-dashed border-teal-200/50 rounded-3xl p-8 text-center text-teal-700/50 italic font-bold">
                You haven't joined any active campaigns yet. Head to the Explore tab!
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {myEvents.map(e => {
                  const part = participants.find(p => p.event_id === e.id);
                  const eventBadges = badges.filter(b => b.event_id === e.id).sort((a, b) => a.target_value - b.target_value);
                  const maxTarget = eventBadges.length > 0 ? eventBadges[eventBadges.length - 1].target_value : 1;
                  const progressPct = Math.min(100, (part.current_score / maxTarget) * 100);
                  const status = getStatusBadge(e);
                  
                  // Determine Stage Color
                  let progressColor = "bg-emerald-500";
                  let reachedTier = 0;
                  for (let i = 0; i < eventBadges.length; i++) {
                     if (part.current_score >= eventBadges[i].target_value) {
                        reachedTier = i + 1;
                     }
                  }
                  if (eventBadges.length > 0 && reachedTier === eventBadges.length) {
                     progressColor = "bg-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]"; // Max level gold glow
                  } else if (reachedTier > 0) {
                     const colors = ["bg-emerald-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500"];
                     progressColor = colors[Math.min(reachedTier, colors.length - 1)];
                  }
                  
                  return (
                    <div key={e.id} onClick={() => setSelectedEvent(e)} className="group cursor-pointer bg-white md:rounded-3xl rounded-2xl shadow-sm md:shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-slate-100 flex flex-row md:flex-col p-2 md:p-0 gap-2 md:gap-0">
                      <div className="w-[140px] aspect-video md:w-full bg-slate-100 relative shrink-0 overflow-hidden rounded-xl md:rounded-none">
                        {e.promo_image ? (
                          <img src={resolveImageUrl(e.promo_image)} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center">
                            <Calendar size={32} className="text-white/50 md:w-12 md:h-12" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 md:top-3 md:left-3">
                          <span className={`text-[8px] md:text-[10px] font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded-full uppercase tracking-wider shadow-sm ${status.color}`}>
                            {status.text}
                          </span>
                        </div>
                        <div className="absolute bottom-2 right-2 md:top-3 md:right-3 md:bottom-auto bg-slate-900/60 backdrop-blur-sm text-white text-[9px] md:text-xs font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg">
                          {getTimeRemainingText(e)}
                        </div>
                      </div>
                      <div className="flex-1 md:p-6 flex flex-col justify-center min-w-0 py-1">
                        <div>
                          <h4 className="text-sm md:text-xl font-bold text-slate-800 mb-1 line-clamp-1">{e.title}</h4>
                          <p className="text-[10px] md:text-sm text-slate-500 line-clamp-1 md:line-clamp-2 mb-2 md:mb-4">{e.description}</p>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-teal-800">
                            Score: <span className="text-sm">{Number(part.current_score) % 1 !== 0 ? Number(part.current_score).toFixed(2) : part.current_score}</span>
                          </div>
                          <div className="relative pt-1 pb-5">
                            <div className="h-2.5 bg-teal-100 rounded-full overflow-hidden relative">
                              {eventBadges.map((b, i) => {
                                 if (i === eventBadges.length - 1) return null; // No line at the very end
                                 const pct = (b.target_value / maxTarget) * 100;
                                 return <div key={b.id || i} className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-10" style={{ left: `${pct}%` }} />
                              })}
                              <div className={`h-full ${progressColor} rounded-full transition-all duration-1000 relative z-0`} style={{ width: `${progressPct}%` }} />
                            </div>
                            {/* Stage Labels */}
                            {eventBadges.map((b, i) => {
                               const pct = (b.target_value / maxTarget) * 100;
                               // To prevent the last label from overflowing the right edge, we can conditionally adjust translation
                               const transform = pct === 100 ? '-translate-x-full' : pct === 0 ? 'translate-x-0' : '-translate-x-1/2';
                               return (
                                 <div key={`label-${b.id || i}`} className={`absolute top-4 text-[10px] font-bold ${transform} ${part.current_score >= b.target_value ? 'text-emerald-600' : 'text-slate-400'}`} style={{ left: `${pct}%` }}>
                                   {b.target_value}
                                 </div>
                               )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: PAST EVENTS */}
        {activeTab === 'past-events' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-2xl font-black text-teal-900 flex items-center gap-2">
              <Calendar className="text-slate-400" /> Campaign History
            </h3>
            {pastEvents.length === 0 ? (
              <div className="bg-white/50 border-2 border-dashed border-teal-200/50 rounded-3xl p-8 text-center text-teal-700/50 italic font-bold">
                No past campaigns found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 opacity-80">
                {pastEvents.map(e => {
                  const part = participants.find(p => p.event_id === e.id);
                  return (
                    <div key={e.id} onClick={() => setSelectedEvent(e)} className="cursor-pointer bg-slate-50 md:rounded-3xl rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-slate-200 flex flex-row md:flex-col p-2 md:p-0 gap-2 md:gap-0">
                      {e.promo_image ? (
                        <div className="w-[140px] aspect-video md:w-full bg-slate-200 relative overflow-hidden rounded-xl md:rounded-none shrink-0">
                          <img src={resolveImageUrl(e.promo_image)} alt={e.title} className="w-full h-full object-cover grayscale-[50%] opacity-80 transition-transform duration-500 hover:scale-105" />
                        </div>
                      ) : (
                        <div className="w-[140px] aspect-video md:w-full bg-slate-200 flex items-center justify-center opacity-80 rounded-xl md:rounded-none shrink-0">
                          <Calendar size={32} className="text-slate-400 md:w-12 md:h-12" />
                        </div>
                      )}
                      <div className="flex-1 md:p-6 flex flex-col justify-center min-w-0 py-1">
                        <div>
                          <h4 className="text-sm md:text-lg font-bold text-slate-700 line-clamp-1 mb-1">{e.title}</h4>
                          <p className="text-[10px] md:text-xs text-slate-400 mb-2 md:mb-4">Ended: {new Date(e.end_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 pt-2 md:pt-4 mt-auto">
                          <span className="text-[10px] md:text-sm font-bold text-slate-600">Final Score: {Number(part.current_score) % 1 !== 0 ? Number(part.current_score).toFixed(2) : part.current_score}</span>
                          <span className="text-teal-600 font-bold flex items-center gap-1 text-[10px] md:text-sm">
                            Results <ArrowRight size={14} className="md:w-4 md:h-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Spacer to prevent BottomNavBar overlap */}
        <div className="h-32 w-full shrink-0" />

      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:py-8 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-full sm:max-h-[90vh] h-full sm:h-auto shadow-2xl relative overflow-hidden flex">
            
            {/* MAIN PANEL */}
            <div className={`w-full h-full sm:max-h-[90vh] shrink-0 transition-transform duration-300 overflow-y-auto custom-scrollbar flex flex-col ${showSubmissionPanel ? '-translate-x-full' : 'translate-x-0'}`}>
              <div className="aspect-video w-full relative shrink-0">
              {selectedEvent.promo_image ? (
                <img src={resolveImageUrl(selectedEvent.promo_image)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-teal-500 to-emerald-700" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
              <button onClick={() => { setSelectedEvent(null); setShowSubmissionPanel(false); }} className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors z-10">
                <ArrowRight className="rotate-180" size={20} />
              </button>
              
              <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider shadow-sm ${getStatusBadge(selectedEvent).color}`}>
                    {getStatusBadge(selectedEvent).text}
                  </span>
                  <span className="text-xs font-bold px-2 py-1 rounded-md bg-black/60 text-white backdrop-blur-sm shadow-sm">
                    {getTimeRemainingText(selectedEvent)}
                  </span>
              </div>
            </div>

            <div className="p-4 sm:p-6 pb-2 border-b border-slate-100">
              <h3 className="text-xl sm:text-3xl font-black mb-1 sm:mb-2 leading-tight text-slate-800">{selectedEvent.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600">{selectedEvent.description}</p>
            </div>
            
            <div className="p-4 md:p-6 flex items-center justify-between shrink-0">
                <div className="flex gap-3 md:gap-6 text-sm">
                  <div className="max-md:bg-white max-md:px-3 max-md:py-2 max-md:rounded-xl max-md:shadow-sm max-md:border max-md:border-slate-100">
                    <span className="block text-slate-400 font-bold mb-0.5 md:mb-1 text-[10px] md:text-xs uppercase tracking-wider">Start Date</span>
                    <span className="font-bold text-slate-700 text-xs md:text-sm">{new Date(selectedEvent.start_date).toLocaleDateString()}</span>
                  </div>
                  <div className="max-md:bg-white max-md:px-3 max-md:py-2 max-md:rounded-xl max-md:shadow-sm max-md:border max-md:border-slate-100">
                    <span className="block text-slate-400 font-bold mb-0.5 md:mb-1 text-[10px] md:text-xs uppercase tracking-wider">End Date</span>
                    <span className="font-bold text-slate-700 text-xs md:text-sm">{new Date(selectedEvent.end_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

            <div className="p-6 md:p-8 space-y-8">
              
              {selectedEvent.early_end_reason && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={24} />
                  <div>
                    <h4 className="font-black text-amber-900 mb-1">Event Ended Early</h4>
                    <p className="text-sm text-amber-700">{selectedEvent.early_end_reason}</p>
                  </div>
                </div>
              )}

              {/* Badges Preview */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Info className="text-teal-500" /> Rewards & Targets
                </h4>
                <div className="flex overflow-x-auto gap-4 pb-4 snap-x no-scrollbar">
                  {badges.filter(b => b.event_id === selectedEvent.id).map(b => (
                    <div key={b.id} className="text-center min-w-[100px] shrink-0 snap-center">
                      {b.icon_url ? (
                        <img src={resolveImageUrl(b.icon_url)} alt={b.name} className="w-16 h-16 mx-auto mb-2 drop-shadow-md object-cover rounded-full" />
                      ) : (
                        <div className="w-16 h-16 mx-auto mb-2 bg-slate-200 rounded-full flex items-center justify-center border-2 border-slate-300">
                          <ImageIcon size={24} className="text-slate-400" />
                        </div>
                      )}
                      <p className="font-bold text-xs text-slate-700 line-clamp-1">{b.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Target: {b.target_value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action / Progress Area */}
              {(() => {
                const part = participants.find(p => p.event_id === selectedEvent.id);
                
                if (part) {
                  // User has joined
                  const maxTarget = Math.max(...badges.filter(b => b.event_id === selectedEvent.id).map(b => b.target_value), 1);
                  const progressPct = Math.min(100, (part.current_score / maxTarget) * 100);
                  
                  return (
                    <div className="space-y-6">
                      <div className="bg-teal-50 p-6 rounded-2xl border border-teal-100">
                        <div className="flex justify-between items-end mb-2">
                          <span className="font-bold text-teal-800">Your Progress</span>
                          <span className="text-xl font-black text-teal-600">{Number(part.current_score) % 1 !== 0 ? Number(part.current_score).toFixed(2) : part.current_score}</span>
                        </div>
                        <div className="h-4 bg-teal-200/50 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full transition-all duration-1000" style={{ width: `${progressPct}%` }} />
                        </div>
                        <p className="text-xs text-teal-600/70 mt-2 font-medium">Keep going! Reach targets to unlock badges automatically.</p>
                      </div>

                        {/* Manual Upload Section */}
                        {selectedEvent.event_type === 'manual' && (
                          <button onClick={() => setShowSubmissionPanel(true)} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-2 text-lg mt-4">
                            Submit Proof & History <ArrowRight size={20} />
                          </button>
                        )}
                    </div>
                  );
                }

                // Not joined yet
                const isUpcoming = Date.now() < selectedEvent.start_date;
                return (
                  <button 
                    onClick={() => handleJoin(selectedEvent)}
                    disabled={isUpcoming}
                    className={`w-full font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-lg ${isUpcoming ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600 hover:-translate-y-1'}`}
                  >
                    {isUpcoming ? 'Starting Soon' : 'Join Campaign'} 
                    {!isUpcoming && <span className="bg-black/20 px-2 py-1 rounded-md text-sm flex items-center gap-1"><Coins size={14}/> {selectedEvent.entry_fee}</span>}
                  </button>
                );
              })()}
            </div>
            </div> {/* END MAIN PANEL */}

            {/* SUBMISSION PANEL */}
            <div className={`w-full h-full sm:max-h-[90vh] shrink-0 transition-transform duration-300 overflow-y-auto custom-scrollbar flex flex-col bg-slate-50 ${showSubmissionPanel ? '-translate-x-full' : 'translate-x-0'}`}>
              <div className="p-4 bg-white border-b border-slate-100 flex items-center sticky top-0 z-10 shadow-sm">
                <button onClick={() => setShowSubmissionPanel(false)} className="flex items-center gap-2 text-slate-600 font-bold hover:text-slate-900 px-2 py-1">
                  <ArrowRight className="rotate-180" size={18} /> Back to Details
                </button>
              </div>
              <div className="p-4 sm:p-6 space-y-6">
                 {/* Reinserted Upload Section */}
                 <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 shadow-sm">
                   <h4 className="font-bold text-amber-900 mb-4 flex items-center gap-2"><Upload size={18}/> Submit Proof</h4>
                   <form onSubmit={handleUploadProof} className="space-y-4">
                     <div>
                       <div className="flex gap-4 items-center">
                         <div className="relative">
                           {uploadUrl ? (
                             <img src={resolveImageUrl(uploadUrl)} alt="Proof preview" className="w-20 h-20 rounded-xl object-cover border-2 border-amber-300" />
                           ) : (
                             <div className="w-20 h-20 rounded-xl bg-amber-100 border-2 border-dashed border-amber-300 flex items-center justify-center text-amber-400">
                               <ImageIcon size={24} />
                             </div>
                           )}
                           {uploadingImage && (
                             <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-xl backdrop-blur-sm">
                               <Loader2 className="animate-spin text-amber-600" size={24} />
                             </div>
                           )}
                         </div>
                         <div className="flex-1">
                           <input 
                             type="file" 
                             accept="image/*" 
                             onChange={handleImageSelect}
                             disabled={uploadingImage}
                             className="hidden" 
                             id="proof-upload" 
                           />
                           <div className="flex flex-col items-start gap-1">
                             <label 
                               htmlFor="proof-upload" 
                               className="cursor-pointer bg-white text-amber-700 font-bold px-4 py-2 rounded-lg border border-amber-300 hover:bg-amber-100 transition-colors inline-flex items-center gap-2 text-sm shadow-sm"
                             >
                               <Upload size={16} /> {uploadUrl ? 'Change Photo' : 'Select Photo'}
                             </label>
                             <p className="text-[10px] md:text-xs text-amber-700/70 whitespace-nowrap">Upload a clear photo as proof.</p>
                           </div>
                         </div>
                       </div>
                     </div>
                     <input required type="text" placeholder="Description/Note" value={uploadDesc} onChange={e=>setUploadDesc(e.target.value)} className="w-full p-3 rounded-xl border border-amber-200 text-sm" />
                     <button disabled={uploadingImage || !uploadUrl} type="submit" className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl shadow-md hover:bg-amber-600 disabled:opacity-50">Submit to Review</button>
                   </form>
                 </div>

                 {submissions.filter(s => s.event_id === selectedEvent.id).length > 0 && (
                   <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                     <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle size={18} className="text-emerald-500"/> Your Submissions</h4>
                     <div className="space-y-4">
                       {submissions.filter(s => s.event_id === selectedEvent.id).map(s => (
                         <div key={s.id} className="flex gap-3 sm:gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 items-start">
                           <img src={resolveImageUrl(s.proof_url)} className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover bg-slate-200 shrink-0" alt="Proof" />
                           <div className="flex-1 min-w-0">
                             <p className="text-xs sm:text-sm font-bold text-slate-700 break-words">{s.description || 'No description'}</p>
                             <p className="text-[10px] sm:text-xs text-slate-500 mt-1">{new Date(s.created_at).toLocaleString()}</p>
                           </div>
                           <div className="shrink-0 flex flex-col gap-1 items-end">
                             {s.status === 'pending' && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 text-center w-full">Pending</span>}
                             {s.status === 'approved' && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200 text-center w-full">Approved</span>}
                             {s.status === 'rejected' && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-200 text-center w-full">Rejected</span>}
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
              </div>
            </div> {/* END SUBMISSION PANEL */}
            
          </div>
        </div>
      )}

      {/* Celebration Modal */}
      {celebratingEvent && (
        <>
          <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" />
          <div className="fixed inset-0 z-[1010] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-[0_0_100px_rgba(251,191,36,0.3)] animate-in zoom-in-95 duration-500 flex flex-col items-center p-6 sm:p-8 text-center relative pointer-events-auto">
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-amber-200 to-transparent opacity-50 pointer-events-none" />
              
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-amber-400 rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-xl shadow-amber-400/50 z-10 animate-bounce">
                <CheckCircle size={40} className="text-white sm:w-12 sm:h-12" />
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-black text-slate-800 mb-2 z-10">Congratulations!</h2>
              <p className="text-sm sm:text-lg text-slate-500 font-bold mb-6 sm:mb-8 z-10">
                You've successfully completed all stages of <br className="hidden sm:block"/>
                <span className="text-amber-500 text-base sm:text-xl"> {celebratingEvent.title}</span>!
              </p>

            <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-md mb-8 z-10 border-4 border-amber-100 relative group">
              {celebratingEvent.promo_image ? (
                <img src={resolveImageUrl(celebratingEvent.promo_image)} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                  <Calendar size={48} className="text-slate-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-4">
                <span className="text-white font-black text-2xl tracking-widest uppercase drop-shadow-md">Completed</span>
              </div>
            </div>

            <button 
              onClick={handleCloseCelebration}
              className="w-full bg-amber-500 text-white font-black py-4 rounded-xl shadow-lg hover:bg-amber-600 hover:-translate-y-1 hover:shadow-amber-500/30 transition-all text-xl z-10"
            >
              Awesome!
            </button>
          </div>
        </div>
        </>
      )}

      {cropModalOpen && cropImageSrc && (
        <AvatarCropModal
          isOpen={true}
          imageSrc={cropImageSrc}
          onClose={() => setCropModalOpen(false)}
          onConfirm={handleCropConfirm}
          aspect={1/1}
          cropShape="rect"
        />
      )}
    </div>
  );
};
