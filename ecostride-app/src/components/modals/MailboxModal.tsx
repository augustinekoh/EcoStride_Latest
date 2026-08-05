import React, { useState } from 'react';
import { X, Mail, MailOpen, AlertCircle, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMailStore } from '../../stores/useMailStore';
import { apiClient } from '../../lib/api';

interface MailboxModalProps {
  onClose: () => void;
}

export const MailboxModal: React.FC<MailboxModalProps> = ({ onClose }) => {
  const { user } = useAuthStore();
  const { mails = [], readMails = [], markAsReadLocally, removeMailLocally, removeMailsLocally } = useMailStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const socialTitles = [
    'Friend Request', 'Friend Request Accepted', 'Friend Request Rejected', 'Friend Request Sent', 'Friend Removed',
    'New Join Request', 'Join Request Approved', 'Join Request Rejected', 'Kicked from Community', 'Promoted to Admin'
  ];
  const systemMails = (mails || []).filter(m => 
    m.category ? m.category === 'mail' : (m.action_type !== 'guild_join_request' && m.action_type !== 'friend_request' && !socialTitles.includes(m.title))
  );

  const readSystemMails = systemMails.filter(m => (readMails || []).includes(m.id));

  const handleDeleteAllRead = async () => {
    if (!user || readSystemMails.length === 0) return;
    try {
      setIsDeleting(true);
      const idsToDelete = readSystemMails.map(m => m.id);
      await apiClient('/mail/user/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: idsToDelete })
      });
      removeMailsLocally(idsToDelete);
      setExpandedId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, mailId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      setIsDeleting(true);
      await apiClient(`/mail/user/${mailId}`, { method: 'DELETE' });
      removeMailLocally(mailId);
      if (expandedId === mailId) setExpandedId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExpand = async (mailId: string) => {
    // Toggle expand
    if (expandedId === mailId) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(mailId);
    
    // Mark as read if not already read
    if (!readMails.includes(mailId)) {
      markAsReadLocally(mailId);
      // Backend sync omitted for now, stored locally.
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[#faf9f6] h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl border-t-2 sm:border-2 border-slate-900 shadow-comic flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-[#faf9f6] z-10 border-b-2 border-slate-900 px-6 py-4 rounded-t-3xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[var(--color-teal-dark)] p-2 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
              <Mail size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Mailbox</h2>
              <p className="text-sm font-bold text-slate-700">System Messages & Announcements</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white/80 rounded-full border-2 border-slate-900 shadow-comic-hover hover:bg-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Action Bar */}
        {readSystemMails.length > 0 && (
          <div className="px-6 py-3 border-b-2 border-slate-900 bg-white/40 backdrop-blur-sm flex justify-end">
            <button
              onClick={handleDeleteAllRead}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-black rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] transition-all active:translate-y-1 active:shadow-none disabled:opacity-50"
            >
              <Trash2 size={16} />
              Delete All Read
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-dots">
          {systemMails.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center">
              <MailOpen size={48} className="text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-900">Your mailbox is empty</h3>
              <p className="text-slate-500 font-bold">No new messages at the moment.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {systemMails.map(mail => {
                const isExpanded = expandedId === mail.id;
                const isSystem = mail.sender?.toLowerCase() === 'system';
                const isUnread = !(readMails || []).includes(mail.id);
                
                return (
                  <div 
                    key={mail.id} 
                    className="bg-white/80 backdrop-blur-md rounded-2xl border-2 border-slate-900 overflow-hidden transition-all cursor-pointer hover:shadow-[4px_4px_0px_#0f172a] hover:-translate-y-1 relative"
                    onClick={() => handleExpand(mail.id)}
                  >
                    {isUnread && (
                      <div className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 shadow-[1px_1px_0px_#0f172a] animate-pulse" />
                    )}
                    <div 
                      className="p-4 flex items-center gap-4 pr-10"
                    >
                      <div className={`p-3 rounded-full border-2 border-slate-900 shrink-0 ${isSystem ? 'bg-brand-orange text-white' : 'bg-brand-yellow text-slate-900'}`}>
                        {isSystem ? <AlertCircle size={20} /> : (isUnread ? <Mail size={20} /> : <MailOpen size={20} />)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className={`font-black truncate ${isUnread ? 'text-slate-900' : 'text-slate-600'}`}>{mail.title}</h4>
                          <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                            {new Date(mail.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className={`text-sm font-bold truncate ${isUnread ? 'text-slate-600' : 'text-slate-400'}`}>From: {mail.sender || 'Admin'}</p>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="p-4 bg-white/50 backdrop-blur-sm border-t-2 border-slate-900 text-slate-800 text-sm font-bold whitespace-pre-wrap leading-relaxed animate-in slide-in-from-top-2 fade-in duration-200">
                        {mail.content}
                        {!isUnread && (
                          <div className="mt-4 pt-4 border-t-2 border-slate-900 border-dashed flex justify-end">
                            <button
                              onClick={(e) => handleDelete(e, mail.id)}
                              disabled={isDeleting}
                              className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] transition-all active:translate-y-1 active:shadow-none disabled:opacity-50"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
