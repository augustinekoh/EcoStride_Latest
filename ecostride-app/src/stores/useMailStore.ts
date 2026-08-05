import { create } from 'zustand';
import { auth } from '../firebase';
import { apiClient } from '../lib/api';

interface MailState {
  mails: any[];
  readMails: string[];
  unreadCount: number;
  unreadRequestsCount: number;
  setMailsData: (mails: any[], readMails?: string[]) => void;
  markAsReadLocally: (mailId: string) => void;
  markBatchAsReadLocally: (mailIds: string[]) => void;
  removeMailLocally: (mailId: string) => void;
  removeMailsLocally: (mailIds: string[]) => void;
}

const socialTitles = [
  'Friend Request', 'Friend Request Accepted', 'Friend Request Rejected', 'Friend Request Sent', 'Friend Removed',
  'New Join Request', 'Join Request Approved', 'Join Request Rejected', 'Kicked from Community', 'Promoted to Admin'
];

function isSocial(m: any) {
  if (m.category) return m.category === 'social';
  return m.action_type === 'guild_join_request' || m.action_type === 'friend_request' || socialTitles.includes(m.title);
}

function computeCounts(mails: any[], readMails: string[]) {
  const systemMails = mails.filter(m => !isSocial(m));
  const requestMails = mails.filter(m => isSocial(m));
  const unreadCount = systemMails.filter(m => !readMails.includes(m.id)).length;
  const unreadRequestsCount = requestMails.filter(m => !readMails.includes(m.id)).length;
  return { unreadCount, unreadRequestsCount };
}

export const useMailStore = create<MailState>()((set) => ({
  mails: [],
  readMails: [],
  unreadCount: 0,
  unreadRequestsCount: 0,
  setMailsData: (mails, readMails) => set((state) => {
    const currentReadMails = readMails || state.readMails || [];
    const { unreadCount, unreadRequestsCount } = computeCounts(mails, currentReadMails);
    return { mails, readMails: currentReadMails, unreadCount, unreadRequestsCount };
  }),
  markAsReadLocally: (mailId) => {
    // Call the API asynchronously in the background
    if (auth.currentUser) {
      apiClient(`/mail/user/${mailId}/read`, { method: 'POST' }).catch(console.error);
    }
    
    set((state) => {
      const currentReadMails = state.readMails || [];
      if (currentReadMails.includes(mailId)) return state;
      const newReadMails = [...currentReadMails, mailId];
      if (newReadMails.length > 500) {
        newReadMails.splice(0, newReadMails.length - 500);
      }
      const { unreadCount, unreadRequestsCount } = computeCounts(state.mails || [], newReadMails);
      return { readMails: newReadMails, unreadCount, unreadRequestsCount };
    });
  },
  markBatchAsReadLocally: (mailIds) => {
    if (auth.currentUser && mailIds.length > 0) {
      apiClient('/mail/user/batch-read', { 
        method: 'POST', 
        body: JSON.stringify({ ids: mailIds })
      }).catch(console.error);
    }
    
    set((state) => {
      const currentReadMails = state.readMails || [];
      const newMails = mailIds.filter(id => !currentReadMails.includes(id));
      if (newMails.length === 0) return state;
      
      const newReadMails = [...currentReadMails, ...newMails];
      if (newReadMails.length > 500) {
        newReadMails.splice(0, newReadMails.length - 500);
      }
      const { unreadCount, unreadRequestsCount } = computeCounts(state.mails || [], newReadMails);
      return { readMails: newReadMails, unreadCount, unreadRequestsCount };
    });
  },
  removeMailLocally: (mailId) => set((state) => {
    const newMails = (state.mails || []).filter(m => m.id !== mailId);
    const currentReadMails = state.readMails || [];
    const { unreadCount, unreadRequestsCount } = computeCounts(newMails, currentReadMails);
    return { mails: newMails, unreadCount, unreadRequestsCount };
  }),
  removeMailsLocally: (mailIds) => set((state) => {
    const newMails = (state.mails || []).filter(m => !mailIds.includes(m.id));
    const currentReadMails = state.readMails || [];
    const { unreadCount, unreadRequestsCount } = computeCounts(newMails, currentReadMails);
    return { mails: newMails, unreadCount, unreadRequestsCount };
  })
}));
