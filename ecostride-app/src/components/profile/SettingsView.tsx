import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { useUserStore } from '../../stores/useUserStore';
import { auth } from '../../firebase';
import { ChevronLeft, User, Bell, Lock, Sliders, HelpCircle, MessageSquare, LogOut, ChevronRight, Moon, Sun, Store } from 'lucide-react';

type Tab = 'main' | 'profile' | 'notifications' | 'privacy' | 'appearance';

export const SettingsView: React.FC = () => {
  const { user } = useAuthStore();
  const { setActiveView } = useDemoStore();
  const store = useUserStore();
  const [activeTab, setActiveTab] = useState<Tab>('main');

  const handleLogout = async () => {
    // backend handles demo_requests cleanup via cron/admin
    auth.signOut();
  };

  const NavItem = ({ icon: Icon, title, onClick }: { icon: any, title: string, onClick?: () => void }) => (
    <button 
      onClick={onClick}
      className="w-full glass-active rounded-[20px] p-4 hover:-translate-y-1 hover:shadow-md transition-all flex items-center justify-between border border-white/30 text-[var(--color-text-main)] mb-3"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-[var(--color-teal-dark)]">
          <Icon size={20} />
        </div>
        <span className="font-bold text-lg tracking-wide">{title}</span>
      </div>
      <ChevronRight size={20} className="text-[var(--color-text-muted)]" />
    </button>
  );

  const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (c: boolean) => void }) => (
    <div className="flex items-center justify-between p-4 glass-card rounded-2xl mb-3">
      <span className="font-bold text-[var(--color-text-main)]">{label}</span>
      <button 
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition-colors relative ${checked ? 'bg-[var(--color-teal-dark)]' : 'bg-gray-300'}`}
      >
        <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  const renderProfile = () => {
    return (
      <div className="space-y-4 relative z-10 animate-in slide-in-from-right-4 fade-in">
        <h3 className="font-black text-xl text-[var(--color-text-main)] mb-6">Edit Profile</h3>
        {['username', 'email'].map(field => (
          <div key={field} className="flex flex-col gap-1">
            <label className="text-sm font-bold text-[var(--color-text-muted)] capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</label>
            <input 
              type="text" 
              value={(store as any)[field]}
              onChange={(e) => store.setUserData({ [field]: e.target.value })}
              className="bg-white/50 border border-white/60 p-3 rounded-xl font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-dark)]"
            />
          </div>
        ))}
        <div className="flex flex-col gap-1 mt-4">
          <label className="text-sm font-bold text-[var(--color-text-muted)]">Nationality</label>
          <select 
            value={store.nationality}
            onChange={(e) => store.setUserData({ nationality: e.target.value })}
            className="bg-white/50 border border-white/60 p-3 rounded-xl font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-dark)]"
          >
            <option value="Global Citizen">Global Citizen</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
            <option value="Malaysia">Malaysia</option>
            <option value="Singapore">Singapore</option>
            <option value="Japan">Japan</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 mt-4">
            <label className="text-sm font-bold text-[var(--color-text-muted)]">Password</label>
            <input 
              type="password" 
              value="********"
              readOnly
              className="bg-white/50 border border-white/60 p-3 rounded-xl font-bold text-[var(--color-text-main)] opacity-70"
            />
        </div>
        <button className="w-full mt-8 bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl shadow-md transition-all active:scale-95">
          Delete Account
        </button>
      </div>
    );
  };

  const renderNotifications = () => {
    return (
      <div className="space-y-2 relative z-10 animate-in slide-in-from-right-4 fade-in">
        <h3 className="font-black text-xl text-[var(--color-text-main)] mb-6">Notifications</h3>
        <Toggle 
          label="Latest News" 
          checked={store.newsEnabled} 
          onChange={(c) => {
            store.setUserData({ newsEnabled: c });
            if (c) store.addNotification({ title: 'News Enabled', message: 'You will now receive latest news!', icon: '📰' });
          }} 
        />
        <Toggle 
          label="Daily Reminder" 
          checked={store.dailyReminderEnabled} 
          onChange={(c) => {
            store.setUserData({ dailyReminderEnabled: c });
            if (c) store.addNotification({ title: 'Reminder On', message: 'Daily walk reminder set.', icon: '⏰' });
          }} 
        />
        <Toggle 
          label="New Follower Alerts" 
          checked={store.newFollowerEnabled} 
          onChange={(c) => {
            store.setUserData({ newFollowerEnabled: c });
            if (c) store.addNotification({ title: 'Followers On', message: 'You will be notified of new followers.', icon: '👥' });
          }} 
        />
      </div>
    );
  };

  const renderPrivacy = () => {
    return (
      <div className="space-y-2 relative z-10 animate-in slide-in-from-right-4 fade-in">
        <h3 className="font-black text-xl text-[var(--color-text-main)] mb-6">Privacy</h3>
        <Toggle label="Share Activity with Anyone" checked={store.shareActivity} onChange={(c) => store.setUserData({ shareActivity: c })} />
        <Toggle label="Do Not Disturb" checked={store.doNotDisturb} onChange={(c) => store.setUserData({ doNotDisturb: c })} />
      </div>
    );
  };

  const renderAppearance = () => {
    return (
      <div className="space-y-4 relative z-10 animate-in slide-in-from-right-4 fade-in">
        <h3 className="font-black text-xl text-[var(--color-text-main)] mb-6">Appearance</h3>
        <div className="flex gap-4">
          <button 
            onClick={() => store.setUserData({ isDarkMode: false })}
            className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${!store.isDarkMode ? 'border-[var(--color-teal-dark)] glass-active shadow-md' : 'border-transparent glass-card hover:bg-white/30'}`}
          >
            <Sun size={32} className={!store.isDarkMode ? 'text-[var(--color-teal-dark)]' : 'text-gray-400'} />
            <span className="font-bold text-sm">Light Mode</span>
          </button>
          <button 
            onClick={() => store.setUserData({ isDarkMode: true })}
            className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${store.isDarkMode ? 'border-[var(--color-teal-dark)] bg-slate-800 text-white shadow-md' : 'border-transparent glass-card hover:bg-white/30'}`}
          >
            <Moon size={32} className={store.isDarkMode ? 'text-[var(--color-teal-dark)]' : 'text-gray-400'} />
            <span className="font-bold text-sm">Dark Mode</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full p-4 md:p-8 pb-32 overflow-y-auto relative bg-[#faf9f6] transition-colors duration-500">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-pastel-yellow)] rounded-full mix-blend-overlay filter blur-3xl opacity-60 animate-pulse pointer-events-none"></div>
      
      <div className="flex items-center gap-4 mb-8 relative z-10 pt-2">
        <button 
          onClick={() => activeTab === 'main' ? setActiveView('profile') : setActiveTab('main')}
          className="w-12 h-12 glass-card rounded-full flex items-center justify-center hover:scale-105 transition-transform"
        >
          <ChevronLeft size={24} className="text-[var(--color-text-main)]" />
        </button>
        <h2 className="text-3xl font-black uppercase tracking-tight text-[var(--color-text-main)]">
          {activeTab === 'main' ? 'Settings' : activeTab.replace('_', ' ')}
        </h2>
      </div>

      {activeTab === 'main' && (
        <div className="relative z-10 space-y-8 animate-in slide-in-from-left-4 fade-in">
          <section>
            <h3 className="text-sm font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-4 pl-2">Account</h3>
            <div className="flex flex-col">
              <NavItem icon={User} title="Profile" onClick={() => setActiveTab('profile')} />

              <NavItem icon={Bell} title="Notification" onClick={() => setActiveTab('notifications')} />
              <NavItem icon={Lock} title="Privacy Setting" onClick={() => setActiveTab('privacy')} />
              <NavItem icon={Sliders} title="Appearance" onClick={() => setActiveTab('appearance')} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-4 pl-2">Support</h3>
            <div className="flex flex-col">
              <NavItem icon={HelpCircle} title="Help Center" />
              <NavItem icon={MessageSquare} title="Feedback" />
            </div>
          </section>

          <section className="pt-4">
            <button 
              onClick={handleLogout}
              className="w-full bg-red-400/80 backdrop-blur-md hover:bg-red-500/90 text-white rounded-[24px] p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all flex items-center justify-center gap-3 border border-white/30"
            >
              <LogOut size={24} />
              <span className="font-black text-xl uppercase tracking-wider">Sign Out</span>
            </button>
          </section>

          <div className="flex flex-col items-center gap-3 pt-6 pb-10 text-xs font-bold text-[var(--color-text-muted)] opacity-70">
            <button className="hover:text-[var(--color-text-main)] transition-colors">Terms of Service</button>
            <button className="hover:text-[var(--color-text-main)] transition-colors">Privacy Policy</button>
            <button className="hover:text-[var(--color-text-main)] transition-colors">Acknowledgements</button>
          </div>
        </div>
      )}

      {activeTab === 'profile' && renderProfile()}
      {activeTab === 'notifications' && renderNotifications()}
      {activeTab === 'privacy' && renderPrivacy()}
      {activeTab === 'appearance' && renderAppearance()}

    </div>
  );
};
