import React, { useState, useEffect } from 'react';
import { MapPin, Map } from 'lucide-react';
import { apiClient, resolveImageUrl } from '../../lib/api';
import { useMapStore } from '../../stores/useMapStore';
import { useDemoStore } from '../../stores/useDemoStore';

interface Props {
  signpostId: string;
  fallbackEmoji?: string;
  fallbackTitle?: string;
}

export const SharedSignpostCard: React.FC<Props> = ({ signpostId, fallbackEmoji, fallbackTitle }) => {
  const [loading, setLoading] = useState(true);
  const [signpostData, setSignpostData] = useState<any | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const verifySignpost = async () => {
      try {
        const response = await apiClient(`/signposts/${signpostId}`);
        if (isMounted) {
          if (response.signpost) {
            const data = response.signpost;
            if (!data.location && data.lng !== undefined && data.lat !== undefined) {
              data.location = [data.lng, data.lat];
            }
            setSignpostData(data);
          } else {
            setExpired(true);
          }
        }
      } catch (err) {
        if (isMounted) setExpired(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifySignpost();
    return () => { isMounted = false; };
  }, [signpostId]);

  if (expired) {
    return (
      <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/50 flex items-center gap-3 w-full max-w-[280px]">
        <div className="text-2xl opacity-50 grayscale">🪦</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-500 dark:text-slate-400 text-sm">Signpost Expired</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">This signpost is no longer available.</p>
        </div>
      </div>
    );
  }

  const emoji = signpostData?.emoji || fallbackEmoji || '📍';
  const title = signpostData?.message || fallbackTitle || 'Shared a signpost';

  let firstImage = null;
  if (signpostData?.images) {
    try {
      const imgs = typeof signpostData.images === 'string' ? JSON.parse(signpostData.images) : signpostData.images;
      if (Array.isArray(imgs) && imgs.length > 0) {
        firstImage = imgs[0];
      }
    } catch (e) {}
  }

  const handleClick = () => {
    if (!signpostData) return;
    
    const { setFlyToLocation, setActiveSignpost, signposts, setSignposts } = useMapStore.getState();
    const { setActiveView, setIsChatExpanded, setActivePrivateChat } = useDemoStore.getState();

    setActiveView('map');
    setIsChatExpanded(false);
    setActivePrivateChat(null);
    
    // Make sure signpost is in the global state so it renders correctly
    if (!signposts.find(s => s.id === signpostId)) {
      setSignposts([...signposts, signpostData]);
    }
    
    setFlyToLocation([signpostData.lng, signpostData.lat]);
    
    setTimeout(() => {
      setActiveSignpost(signpostData);
    }, 500);
  };

  return (
    <div 
      onClick={handleClick}
      className={`bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-[#5496a2]/20 dark:border-white/10 flex items-center gap-3 w-full max-w-[280px] group transition-all ${loading ? 'opacity-70' : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'}`}
    >
      <div className={`w-12 h-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform ${firstImage ? 'overflow-hidden' : ''}`}>
        {firstImage ? (
          <img src={resolveImageUrl(firstImage)} alt="preview" className="w-full h-full object-cover" />
        ) : (
          emoji
        )}
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="font-bold text-[#1d3539] dark:text-slate-100 text-sm truncate leading-tight mb-0.5">
          {title}
        </p>
        <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <Map size={12} />
          {loading ? 'Verifying location...' : 'View on map'}
        </p>
      </div>

      <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-[#5496a2] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <MapPin size={14} />
      </div>
    </div>
  );
};

