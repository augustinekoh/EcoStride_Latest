import React, { useState } from 'react';
import { X, Mail, MailOpen, AlertCircle, Trash2 } from 'lucide-react';
import { auth } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMailStore } from '../../stores/useMailStore';
import { apiClient } from '../../lib/api';

interface MailboxModalProps {
  onClose: () => void;
}

export const MailboxModal: React.FC<MailboxModalProps> = ({ onClose }) => {
  const { mails = [], readMails = [], markAsReadLocally, removeMailLocally, removeMailsLocally } = useMailStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const socialTitles = [
    'Friend Request',
    'Friend Request Accepted',
    'Friend Request Rejected',
    'New Join Request',
    'Join Request Approved',
    'Join Request Rejected',
    'Kicked from Community',
    'Promoted to Admin'
  ];

  const systemMails = (mails || []).filter(m => 
    m.action_type !== 'guild_join_request' && 
    m.action_type !== 'friend_request' &&
    !socialTitles.includes(m.title)
  );
  const readSystemMails = systemMails.filter(m => (readMails || []).includes(m.id));

  const handleDelete = async (e: React.MouseEvent, mailId: string) => {
    e.stopPropagation();
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient(`/mail/user/${mailId}`, { method: 'DELETE' });
      removeMailLocally(mailId);
      if (expandedId === mailId) setExpandedId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllRead = async () => {
    if (isDeleting || readSystemMails.length === 0) return;
    setIsDeleting(true);
    try {
      const ids = readSystemMails.map(m => m.id);
      await apiClient(`/mail/user/batch-delete`, {
        method: 'POST',
        body: JSON.stringify({ ids })
      });
      removeMailsLocally(ids);
      setExpandedId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExpand = async (mailId: string) => {
    if (expandedId === mailId) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(mailId);
    
    if (!(readMails || []).includes(mailId)) {
      markAsReadLocally(mailId);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Main Modal Wrapper with Vibrant Gradient and Glassmorphism */}
      <div 
        className="relative w-full max-w-2xl border border-white/50 h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300"
        style={{ background: 'linear-gradient(to top right, #b3e5fc 0%, #e1f5fe 40%, #fff9c4 70%, #ffe0b2 100%)' }}
      >
        
        {/* Header - Glassmorphic */}
        <div className="sticky top-0 bg-white/10 backdrop-blur-md z-10 border-b border-white/30 px-6 py-4 flex justify-between items-center rounded-t-[2.5rem] shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/30 backdrop-blur-lg p-2.5 rounded-xl border border-white/50 shadow-sm">
              <Mail size={24} className="text-slate-800" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase drop-shadow-sm">Mailbox</h2>
              <p className="text-sm font-bold text-slate-800 drop-shadow-sm">System Messages & Announcements</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/30 rounded-full transition-colors border border-transparent hover:border-white/50 text-slate-800 shadow-sm ml-2"
          >
            <X size={24} />
          </button>
        </div>

        {/* Action Bar (if any read messages exist) */}
        {readSystemMails.length > 0 && (
          <div className="px-6 py-3 border-b border-white/30 bg-white/20 backdrop-blur-sm flex justify-end">
            <button
              onClick={handleDeleteAllRead}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 font-bold rounded-lg border border-rose-500/30 transition-colors disabled:opacity-50"
            >
              <Trash2 size={16} />
              Delete All Read
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {(mails || []).length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center">
              <div className="bg-white/20 backdrop-blur-xl border border-white/40 p-6 rounded-3xl shadow-sm mb-4">
                <MailOpen size={48} className="text-slate-700" />
              </div>
              <h3 className="text-xl font-black text-slate-900 drop-shadow-sm">Your mailbox is empty</h3>
              <p className="text-slate-800 font-bold drop-shadow-sm mt-1">No new messages at the moment.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {systemMails.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center">
                  <p className="text-slate-800 font-bold drop-shadow-sm mt-1">No system messages at the moment.</p>
                </div>
              ) : 
                systemMails.map(mail => {
                const isExpanded = expandedId === mail.id;
                const isSystem = mail.sender?.toLowerCase() === 'system';
                const isUnread = !(readMails || []).includes(mail.id);
                
                return (
                  <div 
                    key={mail.id} 
                    className="bg-white/20 backdrop-blur-2xl rounded-2xl border border-white/40 overflow-hidden transition-all cursor-pointer hover:-translate-y-[2px] shadow-[0_4px_30px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)] relative"
                    onClick={() => handleExpand(mail.id)}
                  >
                    {isUnread && (
                      <div className="absolute top-4 right-4 w-3.5 h-3.5 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.6)] border-2 border-white/60 animate-pulse" />
                    )}
                    <div 
                      className="p-4 flex items-center gap-4 pr-10"
                    >
                      <div className={`p-3 rounded-xl border border-white/50 bg-white/40 backdrop-blur-md shadow-sm shrink-0 ${isSystem ? 'text-amber-700' : 'text-emerald-800'}`}>
                        {isSystem ? <AlertCircle size={22} /> : (isUnread ? <Mail size={22} /> : <MailOpen size={22} />)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className={`text-lg font-black truncate drop-shadow-sm ${isUnread ? 'text-slate-900' : 'text-slate-800'}`}>{mail.title}</h4>
                          <span className="text-xs font-bold text-slate-700 whitespace-nowrap bg-white/30 px-2 py-1 rounded-md border border-white/40">
                            {new Date(mail.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className={`text-sm font-bold truncate mt-0.5 drop-shadow-sm ${isUnread ? 'text-slate-800' : 'text-slate-700'}`}>From: {mail.sender || 'Admin'}</p>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="p-5 bg-white/30 backdrop-blur-md border-t border-white/40 text-slate-900 text-sm font-medium whitespace-pre-wrap leading-relaxed animate-in slide-in-from-top-2 fade-in duration-200">
                        {mail.content}
                        
                        {!isUnread && (
                          <div className="mt-4 pt-4 border-t border-white/30 flex justify-end">
                            <button
                              onClick={(e) => handleDelete(e, mail.id)}
                              disabled={isDeleting}
                              className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
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
