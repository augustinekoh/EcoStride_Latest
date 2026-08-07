import React, { useState, useRef, useEffect } from 'react';
import { useMailStore } from '../../stores/useMailStore';
import { Check, X, Users, Building, AlertCircle, Bell, CheckCheck } from 'lucide-react';
import { apiClient } from '../../lib/api';
import capybaraImg from '../../assets/capybara.jpg';

export const CapybaraRequests: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { mails = [], readMails = [], unreadRequestsCount, markAsReadLocally, markBatchAsReadLocally, removeMailLocally } = useMailStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const socialTitles = [
    'Friend Request', 'Friend Request Accepted', 'Friend Request Rejected', 'Friend Request Sent', 'Friend Removed',
    'New Join Request', 'Join Request Approved', 'Join Request Rejected', 'Kicked from Community', 'Promoted to Admin',
    'Community Terminated'
  ];
  const requestMails = (mails || []).filter(m => 
    m.category ? m.category === 'social' : (m.action_type === 'guild_join_request' || m.action_type === 'friend_request' || socialTitles.includes(m.title))
  );

  const unreadIds = requestMails.filter(m => !(readMails || []).includes(m.id)).map(m => m.id);

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
    setIsOpen(!isOpen);
  };

  const handleReadAll = () => {
    if (unreadIds.length > 0) {
      markBatchAsReadLocally(unreadIds);
    }
  };

  const handleAction = async (mailId: string, action: 'accept' | 'reject') => {
    try {
      setIsProcessing(true);
      await apiClient(`/mail/${mailId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
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
      {/* Capybara Button */}
      <button 
        onClick={handleToggle}
        className="w-11 h-11 rounded-full bg-white border-2 border-slate-200 shadow-sm flex items-center justify-center relative hover:scale-105 active:scale-95 transition-all overflow-hidden hover:border-[var(--color-teal-dark)] hover:shadow-md"
      >
        <img src={capybaraImg} alt="Requests" className="w-full h-full object-cover" />
      </button>
      {unreadRequestsCount > 0 && (
        <div className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-rose-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
          <span className="text-[10px] font-black text-white leading-none">{unreadRequestsCount > 99 ? '99+' : unreadRequestsCount}</span>
        </div>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-14 right-0 w-[340px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-slate-200/80 z-50 animate-in fade-in slide-in-from-top-3 duration-200 overflow-hidden">
          
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-[var(--color-teal-dark)] to-[#3d8a96] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/40 shadow-sm">
                <img src={capybaraImg} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-black text-white text-sm tracking-wide">Notifications</h3>
                <p className="text-[11px] text-white/70 font-medium">
                  {requestMails.length === 0 ? 'No notifications' : `${requestMails.length} notification${requestMails.length !== 1 ? 's' : ''}`}
                  {unreadIds.length > 0 && ` · ${unreadIds.length} new`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {unreadIds.length > 0 && (
                <button 
                  onClick={handleReadAll}
                  className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors text-white"
                  title="Mark all as read"
                >
                  <CheckCheck size={16} />
                </button>
              )}
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
            {requestMails.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Bell size={24} className="text-slate-300" />
                </div>
                <p className="font-bold text-slate-500 text-sm">All caught up!</p>
                <p className="text-xs text-slate-400 mt-1">No pending notifications</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {requestMails.map(mail => {
                  const isPending = mail.action_type === 'guild_join_request' || mail.action_type === 'friend_request';
                  const isGuildEvent = mail.action_type === 'guild_join_request' || mail.title.includes('Community') || mail.title.includes('Join') || mail.title.includes('Admin');
                  const isUnread = !(readMails || []).includes(mail.id);
                  
                  return (
                    <div 
                      key={mail.id} 
                      className={`rounded-xl p-3 transition-all cursor-pointer ${isUnread ? 'bg-blue-50/80 hover:bg-blue-50' : 'hover:bg-slate-50'}`}
                      onClick={() => {
                        if (isUnread) markAsReadLocally(mail.id);
                      }}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-0.5 shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                          isGuildEvent 
                            ? 'bg-purple-100 text-purple-600' 
                            : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {isGuildEvent ? <Building size={18} /> : <Users size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-[13px] leading-tight ${isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                              {mail.title}
                            </h4>
                            {isUnread && (
                              <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-[12px] text-slate-500 font-medium leading-snug mt-0.5 line-clamp-2">{mail.content}</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">
                            {new Date(mail.createdAt || mail.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      {isPending ? (
                        <div className="flex gap-2 mt-2.5 ml-12">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleAction(mail.id, 'accept'); }}
                            disabled={isProcessing}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                          >
                            <Check size={14} /> Accept
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleAction(mail.id, 'reject'); }}
                            disabled={isProcessing}
                            className="flex-1 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-rose-200 disabled:opacity-50"
                          >
                            <X size={14} /> Decline
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-2.5 ml-12">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDismiss(mail.id); }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <X size={12} /> Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
