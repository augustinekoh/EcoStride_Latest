import React, { useState } from 'react';
import { useDemoStore } from '../../stores/useDemoStore';
import { Home, Map as MapIcon, Users, User, Building } from 'lucide-react';

export const BottomNavBar: React.FC = () => {
  const { activeView, setActiveView } = useDemoStore();
  const [isExpanded, setIsExpanded] = useState(false);

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
      {activeView === 'map' && (
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className={`absolute bottom-10 left-4 z-[101] glass-card rounded-full p-4 transition-all duration-300 shadow-xl border border-white/50 ${isExpanded ? 'bg-[var(--color-teal-dark)] text-white scale-90' : 'hover:-translate-y-1 bg-white/90 text-[var(--color-text-main)]'}`}
        >
          <Home size={24} className={isExpanded ? 'text-white' : 'text-[#1d3539]'} />
        </button>
      )}

      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md transition-all duration-500 ease-out origin-bottom ${showBar ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-90 pointer-events-none'}`}>
        <div className="glass-pill px-2 py-2 flex items-center justify-between shadow-2xl">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            
            if (item.isCenter) {
              return (
                <button 
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id as any);
                    setIsExpanded(false); 
                  }}
                  className="bg-[var(--color-teal-dark)] rounded-2xl p-3 shadow-md hover:-translate-y-1 hover:shadow-lg transition-all flex flex-col items-center justify-center min-w-[60px]"
                >
                  {item.icon}
                </button>
              );
            }

            return (
              <button 
                key={item.id}
                onClick={() => {
                  setActiveView(item.id as any);
                  setIsExpanded(false); 
                }}
                className={`flex flex-col items-center justify-center transition-all px-3`}
              >
                <div className={`p-2.5 rounded-[1.2rem] transition-colors ${isActive ? 'glass-active text-[var(--color-teal-dark)]' : 'text-[var(--color-text-muted)] hover:bg-white/20 hover:text-[var(--color-text-main)]'}`}>
                  {item.icon}
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
