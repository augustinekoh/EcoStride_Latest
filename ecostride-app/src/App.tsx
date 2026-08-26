import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NativeBridge } from './components/NativeBridge';
import { AuthorityRegistration } from './components/authorities/AuthorityRegistration';
import { useDemoStore } from './stores/useDemoStore';
import { BottomNavBar } from './components/controls/BottomNavBar';
import { ProfileView } from './components/profile/ProfileView';
import { SettingsView } from './components/profile/SettingsView';
import { CityView } from './components/city/CityView';
import { LandingPage } from './components/landing/LandingPage';
import { MerchantDashboard } from './components/merchant/MerchantDashboard';
import { RouteSimulator } from './components/controls/RouteSimulator';
import { MapView } from './components/map/MapView';
import { ImpactReportModal } from './components/modals/ImpactReportModal';
import { MerchantOnboardingForm } from './components/merchant/MerchantOnboardingForm';
import { AuthModal } from './components/modals/AuthModal';
import { VerificationPending } from './components/landing/VerificationPending';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { SocialRouter } from './components/social/SocialRouter';
import { useAuthStore } from './stores/useAuthStore';
import { auth } from './firebase';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { apiClient } from './lib/api';
import { useUserStore } from './stores/useUserStore';
import { useMailStore } from './stores/useMailStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { AuthoritiesDashboard } from './components/authorities/AuthoritiesDashboard';
import { CaseReportsView } from './components/cases/CaseReportsView';
import { StartupAnimation } from './components/StartupAnimation';
import { PullToRefresh } from './components/controls/PullToRefresh';

