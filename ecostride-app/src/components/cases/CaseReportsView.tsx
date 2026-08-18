import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { apiClient } from '../../lib/api';
import { ArrowLeft, ClipboardList, AlertCircle, Clock, CheckCircle, ChevronRight, ImageOff, X } from 'lucide-react';
import { CaseDetailModal } from './CaseDetailModal';

export const CaseReportsView: React.FC = () => {
  const { user } = useAuthStore();
  const { setActiveView } = useDemoStore();
  const [issues, setIssues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);

  const fetchMyIssues = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const res = await apiClient(`/users/${user.uid}/issues`);
      if (res.issues) {
        setIssues(res.issues);
      }
    } catch (err) {
      console.error("Failed to fetch my issues", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyIssues();
  }, [user]);

  const activeIssues = issues.filter(i => i.status !== 'resolved' && i.takedown_status !== 'taken-down');
  const resolvedIssues = issues.filter(i => i.status === 'resolved' || i.takedown_status === 'taken-down');

  const renderIssueCard = (issue: any) => {
    let firstImage = null;
    try {
      if (issue.photos) {
        const parsed = typeof issue.photos === 'string' ? JSON.parse(issue.photos) : issue.photos;
        if (parsed.length > 0) firstImage = parsed[0];
      }
    } catch(e) {}

    return (
      <div 
        key={issue.id} 
        onClick={() => setSelectedIssue(issue)}
        className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:bg-emerald-50/40 dark:hover:bg-slate-750 hover:border-emerald-200/60 hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] transition-all cursor-pointer flex gap-4 sm:gap-5 group relative overflow-visible"
      >
        {(issue.unread_count || 0) > 0 && (
          <div className="absolute -top-2 -right-2 shrink-0 min-w-[20px] h-[20px] bg-rose-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm z-20">
            <span className="text-[10px] font-bold text-white leading-none pt-[1px] px-1">{issue.unread_count > 99 ? '99+' : issue.unread_count}</span>
          </div>
        )}
        <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl bg-white/50 dark:bg-slate-900/50 overflow-hidden relative flex items-center justify-center border border-slate-200/60 dark:border-slate-700 shadow-sm">
          {firstImage ? (
            <img 
              src={firstImage} 
              alt="Report" 
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                const fallback = document.createElement('div');
                fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><line x1="2" y1="2" x2="22" y2="22"></line><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"></path><line x1="13.5" y1="13.5" x2="6" y2="21"></line><line x1="18" y1="12" x2="21" y2="15"></line><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.05-.22 1.41-.59"></path><path d="M21 15V5a2 2 0 0 0-2-2H9"></path></svg>';
                target.parentElement?.appendChild(fallback.firstChild as Node);
              }}
            />
          ) : (
            <ImageOff className="text-slate-300 dark:text-slate-600" size={24} />
          )}
        </div>
        
        <div className="flex-1 flex flex-col justify-between min-h-[5rem] sm:min-h-[6rem]">
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-1.5 gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">#{issue.id.toUpperCase()}</span>
              <div className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider flex items-center gap-1 leading-none shadow-sm whitespace-nowrap ${
                issue.takedown_status === 'taken-down' ? 'bg-red-100/80 text-red-700 border-red-200/60 dark:bg-red-950/60 dark:text-red-300' :
                issue.takedown_status === 'requested' ? 'bg-orange-100/80 text-orange-700 border-orange-200/60 dark:bg-orange-950/60 dark:text-orange-300' :
                issue.status === 'resolved' ? 'bg-emerald-100/80 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300' :
                issue.status === 'in-progress' ? 'bg-blue-100/80 text-blue-700 border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-300' :
                'bg-amber-100/80 text-amber-700 border-amber-200/60 dark:bg-amber-950/60 dark:text-amber-300'
              }`}>
                {issue.takedown_status === 'taken-down' ? <X size={10}/> : issue.status === 'resolved' ? <CheckCircle size={10}/> : <Clock size={10}/>}
                <span className="pt-px">{issue.takedown_status === 'taken-down' ? 'Taken Down' : issue.takedown_status === 'requested' ? 'Takedown Pending' : issue.status}</span>
              </div>
            </div>
            <div className="flex items-start justify-between gap-2 pr-2">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-[15px] leading-snug line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                {issue.title}
              </h3>
            </div>
          </div>
          
          <div className="flex justify-between items-end mt-auto pt-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400/80">{new Date(issue.created_at).toLocaleDateString()}</span>
            <ChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors translate-y-0.5" size={18} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-[#f8faf9] dark:bg-slate-900 relative flex flex-col pt-6 sm:pt-10 px-4 pb-12 overflow-y-auto overflow-x-hidden">
      
      {/* Background Blobs for Glassmorphism */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 fixed">
        <div className="absolute top-[5%] left-[-20%] w-[80%] h-[40%] bg-emerald-100/50 dark:bg-emerald-950/20 rounded-full blur-[100px]"></div>
        <div className="absolute top-[45%] right-[-20%] w-[70%] h-[50%] bg-blue-50/60 dark:bg-blue-950/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[60%] h-[40%] bg-emerald-50/50 dark:bg-emerald-950/20 rounded-full blur-[90px]"></div>
      </div>

      <div className="relative z-10 flex flex-col h-full max-w-2xl mx-auto w-full">
        {/* Header with Return / Back Button */}
        <div className="flex items-center gap-3.5 mb-6 mt-2">
          <button 
            onClick={() => setActiveView('profile')}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all shrink-0"
            aria-label="Return to Profile"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 sm:p-3 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 shrink-0">
              <ClipboardList className="text-emerald-700 dark:text-emerald-400" size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">My Reports</h1>
              <p className="text-xs font-bold text-slate-400">Track issues you've reported</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8 mt-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
          </div>
        ) : issues.length === 0 ? (
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700 rounded-[32px] p-10 flex flex-col items-center text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] mt-4">
            <AlertCircle size={48} className="text-emerald-300 dark:text-emerald-600 mb-5" />
            <h3 className="text-xl font-black text-slate-700 dark:text-slate-200 mb-3">No Reports Yet</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed max-w-xs">
              When you report infrastructure issues on the map, they will appear here for tracking.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {activeIssues.length > 0 && (
              <div>
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 pl-2">Current Reports</h2>
                <div className="flex flex-col gap-4">
                  {activeIssues.map(renderIssueCard)}
                </div>
              </div>
            )}

            {resolvedIssues.length > 0 && (
              <div>
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 pl-2 mt-2">Report History</h2>
                <div className="flex flex-col gap-4">
                  {resolvedIssues.map(renderIssueCard)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedIssue && (
        <CaseDetailModal 
          isOpen={true} 
          onClose={() => {
            setSelectedIssue(null);
            fetchMyIssues();
          }} 
          issue={selectedIssue} 
        />
      )}
    </div>
  );
};
