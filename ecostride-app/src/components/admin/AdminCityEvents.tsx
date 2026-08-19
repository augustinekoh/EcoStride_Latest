import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';
import { Calendar, Plus, Upload, Trash2, CheckCircle, XCircle, ImageIcon, Loader2, Edit3 } from 'lucide-react';
import { compressImage } from '../../lib/imageUtils';
import { AvatarCropModal } from '../modals/AvatarCropModal';
import { AdminEventDetailModal } from '../modals/AdminEventDetailModal';

export function AdminCityEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'ended'>('all');
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entryFee, setEntryFee] = useState(0);
  const [eventType, setEventType] = useState('marathon');
  const [promoImage, setPromoImage] = useState('');
  const [badges, setBadges] = useState<any[]>([{ name: '', description: '', icon_url: '', tier_level: 1, target_value: 0 }]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Crop State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const eventsRes = await apiClient('/city-events/events?t=' + Date.now());
      setEvents(eventsRes.events || []);
      setAllBadges(eventsRes.badges || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleAddBadge = () => {
    setBadges([...badges, { name: '', description: '', icon_url: '', tier_level: badges.length + 1, target_value: 0 }]);
  };

  const handleRemoveBadge = (index: number) => {
    setBadges(badges.filter((_, i) => i !== index));
  };

  const handleBadgeChange = (index: number, field: string, value: any) => {
    const newBadges = [...badges];
    newBadges[index] = { ...newBadges[index], [field]: value };
    setBadges(newBadges);
  };

  const handleSelectPromoImage = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, cropSquare = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const compressedFile = await compressImage(file, 1200, 1200, 0.8, cropSquare);
      const formData = new FormData();
      formData.append('file', compressedFile);
      
      const res = await apiClient('/city-events/admin/images', {
        method: 'POST',
        body: formData
      });
      
      if (res.success && res.url) {
        callback(res.url);
      } else {
        throw new Error(res.error || 'Upload failed');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to process and upload image');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title,
        description,
        start_date: new Date(startDate).getTime(),
        end_date: new Date(endDate).getTime(),
        entry_fee: Number(entryFee),
        event_type: eventType,
        promo_image: promoImage,
        badges: badges.map(b => ({ ...b, target_value: Number(b.target_value) }))
      };
      
      await apiClient('/city-events/admin/events', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      alert('Event created successfully!');
      setShowForm(false);
      setTitle('');
      setDescription('');
      setPromoImage('');
      setBadges([{ name: '', description: '', icon_url: '', tier_level: 1, target_value: 0 }]);
      fetchEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to create event');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await apiClient(`/city-events/admin/events/${id}`, { method: 'DELETE' });
      fetchEvents();
    } catch (e) {
      alert('Failed to delete event');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-teal-950">City Events Manager</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-teal-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-teal-700">
          <Plus size={20} /> {showForm ? 'Cancel' : 'Create New Event'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-teal-100">
          <h3 className="text-2xl font-bold mb-6 text-teal-900">Create Campaign</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-teal-800 mb-2">Event Title</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-xl border-slate-200 p-3" />
              </div>
              <div>
                <label className="block text-sm font-bold text-teal-800 mb-2">Event Type</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} className="w-full rounded-xl border-slate-200 p-3">
                  <option value="marathon">Marathon (KM)</option>
                  <option value="trees">Tree Planting</option>
                  <option value="reports">Issue Resolution</option>
                  <option value="spending">Coin Spending</option>
                  <option value="manual">Manual Photo Proof (e.g. Store Visit)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-teal-800 mb-2">Description</label>
                <textarea required value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-xl border-slate-200 p-3 h-24" />
              </div>
              <div>
                <label className="block text-sm font-bold text-teal-800 mb-2">Start Date</label>
                <input required type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-xl border-slate-200 p-3" />
              </div>
              <div>
                <label className="block text-sm font-bold text-teal-800 mb-2">End Date</label>
                <input required type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full rounded-xl border-slate-200 p-3" />
              </div>
              <div>
                <label className="block text-sm font-bold text-teal-800 mb-2">Entry Fee (Coins)</label>
                <input required type="number" min="0" value={entryFee} onChange={e => setEntryFee(Number(e.target.value))} className="w-full rounded-xl border-slate-200 p-3" />
              </div>
              <div>
                <label className="block text-sm font-bold text-teal-800 mb-2">Promo Image (16:9 auto-resize)</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer bg-teal-100 text-teal-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-teal-200 transition-colors w-full justify-center">
                    {uploadingImage ? <Loader2 className="animate-spin" size={20}/> : <Upload size={20}/>}
                    {uploadingImage ? 'Processing...' : 'Upload Banner'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleSelectPromoImage} disabled={uploadingImage} />
                  </label>
                  {promoImage && <img src={promoImage} alt="Promo preview" className="h-12 w-24 rounded-xl object-cover border-2 border-teal-200" />}
                </div>
              </div>
            </div>

            <div className="border-t border-teal-100 pt-6 mt-6">
              <h4 className="text-xl font-bold text-teal-900 mb-4 flex items-center justify-between">
                Badge Tiers
                <button type="button" onClick={handleAddBadge} className="text-sm bg-teal-100 text-teal-700 px-3 py-1 rounded-lg hover:bg-teal-200">+ Add Tier</button>
              </h4>
              <div className="space-y-4">
                {badges.map((b, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {badges.length > 1 && (
                      <button type="button" onClick={() => handleRemoveBadge(idx)} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1"><Trash2 size={16}/></button>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Tier {b.tier_level} Target</label>
                      <input required type="number" min="1" value={b.target_value} onChange={e => handleBadgeChange(idx, 'target_value', e.target.value)} className="w-full rounded-lg border-slate-200 p-2 text-sm" placeholder="e.g. 10" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Badge Title</label>
                      <input required type="text" value={b.name} onChange={e => handleBadgeChange(idx, 'name', e.target.value)} className="w-full rounded-lg border-slate-200 p-2 text-sm" placeholder="e.g. Bronze Runner" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Badge Description (Profile Detail)</label>
                      <input required type="text" value={b.description} onChange={e => handleBadgeChange(idx, 'description', e.target.value)} className="w-full rounded-lg border-slate-200 p-2 text-sm" placeholder="Awarded for..." />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Badge Icon (Auto-square crop)</label>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-300 transition-colors flex-1 justify-center text-sm">
                          {uploadingImage ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16}/>}
                          {b.icon_url ? 'Change Image' : 'Upload Icon'}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, (url) => handleBadgeChange(idx, 'icon_url', url), true)} disabled={uploadingImage} />
                        </label>
                        {b.icon_url && <img src={b.icon_url} alt="Badge preview" className="h-10 w-10 rounded-lg object-cover border border-slate-300" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl hover:bg-teal-700 text-lg shadow-lg">
              Launch Campaign
            </button>
          </form>
        </div>
      )}

      {/* Existing Events List */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 mt-8 gap-4">
        <h2 className="text-2xl font-black text-teal-950">Manage Events</h2>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
          {(['all', 'active', 'upcoming', 'ended'] as const).map(f => (
            <button 
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-lg font-bold text-sm capitalize transition-colors ${statusFilter === f ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {events.filter(e => {
          const now = Date.now();
          if (statusFilter === 'active') return now >= e.start_date && now <= e.end_date;
          if (statusFilter === 'upcoming') return now < e.start_date;
          if (statusFilter === 'ended') return now > e.end_date;
          return true;
        }).map((e) => {
          const now = Date.now();
          const isUpcoming = now < e.start_date;
          const isEnded = now > e.end_date;
          const isActive = !isUpcoming && !isEnded;

          let statusBadge = { text: 'Active', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' };
          if (isUpcoming) statusBadge = { text: 'Upcoming', color: 'bg-blue-100 text-blue-700 border border-blue-200' };
          if (isEnded) statusBadge = { text: 'Ended', color: 'bg-slate-100 text-slate-600 border border-slate-200' };

          return (
            <div key={e.id} onClick={() => setSelectedEvent(e)} className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-teal-100 relative overflow-hidden group flex flex-col cursor-pointer hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-teal-950 mb-1 line-clamp-1">{e.title}</h3>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${statusBadge.color}`}>
                    {statusBadge.text}
                  </span>
                </div>
                <div className="text-teal-600 bg-teal-50 p-2 rounded-xl group-hover:bg-teal-100 transition-colors shrink-0">
                  <Edit3 size={18} />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4 line-clamp-2 flex-1">{e.description}</p>
              
              <div className="space-y-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                <p className="flex justify-between"><span className="font-bold text-slate-700">Dates:</span> <span>{new Date(e.start_date).toLocaleDateString()} - {new Date(e.end_date).toLocaleDateString()}</span></p>
                <p className="flex justify-between"><span className="font-bold text-slate-700">Type:</span> <span>{e.event_type}</span></p>
                <p className="flex justify-between"><span className="font-bold text-slate-700">Entry:</span> <span>{e.entry_fee} coins</span></p>
              </div>
            </div>
          )
        })}
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

      {selectedEvent && (
        <AdminEventDetailModal
          event={selectedEvent}
          eventBadges={allBadges.filter(b => b.event_id === selectedEvent.id)}
          onClose={() => setSelectedEvent(null)}
          onRefresh={() => {
            setSelectedEvent(null);
            fetchEvents();
          }}
        />
      )}
    </div>
  );
}
