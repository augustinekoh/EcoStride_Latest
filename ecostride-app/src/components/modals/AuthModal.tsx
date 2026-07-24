import React, { useState, useEffect } from 'react';
import { auth } from '../../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { apiClient } from '../../lib/api';

export const AuthModal: React.FC = () => {
  const { user, loading, setUser } = useAuthStore();
  const { setMode, isWaitingForApproval, setIsWaitingForApproval, demoRequestRejected } = useDemoStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'merchant' | 'admin'>('user');
  const [error, setError] = useState('');

  // If the user is logged in and we are NOT waiting for demo approval, we can hide this modal
  if (user && !isWaitingForApproval) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      let userCredential;

      // Set a flag to tell App.tsx this is a fresh login, so it doesn't auto-approve based on old data
      if (email.toLowerCase() === 'ecostride_demo@gmail.com') {
        sessionStorage.setItem('freshDemoLogin', 'true');
      }

      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Save role to D1 for new users
        await apiClient(`/users/${userCredential.user.uid}`, {
          method: 'POST',
          body: JSON.stringify({
            email: userCredential.user.email,
            role: role,
            coins: 0,
            totalDistanceKm: 0,
            guildId: 'None'
          })
        });
      }

      // Intercept demo account for BOTH Login and Register
      if (email.toLowerCase() === 'ecostride_demo@gmail.com') {
        setIsWaitingForApproval(true);
        useDemoStore.getState().setIsWaitingForApproval(true);
        
        // Fetch IP with a 2-second timeout to prevent 1-minute hangs
        let ipAddress = 'Unknown';
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
          clearTimeout(timeoutId);
          const data = await res.json();
          ipAddress = data.ip;
        } catch (e) {
          // Ignore IP fetch failure
        }
        
        await apiClient('/demo_requests', {
          method: 'POST',
          body: JSON.stringify({
            id: userCredential.user.uid,
            email: userCredential.user.email,
            ipAddress: ipAddress
          })
        });

        // The polling logic in App.tsx will handle the state transition when approved
        return; // Stop further execution here
      }

      // Fetch role from API for normal users (if login)
      if (isLogin) {
        const data = await apiClient(`/users/${userCredential.user.uid}`);
        if (data.user) {
          setMode('explore');
          setUser(userCredential.user, data.user.role);
        } else {
          setMode('explore');
          setUser(userCredential.user, 'user'); // Fallback
        }
      } else {
        // If normal user and registered, just proceed
        setMode('explore');
        setUser(userCredential.user, role);
      }
    } catch (err: any) {
      setIsWaitingForApproval(false);
      useDemoStore.getState().setIsWaitingForApproval(false);
      sessionStorage.removeItem('freshDemoLogin');
      setError(err.message);
    }
  };

  if (isWaitingForApproval) {
    if (demoRequestRejected) {
      return (
        <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-brand-cream border-comic rounded-3xl p-8 max-w-sm w-full shadow-[8px_8px_0px_0px_#0f172a] flex flex-col items-center">
            <h2 className="text-3xl font-black text-center mb-4 uppercase tracking-tight drop-shadow-[2px_2px_0px_#0f172a] text-red-500">
              Access Denied
            </h2>
            <div className="text-5xl mb-6">❌</div>
            <p className="text-center font-bold text-slate-700 mb-6">
              Your demo access request was rejected by the admin.
            </p>
            <button 
              onClick={async () => {
                if (user?.email?.toLowerCase() === 'ecostride_demo@gmail.com') {
                  try {
                    await apiClient(`/demo_requests/${user.uid}`, { method: 'DELETE' });
                  } catch (e) {}
                }
                auth.signOut();
                window.location.reload();
              }}
              className="bg-red-500 text-white font-black px-6 py-3 rounded-xl border-2 border-slate-900 shadow-comic w-full hover:-translate-y-1 transition-transform"
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-[#faf9f6] border-4 border-[#1d3539] rounded-3xl p-8 max-w-sm w-full shadow-[8px_8px_0px_0px_#1d3539] flex flex-col items-center">
          <h2 className="text-3xl font-black text-center mb-4 uppercase tracking-tight drop-shadow-[2px_2px_0px_#80abb1] text-[#1d3539]">
            Waiting for Admin
          </h2>
          <div className="animate-spin text-5xl mb-6">⏳</div>
          <p className="text-center font-bold text-slate-700">
            Your demo access request has been sent to the Admin Dashboard. Please wait for approval to enter Demo Mode.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-[#faf9f6] border-4 border-[#1d3539] rounded-3xl p-8 max-w-sm w-full shadow-[8px_8px_0px_0px_#1d3539]">
        <h2 className="text-3xl font-black text-center mb-2 uppercase tracking-tight drop-shadow-[2px_2px_0px_#80abb1] text-[#1d3539]">
          {isLogin ? 'Welcome Back' : 'Join EcoStride'}
        </h2>
        <p className="text-center font-bold text-slate-500 mb-6">
          {isLogin ? 'Login to continue your green quest' : 'Register to start earning rewards'}
        </p>

        {error && <div className="bg-red-100 border-2 border-red-500 text-red-700 p-2 rounded-xl mb-4 text-sm font-bold">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-bold text-sm mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-slate-900 rounded-xl px-4 py-2 font-bold focus:outline-none focus:ring-4 focus:ring-brand-yellow/50" 
            />
          </div>
          <div>
            <label className="block font-bold text-sm mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-slate-900 rounded-xl px-4 py-2 font-bold focus:outline-none focus:ring-4 focus:ring-brand-yellow/50" 
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block font-bold text-sm mb-1">Select Role</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full border-2 border-slate-900 rounded-xl px-4 py-2 font-bold bg-white"
              >
                <option value="user">🚴 Green Rider (User)</option>
                <option value="merchant">🏪 Store Owner (Merchant)</option>
              </select>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#5496a2] hover:bg-[#80abb1] border-2 border-[#1d3539] text-white py-3 rounded-full font-black uppercase tracking-wide shadow-[4px_4px_0px_0px_#1d3539] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 mt-4"
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-bold text-slate-500 hover:text-slate-900 underline underline-offset-4 decoration-2"
          >
            {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};
