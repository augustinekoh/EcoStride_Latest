import React, { useState, useRef, useEffect } from 'react';
import { X, Save, AlertTriangle, Calendar, Image as ImageIcon, Upload, Loader2, Info } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { AvatarCropModal } from './AvatarCropModal';
import { compressImage } from '../../lib/imageUtils';

interface AdminEventDetailModalProps {
  event: any;
  eventBadges: any[];
  onClose: () => void;
  onRefresh: () => void;
}

export function AdminEventDetailModal({ event, eventBadges, onClose, onRefresh }: AdminEventDetailModalProps) {
  // Convert absolute timestamp to local datetime string (YYYY-MM-DDTHH:mm) for input type="datetime-local"
  const formatLocal = (ts: number) => {
    const d = new Date(ts);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [promoImage, setPromoImage] = useState(event.promo_image || '');
  const [startDate, setStartDate] = useState(formatLocal(event.start_date));
  const [endDate, setEndDate] = useState(formatLocal(event.end_date));
  const [entryFee, setEntryFee] = useState(event.entry_fee.toString());
  
  const [isSaving, setIsSaving] = useState(false);
  const [showEndEarlyConfirm, setShowEndEarlyConfirm] = useState(false);
  const [endReason, setEndReason] = useState('');
  
  const endEarlyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showEndEarlyConfirm && endEarlyRef.current) {
      endEarlyRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [showEndEarlyConfirm]);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const now = Date.now();
  const isUpcoming = now < event.start_date;
  const isEnded = now > event.end_date;
  const isActive = !isUpcoming && !isEnded;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await apiClient(`/city-events/admin/events/${event.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          description,
          promo_image: promoImage,
          start_date: new Date(startDate).getTime(),
          end_date: new Date(endDate).getTime(),
          entry_fee: parseInt(entryFee) || 0
        })
      });
      onRefresh();
      onClose();
    } catch (e: any) {
      alert('Failed to update event: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    try {
      await apiClient(`/city-events/admin/events/${event.id}`, { method: 'DELETE' });
      onRefresh();
      onClose();
    } catch (e: any) {
      alert('Failed to delete: ' + e.message);
    }
  };

  const handleEndEarly = async () => {
    if (!endReason.trim()) {
      alert('Please provide a reason for ending the event early.');
      return;
    }
    try {
      setIsSaving(true);
      await apiClient(`/city-events/admin/events/${event.id}/end-early`, {
        method: 'POST',
        body: JSON.stringify({ reason: endReason })
      });
      onRefresh();
      onClose();
    } catch (e: any) {
      alert('Failed to end event: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropModalOpen(false);
    setUploadingImage(true);
    try {
      const file = new File([blob], 'promo.jpg', { type: 'image/jpeg' });
      const compressedFile = await compressImage(file, 1600, 1600, 0.8, false);
      const formData = new FormData();
      formData.append('file', compressedFile);
      
      const res = await apiClient('/city-events/admin/images', {
        method: 'POST',
        body: formData
      });
      
      if (res.success && res.url) {
        setPromoImage(res.url);
      } else {
        throw new Error(res.error || 'Upload failed');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to process and upload image');
    } finally {
      setUploadingImage(false);
      setCropImageSrc(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl flex flex-col relative">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
          <h2 className="text-2xl font-black text-teal-950">Edit Event Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6 flex-1">
          {event.early_end_reason && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-amber-900 text-sm">Event Terminated Early</h4>
                <p className="text-sm text-amber-800 mt-1">{event.early_end_reason}</p>
              </div>
            </div>
          )}

          {/* Read-only fields */}
          <div className="flex gap-4">
            <div className="flex-1 bg-slate-100 p-4 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Event Type</label>
              <div className="font-bold text-slate-700 capitalize">{event.event_type}</div>
            </div>
            <div className="flex-1 bg-slate-100 p-4 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">ID</label>
              <div className="font-bold text-slate-700 text-xs truncate">{event.id}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Event Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  disabled={isEnded}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all outline-none disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  disabled={isEnded}
                  rows={4}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all outline-none resize-none disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Entry Fee (Coins)</label>
                <input 
                  type="number" 
                  value={entryFee} 
                  onChange={e => setEntryFee(e.target.value)}
                  disabled={isEnded}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all outline-none disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Promo Image</label>
                <div className="flex items-center gap-3 mb-2">
                  <label className={`cursor-pointer bg-teal-100 text-teal-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-teal-200 transition-colors flex-1 justify-center text-sm ${isEnded ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingImage ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16}/>}
                    {promoImage ? 'Change Image (16:9)' : 'Upload Promo Image (16:9)'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageSelect} 
                      disabled={uploadingImage || isEnded} 
                    />
                  </label>
                </div>
                {promoImage ? (
                  <div className="mt-2 aspect-video w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative">
                    <img src={promoImage} alt="Promo preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="mt-2 aspect-video w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400">
                    <ImageIcon size={32} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Start Date</label>
                  <input 
                    type="datetime-local" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    disabled={isEnded}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 transition-all outline-none text-sm disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">End Date</label>
                  <input 
                    type="datetime-local" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    disabled={isEnded}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 transition-all outline-none text-sm disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Read-only Badges */}
          <div className="pt-6 border-t border-slate-100">
            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Info className="text-teal-500" size={18} /> Event Target & Rewards <span className="text-xs font-normal text-slate-500">(Read-only)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {eventBadges.map((b, idx) => (
                <div key={b.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center opacity-80 cursor-not-allowed">
                  <div className="w-12 h-12 mx-auto mb-2 bg-slate-200 rounded-lg overflow-hidden border border-slate-300">
                    {b.icon_url ? <img src={b.icon_url} alt={b.name} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="mx-auto mt-3 text-slate-400" />}
                  </div>
                  <p className="font-bold text-xs text-slate-700 line-clamp-1">{b.name}</p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">Target: <span className="font-bold text-slate-700">{b.target_value}</span></p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col gap-4">
          <div className="flex justify-between items-center w-full">
            <div>
              {isUpcoming && (
                <button 
                  onClick={handleDelete}
                  className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                >
                  Delete Event
                </button>
              )}
              {isActive && (
                <button 
                  onClick={() => setShowEndEarlyConfirm(!showEndEarlyConfirm)}
                  className="px-4 py-2 text-amber-600 font-bold hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-2 border border-transparent hover:border-amber-200"
                >
                  <AlertTriangle size={18} /> End Early
                </button>
              )}
              {isEnded && (
                <span className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 cursor-not-allowed">
                  Event Ended
                </span>
              )}
            </div>

            <button 
              onClick={handleSave}
              disabled={isSaving || isEnded}
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md shadow-teal-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={20} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* End Early Form */}
          {showEndEarlyConfirm && isActive && (
            <div ref={endEarlyRef} className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-in slide-in-from-top-2">
              <h4 className="font-bold text-amber-900 mb-2">Terminate Event Early</h4>
              <p className="text-sm text-amber-700 mb-4">This will immediately freeze the event for all participants. Please provide a reason to display to users.</p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={endReason}
                  onChange={e => setEndReason(e.target.value)}
                  placeholder="e.g. Goal reached early, administrative decision..."
                  className="flex-1 p-3 rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-white"
                />
                <button 
                  onClick={handleEndEarly}
                  disabled={isSaving || !endReason.trim()}
                  className="bg-amber-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  Confirm End
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {cropModalOpen && (
        <AvatarCropModal
          isOpen={cropModalOpen}
          onClose={() => {
            setCropModalOpen(false);
            setCropImageSrc(null);
          }}
          imageSrc={cropImageSrc}
          onConfirm={handleCropConfirm}
          aspect={16/9}
          cropShape="rect"
        />
      )}
    </div>
  );
}
