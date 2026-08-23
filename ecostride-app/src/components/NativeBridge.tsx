import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useDemoStore } from '../stores/useDemoStore';

export const NativeBridge = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // 1. App Lifecycle Events (Broadcast 'appResumed')
    const stateChangeListener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[NativeBridge] App resumed. Broadcasting event...');
        document.dispatchEvent(new Event('appResumed'));
      }
    });

    // 2. Hardware Back Button Handling
    const backButtonListener = App.addListener('backButton', () => {
      // If we are in authority mode (React Router paths)
      if (location.pathname !== '/') {
        if (location.pathname === '/authorities' || location.pathname === '/authorities/' || location.pathname === '/admin') {
          App.exitApp();
        } else {
          navigate(-1);
        }
      } else {
        // We are on the public app using activeView state instead of router
        const state = useDemoStore.getState();
        
        // Close modals first if any
        if (state.isChatExpanded) {
          state.setIsChatExpanded(false);
          return;
        }
        
        if (state.activePrivateChat) {
          state.setActivePrivateChat(null);
          return;
        }

        if (state.activeView !== 'landing') {
          state.setActiveView('landing');
        } else {
          App.exitApp();
        }
      }
    });

    return () => {
      stateChangeListener.then(l => l.remove());
      backButtonListener.then(l => l.remove());
    };
  }, [location.pathname, navigate]);

  return null;
};
