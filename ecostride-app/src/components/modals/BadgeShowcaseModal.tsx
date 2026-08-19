import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../stores/useAuthStore';

interface BadgeShowcaseModalProps {
  onClose: () => void;
}

export const BadgeShowcaseModal: React.FC<BadgeShowcaseModalProps> = ({ onClose }) => {
  const { user } = useAuthStore();
  const { unlockedBadges, showcasedBadges, setUserData } = useUserStore();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  let parsedUnlocked: any[] = [];
  if (typeof unlockedBadges === 'string') {
    try { parsedUnlocked = JSON.parse(unlockedBadges); } catch(e) {}
  } else if (Array.isArray(unlockedBadges)) {
    parsedUnlocked = unlockedBadges;
  }

  let parsedShowcased: string[] = [];
  if (typeof showcasedBadges === 'string') {
    try { parsedShowcased = JSON.parse(showcasedBadges); } catch(e) {}
  } else if (Array.isArray(showcasedBadges)) {
    parsedShowcased = showcasedBadges;
  }

  useEffect(() => {
    setSelectedIds(parsedShowcased);
  }, []);

  const toggleBadge = (id: string) => {
    setErrorMsg('');
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(badgeId => badgeId !== id));
    } else {
      if (selectedIds.length >= 4) {
        setErrorMsg('You can only showcase up to 4 achievements.');
        return;
      }
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      setIsSaving(true);
      await apiClient(`/users/${user.uid}`, {
        method: 'POST',
        body: JSON.stringify({ showcasedBadges: selectedIds })
      });
      setUserData({ showcasedBadges: selectedIds as any });
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save showcase. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div 
        className="rounded-3xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative border border-white/20 shadow-2xl bg-slate-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white p-4 flex justify-between items-center border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-black text-slate-800">Edit Showcase</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm font-bold text-slate-500">Select up to 4 achievements</p>
            <span className="text-xs font-black px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
              {selectedIds.length} / 4
            </span>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            {parsedUnlocked.length > 0 ? (
              parsedUnlocked.map((badge: any, idx: number) => {
                const isSelected = selectedIds.includes(badge.id);
                return (
                  <div 
                    key={idx} 
                    onClick={() => toggleBadge(badge.id)}
                    className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all cursor-pointer relative shadow-sm hover:-translate-y-1 ${isSelected ? 'border-[var(--color-teal-dark)] bg-white' : 'border-slate-200 bg-white opacity-80 hover:opacity-100'}`}
                  >
                    <div className="w-full h-full rounded-[14px] overflow-hidden flex items-center justify-center">
                      {badge.icon?.startsWith('http') ? (
                        <img src={badge.icon} alt={badge.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl drop-shadow-sm">{badge.icon}</span>
                      )}
                    </div>
                    {badge.level > 1 && (
                      <div className="absolute top-1 right-1 bg-amber-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full shadow-sm z-10">
                        Lv.{badge.level}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-[var(--color-teal-dark)] rounded-full flex items-center justify-center border-2 border-white z-10">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs font-bold text-slate-400 col-span-4 text-center py-6">No achievements unlocked yet.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-[var(--color-teal-dark)] hover:bg-[#15272a] text-white font-black rounded-xl transition-colors shadow-sm flex items-center justify-center disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Save Showcase'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