function PublicApp() {
  const { activeView, isWaitingForApproval, isChatExpanded, isMobileMenuOpen } = useDemoStore();
  const { user, role } = useAuthStore();
  const { isDarkMode, bannedUntil } = useUserStore();

  if (!user || isWaitingForApproval) {
    return (
      <div className={`w-screen h-screen overflow-hidden relative text-slate-900 font-sans transition-colors duration-500 ${isDarkMode ? 'dark' : ''}`}>
        <AuthModal />
      </div>
    );
  }

  if (bannedUntil && bannedUntil > Date.now()) {
    const timeLeft = Math.max(0, bannedUntil - Date.now());
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const dateStr = new Date(bannedUntil).toLocaleDateString();

    return (
      <div className={`w-screen h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-sans transition-colors duration-500 ${isDarkMode ? 'dark' : ''}`}>
        <div className="bg-white dark:bg-slate-800 border-4 border-red-200 dark:border-red-900/50 p-8 rounded-3xl max-w-md w-full text-center shadow-xl shadow-red-500/5">
          <div className="text-6xl mb-6 drop-shadow-md">🚫</div>
          <h1 className="text-2xl font-black text-red-500 uppercase tracking-widest mb-4">Account Suspended</h1>
          <p className="text-slate-600 dark:text-slate-300 font-bold mb-2">
            Your account has been temporarily suspended due to a violation of our community guidelines.
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
            {bannedUntil > 4000000000000 ? (
              <span className="text-red-500 font-black">This ban is permanent.</span>
            ) : (
              <span>The ban will be lifted in <span className="text-red-500 font-black">{days} days, {hours} hours</span> ({dateStr}).</span>
            )}
          </p>
          <button 
            onClick={() => auth.signOut()}
            className="w-full bg-slate-900 dark:bg-red-600/20 hover:bg-black dark:hover:bg-red-600/30 dark:border dark:border-red-500/30 text-white font-black py-4 rounded-xl transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Google sign-ins and other verified users will have emailVerified = true.
  // We only block if they explicitly registered with Email/Password and haven't verified.
  // Authorities and Admins bypass this check.
  if (!user?.emailVerified && role !== 'authority' && role !== 'admin') {
    return (
      <div className={`w-screen h-screen overflow-hidden relative text-slate-900 font-sans transition-colors duration-500 ${isDarkMode ? 'dark' : ''}`}>
        <VerificationPending />
      </div>
    );
  }

  if (role === 'authority') {
    return <Navigate to="/authorities" replace />;
  }
  
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className={`w-screen h-screen overflow-hidden relative text-slate-900 font-sans transition-colors duration-500 ${isDarkMode ? 'dark' : ''}`}>
      {activeView !== 'settings' && activeView !== 'cases' && !isChatExpanded && !isMobileMenuOpen && <BottomNavBar />}
      
      <PullToRefresh disabled={activeView === 'map'}>
        {activeView === 'landing' && <LandingPage />}
        {activeView === 'profile' && <ProfileView />}
        {activeView === 'settings' && <SettingsView />}
        {activeView === 'city' && <CityView />}
        {activeView === 'map' && (
          <ErrorBoundary>
            <MapView />
            <RouteSimulator />
            <ImpactReportModal />
          </ErrorBoundary>
        )}
        {activeView === 'merchant_dashboard' && <MerchantDashboard />}
        {activeView === 'merchant_onboarding' && <MerchantOnboardingForm />}
        {activeView === 'group' && <SocialRouter />}
        {activeView === 'cases' && <CaseReportsView />}
      </PullToRefresh>
    </div>
  );
}

function AdminApp() {
  const { role, loading } = useAuthStore();
  if (loading) {
    return <div className="w-screen h-screen bg-slate-900 flex items-center justify-center font-bold text-xl text-white">Loading Admin Portal...</div>;
  }
  if (role !== 'admin') {
    return <AdminLogin />;
  }
  return <AdminDashboard />;
}

function AuthoritiesAppWrapper() {
  const { role, loading } = useAuthStore();
  
  if (loading) {
    return <div className="w-screen h-screen bg-[#224C31] flex items-center justify-center font-bold text-xl text-white">Loading Authority Portal...</div>;
  }

  if (role !== 'authority') {
    return <Navigate to="/" replace />;
  }
  return <AuthoritiesDashboard />;
}

function App() {
  const [animationDone, setAnimationDone] = useState(false);
  const { setUser, loading, setLoading } = useAuthStore();
  const { setUserData } = useUserStore();
  const isDarkMode = useUserStore(state => state.isDarkMode);

  useEffect(() => {
    // Sync dark mode class to HTML tag
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleSessionExpired = () => {
      alert("You have been logged out because your account was accessed on another device.");
      auth.signOut();
      localStorage.removeItem('ecostride_session_id');
    };
    window.addEventListener('session_expired', handleSessionExpired);
    return () => window.removeEventListener('session_expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    // Passive cleanup of expired trees and signposts
    const cleanup = async () => {
      try {
        await apiClient('/admin/cleanup', { method: 'POST' });
      } catch (err) {
        console.error("Cleanup failed:", err);
      }
    };
    cleanup();

    // We want the user to stay logged in across app restarts
    setPersistence(auth, browserLocalPersistence).catch(console.error);
    
    let demoPollInterval: ReturnType<typeof setTimeout>;
    let userPollInterval: ReturnType<typeof setTimeout>;
    let isInitialMailFetch = true;

    let hasRegisteredPush = false;
    const registerPushNotifications = async (uid: string) => {
      if (hasRegisteredPush || !Capacitor.isNativePlatform()) return;
      hasRegisteredPush = true;
      try {
        let permStatus = await PushNotifications.checkPermissions();
        console.log('[Push] Permission status:', permStatus.receive);
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.warn('[Push] Permission not granted:', permStatus.receive);
          return;
        }
        
        // IMPORTANT: Attach listeners BEFORE calling register()
        // to avoid a race condition where the 'registration' event fires
        // before the listener is attached.
        await PushNotifications.removeAllListeners();

        PushNotifications.addListener('registration', async (token) => {
          console.log('[Push] FCM token received:', token.value.substring(0, 20) + '...');
          try {
            await apiClient(`/users/${uid}/devices`, {
              method: 'POST',
              body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() })
            });
            console.log('[Push] Device registered with backend successfully');
          } catch (err) {
            console.error('[Push] Failed to register device with backend:', err);
          }
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('[Push] Registration error:', JSON.stringify(error));
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          // App is in the foreground — suppress notification popup,
          // only silently refresh the mailbox so new messages appear.
          console.log('[Push] Foreground notification suppressed:', notification.title);
          (window as any).triggerAppRefresh?.();
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const data = notification.notification.data;
          if (data && data.mailId) {
            (window as any).pendingNotificationRoute = `/mailbox/${data.mailId}`;
          }
        });

        // Now call register AFTER listeners are attached
        await PushNotifications.register();
        console.log('[Push] PushNotifications.register() called');
      } catch (e) {
        console.error('[Push] Registration failed:', e);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Setup real-time listener for points/carbon (Polling for D1)
        const fetchUserDataAndMails = async () => {
          try {
            const data = await apiClient(`/users/${user.uid}`);
            if (data.user) {
              useUserStore.getState().setLocalData({
                userCoins: data.user.coins || 0,
                // Carbon saved isn't tracked in D1 directly right now, we can calculate it from distance (roughly dist / 5.88 kg)
                totalCarbonSaved: (data.user.total_distance_km || 0) / 5.88,
                totalDistanceKm: data.user.total_distance_km || 0,
                username: data.user.username || 'EcoExplorer',
                email: data.user.email || user.email || '',
                player_id: data.user.player_id,
                totalTreesPlanted: data.user.total_trees_planted || 0,
                createdAt: data.user.created_at || Date.now(), // fallback to now if not set
                activityHistory: data.user.activityHistory || [],
                avatar: data.user.avatar || null,
                guildId: data.user.guild_id || null,
                guildName: data.user.guildName || null,
                bio: data.user.bio || '',
                country: data.user.country || '',
                state: data.user.state || '',
                city: data.user.city || '',
                unlockedBadges: data.user.unlocked_badges ? JSON.parse(data.user.unlocked_badges) : [],
                showcasedBadges: data.user.showcased_badges ? JSON.parse(data.user.showcased_badges) : [],
                bannedUntil: data.user.banned_until,
                ...(data.user.preferences ? {
                  pushEnabled: data.user.preferences.push_enabled === 1,
                  mailboxEnabled: data.user.preferences.mailbox_enabled === 1,
                  socialEnabled: data.user.preferences.social_enabled === 1,
                  newsEnabled: data.user.preferences.news_enabled === 1,
                  dailyReminderEnabled: data.user.preferences.daily_reminder_enabled === 1,
                  newFollowerEnabled: data.user.preferences.new_follower_enabled === 1
                } : {})
              });
              
              // Handle role
              if (data.user.role === 'admin') {
                setUser(user, 'admin');
              } else {
                setUser(user, data.user.role || 'user');
              }
            } else {
              const currentRole = useAuthStore.getState().role || 'user';
              setUser(user, currentRole);
            }

            registerPushNotifications(user.uid);

            // Community Chat Unread polling
            if (data.user && data.user.guild_id) {
              try {
                const unreadData = await apiClient('/chat/unread/' + data.user.guild_id);
                useUserStore.getState().setLocalData({ communityUnreadCount: unreadData.unread_count || 0 });
              } catch (err) {
                console.error("Failed to fetch community unread count", err);
              }
            } else {
              useUserStore.getState().setLocalData({ communityUnreadCount: 0 });
            }

            // Friends Chat Unread polling
            try {
              const friendsData = await apiClient('/friends/' + user.uid);
              if (friendsData.friends) {
                const totalFriendsUnread = friendsData.friends.reduce((sum: number, f: any) => sum + (f.unread_count || 0), 0);
                useUserStore.getState().setLocalData({ friendsUnreadCount: totalFriendsUnread });
              }
            } catch (err) {
              console.error("Failed to fetch friends unread count", err);
            }

            // Issues Chat Unread polling
            try {
              const issuesData = await apiClient('/users/' + user.uid + '/issues');
              if (issuesData.issues) {
                const totalIssuesUnread = issuesData.issues.reduce((sum: number, i: any) => sum + (i.unread_count || 0), 0);
                useUserStore.getState().setLocalData({ issuesUnreadCount: totalIssuesUnread });
              }
            } catch (err) {
              console.error("Failed to fetch issues unread count", err);
            }

            // Mailbox listener via API
            const mailData = await apiClient('/mail');
            if (mailData.mail) {
              const userState = useUserStore.getState() as any;
              const role = useAuthStore.getState().role;
              const filtered = mailData.mail.filter((m: any) => {
                if (m.expires_for_new_users && userState.createdAt) {
                  if (userState.createdAt > m.created_at) return false;
                }
                if (m.recipient_type === 'all') return true;
                if (m.recipient_type === 'user' && m.recipient_id === user.uid) return true;
                if (m.recipient_type === 'merchant_all' && role === 'merchant') return true;
                if (m.recipient_type === 'guild' && userState.guildId && m.recipient_id === userState.guildId) return true;
                if (m.recipient_type === 'authority' && m.recipient_id === user.uid) return true;
                if (m.recipient_type === 'authority_all' && role === 'authority') return true;
                return false;
              });
              
              if (!isInitialMailFetch) {
                const existingMails = useMailStore.getState().mails;
                const newRequests = filtered.filter((m: any) => 
                  (m.action_type === 'friend_request' || m.action_type === 'guild_join_request') &&
                  !(existingMails || []).find(ex => ex.id === m.id)
                );
                
                newRequests.forEach((req: any) => {
                  let message = req.content;
                  if (req.action_type === 'friend_request') {
                    message = "You have a pending friend request to review";
                  }
                  
                  useUserStore.getState().addNotification({
                    title: req.title,
                    message: message,
                    icon: req.action_type === 'friend_request' ? 'Users' : 'Building'
                  });
                });
              }
              isInitialMailFetch = false;

              useMailStore.getState().setMailsData(filtered.map((m: any) => ({
                id: m.id,
                title: m.title,
                content: m.content,
                sender: m.sender,
                createdAt: m.created_at,
                action_type: m.action_type,
                action_data: m.action_data,
                category: m.category
              })), mailData.read_mail_ids || []);
            }
            } catch (e: any) {
              console.error("Failed to fetch user data", e);
              if (e.message && (e.message.includes('401') || e.message.includes('403') || e.message.includes('SESSION_EXPIRED'))) {
                auth.signOut();
                setUser(null, null);
                useUserStore.getState().clearUser();
              } else {
                // Preserve current role on network/server errors instead of downgrading
                const currentRole = useAuthStore.getState().role || 'user';
                setUser(user, currentRole);
              }
            }
        };

        (window as any).triggerAppRefresh = fetchUserDataAndMails;

        if (user.email?.toLowerCase() === 'ecostride0@gmail.com' || user.email?.toLowerCase() === 'ecostride_demo@gmail.com') {
          // Poll demo request status every 3 seconds
          const checkDemoStatus = async () => {
            try {
              const res = await apiClient(`/demo_requests/${user.uid}`);
              if (res.demoRequest) {
                const status = res.demoRequest.status;
                const isFresh = sessionStorage.getItem('freshDemoLogin') === 'true';
                
                if (status === 'approved' && !isFresh) {
                  useDemoStore.getState().setDemoRequestRejected(false);
                  useDemoStore.getState().setIsWaitingForApproval(false);
                  useDemoStore.getState().setMode('demo');
                  fetchUserDataAndMails();
                } else if (status === 'pending') {
                  sessionStorage.removeItem('freshDemoLogin');
                  useDemoStore.getState().setDemoRequestRejected(false);
                  useDemoStore.getState().setIsWaitingForApproval(true);
                } else if (status === 'rejected' && !isFresh) {
                  useDemoStore.getState().setDemoRequestRejected(true);
                  useDemoStore.getState().setIsWaitingForApproval(true);
                } else if (isFresh) {
                  useDemoStore.getState().setIsWaitingForApproval(true);
                }
              } else {
                useDemoStore.getState().setIsWaitingForApproval(true);
              }
            } catch (err) {
              console.error(err);
            }
          };
          
          checkDemoStatus();
          demoPollInterval = setInterval(checkDemoStatus, 3000);
        } else {
          await fetchUserDataAndMails();
          userPollInterval = setInterval(fetchUserDataAndMails, 180000);
        }
      } else {
        setUser(null, null);
        useUserStore.getState().clearUser();
        if (demoPollInterval) clearInterval(demoPollInterval);
        if (userPollInterval) clearInterval(userPollInterval);
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      if (demoPollInterval) clearInterval(demoPollInterval);
      if (userPollInterval) clearInterval(userPollInterval);
    };
  }, [setUser, setLoading, setUserData]);

  if (loading) return <div className="w-screen h-screen bg-brand-cream flex items-center justify-center font-bold text-xl">Loading...</div>;

  return (
    <BrowserRouter>
      {!animationDone && <StartupAnimation onComplete={() => setAnimationDone(true)} />}
      <NativeBridge />
      <Routes>
        <Route path="/authority/register/:token" element={<AuthorityRegistration />} />
        <Route path="/" element={<PublicApp />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="/authorities/*" element={<AuthoritiesAppWrapper />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
