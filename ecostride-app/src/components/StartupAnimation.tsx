import React, { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import { isWalkTrackingActive } from '../lib/backgroundTracking';
import { FloatingIcons } from './FloatingIcons';

export const StartupAnimation: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    let timeoutId: any;
    let fadeId: any;
    let isMounted = true;

    const check = async () => {
      try {
        const active = await isWalkTrackingActive();
        if (!isMounted) return;

        if (active) {
          setSkip(true);
          onComplete();
          return;
        }
        
        // Not active, do short animation
        fadeId = setTimeout(() => {
          if (isMounted) setIsFadingOut(true);
        }, 1200);

        timeoutId = setTimeout(() => {
          if (isMounted) onComplete();
        }, 1700);
      } catch (err) {
        // Fallback to skip if checking fails
        if (isMounted) {
          setSkip(true);
          onComplete();
        }
      }
    };
    
    check();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      clearTimeout(fadeId);
    };
  }, [onComplete]);

  if (skip) return null;

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f8faf9] dark:bg-slate-900 transition-opacity duration-500 ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      
      {/* Background Blobs for Glassmorphism */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 fixed">
        <div className="absolute top-[0%] left-[-10%] w-[70%] h-[50%] bg-emerald-400/20 dark:bg-emerald-600/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute top-[40%] right-[-10%] w-[60%] h-[60%] bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] bg-emerald-300/20 dark:bg-emerald-500/20 rounded-full blur-[90px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <FloatingIcons />

      <div className="relative z-10 flex flex-col items-center gap-3 animate-bounce shadow-black/5">
        <div className="bg-white/80 dark:bg-slate-800/80 p-4 rounded-full backdrop-blur-md shadow-sm border border-slate-200/80 dark:border-slate-700">
          <Leaf size={56} className="text-emerald-600 dark:text-emerald-400 drop-shadow-sm" />
        </div>
      </div>
      <h1 className="relative z-10 mt-6 text-4xl font-black text-slate-900 dark:text-white uppercase tracking-widest drop-shadow-sm text-center">
        EcoStride
      </h1>
      <p className="relative z-10 text-slate-500 dark:text-slate-400 font-bold mt-2 tracking-wide uppercase text-sm">Step for the Planet</p>
    </div>
  );
};
