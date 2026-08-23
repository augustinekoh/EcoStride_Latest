import React from 'react';
import { TreePine, TreeDeciduous, Coffee, Apple, Building2, Home } from 'lucide-react';

export const FloatingIcons: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Top Left Area */}
      <div className="absolute top-[6%] left-[6%] sm:top-[8%] sm:left-[10%] animate-bounce shadow-xl bg-white/30 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-white/50 dark:border-white/10 p-3 sm:p-4 -rotate-12" style={{ animationDuration: '1.5s' }}>
        <TreePine className="text-emerald-600 dark:text-emerald-400 w-9 h-9 sm:w-12 sm:h-12" />
      </div>

      {/* Top Right Area */}
      <div className="absolute top-[6%] right-[6%] sm:top-[12%] sm:right-[15%] animate-bounce shadow-xl bg-emerald-200/30 dark:bg-emerald-900/30 backdrop-blur-md rounded-full border border-white/50 dark:border-white/10 p-3 sm:p-5 rotate-45" style={{ animationDuration: '1.5s', animationDelay: '0.2s' }}>
        <Apple className="text-red-500 dark:text-red-400 w-7 h-7 sm:w-10 sm:h-10" />
      </div>

      {/* Bottom Left Area */}
      <div className="absolute bottom-[6%] left-[6%] sm:bottom-[18%] sm:left-[12%] animate-pulse shadow-xl bg-blue-200/30 dark:bg-blue-900/30 backdrop-blur-md rounded-2xl border border-white/50 dark:border-white/10 p-3 sm:p-5 -rotate-6" style={{ animationDuration: '1.5s', animationDelay: '0.4s' }}>
        <Building2 className="text-blue-600 dark:text-blue-400 w-8 h-8 sm:w-10 sm:h-10" />
      </div>

      {/* Bottom Right Area */}
      <div className="absolute bottom-[6%] right-[6%] sm:bottom-[10%] sm:right-[12%] animate-bounce shadow-2xl bg-white/30 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/60 dark:border-white/10 p-4 sm:p-6 rotate-12" style={{ animationDuration: '1.5s', animationDelay: '0.6s' }}>
        <TreeDeciduous className="text-emerald-500 dark:text-emerald-400 w-11 h-11 sm:w-16 sm:h-16" />
      </div>

      {/* Middle Top / Side */}
      <div className="absolute hidden sm:block top-[5%] left-[45%] sm:top-[30%] sm:left-[3%] animate-pulse shadow-lg bg-white/20 dark:bg-white/5 backdrop-blur-md rounded-full border border-white/40 dark:border-white/10 p-2 sm:p-3 rotate-12" style={{ animationDuration: '1.5s', animationDelay: '0.8s' }}>
        <Coffee className="text-amber-700 dark:text-amber-500 w-4 h-4 sm:w-7 sm:h-7" />
      </div>

      {/* Middle Bottom / Side */}
      <div className="absolute hidden sm:block bottom-[5%] right-[45%] sm:bottom-[40%] sm:right-[5%] animate-pulse shadow-md bg-white/20 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-white/30 dark:border-white/10 p-2 sm:p-3 -rotate-12" style={{ animationDuration: '1.5s', animationDelay: '1s' }}>
        <Home className="text-slate-600 dark:text-slate-300 w-4 h-4 sm:w-6 sm:h-6" />
      </div>
    </div>
  );
};
