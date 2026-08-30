import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../../../lib/api';
import { AlertTriangle, MapPin, Clock, Filter, User, ChevronLeft, ChevronRight, Map, Network, CheckSquare, Square, History, Bot, Sparkles } from 'lucide-react';
import { AuthorityIssueDetailModal } from './AuthorityIssueDetailModal';

const AuthorityIssueCard: React.FC<{ 
  issue: any, 
  onClick: () => void,
  isMultiSelectMode?: boolean,
  isSelected?: boolean
}> = ({ issue, onClick, isMultiSelectMode, isSelected }) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  let photos: string[] = [];
  try {
    if (issue.photos && typeof issue.photos === 'string') {
      photos = JSON.parse(issue.photos);
    } else if (Array.isArray(issue.photos)) {
      photos = issue.photos;
    }
  } catch (e) {}

  const displayPhotos = photos.slice(0, 3);
  const numPhotos = displayPhotos.length;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activePhotoIndex > 0) {
      setActivePhotoIndex(prev => prev - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activePhotoIndex < numPhotos - 1) {
      setActivePhotoIndex(prev => prev + 1);
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`p-6 rounded-[24px] bg-white border-2 shadow-[0_2px_10px_-4px_rgba(34,76,49,0.1)] hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(34,76,49,0.15)] transition-all duration-300 cursor-pointer group flex flex-col relative h-full overflow-hidden ${isSelected ? 'border-[#C5F04F] ring-4 ring-[#C5F04F]/30' : 'border-transparent'}`}
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-[#34D399]/10 to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700"></div>
      
      <div className="relative z-10 flex flex-col h-full">
        
        {/* Authority & Date (at the top) */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 max-w-[60%]">
            {issue.author_avatar ? (
              <img src={issue.author_avatar} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#F3F7F4] flex items-center justify-center text-[#9BB3A3] shrink-0">
                <User size={14} />
              </div>
            )}
            <span className="font-bold text-[#738F7C] text-xs truncate">{issue.author_username || 'Unknown Citizen'}</span>
          </div>
          <div className="text-[10px] font-bold text-[#9BB3A3] flex items-center gap-1 shrink-0 bg-[#F3F7F4] px-2 py-1 rounded-md">
            <Clock size={12} />
            {new Date(issue.created_at).toLocaleDateString()}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[17px] font-black text-[#1E432B] mb-4 line-clamp-2">{issue.title}</h3>

        {/* Image Viewer */}
        {numPhotos > 0 && (
          <div className="relative w-full aspect-[4/3] rounded-[16px] overflow-hidden mb-5 bg-[#F3F7F4] group/viewer shrink-0">
            <div className="relative w-full h-full flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${activePhotoIndex * 100}%)` }}>
              {displayPhotos.map((photo, idx) => (
                <img key={idx} src={photo} alt="" className="w-full h-full object-cover shrink-0" />
              ))}
            </div>

            {numPhotos > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  disabled={activePhotoIndex === 0}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 text-[#1E432B] shadow hover:scale-105 transition-all z-10 ${activePhotoIndex === 0 ? 'opacity-40 cursor-not-allowed' : 'opacity-0 group-hover/viewer:opacity-100'}`}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNext}
                  disabled={activePhotoIndex === numPhotos - 1}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 text-[#1E432B] shadow hover:scale-105 transition-all z-10 ${activePhotoIndex === numPhotos - 1 ? 'opacity-40 cursor-not-allowed' : 'opacity-0 group-hover/viewer:opacity-100'}`}
                >
                  <ChevronRight size={16} />
                </button>
                
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[10px] font-black tracking-widest z-10">
                  {activePhotoIndex + 1} / {numPhotos}
                </div>
              </>
            )}
          </div>
        )}

        {/* Status */}
        <div className="mt-auto flex flex-wrap gap-2 items-center">
          <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider self-start ${
            issue.takedown_status === 'taken-down' ? 'bg-[#FFE4E6] text-[#E11D48]' :
            issue.takedown_status === 'requested' ? 'bg-[#FFEDD5] text-[#C2410C]' :
            issue.status === 'resolved' ? 'bg-[#D1FAE5] text-[#059669]' :
            issue.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
            'bg-[#FEF3C7] text-[#D97706]'
          }`}>
            {issue.takedown_status === 'taken-down' ? 'Taken Down' : issue.takedown_status === 'requested' ? 'Takedown Pending' : issue.status === 'pending' ? 'Pending' : issue.status}
          </div>

          {issue.severity && (
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider self-start ${
              issue.severity === 'Critical' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
              issue.severity === 'Major' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
              'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}>
              {issue.severity}
            </div>
          )}
          
          {issue.ai_status === 'pending' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Sparkles size={12} className="animate-pulse" />
              AI Analyzing
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import { useCopilotSession } from '../hooks/useCopilotSession';
import { AuthorityCopilotChatWidget } from './AuthorityCopilotChatWidget';
import { AuthorityCopilotHistoryModal } from './AuthorityCopilotHistoryModal';

export const AuthorityIssuesView: React.FC = () => {
  const location = useLocation();
  const [issues, setIssues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(location.state?.openIssue || null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'resolved' | 'taken down'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<Set<number>>(new Set());
  const [isSparkleAnimating, setIsSparkleAnimating] = useState(false);
  
  const { isCreatingSession, createSession } = useCopilotSession();
  const [activeCopilotSessionId, setActiveCopilotSessionId] = useState<string | null>(null);
  const [activeSessionReportIds, setActiveSessionReportIds] = useState<string[]>([]);
  const [activeSessionReports, setActiveSessionReports] = useState<any[]>([]);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  useEffect(() => {
    if (location.state?.openIssue) {
      setSelectedIssue(location.state.openIssue);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchIssues = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient(`/authorities/issues?page=1&limit=50`);
      if (res.issues) {
        setIssues(res.issues);
      }
    } catch (err) {
      console.error("Failed to fetch authority issues", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const handleIssueClick = (issue: any) => {
    if (isMultiSelectMode) {
      setSelectedReportIds(prev => {
        const next = new Set(prev);
        if (next.has(issue.id)) {
          next.delete(issue.id);
        } else {
          if (next.size < 10) {
            next.add(issue.id);
          } else {
            alert('You can only select up to 10 reports for a Copilot investigation.');
          }
        }
        return next;
      });
    } else {
      setSelectedIssue(issue);
    }
  };

  const handleStartInvestigation = async () => {
    if (selectedReportIds.size === 0 || isCreatingSession) return;
    try {
      const idsArray = Array.from(selectedReportIds).map(String);
      const reportsArray = issues.filter(i => selectedReportIds.has(i.id));
      const sessionId = await createSession(idsArray);
      
      setActiveSessionReportIds(idsArray);
      setActiveSessionReports(reportsArray);
      setInitialMessages([]);
      setActiveCopilotSessionId(sessionId);
      
      // Auto-close select mode after starting investigation
      setIsMultiSelectMode(false);
      setSelectedReportIds(new Set());
    } catch (e: any) {
      alert(`Failed to start investigation: ${e.message}`);
    }
  };

  const handleClaim = async (issueId: number) => {
    try {
      await apiClient(`/authorities/issues/${issueId}/claim`, { method: 'PATCH' });
      fetchIssues(); // Refresh list
    } catch (err) {
      alert("Failed to claim issue");
    }
  };

  const handleResolve = async (issueId: number) => {
    try {
      const response = prompt("Enter a resolution message (optional):");
      await apiClient(`/authorities/issues/${issueId}/resolve`, { 
        method: 'PATCH',
        body: JSON.stringify({ authority_response: response || undefined })
      });
      fetchIssues(); // Refresh list
      if (selectedIssue && selectedIssue.id === issueId) {
        setSelectedIssue(null); // Close modal if resolving from list
      }
    } catch (err) {
      alert("Failed to resolve issue");
    }
  };

  const filteredIssues = issues.filter(issue => {
    if (filter === 'all') return true;
    if (filter === 'taken down') return issue.takedown_status === 'taken-down';
    if (issue.takedown_status === 'taken-down') return false; // Hide taken down issues from other specific filters
    return issue.status === filter;
  });

  return (
    <div className="h-full w-full bg-[#224C31] p-4 md:p-8 overflow-y-auto font-sans relative">
      <Network size={800} className="absolute -top-40 -left-20 text-[#34D399] opacity-[0.15] pointer-events-none stroke-1 mix-blend-overlay fixed" />
      <Map size={800} className="absolute bottom-0 right-0 text-[#FBBF24] opacity-[0.12] pointer-events-none stroke-1 mix-blend-overlay translate-y-1/4 translate-x-1/4 fixed" />
      
      <div className="max-w-[1600px] mx-auto relative z-10 pb-20 md:pb-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-50">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Reported Issues</h1>
            <p className="text-emerald-100/70 font-bold mt-1 text-sm md:text-base">Manage and resolve citizen infrastructure reports.</p>
          </div>
          
          <div className="flex items-center gap-3 justify-end relative">
            
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`p-3 rounded-full transition-all flex items-center justify-center hover:scale-110 ${
                  filter !== 'all' ? 'bg-[#34D399] text-[#1E432B]' : 'bg-[#EAF0EC]/20 text-white hover:bg-[#EAF0EC]/30'
                }`}
                title="Filter Reports"
              >
                <Filter size={20} />
              </button>
              {isFilterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden z-50 py-2">
                    {['all', 'pending', 'in-progress', 'resolved', 'taken down'].map(f => (
                      <button
                        key={f}
                        onClick={() => { setFilter(f as any); setIsFilterOpen(false); }}
                        className={`w-full text-left px-5 py-3 text-sm font-bold uppercase transition-colors flex items-center justify-between ${
                          filter === f ? 'bg-[#34D399]/20 text-[#1E432B]' : 'text-[#738F7C] hover:bg-[#F3F7F4]'
                        }`}
                      >
                        {f === 'all' ? 'All Reports' : f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => {
                setIsSparkleAnimating(true);
                setTimeout(() => setIsSparkleAnimating(false), 800);
                setIsMultiSelectMode(!isMultiSelectMode);
                if (isMultiSelectMode) {
                  setSelectedReportIds(new Set());
                }
              }}
              className={`p-3 rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center justify-center relative hover:scale-110 ${
                isSparkleAnimating 
                  ? 'bg-white text-[#C5F04F] scale-125 rotate-[360deg] shadow-[0_0_30px_rgba(255,255,255,1)] z-10' 
                  : isMultiSelectMode 
                    ? 'bg-[#C5F04F] text-[#1E432B] shadow-[0_0_15px_rgba(197,240,79,0.5)]' 
                    : 'bg-[#EAF0EC]/20 text-white hover:bg-[#EAF0EC]/30'
              }`}
              title="Select Reports"
            >
              <Sparkles size={20} className={`transition-all duration-300 ${isMultiSelectMode && !isSparkleAnimating ? 'animate-pulse' : ''}`} />
              
              {isSparkleAnimating && (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-white animate-[ping_0.5s_cubic-bezier(0,0,0.2,1)_forwards] opacity-0 pointer-events-none"></div>
                  <div className="absolute -inset-2 rounded-full border-2 border-[#C5F04F] animate-[ping_0.6s_cubic-bezier(0,0,0.2,1)_0.1s_forwards] opacity-0 pointer-events-none"></div>
                </>
              )}
            </button>
            
            <button
              className="p-3 rounded-full transition-all bg-[#EAF0EC]/20 text-white hover:bg-[#EAF0EC]/30 hover:scale-110 flex items-center justify-center"
              onClick={() => setIsHistoryModalOpen(true)}
              title="Investigation History"
            >
              <History size={20} />
            </button>
          </div>
        </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#34D399]"></div>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="bg-white rounded-[32px] border-4 border-white p-12 flex flex-col items-center justify-center text-center shadow-xl">
          <AlertTriangle size={64} className="text-[#9BB3A3] mb-4" />
          <h2 className="text-2xl font-black text-[#1E432B] mb-2">No Issues Found</h2>
          <p className="text-[#738F7C] font-bold">No reported issues match your current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredIssues.map((issue) => (
            <AuthorityIssueCard 
              key={issue.id} 
              issue={issue} 
              onClick={() => handleIssueClick(issue)} 
              isMultiSelectMode={isMultiSelectMode}
              isSelected={selectedReportIds.has(issue.id)}
            />
          ))}
        </div>
      )}

      {selectedIssue && (
        <AuthorityIssueDetailModal 
          isOpen={true} 
          onClose={() => setSelectedIssue(null)} 
          issue={selectedIssue}
          onRefresh={() => {
            fetchIssues();
            setSelectedIssue(null); // Or refetch the specific issue
          }}
        />
      )}
      </div>

      {/* Copilot FAB */}
      {isMultiSelectMode && selectedReportIds.size > 0 && (
        <div className="fixed bottom-32 md:bottom-24 right-6 md:right-10 z-50">
          <button
            onClick={handleStartInvestigation}
            disabled={isCreatingSession}
            className={`flex items-center gap-3 px-6 py-4 rounded-full font-black shadow-2xl transition-all hover:scale-105 active:scale-95 border-2 border-white/40 ${
              isCreatingSession 
                ? 'bg-gray-400 text-white cursor-not-allowed opacity-80' 
                : 'bg-[#C5F04F] text-[#1E432B] hover:shadow-[0_8px_30px_rgba(197,240,79,0.5)]'
            }`}
          >
            {isCreatingSession ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1E432B]"></div>
            ) : (
              <Sparkles size={24} className="animate-pulse text-white drop-shadow-md" fill="currentColor" />
            )}
            <span className="text-sm md:text-base">
              {isCreatingSession ? 'Starting...' : `Investigate ${selectedReportIds.size} Report${selectedReportIds.size > 1 ? 's' : ''}`}
            </span>
          </button>
        </div>
      )}

      {activeCopilotSessionId && (
        <AuthorityCopilotChatWidget 
          sessionId={activeCopilotSessionId} 
          reportIds={activeSessionReportIds}
          reports={activeSessionReports}
          initialMessages={initialMessages}
          onClose={() => {
            setActiveCopilotSessionId(null);
            setInitialMessages([]);
            setActiveSessionReportIds([]);
            setActiveSessionReports([]);
          }} 
        />
      )}

      <AuthorityCopilotHistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)} 
        onSelectSession={(sessionId, msgs, reportIds) => {
          setActiveCopilotSessionId(sessionId);
          setInitialMessages(msgs);
          const ids = reportIds || [];
          setActiveSessionReportIds(ids);
          setActiveSessionReports(issues.filter(i => ids.includes(String(i.id))));
        }}
      />
    </div>
  );
};
