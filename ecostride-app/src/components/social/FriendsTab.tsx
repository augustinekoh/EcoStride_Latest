import React, { useState, useEffect } from 'react';
import { Search, UserPlus, MessageCircle, User } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { apiClient, resolveAvatarUrl } from '../../lib/api';
import { auth } from '../../firebase';
import { UserProfileModal } from '../modals/UserProfileModal';

export function FriendsTab() {
  const { setActivePrivateChat } = useDemoStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    fetchFriends();
    
    // Background polling for real-time unread messages
    const interval = setInterval(() => {
      if (userId) {
        apiClient(`/friends/${userId}`)
          .then(data => {
            if (data.friends) {
              setFriends(data.friends);
            }
          })
          .catch(console.error);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [userId]);

  const fetchFriends = async () => {
    if (!userId) return;
    setLoadingFriends(true);
    try {
      const data = await apiClient(`/friends/${userId}`);
      if (data.friends) {
        setFriends(data.friends);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoadingSearch(true);
      apiClient(`/users?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(data => {
          if (data.users) {
            setSearchResults(data.users.filter((u: any) => u.id !== userId));
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSearch(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, userId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleAddFriend = async (friendId: string) => {
    if (!userId) return;
    try {
      await apiClient(`/friends/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ friendId })
      });
      // Refresh friends
      fetchFriends();
      // Remove from search results
      setSearchResults(prev => prev.filter(u => u.id !== friendId));
      
      // Show toast
      setToastMessage("Friend request has been sent!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const openChat = (friendId: string, friendUsername: string) => {
    setActivePrivateChat({ friendId, friendUsername });
  };

  return (
    <div className="p-6 space-y-8 pb-20">
      {/* Search Bar */}
      <section>
        <h2 className="text-sm font-black uppercase text-slate-500 mb-3 tracking-widest">Find Friends</h2>
        <form onSubmit={handleSearch} className="relative flex items-center group">
          <Search size={20} className="absolute left-5 text-slate-400 group-focus-within:text-[var(--color-teal-dark)] transition-colors" />
          <input 
            type="text" 
            placeholder="Search by username or ID..." 
            className="w-full glass-card rounded-full pl-14 pr-12 py-4 text-[15px] font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-[3px] focus:ring-[var(--color-teal-dark)]/20 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button 
            type="submit" 
            className="absolute right-3 bg-[var(--color-teal-dark)] text-white p-2.5 rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all"
          >
            <Search size={16} strokeWidth={3} />
          </button>
        </form>
      </section>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <section className="animate-in fade-in slide-in-from-bottom-2">
          <h2 className="text-sm font-black uppercase text-slate-500 mb-3 tracking-widest">Suggested</h2>
          <div className="space-y-3">
            {searchResults.map(user => {
              const friendRecord = friends.find(f => f.id === user.id);
              const isAccepted = friendRecord?.status === 'accepted';
              const isPending = friendRecord?.status === 'pending';
              
              return (
                <div 
                  key={user.id} 
                  className="glass-card rounded-[1.5rem] p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition-all shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
                  onClick={() => setSelectedProfile(user)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-teal-dark)]/20 flex items-center justify-center text-[var(--color-teal-dark)] overflow-hidden shrink-0">
                      {user.avatar && (user.avatar.startsWith('http') || user.avatar.includes('.') || user.avatar.includes('/')) ? (
                        <img src={resolveAvatarUrl(user.avatar, user.username)} alt={user.username} className="w-full h-full object-cover" />
                      ) : user.avatar ? (
                        <span className="text-lg">{user.avatar}</span>
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--color-text-main)]">{user.username || 'Unknown'}</p>
                      <p className="text-xs font-bold text-slate-400">ID: {user.player_id}</p>
                    </div>
                  </div>
                  {!isAccepted && !isPending && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddFriend(user.id); }}
                      className="bg-slate-50 px-4 py-2 rounded-full flex items-center gap-1.5 text-xs font-bold text-[var(--color-teal-dark)] hover:bg-[var(--color-teal-dark)] hover:text-white transition-colors"
                    >
                      <UserPlus size={14} /> Add
                    </button>
                  )}
                  {isAccepted && (
                    <span className="text-xs font-bold text-slate-400 px-3 py-1.5">Added</span>
                  )}
                  {isPending && (
                    <span className="text-xs font-bold text-slate-400 px-3 py-1.5">Request Sent</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* My Friends */}
      <section>
        <h2 className="text-sm font-black uppercase text-slate-500 mb-3 tracking-widest">My Friends</h2>
        {loadingFriends ? (
          <div className="text-center p-4"><div className="animate-spin text-2xl mx-auto w-fit">⌛</div></div>
        ) : friends.filter(f => f.status === 'accepted' && (!searchQuery.trim() || f.username?.toLowerCase().includes(searchQuery.toLowerCase()) || f.player_id?.includes(searchQuery.trim()))).length === 0 ? (
          <div className="glass-card rounded-2xl p-6 text-center border border-dashed border-black/10">
            <p className="font-bold text-slate-400">No friends found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.filter(f => f.status === 'accepted' && (!searchQuery.trim() || f.username?.toLowerCase().includes(searchQuery.toLowerCase()) || f.player_id?.includes(searchQuery.trim()))).map(friend => (
              <div 
                key={friend.id} 
                className="glass-card rounded-[1.5rem] p-4 flex items-center justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                onClick={() => setSelectedProfile(friend)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-teal-dark)]/20 flex items-center justify-center text-[var(--color-teal-dark)] shadow-inner overflow-hidden">
                      {friend.avatar && (friend.avatar.startsWith('http') || friend.avatar.includes('.') || friend.avatar.includes('/')) ? (
                        <img src={resolveAvatarUrl(friend.avatar, friend.username)} alt={friend.username} className="w-full h-full object-cover" />
                      ) : friend.avatar ? (
                        <span className="text-xl">{friend.avatar}</span>
                      ) : (
                        <User size={24} />
                      )}
                    </div>
                    {friend.unread_count > 0 && (
                      <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black px-1.5 min-w-[20px] h-[20px] rounded-full flex items-center justify-center shadow-sm shadow-rose-500/30 border-[2px] border-white z-10">
                        {friend.unread_count > 99 ? '99+' : friend.unread_count}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[var(--color-text-main)] text-lg leading-none mb-1">{friend.username || 'Unknown'}</p>
                    <p className="text-xs font-bold text-slate-400">ID: {friend.player_id}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); openChat(friend.id, friend.username || 'Unknown'); }}
                  className="bg-[var(--color-teal-dark)] text-white p-3 rounded-full shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                  <MessageCircle size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-[var(--color-teal-dark)] text-white px-6 py-3 rounded-full shadow-lg font-bold text-sm flex items-center gap-2">
            <UserPlus size={16} />
            {toastMessage}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <UserProfileModal 
        isOpen={!!selectedProfile} 
        onClose={() => setSelectedProfile(null)} 
        player={selectedProfile} 
      />
    </div>
  );
}
