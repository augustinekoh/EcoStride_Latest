import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Shield, Briefcase, Mail, KeyRound, Loader2, ImagePlus, MapPin } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { auth } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUserStore } from '../../stores/useUserStore';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { getCountries, getStatesForCountry, getCitiesForState, isValidLocation } from '../../lib/locationData';

export const AuthorityRegistration: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [position, setPosition] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  // 1. Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await apiClient(`/authorities/verify-token/${token}`, { method: 'GET' });
        if (res.email) {
          setEmail(res.email);
        } else {
          setError('Invalid or expired invitation link.');
        }
      } catch (err: any) {
        setError(err.message || 'Invalid or expired invitation link.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyToken();
    } else {
      setError('No token provided.');
      setLoading(false);
    }
  }, [token]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const uploadAvatar = async (uid: string): Promise<string | null> => {
    if (!avatarFile) return null;
    try {
      const formData = new FormData();
      formData.append('file', avatarFile);
      const res = await apiClient(`/users/${uid}/avatar`, {
        method: 'POST',
        body: formData,
      });
      return res.avatarUrl;
    } catch (err) {
      console.error('Failed to upload avatar', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password || !position.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!country || !state || !city || !isValidLocation(country, state, city)) {
      setError('Please select a valid assigned jurisdiction (Country, State, and City).');
      return;
    }
    
    setError('');
    setSubmitting(true);
    
    try {
      // 2. Create or Sign In Firebase Auth User
      let user;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          user = userCredential.user;
        } else {
          throw authErr;
        }
      }
      
      await updateProfile(user, { displayName: name });
      
      // Wait a moment for auth state to propagate (Firebase token logic)
      const idToken = await user.getIdToken(true);
      
      // 3. Upload Avatar if any
      let uploadedAvatarUrl = null;
      if (avatarFile) {
        uploadedAvatarUrl = await uploadAvatar(user.uid);
      }

      // 4. Register on Backend
      await apiClient('/authorities/register', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          token,
          name,
          position,
          country,
          state,
          city,
          avatar: uploadedAvatarUrl
        })
      });

      // Update both user store and auth store so all authority profile fields
      // and permissions are immediately active in the session
      useUserStore.getState().setLocalData({
        username: name,
        email: user.email || '',
        bio: position,
        country,
        state,
        city,
        avatar: uploadedAvatarUrl
      });

      const { setUser } = useAuthStore.getState();
      setUser(auth.currentUser, 'authority');

      // Navigate to dashboard (root of authorities portal)
      navigate('/authorities');
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Registration failed. The token may have already been used.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400">Verifying invitation...</p>
      </div>
    );
  }

  if (error && !email) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-xl border border-red-500/30">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl transition-colors font-semibold"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-lg shadow-xl border border-slate-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/50">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Authority Registration</h2>
          <p className="text-slate-400 mt-2">Complete your official local government profile.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-slate-700 border-2 border-dashed border-slate-500 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleAvatarChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">Upload Profile Picture (Optional)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Official Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-400 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Bound to invitation. Cannot be changed.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Position / Department</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. City Planner, Environmental Dept."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors outline-none"
                required
              />
            </div>
          </div>

          {/* Assigned Jurisdiction Hierarchy */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
              <MapPin className="w-4 h-4" />
              <span>Assigned Department Jurisdiction *</span>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Country</label>
              <select 
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setState('');
                  setCity('');
                }}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors outline-none"
              >
                <option value="">Select Country</option>
                {getCountries().map((c) => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">State / Province</label>
                <select 
                  value={state}
                  disabled={!country}
                  onChange={(e) => {
                    setState(e.target.value);
                    setCity('');
                  }}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors outline-none disabled:opacity-50"
                >
                  <option value="">{country ? 'Select State' : 'Select Country first'}</option>
                  {getStatesForCountry(country).map((s) => (
                    <option key={s.code} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">City / District</label>
                <select 
                  value={city}
                  disabled={!state}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors outline-none disabled:opacity-50"
                >
                  <option value="">{state ? 'Select City' : 'Select State first'}</option>
                  {getCitiesForState(country, state).map((cty) => (
                    <option key={cty} value={cty}>{cty}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors outline-none"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold transition-colors flex items-center justify-center mt-4"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Registering...
              </>
            ) : (
              'Complete Registration'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
