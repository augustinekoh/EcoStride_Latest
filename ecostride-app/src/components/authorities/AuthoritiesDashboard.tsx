import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Map as MapIcon, AlertTriangle, Settings, LogOut, RefreshCw } from 'lucide-react';
import { DashboardHome } from './views/DashboardHome';
import { auth } from '../../firebase';
import { MapView } from '../map/MapView';
import { AuthorityIssuesView } from './views/AuthorityIssuesView';
import { AuthoritySettingsView } from './views/AuthoritySettingsView';
import { apiClient } from '../../lib/api';
import { useMailStore } from '../../stores/useMailStore';
import { useUserStore } from '../../stores/useUserStore';

export function AuthoritiesDashboard() {
  const location = useLocation();
  const [showIntro, setShowIntro] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { mails, readMails } = useMailStore();
  const { authorityUnreadCount } = useUserStore();

  const unreadCount = (mails || []).filter(m => !(readMails || []).includes(m.id)).length;
  const hasUnread = unreadCount > 0;
  
  const unreadIssuesCount = authorityUnreadCount || 0;

  useEffect(() => {
    // Start fading out after 2.5 seconds
    const timer1 = setTimeout(() => setFadeOut(true), 2500);
    // Completely unmount after 3 seconds (allowing 500ms for the fade transition)
    const timer2 = setTimeout(() => setShowIntro(false), 3000);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch latest mail and notifications
      const mailData = await apiClient('/mail');
      if (mailData.mail) {
        const user = auth.currentUser;
        if (user) {
          const filtered = mailData.mail.filter((m: any) => {
            if (m.recipient_type === 'authority' && m.recipient_id === user.uid) return true;
            if (m.recipient_type === 'authority_all') return true;
            if (m.recipient_type === 'all') return true;
            if (m.recipient_type === 'user' && m.recipient_id === user.uid) return true;
            return false;
          });
          useMailStore.getState().setMailsData(filtered.map((m: any) => ({
            id: m.id,
            title: m.title,
            content: m.content,
            sender: m.sender,
            createdAt: m.created_at || m.createdAt,
            action_type: m.action_type,
            action_data: m.action_data,
            category: m.category
          })), mailData.read_mail_ids || []);
        }
      }
      // 2. Increment refreshKey so current view refetches from backend
      setRefreshKey(prev => prev + 1);
    } catch (e) {
      console.error("Failed to refresh authority data", e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const navItems = [
    { name: 'Home', path: '/authorities', icon: Home },
    { name: 'Map', path: '/authorities/map', icon: MapIcon },
    { name: 'Issues', path: '/authorities/issues', icon: AlertTriangle, hasUnread: unreadIssuesCount > 0, count: unreadIssuesCount },
    { name: 'Settings', path: '/authorities/settings', icon: Settings, hasUnread, count: unreadCount },
  ];

  return (
    <div className="flex h-screen w-screen bg-[#1B4A2E] overflow-hidden font-sans relative">
      
      {/* Intro Animation Overlay */}
      {showIntro && (
        <div 
          className={`absolute inset-0 z-50 bg-[#174F35]/80 backdrop-blur-2xl flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
        >
          <div className="relative flex flex-col items-center animate-in slide-in-from-bottom-8 fade-in duration-1000">
            {/* Glowing Logo */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-[#C5F04F] rounded-full blur-[50px] opacity-40 animate-pulse"></div>
              <img src="/app-logo.png" alt="EcoStride Logo" className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-2xl relative z-10" />
            </div>
            
            {/* Text */}
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4 text-center">
              EcoStride <span className="text-[#C5F04F]">Authorities</span>
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
        <div className="hidden md:flex w-64 bg-white z-10 flex-col h-full rounded-r-3xl shadow-xl">
          <div className="p-8 flex items-center gap-3">
            <img src="/app-logo.png" alt="Logo" className="w-9 h-9 object-contain drop-shadow-sm" />
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
                  className={`flex items-center space-x-4 px-6 py-4 rounded-2xl transition-all duration-300 font-bold relative ${
                    isActive
                      ? 'text-[#174F35] bg-[#EAF0EC] shadow-sm'
                      : 'text-[#718278] hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <Icon size={22} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                  <span className="text-[15px]">{item.name}</span>
                  {item.hasUnread && (
                    <span className="relative flex h-2.5 w-2.5 ml-auto">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#C8942A]"></span>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-6 space-y-2 border-t border-slate-100">
            {/* Refresh Data Button */}
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="flex items-center space-x-3 w-full py-3.5 px-6 bg-emerald-50 hover:bg-emerald-100/80 text-[#174F35] rounded-2xl font-bold transition-all duration-300 shadow-sm border border-emerald-200/60 disabled:opacity-50 active:scale-95"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin text-emerald-700' : 'text-emerald-700'} strokeWidth={2.5} />
              <span className="text-[14px]">{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>

            {/* Sign Out Button */}
            <button
              onClick={() => auth.signOut()}
              className="flex items-center space-x-3 w-full py-3 px-6 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl font-bold transition-all duration-300"
            >
              <LogOut size={18} strokeWidth={2.5} />
              <span className="text-[14px]">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <Routes>
            <Route path="/" element={<DashboardHome key={refreshKey} />} />
            <Route path="/map" element={<div className="w-full h-full relative"><MapView /></div>} />
            <Route path="/issues" element={<AuthorityIssuesView key={refreshKey} />} />
            <Route path="/settings" element={<AuthoritySettingsView key={refreshKey} />} />
          </Routes>
        </div>

        {/* Modern Floating Mobile Navigation (visible only on mobile) */}
        <div className={`md:hidden fixed bottom-6 left-4 right-4 z-50 flex justify-center pointer-events-none transition-all duration-300 ${location.pathname === '/authorities/map' ? 'translate-y-32 opacity-0' : 'translate-y-0 opacity-100'}`}>
          <div className="bg-[#174F35]/95 backdrop-blur-xl border border-[#2E8B57]/30 shadow-2xl rounded-3xl p-2 flex items-center gap-1 w-full max-w-[360px] pointer-events-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/authorities' && location.pathname === '/authorities/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl relative transition-all duration-300 ${
                    isActive ? 'bg-[#2E8B57] text-white shadow-md' : 'text-[#A5D1B8] hover:text-[#D1FAE5]'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                  <span className={`text-[10px] font-bold mt-1 tracking-wide ${isActive ? 'text-[#C8942A]' : 'text-[#A5D1B8]'}`}>{item.name}</span>
                  
                  {item.hasUnread && (
                    <div className="absolute top-1 right-3 flex items-center justify-center shrink-0 min-w-[16px] h-[16px] bg-[#C8942A] rounded-full shadow-sm">
                      {item.count ? (
                        <span className="text-[8px] font-bold text-[#174F35] leading-none pt-[1px] px-1">{item.count > 99 ? '99+' : item.count}</span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#174F35]"></span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
