import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { useUserStore } from '../../stores/useUserStore';
import { auth } from '../../firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { apiClient } from '../../lib/api';
import { getCountries, getStatesForCountry, getCitiesForState } from '../../lib/locationData';
import { ChevronLeft, User, Bell, Lock, Sliders, HelpCircle, MessageSquare, LogOut, ChevronRight, Moon, Sun, Store, MapPin } from 'lucide-react';

type Tab = 'main' | 'profile' | 'notifications' | 'privacy';

export const SettingsView: React.FC = () => {
  const { user } = useAuthStore();
  const { setActiveView } = useDemoStore();
  const store = useUserStore();
  const [activeTab, setActiveTab] = useState<Tab>('main');
  
  // Profile Location State
  const [country, setCountry] = useState(store.country || '');
  const [state, setState] = useState(store.state || '');
  const [city, setCity] = useState(store.city || '');
  const [saving, setSaving] = useState(false);
  
  // Change Password State
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Delete Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await apiClient(`/users/${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({ country, state, city })
      });
      store.setLocalData({ country, state, city });
      store.addNotification({ title: 'Profile Saved', message: 'Your location changes have been saved.', icon: '✅' });
    } catch (e: any) {
      store.addNotification({ title: 'Error', message: 'Failed to save profile.', icon: '❌' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !user?.email) return;
    setPwError('');
    setPwMsg('');
    setPwLoading(true);
    
    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setPwMsg('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setShowChangePassword(false), 2000);
    } catch (e: any) {
      setPwError(e.message || 'Failed to change password. Please check your old password.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = async () => {
    // backend handles demo_requests cleanup via cron/admin
    auth.signOut();
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmUsername !== store.username) {
      setDeleteError('Username does not match.');
      return;
    }
    
    if (!auth.currentUser) return;
    
    setDeleteLoading(true);
    setDeleteError('');
    
    try {
      // 1. Delete from D1 Database (and all associated data via backend)
      await apiClient(`/users/${auth.currentUser.uid}`, { method: 'DELETE' });
      
      // 2. Delete from Firebase Auth
      await auth.currentUser.delete();
      
      // 3. Sign out and redirect
      auth.signOut();
    } catch (err: any) {
      console.error("Error from API:", err);
      // Firebase requires recent login to delete account
      if (err?.code === 'auth/requires-recent-login') {
        setDeleteError('For security, you must log out and log back in before deleting your account.');
      } else {
        setDeleteError(err.message || 'Failed to delete account. Please try again.');
      }
    } finally {
      setDeleteLoading(false);
    }
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
        className={`w-12 h-6 rounded-full transition-colors relative ${checked ? 'bg-[var(--color-teal-dark)]' : 'bg-black/20 dark:bg-white/20'}`}
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
              readOnly
              className="glass-card border-none bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl font-bold text-[var(--color-text-main)] opacity-70 cursor-not-allowed focus:outline-none"
            />
          </div>
        ))}
        {store.player_id && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-[var(--color-text-muted)]">UID (Unique ID)</label>
            <input 
              type="text" 
              value={`#${store.player_id}`}
              readOnly
              className="glass-card border-none bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl font-bold text-[var(--color-text-main)] opacity-70 cursor-not-allowed focus:outline-none"
            />
          </div>
        )}
        
        {/* Location Section */}
        <div className="mt-4 pt-4 border-t border-[var(--color-teal-dark)]/10 dark:border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-[var(--color-teal-dark)]" />
            <h4 className="text-sm font-black text-[var(--color-text-main)]">Reporting Location</h4>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Your current location is used to assign and report environmental issues to the correct local authority.
          </p>

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[var(--color-text-muted)]">Country</label>
              <select 
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setState('');
                  setCity('');
                }}
                className="glass-card border-none bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-dark)] text-sm"
              >
                <option value="">Select Country</option>
                {getCountries().map((c) => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[var(--color-text-muted)]">State / Province / Region</label>
              <select 
                value={state}
                disabled={!country}
                onChange={(e) => {
                  setState(e.target.value);
                  setCity('');
                }}
                className="glass-card border-none bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-dark)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{country ? 'Select State / Region' : 'Select Country first'}</option>
                {getStatesForCountry(country).map((s) => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[var(--color-text-muted)]">City / District</label>
              <select 
                value={city}
                disabled={!state}
                onChange={(e) => setCity(e.target.value)}
                className="glass-card border-none bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-dark)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{state ? 'Select City / District' : 'Select State first'}</option>
                {getCitiesForState(country, state).map((cty) => (
                  <option key={cty} value={cty}>{cty}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 mt-4">
            <label className="text-sm font-bold text-[var(--color-text-muted)]">Password</label>
            <div className="flex gap-2">
              <input 
                type="password" 
                value="********"
                readOnly
                className="glass-card border-none bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl font-bold text-[var(--color-text-main)] opacity-70 flex-1"
              />
              <button 
                onClick={() => setShowChangePassword(true)}
                className="bg-[var(--color-teal-dark)] hover:bg-[#80abb1] text-white font-bold px-4 rounded-xl transition-colors"
              >
                Change
              </button>
            </div>
        </div>
        
        <button 
          onClick={handleSaveProfile}
          disabled={saving}
          className="w-full mt-6 bg-[var(--color-teal-dark)] hover:bg-[#80abb1] text-white font-black py-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(29,53,57,1)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
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
      <div className="space-y-4 relative z-10 animate-in slide-in-from-right-4 fade-in">
        <h3 className="font-black text-xl text-[var(--color-text-main)] mb-6">Privacy & Security</h3>
        <Toggle label="Public Profile" checked={store.isPublicProfile} onChange={(c) => store.setUserData({ isPublicProfile: c })} />
        <Toggle label="Share Activity Status" checked={store.shareActivityStatus} onChange={(c) => store.setUserData({ shareActivityStatus: c })} />
        <Toggle label="Allow Friend Requests" checked={store.allowFriendRequests} onChange={(c) => store.setUserData({ allowFriendRequests: c })} />
        
        <div className="mt-8 pt-6 border-t-2 border-[var(--color-teal-dark)]/20 border-dashed">
          <button onClick={() => setShowChangePassword(true)} className="w-full flex items-center justify-between p-4 glass-card border-none bg-white/50 dark:bg-slate-800/50 rounded-2xl hover:border-[var(--color-teal-dark)] transition-colors">
            <span className="font-bold text-sm text-[var(--color-text-main)]">Change Password</span>
            <ChevronRight size={20} className="text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full p-4 md:p-8 pb-32 overflow-y-auto relative transition-colors duration-500">
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
            <div className="space-y-2">
              <NavItem icon={User} title="Edit Profile" onClick={() => setActiveTab('profile')} />
              <NavItem icon={Bell} title="Notifications" onClick={() => setActiveTab('notifications')} />
              <NavItem icon={Lock} title="Privacy & Security" onClick={() => setActiveTab('privacy')} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-4 pl-2">Support</h3>
            <div className="flex flex-col">
              <NavItem icon={HelpCircle} title="Help Center" />
              <NavItem icon={MessageSquare} title="Feedback" />
            </div>
          </section>

          <section className="pt-4 space-y-3">
            <button 
              onClick={handleLogout}
              className="w-full bg-red-400/80 backdrop-blur-md hover:bg-red-500/90 text-white rounded-[24px] p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all flex items-center justify-center gap-3 border border-white/30"
            >
              <LogOut size={24} />
              <span className="font-black text-xl uppercase tracking-wider">Sign Out</span>
            </button>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="w-full bg-transparent border-2 border-red-500/50 hover:bg-red-50 text-red-500 rounded-[24px] p-4 transition-all flex items-center justify-center gap-2 font-bold"
            >
              Delete Account
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

      {showChangePassword && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border-4 border-slate-900 dark:border-slate-700 rounded-3xl p-6 max-w-sm w-[calc(100%-8px)] sm:w-full shadow-comic dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
            <h2 className="text-2xl font-black text-center mb-4 uppercase text-slate-900 dark:text-white">Change Password</h2>
            
            {pwError && <div className="bg-red-100 border-2 border-red-500 text-red-700 p-2 rounded-xl mb-4 text-sm font-bold">{pwError}</div>}
            {pwMsg && <div className="bg-green-100 border-2 border-green-500 text-green-700 p-2 rounded-xl mb-4 text-sm font-bold">{pwMsg}</div>}
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Current Password</label>
                <input 
                  type="password" 
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  className="w-full bg-transparent border-2 border-slate-900 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-4 py-2 font-bold focus:outline-none focus:border-[#5496a2]" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full bg-transparent border-2 border-slate-900 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-4 py-2 font-bold focus:outline-none focus:border-[#5496a2]" 
                />
              </div>
              
              <div className="flex gap-2 mt-6">
                <button 
                  type="button"
                  onClick={() => { setShowChangePassword(false); setPwError(''); setPwMsg(''); }}
                  className="flex-1 bg-slate-300 text-slate-800 font-bold py-3 rounded-xl hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={pwLoading}
                  className="flex-1 bg-[var(--color-teal-dark)] text-white font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_rgba(29,53,57,1)] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                >
                  {pwLoading ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-bg-main)] border-4 border-[var(--color-text-main)] rounded-3xl p-6 max-w-sm w-[calc(100%-8px)] sm:w-full shadow-[8px_8px_0px_0px_#1d3539] dark:shadow-[8px_8px_0px_0px_#ffffff]">
            <h2 className="text-2xl font-black text-center mb-2 uppercase text-red-600">Delete Account</h2>
            <p className="text-sm font-bold text-[var(--color-text-main)] opacity-80 text-center mb-6">
              This action is <span className="text-red-500 font-black">permanent</span> and cannot be undone. All your coins, trees, and history will be lost.
            </p>
            
            {deleteError && <div className="bg-red-100 border-2 border-red-500 text-red-700 p-2 rounded-xl mb-4 text-sm font-bold">{deleteError}</div>}
            
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">
                  Type <span className="text-red-500 select-all">{store.username}</span> to confirm:
                </label>
                <input 
                  type="text" 
                  value={confirmUsername}
                  onChange={(e) => setConfirmUsername(e.target.value)}
                  placeholder={store.username}
                  required
                  className="w-full bg-transparent border-2 border-[var(--color-text-main)] text-[var(--color-text-main)] rounded-xl px-4 py-2 font-bold focus:outline-none focus:border-red-500" 
                />
              </div>
              
              <div className="flex gap-2 mt-6">
                <button 
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setDeleteError(''); setConfirmUsername(''); }}
                  className="flex-1 bg-slate-300 text-slate-800 font-bold py-3 rounded-xl hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={deleteLoading || confirmUsername !== store.username}
                  className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl shadow-[4px_4px_0px_0px_#7f1d1d] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
