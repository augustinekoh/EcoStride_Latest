import React, { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';
import { useUserStore } from '../../stores/useUserStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { X, Gift, Search } from 'lucide-react';
import { normalizeMerchant } from '../../types/merchant';

interface PointsStoreModalProps {
  onClose: () => void;
  merchantFilter?: string | null;
}

export const PointsStoreModal: React.FC<PointsStoreModalProps> = ({ onClose, merchantFilter }) => {
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const { userCoins, deductCoins } = useUserStore();
  const { user } = useAuthStore();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [merchants, setMerchants] = useState<{ [key: string]: { id: string; ownerId: string; name: string; link: string } }>({});

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const [storeRes, merchantRes] = await Promise.all([
          apiClient('/store'),
          apiClient('/merchants')
        ]);
        setStoreItems(storeRes.items || []);
        
        const merchantMap: { [key: string]: { id: string; ownerId: string; name: string; link: string } } = {};
        if (merchantRes.merchants) {
          merchantRes.merchants.forEach((raw: any) => {
            const m = normalizeMerchant(raw);
            const entry = { id: m.id, ownerId: m.ownerId, name: m.storeName, link: m.menuLink || '' };
            // Primary index by canonical merchant.id
            if (m.id) merchantMap[m.id] = entry;
            // Fallback index by ownerId for legacy unmigrated items
            if (m.ownerId && !merchantMap[m.ownerId]) merchantMap[m.ownerId] = entry;
          });
        }
        setMerchants(merchantMap);
      } catch (err) {
        console.error('Failed to fetch store data', err);
      }
    };
    fetchStore();

  }, []);

  const handleBuy = async (item: any) => {
    if (!user) {
      alert("Please log in to purchase items!");
      return;
    }
    
    if (userCoins < item.price) {
      alert("Not enough Eco-Coins!");
      return;
    }
    
    if (item.stock <= 0) {
      alert("This item is out of stock!");
      return;
    }

    setBuyingId(item.id);
    try {
      await apiClient('/store/buy', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          itemId: item.id,
          itemName: item.name,
          price: item.price,
          icon: item.icon
        })
      });

      deductCoins(item.price);
      alert(`Successfully purchased ${item.name}! Check your Profile for your vouchers.`);
      
      // Optimistically update stock locally
      setStoreItems(prev => prev.map(i => i.id === item.id ? { ...i, stock: i.stock - 1 } : i));
    } catch (e) {
      console.error("Error purchasing:", e);
      alert("Purchase failed. Please try again.");
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/80 h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-white/80 dark:border-slate-700/80 shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md z-10 border-b border-white/40 dark:border-slate-700/40 px-6 py-5 rounded-t-[2.5rem] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-amber-400/20 dark:bg-amber-400/10 p-2.5 rounded-2xl border border-amber-400/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] backdrop-blur-md text-[var(--color-text-main)] dark:text-emerald-400">
              <Gift size={24} className="text-[var(--color-text-main)] dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Points Store</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Your Balance: <span className="text-amber-500">🪙 {userCoins}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white/30 dark:bg-slate-800/30 backdrop-blur-md rounded-full hover:bg-white/60 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300 transition-all border border-slate-300/50 dark:border-slate-600/50 shadow-sm"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search & Category Filters */}
        <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-md border-b border-white/40 dark:border-slate-700/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)] px-6 py-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search items..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/50 dark:bg-slate-900/50 border border-white/60 dark:border-slate-700/60 backdrop-blur-md focus:border-emerald-400/50 focus:bg-white/80 dark:focus:bg-slate-800/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] rounded-xl py-2 pl-10 pr-4 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none transition-colors shadow-sm placeholder:text-slate-500 dark:placeholder:text-slate-400"
            />
          </div>
          {!merchantFilter && (
            <div className="w-full sm:w-48">
              <select 
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full bg-white/50 dark:bg-slate-900/50 border border-white/60 dark:border-slate-700/60 backdrop-blur-md focus:border-emerald-400/50 focus:bg-white/80 dark:focus:bg-slate-800/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] rounded-xl py-2 px-4 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none transition-colors shadow-sm cursor-pointer appearance-none dark:text-white"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
              >
                {['All', ...Array.from(new Set(storeItems.map(item => item.category).filter(Boolean)))].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {storeItems
              .filter(item => merchantFilter ? (item.merchant_id === merchantFilter || merchants[item.merchant_id]?.id === merchantFilter) : true)
              .filter(item => activeCategory === 'All' ? true : item.category === activeCategory)
              .filter(item => {
                if (!searchTerm) return true;
                const searchLower = searchTerm.toLowerCase();
                const matchName = item.name?.toLowerCase().includes(searchLower);
                const matchDesc = (item.desc || item.description)?.toLowerCase().includes(searchLower);
                const matchMerchant = item.merchant_id && merchants[item.merchant_id]?.name?.toLowerCase().includes(searchLower);
                return matchName || matchDesc || matchMerchant;
              })
              .length === 0 && (
              <div className="col-span-full text-center py-12">
                <div className="text-6xl mb-4">🏪</div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">The store is empty</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Check back later for exciting rewards!</p>
              </div>
            )}

            {storeItems
              .filter(item => merchantFilter ? (item.merchant_id === merchantFilter || merchants[item.merchant_id]?.id === merchantFilter) : true)
              .filter(item => activeCategory === 'All' ? true : item.category === activeCategory)
              .filter(item => {
                if (!searchTerm) return true;
                const searchLower = searchTerm.toLowerCase();
                const matchName = item.name?.toLowerCase().includes(searchLower);
                const matchDesc = (item.desc || item.description)?.toLowerCase().includes(searchLower);
                const matchMerchant = item.merchant_id && merchants[item.merchant_id]?.name?.toLowerCase().includes(searchLower);
                return matchName || matchDesc || matchMerchant;
              })
              .map(item => {
              const outOfStock = item.stock <= 0;
              const cantAfford = userCoins < item.price;
              
              return (
                <div 
                  key={item.id} 
                  className={`backdrop-blur-xl bg-white/60 dark:bg-slate-800/60 rounded-2xl border border-white/80 dark:border-slate-700/80 transition-all p-5 flex flex-col justify-between shadow-sm ${outOfStock ? 'opacity-70 grayscale' : 'hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:-translate-y-1 cursor-pointer'}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-5xl bg-white/50 dark:bg-slate-900/50 w-16 h-16 rounded-2xl border border-white/80 dark:border-slate-700/50 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        {outOfStock ? (
                          <span className="bg-slate-800/80 text-white text-xs font-bold px-2.5 py-1 rounded-md tracking-wider shadow-sm backdrop-blur-sm">SOLD OUT</span>
                        ) : (
                          <span className="bg-emerald-500/10 border border-emerald-500/30 text-[var(--color-text-main)] dark:text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-md shadow-sm backdrop-blur-sm">📦 {item.stock} LEFT</span>
                        )}
                      </div>
                    </div>
                    <div className="mb-3">
                      <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-2 leading-tight">{item.name}</h3>
                      
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {item.category && <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-700/60 px-2.5 py-1 rounded-md border border-white/60 dark:border-slate-600/50 shadow-sm">{item.category}</span>}
                        {item.merchant_id && merchants[item.merchant_id] && (
                          <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20 shadow-sm flex items-center gap-1">
                            🏪 {merchants[item.merchant_id].name}
                          </span>
                        )}
                        {(item.link || (item.merchant_id && merchants[item.merchant_id]?.link)) && (
                          <a href={item.link || merchants[item.merchant_id].link} target="_blank" rel="noopener noreferrer" className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-md border border-blue-500/20 shadow-sm flex items-center gap-1 transition-colors cursor-pointer">
                            🔗 Visit Link
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {(item.desc || item.description) && (
                      <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-xl p-3 border border-white/60 dark:border-slate-700/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Details</p>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">{item.desc || item.description}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-white/60 dark:border-slate-700/50 flex items-center justify-between">
                    <div className={`font-bold text-xl flex items-center gap-1 ${cantAfford && !outOfStock ? 'text-rose-500' : 'text-amber-500 dark:text-amber-400'}`}>
                      🪙 {item.price}
                    </div>
                    <button 
                      onClick={() => handleBuy(item)}
                      disabled={outOfStock || buyingId === item.id || (!user && !outOfStock)}
                      className={`px-4 py-2 rounded-xl font-semibold uppercase text-sm border transition-all shadow-sm ${
                        outOfStock 
                          ? 'bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 border-slate-300/50 dark:border-slate-700/50 cursor-not-allowed' 
                          : cantAfford
                            ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20 cursor-not-allowed'
                            : 'bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 text-amber-900 border border-amber-200/50 shadow-md shadow-amber-500/20 active:translate-y-1 active:shadow-none backdrop-blur-sm'
                      }`}
                    >
                      {buyingId === item.id ? '...' : outOfStock ? 'Out' : cantAfford ? 'Need Coins' : 'Redeem'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};


