import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { useUserStore } from '../../stores/useUserStore';
import Map, { Marker } from 'react-map-gl/mapbox';
import { MAPBOX_TOKEN } from '../../lib/mapboxAPI';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { Store, Tag, MapPin, CheckCircle, Search, DollarSign, ChevronLeft, Plus, Trash2, ArrowRight } from 'lucide-react';

export const MerchantOnboardingForm: React.FC = () => {
  const { user } = useAuthStore();
  const { username } = useUserStore();
  const { setActiveView, goBack } = useDemoStore();
  
  const [formData, setFormData] = useState({
    storeName: '',
    category: 'Food & Beverage',
    menuLink: '',
    subscriptionPlan: 'RM100/month',
    location: [103.6400, 1.5600] as [number, number],
    vouchers: [{
      id: Date.now().toString(),
      name: '',
      desc: '',
      price: 100,
      stock: 50,
      icon: '🎟️',
      category: 'Vouchers',
      profileShow: true
    }]
  });
  
  const [viewState, setViewState] = useState({
    longitude: 103.6400,
    latitude: 1.5600,
    zoom: 14
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [step3EnteredAt, setStep3EnteredAt] = useState<number>(0);

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') await Geolocation.requestPermissions();
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      const lng = pos.coords.longitude;
      const lat = pos.coords.latitude;
      setFormData(prev => ({ ...prev, location: [lng, lat] }));
      setViewState(prev => ({ ...prev, longitude: lng, latitude: lat }));
      setIsLocating(false);
    } catch (err) {
      console.error(err);
      alert('Could not get location. Please enable location services.');
      setIsLocating(false);
    }
  };

  useEffect(() => {
    handleUseCurrentLocation();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const proximity = `${viewState.longitude},${viewState.latitude}`;
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?proximity=${proximity}&country=MY&access_token=${MAPBOX_TOKEN}`);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        setFormData(prev => ({ ...prev, location: [lng, lat] }));
        setViewState(prev => ({ ...prev, longitude: lng, latitude: lat }));
      } else {
        alert('Location not found. Please try a different search term or drag the pin.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddVoucher = () => {
    if (formData.vouchers.length >= 5) {
      alert("You can only add up to 5 vouchers.");
      return;
    }
    setFormData({
      ...formData,
      vouchers: [...formData.vouchers, {
        id: Date.now().toString(),
        name: '',
        desc: '',
        price: 100,
        stock: 50,
        icon: '🎟️',
        category: 'Vouchers',
        profileShow: true
      }]
    });
  };

  const handleRemoveVoucher = (index: number) => {
    if (formData.vouchers.length === 1) {
      alert("You must have at least one voucher.");
      return;
    }
    const newVouchers = [...formData.vouchers];
    newVouchers.splice(index, 1);
    setFormData({ ...formData, vouchers: newVouchers });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep < 3) {
      if (currentStep === 1 && !formData.storeName) {
        setError('Please fill in your Store Name.');
        return;
      }
      if (currentStep === 2 && (!formData.vouchers[0] || !formData.vouchers[0].name)) {
        setError('Please fill in your Voucher Name.');
        return;
      }
      setError('');
      setCurrentStep(prev => {
        if (prev === 2) setStep3EnteredAt(Date.now());
        return prev + 1;
      });
      return;
    }

    // Prevent form submission if the user pressed Enter inside the search map input
    if (document.activeElement?.tagName === 'INPUT' && (document.activeElement as HTMLInputElement).placeholder?.includes('Search a place')) {
      handleSearch(e);
      return;
    }

    // Prevent accidental double-click on the 'Next Step' button from immediately clicking 'Submit'
    if (Date.now() - step3EnteredAt < 1000) {
      return;
    }

    if (!user) return;
    if (formData.vouchers.length === 0 || !formData.vouchers[0].name) {
      setError("You must create at least one Point Store voucher.");
      return;
    }
    
    try {
      await apiClient('/applications', {
        method: 'POST',
        body: JSON.stringify({
          ownerId: user.uid,
          type: 'new_merchant',
          details: JSON.stringify({
            username: username || user.email?.split('@')[0] || 'Unknown',
            uid: user.uid,
            storeName: formData.storeName,
            category: formData.category,
            menuLink: formData.menuLink,
            subscriptionPlan: formData.subscriptionPlan,
            location: formData.location,
            vouchers: formData.vouchers
          })
        })
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (submitted) {
    return (
      <div className="w-full h-full min-h-[80vh] flex items-center justify-center p-4 bg-gradient-to-br from-[#FFF6D8]/40 via-[#faf9f6]/80 to-[#CCE3C5]/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="glass-card backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/80 dark:border-slate-800 p-8 sm:p-12 rounded-3xl shadow-2xl max-w-lg w-full text-center animate-in zoom-in duration-500">
          <div className="w-20 h-20 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-inner">
            <CheckCircle size={44} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1d3539] dark:text-white mb-3 uppercase tracking-tight">Application Submitted!</h1>
          <p className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
            Your merchant application is under review by the Platform Admin. 
            You will be notified once you are approved to appear on the EcoStride Map.
          </p>
          <button 
            onClick={goBack} 
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-8 py-3.5 rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all uppercase text-sm"
          >
            Go to Merchant Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-[#FFF6D8]/30 via-[#faf9f6]/60 to-[#CCE3C5]/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-3 sm:p-6 md:p-8 pt-4 sm:pt-6 md:pt-8 flex flex-col items-center overflow-y-auto custom-scrollbar transition-colors duration-500">
      
      <div className="max-w-3xl w-full glass-card backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/80 dark:border-slate-800/80 rounded-3xl shadow-xl shadow-teal-900/5 dark:shadow-black/40 p-4 sm:p-7 md:p-10 mb-8 md:mb-20">
        
        {/* Header with Back Button */}
        <div className="flex items-center gap-3.5 mb-6 border-b border-slate-200/80 dark:border-slate-800 pb-5">
          <button 
            onClick={goBack} 
            className="p-2.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-[#1d3539] dark:text-emerald-400 border border-white/90 dark:border-slate-700 shadow-sm transition-all active:scale-95 flex items-center justify-center shrink-0"
            title="Back to Dashboard"
          >
            <ChevronLeft size={22} />
          </button>
          
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/30 dark:to-teal-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
            <Store size={24} />
          </div>
          
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1d3539] dark:text-white uppercase tracking-tight leading-none">
              Merchant Onboarding
            </h1>
            <p className="text-[#5496a2] dark:text-emerald-400/80 font-bold text-xs sm:text-sm mt-1">
              Join EcoStride and drive green foot traffic to your store.
            </p>
          </div>
        </div>
        
        {error && (
          <div className="mb-6 bg-rose-500/10 dark:bg-rose-500/15 p-4 rounded-2xl border border-rose-500/30 text-rose-700 dark:text-rose-400 font-bold text-sm flex items-center gap-2.5 animate-in slide-in-from-top-2 backdrop-blur-md">
            <CheckCircle className="rotate-45 shrink-0" size={18} /> {error}
          </div>
        )}

        {/* Stepper Header */}
        <div className="flex justify-between items-center mb-8 px-4 sm:px-16 relative">
          <div className="absolute left-12 right-12 top-5 h-0.5 bg-slate-200/80 dark:bg-slate-700/80 -z-10"></div>
          {[1, 2, 3].map(step => (
            <div key={step} className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black border transition-all duration-300 shadow-sm ${currentStep >= step ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-white/60 shadow-emerald-900/20' : 'bg-white/80 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                {step}
              </div>
              <span className={`text-[10px] sm:text-xs mt-2 font-black uppercase tracking-wider transition-colors duration-300 ${currentStep >= step ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                {step === 1 ? 'Basic Info' : step === 2 ? 'Vouchers' : 'Location'}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* STEP 1: Basic Info */}
          {currentStep === 1 && (
          <div className="bg-white/50 dark:bg-slate-800/50 p-5 sm:p-7 rounded-3xl border border-white/80 dark:border-slate-700/70 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 backdrop-blur-md shadow-sm">
            <h2 className="text-base sm:text-lg font-black text-[#1d3539] dark:text-white uppercase flex items-center gap-2 mb-4 border-b border-slate-200/80 dark:border-slate-700 pb-2.5">
              <Store size={20} className="text-emerald-500"/> Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-black text-xs mb-1.5 text-slate-700 dark:text-slate-200 uppercase tracking-wider">Store Name</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. Green Cafe" 
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 font-bold bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all outline-none backdrop-blur-md shadow-inner text-sm" 
                  value={formData.storeName} 
                  onChange={(e) => setFormData({...formData, storeName: e.target.value})} 
                />
              </div>
              <div>
                <label className="block font-black text-xs mb-1.5 text-slate-700 dark:text-slate-200 uppercase tracking-wider">Store Category</label>
                <select 
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 font-bold bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all outline-none backdrop-blur-md shadow-inner text-sm cursor-pointer" 
                  value={formData.category} 
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                  <option className="dark:bg-slate-800">Food & Beverage</option>
                  <option className="dark:bg-slate-800">Retail</option>
                  <option className="dark:bg-slate-800">Services</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block font-black text-xs mb-1.5 text-slate-700 dark:text-slate-200 uppercase tracking-wider">Menu / Services Link</label>
                <input 
                  type="url" 
                  placeholder="https://..." 
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 font-bold bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all outline-none backdrop-blur-md shadow-inner text-sm" 
                  value={formData.menuLink} 
                  onChange={(e) => setFormData({...formData, menuLink: e.target.value})} 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-black text-xs mb-1.5 text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1">
                  <DollarSign size={15} className="text-emerald-500"/> Subscription Plan
                </label>
                <select 
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 font-bold bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all outline-none backdrop-blur-md shadow-inner text-sm cursor-pointer" 
                  value={formData.subscriptionPlan} 
                  onChange={(e) => setFormData({...formData, subscriptionPlan: e.target.value})}
                >
                  <option className="dark:bg-slate-800">RM100/month</option>
                  <option className="dark:bg-slate-800">RM1000/year (Save RM200)</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* STEP 2: Vouchers */}
          {currentStep === 2 && (
          <div className="bg-white/50 dark:bg-slate-800/50 p-5 sm:p-7 rounded-3xl border border-white/80 dark:border-slate-700/70 space-y-4 relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300 backdrop-blur-md shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 relative z-10 gap-3 border-b border-slate-200/80 dark:border-slate-700 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#1d3539] dark:text-white uppercase flex items-center gap-2">
                  <Tag size={20} className="text-emerald-500"/> Point Store Vouchers
                </h2>
                <p className="text-xs font-bold text-[#5496a2] dark:text-emerald-400/80 mt-0.5">Create up to 5 vouchers for users to redeem with Eco-Coins.</p>
              </div>
              {formData.vouchers.length < 5 && (
                <button 
                  type="button" 
                  onClick={handleAddVoucher} 
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-xl font-bold shadow-md active:scale-95 transition-all text-xs shrink-0 flex items-center gap-1"
                >
                  <Plus size={14} /> Add Voucher
                </button>
              )}
            </div>
            
            <div className="space-y-4 relative z-10">
              {formData.vouchers.map((voucher, idx) => (
                <div key={idx} className="bg-white/70 dark:bg-slate-900/70 p-4 sm:p-5 rounded-2xl border border-white/90 dark:border-slate-700/80 space-y-3.5 shadow-sm relative backdrop-blur-md">
                  {formData.vouchers.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveVoucher(idx)} 
                      className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 font-bold text-xs bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95 flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="md:col-span-2">
                      <label className="block font-black text-[11px] mb-1 text-slate-700 dark:text-slate-300 uppercase tracking-wider">Voucher Name</label>
                      <input 
                        required 
                        type="text" 
                        placeholder="e.g. Free Coffee" 
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm shadow-inner" 
                        value={voucher.name} 
                        onChange={(e) => {
                          const newVouchers = [...formData.vouchers];
                          newVouchers[idx].name = e.target.value;
                          setFormData({...formData, vouchers: newVouchers});
                        }} 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block font-black text-[11px] mb-1 text-slate-700 dark:text-slate-300 uppercase tracking-wider">Description</label>
                      <input 
                        required 
                        type="text" 
                        placeholder="e.g. Valid for all regular sized coffees" 
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm shadow-inner" 
                        value={voucher.desc} 
                        onChange={(e) => {
                          const newVouchers = [...formData.vouchers];
                          newVouchers[idx].desc = e.target.value;
                          setFormData({...formData, vouchers: newVouchers});
                        }} 
                      />
                    </div>
                    <div>
                      <label className="block font-black text-[11px] mb-1 text-slate-700 dark:text-slate-300 uppercase tracking-wider">Price (Eco-Coins)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🪙</span>
                        <input 
                          required 
                          type="number" 
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 font-bold bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm shadow-inner" 
                          value={voucher.price} 
                          onChange={(e) => {
                            const newVouchers = [...formData.vouchers];
                            newVouchers[idx].price = Number(e.target.value);
                            setFormData({...formData, vouchers: newVouchers});
                          }} 
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block font-black text-[11px] mb-1 text-slate-700 dark:text-slate-300 uppercase tracking-wider">Stock</label>
                        <input 
                          required 
                          type="number" 
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm shadow-inner" 
                          value={voucher.stock} 
                          onChange={(e) => {
                            const newVouchers = [...formData.vouchers];
                            newVouchers[idx].stock = Number(e.target.value);
                            setFormData({...formData, vouchers: newVouchers});
                          }} 
                        />
                      </div>
                      <div className="w-24">
                        <label className="block font-black text-[11px] mb-1 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-center">Icon</label>
                        <input 
                          required 
                          type="text" 
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2.5 font-bold bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-center text-lg shadow-inner" 
                          value={voucher.icon} 
                          onChange={(e) => {
                            const newVouchers = [...formData.vouchers];
                            newVouchers[idx].icon = e.target.value;
                            setFormData({...formData, vouchers: newVouchers});
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* STEP 3: Location */}
          {currentStep === 3 && (
          <div className="bg-white/50 dark:bg-slate-800/50 p-5 sm:p-7 rounded-3xl border border-white/80 dark:border-slate-700/70 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 backdrop-blur-md shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 border-b border-slate-200/80 dark:border-slate-700 pb-3 gap-2">
              <h2 className="text-base sm:text-lg font-black text-[#1d3539] dark:text-white uppercase flex items-center gap-2">
                <MapPin size={20} className="text-emerald-500"/> Store Location
              </h2>
              <button 
                type="button" 
                onClick={handleUseCurrentLocation} 
                className="text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-4 py-2 rounded-xl shadow-md active:scale-95 transition-all"
              >
                {isLocating ? 'Locating...' : '📍 Use My Location'}
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search a place or address..." 
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 font-bold text-sm bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white focus:border-emerald-500 transition-colors outline-none shadow-inner" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)} 
                />
              </div>
              <button 
                type="button" 
                onClick={handleSearch} 
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-2xl font-bold hover:bg-emerald-500 transition-colors active:scale-95 shadow-md text-sm flex items-center justify-center gap-1.5"
              >
                <Search size={16}/> Search
              </button>
            </div>

            <div className="w-full h-72 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-md">
              <Map
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                mapStyle="mapbox://styles/mapbox/outdoors-v12"
                mapboxAccessToken={MAPBOX_TOKEN}
                onClick={(e) => setFormData({...formData, location: [e.lngLat.lng, e.lngLat.lat]})}
              >
                <Marker longitude={formData.location[0]} latitude={formData.location[1]} anchor="bottom" draggable onDragEnd={(e) => setFormData({...formData, location: [e.lngLat.lng, e.lngLat.lat]})}>
                  <div className="text-4xl -translate-y-1/2 hover:scale-110 cursor-grab active:cursor-grabbing transition-transform drop-shadow-md">📍</div>
                </Marker>
              </Map>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center">Drag the pin or click on the map to fine-tune your store location.</p>
          </div>
          )}
          
          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-700">
            {currentStep > 1 && (
              <button 
                type="button" 
                onClick={() => setCurrentStep(prev => prev - 1)} 
                className="flex-1 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all text-sm"
              >
                Back
              </button>
            )}
            
            {currentStep < 3 ? (
              <button 
                type="button" 
                onClick={() => {
                  if (currentStep === 1 && !formData.storeName) {
                    setError('Please fill in your Store Name.');
                    return;
                  }
                  if (currentStep === 2 && (!formData.vouchers[0] || !formData.vouchers[0].name)) {
                    setError('Please fill in your Voucher Name.');
                    return;
                  }
                  setError('');
                  setCurrentStep(prev => {
                    if (prev === 2) setStep3EnteredAt(Date.now());
                    return prev + 1;
                  });
                }} 
                className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all text-sm tracking-wide flex items-center justify-center gap-2"
              >
                Next Step <ArrowRight size={16} />
              </button>
            ) : (
              <button 
                type="submit" 
                className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all text-sm uppercase tracking-wide flex items-center justify-center gap-2"
              >
                Submit Application <CheckCircle size={18} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
