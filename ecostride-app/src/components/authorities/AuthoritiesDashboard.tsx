import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Map as MapIcon, AlertTriangle, Settings, LogOut } from 'lucide-react';
import { DashboardHome } from './views/DashboardHome';
import { auth } from '../../firebase';

export function AuthoritiesDashboard() {
  const location = useLocation();
  const [showIntro, setShowIntro] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fading out after 2.5 seconds
    const timer1 = setTimeout(() => setFadeOut(true), 2500);
    // Completely unmount after 3 seconds (allowing 500ms for the fade transition)
    const timer2 = setTimeout(() => setShowIntro(false), 3000);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  const navItems = [
    { name: 'Home', path: '/authorities', icon: Home },
    { name: 'Map', path: '/authorities/map', icon: MapIcon },
    { name: 'Reported Issues', path: '/authorities/issues', icon: AlertTriangle },
    { name: 'Settings', path: '/authorities/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen bg-[#1B4A2E] overflow-hidden font-sans relative">
      
      {/* Intro Animation Overlay */}
      {showIntro && (
        <div 
          className={`absolute inset-0 z-50 bg-[#1B4A2E]/40 backdrop-blur-2xl flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
        >
          <div className="relative flex flex-col items-center animate-in slide-in-from-bottom-8 fade-in duration-1000">
            {/* Glowing Logo */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-[#D5B054] rounded-full blur-2xl opacity-50 animate-pulse"></div>
              <div className="w-24 h-24 bg-white rounded-[24px] flex items-center justify-center shadow-2xl relative z-10">
                <span className="text-5xl font-black text-[#1B4A2E]">E</span>
              </div>
            </div>
            
            {/* Text */}
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4 text-center">
              EcoStride <span className="text-[#D5B054]">Authorities</span>
            </h1>
            <p className="text-emerald-100/70 text-lg md:text-xl font-medium max-w-md text-center">
              "Empowering leaders to build greener, smarter, and safer cities."
            </p>
          </div>
        </div>
      )}

      {/* Inner App Container */}
      <div className="flex w-full h-full relative">
        
        {/* Sidebar */}
        <div className="w-64 bg-white z-10 flex flex-col h-full rounded-r-3xl">
          <div className="p-8 flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white font-black">E</div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">EcoStride</h1>
          </div>
          
          <nav className="flex-1 px-4 space-y-2 mt-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/authorities' && location.pathname === '/authorities/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center space-x-4 px-6 py-4 rounded-2xl transition-all duration-300 font-bold ${
                    isActive
                      ? 'text-[#1B4A2E] bg-emerald-50'
                      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <Icon size={22} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                  <span className="text-[15px]">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-6">
            <button
              onClick={() => auth.signOut()}
              className="flex items-center space-x-3 w-full py-4 px-6 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl font-bold transition-all duration-300"
            >
              <LogOut size={20} strokeWidth={2.5} />
              <span className="text-[15px]">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto relative">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/map" element={<div className="p-8 flex items-center justify-center h-full"><h2 className="text-3xl font-black text-white/50">Map View (Coming Soon)</h2></div>} />
            <Route path="/issues" element={<div className="p-8 flex items-center justify-center h-full"><h2 className="text-3xl font-black text-white/50">Issues (Coming Soon)</h2></div>} />
            <Route path="/settings" element={<div className="p-8 flex items-center justify-center h-full"><h2 className="text-3xl font-black text-white/50">Settings (Coming Soon)</h2></div>} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
