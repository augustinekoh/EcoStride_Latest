import React, { useState, useRef, useEffect } from 'react';
import { useMailStore } from '../../stores/useMailStore';
import { Check, X, Users, Building, AlertCircle } from 'lucide-react';
import { apiClient } from '../../lib/api';
import capybaraImg from '../../assets/capybara.jpg';

export const CapybaraRequests: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { mails = [], readMails = [], unreadRequestsCount, markAsReadLocally, removeMailLocally } = useMailStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
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

  const requestMails = (mails || []).filter(m => 
    m.action_type === 'guild_join_request' || 
    m.action_type === 'friend_request' ||
    socialTitles.includes(m.title)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      // Mark all as read when opened
      const unreadIds = requestMails.filter(m => !(readMails || []).includes(m.id)).map(m => m.id);
      if (unreadIds.length > 0) {
        useMailStore.getState().markBatchAsReadLocally(unreadIds);
      }
    }
    setIsOpen(!isOpen);
  };

  const handleAction = async (mailId: string, action: 'accept' | 'reject') => {
    try {
      await apiClient(`/mail/${mailId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      window.location.reload(); // Reload to refresh data (could also be optimized to just refetch)
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismiss = async (mailId: string) => {
    try {
      await apiClient(`/mail/user/${mailId}`, {
        method: 'DELETE'
      });
      removeMailLocally(mailId);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleToggle}
        className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center relative hover:scale-105 active:scale-95 transition-transform overflow-hidden"
      >
        <img src={capybaraImg} alt="Requests" className="w-full h-full object-cover" />
      </button>
      {unreadRequestsCount > 0 && (
        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm animate-bounce" />
      )}

      {isOpen && (
        <div className="absolute top-12 right-0 w-80 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4 border-b border-black/5 pb-2">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              Pending Requests
              <span className="bg-[var(--color-teal-dark)] text-white text-xs px-2 py-0.5 rounded-full">{requestMails.length}</span>
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-3 custom-scrollbar pr-1">
            {requestMails.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p className="font-bold text-sm">No pending requests</p>
              </div>
            ) : (
              requestMails.map(mail => {
                const isPending = mail.action_type === 'guild_join_request' || mail.action_type === 'friend_request';
                const isGuildEvent = mail.action_type === 'guild_join_request' || mail.title.includes('Community') || mail.title.includes('Join') || mail.title.includes('Admin');
                
                return (
                <div key={mail.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100 shadow-sm">
                  <div className="flex gap-3 mb-2">
                    <div className="mt-1 shrink-0 text-[var(--color-teal-dark)]">
                      {isGuildEvent ? <Building size={18} /> : <Users size={18} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{mail.title}</h4>
                      <p className="text-xs text-slate-600 font-medium leading-snug mt-0.5">{mail.content}</p>
                    </div>
                  </div>
                  {!isPending ? (
                    <div className="flex gap-2 mt-3">
                      <button 
                        onClick={() => handleDismiss(mail.id)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 border border-slate-200"
                      >
                        <X size={14} /> Dismiss
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <button 
                        onClick={() => handleAction(mail.id, 'accept')}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Check size={14} /> Accept
                      </button>
                      <button 
                        onClick={() => handleAction(mail.id, 'reject')}
                        className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 border border-rose-200"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )})
            )}
          </div>
        </div>
      )}
    </div>
  );
};
