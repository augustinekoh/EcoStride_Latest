import React, { useState } from 'react';
import { useDemoStore } from '../../stores/useDemoStore';
import { useUserStore } from '../../stores/useUserStore';
import { useMailStore } from '../../stores/useMailStore';
import { Home, Map as MapIcon, Users, User, Building, ClipboardList } from 'lucide-react';

let lastNavRefreshTime = 0;

export const BottomNavBar: React.FC = () => {
  const { activeView, setActiveView } = useDemoStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const communityUnreadCount = useUserStore(state => state.communityUnreadCount);
  const friendsUnreadCount = useUserStore(state => state.friendsUnreadCount);
  const issuesUnreadCount = useUserStore(state => state.issuesUnreadCount) || 0;
  const unreadRequestsCount = useMailStore(state => state.unreadRequestsCount);
  const unreadMailCount = useMailStore(state => state.unreadCount) || 0;
  const totalSocialUnread = communityUnreadCount + friendsUnreadCount + unreadRequestsCount;
  const totalProfileUnread = issuesUnreadCount;

  const showBar = activeView !== 'map' || isExpanded;

  const navItems = [
    { id: 'landing', icon: <Home size={24} />, label: 'Home' },
    { id: 'city', icon: <Building size={24} />, label: 'City' },
    { id: 'map', icon: <MapIcon size={28} className="text-white drop-shadow-md" />, label: "Walk", isCenter: true },
    { id: 'group', icon: <Users size={24} />, label: 'Social' },
    { id: 'profile', icon: <User size={24} />, label: 'Profile' },
  ];

  return (
    <>


      <div className={`fixed bottom-4 md:absolute md:bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[95%] sm:w-[90%] md:max-w-md transition-all duration-500 ease-out origin-bottom ${(activeView === 'merchant_dashboard' || activeView === 'merchant_onboarding') ? 'max-md:hidden' : ''} ${showBar ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-90 pointer-events-none'}`}>
        <div className="glass-pill rounded-full border-2 pb-2 pt-2 px-1 sm:px-2 flex items-center justify-between shadow-2xl max-md:bg-white/60 max-md:backdrop-blur-lg md:bg-white/80">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            
            if (item.isCenter) {
              return (
                <button 
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'landing' || item.id === 'map') {
                      const now = Date.now();
                      if (now - lastNavRefreshTime > 30000) {
                        if ((window as any).triggerAppRefresh) {
                          (window as any).triggerAppRefresh();
                          lastNavRefreshTime = now;
                        }
                      }
                    }
                    setActiveView(item.id as any);
                    setIsExpanded(false); 
                  }}
                  className="bg-[var(--color-teal-dark)] rounded-full p-3 shadow-md hover:-translate-y-1 hover:shadow-lg transition-all flex flex-col items-center justify-center min-w-[50px] md:min-w-[60px] border-2 border-white"
                >
                  {item.icon}
                  {item.id === 'group' && totalSocialUnread > 0 && (
                    <div className="absolute top-0 right-0 -mt-1 -mr-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full flex items-center justify-center border-2 border-white">
                      <span className="text-[9px] font-bold text-white">{totalSocialUnread > 99 ? '99+' : totalSocialUnread}</span>
                    </div>
                  )}
                </button>
              );
            }

            return (
              <button 
                key={item.id}
                onClick={() => {
                  if (item.id === 'landing' || item.id === 'map') {
                    const now = Date.now();
                    if (now - lastNavRefreshTime > 30000) {
                      if ((window as any).triggerAppRefresh) {
                        (window as any).triggerAppRefresh();
                        lastNavRefreshTime = now;
                      }
                    }
                  }
                  setActiveView(item.id as any);
                  setIsExpanded(false); 
                }}
                className={`flex flex-col items-center justify-center transition-all px-1 sm:px-3 flex-1 md:flex-none`}
              >
                <div className={`relative p-2 rounded-[1.2rem] transition-colors ${isActive ? 'glass-active text-[var(--color-teal-dark)]' : 'text-[var(--color-text-muted)] hover:bg-white/20 hover:text-[var(--color-text-main)]'}`}>
                  {item.icon}
                  {item.id === 'landing' && unreadMailCount > 0 && (
                    <div className="absolute top-0 right-0 -mt-1 -mr-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full flex items-center justify-center border-2 border-white">
                      <span className="text-[9px] font-bold text-white">{unreadMailCount > 99 ? '99+' : unreadMailCount}</span>
                    </div>
                  )}
                  {item.id === 'group' && totalSocialUnread > 0 && (
                    <div className="absolute top-0 right-0 -mt-1 -mr-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full flex items-center justify-center border-2 border-white">
                      <span className="text-[9px] font-bold text-white">{totalSocialUnread > 99 ? '99+' : totalSocialUnread}</span>
                    </div>
                  )}
                  {item.id === 'profile' && totalProfileUnread > 0 && (
                    <div className="absolute top-0 right-0 -mt-1 -mr-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full flex items-center justify-center border-2 border-white">
                      <span className="text-[9px] font-bold text-white">{totalProfileUnread > 99 ? '99+' : totalProfileUnread}</span>
                    </div>
                  )}
                </div>
                <span className={`text-[10px] font-black mt-1 ${isActive ? 'block text-[var(--color-text-main)]' : 'hidden'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
