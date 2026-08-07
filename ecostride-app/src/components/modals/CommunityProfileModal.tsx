import React, { useEffect, useState } from 'react';
import { X, Users, TreePine, MapPin } from 'lucide-react';
import { apiClient } from '../../lib/api';

interface CommunityProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string | null;
}

export const CommunityProfileModal: React.FC<CommunityProfileModalProps> = ({ isOpen, onClose, communityId }) => {
  const [loading, setLoading] = useState(false);
  const [community, setCommunity] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !communityId) return;
    
    const fetchCommunity = async () => {
      setLoading(true);
      try {
        const res = await apiClient(`/guilds/${communityId}`);
        if (res.guild) {
          setCommunity(res.guild);
          setMembers(res.members || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunity();
  }, [isOpen, communityId]);

  if (!isOpen) return null;

  const totalTrees = members.reduce((sum, m) => sum + (m.total_trees_planted || 0), 0);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="bg-[#fff4d6] rounded-[2rem] w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-90 duration-300 relative shadow-2xl border border-white/40">
        
        {/* Header */}
        <div className="bg-[#5496a2] p-4 flex justify-between items-center text-white shrink-0 shadow-sm">
          <h2 className="text-xl font-black uppercase tracking-wider text-white">Community</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col items-center">
          {loading ? (
            <div className="flex justify-center items-center h-48 w-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5496a2]"></div>
            </div>
          ) : community ? (
            <>
              {/* Cover/Avatar Section */}
              <div className="w-full bg-[#5496a2]/10 h-32 relative flex justify-center mb-16 shrink-0">
                <div className="absolute -bottom-12 w-28 h-28 bg-[#fff4d6] rounded-full border-4 border-[#fff4d6] shadow-xl flex items-center justify-center text-5xl overflow-hidden">
                  {(community.icon && (community.icon.startsWith('http') || community.icon.startsWith('/'))) ? (
                    <img src={community.icon} alt={community.name} className="w-full h-full object-cover" />
                  ) : (
                    community.icon || '🌍'
                  )}
                </div>
              </div>
              
              <div className="px-6 w-full flex flex-col items-center pb-6">
                <h3 className="text-2xl font-black text-[#1d3539] text-center mb-1 break-words w-full leading-tight">{community.name}</h3>
                
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/50 rounded-full mb-4">
                  <MapPin size={12} className="text-[#5496a2]" />
                  <span className="text-xs font-bold text-[#5496a2] uppercase">{community.nationality || 'Global'}</span>
                </div>
                
                <p className="text-center text-sm font-bold text-slate-600 mb-6 px-4 italic leading-relaxed whitespace-pre-wrap">
                  {community.description || "No description provided."}
                </p>

                <div className="grid grid-cols-2 gap-3 w-full mb-6">
                  <div className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-2xl p-4 flex flex-col items-center justify-center shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
                    <TreePine className="text-emerald-700 mb-1" size={20} />
                    <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight drop-shadow-sm">Total Trees<br/>Planted</span>
                    <span className="text-xl font-black text-emerald-800 mt-1 drop-shadow-sm">{totalTrees}</span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-2xl p-4 flex flex-col items-center justify-center shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
                    <Users className="text-blue-700 mb-1" size={20} />
                    <span className="text-[10px] font-bold text-slate-700 uppercase text-center leading-tight drop-shadow-sm">Active<br/>Members</span>
                    <span className="text-xl font-black text-blue-800 mt-1 drop-shadow-sm">{members.length}</span>
                  </div>
                </div>
                
              </div>
            </>
          ) : (
            <div className="flex justify-center items-center h-48 w-full text-slate-500 font-bold">
              Community not found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
