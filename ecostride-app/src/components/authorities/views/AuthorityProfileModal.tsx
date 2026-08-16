import { useState } from 'react';
import { X, Save, Lock, Loader2, Upload, MapPin } from 'lucide-react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useUserStore } from '../../../stores/useUserStore';
import { apiClient } from '../../../lib/api';
import { formatLocation } from '../../../lib/locationData';
import { getAuth, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import imageCompression from 'browser-image-compression';

interface AuthorityProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthorityProfileModal({ isOpen, onClose }: AuthorityProfileModalProps) {
  const { user } = useAuthStore();
  const { username: storeUsername, bio: storeBio, avatar: storeAvatar, email, country: storeCountry, state: storeState, city: storeCity, setLocalData } = useUserStore();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  
  const [username, setUsername] = useState(storeUsername || '');
  const [bio, setBio] = useState(storeBio || '');
  const [avatar, setAvatar] = useState(storeAvatar || '');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    
    try {
      const options = { maxSizeMB: 0.1, maxWidthOrHeight: 400, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      
      const formData = new FormData();
      formData.append('file', compressedFile, compressedFile.name);
      
      const res = await apiClient(`/users/${user.uid}/avatar`, {
        method: 'POST',
        body: formData
      });
      
      if (res.avatarUrl) {
         setAvatar(res.avatarUrl);
         setSuccess('Avatar uploaded! Save profile to confirm.');
         setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setError('Failed to upload avatar.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await apiClient('/authorities/profile', {
        method: 'PATCH',
        body: JSON.stringify({ username, bio, avatar })
      });
      
      // Update local store
      setLocalData({ username: res.user.username, bio: res.user.bio, avatar: res.user.avatar });
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser || !currentUser.email) throw new Error('Not authenticated properly');
      
      // Re-authenticate
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, newPassword);
      
      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      let msg = 'Failed to update password';
      if (err.code === 'auth/invalid-credential') msg = 'Incorrect current password';
      else if (err.code === 'auth/weak-password') msg = 'New password is too weak';
      else if (err.message) msg = err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Settings</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex border-b border-gray-100">
          <button 
            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'profile' ? 'text-[#224C31] border-b-2 border-[#224C31]' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setActiveTab('profile'); setError(''); setSuccess(''); }}
          >
            Profile Information
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'password' ? 'text-[#224C31] border-b-2 border-[#224C31]' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setActiveTab('password'); setError(''); setSuccess(''); }}
          >
            <Lock size={16} /> Password
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 text-[#224C31] rounded-lg text-sm border border-green-100">
              {success}
            </div>
          )}

          {activeTab === 'profile' ? (
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email (Read-only)</label>
                <input 
                  type="email" 
                  value={email || user?.email || ''} 
                  disabled 
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Avatar Image</label>
                <div className="flex items-center gap-4">
                  {avatar && (
                    <img src={avatar} alt="Avatar Preview" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                  )}
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium text-gray-700">
                    <Upload size={16} />
                    <span>Upload New Photo</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={loading}
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#34D399] outline-none transition-all text-sm" 
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Position / Role</label>
                <input 
                  type="text" 
                  value={bio} 
                  onChange={e => setBio(e.target.value)}
                  placeholder="e.g. Infrastructure Officer"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#34D399] outline-none transition-all text-sm" 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Assigned Jurisdiction (Read-only)</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm">
                  <MapPin size={14} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold">{formatLocation(storeCity, storeState, storeCountry) || 'Jurisdiction Unassigned'}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Jurisdiction boundaries are configured during registration and cannot be modified.</p>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-2 bg-[#224C31] hover:bg-[#1a3a25] text-white rounded-lg font-medium transition-colors mt-4 flex justify-center items-center h-10"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <> <Save size={16} className="mr-2" /> Save Profile </>}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Current Password</label>
                <input 
                  type="password" 
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#34D399] outline-none transition-all text-sm" 
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#34D399] outline-none transition-all text-sm" 
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#34D399] outline-none transition-all text-sm" 
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-2 bg-[#224C31] hover:bg-[#1a3a25] text-white rounded-lg font-medium transition-colors mt-4 flex justify-center items-center h-10"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Change Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
