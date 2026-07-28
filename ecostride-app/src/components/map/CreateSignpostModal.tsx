import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { apiClient } from '../../lib/api';
import { useMapStore } from '../../stores/useMapStore';
import { useUserStore } from '../../stores/useUserStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: [number, number] | null;
}

const EMOJI_LIST = ['🚴', '💪', '📸', '☕', '⚠️', '🌳', '🏆'];

export const CreateSignpostModal: React.FC<Props> = ({ isOpen, onClose, currentLocation }) => {
  const { user } = useAuthStore();
  const { username } = useUserStore();
  const { signposts, setSignposts } = useMapStore();
  const [selectedEmoji, setSelectedEmoji] = useState('🚴');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLocation) {
      alert("Cannot detect your live location to drop a signpost.");
      return;
    }
    if (!message.trim()) {
      alert("Please enter a short message.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newSignpost = {
        id: `temp-${Date.now()}`,
        lng: currentLocation[0],
        lat: currentLocation[1],
        location: currentLocation,
        message: message.substring(0, 50),
        emoji: selectedEmoji,
        authorId: user?.uid || 'anonymous',
        authorUsername: username || user?.email?.split('@')[0] || 'Unknown',
        authorEmail: user?.email || 'Guest',
        category: 'General',
        likes: 0
      };
      
      // Optimistic Update
      setSignposts([...signposts, newSignpost]);

      await apiClient('/signposts', {
        method: 'POST',
        body: JSON.stringify({
          lng: currentLocation[0],
          lat: currentLocation[1],
          message: message.substring(0, 50),
          emoji: selectedEmoji,
          authorId: user?.uid || 'anonymous',
          category: 'General'
        })
      });
      setMessage('');
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to drop signpost.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#faf9f6] w-full max-w-sm rounded-3xl border-4 border-[#1d3539] shadow-[8px_8px_0px_0px_#1d3539] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        
        <div className="bg-[#5496a2] border-b-4 border-[#1d3539] px-4 py-3 flex items-center justify-between">
          <h2 className="font-black text-white text-lg uppercase tracking-tight">📍 Drop a Signpost</h2>
          <button onClick={onClose} className="text-white font-bold hover:scale-110 transition-transform">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">Select a Sticker</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_LIST.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`text-3xl p-2 rounded-xl border-2 transition-transform ${selectedEmoji === emoji ? 'border-[#1d3539] bg-[#fff4d6] scale-110 shadow-[2px_2px_0px_0px_#1d3539]' : 'border-transparent hover:bg-slate-100 hover:scale-105'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">Your Message (Max 50 chars)</label>
            <input 
              type="text" 
              maxLength={50}
              placeholder="e.g., Keep pushing! Almost there!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 focus:border-slate-900 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none transition-colors"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full mt-2 bg-[#5496a2] border-2 border-[#1d3539] shadow-[4px_4px_0px_0px_#1d3539] text-white rounded-xl py-3 font-black uppercase tracking-wide hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Dropping...' : 'Drop Signpost 📍'}
          </button>
        </form>
      </div>
    </div>
  );
};
