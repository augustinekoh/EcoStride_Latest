import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { apiClient, getApiBaseUrl } from '../../lib/api';
import imageCompression from 'browser-image-compression';
import { Camera, Leaf } from 'lucide-react';
import { FloatingIcons } from '../FloatingIcons';

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea, North", "Korea, South", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

const AuthBackgroundWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-100/30 dark:bg-slate-900/60 p-4 overflow-y-auto overflow-x-hidden backdrop-blur-sm">
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 fixed">
      <div className="absolute top-[0%] left-[-10%] w-[70%] h-[50%] bg-emerald-400/20 dark:bg-emerald-600/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute top-[40%] right-[-10%] w-[60%] h-[60%] bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] bg-emerald-300/20 dark:bg-emerald-500/20 rounded-full blur-[90px] animate-pulse" style={{ animationDelay: '2s' }}></div>
    </div>
    
    <FloatingIcons />

    <div className="relative z-10 w-full flex justify-center py-8">
      {children}
    </div>
  </div>
);

export const AuthModal: React.FC = () => {
  const { user, loading, setUser } = useAuthStore();
  const { setMode, isWaitingForApproval, setIsWaitingForApproval, demoRequestRejected } = useDemoStore();
  
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  
  // Step 1 State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'merchant' | 'admin'>('user');

  // Step 2 State
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLogin && step === 2 && username.length > 2) {
      setUsernameStatus('checking');
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`${getApiBaseUrl()}/check-username?username=${encodeURIComponent(username)}`);
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
  }, [username, isLogin, step]);

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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const options = {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      setAvatarFile(compressedFile);

      const reader = new FileReader();
      reader.onload = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      setError('Failed to process image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (!isLogin && step === 1) {
      if (!email || !password) {
        setError('Please fill in all fields');
        return;
      }
      setStep(2);
      return;
    }

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
        
        // Save base info to D1 for new users
        await apiClient(`/users/${userCredential.user.uid}`, {
          method: 'POST',
          body: JSON.stringify({
            email: userCredential.user.email,
            username: username,
            role: role,
            coins: 0,
            totalDistanceKm: 0,
            country: country || null
          })
        });

        // Handle Avatar Upload or Default
        let finalAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
        if (avatarFile) {
          const formData = new FormData();
          formData.append('file', avatarFile, avatarFile.name);
          try {
            const res = await apiClient(`/users/${userCredential.user.uid}/avatar`, {
              method: 'POST',
              body: formData
            });
            if (res.avatarUrl) {
              finalAvatarUrl = res.avatarUrl;
            }
          } catch (err) {
            console.error('Avatar upload failed', err);
          }
        }

        // Secondary update to save bio and final avatar
        await apiClient(`/users/${userCredential.user.uid}`, {
          method: 'POST',
          body: JSON.stringify({
            bio: bio || null,
            avatar: finalAvatarUrl
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
      <AuthBackgroundWrapper>
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700 rounded-3xl p-8 max-w-sm w-[calc(100%-8px)] sm:w-full shadow-sm flex flex-col items-center">
          <h2 className="text-3xl font-black text-center mb-4 uppercase tracking-tight text-slate-900 dark:text-white">
            Access Denied
          </h2>
          <div className="text-5xl mb-6">❌</div>
          <p className="text-center font-bold text-slate-600 dark:text-slate-300 mb-6">
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
            className="bg-red-500 hover:bg-red-600 text-white font-black px-6 py-3 rounded-xl shadow-sm w-full hover:-translate-y-1 transition-transform"
          >
            TRY AGAIN
          </button>
        </div>
      </AuthBackgroundWrapper>
    );
  }

  if (isWaitingForApproval) {
    return (
      <AuthBackgroundWrapper>
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700 rounded-3xl p-8 max-w-sm w-[calc(100%-8px)] sm:w-full shadow-sm flex flex-col items-center">
          <h2 className="text-3xl font-black text-center mb-4 uppercase tracking-tight text-slate-900 dark:text-white">
            Waiting for Admin
          </h2>
          <div className="animate-spin text-5xl mb-6">⏳</div>
          <p className="text-center font-bold text-slate-600 dark:text-slate-300">
            Your demo access request has been sent. Please wait for the admin to approve it.
          </p>
        </div>
      </AuthBackgroundWrapper>
    );
  }

  return (
    <AuthBackgroundWrapper>
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[2rem] p-8 max-w-sm w-[calc(100%-8px)] sm:w-full shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] relative overflow-hidden">
        
        {/* Inner glow effect for glassmorphism */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none rounded-[2rem]"></div>

        <div className="relative z-10">
          <div className="flex justify-center mb-4">
            <div className="bg-emerald-500/20 p-3 rounded-full backdrop-blur-md border border-emerald-500/30">
              <Leaf className="text-emerald-600 dark:text-emerald-400" size={32} />
            </div>
          </div>
          
          <h2 className="text-3xl font-black text-center mb-2 uppercase tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
            {isLogin ? 'Welcome Back' : 'Join EcoStride'}
          </h2>
          <p className="text-center font-bold text-slate-500 dark:text-slate-400 mb-6">
            {isLogin 
              ? 'Login to continue your green quest' 
              : step === 1 
                ? 'Register to start earning rewards' 
                : 'Tell us a bit about yourself'
            }
          </p>

        {error && <div className="bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-200 p-2 rounded-xl mb-4 text-sm font-bold">{error}</div>}
        {msg && <div className="bg-green-100 dark:bg-green-500/20 border border-green-200 dark:border-green-500/50 text-green-700 dark:text-green-200 p-2 rounded-xl mb-4 text-sm font-bold">{msg}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* STEP 1 / LOGIN */}
          {(isLogin || step === 1) && (
            <>
              <div>
                <label className="block font-bold text-sm mb-1 text-slate-700 dark:text-slate-300">Email</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all" 
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-sm text-slate-700 dark:text-slate-300">Password</label>
                  {isLogin && (
                    <button 
                      type="button" 
                      onClick={handleForgotPassword}
                      className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
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
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all" 
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block font-bold text-sm mb-1 text-slate-700 dark:text-slate-300">Select Role</label>
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="user">🚴 Green Rider (User)</option>
                    <option value="merchant">🏪 Store Owner (Merchant)</option>
                  </select>
                </div>
              )}
            </>
          )}

          {/* STEP 2 */}
          {!isLogin && step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              
              <div className="flex flex-col items-center mb-4">
                <label className="w-24 h-24 rounded-full overflow-hidden shrink-0 flex items-center justify-center p-1 shadow-sm border border-slate-200 dark:border-slate-600 hover:-translate-y-1 transition-transform duration-300 relative group cursor-pointer bg-white dark:bg-slate-800">
                  <img 
                    src={avatarPreview || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || 'placeholder'}`} 
                    alt="Profile" 
                    className="w-full h-full object-cover rounded-full bg-[#faf9f6]"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
                    <Camera className="text-white" size={24} />
                  </div>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageChange} 
                  />
                </label>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2">Upload Picture (Optional)</span>
              </div>

              <div>
                <label className="block font-bold text-sm mb-1 text-slate-700 dark:text-slate-300">Username</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^[a-zA-Z0-9@_-]*$/.test(val)) {
                        setUsername(val);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all" 
                    placeholder="CoolRider99"
                  />
                  {username.length > 2 && (
                    <div className="absolute right-3 top-2.5 text-sm font-bold">
                      {usernameStatus === 'checking' && <span className="text-slate-400">⏳</span>}
                      {usernameStatus === 'available' && <span className="text-emerald-500">✓</span>}
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

              <div>
                <label className="block font-bold text-sm mb-1 text-slate-700 dark:text-slate-300">Bio (Optional)</label>
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all min-h-[80px]" 
                  placeholder="Tell everyone what drives you..."
                />
              </div>

              <div>
                <label className="block font-bold text-sm mb-1 text-slate-700 dark:text-slate-300">Country</label>
                <select 
                  value={country} 
                  onChange={(e) => setCountry(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-bold text-slate-900 dark:text-white"
                >
                  <option value="" disabled>Select your country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            {!isLogin && step === 2 && (
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="w-1/3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-3 rounded-full font-black uppercase tracking-wide active:translate-y-1 transition-all"
              >
                Back
              </button>
            )}
            <button 
              type="submit" 
              disabled={loading || (!isLogin && step === 2 && usernameStatus === 'taken')}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-full font-black uppercase tracking-wide active:translate-y-1 transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isLogin ? 'Login' : step === 1 ? 'Next' : 'Register')}
            </button>
          </div>

        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { 
              setIsLogin(!isLogin); 
              setStep(1);
              setError(''); 
              setMsg(''); 
            }}
            className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline underline-offset-4 decoration-2 transition-colors"
          >
            {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </div>
        </div>
      </div>
    </AuthBackgroundWrapper>
  );
};
