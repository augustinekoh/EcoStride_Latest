import React, { useState, useEffect } from 'react';
import { X, Users, Send } from 'lucide-react';
import { auth } from '../../firebase';
import { apiClient } from '../../lib/api';
import { useUserStore } from '../../stores/useUserStore';

interface Props {
  issueId: string;
  isOpen: boolean;
  onClose: () => void;
  onShared?: () => void;
}

export const ShareIssueModal: React.FC<Props> = ({ issueId, isOpen, onClose, onShared }) => {
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const guildId = useUserStore(state => state.guildId);
  const guildName = useUserStore(state => state.guildName);

  useEffect(() => {
    if (!isOpen) return;
    const fetchFriends = async () => {
      if (!auth.currentUser) return;
      try {
        const data = await apiClient(`/friends/${auth.currentUser.uid}`);
        if (data.friends) setFriends(data.friends);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleShare = async (targetId: string) => {
    setSharing(true);
    setError('');
    try {
      await apiClient(`/issues/${issueId}/share`, {
        method: 'POST',
        body: JSON.stringify({ targetId })
      });
      if (onShared) onShared();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to share issue');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Send size={18} className="text-[#1B4A2E]" />
            Share Report
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-200/50 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Community</h3>
            {guildId ? (
              <button
                disabled={sharing}
                onClick={() => handleShare(guildId)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left disabled:opacity-50 border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
              >
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                  <Users size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 dark:text-slate-100">{guildName || 'Your Community'}</p>
                  <p className="text-xs text-slate-500">Share to everyone in your guild</p>
                </div>
              </button>
            ) : (
              <p className="text-sm text-slate-500 italic px-2">You are not in a community yet.</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Friends</h3>
            {loading ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-300"></div>
              </div>
            ) : friends.length === 0 ? (
              <p className="text-sm text-slate-500 italic px-2">No friends found.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {friends.map(friend => (
                  <button
                    key={friend.id}
                    disabled={sharing}
                    onClick={() => handleShare(friend.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left disabled:opacity-50 border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                  >
                    <img 
                      src={friend.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.id}`} 
                      alt="" 
                      className="w-10 h-10 rounded-full bg-slate-200"
                    />
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-100">{friend.username}</p>
                    </div>
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                      <Send size={14} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
