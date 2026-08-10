import React, { useState, useEffect } from 'react';
import { auth } from '../../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { apiClient } from '../../lib/api';

export const AuthModal: React.FC = () => {
  const { user, loading, setUser } = useAuthStore();
  const { setMode, isWaitingForApproval, setIsWaitingForApproval, demoRequestRejected } = useDemoStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'user' | 'merchant' | 'admin'>('user');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle');

  useEffect(() => {
    if (!isLogin && username.length > 2) {
      setUsernameStatus('checking');
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/check-username?username=${encodeURIComponent(username)}`);
          const data = await res.json();
          setUsernameStatus(data.available ? 'available' : 'taken');
        } catch (e) {
          setUsernameStatus('idle');
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameStatus('idle');
    }
  }, [username, isLogin]);

  if (user && !isWaitingForApproval) return null;

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email first.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg('Password reset email sent! Check your inbox.');
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    
    try {
      let userCredential;

      if (email.toLowerCase() === 'ecostride0@gmail.com') {
        sessionStorage.setItem('freshDemoLogin', 'true');
      }

      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (usernameStatus === 'taken') {
          setError('Username is already taken!');
          return;
        }
        
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Save role to D1 for new users
        await apiClient(`/users/${userCredential.user.uid}`, {
          method: 'POST',
          body: JSON.stringify({
            email: userCredential.user.email,
            username: username,
            role: role,
            coins: 0,
            totalDistanceKm: 0,
          })
        });
        
        // Send verification email
        await sendEmailVerification(userCredential.user);
      }

      // Intercept demo account for BOTH Login and Register
      if (email.toLowerCase() === 'ecostride0@gmail.com') {
        setIsWaitingForApproval(true);
        useDemoStore.getState().setIsWaitingForApproval(true);
        
        let ipAddress = 'Unknown';
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            ipAddress = data.ip;
          }
        } catch (e) {}

        await apiClient('/demo_requests', {
          method: 'POST',
          body: JSON.stringify({
            id: userCredential.user.uid,
            email: email,
            ipAddress: ipAddress
          })
        });
      }

    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  if (demoRequestRejected) {
    return (
      <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-[#faf9f6] border-4 border-[#1d3539] rounded-3xl p-8 max-w-sm w-[calc(100%-8px)] sm:w-full shadow-[8px_8px_0px_0px_#1d3539] flex flex-col items-center">
          <h2 className="text-3xl font-black text-center mb-4 uppercase tracking-tight drop-shadow-[2px_2px_0px_#80abb1] text-[#1d3539]">
            Access Denied
          </h2>
          <div className="text-5xl mb-6">❌</div>
          <p className="text-center font-bold text-slate-700 mb-6">
            Your demo access request was rejected by the admin.
          </p>
          <button 
            onClick={async () => {
              if (user?.email?.toLowerCase() === 'ecostride0@gmail.com') {
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

  if (isWaitingForApproval) {
    return (
      <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-[#faf9f6] border-4 border-[#1d3539] rounded-3xl p-8 max-w-sm w-[calc(100%-8px)] sm:w-full shadow-[8px_8px_0px_0px_#1d3539] flex flex-col items-center">
          <h2 className="text-3xl font-black text-center mb-4 uppercase tracking-tight drop-shadow-[2px_2px_0px_#80abb1] text-[#1d3539]">
            Waiting for Admin
          </h2>
          <div className="animate-spin text-5xl mb-6">⏳</div>
          <p className="text-center font-bold text-slate-700">
            Your demo access request has been sent. Please wait for the admin to approve it.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#faf9f6] border-4 border-[#1d3539] rounded-3xl p-8 max-w-sm w-[calc(100%-8px)] sm:w-full shadow-[8px_8px_0px_0px_#1d3539] my-8 mr-2 sm:mr-0">
        <h2 className="text-3xl font-black text-center mb-2 uppercase tracking-tight drop-shadow-[2px_2px_0px_#80abb1] text-[#1d3539]">
          {isLogin ? 'Welcome Back' : 'Join EcoStride'}
        </h2>
        <p className="text-center font-bold text-slate-500 mb-6">
          {isLogin ? 'Login to continue your green quest' : 'Register to start earning rewards'}
        </p>

        {error && <div className="bg-red-100 border-2 border-red-500 text-red-700 p-2 rounded-xl mb-4 text-sm font-bold">{error}</div>}
        {msg && <div className="bg-green-100 border-2 border-green-500 text-green-700 p-2 rounded-xl mb-4 text-sm font-bold">{msg}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block font-bold text-sm mb-1">Username</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full border-2 border-slate-900 rounded-xl px-4 py-2 font-bold focus:outline-none focus:ring-4 focus:ring-brand-yellow/50" 
                  placeholder="CoolRider99"
                />
                {username.length > 2 && (
                  <div className="absolute right-3 top-2.5 text-sm font-bold">
                    {usernameStatus === 'checking' && <span className="text-slate-400">⏳</span>}
                    {usernameStatus === 'available' && <span className="text-green-500">✓</span>}
                    {usernameStatus === 'taken' && <span className="text-red-500">✗</span>}
                  </div>
                )}
              </div>
              {usernameStatus === 'taken' && (
                <p className="text-red-500 text-xs font-bold mt-1">
                  This username is already taken. Please choose another one.
                </p>
              )}
            </div>
          )}
          
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
            <div className="flex justify-between items-center mb-1">
              <label className="block font-bold text-sm">Password</label>
              {isLogin && (
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-xs text-brand-green font-bold hover:underline"
                >
                  Forgot?
                </button>
              )}
            </div>
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
            disabled={loading || (!isLogin && usernameStatus === 'taken')}
            className="w-full bg-[#5496a2] hover:bg-[#80abb1] border-2 border-[#1d3539] text-white py-3 rounded-full font-black uppercase tracking-wide shadow-[4px_4px_0px_0px_#1d3539] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 mt-4"
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); setMsg(''); }}
            className="text-sm font-bold text-slate-500 hover:text-slate-900 underline underline-offset-4 decoration-2"
          >
            {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};
