import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MailState {
  mails: any[];
  readMails: string[];
  unreadCount: number;
  setMailsData: (mails: any[], readMails?: string[]) => void;
  markAsReadLocally: (mailId: string) => void;
}

export const useMailStore = create<MailState>()(
  persist(
    (set) => ({
      mails: [],
      readMails: [],
      unreadCount: 0,
      setMailsData: (mails, readMails) => set((state) => {
        const currentReadMails = readMails || state.readMails || [];
        const unreadCount = mails.filter(m => !currentReadMails.includes(m.id)).length;
        return { mails, readMails: currentReadMails, unreadCount };
      }),
      markAsReadLocally: (mailId) => set((state) => {
        if (state.readMails.includes(mailId)) return state;
        const newReadMails = [...state.readMails, mailId];
        const unreadCount = state.mails.filter(m => !newReadMails.includes(m.id)).length;
        return { readMails: newReadMails, unreadCount };
      })
    }),
    {
      name: 'mail-storage',
      partialize: (state) => ({ readMails: state.readMails }), // only persist readMails
    }
  )
);
