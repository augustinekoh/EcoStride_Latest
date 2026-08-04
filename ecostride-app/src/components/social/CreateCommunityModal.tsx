import React, { useState, useRef } from 'react';
import { X, Search, Camera, Loader2 } from 'lucide-react';
import { auth } from '../../firebase';
import { apiClient } from '../../lib/api';
import imageCompression from 'browser-image-compression';
import { AvatarCropModal } from '../modals/AvatarCropModal';

interface CreateCommunityModalProps {
  onClose: () => void;
  onCreated: (guildId: string) => void;
}

export function CreateCommunityModal({ onClose, onCreated }: CreateCommunityModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🌍');
  const [nationality, setNationality] = useState('Global');
  const [requireApproval, setRequireApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dragY, setDragY] = useState(0);
  const [startY, setStartY] = useState(0);

  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleIconCropped = async (croppedBlob: Blob) => {
    setCropImageSrc(null);
    try {
      const fileToCompress = new File([croppedBlob], 'icon.jpg', { type: 'image/jpeg' });
      const options = {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(fileToCompress, options);
      setIconFile(compressedFile);
      setIconPreviewUrl(URL.createObjectURL(compressedFile));
      setIcon(''); // Clear emoji icon selection
    } catch (e) {
      console.error('Error compressing image:', e);
      alert('Failed to process image.');
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 100) {
      onClose();
    }
    setDragY(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Community name is required');
      return;
    }

    if (!auth.currentUser) return;
    setIsSubmitting(true);
    setError('');

    try {
      const data = await apiClient('/guilds', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          icon: icon || '🌍',
          nationality,
          require_approval: requireApproval
        })
      });


      if (data.success && iconFile) {
        const formData = new FormData();
        formData.append('icon_file', iconFile, iconFile.name);
        
        try {
          const uploadRes = await apiClient(`/guilds/${data.guildId}/icon`, {
            method: 'POST',
            body: formData
          });
          if (!uploadRes.success) {
            console.error('Failed to upload icon', uploadRes);
          }
        } catch (uploadErr) {
          console.error('Error uploading icon', uploadErr);
        }
        onCreated(data.guildId);
      } else if (data.success) {
        onCreated(data.guildId);
      } else {
        setError(data.error || 'Failed to create community');
      }
    } catch (e) {
      console.error(e);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const icons = ['🌍', '🌲', '🌿', '🌱', '🏞️', '🚵', '🏃', '♻️'];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto touch-none overscroll-none">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className={`relative bg-[#faf9f6]/95 backdrop-blur-xl w-full h-[85vh] rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden border-t border-[#1d3539]/10 animate-in slide-in-from-bottom ${dragY === 0 ? 'transition-transform duration-300 ease-out' : ''}`}
        style={{ transform: `translateY(${dragY}px)` }}
      >
        <div 
          className="flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing touch-none w-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-14 h-1.5 bg-[#1d3539]/20 rounded-full pointer-events-none" />
        </div>
        
        <div className="px-6 py-4 flex justify-between items-center border-b border-[#1d3539]/10">
          <h2 className="text-xl font-black text-[#1d3539]">Create Community</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#1d3539]/10 text-[#5496a2] transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-black text-[#5496a2] mb-2">Community Icon</label>
            <div className="flex space-x-3 overflow-x-auto pb-2 custom-scrollbar items-center">
              <label className="shrink-0 flex items-center justify-center bg-white border-2 border-dashed border-[#5496a2]/50 rounded-2xl w-12 h-12 cursor-pointer hover:bg-slate-50 transition-colors overflow-hidden group relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                />
                {iconPreviewUrl ? (
                  <img src={iconPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={20} className="text-[#5496a2]" />
                )}
                {iconPreviewUrl && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={16} className="text-white" />
                  </div>
                )}
              </label>

              {icons.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => { setIcon(emoji); setIconPreviewUrl(null); setIconFile(null); }}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all shrink-0 shadow-sm ${
                    icon === emoji ? 'bg-[#5496a2]/20 border-2 border-[#5496a2] scale-110 shadow-md' : 'bg-white border border-[#1d3539]/20 hover:border-[#5496a2]/50 hover:bg-slate-50'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-[#5496a2] mb-2">Community Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Eco Warriors"
              className="w-full bg-white border-2 border-[#1d3539]/10 rounded-xl px-4 py-3 text-[#1d3539] font-bold focus:outline-none focus:border-[#5496a2] focus:ring-4 focus:ring-[#5496a2]/20 transition-all shadow-sm placeholder:text-slate-400"
              maxLength={40}
            />
          </div>

          <div>
            <label className="block text-sm font-black text-[#5496a2] mb-2">Bio / Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is your community about?"
              rows={3}
              className="w-full bg-white border-2 border-[#1d3539]/10 rounded-xl px-4 py-3 text-[#1d3539] font-bold focus:outline-none focus:border-[#5496a2] focus:ring-4 focus:ring-[#5496a2]/20 transition-all shadow-sm placeholder:text-slate-400 resize-none"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-black text-[#5496a2] mb-2">Nationality / Region</label>
            <input
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="e.g. Global, Malaysia, UK..."
              className="w-full bg-white border-2 border-[#1d3539]/10 rounded-xl px-4 py-3 text-[#1d3539] font-bold focus:outline-none focus:border-[#5496a2] focus:ring-4 focus:ring-[#5496a2]/20 transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-white border-2 border-[#1d3539]/10 rounded-xl shadow-sm">
            <div>
              <h4 className="text-[#1d3539] font-black">Require Approval to Join</h4>
              <p className="text-xs text-[#5496a2] font-bold mt-1">Users will need to send a request.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5496a2]"></div>
            </label>
          </div>
        </form>

        <div className="p-4 bg-[#faf9f6]/95 border-t border-[#1d3539]/10 backdrop-blur-xl">
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="w-full py-4 rounded-xl font-black text-lg flex items-center justify-center transition-all bg-[#1d3539] text-[#fff4d6] hover:bg-[#15272a] shadow-[4px_4px_0px_0px_#5496a2] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#5496a2] disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_#5496a2]"
          >
            {isSubmitting ? 'Creating...' : 'Create Community'}
          </button>
        </div>
      </div>

      <AvatarCropModal 
        isOpen={!!cropImageSrc}
        imageSrc={cropImageSrc || ''}
        onClose={() => setCropImageSrc(null)}
        onConfirm={handleIconCropped}
      />
    </div>
  );
}
