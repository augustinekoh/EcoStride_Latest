import React, { useState, useEffect } from 'react';
import { Search, Plus, MapPin, Users } from 'lucide-react';
import { CreateCommunityModal } from './CreateCommunityModal';
import { CommunityPreviewModal } from './CommunityPreviewModal';
import { apiClient } from '../../lib/api';
import { useAppRefresh } from '../../hooks/useAppRefresh';

interface RecommendedGuild {
  id: string;
  name: string;
  description: string;
  icon: string;
  nationality: string;
  member_count: number;
}

interface CommunityDiscoveryProps {
  onJoinCommunity: (guildId: string) => void;
}

export function CommunityDiscovery({ onJoinCommunity }: CommunityDiscoveryProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewGuildId, setPreviewGuildId] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<RecommendedGuild[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RecommendedGuild[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const fetchRecommended = () => {
    return apiClient('/guilds/recommended')
      .then(data => {
        if (data.guilds) setRecommended(data.guilds);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useAppRefresh(fetchRecommended);

  useEffect(() => {
    fetchRecommended();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      apiClient(`/guilds/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(data => {
          if (data.guilds) setSearchResults(data.guilds);
        })
        .catch(console.error)
        .finally(() => setIsSearching(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="w-full pb-20">
      {/* Header */}
      <div className="px-6 pt-2 pb-6">
        {/* Search Bar */}
        <div className="mt-4 relative flex items-center group">
          <Search className="absolute left-5 text-slate-400 group-focus-within:text-[var(--color-teal-dark)] transition-colors z-10" size={20} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search communities (name or ID)..." 
            className="w-full bg-white rounded-full pl-14 pr-4 py-4 text-[15px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-[3px] focus:ring-[var(--color-teal-dark)]/20 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100"
          />
        </div>
      </div>

      <div className="px-6 py-8">
        {/* Create Community Action */}
        <button 
          onClick={() => setShowCreateModal(true)}
          className="w-full relative bg-white rounded-[1.5rem] p-4 flex items-center mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 group transition-all hover:shadow-md active:scale-[0.98]"
        >
          <div className="w-12 h-12 bg-[var(--color-teal-dark)] text-white rounded-full flex items-center justify-center shadow-md shadow-[var(--color-teal-dark)]/20 shrink-0">
            <Plus size={22} strokeWidth={2.5} />
          </div>
          <div className="ml-4 text-left flex-1">
            <h3 className="text-[16px] font-bold text-slate-800 mb-0.5 leading-tight">Create New Community</h3>
            <p className="text-slate-500 text-[12px] leading-snug">Build your own group and plant trees together.</p>
          </div>
        </button>

        {/* Recommended Communities */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">
            {searchQuery.trim() ? 'Search Results' : 'Recommended'}
          </h2>
        </div>

        {/* Community List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center text-slate-400 py-10">Loading communities...</div>
          ) : (
            (searchQuery.trim() ? (searchResults || []) : (recommended || []).slice(0, visibleCount)).map(guild => (
              <div 
                key={guild.id}
                onClick={() => setPreviewGuildId(guild.id)}
                className="bg-white rounded-[1.5rem] p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition-all shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-50 group"
              >
                <div className="flex items-center flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-[1rem] bg-[var(--color-teal-dark)]/10 flex items-center justify-center text-2xl shrink-0 mr-3 text-[var(--color-teal-dark)] overflow-hidden">
                    {guild.icon ? (
                      (String(guild.icon).startsWith('http') || String(guild.icon).startsWith('/')) ? (
                        <img src={guild.icon} alt={guild.name} className="w-full h-full object-cover" />
                      ) : (
                        guild.icon
                      )
                    ) : (
                      '🌍'
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-[16px] font-bold text-slate-800 truncate mb-0.5 group-hover:text-[var(--color-teal-dark)] transition-colors leading-tight">
                      {guild.name}
                    </h3>
                    <div className="flex items-center text-[11px] text-slate-500 space-x-2 font-medium">
                      <div className="flex items-center">
                        <MapPin size={10} className="mr-0.5" />
                        <span className="truncate max-w-[80px]">{guild.nationality || 'Global'}</span>
                      </div>
                      <div className="flex items-center">
                        <Users size={10} className="mr-0.5" />
                        <span>{guild.member_count || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 bg-slate-50 text-slate-500 px-3 py-1.5 rounded-full text-[10px] font-bold">
                  View
                </div>
              </div>
            ))
          )}
          
          {!isLoading && !searchQuery.trim() && (recommended || []).length > 3 && (
            <button 
              onClick={() => {
                if (visibleCount >= (recommended || []).length) {
                  setVisibleCount(3);
                } else {
                  setVisibleCount(prev => prev + 3);
                }
              }}
              className="w-full py-3 glass-active bg-white/50 border border-black/5 rounded-2xl text-slate-500 font-bold hover:bg-[var(--color-teal-dark)] hover:text-white hover:shadow-md transition-all"
            >
              {visibleCount >= (recommended || []).length ? 'Collapse' : 'Show More'}
            </button>
          )}
          
          {!isLoading && (searchQuery.trim() ? searchResults : recommended)?.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              No communities found.
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateCommunityModal 
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => onJoinCommunity(id)}
        />
      )}

      {previewGuildId && (
        <CommunityPreviewModal
          guildId={previewGuildId}
          onClose={() => setPreviewGuildId(null)}
          onJoined={(id) => onJoinCommunity(id)}
        />
      )}
    </div>
  );
}
