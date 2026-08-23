import React, { useState, useEffect } from 'react';
import { Mail, X, CheckCheck, Trash2, MailOpen, AlertCircle, Settings2, CheckCircle2 } from 'lucide-react';
import { useMailStore } from '../../stores/useMailStore';
import { apiClient } from '../../lib/api';

interface Props {
  isOpen?: boolean;
  onClose: () => void;
  initialMailId?: string;
}

export const MailboxModal: React.FC<Props> = ({ isOpen = true, onClose, initialMailId }) => {
  const { mails, readMails, markAsReadLocally, markBatchAsReadLocally, removeMailLocally, removeMailsLocally } = useMailStore();
  const [expandedId, setExpandedId] = useState<string | null>(initialMailId || null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setIsManageMode(false);
      setSelectedIds(new Set());
      setExpandedId(initialMailId || null);
      if (initialMailId && !(readMails || []).includes(initialMailId)) {
        markAsReadLocally(initialMailId);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const systemMails = (mails || []).filter(m => m.category !== 'social');
  const unreadSystemMails = systemMails.filter(m => !(readMails || []).includes(m.id));

  const handleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    if (!(readMails || []).includes(id)) {
      markAsReadLocally(id);
    }
  };

  const handleReadAll = () => {
    const unreadIds = unreadSystemMails.map(m => m.id);
    if (unreadIds.length > 0) {
      markBatchAsReadLocally(unreadIds);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await apiClient(`/mail/user/${id}`, { method: 'DELETE' }).catch(() => apiClient(`/mail/${id}`, { method: 'DELETE' }));
      removeMailLocally(id);
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error("Failed to delete", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === systemMails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(systemMails.map(m => m.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      await Promise.all(idsArray.map(id => apiClient(`/mail/user/${id}`, { method: 'DELETE' }).catch(() => apiClient(`/mail/${id}`, { method: 'DELETE' }))));
      removeMailsLocally(idsArray);
      setSelectedIds(new Set());
      setIsManageMode(false);
    } catch (err) {
      console.error("Failed to delete selected", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const exitManageMode = () => {
    setIsManageMode(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-emerald-50/85 dark:bg-slate-900/85 backdrop-blur-3xl h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-emerald-50/60 dark:bg-slate-900/60 backdrop-blur-2xl z-10 border-b border-emerald-100/50 dark:border-slate-700/50 px-6 py-5 rounded-t-[2.5rem]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2.5 rounded-2xl border border-emerald-500/30 backdrop-blur-md">
                <Mail size={24} className="text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Mailbox</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">System Messages & Announcements</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-full hover:bg-white/80 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300 transition-all border border-white/40 dark:border-white/10"
            >
              <X size={24} />
            </button>
          </div>

          {/* Action buttons row */}
          {systemMails.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-emerald-100/50 dark:border-slate-700/50">
              {!isManageMode ? (
                <>
                  <button
                    onClick={() => setIsManageMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/70 dark:bg-slate-800/70 hover:bg-white/90 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg border border-white/60 dark:border-slate-600/50 backdrop-blur-md transition-colors shadow-sm"
                  >
                    <Settings2 size={14} /> Manage
                  </button>
                  {unreadSystemMails.length > 0 && (
                    <button
                      onClick={handleReadAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 dark:text-blue-400 font-semibold text-xs rounded-lg border border-blue-500/20 backdrop-blur-md transition-colors shadow-sm"
                    >
                      <CheckCheck size={14} /> Read All
                    </button>
                  )}
                  <span className="ml-auto text-xs font-bold text-slate-500 dark:text-slate-400">
                    {systemMails.length} message{systemMails.length !== 1 ? 's' : ''}{unreadSystemMails.length > 0 ? ` • ${unreadSystemMails.length} unread` : ''}
                  </span>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/70 dark:bg-slate-800/70 hover:bg-white/90 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg border border-white/60 dark:border-slate-600/50 backdrop-blur-md transition-colors shadow-sm"
                  >
                    <CheckCircle2 size={14} /> {selectedIds.size === systemMails.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={isDeleting || selectedIds.size === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-400 font-semibold text-xs rounded-lg border border-rose-500/20 backdrop-blur-md transition-colors disabled:opacity-40 shadow-sm"
                  >
                    <Trash2 size={14} /> Delete ({selectedIds.size})
                  </button>
                  <button
                    onClick={exitManageMode}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-slate-700/70 hover:bg-white dark:hover:bg-slate-600/70 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg border border-white/80 dark:border-slate-500/50 backdrop-blur-md transition-colors shadow-sm"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {systemMails.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center">
              <MailOpen size={48} className="text-slate-400/60 dark:text-slate-500/60 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Your mailbox is empty</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">No new messages at the moment.</p>
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
                    className={`bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl rounded-[1.5rem] border hover:bg-white/95 dark:hover:bg-slate-800/80 transition-all cursor-pointer relative shadow-sm hover:shadow-md ${isSelected ? 'border-rose-400/60 bg-rose-500/10' : 'border-white/80 dark:border-slate-700/60'}`}
                    onClick={() => isManageMode ? toggleSelect({stopPropagation: () => {}} as any, mail.id) : handleExpand(mail.id)}
                  >
                    {isUnread && !isManageMode && (
                      <div className="absolute top-5 right-5 w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
                    )}
                    <div className="p-4 flex items-center gap-4 pr-10">
                      {isManageMode && (
                        <div 
                          onClick={(e) => toggleSelect(e, mail.id)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white/80 dark:bg-slate-700/80 border-slate-300 dark:border-slate-600'}`}
                        >
                          {isSelected && <CheckCircle2 size={14} />}
                        </div>
                      )}
                      <div className={`p-3.5 rounded-full shrink-0 shadow-inner ${isSystem ? 'bg-orange-500/20 text-orange-700 dark:text-orange-400' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
                        {isSystem ? <AlertCircle size={20} /> : (isUnread ? <Mail size={20} /> : <MailOpen size={20} />)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className={`font-bold truncate ${isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{mail.title}</h4>
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                            {new Date(mail.createdAt || mail.created_at || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                        <p className={`text-sm font-medium truncate mt-0.5 ${isUnread ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>From: {mail.sender || 'Admin'}</p>
                      </div>
                    </div>
                    
                    {isExpanded && !isManageMode && (
                      <div className="p-5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm border-t border-white/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-sm font-medium whitespace-pre-wrap leading-relaxed animate-in slide-in-from-top-2 fade-in duration-200">
                        {mail.content}
                        <div className="mt-4 pt-4 border-t border-white/60 dark:border-slate-700/60 border-dashed flex justify-end">
                          <button
                            onClick={(e) => handleDelete(e, mail.id)}
                            disabled={isDeleting}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-500/90 hover:bg-rose-500 text-white font-semibold rounded-xl border border-rose-400/50 shadow-md backdrop-blur-md transition-all active:scale-95 disabled:opacity-50"
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
