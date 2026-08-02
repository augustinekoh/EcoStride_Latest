import React, { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';
import { useUserStore } from '../../stores/useUserStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { X, Gift, Search } from 'lucide-react';

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
  const [merchants, setMerchants] = useState<{ [key: string]: { name: string, link: string } }>({});

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const [storeRes, merchantRes] = await Promise.all([
          apiClient('/store'),
          apiClient('/merchants')
        ]);
        setStoreItems(storeRes.items);
        
        const merchantMap: { [key: string]: { name: string, link: string } } = {};
        if (merchantRes.merchants) {
          merchantRes.merchants.forEach((m: any) => {
            merchantMap[m.owner_id] = { name: m.store_name, link: m.menu_link };
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
      
      <div className="relative w-full max-w-2xl bg-[#faf9f6] h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl border-t-2 sm:border-2 border-slate-900 shadow-comic flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-[#faf9f6] z-10 border-b-2 border-slate-900 px-6 py-4 rounded-t-3xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[var(--color-pastel-yellow)] p-2 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a]">
              <Gift size={24} className="text-[var(--color-text-main)]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Points Store</h2>
              <p className="text-sm font-bold text-slate-500">Your Balance: <span className="text-amber-500">🪙 {userCoins}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white rounded-full border-2 border-slate-900 shadow-comic-hover hover:bg-slate-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search & Category Filters */}
        <div className="bg-[#faf9f6] border-b-2 border-slate-900 px-6 py-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search items..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border-2 border-slate-200 focus:border-brand-pink rounded-xl py-2 pl-10 pr-4 text-sm font-bold text-slate-900 outline-none transition-colors shadow-sm"
            />
          </div>
          {!merchantFilter && (
            <div className="w-full sm:w-48">
              <select 
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full bg-white border-2 border-slate-200 focus:border-brand-pink rounded-xl py-2 px-4 text-sm font-bold text-slate-900 outline-none transition-colors shadow-sm cursor-pointer appearance-none"
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
        <div className="flex-1 overflow-y-auto p-6 bg-dots">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {storeItems
              .filter(item => merchantFilter ? item.merchant_id === merchantFilter : true)
              .filter(item => activeCategory === 'All' ? true : item.category === activeCategory)
              .filter(item => {
                const searchLower = searchTerm.toLowerCase();
                const matchName = item.name.toLowerCase().includes(searchLower);
                const matchDesc = item.description?.toLowerCase().includes(searchLower);
                const matchMerchant = item.merchant_id && merchants[item.merchant_id]?.name?.toLowerCase().includes(searchLower);
                return matchName || matchDesc || matchMerchant;
              })
              .length === 0 && (
              <div className="col-span-full text-center py-12">
                <div className="text-6xl mb-4">🏪</div>
                <h3 className="text-xl font-bold text-slate-900">The store is empty</h3>
                <p className="text-slate-500 font-bold">Check back later for exciting rewards!</p>
              </div>
            )}

            {storeItems
              .filter(item => merchantFilter ? item.merchant_id === merchantFilter : true)
              .filter(item => activeCategory === 'All' ? true : item.category === activeCategory)
              .filter(item => {
                const searchLower = searchTerm.toLowerCase();
                const matchName = item.name.toLowerCase().includes(searchLower);
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
                  className={`bg-white rounded-2xl border-2 border-slate-900 p-5 flex flex-col justify-between transition-all ${outOfStock ? 'opacity-70 grayscale' : 'shadow-comic hover:-translate-y-1 hover:shadow-[6px_6px_0px_#0f172a]'}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-5xl bg-slate-100 w-16 h-16 rounded-2xl border-2 border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                        {item.icon}
                      </div>
                      <div>
                        {outOfStock ? (
                          <span className="bg-slate-800 text-white text-xs font-black px-2 py-1 rounded-md tracking-wider shadow-sm">SOLD OUT</span>
                        ) : (
                          <span className="bg-brand-green/20 border border-brand-green text-brand-green text-xs font-black px-2 py-1 rounded-md shadow-sm">📦 {item.stock} LEFT</span>
                        )}
                      </div>
                    </div>
                    <div className="mb-3">
                      <h3 className="font-black text-xl text-slate-900 mb-2 leading-tight">{item.name}</h3>
                      
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {item.category && <span className="text-[10px] uppercase font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">{item.category}</span>}
                        {item.merchant_id && merchants[item.merchant_id] && (
                          <span className="text-[10px] uppercase font-black text-brand-blue bg-brand-blue/10 px-2.5 py-1 rounded-md border border-brand-blue/20 shadow-sm flex items-center gap-1">
                            🏪 {merchants[item.merchant_id].name}
                          </span>
                        )}
                        {(item.link || (item.merchant_id && merchants[item.merchant_id]?.link)) && (
                          <a href={item.link || merchants[item.merchant_id].link} target="_blank" rel="noopener noreferrer" className="text-[10px] uppercase font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200 shadow-sm flex items-center gap-1 transition-colors cursor-pointer">
                            🔗 Visit Link
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {(item.desc || item.description) && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/60 shadow-inner">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Details</p>
                        <p className="text-xs font-bold text-slate-600 line-clamp-2 leading-relaxed">{item.desc || item.description}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t-2 border-slate-100 flex items-center justify-between">
                    <div className={`font-black text-xl flex items-center gap-1 ${cantAfford && !outOfStock ? 'text-red-500' : 'text-brand-orange'}`}>
                      🪙 {item.price}
                    </div>
                    <button 
                      onClick={() => handleBuy(item)}
                      disabled={outOfStock || buyingId === item.id || (!user && !outOfStock)}
                      className={`px-4 py-2 rounded-xl font-black uppercase text-sm border-2 border-slate-900 transition-all ${
                        outOfStock 
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300' 
                          : cantAfford
                            ? 'bg-red-100 text-red-500 border-red-500 cursor-not-allowed'
                            : 'bg-brand-yellow hover:bg-yellow-300 shadow-comic-hover active:translate-y-1 active:shadow-none'
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
