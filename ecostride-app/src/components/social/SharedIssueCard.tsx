import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Map, MapPin } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { useMapStore } from '../../stores/useMapStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useNavigate, useLocation } from 'react-router-dom';

export const SharedIssueCard: React.FC<{ issueId: string }> = ({ issueId }) => {
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    const fetchIssue = async () => {
      try {
        const res = await apiClient(`/issues/${issueId}`);
        if (isMounted && res.issue) {
          setIssue(res.issue);
        }
      } catch (e) {
        console.error("Failed to load shared issue", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchIssue();
    return () => { isMounted = false; };
  }, [issueId]);

  if (loading) {
    return (
      <div className="w-64 h-24 bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse border-2 border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-xs text-slate-400">
        Loading issue details...
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="w-64 p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50 text-red-500 text-xs font-bold flex items-center gap-2">
        <AlertTriangle size={14} className="flex-shrink-0" />
        <span>Issue not found or deleted</span>
      </div>
    );
  }

  let photos: string[] = [];
  try {
    if (typeof issue.photos === 'string') {
      photos = JSON.parse(issue.photos);
    } else if (Array.isArray(issue.photos)) {
      photos = issue.photos;
    }
  } catch (e) {}

  const handleNavigateToMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!issue) return;

    const { setFlyToLocation, setActiveIssue, issues, setIssues } = useMapStore.getState();
    const { setActiveView, setIsChatExpanded, setActivePrivateChat } = useDemoStore.getState();
    const { role } = useAuthStore.getState();

    // 1. Close chat drawers & floating chat windows
    setIsChatExpanded(false);
    setActivePrivateChat(null);

    // 2. Ensure issue is in the map state
    if (!issues.find(i => i.id === issue.id)) {
      setIssues([...issues, issue]);
    }

    // 3. Handle routing based on user role
    if (role === 'authority') {
      navigate('/authorities/map');
    } else {
      setActiveView('map');
      if (location.pathname !== '/') {
        navigate('/');
      }
    }

    // 4. Fly map camera to the issue location
    if (issue.lng !== undefined && issue.lat !== undefined) {
      setFlyToLocation([issue.lng, issue.lat]);
    }

    // 5. Open issue details modal / popup on the map
    setTimeout(() => {
      setActiveIssue(issue);
    }, 450);
  };

  return (
    <div 
      onClick={handleNavigateToMap}
      className="w-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mt-1 cursor-pointer hover:border-[#1B4A2E] dark:hover:border-emerald-500 hover:shadow-md transition-all active:scale-[0.98] group"
    >
      {photos.length > 0 ? (
        <div className="w-full h-28 relative overflow-hidden bg-slate-100 dark:bg-slate-900">
          <img src={photos[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm ${
              issue.status === 'resolved' ? 'bg-emerald-500 text-white' :
              issue.status === 'in-progress' ? 'bg-blue-500 text-white' :
              'bg-amber-500 text-white'
            }`}>
              {issue.status}
            </span>
            <span className="text-[10px] font-bold text-white/90 flex items-center gap-1 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded">
              <Map size={10} />
              Location
            </span>
          </div>
        </div>
      ) : (
        <div className="p-2.5 pb-0 flex items-center justify-between gap-2">
          <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
            issue.status === 'resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
            issue.status === 'in-progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
            'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
          }`}>
            {issue.status}
          </div>
          <AlertTriangle size={13} className="text-amber-500" />
        </div>
      )}

      <div className="p-3">
        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs line-clamp-1 group-hover:text-[#1B4A2E] dark:group-hover:text-emerald-400 transition-colors">
          {issue.title}
        </h4>
        {issue.description && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
            {issue.description}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
            <Clock size={10} />
            <span>{new Date(issue.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
            <MapPin size={11} />
            <span>Navigate on map</span>
          </div>
        </div>
      </div>
    </div>
  );
};
