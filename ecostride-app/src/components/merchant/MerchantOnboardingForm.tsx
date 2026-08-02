import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../stores/useAuthStore';
import Map, { Marker } from 'react-map-gl/mapbox';
import { MAPBOX_TOKEN } from '../../lib/mapboxAPI';
import { Store, Tag, MapPin, CheckCircle, Search, DollarSign } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';

export const MerchantOnboardingForm: React.FC = () => {
  const { user } = useAuthStore();
  const { username } = useUserStore();
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

  const handleUseCurrentLocation = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        setFormData(prev => ({ ...prev, location: [lng, lat] }));
        setViewState(prev => ({ ...prev, longitude: lng, latitude: lat }));
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
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
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white p-12 rounded-3xl border-4 border-[#1d3539] shadow-[8px_8px_0px_0px_#1d3539] max-w-lg w-[calc(100%-8px)] sm:w-full animate-in zoom-in duration-500">
          <CheckCircle size={80} className="text-[#5496a2] mx-auto mb-6" />
          <h1 className="text-4xl font-black text-[#1d3539] mb-4 uppercase tracking-tight">Application Submitted!</h1>
          <p className="text-lg font-bold text-slate-600">
            Your merchant application is under review by the Platform Admin. 
            You will be notified once you are approved to appear on the EcoStride Map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-8 overflow-y-auto h-full overflow-x-hidden">
      <div className="max-w-3xl mx-auto w-[calc(100%-4px)] sm:w-full bg-white rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-[#1d3539] shadow-[4px_4px_0px_0px_#1d3539] sm:shadow-[8px_8px_0px_0px_#1d3539] p-4 sm:p-6 md:p-10 mb-20">
        
        <div className="flex items-center gap-4 mb-2">
          <div className="bg-[#e9efce] p-3 rounded-2xl border-2 border-[#1d3539]">
            <Store size={32} className="text-[#1d3539]" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-[#1d3539] uppercase tracking-tight">Merchant Onboarding</h1>
            <p className="text-[#5496a2] font-bold text-sm md:text-base">Join EcoStride and drive green foot traffic to your store.</p>
          </div>
        </div>
        
        {error && <div className="mt-6 bg-red-100 p-4 rounded-2xl border-2 border-red-200 text-red-700 font-bold flex items-center gap-2 animate-in slide-in-from-top-2"><CheckCircle className="rotate-45" /> {error}</div>}

        <div className="flex justify-between items-center mt-8 mb-6 px-2 sm:px-12 relative">
          <div className="absolute left-10 right-10 top-5 h-0.5 bg-slate-200 -z-10"></div>
          {[1, 2, 3].map(step => (
            <div key={step} className="flex flex-col items-center bg-white">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black border-2 border-[#1d3539] transition-all duration-300 ${currentStep >= step ? 'bg-[#5496a2] text-white shadow-[2px_2px_0px_0px_#1d3539]' : 'bg-slate-100 text-slate-400'}`}>
                {step}
              </div>
              <span className={`text-[10px] mt-2 font-bold uppercase tracking-wider transition-colors duration-300 ${currentStep >= step ? 'text-[#1d3539]' : 'text-slate-400'}`}>
                {step === 1 ? 'Basic Info' : step === 2 ? 'Vouchers' : 'Location'}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {currentStep === 1 && (
          <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-slate-200 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg sm:text-xl font-black text-[#1d3539] uppercase flex items-center gap-2 mb-4 border-b-2 border-slate-200 pb-2"><Store size={20}/> Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-sm mb-1 text-slate-700">Store Name</label>
                <input required type="text" placeholder="e.g. Green Cafe" className="w-full border-2 border-[#1d3539] rounded-xl px-4 py-3 font-bold bg-white focus:ring-4 focus:ring-[#5496a2]/20 transition-all outline-none" value={formData.storeName} onChange={(e) => setFormData({...formData, storeName: e.target.value})} />
              </div>
              <div>
                <label className="block font-bold text-sm mb-1 text-slate-700">Store Category</label>
                <select className="w-full border-2 border-[#1d3539] rounded-xl px-4 py-3 font-bold bg-white focus:ring-4 focus:ring-[#5496a2]/20 transition-all outline-none appearance-none" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                  <option>Food & Beverage</option>
                  <option>Retail</option>
                  <option>Services</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block font-bold text-sm mb-1 text-slate-700">Menu / Services Link</label>
                <input type="url" placeholder="https://..." className="w-full border-2 border-[#1d3539] rounded-xl px-4 py-3 font-bold bg-white focus:ring-4 focus:ring-[#5496a2]/20 transition-all outline-none" value={formData.menuLink} onChange={(e) => setFormData({...formData, menuLink: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="block font-bold text-sm mb-1 text-[#1d3539] flex items-center gap-1"><DollarSign size={16}/> Subscription Plan</label>
                <select className="w-full border-2 border-[#1d3539] rounded-xl px-4 py-3 font-bold bg-white focus:ring-4 focus:ring-[#5496a2]/20 transition-all outline-none appearance-none" value={formData.subscriptionPlan} onChange={(e) => setFormData({...formData, subscriptionPlan: e.target.value})}>
                  <option>RM100/month</option>
                  <option>RM1000/year (Save RM200)</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {currentStep === 2 && (
          <div className="bg-[#e9efce]/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-[#e9efce] space-y-4 relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Tag size={100} /></div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 relative z-10 gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#1d3539] uppercase flex items-center gap-2"><Tag size={20}/> Point Store Vouchers</h2>
                <p className="text-xs sm:text-sm font-bold text-[#5496a2]">Create up to 5 vouchers for users to redeem.</p>
              </div>
              {formData.vouchers.length < 5 && (
                <button type="button" onClick={handleAddVoucher} className="bg-[#1d3539] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#2c5258] transition-colors active:scale-95 text-sm shrink-0">
                  + Add Voucher
                </button>
              )}
            </div>
            
            <div className="space-y-4 relative z-10">
              {formData.vouchers.map((voucher, idx) => (
                <div key={idx} className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-[#1d3539] space-y-4 shadow-sm relative">
                  {formData.vouchers.length > 1 && (
                    <button type="button" onClick={() => handleRemoveVoucher(idx)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 font-bold text-sm bg-slate-100 px-2 py-1 rounded-lg">Remove</button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block font-bold text-sm mb-1 text-slate-700">Voucher Name</label>
                      <input required type="text" placeholder="e.g. Free Coffee" className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-bold bg-slate-50 focus:bg-white focus:border-[#5496a2] transition-all outline-none" value={voucher.name} onChange={(e) => {
                        const newVouchers = [...formData.vouchers];
                        newVouchers[idx].name = e.target.value;
                        setFormData({...formData, vouchers: newVouchers});
                      }} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block font-bold text-sm mb-1 text-slate-700">Description</label>
                      <input required type="text" placeholder="e.g. Valid for all regular sized coffees" className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-bold bg-slate-50 focus:bg-white focus:border-[#5496a2] transition-all outline-none" value={voucher.desc} onChange={(e) => {
                        const newVouchers = [...formData.vouchers];
                        newVouchers[idx].desc = e.target.value;
                        setFormData({...formData, vouchers: newVouchers});
                      }} />
                    </div>
                    <div>
                      <label className="block font-bold text-sm mb-1 text-slate-700">Price (Coins)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2">🪙</span>
                        <input required type="number" className="w-full border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 font-bold bg-slate-50 focus:bg-white focus:border-[#5496a2] transition-all outline-none" value={voucher.price} onChange={(e) => {
                          const newVouchers = [...formData.vouchers];
                          newVouchers[idx].price = Number(e.target.value);
                          setFormData({...formData, vouchers: newVouchers});
                        }} />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block font-bold text-sm mb-1 text-slate-700">Stock</label>
                        <input required type="number" className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-bold bg-slate-50 focus:bg-white focus:border-[#5496a2] transition-all outline-none" value={voucher.stock} onChange={(e) => {
                          const newVouchers = [...formData.vouchers];
                          newVouchers[idx].stock = Number(e.target.value);
                          setFormData({...formData, vouchers: newVouchers});
                        }} />
                      </div>
                      <div className="w-24">
                        <label className="block font-bold text-sm mb-1 text-slate-700 text-center">Icon</label>
                        <input required type="text" className="w-full border-2 border-slate-200 rounded-xl px-2 py-3 font-bold bg-slate-50 focus:bg-white focus:border-[#5496a2] transition-all outline-none text-center text-xl" value={voucher.icon} onChange={(e) => {
                          const newVouchers = [...formData.vouchers];
                          newVouchers[idx].icon = e.target.value;
                          setFormData({...formData, vouchers: newVouchers});
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {currentStep === 3 && (
          <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-slate-200 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 border-b-2 border-slate-200 pb-2 gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#1d3539] uppercase flex items-center gap-2"><MapPin size={20}/> Store Location</h2>
              <button type="button" onClick={handleUseCurrentLocation} className="text-xs font-bold text-white bg-[#5496a2] px-4 py-2 rounded-xl shadow-sm hover:bg-[#1d3539] active:scale-95 transition-all">
                {isLocating ? 'Locating...' : '📍 Use My Location'}
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search a place or address..." className="w-full border-2 border-slate-300 rounded-xl pl-10 pr-4 py-3 font-bold text-sm bg-white focus:border-[#5496a2] transition-colors outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as any)} />
              </div>
              <button type="button" onClick={handleSearch} className="bg-[#1d3539] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#2c5258] transition-colors active:scale-95">Search</button>
            </div>

            <div className="w-full h-72 rounded-2xl border-4 border-[#1d3539] overflow-hidden relative shadow-inner">
              <Map
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                mapStyle="mapbox://styles/mapbox/outdoors-v12"
                mapboxAccessToken={MAPBOX_TOKEN}
                onClick={(e) => setFormData({...formData, location: [e.lngLat.lng, e.lngLat.lat]})}
              >
                <Marker longitude={formData.location[0]} latitude={formData.location[1]} anchor="bottom" draggable onDragEnd={(e) => setFormData({...formData, location: [e.lngLat.lng, e.lngLat.lat]})}>
                  <div className="text-5xl hover:scale-110 cursor-grab active:cursor-grabbing transition-transform drop-shadow-md">📍</div>
                </Marker>
              </Map>
            </div>
            <p className="text-sm font-bold text-slate-500 mt-2 text-center">Drag the pin or click on the map to fine-tune your location.</p>
          </div>
          )}
          
          <div className="flex gap-4 pt-4 mt-8 border-t-2 border-slate-100">
            {currentStep > 1 && (
              <button type="button" onClick={() => setCurrentStep(prev => prev - 1)} className="flex-1 bg-white border-2 border-[#1d3539] py-4 rounded-2xl font-black text-lg text-[#1d3539] hover:bg-slate-50 active:translate-y-1 transition-all">
                Back
              </button>
            )}
            
            {currentStep < 3 ? (
              <button 
                type="button" 
                onClick={() => {
                  // Basic validation before next step
                  if (currentStep === 1 && !formData.storeName) {
                    setError('Please fill in your Store Name.');
                    return;
                  }
                  if (currentStep === 2 && (!formData.vouchers[0] || !formData.vouchers[0].name)) {
                    setError('Please fill in your Voucher Name.');
                    return;
                  }
                  setError('');
                  setCurrentStep(prev => prev + 1);
                }} 
                className="flex-[2] bg-[#1d3539] text-white py-4 rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_rgba(29,53,57,0.3)] active:translate-y-1 active:shadow-none transition-all"
              >
                Next Step
              </button>
            ) : (
              <button type="submit" className="flex-[2] bg-[#5496a2] text-white hover:bg-[#80abb1] border-2 border-[#1d3539] py-4 rounded-2xl font-black text-lg tracking-wide shadow-[4px_4px_0px_0px_#1d3539] active:translate-y-1 active:shadow-none transition-all uppercase flex items-center justify-center gap-2">
                Submit <CheckCircle size={20} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

