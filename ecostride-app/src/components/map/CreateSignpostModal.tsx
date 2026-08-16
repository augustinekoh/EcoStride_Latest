import React, { useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { apiClient } from '../../lib/api';
import { useMapStore } from '../../stores/useMapStore';
import { useUserStore } from '../../stores/useUserStore';
import { Camera, X } from 'lucide-react';
import { compressImage } from '../../lib/imageUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: [number, number] | null;
  onSuccess?: () => void;
}

const EMOJI_LIST = ['🚴', '💪', '📸', '☕', '⚠️', '🏆'];

export const CreateSignpostModal: React.FC<Props> = ({ isOpen, onClose, currentLocation, onSuccess }) => {
  const { user } = useAuthStore();
  const { username } = useUserStore();
  const { signposts, setSignposts } = useMapStore();
  const [selectedEmoji, setSelectedEmoji] = useState('🚴');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
      let uploadedUrls: string[] = [];
      if (images.length > 0) {
        for (const img of images) {
          const formData = new FormData();
          formData.append('file', img);
          const res = await apiClient('/signposts/images', {
            method: 'POST',
            body: formData
          });
          if (res.url) uploadedUrls.push(res.url);
        }
      }
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
        likes: 0,
        images: uploadedUrls
      };
      
      // Optimistic Update
      setSignposts([...signposts, newSignpost]);

      const res = await apiClient('/signposts', {
        method: 'POST',
        body: JSON.stringify({
          lng: currentLocation[0],
          lat: currentLocation[1],
          message: message.substring(0, 50),
          emoji: selectedEmoji,
          authorId: user?.uid || 'anonymous',
          category: 'General',
          images: uploadedUrls
        })
      });
      
      if (res.id) {
        const currentSignposts = useMapStore.getState().signposts;
        setSignposts(currentSignposts.map(s => s.id === newSignpost.id ? { ...s, id: res.id } : s));
      }
      setMessage('');
      setImages([]);
      setImagePreviews([]);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert("Failed to drop signpost.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#faf9f6] w-[calc(100%-8px)] sm:w-full max-w-sm mr-2 sm:mr-0 rounded-3xl border-4 border-[#1d3539] shadow-[8px_8px_0px_0px_#1d3539] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        
        <div className="bg-[#5496a2] border-b-4 border-[#1d3539] px-4 py-3 flex items-center justify-between">
          <h2 className="font-black text-white text-lg uppercase tracking-tight">📍 Drop a Signpost</h2>
          <button onClick={onClose} className="text-white font-bold hover:scale-110 transition-transform">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">Select a Sticker</label>
            <div className="flex flex-wrap gap-2 relative">
              {EMOJI_LIST.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => { setSelectedEmoji(emoji); setShowEmojiPicker(false); }}
                  className={`text-3xl p-2 rounded-xl border-2 transition-transform ${selectedEmoji === emoji ? 'border-[#1d3539] bg-[#fff4d6] scale-110 shadow-[2px_2px_0px_0px_#1d3539]' : 'border-transparent hover:bg-slate-100 hover:scale-105'}`}
                >
                  {emoji}
                </button>
              ))}

              {/* Render custom selected emoji if it's not in the default list */}
              {!EMOJI_LIST.includes(selectedEmoji) && (
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(true)}
                  className={`text-3xl p-2 rounded-xl border-2 transition-transform border-[#1d3539] bg-[#fff4d6] scale-110 shadow-[2px_2px_0px_0px_#1d3539]`}
                >
                  {selectedEmoji}
                </button>
              )}

              {/* More Emojis Button */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`text-2xl p-2 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#1d3539] hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-500 hover:text-[#1d3539] w-14 h-14`}
                title="More emojis"
              >
                ➕
              </button>

              {/* Emoji Picker Popup */}
              {showEmojiPicker && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowEmojiPicker(false)}></div>
                  <div className="relative shadow-[8px_8px_0px_0px_#1d3539] rounded-2xl overflow-hidden border-4 border-[#1d3539] bg-white animate-in zoom-in-95 duration-200">
                    <EmojiPicker 
                      onEmojiClick={(emojiData) => { 
                        setSelectedEmoji(emojiData.emoji); 
                        setShowEmojiPicker(false); 
                      }}
                      width={320}
                      height={400}
                    />
                  </div>
                </div>
              )}
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-slate-700 uppercase">Attach Photos ({images.length}/3)</label>
              <label className={`cursor-pointer ${images.length >= 3 ? 'opacity-50 pointer-events-none' : 'hover:scale-110'} transition-transform bg-[#1d3539] text-white p-2 rounded-full`}>
                <Camera size={18} />
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                  onChange={async (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      if (images.length >= 3) return;
                      const file = e.target.files[0];
                      try {
                        const compressedFile = await compressImage(file, 1200, 1200, 0.8);
                        setImages([...images, compressedFile]);
                        setImagePreviews([...imagePreviews, URL.createObjectURL(compressedFile)]);
                      } catch (err) {
                        alert("Failed to process photo.");
                      }
                      e.target.value = '';
                    }
                  }} 
                />
              </label>
            </div>
            
            {imagePreviews.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-slate-300">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => {
                        const newImgs = [...images]; newImgs.splice(idx, 1); setImages(newImgs);
                        const newPrevs = [...imagePreviews]; URL.revokeObjectURL(newPrevs[idx]); newPrevs.splice(idx, 1); setImagePreviews(newPrevs);
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
