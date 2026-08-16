import { useState, useEffect } from 'react';
import { Send, Loader2, User as UserIcon, MessageSquare, Inbox, Search, MapPin } from 'lucide-react';
import { useUserStore } from '../../../stores/useUserStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useMailStore } from '../../../stores/useMailStore';
import { apiClient } from '../../../lib/api';
import { formatLocation } from '../../../lib/locationData';
import { AuthorityProfileModal } from './AuthorityProfileModal';

export function AuthoritySettingsView() {
  const { user } = useAuthStore();
  const { username, bio, avatar, email, country, state, city } = useUserStore();
  
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'send' | 'inbox'>('send');
  const { mails, readMails, markBatchAsReadLocally, removeMailLocally } = useMailStore();
  
  const unreadMails = (mails || []).filter(m => !(readMails || []).includes(m.id));
  const hasUnread = unreadMails.length > 0;
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const fetchMails = async () => {
      try {
        const mailData = await apiClient('/mail');
        if (mailData.mail && user) {
          const filtered = mailData.mail.filter((m: any) => {
            if (m.recipient_type === 'authority' && m.recipient_id === user.uid) return true;
            if (m.recipient_type === 'authority_all') return true;
            if (m.recipient_type === 'all') return true;
            if (m.recipient_type === 'user' && m.recipient_id === user.uid) return true;
            return false;
          });
          useMailStore.getState().setMailsData(filtered.map((m: any) => ({
            id: m.id,
            title: m.title,
            content: m.content,
            sender: m.sender,
            createdAt: m.created_at || m.createdAt,
            action_type: m.action_type,
            action_data: m.action_data,
            category: m.category
          })), mailData.read_mail_ids || []);
        }
      } catch (err) {
        console.error("Failed to fetch authority inbox:", err);
      }
    };
    fetchMails();
  }, [user, activeTab]);

  useEffect(() => {
    if (activeTab === 'inbox' && unreadMails.length > 0) {
      markBatchAsReadLocally(unreadMails.map(m => m.id));
    }
  }, [activeTab, mails, readMails]);

  const handleOpenInbox = () => {
    setActiveTab('inbox');
    if (unreadMails.length > 0) {
      markBatchAsReadLocally(unreadMails.map(m => m.id));
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      await apiClient('/authorities/contact-admin', {
        method: 'POST',
        body: JSON.stringify({ content: message })
      });
      setSuccess(true);
      setMessage('');
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-full bg-[#224C31] p-6 lg:p-12 relative overflow-hidden">
      {/* Background Artwork matching other tabs */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="network-pattern-settings" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 120 60 L 60 120 L 0 60 Z" fill="none" stroke="#EAF0EC" strokeWidth="0.5" />
              <circle cx="60" cy="60" r="2" fill="#EAF0EC" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#network-pattern-settings)" />
          
          <g transform="translate(100, 100)" opacity="0.4">
            <path d="M0 0 C 100 50, 200 -50, 300 0 S 500 100, 600 0" fill="none" stroke="#34D399" strokeWidth="2" strokeDasharray="4 8" />
            <circle cx="0" cy="0" r="4" fill="#34D399" />
            <circle cx="300" cy="0" r="4" fill="#34D399" />
            <circle cx="600" cy="0" r="4" fill="#34D399" />
          </g>
        </svg>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-[#EAF0EC]/70">Manage your profile and contact administration.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Information Card */}
          <div 
            onClick={() => setIsProfileModalOpen(true)}
            className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-pointer hover:shadow-[0_12px_40px_rgb(0,0,0,0.15)] hover:-translate-y-1 transition-all group flex flex-col justify-between border border-transparent hover:border-[#34D399]/30"
          >
            <div>
              <div className="w-24 h-24 rounded-full bg-[#EAF0EC] overflow-hidden mb-6 flex flex-shrink-0 items-center justify-center shadow-inner relative">
                {avatar ? (
                  <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={40} className="text-[#224C31]/40" />
                )}
                {/* Decorative dots in avatar background */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#224C31_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none"></div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-1">{username || 'Authority User'}</h2>
              <p className="text-[#34D399] font-medium mb-1">{bio || 'Infrastructure Officer'}</p>
              <p className="text-gray-500 text-sm mb-3">{email || user?.email}</p>
              
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl w-fit">
                <MapPin size={14} className="text-emerald-600 shrink-0" />
                <span>{formatLocation(city, state, country) || 'Jurisdiction Unassigned'}</span>
              </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between text-[#224C31] font-medium group-hover:text-[#34D399] transition-colors">
              <span>Edit Profile</span>
              <span className="transform group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Contact Admin / Inbox Card */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-gray-800">Administrator</h3>
              <div className="flex space-x-2 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('send')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'send' 
                      ? 'bg-white text-[#224C31] shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <MessageSquare size={16} /> Send
                </button>
                <button
                  onClick={handleOpenInbox}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 relative ${
                    activeTab === 'inbox' 
                      ? 'bg-white text-[#224C31] shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Inbox size={16} />
                  <span>Inbox</span>
                  {hasUnread && activeTab !== 'inbox' && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </button>
              </div>
            </div>
            
            {activeTab === 'send' ? (
              <form onSubmit={handleSendMessage} className="flex flex-col flex-grow">
                <p className="text-gray-500 text-sm mb-4">Need assistance or want to report an issue with the system? Send a direct message to the admin team.</p>
                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 p-3 bg-green-50 text-[#224C31] rounded-xl text-sm border border-green-100">
                    Message sent successfully!
                  </div>
                )}
                
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message here..."
                  className="w-full flex-grow min-h-[120px] p-4 bg-gray-50 border border-gray-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#34D399]/50 focus:bg-white transition-all text-gray-700 text-sm mb-4"
                  required
                />
                
                <button 
                  type="submit" 
                  disabled={loading || !message.trim()}
                  className="w-full py-3 bg-[#224C31] hover:bg-[#1a3a25] disabled:bg-[#EAF0EC] disabled:text-gray-400 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 mt-auto"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <> <Send size={18} /> Send Message </>}
                </button>
              </form>
            ) : (
              <div className="flex flex-col flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-3">
                {mails && mails.length > 0 ? (
                  mails.map((mail) => (
                    <div key={mail.id} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 transition-colors hover:bg-gray-100">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-800">{mail.title}</h4>
                        <span className="text-xs text-gray-400">
                          {new Date(mail.createdAt || mail.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{mail.content}</p>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#34D399] font-medium">From: {mail.sender}</span>
                        <button 
                          onClick={() => {
                            removeMailLocally(mail.id);
                            apiClient(`/mail/user/${mail.id}`, { method: 'DELETE' }).catch(console.error);
                          }}
                          className="text-red-400 hover:text-red-500 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center flex-grow text-gray-400">
                    <Inbox size={48} className="mb-4 text-gray-200" />
                    <p>Your inbox is empty</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
        </div>
      </div>
      
      <AuthorityProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </div>
  );
}


