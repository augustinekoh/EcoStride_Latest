import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { 
  Store, Tag, Plus, Edit2, Trash2, Clock, AlertCircle, 
  ChevronLeft, ChevronDown, ShoppingBag, CheckCircle, XCircle, 
  Gift, DollarSign, MapPin, Search, ScanLine, ExternalLink, Sparkles 
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import Map, { Marker } from 'react-map-gl/mapbox';
import { MAPBOX_TOKEN } from '../../lib/mapboxAPI';
import { useUserStore } from '../../stores/useUserStore';
import { useAppRefresh } from '../../hooks/useAppRefresh';

export const MerchantDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { username } = useUserStore();
  const { setActiveView } = useDemoStore();
  
  const [ownedMerchants, setOwnedMerchants] = useState<any[]>([]);
  const [currentMerchantId, setCurrentMerchantId] = useState<string | null>(null);

  const [merchantData, setMerchantData] = useState<any>(null);
  const [latestApp, setLatestApp] = useState<any>(null);
  const [modificationApp, setModificationApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  
  // Modification Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editStep, setEditStep] = useState(1);
  const [editStoreName, setEditStoreName] = useState('');
  const [editMenuLink, setEditMenuLink] = useState('');
  const [editLocation, setEditLocation] = useState<[number, number] | null>(null);
  const [viewState, setViewState] = useState({ longitude: 103.6400, latitude: 1.5600, zoom: 14 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  
  const [vouchers, setVouchers] = useState<any[]>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<'store' | 'sales' | 'scanner'>('store');
  const [scanResult, setScanResult] = useState<{success: boolean, message: string} | null>(null);
  const [isScanning, setIsScanning] = useState(false);

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
      setEditLocation([lng, lat]);
      setViewState(prev => ({ ...prev, longitude: lng, latitude: lat }));
      setIsLocating(false);
    } catch (err) {
      console.error(err);
      alert('Could not get location. Please enable location services.');
      setIsLocating(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const proximity = `${viewState.longitude},${viewState.latitude}`;
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?proximity=${proximity}&country=MY&access_token=${MAPBOX_TOKEN}`);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        setEditLocation([lng, lat]);
        setViewState(prev => ({ ...prev, longitude: lng, latitude: lat }));
      } else {
        alert('Location not found. Please try a different search term or drag the pin.');
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const fetchData = async () => {
    if (!user) return;
    
    try {
      const res = await apiClient(`/merchants/dashboard/${user.uid}`);
      const validMerchants = res.merchants.filter((m: any) => m.status !== 'disabled');
      setOwnedMerchants(validMerchants);
      
      let selectedId = currentMerchantId;
      if (!selectedId && validMerchants.length > 0) {
         selectedId = validMerchants[0].id;
         setCurrentMerchantId(selectedId);
      }
      
      const apps = res.applications.filter((a: any) => a.owner_id === user.uid).sort((a: any, b: any) => b.created_at - a.created_at);
      
      if (selectedId) {
        const modApp = apps.find((a: any) => {
          if (a.type !== 'modification' || a.status !== 'pending') return false;
          try {
            const details = JSON.parse(a.details);
            return !details.merchantId || details.merchantId === selectedId;
          } catch(e) {
            return true;
          }
        });
        setModificationApp(modApp || null);

        const mData = validMerchants.find((m: any) => m.id === selectedId);
        if (mData) {
          let loc = null;
          try { loc = mData.location ? JSON.parse(mData.location) : null; } catch(e){}
          const mapped = { id: mData.id, storeName: mData.store_name, menuLink: mData.menu_link, status: mData.status, location: loc };
          setMerchantData(mapped);
          setEditStoreName(mapped.storeName || '');
          setEditMenuLink(mapped.menuLink || '');
          setEditLocation(mapped.location);

          if (loc) {
            setViewState(prev => ({ ...prev, longitude: loc[0], latitude: loc[1] }));
          }

          const storeRes = await apiClient(`/merchants/${selectedId}/store`);
          const items = (storeRes.storeItems || []).filter((i: any) => i.status !== 'disabled');
          setStoreItems(items);
          setVouchers(items.map((i:any) => ({ originalId: i.id, name: i.name, desc: i.desc, price: i.price, stock: i.stock, icon: i.icon })));

          const salesRes = await apiClient(`/merchants/${selectedId}/sales`);
          setSales(salesRes.purchases || []);
        }
      } else {
        const latest = apps[0];
        setLatestApp(latest || null);
        setMerchantData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useAppRefresh(fetchData);

  useEffect(() => {
    if (currentMerchantId && !loading) {
      setLoading(true);
      fetchData();
    }
  }, [currentMerchantId]);

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSubmitModification = async () => {
    if (!user || !merchantData) return;
    try {
      await apiClient('/applications', {
        method: 'POST',
        body: JSON.stringify({
          ownerId: user.uid,
          type: 'modification',
          details: JSON.stringify({
            merchantId: currentMerchantId,
            username: username || user.email?.split('@')[0] || 'Unknown',
            uid: user.uid,
            storeName: editStoreName,
            menuLink: editMenuLink,
            location: editLocation,
            vouchers: vouchers
          })
        })
      });
      alert('Modification submitted for admin approval!');
      setIsEditing(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to submit modification.');
    }
  };

  const handleRedeem = async (purchaseId: string) => {
    if (!window.confirm('Mark this voucher as redeemed? This means the user has collected their item in-store.')) return;
    try {
      await apiClient(`/merchants/redeem/${purchaseId}`, {
        method: 'POST',
        body: JSON.stringify({ merchantId: currentMerchantId })
      });
      alert('Voucher redeemed successfully!');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to redeem voucher.');
    }
  };

  const handleScan = async (result: string) => {
    if (isScanning) return;
    const rawId = (result || '').trim();
    if (!rawId) return;
    setIsScanning(true);
    try {
      const res = await apiClient('/merchants/scan', {
        method: 'POST',
        body: JSON.stringify({
          purchaseId: rawId,
          merchantId: currentMerchantId
        })
      });
      setScanResult({ success: true, message: res.message || 'Voucher redeemed successfully!' });
      fetchData();
    } catch (e: any) {
      setScanResult({ success: false, message: e.message || 'Failed to redeem voucher' });
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setScanResult(null);
      }, 3500);
    }
  };

  const handleAddVoucher = () => {
    setVouchers([...vouchers, {
      id: Date.now().toString(),
      name: 'New Voucher',
      desc: '',
      price: 100,
      stock: 50,
      icon: '🎟️',
      category: 'Vouchers',
      profileShow: true
    }]);
  };

  const handleRemoveVoucher = (idx: number) => {
    const newV = [...vouchers];
    newV.splice(idx, 1);
    setVouchers(newV);
  };

  const updateVoucher = (idx: number, field: string, value: any) => {
    const newV = [...vouchers];
    newV[idx] = { ...newV[idx], [field]: value };
    setVouchers(newV);
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF6D8]/30 via-transparent to-[#B3DAB6]/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-bold text-sm text-[#1d3539] dark:text-emerald-300 animate-pulse">Loading Merchant Hub...</p>
      </div>
    );
  }

  if (!merchantData && !latestApp) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF6D8]/40 via-[#faf9f6]/80 to-[#CCE3C5]/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-8 text-center">
        <div className="glass-card backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/80 dark:border-slate-800 p-8 sm:p-12 rounded-3xl shadow-2xl max-w-lg w-full">
          <div className="w-20 h-20 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-inner">
            <Store size={40} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1d3539] dark:text-white mb-3 uppercase tracking-tight">No Merchant Account</h2>
          <p className="text-slate-600 dark:text-slate-300 font-bold mb-8 text-base">You haven't applied to be a merchant yet.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => setActiveView('profile')} 
              className="flex-1 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-black px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-all text-sm"
            >
              Back
            </button>
            <button 
              onClick={() => setActiveView('merchant_onboarding')} 
              className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-6 py-3.5 rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all uppercase text-sm flex items-center justify-center gap-2"
            >
              Apply Now <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!merchantData && latestApp) {
    return (
      <div className="w-full h-full flex flex-col p-4 sm:p-8 pt-8 md:pt-12 bg-gradient-to-br from-[#FFF6D8]/40 via-[#faf9f6]/80 to-[#CCE3C5]/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-y-auto">
        <button 
          onClick={() => setActiveView('landing')} 
          className="flex items-center gap-2 text-[#1d3539] dark:text-emerald-300 font-bold mb-6 hover:bg-white/50 dark:hover:bg-slate-800/50 px-4 py-2 rounded-2xl transition-colors w-fit backdrop-blur-md border border-white/60 dark:border-slate-700/60"
        >
          <ChevronLeft size={20} /> Back to Home
        </button>
        
        <div className="max-w-2xl mx-auto w-full glass-card backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 rounded-3xl border border-white/80 dark:border-slate-800 p-6 sm:p-10 text-center animate-in zoom-in-95 duration-500 shadow-2xl">
          {latestApp.status === 'pending' ? (
            <>
              <div className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 p-6 rounded-3xl w-24 h-24 flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Clock size={48} className="text-amber-500 animate-pulse" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1d3539] dark:text-white mb-3 uppercase tracking-tight">Application Under Review</h2>
              <p className="text-slate-600 dark:text-slate-300 font-bold text-base leading-relaxed mb-6">
                Your application for <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">{latestApp.storeName}</span> is currently being reviewed by platform admins.
              </p>
            </>
          ) : latestApp.status === 'rejected' ? (
            <>
              <div className="bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/20 p-6 rounded-3xl w-24 h-24 flex items-center justify-center mx-auto mb-6 shadow-inner">
                <AlertCircle size={48} className="text-rose-500" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1d3539] dark:text-white mb-3 uppercase tracking-tight">Application Rejected</h2>
              <div className="bg-rose-500/10 dark:bg-rose-500/15 p-5 rounded-2xl border border-rose-500/20 mb-8 text-left backdrop-blur-md">
                <p className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">Reason for Rejection</p>
                <p className="text-slate-800 dark:text-slate-200 font-bold text-base">{latestApp.rejectReason || 'No specific reason provided.'}</p>
              </div>
              <button 
                onClick={() => setActiveView('merchant_onboarding')} 
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-8 py-3.5 rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all uppercase text-sm"
              >
                Re-apply
              </button>
            </>
          ) : latestApp.status === 'approved' ? (
            <>
              <div className="bg-slate-500/10 dark:bg-slate-500/20 border border-slate-500/20 p-6 rounded-3xl w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <Store size={48} className="text-slate-500 dark:text-slate-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1d3539] dark:text-white mb-3 uppercase tracking-tight">Shop Inactive</h2>
              <p className="text-slate-600 dark:text-slate-300 font-bold mb-8 text-base">Your previous shop was taken down. You can submit a new application to become a merchant again.</p>
              <button 
                onClick={() => setActiveView('merchant_onboarding')} 
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-8 py-3.5 rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all uppercase text-sm"
              >
                Apply Now
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  const handleTakeDownShop = async () => {
    if (!merchantData || !merchantData.id) return;
    const confirm = window.confirm("Are you sure you want to take down your shop? This will delete your shop and all live vouchers immediately. This action cannot be undone.");
    if (!confirm) return;
    try {
      await apiClient(`/merchants/${merchantData.id}`, { method: 'DELETE' });
      alert('Shop taken down successfully.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to take down shop.');
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-[#FFF6D8]/30 via-[#faf9f6]/60 to-[#CCE3C5]/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-3 sm:p-6 md:p-8 pt-4 sm:pt-6 md:pt-8 flex flex-col gap-5 overflow-y-auto custom-scrollbar transition-colors duration-500">
      
      {/* Top Frosted Glass Header */}
      <div className="glass-card backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/80 dark:border-slate-800/80 p-4 sm:p-6 rounded-3xl shadow-xl shadow-teal-900/5 dark:shadow-black/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setActiveView('profile')} 
            className="p-2.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-[#1d3539] dark:text-emerald-400 border border-white/90 dark:border-slate-700 shadow-sm transition-all active:scale-95 flex items-center justify-center shrink-0"
            title="Back to Profile"
          >
            <ChevronLeft size={22} />
          </button>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/30 dark:to-teal-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <Store size={18} />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1d3539] dark:text-white uppercase tracking-tight">
                Merchant Hub
              </h1>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {ownedMerchants.length > 1 ? (
                <div className="relative">
                  <select 
                    value={currentMerchantId || ''} 
                    onChange={(e) => setCurrentMerchantId(e.target.value)}
                    className="bg-white/80 dark:bg-slate-800/80 border border-emerald-500/30 dark:border-slate-700 text-xs sm:text-sm font-bold text-[#1d3539] dark:text-emerald-300 rounded-xl pl-3 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm backdrop-blur-md appearance-none cursor-pointer"
                  >
                    {ownedMerchants.map((m: any) => (
                      <option key={m.id} value={m.id} className="dark:bg-slate-800 dark:text-white">{m.store_name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500 dark:text-slate-400">
                    <ChevronDown size={14} />
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm font-bold text-[#5496a2] dark:text-emerald-400/80 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {merchantData?.storeName || 'Manage your store and track sales'}
                </p>
              )}
              <button 
                onClick={() => setActiveView('merchant_onboarding')}
                className="p-1 sm:p-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-md shadow-emerald-900/10 active:scale-95 transition-all flex items-center gap-1 text-xs font-bold px-2 sm:px-2.5"
                title="Create New Store"
              >
                <Plus size={14} />
                <span className="inline">New Store</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1.5 bg-slate-200/50 dark:bg-slate-800/60 rounded-2xl border border-white/60 dark:border-slate-700/60 backdrop-blur-md w-full md:w-auto shadow-inner">
          <button 
            onClick={() => setActiveTab('store')} 
            className={`flex-1 md:flex-none px-3 sm:px-5 py-2 rounded-xl font-black transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5 ${activeTab === 'store' ? 'bg-white dark:bg-slate-700 text-[#1d3539] dark:text-emerald-300 shadow-md border border-white/80 dark:border-slate-600' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Store size={15}/> Store
          </button>
          <button 
            onClick={() => setActiveTab('sales')} 
            className={`flex-1 md:flex-none px-3 sm:px-5 py-2 rounded-xl font-black transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5 ${activeTab === 'sales' ? 'bg-white dark:bg-slate-700 text-[#1d3539] dark:text-emerald-300 shadow-md border border-white/80 dark:border-slate-600' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <ShoppingBag size={15}/> Sales
          </button>
          <button 
            onClick={() => setActiveTab('scanner')} 
            className={`flex-1 md:flex-none px-3 sm:px-5 py-2 rounded-xl font-black transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5 ${activeTab === 'scanner' ? 'bg-white dark:bg-slate-700 text-[#1d3539] dark:text-emerald-300 shadow-md border border-white/80 dark:border-slate-600' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <ScanLine size={15}/> Scan
          </button>
        </div>
      </div>

      {/* Modification Pending Alert */}
      {modificationApp && (
        <div className="glass-card bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 p-4 sm:p-5 rounded-2xl flex items-start gap-3.5 backdrop-blur-md shadow-sm animate-in slide-in-from-top-4">
          <Clock className="text-amber-500 shrink-0 mt-0.5" size={22}/>
          <div>
            <p className="font-black text-amber-900 dark:text-amber-300 text-base uppercase tracking-tight">Modification Pending Approval</p>
            <p className="text-amber-800/90 dark:text-amber-200/80 font-bold text-sm mt-0.5 leading-relaxed">
              Your recent store modification is currently being reviewed by admins. You will see the changes once approved.
            </p>
          </div>
        </div>
      )}

      {/* Main Frosted Content Card */}
      <div className="glass-card backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/80 dark:border-slate-800/80 p-5 sm:p-8 md:p-10 rounded-3xl shadow-xl shadow-teal-900/5 dark:shadow-black/40 mb-8 md:mb-24">
        
        {/* ================= STORE TAB ================= */}
        {activeTab === 'store' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-slate-200/70 dark:border-slate-800 pb-5">
              <h2 className="text-xl sm:text-2xl font-black text-[#1d3539] dark:text-white flex items-center gap-2.5">
                <Store className="text-emerald-600 dark:text-emerald-400" size={24}/> {isEditing ? 'Edit Store' : 'Store Details'}
              </h2>
              {!isEditing && (
                <div className="flex gap-2.5 w-full sm:w-auto">
                  <button 
                    onClick={handleTakeDownShop} 
                    className="flex-1 sm:flex-none items-center justify-center gap-2 bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold px-4 py-2.5 rounded-2xl border border-rose-500/20 hover:bg-rose-500/20 transition-all active:scale-95 text-xs sm:text-sm backdrop-blur-md"
                  >
                    Take Down Shop
                  </button>
                  <button 
                    onClick={() => { setIsEditing(true); setEditStep(1); }} 
                    className="flex-1 sm:flex-none items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-5 py-2.5 rounded-2xl shadow-md shadow-emerald-900/15 active:scale-95 transition-all text-xs sm:text-sm flex"
                  >
                    <Edit2 size={16} /> Edit Store
                  </button>
                </div>
              )}
            </div>

            {!isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div className="bg-white/50 dark:bg-slate-800/50 border border-white/80 dark:border-slate-700/70 rounded-2xl p-5 backdrop-blur-md shadow-sm">
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Store Name</p>
                    <p className="text-xl sm:text-2xl font-black text-[#1d3539] dark:text-white">{merchantData.storeName}</p>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-800/50 border border-white/80 dark:border-slate-700/70 rounded-2xl p-5 backdrop-blur-md shadow-sm">
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Menu / Services Link</p>
                    <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 break-all flex items-center gap-2">
                      {merchantData.menuLink ? (
                        <a href={merchantData.menuLink} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1.5">
                          {merchantData.menuLink} <ExternalLink size={14} className="shrink-0"/>
                        </a>
                      ) : (
                        <span className="text-slate-400">None provided</span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-black text-[#1d3539] dark:text-emerald-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Tag size={16} className="text-emerald-500"/> Live Point Store Vouchers
                  </p>
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                    {storeItems.length === 0 ? (
                      <div className="bg-white/40 dark:bg-slate-800/40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center text-slate-400 font-bold backdrop-blur-sm">
                        No vouchers currently live. Edit store to add some!
                      </div>
                    ) : storeItems.map(item => (
                      <div key={item.id} className="bg-white/60 dark:bg-slate-800/60 border border-white/80 dark:border-slate-700/70 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all shadow-sm backdrop-blur-md">
                        <div className="flex items-center gap-3.5">
                          <span className="text-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-slate-700 dark:to-slate-800 w-14 h-14 flex items-center justify-center rounded-2xl border border-white/80 dark:border-slate-600 shadow-inner">
                            {item.icon}
                          </span>
                          <div>
                            <p className="text-base font-black text-[#1d3539] dark:text-white">{item.name}</p>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                          </div>
                        </div>
                        <div className="sm:text-right bg-white/80 dark:bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-white/90 dark:border-slate-700/80 w-full sm:w-auto flex justify-between sm:block shadow-sm">
                          <p className="font-black text-amber-500 dark:text-amber-400 text-base flex items-center justify-end gap-1">
                            <Sparkles size={14}/> {item.price}
                          </p>
                          <p className={`text-[10px] font-black uppercase mt-0.5 ${item.stock > 10 ? 'text-emerald-500' : 'text-rose-500'}`}>Stock: {item.stock}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Stepper Header */}
                <div className="flex justify-between items-center mb-6 px-4 sm:px-16 relative">
                  <div className="absolute left-12 right-12 top-5 h-0.5 bg-slate-200/80 dark:bg-slate-700/80 -z-10"></div>
                  {[1, 2, 3].map(step => (
                    <div key={step} className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black border transition-all duration-300 shadow-sm ${editStep >= step ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-white/60 shadow-emerald-900/20' : 'bg-white/80 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                        {step}
                      </div>
                      <span className={`text-[10px] mt-2 font-black uppercase tracking-wider transition-colors duration-300 ${editStep >= step ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                        {step === 1 ? 'Basic Info' : step === 2 ? 'Location' : 'Vouchers'}
                      </span>
                    </div>
                  ))}
                </div>

                {editStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in slide-in-from-right-4 duration-300 bg-white/50 dark:bg-slate-800/50 p-6 rounded-3xl border border-white/80 dark:border-slate-700/70 backdrop-blur-md shadow-sm">
                  <div className="md:col-span-2 border-b border-slate-200/80 dark:border-slate-700 pb-2 mb-1">
                    <h3 className="font-black text-[#1d3539] dark:text-white text-lg uppercase flex items-center gap-2">
                      <Store size={20} className="text-emerald-500"/> Basic Information
                    </h3>
                  </div>
                  <div>
                    <label className="block font-black text-xs mb-2 text-[#1d3539] dark:text-slate-200 uppercase tracking-wider">Store Name</label>
                    <input 
                      type="text" 
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 font-bold bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none backdrop-blur-md transition-all shadow-inner" 
                      value={editStoreName} 
                      onChange={e => setEditStoreName(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block font-black text-xs mb-2 text-[#1d3539] dark:text-slate-200 uppercase tracking-wider">Menu / Services Link</label>
                    <input 
                      type="text" 
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 font-bold bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none backdrop-blur-md transition-all shadow-inner" 
                      value={editMenuLink} 
                      onChange={e => setEditMenuLink(e.target.value)} 
                    />
                  </div>
                </div>
                )}

                {editStep === 2 && (
                <div className="bg-white/50 dark:bg-slate-800/50 p-6 rounded-3xl border border-white/80 dark:border-slate-700/70 backdrop-blur-md shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="font-black text-[#1d3539] dark:text-white text-lg uppercase flex items-center gap-2 mb-4 border-b border-slate-200/80 dark:border-slate-700 pb-2">
                    <MapPin size={20} className="text-emerald-500"/> Edit Location
                  </h3>
                  <div className="space-y-4">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                      <input 
                        type="text" 
                        placeholder="Search location..." 
                        className="flex-1 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 font-bold bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:border-emerald-500 outline-none shadow-inner" 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                      />
                      <button 
                        type="submit" 
                        className="bg-emerald-600 text-white px-6 py-2.5 rounded-2xl font-bold hover:bg-emerald-500 transition-colors shadow-md flex items-center justify-center"
                      >
                        <Search size={18}/>
                      </button>
                    </form>

                    <button 
                      type="button" 
                      onClick={handleUseCurrentLocation} 
                      disabled={isLocating} 
                      className="w-full bg-white/80 dark:bg-slate-900/80 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold py-2.5 rounded-2xl hover:bg-emerald-500/10 transition-colors disabled:opacity-50 text-sm shadow-sm"
                    >
                      {isLocating ? 'Locating...' : 'Use My Current Location'}
                    </button>

                    <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md">
                      <Map
                        mapboxAccessToken={MAPBOX_TOKEN}
                        {...viewState}
                        onMove={evt => setViewState(evt.viewState)}
                        mapStyle="mapbox://styles/mapbox/streets-v12"
                        onClick={(e) => {
                          setEditLocation([e.lngLat.lng, e.lngLat.lat]);
                          setViewState({...viewState, longitude: e.lngLat.lng, latitude: e.lngLat.lat});
                        }}
                      >
                        {editLocation && (
                          <Marker longitude={editLocation[0]} latitude={editLocation[1]}>
                            <div className="text-4xl -translate-y-1/2 drop-shadow-md cursor-pointer">📍</div>
                          </Marker>
                        )}
                      </Map>
                    </div>
                  </div>
                </div>
                )}

                {editStep === 3 && (
                <div className="bg-white/50 dark:bg-slate-800/50 p-4 sm:p-6 rounded-3xl border border-white/80 dark:border-slate-700/70 backdrop-blur-md shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200/80 dark:border-slate-700 pb-4">
                    <h3 className="font-black text-[#1d3539] dark:text-white text-lg uppercase flex items-center gap-2">
                      <Tag size={20} className="text-emerald-500"/> Vouchers
                    </h3>
                    <button 
                      onClick={handleAddVoucher} 
                      className="flex items-center justify-center gap-2 font-black bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-2xl shadow-md active:scale-95 transition-all w-full sm:w-auto text-xs uppercase"
                    >
                      <Plus size={16} /> Add Voucher
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {vouchers.map((v, idx) => (
                      <div key={idx} className="bg-white/70 dark:bg-slate-900/70 p-5 rounded-2xl border border-white/90 dark:border-slate-700/80 shadow-sm relative backdrop-blur-md">
                        <button 
                          onClick={() => handleRemoveVoucher(idx)} 
                          className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-800 p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">Name</label>
                            <input 
                              type="text" 
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-bold bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm" 
                              value={v.name} 
                              onChange={e => updateVoucher(idx, 'name', e.target.value)} 
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">Description</label>
                            <input 
                              type="text" 
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-bold bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm" 
                              value={v.desc || v.description} 
                              onChange={e => updateVoucher(idx, 'desc', e.target.value)} 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">Price (Coins)</label>
                            <input 
                              type="number" 
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-bold bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm" 
                              value={v.price} 
                              onChange={e => updateVoucher(idx, 'price', Number(e.target.value))} 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">Stock</label>
                            <input 
                              type="number" 
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-bold bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm" 
                              value={v.stock} 
                              onChange={e => updateVoucher(idx, 'stock', Number(e.target.value))} 
                            />
                          </div>
                          <div className="sm:col-span-2 md:col-span-1">
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">Icon Emoji</label>
                            <input 
                              type="text" 
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-bold bg-white/90 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-center text-lg" 
                              value={v.icon} 
                              onChange={e => updateVoucher(idx, 'icon', e.target.value)} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-700">
                  <button 
                    onClick={() => {
                      if (editStep === 1) setIsEditing(false);
                      else setEditStep(prev => prev - 1);
                    }} 
                    className="flex-1 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-all text-sm"
                  >
                    {editStep === 1 ? 'Cancel' : 'Back'}
                  </button>
                  
                  {editStep < 3 ? (
                    <button 
                      onClick={() => {
                        if (editStep === 1 && !editStoreName) return alert('Store Name is required');
                        setEditStep(prev => prev + 1);
                      }} 
                      className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all text-sm tracking-wide"
                    >
                      Next Step
                    </button>
                  ) : (
                    <button 
                      onClick={handleSubmitModification} 
                      className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all text-sm tracking-wide flex items-center justify-center gap-2"
                    >
                      Submit <CheckCircle size={18} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= SALES TAB ================= */}
        {activeTab === 'sales' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex justify-between items-center mb-8 border-b border-slate-200/80 dark:border-slate-800 pb-5">
              <h2 className="text-xl sm:text-2xl font-black text-[#1d3539] dark:text-white flex items-center gap-2.5">
                <ShoppingBag className="text-emerald-600 dark:text-emerald-400" size={24}/> Sales & Redemptions
              </h2>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
              <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/15 dark:to-teal-500/15 p-6 rounded-3xl border border-emerald-500/30 backdrop-blur-md shadow-sm">
                <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1">Total Sales</p>
                <p className="text-3xl sm:text-4xl font-black text-emerald-900 dark:text-emerald-200">
                  {sales.filter((s: any) => s.status !== 'disabled_by_admin').length}
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/15 dark:to-orange-500/15 p-6 rounded-3xl border border-amber-500/30 backdrop-blur-md shadow-sm">
                <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">Merchant Points</p>
                <p className="text-3xl sm:text-4xl font-black text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <Sparkles size={24} className="text-amber-500"/>{sales.filter((s: any) => s.status !== 'disabled_by_admin').reduce((acc, curr) => acc + curr.price, 0)}
                </p>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-300/70 font-bold mt-2 leading-tight">
                  *Points are for future merchant perks. Cannot be spent in the consumer store.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-sky-500/10 to-blue-500/10 dark:from-sky-500/15 dark:to-blue-500/15 p-6 rounded-3xl border border-sky-500/30 backdrop-blur-md shadow-sm">
                <p className="text-[11px] font-black text-sky-700 dark:text-sky-400 uppercase tracking-widest mb-1">Pending Redeem</p>
                <p className="text-3xl sm:text-4xl font-black text-sky-900 dark:text-sky-200">
                  {sales.filter(s => s.status === 'active').length}
                </p>
              </div>
            </div>

            {/* Sales Table / List */}
            <div className="space-y-3.5">
              <h3 className="font-black text-[#1d3539] dark:text-white text-lg uppercase tracking-tight mb-3">Transaction History</h3>
              {sales.length === 0 ? (
                <div className="bg-white/40 dark:bg-slate-800/40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center backdrop-blur-sm">
                  <Gift size={44} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-300 font-bold text-base">No sales yet.</p>
                  <p className="text-slate-400 text-xs mt-1">When customers purchase your vouchers, transactions will appear here.</p>
                </div>
              ) : sales.map((sale: any) => (
                <div key={sale.id} className="bg-white/60 dark:bg-slate-800/60 border border-white/80 dark:border-slate-700/70 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all shadow-sm backdrop-blur-md">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        sale.status === 'redeemed' 
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600' 
                          : sale.status === 'disabled_by_admin' 
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                      }`}>
                        {sale.status === 'redeemed' ? 'Redeemed' : sale.status === 'disabled_by_admin' ? 'Disabled' : 'Active'}
                      </span>
                      <p className="text-xs font-bold text-slate-400">{new Date(sale.purchased_at).toLocaleString()}</p>
                    </div>
                    <p className="text-lg font-black text-[#1d3539] dark:text-white">{sale.item_name}</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      Purchase ID: <span className="font-mono">{sale.id.split('-')[1] || sale.id}</span>
                    </p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      Buyer: {sale.buyerUsername || 'Unknown User'} <span className="font-mono text-slate-400 ml-1">({sale.buyerUid || sale.user_id})</span>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-5 w-full md:w-auto justify-between md:justify-end">
                    <p className="font-black text-amber-500 dark:text-amber-400 text-lg flex items-center gap-1">
                      <Sparkles size={16}/> {sale.price}
                    </p>
                    {sale.status === 'active' ? (
                      <button 
                        onClick={() => handleRedeem(sale.id)} 
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-5 py-2 rounded-xl transition-all active:scale-95 shadow-md text-xs flex items-center gap-1.5"
                      >
                        <CheckCircle size={15}/> Redeem
                      </button>
                    ) : sale.status === 'disabled_by_admin' ? (
                      <div className="px-4 py-1.5 bg-rose-500/10 text-rose-500 dark:text-rose-400 font-bold rounded-xl border border-rose-500/20 flex items-center gap-1.5 text-xs">
                        <XCircle size={14}/> Disabled
                      </div>
                    ) : (
                      <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300 font-bold rounded-xl border border-slate-200 dark:border-slate-600 flex items-center gap-1.5 text-xs">
                        <CheckCircle size={14} className="text-emerald-500"/> Done
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= SCANNER TAB ================= */}
        {activeTab === 'scanner' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex justify-between items-center mb-8 border-b border-slate-200/80 dark:border-slate-800 pb-5">
              <h2 className="text-xl sm:text-2xl font-black text-[#1d3539] dark:text-white flex items-center gap-2.5">
                <ScanLine className="text-emerald-600 dark:text-emerald-400" size={24}/> Scan Customer Voucher
              </h2>
            </div>
            
            <div className="max-w-md mx-auto w-full glass-card backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-3xl border border-white/80 dark:border-slate-700/70 shadow-xl overflow-hidden p-6 relative">
              <div className="mb-5 text-center">
                <p className="text-emerald-700 dark:text-emerald-300 font-black text-base">Scan customer QR code</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-0.5">Ensure the voucher belongs to <span className="font-bold text-slate-800 dark:text-white">{merchantData?.storeName}</span>.</p>
              </div>

              <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/30 aspect-square mb-4 bg-slate-950 shadow-inner">
                {!isScanning && (
                  <Scanner 
                    onScan={(result) => {
                      if (result && result[0]) {
                        handleScan(result[0].rawValue);
                      }
                    }}
                    components={{
                      finder: false
                    }}
                    styles={{
                      container: { width: '100%', height: '100%' }
                    }}
                  />
                )}
                
                {/* Scanner Overlay UI */}
                <div className="absolute inset-0 border-2 border-emerald-400/40 pointer-events-none z-10 m-8 rounded-2xl animate-pulse"></div>
                
                {scanResult && (
                  <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in ${scanResult.success ? 'bg-emerald-600/90' : 'bg-rose-600/90'} backdrop-blur-md`}>
                    {scanResult.success ? <CheckCircle size={56} className="text-white mb-3"/> : <XCircle size={56} className="text-white mb-3"/>}
                    <h3 className="text-xl font-black text-white mb-1">{scanResult.success ? 'Redemption Success!' : 'Invalid Voucher'}</h3>
                    <p className="text-white/90 text-sm font-bold">{scanResult.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
