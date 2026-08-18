import { useState, useEffect } from 'react';
import { X, Mail, Loader2, User as UserIcon, Reply, Inbox, Send, Trash2 } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { MessageAuthorityModal } from './MessageAuthorityModal';

interface AdminMessage {
  id: string;
  sender: string;
  sender_name?: string;
  sender_position?: string;
  sender_avatar?: string;
  recipient_name?: string;
  recipient_position?: string;
  recipient_avatar?: string;
  title?: string;
  content: string;
  created_at: number;
}

interface AdminMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMessageRead?: (messageId: string) => void;
  onInitReadIds?: (ids: string[]) => void;
  readMessageIds?: string[];
}

export function AdminMessagesModal({ isOpen, onClose, onMessageRead, onInitReadIds, readMessageIds = [] }: AdminMessagesModalProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [inboxMessages, setInboxMessages] = useState<AdminMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyAuthority, setReplyAuthority] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    }
  }, [isOpen]);

  const fetchMessages = async () => {
    setLoading(true);
    setError('');
    try {
      const [inboxData, sentData] = await Promise.all([
        apiClient('/admin/messages'),
        apiClient('/admin/messages/sent')
      ]);
      
      const inboxList = inboxData.messages || [];
      const sentList = sentData.messages || [];
      
      setInboxMessages(inboxList);
      setSentMessages(sentList);
      
      if (onInitReadIds && inboxData.read_mail_ids) {
        onInitReadIds(inboxData.read_mail_ids);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleRecall = async (id: string) => {
    if (!window.confirm("Are you sure you want to recall this message? It will be deleted permanently.")) return;
    try {
      await apiClient(`/messages/${id}`, { method: 'DELETE' });
      setSentMessages(prev => prev.filter(m => m.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to recall message');
    }
  };

  if (!isOpen) return null;

  const currentMessages = activeTab === 'inbox' ? inboxMessages : sentMessages;
  const unreadCount = inboxMessages.filter(m => !readMessageIds.includes(m.id)).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-teal-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden relative border border-teal-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-teal-50 bg-white z-10 shrink-0">
          <div className="flex items-center gap-3 text-teal-950">
            <div className="p-2.5 bg-teal-50 rounded-xl">
              <Mail size={24} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Authority Mailbox</h2>
              <p className="text-sm text-teal-600/70 font-medium">Manage communications with local authorities</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-teal-900/40 hover:bg-teal-50 hover:text-teal-600 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 bg-teal-50/10 border-b border-teal-50 shrink-0">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors relative ${
              activeTab === 'inbox' 
                ? 'border-teal-600 text-teal-700' 
                : 'border-transparent text-teal-900/50 hover:text-teal-700 hover:border-teal-200'
            }`}
          >
            <Inbox size={16} /> Inbox ({inboxMessages.length})
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'sent' 
                ? 'border-teal-600 text-teal-700' 
                : 'border-transparent text-teal-900/50 hover:text-teal-700 hover:border-teal-200'
            }`}
          >
            <Send size={16} /> Sent ({sentMessages.length})
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-6 bg-teal-50/30 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-teal-600/60">
              <Loader2 size={32} className="animate-spin mb-4" />
              <p className="font-medium">Syncing mailbox...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-center border border-red-100 font-medium">
              {error}
            </div>
          ) : currentMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-teal-900/40">
              {activeTab === 'inbox' ? (
                <Inbox size={48} className="mb-4 opacity-40" />
              ) : (
                <Send size={48} className="mb-4 opacity-40" />
              )}
              <p className="text-lg font-bold text-teal-900/60">No messages found</p>
              <p className="text-sm mt-1">Your {activeTab} is currently empty.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentMessages.map((msg) => {
                const avatar = activeTab === 'inbox' ? msg.sender_avatar : msg.recipient_avatar;
                const name = activeTab === 'inbox' ? (msg.sender_name || 'Unknown Authority') : (msg.recipient_name || 'Authority');
                const position = activeTab === 'inbox' ? msg.sender_position : msg.recipient_position;
                const isUnread = activeTab === 'inbox' && !readMessageIds.includes(msg.id);
                
                return (
                  <div 
                    key={msg.id} 
                    onClick={() => { if (isUnread && onMessageRead) onMessageRead(msg.id); }}
                    className={`${isUnread ? 'bg-white border-teal-300 shadow-md ring-1 ring-teal-100' : 'bg-teal-50/40 border-teal-100/50 hover:bg-white hover:shadow-sm'} rounded-2xl p-5 border transition-all group relative cursor-pointer`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 border ${isUnread ? 'bg-teal-100 border-teal-200' : 'bg-teal-50 border-teal-100'}`}>
                          {avatar ? (
                            <img src={avatar} alt="Avatar" className={`w-full h-full object-cover ${!isUnread && 'opacity-80'}`} />
                          ) : (
                            <UserIcon size={20} className={isUnread ? "text-teal-700" : "text-teal-600/50"} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-teal-600/70 uppercase tracking-wider">
                              {activeTab === 'inbox' ? 'From:' : 'To:'}
                            </span>
                            <p className={`font-bold ${isUnread ? 'text-teal-950' : 'text-teal-900/70'}`}>{name}</p>
                          </div>
                          {position && (
                            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">{position}</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${isUnread ? 'text-teal-800 bg-teal-100' : 'text-teal-900/40 bg-teal-50'}`}>
                        {new Date(msg.created_at).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    
                    <div className="pl-[52px] mt-3">
                      {msg.title && (
                        <h4 className={`font-bold text-sm mb-1.5 ${isUnread ? 'text-teal-950' : 'text-teal-900/80'}`}>{msg.title}</h4>
                      )}
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isUnread ? 'text-teal-900 font-medium' : 'text-teal-900/70'}`}>{msg.content}</p>
                      
                      <div className="mt-4 flex justify-end gap-2">
                        {activeTab === 'inbox' && (
                          <button
                            onClick={() => setReplyAuthority({
                              id: msg.sender,
                              username: msg.sender_name || 'Authority',
                              position: msg.sender_position || 'Local Government',
                              avatar: msg.sender_avatar
                            })}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold transition-colors border border-teal-200"
                          >
                            <Reply size={14} />
                            <span>Reply</span>
                          </button>
                        )}
                        
                        {activeTab === 'sent' && (
                          <button
                            onClick={() => handleRecall(msg.id)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 text-xs font-bold transition-colors border border-red-100 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                            <span>Recall Message</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <MessageAuthorityModal
        isOpen={Boolean(replyAuthority)}
        onClose={() => {
          setReplyAuthority(null);
          fetchMessages(); // Refresh sent messages
        }}
        authority={replyAuthority}
      />
    </div>
  );
}
