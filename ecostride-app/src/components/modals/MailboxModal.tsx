import React, { useState } from 'react';
import { X, Mail, MailOpen, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMailStore } from '../../stores/useMailStore';

interface MailboxModalProps {
  onClose: () => void;
}

export const MailboxModal: React.FC<MailboxModalProps> = ({ onClose }) => {
  const { user } = useAuthStore();
  const { mails, readMails, markAsReadLocally } = useMailStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
              <p className="text-sm font-bold text-slate-500">System Messages & Announcements</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white rounded-full border-2 border-slate-900 shadow-comic-hover hover:bg-slate-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-dots">
          {mails.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center">
              <MailOpen size={48} className="text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-900">Your mailbox is empty</h3>
              <p className="text-slate-500 font-bold">No new messages at the moment.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {mails.map(mail => {
                const isExpanded = expandedId === mail.id;
                const isSystem = mail.sender?.toLowerCase() === 'system';
                const isUnread = !readMails.includes(mail.id);
                
                return (
                  <div 
                    key={mail.id} 
                    className="bg-white rounded-2xl border-2 border-slate-900 overflow-hidden shadow-sm transition-all cursor-pointer hover:shadow-comic relative"
                    onClick={() => handleExpand(mail.id)}
                  >
                    {isUnread && (
                      <div className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 shadow-sm animate-pulse" />
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
                      <div className="p-4 bg-slate-50 border-t-2 border-slate-100 text-slate-700 text-sm font-medium whitespace-pre-wrap leading-relaxed animate-in slide-in-from-top-2 fade-in duration-200">
                        {mail.content}
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
