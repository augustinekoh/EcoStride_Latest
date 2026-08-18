import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../stores/useUserStore';
import { apiClient } from '../../lib/api';
import { Camera, X, AlertTriangle, MapPin, Compass, Loader2, Sparkles, ImagePlus } from 'lucide-react';
import { compressImage } from '../../lib/imageUtils';
import { getCountries, getStatesForCountry, getCitiesForState, isValidLocation } from '../../lib/locationData';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: [number, number] | null;
  onSuccess?: () => void;
}

export const CreateIssueModal: React.FC<Props> = ({ isOpen, onClose, currentLocation, onSuccess }) => {
  const userStore = useUserStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState(userStore.country || '');
  const [state, setState] = useState(userStore.state || '');
  const [city, setCity] = useState(userStore.city || '');
  const [specificLocation, setSpecificLocation] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [startY, setStartY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    if (currentY > startY) {
      setDragY(currentY - startY);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 100) {
      onClose();
    }
    setDragY(0);
    setStartY(0);
  };

  // Sync with user store when opened
  useEffect(() => {
    if (isOpen) {
      setCountry(userStore.country || '');
      setState(userStore.state || '');
      setCity(userStore.city || '');
    }
  }, [isOpen, userStore.country, userStore.state, userStore.city]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please enter a title for the issue.");
      return;
    }
    if (!country || !state || !city || !isValidLocation(country, state, city)) {
      alert("Please select a valid Country, State, and City jurisdiction for this report.");
      return;
    }

    const coords: [number, number] = currentLocation || [103.6400, 1.5600];

    setIsSubmitting(true);
    try {
      let uploadedUrls: string[] = [];
      
      // Upload images using direct multipart endpoint
      if (images.length > 0) {
        for (const img of images) {
          const formData = new FormData();
          formData.append('file', img);
          
          const uploadRes = await apiClient('/issues/images', {
            method: 'POST',
            body: formData
          });
          
          if (!uploadRes.success || !uploadRes.url) {
            throw new Error(uploadRes.error || 'Failed to upload photo evidence');
          }
          
          uploadedUrls.push(uploadRes.url);
        }
      }

      // Create Issue
      const res = await apiClient('/issues', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          country,
          state,
          city,
          specific_location: specificLocation.trim(),
          lng: coords[0],
          lat: coords[1],
          photos: uploadedUrls
        })
      });
      
      if (!res.success) {
        throw new Error(res.error || 'Failed to create issue');
      }

      setTitle('');
      setDescription('');
      setSpecificLocation('');
      setImages([]);
      setImagePreviews([]);
      onClose();
      if (onSuccess) onSuccess();
      alert("Issue reported successfully!");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to report issue: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200">
      {/* Background click to dismiss */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      {/* Main Glassmorphic Modal Card */}
      <div 
        className="relative w-full sm:max-w-lg bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl backdrop-saturate-150 border-t sm:border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
        style={{ 
          transform: `translateY(${dragY}px)`, 
          transition: dragY === 0 ? 'transform 0.2s' : 'none' 
        }}
      >
        
        {/* Mobile Drag Indicator & Header Touch Area */}
        <div 
          className="w-full pt-3 pb-1 flex justify-center sm:hidden shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-slate-300/80 dark:bg-slate-700/80 rounded-full pointer-events-none" />
        </div>

        {/* Sticky Header with Frosted Glass */}
        <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/60 dark:border-slate-800/80 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-sm backdrop-blur-md">
              <AlertTriangle size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 dark:text-white text-lg tracking-tight uppercase flex items-center gap-1.5">
                Report Issue
                <Sparkles size={14} className="text-emerald-500 animate-pulse" />
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Help keep public infrastructure safe & clean
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose} 
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all shadow-sm"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-3 sm:space-y-4 text-slate-900 dark:text-slate-100">
          
          {/* Live GPS Coordinates Banner */}
          {currentLocation && (
            <div className="flex items-center gap-2.5 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/20 px-3.5 py-2.5 rounded-2xl backdrop-blur-md text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-sm">
              <Compass size={16} className="text-emerald-600 dark:text-emerald-400 animate-spin" style={{ animationDuration: '8s' }} />
              <span>GPS Location:</span>
              <span className="font-mono text-[11px] bg-white/60 dark:bg-slate-800/60 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                {currentLocation[1].toFixed(5)}, {currentLocation[0].toFixed(5)}
              </span>
            </div>
          )}

          {/* Issue Title Input */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Issue Title <span className="text-rose-500">*</span>
            </label>
            <input 
              type="text" 
              maxLength={100}
              placeholder="e.g., Broken streetlight, Large pothole, Damaged bench"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all shadow-sm"
            />
          </div>

          {/* Description Textarea */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Description <span className="text-slate-400 font-normal text-[11px] lowercase">(optional)</span>
            </label>
            <textarea 
              maxLength={500}
              placeholder="Provide more details regarding the damage or safety concern..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all min-h-[70px] sm:min-h-[90px] resize-none shadow-sm"
            />
          </div>

          {/* Frosted Jurisdiction Glass Card */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white/40 dark:from-emerald-950/30 dark:via-slate-800/60 dark:to-slate-800/40 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-emerald-500/25 dark:border-emerald-500/20 shadow-sm flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              <MapPin size={15} className="text-emerald-600 dark:text-emerald-400" />
              <span>Assigned Jurisdiction <span className="text-rose-500">*</span></span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Country</label>
              <select 
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setState('');
                  setCity('');
                }}
                required
                className="w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all shadow-sm"
              >
                <option value="">Select Country</option>
                {getCountries().map((c) => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">State / Region</label>
                <select 
                  value={state}
                  disabled={!country}
                  onChange={(e) => {
                    setState(e.target.value);
                    setCity('');
                  }}
                  required
                  className="w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all shadow-sm disabled:opacity-50"
                >
                  <option value="">{country ? 'Select State' : 'Select Country First'}</option>
                  {getStatesForCountry(country).map((s) => (
                    <option key={s.code} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">City / District</label>
                <select 
                  value={city}
                  disabled={!state}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all shadow-sm disabled:opacity-50"
                >
                  <option value="">{state ? 'Select City' : 'Select State First'}</option>
                  {getCitiesForState(country, state).map((cty) => (
                    <option key={cty} value={cty}>{cty}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Specific Landmark / Location */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Specific Landmark / Note <span className="text-slate-400 font-normal text-[11px] lowercase">(optional)</span>
            </label>
            <input 
              type="text" 
              maxLength={150}
              placeholder="e.g., Near main gate, 3rd lamp post opposite bus stop"
              value={specificLocation}
              onChange={(e) => setSpecificLocation(e.target.value)}
              className="w-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all shadow-sm"
            />
          </div>

          {/* Photo Attachments with Frosted Upload Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Photo Evidence ({images.length}/3)
              </label>
              
              <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/25 transition-all shadow-sm backdrop-blur-sm ${images.length >= 3 ? 'opacity-50 pointer-events-none' : 'hover:scale-105 active:scale-95'}`}>
                <Camera size={14} />
                <span>Add Photo</span>
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
            
            {imagePreviews.length > 0 ? (
              <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden border border-white/60 dark:border-white/20 shadow-md group">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => {
                        const newImgs = [...images]; newImgs.splice(idx, 1); setImages(newImgs);
                        const newPrevs = [...imagePreviews]; URL.revokeObjectURL(newPrevs[idx]); newPrevs.splice(idx, 1); setImagePreviews(newPrevs);
                      }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-slate-950/70 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                    >
                      <X size={13} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                <ImagePlus size={24} className="text-slate-400 mb-1" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Upload up to 3 photos of the infrastructure issue
                </p>
              </div>
            )}
          </div>

          {/* Sticky Submit Button within Form or Footer */}
          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.99] text-white rounded-xl py-3 font-black uppercase tracking-wider shadow-[0_8px_20px_rgba(225,29,72,0.35)] border border-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Submitting Report...</span>
                </>
              ) : (
                <>
                  <span>Submit Report</span>
                  <span>🚨</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
