import React, { useState } from 'react';
import { auth } from '../../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../stores/useAuthStore';

export const AdminLogin: React.FC = () => {
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Verify role against the backend
      const res = await apiClient(`/users/${userCredential.user.uid}`);
      
      if (res.user && res.user.role === 'admin') {
        setUser(userCredential.user, 'admin');
      } else {
        // Not an admin in the separate database, kick them out
        await auth.signOut();
        setUser(null, null);
        setError('Unauthorized: You are not a platform administrator.');
      }
    } catch (err: any) {
      console.error("Admin login error:", err);
      setError(err.message || 'Invalid admin credentials.');
    }
  };

  return (
    <div className="w-full h-screen bg-slate-900 flex items-center justify-center p-4 text-slate-900 font-sans">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        <h2 className="text-3xl font-black text-center mb-2 uppercase tracking-tight text-brand-green">
          EcoStride Admin
        </h2>
        <p className="text-center font-bold text-slate-500 mb-6">
          Platform Management Portal
        </p>

        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-6 text-sm font-bold">{error}</div>}

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block font-bold text-sm mb-1 text-slate-700">Admin Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-slate-300 rounded-xl px-4 py-2 font-bold focus:outline-none focus:border-brand-green" 
            />
          </div>
          <div>
            <label className="block font-bold text-sm mb-1 text-slate-700">Master Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-slate-300 rounded-xl px-4 py-2 font-bold focus:outline-none focus:border-brand-green" 
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-black uppercase tracking-wide transition-all mt-4"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
};
