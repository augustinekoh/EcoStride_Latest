import React, { useState } from 'react';
import { Mail, RefreshCw, LogOut } from 'lucide-react';
import { auth } from '../../firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { apiClient } from '../../lib/api';

export const VerificationPending: React.FC = () => {
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');

  const handleResend = async () => {
    if (!auth.currentUser) return;
    setResendStatus('loading');
    try {
      await sendEmailVerification(auth.currentUser);
      setResendStatus('sent');
      setTimeout(() => setResendStatus('idle'), 5000);
    } catch (e) {
      console.error(e);
      setResendStatus('error');
    }
  };

  const handleRefresh = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        try {
          await apiClient(`/users/${auth.currentUser.uid}/verify`, { method: 'POST' });
        } catch (e) {
          console.error("Failed to mark user as verified in backend");
        }
        window.location.reload();
      } else {
        alert("Email is still not verified. Please check your inbox.");
      }
    }
  };

  const handleCancelRegistration = async () => {
    if (!auth.currentUser) return;
    if (confirm("Are you sure you want to cancel your registration? Your chosen username will be freed and you will need to register again.")) {
      try {
        const uid = auth.currentUser.uid;
        // 1. Delete from D1 Database
        await apiClient(`/users/${uid}`, { method: 'DELETE' });
        // 2. Delete from Firebase Auth
        await auth.currentUser.delete();
        window.location.reload();
      } catch (e: any) {
        alert("Failed to cancel registration. Please try again later.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-bg-light)]">
      <div className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none" style={{ backgroundImage: "url('/img/map-pattern.svg')" }}></div>
      
      <div className="glass-card max-w-md w-full p-8 rounded-3xl relative z-10 flex flex-col items-center text-center shadow-xl">
        <div className="w-20 h-20 bg-[var(--color-teal-light)] rounded-full flex items-center justify-center mb-6 shadow-md border-4 border-white">
          <Mail size={40} className="text-[var(--color-teal-dark)]" />
        </div>
        
        <h2 className="text-3xl font-black text-[var(--color-text-main)] mb-2">Verify Your Email</h2>
        <p className="text-[var(--color-text-muted)] font-medium mb-8">
          We've sent a verification link to <br/>
          <span className="font-bold text-[var(--color-text-main)]">{auth.currentUser?.email}</span>
        </p>

        <div className="w-full space-y-4">
          <button 
            onClick={handleRefresh}
            className="w-full bg-[var(--color-teal-dark)] text-white font-black py-4 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all active:translate-y-0 flex items-center justify-center gap-2"
          >
            <RefreshCw size={20} />
            I've Verified, Let me in!
          </button>
          
          <button 
            onClick={handleResend}
            disabled={resendStatus === 'loading' || resendStatus === 'sent'}
            className="w-full bg-white text-[var(--color-text-main)] font-black py-4 rounded-2xl shadow-sm border-2 border-transparent hover:border-[var(--color-teal-light)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {resendStatus === 'loading' ? 'Sending...' : 
             resendStatus === 'sent' ? 'Verification Email Sent!' : 'Resend Email'}
          </button>

          <button 
            onClick={handleCancelRegistration}
            className="w-full text-red-500 font-bold py-3 mt-4 flex items-center justify-center gap-2 opacity-80 hover:opacity-100 transition-opacity"
          >
            <LogOut size={16} />
            Cancel Registration & Free Username
          </button>
        </div>
      </div>
    </div>
  );
};
