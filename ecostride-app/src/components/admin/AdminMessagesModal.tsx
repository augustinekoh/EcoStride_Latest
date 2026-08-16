import { useState, useEffect } from 'react';
import { X, Mail, Loader2, User as UserIcon, Reply } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { MessageAuthorityModal } from './MessageAuthorityModal';

interface AdminMessage {
  id: string;
  sender: string;
  sender_name?: string;
  sender_position?: string;
  sender_avatar?: string;
  content: string;
  created_at: number;
}

interface AdminMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMessagesRead?: (messageIds: string[]) => void;
}

export function AdminMessagesModal({ isOpen, onClose, onMessagesRead }: AdminMessagesModalProps) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
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
      const data = await apiClient('/admin/messages');
      const msgList = data.messages || [];
      setMessages(msgList);
      if (onMessagesRead && msgList.length > 0) {
        onMessagesRead(msgList.map((m: any) => m.id));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-teal-950/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden relative">
        <div className="flex items-center justify-between p-6 border-b border-teal-50 bg-white z-10">
          <div className="flex items-center gap-3 text-teal-950">
            <div className="p-2 bg-teal-50 rounded-xl">
              <Mail size={24} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Authority Messages</h2>
              <p className="text-sm text-teal-600/70 font-medium">Direct reports from authorities</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-teal-900/40 hover:bg-teal-50 hover:text-teal-600 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-teal-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-teal-600/60">
              <Loader2 size={32} className="animate-spin mb-4" />
              <p className="font-medium">Loading messages...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-center border border-red-100">
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-teal-900/40">
              <Mail size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-bold">No messages yet.</p>
              <p className="text-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="bg-white rounded-2xl p-5 shadow-sm border border-teal-100/50 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {msg.sender_avatar ? (
                          <img src={msg.sender_avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon size={20} className="text-teal-600/50" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-teal-950">{msg.sender_name || 'Unknown Authority'}</p>
                        {msg.sender_position && (
                          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">{msg.sender_position}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-teal-900/40 bg-teal-50 px-2 py-1 rounded-lg whitespace-nowrap">
                      {new Date(msg.created_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="pl-13 mt-2">
                    <p className="text-teal-900/80 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => setReplyAuthority({
                          id: msg.sender,
                          username: msg.sender_name || 'Authority',
                          position: msg.sender_position || 'Local Government',
                          avatar: msg.sender_avatar
                        })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold transition-colors border border-teal-200"
                      >
                        <Reply size={14} />
                        <span>Reply</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MessageAuthorityModal
        isOpen={Boolean(replyAuthority)}
        onClose={() => setReplyAuthority(null)}
        authority={replyAuthority}
      />
    </div>
  );
}
