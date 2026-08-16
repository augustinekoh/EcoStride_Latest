import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api';
import { AlertTriangle, MapPin, Clock, Filter, User, ChevronLeft, ChevronRight, Map, Network } from 'lucide-react';
import { AuthorityIssueDetailModal } from './AuthorityIssueDetailModal';

const AuthorityIssueCard: React.FC<{ issue: any, onClick: () => void }> = ({ issue, onClick }) => {
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
      className="p-6 rounded-[24px] bg-white border border-[#EAF0EC] shadow-[0_2px_10px_-4px_rgba(34,76,49,0.1)] hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(34,76,49,0.15)] transition-all duration-300 cursor-pointer group flex flex-col relative h-full overflow-hidden"
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
        <div className={`mt-auto px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider self-start ${
          issue.status === 'resolved' ? 'bg-[#D1FAE5] text-[#059669]' :
          issue.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
          'bg-[#FEF3C7] text-[#D97706]'
        }`}>
          {issue.status === 'pending' ? 'Pending' : issue.status}
        </div>
      </div>
    </div>
  );
};

export const AuthorityIssuesView: React.FC = () => {
  const [issues, setIssues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'resolved'>('all');

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

  const filteredIssues = issues.filter(issue => filter === 'all' ? true : issue.status === filter);

  return (
    <div className="h-full w-full bg-[#224C31] p-4 md:p-8 overflow-y-auto font-sans relative">
      <Network size={800} className="absolute -top-40 -left-20 text-[#34D399] opacity-[0.15] pointer-events-none stroke-1 mix-blend-overlay fixed" />
      <Map size={800} className="absolute bottom-0 right-0 text-[#FBBF24] opacity-[0.12] pointer-events-none stroke-1 mix-blend-overlay translate-y-1/4 translate-x-1/4 fixed" />

      <div className="max-w-[1600px] mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Reported Issues</h1>
            <p className="text-emerald-100/70 font-bold mt-1">Manage and resolve citizen infrastructure reports.</p>
          </div>
          
          <div className="flex bg-[#EAF0EC] p-1 rounded-full shadow-xl self-start">
             <Filter size={18} className="text-[#4A6B53] ml-3 mr-1 my-auto" />
             {['all', 'pending', 'in-progress', 'resolved'].map(f => (
               <button
                 key={f}
                 onClick={() => setFilter(f as any)}
                 className={`px-4 py-2 mx-0.5 rounded-full text-sm font-black uppercase transition-all ${
                   filter === f ? 'bg-white text-[#1E432B] shadow-sm' : 'text-[#9BB3A3] hover:text-[#4A6B53]'
                 }`}
               >
                 {f}
               </button>
             ))}
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
              onClick={() => setSelectedIssue(issue)} 
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
    </div>
  );
};
