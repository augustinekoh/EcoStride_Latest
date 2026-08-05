import React, { useState } from 'react';
import { useUserStore } from '../../stores/useUserStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { CommunityDiscovery } from './CommunityDiscovery';
import { CommunityDashboard } from './CommunityDashboard';
import { FriendsTab } from './FriendsTab';
import { PrivateChatRoom } from './PrivateChatRoom';
import { CapybaraRequests } from './CapybaraRequests';
import { FloatingChat } from './FloatingChat';

export function SocialRouter() {
  const { guildId, setGuildId, communityUnreadCount, friendsUnreadCount } = useUserStore();
  const { activePrivateChat } = useDemoStore();
  const [activeTab, setActiveTab] = useState<'community' | 'friends'>('friends');

  const handleJoin = (id: string) => {
    setGuildId(id);
  };

  // 1-to-1 Chat Overlay
  if (activePrivateChat) {
    return <PrivateChatRoom />;
  }

  return (
    <div className="w-full h-full flex flex-col bg-brand-cream relative pb-32">
      {/* Header and Switcher */}
      <div className="pt-4 px-4 md:px-6 pb-3 flex flex-col md:flex-row items-start md:items-end justify-between z-50 sticky top-0 bg-brand-cream/90 backdrop-blur-md gap-3 md:gap-0">
        
        {/* Row 1 on mobile: Titles (if any) */}
        {(activeTab === 'friends' || !guildId) && (
          <div className="w-full flex justify-between items-start mb-1 md:mb-0">
            <div>
              {activeTab === 'community' && !guildId ? (
                <>
                  <h1 className="text-3xl font-bold text-slate-800 mb-1 md:mb-2">Community</h1>
                  <p className="text-slate-500 text-sm">Find your perfect eco-community.</p>
                </>
              ) : activeTab === 'friends' && (
                <>
                  <h1 className="text-3xl font-bold text-slate-800 mb-1 md:mb-2">Friends</h1>
                  <p className="text-slate-500 text-sm">Connect with other eco-warriors.</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Row 2 on mobile: Switcher and Capybara */}
        <div className="flex items-center justify-between gap-3 w-full md:w-auto mt-1 md:mt-0">
          {/* Segmented Control */}
          <div className="flex-1 md:flex-none bg-slate-200/50 backdrop-blur-md rounded-[1rem] p-1 flex items-center shadow-inner border border-black/5 relative min-w-[200px]">
            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[0.8rem] shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out ${activeTab === 'community' ? 'translate-x-[calc(100%+2px)]' : 'translate-x-0'}`} />
            
            <button
              onClick={() => setActiveTab('friends')}
              className={`relative flex-1 md:flex-none px-4 md:px-6 py-2 text-[13px] font-bold transition-colors z-10 rounded-[0.8rem] ${
                activeTab === 'friends' 
                  ? 'text-slate-800' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Friends
              {friendsUnreadCount > 0 && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center border border-white shadow-sm">
                  <span className="text-[9px] font-bold text-white leading-none">{friendsUnreadCount > 99 ? '99+' : friendsUnreadCount}</span>
                </div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={`relative flex-1 md:flex-none px-4 md:px-6 py-2 text-[13px] font-bold transition-colors z-10 rounded-[0.8rem] ${
                activeTab === 'community' 
                  ? 'text-slate-800' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Community
              {communityUnreadCount > 0 && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center border border-white shadow-sm">
                  <span className="text-[9px] font-bold text-white leading-none">{communityUnreadCount > 99 ? '99+' : communityUnreadCount}</span>
                </div>
              )}
            </button>
          </div>
          
          {/* Capybara Requests Icon */}
          <div className="shrink-0 mb-0">
            <CapybaraRequests />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'friends' ? (
          <FriendsTab />
        ) : (
          guildId ? <CommunityDashboard /> : <CommunityDiscovery onJoinCommunity={handleJoin} />
        )}
      </div>

      {/* Floating Chat for Community */}
      {activeTab === 'community' && guildId && (
        <FloatingChat guildId={guildId} />
      )}
    </div>
  );
}
