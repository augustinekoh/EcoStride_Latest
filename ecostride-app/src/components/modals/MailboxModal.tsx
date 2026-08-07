import React, { useState } from 'react';
import { X, Mail, MailOpen, AlertCircle, Trash2, CheckCircle2, Settings2, CheckCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMailStore } from '../../stores/useMailStore';
import { apiClient } from '../../lib/api';

interface MailboxModalProps {
  onClose: () => void;
}

export const MailboxModal: React.FC<MailboxModalProps> = ({ onClose }) => {
  const { user } = useAuthStore();
  const { mails = [], readMails = [], markAsReadLocally, markBatchAsReadLocally, removeMailLocally, removeMailsLocally } = useMailStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const socialTitles = [
    'Friend Request', 'Friend Request Accepted', 'Friend Request Rejected', 'Friend Request Sent', 'Friend Removed',
    'New Join Request', 'Join Request Approved', 'Join Request Rejected', 'Kicked from Community', 'Promoted to Admin',
    'Community Terminated'
  ];
  const systemMails = (mails || []).filter(m => 
    m.category ? m.category === 'mail' : (m.action_type !== 'guild_join_request' && m.action_type !== 'friend_request' && !socialTitles.includes(m.title))
  );

  const unreadSystemMails = systemMails.filter(m => !(readMails || []).includes(m.id));

  const toggleSelect = (e: React.MouseEvent, mailId: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(mailId)) next.delete(mailId);
      else next.add(mailId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === systemMails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(systemMails.map(m => m.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (!user || selectedIds.size === 0) return;
    try {
      setIsDeleting(true);
      const ids = Array.from(selectedIds);
      await apiClient('/mail/user/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids })
      });
      removeMailsLocally(ids);
      setSelectedIds(new Set());
      setExpandedId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReadAll = () => {
    const unreadIds = unreadSystemMails.map(m => m.id);
    if (unreadIds.length > 0) {
      markBatchAsReadLocally(unreadIds);
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
    if (isManageMode) return;
    if (expandedId === mailId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(mailId);
    if (!readMails.includes(mailId)) {
      markAsReadLocally(mailId);
    }
  };

  const exitManageMode = () => {
    setIsManageMode(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[#faf9f6] h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl border-t-2 sm:border-2 border-slate-900 shadow-comic flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-[#faf9f6] z-10 border-b-2 border-slate-900 px-6 py-4 rounded-t-3xl">
          <div className="flex justify-between items-center">
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

          {/* Action buttons row */}
          {systemMails.length > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
              {!isManageMode ? (
                <>
                  <button
                    onClick={() => setIsManageMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 transition-colors"
                  >
                    <Settings2 size={14} /> Manage
                  </button>
                  {unreadSystemMails.length > 0 && (
                    <button
                      onClick={handleReadAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition-colors"
                    >
                      <CheckCheck size={14} /> Read All
                    </button>
                  )}
                  <span className="ml-auto text-xs font-bold text-slate-400">
                    {systemMails.length} message{systemMails.length !== 1 ? 's' : ''}{unreadSystemMails.length > 0 ? ` · ${unreadSystemMails.length} unread` : ''}
                  </span>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 transition-colors"
                  >
                    <CheckCircle2 size={14} /> {selectedIds.size === systemMails.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={isDeleting || selectedIds.size === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs rounded-lg border border-rose-300 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={14} /> Delete ({selectedIds.size})
                  </button>
                  <button
                    onClick={exitManageMode}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg border border-slate-300 transition-colors"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          )}
        </div>

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
                const isSelected = selectedIds.has(mail.id);
                
                return (
                  <div 
                    key={mail.id} 
                    className={`bg-white/80 backdrop-blur-md rounded-2xl border-2 overflow-hidden transition-all cursor-pointer hover:shadow-[4px_4px_0px_#0f172a] hover:-translate-y-1 relative ${isSelected ? 'border-rose-400 bg-rose-50/80' : 'border-slate-900'}`}
                    onClick={() => isManageMode ? toggleSelect({stopPropagation: () => {}} as any, mail.id) : handleExpand(mail.id)}
                  >
                    {isUnread && !isManageMode && (
                      <div className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 shadow-[1px_1px_0px_#0f172a] animate-pulse" />
                    )}
                    <div className="p-4 flex items-center gap-4 pr-10">
                      {isManageMode && (
                        <div 
                          onClick={(e) => toggleSelect(e, mail.id)}
                          className={`w-6 h-6 rounded-lg border-2 border-slate-900 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-rose-500 text-white' : 'bg-white'}`}
                        >
                          {isSelected && <CheckCircle2 size={14} />}
                        </div>
                      )}
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
                    
                    {isExpanded && !isManageMode && (
                      <div className="p-4 bg-white/50 backdrop-blur-sm border-t-2 border-slate-900 text-slate-800 text-sm font-bold whitespace-pre-wrap leading-relaxed animate-in slide-in-from-top-2 fade-in duration-200">
                        {mail.content}
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
