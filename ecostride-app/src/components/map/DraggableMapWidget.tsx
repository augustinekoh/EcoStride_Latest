import React, { useState, useRef, useEffect } from 'react';
import { Trophy, Gift, X, LayoutGrid, GripHorizontal, Map, TreePine, Shield } from 'lucide-react';
import { PointsStoreModal } from '../modals/PointsStoreModal';
import { LeaderboardModal } from '../modals/LeaderboardModal';
import { apiClient } from '../../lib/api';
import leaderboardData from '../../mock/leaderboard.json';
import { useMapStore } from '../../stores/useMapStore';
import { useUserStore } from '../../stores/useUserStore';

export const DraggableMapWidget: React.FC = () => {
  const { mapDisplayMode, setMapDisplayMode } = useMapStore();
  const { guildId, hasSeenTutorial, setHasSeenTutorial } = useUserStore();
  const [isExpanded, setIsExpanded] = useState(typeof window !== 'undefined' && window.innerWidth > 640);
  const [showEcoHubTooltip, setShowEcoHubTooltip] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 640) {
      return !useUserStore.getState().hasSeenTutorial;
    }
    return false;
  });
  const [position, setPosition] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 640) {
      // Calculate search bar's left offset (w-11/12 max-w-sm)
      const searchBarWidth = Math.min(window.innerWidth * (11/12), 384);
      const leftOffset = (window.innerWidth - searchBarWidth) / 2;
      return { x: leftOffset, y: 100 }; // Below search bar with gap for tooltip
    }
    return { x: 16, y: 16 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  const [activeIndex, setActiveIndex] = useState(0); // 0 = Leaderboard, 1 = Store

  const [showStore, setShowStore] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [leaderboardFilter, setLeaderboardFilter] = useState<'weekly' | 'guilds'>('weekly');
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [topGuilds, setTopGuilds] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Panel swipe-to-close states
  const [panelTouchStartY, setPanelTouchStartY] = useState<number | null>(null);
  const [panelTouchCurrentY, setPanelTouchCurrentY] = useState<number | null>(null);

  const handlePanelTouchStart = (e: React.TouchEvent) => {
    setPanelTouchStartY(e.touches[0].clientY);
    setPanelTouchCurrentY(e.touches[0].clientY);
  };

  const handlePanelTouchMove = (e: React.TouchEvent) => {
    setPanelTouchCurrentY(e.touches[0].clientY);
  };

  const handlePanelTouchEnd = () => {
    if (panelTouchStartY !== null && panelTouchCurrentY !== null) {
      if (panelTouchCurrentY - panelTouchStartY > 100) {
        setIsExpanded(false);
      }
    }
    setPanelTouchStartY(null);
    setPanelTouchCurrentY(null);
  };

  const panelDragOffset = (panelTouchCurrentY && panelTouchStartY && panelTouchCurrentY > panelTouchStartY) ? panelTouchCurrentY - panelTouchStartY : 0;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const boardData = await apiClient('/leaderboard');
        const users = (boardData.topCoins || boardData.users || []).map((u: any) => ({
          email: u.username || u.email || 'Unknown',
          points: u.coins || 0
        }));
        users.sort((a: any, b: any) => b.points - a.points);
        setTopUsers(users.slice(0, 3));

        const storeData = await apiClient('/store');
        let cats = Array.from(new Set(storeData.items.map((d: any) => d.category).filter(Boolean))) as string[];
        
        if (cats.length === 0) {
          cats = ['Vouchers', 'Skins', 'Tickets', 'Merchandise'];
        }
        
        setCategories(cats.slice(0, 4));
        
        // Fetch real guilds data exactly like LeaderboardModal does
        const recommendedRes = await apiClient('/guilds/recommended');
        if (recommendedRes.guilds && recommendedRes.guilds.length > 0) {
          const formattedGuilds = recommendedRes.guilds.map((g: any) => ({
            ...g,
            territory_trees: g.total_trees || 0 // Map total_trees to territory_trees so the UI uses it
          })).sort((a: any, b: any) => (b.total_trees || 0) - (a.total_trees || 0));
          setTopGuilds(formattedGuilds);
        } else {
          setTopGuilds(leaderboardData.guilds); // Fallback
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  // Drag handlers for the closed bubble AND expanded handle
  const handleDragStart = (e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setIsDragging(true);
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition({
      x: dragRef.current.initX + dx,
      y: dragRef.current.initY + dy
    });
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    if (dragRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setTimeout(() => setIsDragging(false), 50); // delay to prevent click trigger
  };

  const handleBubbleClick = () => {
    if (!isDragging) {
      setIsExpanded(true);
      setShowEcoHubTooltip(false);
      if (typeof window !== 'undefined') setHasSeenTutorial(true);
    }
  };

  const scrollToTab = (index: number) => {
    if (scrollContainerRef.current) {
      const width = scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollTo({ left: width * index, behavior: 'smooth' });
    }
    setActiveIndex(index);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollPos = el.scrollLeft;
    const width = el.clientWidth;
    const newIndex = Math.round(scrollPos / width);
    if (newIndex !== activeIndex) setActiveIndex(newIndex);
  };

  const renderBubble = () => (
    <div className="relative">
      <div 
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        onClick={handleBubbleClick}
        className="h-12 w-12 bg-white/95 backdrop-blur-md rounded-full border-2 border-[#1d3539] shadow-[4px_4px_0px_0px_#1d3539] flex items-center justify-center cursor-grab active:cursor-grabbing hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#1d3539] transition-all"
      >
        <LayoutGrid size={20} className="text-[#1d3539]" />
      </div>
      
      {/* Onboarding Tooltip */}
      {showEcoHubTooltip && (
        <div className="absolute top-14 left-4 bg-[#5496a2] text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg w-[160px] text-center animate-bounce z-50 pointer-events-auto leading-tight">
          <div className="absolute -top-1.5 left-6 w-3 h-3 bg-[#5496a2] rotate-45"></div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowEcoHubTooltip(false);
              setHasSeenTutorial(true);
            }}
            className="absolute -top-2 -right-2 w-5 h-5 bg-[#1d3539] rounded-full flex items-center justify-center border border-[#5496a2] shadow-sm hover:scale-110 active:scale-95 transition-transform"
          >
            <X size={12} strokeWidth={3} className="text-white"/>
          </button>
          Tap here for Map Views,<br/>Ranks & Point Store!
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* DRAGGABLE WIDGET (Always visible, handles both Mobile and Desktop) */}
      <div 
        className="absolute z-[100]" 
        style={{ left: position.x, top: position.y, touchAction: 'none' }}
      >
        {isExpanded ? (
          <>
            <div className="hidden sm:flex glass-card rounded-3xl shadow-[8px_8px_0px_0px_rgba(29,53,57,0.1)] border-2 border-[#1d3539] bg-[#faf9f6]/95 backdrop-blur-md w-[260px] animate-in fade-in slide-in-from-top-4 duration-300 flex-col overflow-hidden max-h-[350px]">
              
              {/* Drag Handle Top Bar */}
              <div 
                className="bg-[#1d3539]/5 h-6 w-full flex items-center justify-center cursor-grab active:cursor-grabbing border-b border-[#1d3539]/10 shrink-0"
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
              >
                <GripHorizontal size={14} className="text-[#1d3539]/40 pointer-events-none" />
              </div>

              <div className="p-4 pt-2 flex flex-col flex-1 overflow-hidden">
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <h3 className="font-black text-[#1d3539] text-xs uppercase tracking-widest flex items-center gap-2">
                    <LayoutGrid size={14} className="text-[#5496a2]" />
                    Eco Hub
                  </h3>
                  <button 
                    onClick={() => setIsExpanded(false)}
                    className="w-7 h-7 rounded-full border-2 border-[#1d3539] bg-white flex items-center justify-center hover:-translate-y-1 hover:shadow-[2px_2px_0px_0px_#1d3539] active:translate-y-0 active:shadow-none transition-all"
                  >
                    <X size={12} className="text-[#1d3539] font-black" />
                  </button>
                </div>
                
                {/* Native Scrollable Carousel Area */}
                <div 
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="flex overflow-x-auto snap-x snap-mandatory flex-1 overflow-y-hidden no-scrollbar"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {/* Slide 0: Map Views */}
                    <div className="min-w-full snap-start px-1 overflow-y-auto pr-1 custom-scrollbar flex flex-col justify-start pb-6">
                      <div className="flex flex-col items-center justify-start space-y-4 pt-2">
                        <div className="w-12 h-12 bg-white rounded-full border-2 border-[#1d3539] flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(29,53,57,0.3)]">
                          <LayoutGrid size={20} className="text-[#1d3539]" />
                        </div>
                        <div className="text-center mb-2">
                          <h4 className="text-xs font-black text-[#1d3539] uppercase tracking-wider mb-1">Map View Mode</h4>
                          <p className="text-[10px] text-[#1d3539]/60 font-bold mb-1">Switch what you see on the map.</p>
                        </div>
                        
                        <div className="w-[90%] mx-auto flex flex-col items-center">
                          <div className="w-full bg-[#1d3539]/5 p-1 rounded-2xl flex items-center mb-3">
                            <button onClick={() => setMapDisplayMode('normal')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all ${mapDisplayMode === 'normal' ? 'bg-white text-[#5496a2] shadow-[0_2px_8px_rgba(0,0,0,0.05)]' : 'text-slate-400 hover:text-slate-600'}`}>
                              <Map size={14} className={guildId ? "hidden xs:block" : ""} /> Normal
                            </button>
                            <button onClick={() => setMapDisplayMode('guild')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all ${mapDisplayMode === 'guild' ? 'bg-white text-[#5496a2] shadow-[0_2px_8px_rgba(0,0,0,0.05)]' : 'text-slate-400 hover:text-slate-600'}`}>
                              <TreePine size={14} className={guildId ? "hidden xs:block" : ""} /> Guilds
                            </button>
                            {guildId && (
                              <button onClick={() => setMapDisplayMode('my_guild')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all ${mapDisplayMode === 'my_guild' ? 'bg-white text-[#5496a2] shadow-[0_2px_8px_rgba(0,0,0,0.05)]' : 'text-slate-400 hover:text-slate-600'}`}>
                                <Shield size={14} className="hidden xs:block" /> Mine
                              </button>
                            )}
                          </div>
                          
                          <p className="text-[10px] text-[#1d3539]/60 font-bold text-center h-8 flex items-start justify-center">
                            {mapDisplayMode === 'normal' && "View regular user signposts and messages."}
                            {mapDisplayMode === 'guild' && "See territory trees planted by all global guilds."}
                            {mapDisplayMode === 'my_guild' && "Focus entirely on your own guild's territory."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Slide 1: Leaderboard */}
                    <div className="min-w-full snap-start px-1 overflow-y-auto pr-1 custom-scrollbar">


                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1">
                          <Trophy size={14} className="text-[#fde047]" />
                          <span className="text-[10px] font-black text-[#1d3539] uppercase">Top Ranks</span>
                        </div>
                        <select 
                          value={leaderboardFilter}
                          onChange={(e) => setLeaderboardFilter(e.target.value as any)}
                          className="text-[10px] font-bold bg-white border border-[#1d3539] rounded px-1 py-0.5 outline-none cursor-pointer"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="guilds">Guilds</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        {leaderboardFilter === 'weekly' ? (
                          topUsers.map((u, i) => (
                            <div key={i} className="flex items-center justify-between bg-white border border-[#1d3539]/20 rounded-lg p-1.5 hover:border-[#5496a2] transition-colors">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-[#1d3539]/60 w-3">{i+1}</span>
                                <span className="text-xs font-bold text-[#1d3539] truncate max-w-[90px]">{u.email?.split('@')[0] || 'User'}</span>
                              </div>
                              <span className="text-[10px] font-black text-[#5496a2]">{u.points || 0} pts</span>
                            </div>
                          ))
                        ) : (
                          topGuilds.slice(0,3).map((g, i) => (
                            <div key={i} className="flex items-center justify-between bg-white border border-[#1d3539]/20 rounded-lg p-1.5 hover:border-[#5496a2] transition-colors">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-[#1d3539]/60 w-3">{i+1}</span>
                                <span className="text-xs font-bold text-[#1d3539] truncate max-w-[90px]">{g.name}</span>
                              </div>
                              <span className="text-[10px] font-black text-[#5496a2]">{g.territory_trees || g.power || 0} trees</span>
                            </div>
                          ))
                        )}
                        
                        <div className="text-center pt-2 pb-1">
                          <button onClick={() => setShowLeaderboard(true)} className="text-[10px] font-bold text-[#5496a2] hover:underline cursor-pointer">
                            View Full Leaderboard &rarr;
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Slide 2: Point Store */}
                    <div className="min-w-full snap-start px-1 overflow-y-auto pr-1 custom-scrollbar flex flex-col justify-center h-full pb-6">
                      <div className="flex flex-col items-center justify-center h-full space-y-4 pt-4">
                        <div className="w-12 h-12 bg-[#fed7aa] rounded-full border-2 border-[#1d3539] flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(29,53,57,0.3)]">
                          <Gift size={20} className="text-[#1d3539]" />
                        </div>
                        <div className="text-center">
                          <h4 className="text-xs font-black text-[#1d3539] uppercase tracking-wider mb-1">Point Store</h4>
                          <p className="text-[10px] text-[#1d3539]/60 font-bold mb-3">Redeem your Eco Points!</p>
                        </div>
                        
                        <button 
                          onClick={() => setShowStore(true)} 
                          className="w-[80%] bg-white border-2 border-[#1d3539] text-[#1d3539] font-black py-2 px-4 rounded-xl shadow-[2px_2px_0px_0px_rgba(29,53,57,0.2)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(29,53,57,0.3)] active:translate-y-0 active:shadow-none transition-all text-[11px] flex items-center justify-center gap-2"
                        >
                          Enter Point Store <span className="text-lg leading-none">&rarr;</span>
                        </button>
                      </div>
                    </div>
                </div>

                {/* Carousel Indicators (Clickable) */}
                <div className="flex justify-center gap-1.5 mt-3 shrink-0">
                  {[0, 1, 2].map((idx) => (
                    <button 
                      key={idx} 
                      onClick={() => scrollToTab(idx)}
                      className={`h-2 rounded-full transition-all ${activeIndex === idx ? 'w-5 bg-[#1d3539]' : 'w-2 bg-[#1d3539]/30 hover:bg-[#1d3539]/50'}`}
                    ></button>
                  ))}
                </div>

              </div>
            </div>
            
            <div className="block sm:hidden">
              {renderBubble()}
            </div>
          </>
        ) : (
          renderBubble()
        )}
      </div>

      {/* MOBILE NATIVE BOTTOM SHEET */}
      <div className="sm:hidden">
        <div className={`fixed inset-0 z-[140] transition-opacity duration-300 ${isExpanded || panelDragOffset > 0 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsExpanded(false)} />
          <div 
            className="absolute bottom-0 left-0 right-0 bg-[#faf9f6] rounded-t-3xl p-6 pb-12 flex flex-col shadow-[0_-8px_30px_rgba(0,0,0,0.15)] h-[65vh] max-h-[600px] touch-none overscroll-none"
            style={{ 
              transform: `translateY(${!isExpanded ? '100%' : panelDragOffset + 'px'})`,
              transition: panelTouchStartY ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onTouchStart={handlePanelTouchStart}
            onTouchMove={handlePanelTouchMove}
            onTouchEnd={handlePanelTouchEnd}
          >
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-6 shrink-0 cursor-grab active:cursor-grabbing" />
            
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="font-black text-[#1d3539] text-lg uppercase tracking-widest flex items-center gap-2">
                <LayoutGrid size={20} className="text-[#5496a2]" />
                Eco Hub
              </h3>
              <button onClick={() => setIsExpanded(false)} className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center active:scale-95 transition-transform">
                <X size={16} className="text-slate-600" />
              </button>
            </div>
            
            {/* Native Scrollable Carousel Area for Mobile */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory flex-1 overflow-y-hidden no-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* Slide 0: Map Views */}
              <div className="min-w-full snap-center px-6 overflow-y-auto flex flex-col justify-start pb-10 pt-4">
                <div className="w-20 h-20 bg-white rounded-full border-4 border-[#1d3539] flex items-center justify-center shrink-0 shadow-[4px_4px_0px_0px_rgba(29,53,57,0.3)] mb-6 mx-auto">
                  <LayoutGrid size={32} className="text-[#1d3539]" />
                </div>
                <h4 className="text-lg font-black text-[#1d3539] uppercase tracking-wider mb-2 text-center">Map Display Mode</h4>
                <p className="text-sm text-[#1d3539]/60 font-bold mb-8 text-center max-w-[200px] mx-auto">Switch between regular signposts or guild trees.</p>
                
                <div className="w-[95%] sm:w-[85%] mx-auto flex flex-col gap-3">
                  <button 
                    onClick={() => setMapDisplayMode('normal')} 
                    className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all ${mapDisplayMode === 'normal' ? 'bg-white border-[#5496a2] shadow-[0_4px_12px_rgba(84,150,162,0.15)] scale-[1.02]' : 'bg-[#1d3539]/5 border-transparent hover:bg-[#1d3539]/10'}`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${mapDisplayMode === 'normal' ? 'bg-[#5496a2] text-white shadow-sm' : 'bg-white text-slate-400'}`}>
                      <Map size={24} />
                    </div>
                    <div className="text-left">
                      <h5 className={`font-black uppercase tracking-wider text-sm mb-0.5 ${mapDisplayMode === 'normal' ? 'text-[#1d3539]' : 'text-slate-500'}`}>Normal Mode</h5>
                      <p className="text-xs font-bold text-slate-400 line-clamp-1">View regular signposts & messages</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setMapDisplayMode('guild')} 
                    className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all ${mapDisplayMode === 'guild' ? 'bg-white border-[#5496a2] shadow-[0_4px_12px_rgba(84,150,162,0.15)] scale-[1.02]' : 'bg-[#1d3539]/5 border-transparent hover:bg-[#1d3539]/10'}`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${mapDisplayMode === 'guild' ? 'bg-[#5496a2] text-white shadow-sm' : 'bg-white text-slate-400'}`}>
                      <TreePine size={24} />
                    </div>
                    <div className="text-left">
                      <h5 className={`font-black uppercase tracking-wider text-sm mb-0.5 ${mapDisplayMode === 'guild' ? 'text-[#1d3539]' : 'text-slate-500'}`}>Guild Trees</h5>
                      <p className="text-xs font-bold text-slate-400 line-clamp-1">View community planted trees globally</p>
                    </div>
                  </button>

                  {guildId && (
                    <button 
                      onClick={() => setMapDisplayMode('my_guild')} 
                      className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all ${mapDisplayMode === 'my_guild' ? 'bg-white border-[#5496a2] shadow-[0_4px_12px_rgba(84,150,162,0.15)] scale-[1.02]' : 'bg-[#1d3539]/5 border-transparent hover:bg-[#1d3539]/10'}`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${mapDisplayMode === 'my_guild' ? 'bg-[#5496a2] text-white shadow-sm' : 'bg-white text-slate-400'}`}>
                        <Shield size={24} />
                      </div>
                      <div className="text-left">
                        <h5 className={`font-black uppercase tracking-wider text-sm mb-0.5 ${mapDisplayMode === 'my_guild' ? 'text-[#1d3539]' : 'text-slate-500'}`}>My Guild Only</h5>
                        <p className="text-xs font-bold text-slate-400 line-clamp-1">View trees from your community</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Slide 1: Leaderboard */}
              <div className="min-w-full snap-center px-6 overflow-y-auto">

                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy size={18} className="text-[#fde047]" />
                    <span className="text-sm font-black text-[#1d3539] uppercase">Top Ranks</span>
                  </div>
                  <select 
                    value={leaderboardFilter}
                    onChange={(e) => setLeaderboardFilter(e.target.value as any)}
                    className="text-xs font-bold bg-white border-2 border-[#1d3539] rounded-lg px-2 py-1 outline-none"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="guilds">Guilds</option>
                  </select>
                </div>
                
                <div className="space-y-3">
                  {leaderboardFilter === 'weekly' ? (
                    topUsers.map((u, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border-2 border-[#1d3539]/20 rounded-xl p-3 active:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-[#1d3539]/60 w-4">{i+1}</span>
                          <span className="text-sm font-bold text-[#1d3539] truncate max-w-[120px]">{u.email?.split('@')[0] || 'User'}</span>
                        </div>
                        <span className="text-sm font-black text-[#5496a2]">{u.points || 0} pts</span>
                      </div>
                    ))
                  ) : (
                    topGuilds.slice(0,3).map((g, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border-2 border-[#1d3539]/20 rounded-xl p-3 active:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-[#1d3539]/60 w-4">{i+1}</span>
                          <span className="text-sm font-bold text-[#1d3539] truncate max-w-[120px]">{g.name}</span>
                        </div>
                        <span className="text-sm font-black text-[#5496a2]">{g.territory_trees || g.power || 0} trees</span>
                      </div>
                    ))
                  )}
                  
                  <button onClick={() => setShowLeaderboard(true)} className="w-full mt-4 py-3 bg-[#e9efce] rounded-xl border-2 border-[#1d3539] font-black text-[#1d3539] active:translate-y-1 transition-transform">
                    View Full Leaderboard
                  </button>
                </div>
              </div>

              {/* Slide 2: Point Store */}
              <div className="min-w-full snap-center px-6 overflow-y-auto flex flex-col items-center justify-center h-full pb-10">
                <div className="w-20 h-20 bg-[#fed7aa] rounded-full border-4 border-[#1d3539] flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(29,53,57,0.3)] mb-6">
                  <Gift size={32} className="text-[#1d3539]" />
                </div>
                <h4 className="text-lg font-black text-[#1d3539] uppercase tracking-wider mb-2 text-center">Point Store</h4>
                <p className="text-sm text-[#1d3539]/60 font-bold mb-8 text-center max-w-[200px]">Redeem your Eco Points for exclusive vouchers!</p>
                
                <button 
                  onClick={() => setShowStore(true)} 
                  className="w-[80%] bg-white border-4 border-[#1d3539] text-[#1d3539] font-black py-4 px-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(29,53,57,0.2)] active:translate-y-1 active:shadow-none transition-all text-sm flex items-center justify-center gap-2"
                >
                  Enter Store <span className="text-xl leading-none">&rarr;</span>
                </button>
              </div>
            </div>

            {/* Carousel Indicators */}
            <div className="flex justify-center gap-2 mt-6 shrink-0">
              {[0, 1, 2].map((idx) => (
                <button 
                  key={idx} 
                  onClick={() => scrollToTab(idx)}
                  className={`h-2 rounded-full transition-all ${activeIndex === idx ? 'w-8 bg-[#1d3539]' : 'w-2 bg-[#1d3539]/30'}`}
                ></button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showStore && <PointsStoreModal onClose={() => setShowStore(false)} />}
      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
    </>
  );
};
