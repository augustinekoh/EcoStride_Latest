import React, { useState, useRef, useEffect } from 'react';
import { Trophy, Gift, X, LayoutGrid, GripHorizontal } from 'lucide-react';
import { PointsStoreModal } from '../modals/PointsStoreModal';
import { LeaderboardModal } from '../modals/LeaderboardModal';
import { apiClient } from '../../lib/api';
import leaderboardData from '../../mock/leaderboard.json';

export const DraggableMapWidget: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  const [activeIndex, setActiveIndex] = useState(0); // 0 = Leaderboard, 1 = Store

  const [showStore, setShowStore] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [leaderboardFilter, setLeaderboardFilter] = useState<'weekly' | 'guilds'>('weekly');
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const boardData = await apiClient('/leaderboard');
        const users = boardData.users.map((u: any) => ({
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
      dragRef.current = null;
      setTimeout(() => setIsDragging(false), 50);
    }
  };

  const handleBubbleClick = () => {
    if (!isDragging && !isExpanded) {
      setIsExpanded(true);
    }
  };
  
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const width = scrollContainerRef.current.offsetWidth;
      setActiveIndex(Math.round(scrollLeft / width));
    }
  };
  
  const scrollToTab = (index: number) => {
    if (scrollContainerRef.current) {
      const width = scrollContainerRef.current.offsetWidth;
      scrollContainerRef.current.scrollTo({ left: width * index, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div 
        className="absolute z-[100]" 
        style={{ left: position.x, top: position.y, touchAction: 'none' }}
      >
        {isExpanded ? (
          <div className="glass-card rounded-3xl shadow-[8px_8px_0px_0px_rgba(29,53,57,0.1)] border-2 border-[#1d3539] bg-[#faf9f6]/95 backdrop-blur-md w-[260px] animate-in fade-in slide-in-from-top-4 duration-300 flex flex-col overflow-hidden max-h-[350px]">
            
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
                  {/* Slide 0: Leaderboard */}
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
                        leaderboardData.guilds.slice(0,3).map((g, i) => (
                          <div key={i} className="flex items-center justify-between bg-white border border-[#1d3539]/20 rounded-lg p-1.5 hover:border-[#5496a2] transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-[#1d3539]/60 w-3">{i+1}</span>
                              <span className="text-xs font-bold text-[#1d3539] truncate max-w-[90px]">{g.name}</span>
                            </div>
                            <span className="text-[10px] font-black text-[#5496a2]">{g.power} pwr</span>
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

                  {/* Slide 1: Point Store */}
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
                {[0, 1].map((idx) => (
                  <button 
                    key={idx} 
                    onClick={() => scrollToTab(idx)}
                    className={`h-2 rounded-full transition-all ${activeIndex === idx ? 'w-5 bg-[#1d3539]' : 'w-2 bg-[#1d3539]/30 hover:bg-[#1d3539]/50'}`}
                  ></button>
                ))}
              </div>

            </div>
          </div>
        ) : (
          <div 
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            onClick={handleBubbleClick}
            className="w-12 h-12 bg-white/95 backdrop-blur-md rounded-full border-2 border-[#1d3539] shadow-[4px_4px_0px_0px_#1d3539] flex items-center justify-center cursor-grab active:cursor-grabbing hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#1d3539] transition-all"
          >
            <LayoutGrid size={20} className="text-[#1d3539]" />
          </div>
        )}
      </div>

      {showStore && <PointsStoreModal onClose={() => setShowStore(false)} />}
      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
    </>
  );
};
