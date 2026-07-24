import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { Store, Tag, Plus, Edit2, Trash2, Clock, AlertCircle, ChevronLeft, ShoppingBag, CheckCircle, XCircle, Gift, DollarSign, MapPin, Search } from 'lucide-react';
import Map, { Marker } from 'react-map-gl/mapbox';
import { MAPBOX_TOKEN } from '../../lib/mapboxAPI';

export const MerchantDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { setActiveView } = useDemoStore();
  
  const [merchantData, setMerchantData] = useState<any>(null);
  const [latestApp, setLatestApp] = useState<any>(null);
  const [modificationApp, setModificationApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  
  // Modification Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editStoreName, setEditStoreName] = useState('');
  const [editMenuLink, setEditMenuLink] = useState('');
  const [editLocation, setEditLocation] = useState<[number, number] | null>(null);
  const [viewState, setViewState] = useState({ longitude: 103.6400, latitude: 1.5600, zoom: 14 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  
  const [vouchers, setVouchers] = useState<any[]>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<'store' | 'sales'>('store');

  const handleUseCurrentLocation = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        setEditLocation([lng, lat]);
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
      const res = await apiClient('/admin/dashboard');
      const mData = res.merchants.find((m: any) => m.owner_id === user.uid);
      
      const apps = res.applications.filter((a: any) => a.owner_id === user.uid).sort((a: any, b: any) => b.created_at - a.created_at);
      const modApp = apps.find((a: any) => a.type === 'modification' && a.status === 'pending');
      setModificationApp(modApp || null);

      if (mData) {
        let loc = null;
        try { loc = mData.location ? JSON.parse(mData.location) : null; } catch(e){}
        const mapped = { id: mData.id, storeName: mData.store_name, menuLink: mData.menu_link, status: mData.status, location: loc };
        setMerchantData(mapped);
        setEditStoreName(mapped.storeName || '');
        setEditMenuLink(mapped.menuLink || '');
        setEditLocation(mapped.location);
        if (mapped.location) {
          setViewState(prev => ({ ...prev, longitude: mapped.location[0], latitude: mapped.location[1] }));
        }
        
        const items = res.storeItems.filter((i: any) => i.merchant_id === user.uid).map((i: any) => ({
          id: i.id, name: i.name, desc: i.desc, description: i.desc, price: i.price, stock: i.stock, icon: i.icon
        }));
        setStoreItems(items);
        setVouchers(items.map((i: any) => ({...i, originalId: i.id})));

        // Fetch sales
        const salesRes = await apiClient(`/merchants/sales/${user.uid}`);
        setSales(salesRes.purchases || []);

      } else {
        if (apps.length > 0) {
          const firstApp = apps[0];
          let storeName = 'Your Store';
          let rejectReason = '';
          try {
            const parsed = JSON.parse(firstApp.details);
            storeName = parsed.storeName || 'Your Store';
            rejectReason = parsed.rejectReason || '';
          } catch(e) {}
          setLatestApp({ id: firstApp.id, storeName: storeName, status: firstApp.status, rejectReason: rejectReason });
        }
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

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
            storeName: editStoreName,
            menuLink: editMenuLink,
            location: editLocation,
            vouchers: vouchers
          })
        })
      });
      alert('Modification submitted for admin approval!');
      setIsEditing(false);
      fetchData(); // Refresh to show pending modification
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
        body: JSON.stringify({ ownerId: user?.uid })
      });
      alert('Voucher redeemed successfully!');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to redeem voucher.');
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

  if (loading) return <div className="w-full h-full flex items-center justify-center bg-[#faf9f6]">Loading...</div>;

  if (!merchantData && !latestApp) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#faf9f6] to-[#e9efce] p-8 text-center">
        <div className="bg-white p-12 rounded-3xl border-4 border-[#1d3539] shadow-[8px_8px_0px_0px_#1d3539] max-w-lg">
          <Store size={80} className="text-[#1d3539] mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-black text-[#1d3539] mb-4 uppercase">No Merchant Account</h2>
          <p className="text-[#5496a2] font-bold mb-8 text-lg">You haven't applied to be a merchant yet.</p>
          <button onClick={() => setActiveView('merchant_onboarding')} className="bg-[#5496a2] text-white font-black px-8 py-4 rounded-2xl border-4 border-[#1d3539] shadow-[6px_6px_0px_0px_#1d3539] active:translate-y-1 active:translate-x-1 active:shadow-none hover:bg-[#1d3539] transition-all uppercase text-lg">Apply Now</button>
        </div>
      </div>
    );
  }

  if (!merchantData && latestApp) {
    return (
      <div className="w-full h-full flex flex-col p-8 pt-24 bg-gradient-to-br from-[#faf9f6] to-[#e9efce] overflow-y-auto">
        <button onClick={() => setActiveView('landing')} className="flex items-center gap-2 text-[#1d3539] font-bold mb-8 hover:bg-white/50 px-4 py-2 rounded-xl transition-colors w-fit"><ChevronLeft /> Back to Home</button>
        <div className="max-w-2xl mx-auto w-full bg-white rounded-3xl border-4 border-[#1d3539] shadow-[8px_8px_0px_0px_#1d3539] p-10 text-center animate-in zoom-in-95 duration-500">
          {latestApp.status === 'pending' ? (
            <>
              <div className="bg-orange-100 p-6 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-6">
                <Clock size={64} className="text-orange-500 animate-pulse" />
              </div>
              <h2 className="text-4xl font-black text-[#1d3539] mb-4 uppercase">Application Under Review</h2>
              <p className="text-slate-600 font-bold text-lg">Your application for <span className="text-[#5496a2] bg-[#5496a2]/10 px-2 py-1 rounded-md">{latestApp.storeName}</span> is currently being reviewed by the platform admins.</p>
            </>
          ) : latestApp.status === 'rejected' ? (
            <>
              <div className="bg-red-100 p-6 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={64} className="text-red-500" />
              </div>
              <h2 className="text-4xl font-black text-[#1d3539] mb-4 uppercase">Application Rejected</h2>
              <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-200 mb-8 text-left">
                <p className="text-sm font-black text-red-600 uppercase mb-2">Reason for Rejection</p>
                <p className="text-slate-800 font-bold text-lg">{latestApp.rejectReason || 'No specific reason provided.'}</p>
              </div>
              <button onClick={() => setActiveView('merchant_onboarding')} className="bg-[#5496a2] text-white font-black px-8 py-4 rounded-2xl border-4 border-[#1d3539] shadow-[6px_6px_0px_0px_#1d3539] active:translate-y-1 active:translate-x-1 active:shadow-none hover:bg-[#1d3539] transition-all uppercase">Re-apply</button>
            </>
          ) : latestApp.status === 'approved' ? (
            <>
              <div className="bg-slate-100 p-6 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-6">
                <Store size={64} className="text-slate-500" />
              </div>
              <h2 className="text-4xl font-black text-[#1d3539] mb-4 uppercase">Shop Inactive</h2>
              <p className="text-slate-600 font-bold mb-8 text-lg">Your previous shop was taken down. You can submit a new application to become a merchant again.</p>
              <button onClick={() => setActiveView('merchant_onboarding')} className="bg-[#5496a2] text-white font-black px-8 py-4 rounded-2xl border-4 border-[#1d3539] shadow-[6px_6px_0px_0px_#1d3539] active:translate-y-1 active:translate-x-1 active:shadow-none hover:bg-[#1d3539] transition-all uppercase">Apply Now</button>
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
      await apiClient(`/users/${user?.uid}`, { method: 'POST', body: JSON.stringify({ role: 'user' }) });
      alert('Shop taken down successfully.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to take down shop.');
    }
  };

  return (
    <div className="w-full h-full bg-[#faf9f6] p-4 md:p-8 pt-24 flex flex-col gap-6 overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border-4 border-[#1d3539] shadow-[6px_6px_0px_0px_#1d3539] gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-[#1d3539] uppercase tracking-tight flex items-center gap-3"><Store className="text-[#5496a2]" size={36}/> Merchant Hub</h1>
          <p className="text-[#5496a2] font-bold mt-1 text-lg">Manage your store and track sales</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={() => setActiveTab('store')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl border-2 border-[#1d3539] font-black transition-all ${activeTab === 'store' ? 'bg-[#1d3539] text-white' : 'bg-white text-[#1d3539] hover:bg-slate-50'}`}>Store</button>
          <button onClick={() => setActiveTab('sales')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl border-2 border-[#1d3539] font-black transition-all ${activeTab === 'sales' ? 'bg-[#1d3539] text-white' : 'bg-white text-[#1d3539] hover:bg-slate-50'}`}>Sales</button>
        </div>
      </div>

      {modificationApp && (
        <div className="bg-orange-50 p-4 rounded-2xl border-2 border-orange-200 flex items-start gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <Clock className="text-orange-500 shrink-0 mt-1" size={24}/>
          <div>
            <p className="font-black text-orange-900 text-lg uppercase tracking-tight">Modification Pending Approval</p>
            <p className="text-orange-800 font-bold mt-1">Your recent store modification is currently being reviewed by admins. You will see the changes once approved.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border-4 border-[#1d3539] shadow-[6px_6px_0px_0px_#1d3539] p-6 md:p-10 mb-20">
        
        {activeTab === 'store' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b-2 border-slate-100 pb-6">
              <h2 className="text-2xl md:text-3xl font-black text-[#1d3539] flex items-center gap-2"><Store className="text-[#5496a2]" size={28}/> Store Details</h2>
              {!isEditing && (
                <div className="flex gap-3 w-full md:w-auto">
                  <button onClick={handleTakeDownShop} className="flex-1 md:flex-none items-center justify-center gap-2 bg-red-100 text-red-600 font-black px-5 py-3 rounded-xl border-2 border-red-200 hover:bg-red-200 transition-colors active:scale-95">
                    Take Down Shop
                  </button>
                  <button onClick={() => setIsEditing(true)} className="flex-1 md:flex-none items-center justify-center gap-2 bg-[#e9efce] text-[#1d3539] font-black px-5 py-3 rounded-xl border-2 border-[#1d3539] hover:bg-[#d8e0b3] transition-colors shadow-[4px_4px_0px_0px_#1d3539] active:translate-y-1 active:translate-x-1 active:shadow-none flex">
                    <Edit2 size={18} /> Edit Store
                  </button>
                </div>
              )}
            </div>

            {!isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Store Name</p>
                    <p className="text-2xl font-black text-[#1d3539]">{merchantData.storeName}</p>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Menu / Link</p>
                    <p className="text-lg font-bold text-[#5496a2] break-all">
                      {merchantData.menuLink ? <a href={merchantData.menuLink} target="_blank" rel="noreferrer" className="hover:underline">{merchantData.menuLink}</a> : 'None provided'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-black text-[#1d3539] uppercase tracking-widest mb-4 flex items-center gap-2"><Tag size={18}/> Live Point Store Vouchers</p>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {storeItems.length === 0 ? (
                      <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-400 font-bold">
                        No vouchers currently live. Edit store to add some!
                      </div>
                    ) : storeItems.map(item => (
                      <div key={item.id} className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#5496a2] transition-colors shadow-sm hover:shadow-md">
                        <div className="flex items-center gap-4">
                          <span className="text-4xl bg-slate-50 w-16 h-16 flex items-center justify-center rounded-2xl border border-slate-100">{item.icon}</span>
                          <div>
                            <p className="text-lg font-black text-[#1d3539]">{item.name}</p>
                            <p className="text-sm font-bold text-slate-500 mt-1">{item.description}</p>
                          </div>
                        </div>
                        <div className="sm:text-right bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-full sm:w-auto flex justify-between sm:block">
                          <p className="font-black text-orange-500 text-lg flex items-center justify-end gap-1"><DollarSign size={16}/>{item.price}</p>
                          <p className={`text-xs font-black uppercase mt-1 ${item.stock > 10 ? 'text-emerald-500' : 'text-red-500'}`}>Stock: {item.stock}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-black text-sm mb-2 text-[#1d3539] uppercase">Store Name</label>
                    <input type="text" className="w-full border-2 border-[#1d3539] rounded-xl px-4 py-3 font-bold bg-white focus:ring-4 focus:ring-[#5496a2]/20 outline-none transition-all" value={editStoreName} onChange={e => setEditStoreName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block font-black text-sm mb-2 text-[#1d3539] uppercase">Menu / Services Link</label>
                    <input type="text" className="w-full border-2 border-[#1d3539] rounded-xl px-4 py-3 font-bold bg-white focus:ring-4 focus:ring-[#5496a2]/20 outline-none transition-all" value={editMenuLink} onChange={e => setEditMenuLink(e.target.value)} />
                  </div>
                </div>

                <div className="pt-8 border-t-2 border-slate-100">
                  <h3 className="font-black text-[#1d3539] text-xl uppercase flex items-center gap-2 mb-4"><MapPin size={24} className="text-[#5496a2]"/> Edit Location</h3>
                  <div className="space-y-4">
                    <form onSubmit={handleSearch} className="flex gap-2">
                      <input type="text" placeholder="Search location..." className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2 font-bold bg-white focus:border-[#5496a2] outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                      <button type="submit" className="bg-[#5496a2] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#3d7079] transition-colors"><Search size={20}/></button>
                    </form>

                    <button type="button" onClick={handleUseCurrentLocation} disabled={isLocating} className="w-full bg-white border-2 border-[#5496a2] text-[#5496a2] font-bold py-2 rounded-xl hover:bg-[#5496a2]/5 transition-colors disabled:opacity-50">
                      {isLocating ? 'Locating...' : 'Use My Current Location'}
                    </button>

                    <div className="h-64 w-full rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner">
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

                <div className="pt-8 border-t-2 border-slate-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h3 className="font-black text-[#1d3539] text-xl uppercase flex items-center gap-2"><Tag size={24} className="text-[#5496a2]"/> Vouchers</h3>
                    <button onClick={handleAddVoucher} className="flex items-center justify-center gap-2 font-black bg-[#e9efce] text-[#1d3539] px-4 py-2.5 rounded-xl border-2 border-[#1d3539] hover:bg-[#d8e0b3] shadow-[4px_4px_0px_0px_#1d3539] active:translate-y-1 active:translate-x-1 active:shadow-none w-full sm:w-auto"><Plus size={18} /> Add Voucher</button>
                  </div>
                  
                  <div className="space-y-6">
                    {vouchers.map((v, idx) => (
                      <div key={idx} className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-200 relative group transition-all hover:border-slate-300">
                        <button onClick={() => handleRemoveVoucher(idx)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 bg-white p-2 rounded-full border border-slate-200 shadow-sm transition-all active:scale-95"><Trash2 size={18} /></button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase">Name</label>
                            <input type="text" className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold focus:border-[#5496a2] outline-none" value={v.name} onChange={e => updateVoucher(idx, 'name', e.target.value)} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase">Description</label>
                            <input type="text" className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold focus:border-[#5496a2] outline-none" value={v.desc || v.description} onChange={e => updateVoucher(idx, 'desc', e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase">Price (Coins)</label>
                            <input type="number" className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold focus:border-[#5496a2] outline-none" value={v.price} onChange={e => updateVoucher(idx, 'price', Number(e.target.value))} />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase">Stock</label>
                            <input type="number" className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold focus:border-[#5496a2] outline-none" value={v.stock} onChange={e => updateVoucher(idx, 'stock', Number(e.target.value))} />
                          </div>
                          <div className="sm:col-span-2 md:col-span-1">
                            <label className="block text-xs font-black text-slate-500 mb-2 uppercase">Icon Emoji</label>
                            <input type="text" className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold focus:border-[#5496a2] outline-none text-center text-xl" value={v.icon} onChange={e => updateVoucher(idx, 'icon', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t-2 border-slate-100">
                  <button onClick={() => setIsEditing(false)} className="flex-1 bg-white text-slate-700 font-black px-6 py-4 rounded-2xl border-2 border-slate-200 hover:bg-slate-50 transition-all uppercase tracking-wide">Cancel</button>
                  <button onClick={handleSubmitModification} className="flex-[2] bg-[#5496a2] text-white font-black px-6 py-4 rounded-2xl border-4 border-[#1d3539] shadow-[6px_6px_0px_0px_#1d3539] active:translate-y-1 active:translate-x-1 active:shadow-none hover:bg-[#1d3539] transition-all uppercase tracking-wide">Submit for Approval</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex justify-between items-center mb-8 border-b-2 border-slate-100 pb-6">
              <h2 className="text-2xl md:text-3xl font-black text-[#1d3539] flex items-center gap-2"><ShoppingBag className="text-[#5496a2]" size={28}/> Sales & Redemptions</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <div className="bg-emerald-50 p-6 rounded-3xl border-2 border-emerald-200">
                <p className="text-sm font-black text-emerald-600 uppercase tracking-widest mb-1">Total Sales</p>
                <p className="text-4xl font-black text-emerald-900">{sales.filter((s: any) => s.status !== 'disabled_by_admin').length}</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-3xl border-2 border-orange-200">
                <p className="text-sm font-black text-orange-600 uppercase tracking-widest mb-1">Merchant Points</p>
                <p className="text-4xl font-black text-orange-900 flex items-center gap-2">✨{sales.filter((s: any) => s.status !== 'disabled_by_admin').reduce((acc, curr) => acc + curr.price, 0)}</p>
                <p className="text-[10px] text-orange-600/80 font-bold mt-2 leading-tight">*Points are for future merchant perks (e.g. subscription discounts). Cannot be used in the Point Store.</p>
              </div>
              <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-200">
                <p className="text-sm font-black text-blue-600 uppercase tracking-widest mb-1">Pending Redeem</p>
                <p className="text-4xl font-black text-blue-900">{sales.filter(s => s.status === 'active').length}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-black text-[#1d3539] text-xl uppercase mb-4">Transaction History</h3>
              {sales.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center">
                  <Gift size={48} className="text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold text-lg">No sales yet.</p>
                  <p className="text-slate-400 font-medium">When users buy your vouchers, they will appear here.</p>
                </div>
              ) : sales.map((sale: any) => (
                <div key={sale.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-300 transition-colors shadow-sm">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${sale.status === 'redeemed' ? 'bg-slate-100 text-slate-500' : sale.status === 'disabled_by_admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {sale.status === 'redeemed' ? 'Redeemed' : sale.status === 'disabled_by_admin' ? 'Disabled' : 'Active'}
                      </span>
                      <p className="text-xs font-bold text-slate-400">{new Date(sale.purchased_at).toLocaleString()}</p>
                    </div>
                    <p className="text-xl font-black text-[#1d3539]">{sale.item_name}</p>
                    <p className="text-sm font-bold text-slate-500">Purchase ID: <span className="font-mono text-xs">{sale.id.split('-')[1]}</span></p>
                  </div>
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <p className="font-black text-orange-500 text-xl flex items-center">✨{sale.price}</p>
                    {sale.status === 'active' ? (
                      <button onClick={() => handleRedeem(sale.id)} className="bg-[#1d3539] text-white font-black px-6 py-2.5 rounded-xl hover:bg-[#2c5258] transition-colors active:scale-95 shadow-md flex items-center gap-2">
                        <CheckCircle size={18}/> Redeem
                      </button>
                    ) : sale.status === 'disabled_by_admin' ? (
                      <div className="px-6 py-2.5 bg-red-50 text-red-400 font-black rounded-xl border border-red-200 flex items-center gap-2">
                        <XCircle size={18}/> Disabled
                      </div>
                    ) : (
                      <div className="px-6 py-2.5 bg-slate-100 text-slate-400 font-black rounded-xl border border-slate-200 flex items-center gap-2">
                        <CheckCircle size={18}/> Done
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
