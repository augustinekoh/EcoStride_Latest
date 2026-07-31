import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { useAuthStore } from './stores/useAuthStore';
import { auth } from './firebase';
import { onAuthStateChanged, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { apiClient } from './lib/api';
import { useUserStore } from './stores/useUserStore';
import { useMailStore } from './stores/useMailStore';

function PublicApp() {
  const { activeView, isWaitingForApproval } = useDemoStore();
  const { user } = useAuthStore();

  if (!user || isWaitingForApproval) {
    return (
      <div className="w-screen h-screen overflow-hidden relative text-slate-900 font-sans transition-colors duration-500">
        <AuthModal />
      </div>
    );
  }

  // Google sign-ins and other verified users will have emailVerified = true.
  // We only block if they explicitly registered with Email/Password and haven't verified.
  if (!auth.currentUser?.emailVerified) {
    return (
      <div className="w-screen h-screen overflow-hidden relative text-slate-900 font-sans transition-colors duration-500">
        <VerificationPending />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative text-slate-900 font-sans transition-colors duration-500">
      {activeView !== 'settings' && <BottomNavBar />}
      
      {activeView === 'landing' && <LandingPage />}
      {activeView === 'profile' && <ProfileView />}
      {activeView === 'settings' && <SettingsView />}
      {activeView === 'city' && <CityView />}
      {activeView === 'map' && (
        <>
          <MapView />
          <RouteSimulator />
          <ImpactReportModal />
        </>
      )}
      {activeView === 'merchant_dashboard' && <MerchantDashboard />}
      {activeView === 'merchant_onboarding' && <MerchantOnboardingForm />}
      {activeView === 'group' && (
        <div className="h-full w-full bg-brand-cream flex items-center justify-center p-8 text-center">
          <h2 className="text-3xl font-black uppercase text-slate-400">Group System Coming Soon!</h2>
        </div>
      )}
    </div>
  );
}

function AdminApp() {
  const { role } = useAuthStore();
  if (role !== 'admin') {
    return <AdminLogin />;
  }
  return <AdminDashboard />;
}

function App() {
  const { setUser, loading, setLoading } = useAuthStore();
  const { setUserData } = useUserStore();

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

    // Force session persistence so closing the tab or opening a new tab logs out the user
    setPersistence(auth, browserSessionPersistence).catch(console.error);
    
    let demoPollInterval: any = null;

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
                activityHistory: data.user.activityHistory || []
              });
              
              // Handle role
              if (data.user.role === 'admin') {
                setUser(user, 'admin');
              } else {
                setUser(user, data.user.role || 'user');
              }
            } else {
              setUser(user, 'user');
            }

            // Mailbox listener via API
            const mailData = await apiClient('/mail');
            if (mailData.mail) {
              const userState = useUserStore.getState() as any;
              const filtered = mailData.mail.filter((m: any) => {
                if (m.expires_for_new_users && userState.createdAt) {
                  if (userState.createdAt > m.created_at) return false;
                }
                const role = useAuthStore.getState().role;
                if (m.recipient_type === 'all') return true;
                if (m.recipient_type === 'user' && m.recipient_id === user.uid) return true;
                if (m.recipient_type === 'merchant_all' && role === 'merchant') return true;
                if (m.recipient_type === 'guild' && userState.guildId && m.recipient_id === userState.guildId) return true;
                return false;
              });
              useMailStore.getState().setMailsData(filtered.map((m: any) => ({
                id: m.id,
                title: m.title,
                content: m.content,
                sender: m.sender,
                createdAt: m.created_at
              })));
            }
          } catch (e) {
            console.error("Failed to fetch user data", e);
            setUser(user, 'user');
          }
        };

        if (user.email?.toLowerCase() === 'ecostride0@gmail.com') {
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
          fetchUserDataAndMails();
        }
      } else {
        setUser(null, null);
        setUserData({ userCoins: 0, totalCarbonSaved: 0, totalDistanceKm: 0, activityHistory: [] });
        if (demoPollInterval) clearInterval(demoPollInterval);
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      if (demoPollInterval) clearInterval(demoPollInterval);
    };
  }, [setUser, setLoading, setUserData]);

  if (loading) return <div className="w-screen h-screen bg-brand-cream flex items-center justify-center font-bold text-xl">Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicApp />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
