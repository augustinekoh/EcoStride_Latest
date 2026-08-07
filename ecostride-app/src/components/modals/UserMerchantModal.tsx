import React, { useState } from 'react';
import { X, Search, Store, Ticket } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { useMapStore } from '../../stores/useMapStore';

interface UserMerchantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserMerchantModal: React.FC<UserMerchantModalProps> = ({ isOpen, onClose }) => {
  const { vouchersCollected } = useUserStore();
  const { merchants } = useMapStore();
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredMerchants = merchants.filter(m => 
    m.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[var(--color-teal-dark)]/20 backdrop-blur-md px-4">
      <div className="glass-card p-0 w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-90 duration-300 relative border border-white/50 shadow-xl">
        
        {/* Header */}
        <div className="bg-white/40 backdrop-blur-md p-4 flex justify-between items-center text-[var(--color-text-main)] border-b border-white/30 shrink-0">
          <div className="flex items-center gap-2">
            <Store size={24} className="text-[var(--color-teal-dark)]" />
            <h2 className="text-xl font-black uppercase tracking-wider text-[var(--color-text-main)]">Eco Merchants</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/50 rounded-full transition-colors active:scale-95 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-4 overflow-y-auto pb-8">
          
          {/* Vouchers Collected */}
          <div className="glass-active border border-white/50 rounded-2xl p-3 shadow-sm flex items-center gap-3">
            <div className="bg-[var(--color-pastel-yellow)] p-2 rounded-xl border border-white/60 shadow-sm">
              <Ticket size={24} className="text-[var(--color-text-main)]" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-[var(--color-text-muted)]">My Vouchers</p>
              <p className="text-xl font-black text-[var(--color-text-main)]">{vouchersCollected} Collected</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search stores..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass-active border border-white/40 rounded-2xl py-3 pl-10 pr-4 font-bold text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-teal-dark)]/50 transition-all"
            />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          </div>

          {/* Suggested / Nearby Stores */}
          <div>
            <h3 className="text-sm font-black uppercase text-[var(--color-text-muted)] mb-2">Suggested Nearby</h3>
            <div className="space-y-3">
              {filteredMerchants.length > 0 ? (
                filteredMerchants.map((merchant) => (
                  <div key={merchant.id} className="glass-active border border-white/40 rounded-2xl p-3 shadow-sm flex items-center justify-between hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer">
                    <div>
                      <h4 className="font-black text-[var(--color-text-main)]">{merchant.storeName}</h4>
                      <p className="text-xs font-bold text-[var(--color-text-muted)]">{merchant.category}</p>
                    </div>
                    {merchant.offers && (
                      <span className="text-[10px] font-black uppercase bg-[var(--color-teal-dark)] text-white px-2 py-1 rounded-full shadow-sm">
                        {merchant.offers}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-dashed border-white/50">
                  <p className="font-bold text-[var(--color-text-muted)]">No stores found.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
