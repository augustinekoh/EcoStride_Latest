export interface Merchant {
  id: string;             // Canonical merchant ID (merchants.id)
  ownerId: string;        // Owner user UID (merchants.owner_id)
  storeName: string;      // Store name
  menuLink?: string;      // Menu / website URL
  location?: [number, number] | null; // [lng, lat]
  status: string;         // "approved" | "pending" | "disabled"
  category?: string;      // Category
  offers?: string;        // Offer/banner
  icon?: string;          // Icon emoji
  createdAt?: number;
}

export function normalizeMerchant(raw: any): Merchant {
  if (!raw) {
    return {
      id: '',
      ownerId: '',
      storeName: 'Unknown Store',
      status: 'pending',
      icon: '🏪'
    };
  }

  let loc: [number, number] | null = null;
  if (Array.isArray(raw.location)) {
    loc = raw.location as [number, number];
  } else if (typeof raw.location === 'string' && raw.location.trim()) {
    try {
      loc = JSON.parse(raw.location);
    } catch (e) {
      loc = null;
    }
  }

  return {
    id: raw.id || '',
    ownerId: raw.owner_id || raw.ownerId || '',
    storeName: raw.store_name || raw.storeName || raw.name || 'Unnamed Store',
    menuLink: raw.menu_link || raw.menuLink || raw.link || '',
    location: loc,
    status: raw.status || 'approved',
    category: raw.category || 'Eco Merchant',
    offers: raw.offers || raw.store_name || raw.storeName || '',
    icon: raw.icon || '🏪',
    createdAt: raw.created_at || raw.createdAt || Date.now()
  };
}
