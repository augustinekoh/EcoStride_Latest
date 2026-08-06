import React from 'react';
import { X, Award } from 'lucide-react';

interface BadgeInfoModalProps {
  badge: any;
  onClose: () => void;
}

const BADGE_DESCRIPTIONS: Record<string, string> = {
  first_seed: 'Awarded for planting your very first tree. Welcome to the forest!',
  nature_lover: 'Awarded for planting 5 trees. You are making a real difference!',
  forest_guardian: 'Awarded for every 10 trees you plant. The forest thanks you!',
  eco_legend: 'Awarded for every 50 trees you plant. An absolute legend of nature!',
  first_step: 'Awarded for walking your first kilometer with EcoStride.',
  runner_10k: 'Awarded for every 10 kilometers walked.',
  marathoner: 'Awarded for every 42 kilometers walked. You are a marathoner!',
  community_builder: 'Awarded for joining an EcoStride community.',
  trendsetter: 'Awarded for reaching 10, 100, and 1000 likes on a single signpost.'
};

export const BadgeInfoModal: React.FC<BadgeInfoModalProps> = ({ badge, onClose }) => {
  if (!badge) return null;

  const description = BADGE_DESCRIPTIONS[badge.id] || 'An exclusive achievement earned through your eco-friendly actions!';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div 
        className="rounded-3xl w-full max-w-[320px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative border border-white/20 shadow-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Graphic */}
        <div className="h-32 bg-gradient-to-br from-amber-200 to-orange-400 relative flex items-center justify-center">
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px]"></div>
          <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center text-5xl shadow-lg relative z-10 border-4 border-white">
            {badge.icon}
          </div>
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-black/20 hover:bg-black/30 text-white rounded-full transition-colors z-20">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center flex flex-col items-center">
          <div className="flex items-center gap-2 justify-center mb-1">
            <h2 className="text-xl font-black text-slate-900">{badge.name}</h2>
            {badge.level > 1 && (
              <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-sm">
                Lv.{badge.level}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Achievement Unlocked</p>
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full relative">
            <Award className="absolute -top-3 -left-3 text-amber-200/50 w-12 h-12 -rotate-12" />
            <p className="text-sm text-slate-700 font-medium leading-relaxed relative z-10">
              {description}
            </p>
          </div>
          
          <button 
            onClick={onClose}
            className="mt-6 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl transition-colors shadow-sm"
          >
            Awesome!
          </button>
        </div>
      </div>
    </div>
  );
};
