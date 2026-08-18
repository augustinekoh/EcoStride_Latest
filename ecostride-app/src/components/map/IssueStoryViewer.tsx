import React, { useState, useEffect } from 'react';
import { X, MapPin, Send } from 'lucide-react';

interface Props {
  issue: any;
  images: string[];
  onClose: () => void;
  onFullScreen: (img: string) => void;
  isPausedExternal?: boolean;
  onShare?: () => void;
}

export const IssueStoryViewer: React.FC<Props> = ({ 
  issue, 
  images, 
  onClose, 
  onFullScreen,
  isPausedExternal,
  onShare
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setProgress(0);
  }, [issue.id]);

  useEffect(() => {
    if (isPaused || isPausedExternal) return;
    const interval = setInterval(() => {
      setProgress(p => (p >= 100 ? 100 : p + 2));
    }, 100);
    return () => clearInterval(interval);
  }, [isPaused, isPausedExternal]);

  // Handle progression when progress reaches 100
  useEffect(() => {
    if (progress >= 100) {
      if (currentIndex < images.length - 1) {
        setCurrentIndex(i => i + 1);
        setProgress(0);
      } else {
        setTimeout(onClose, 300);
      }
    }
  }, [progress, currentIndex, images.length, onClose]);

  const handlePrev = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setProgress(0);
    }
  };

  const handleNext = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (currentIndex < images.length - 1) {
      setCurrentIndex(i => i + 1);
      setProgress(0);
    }
  };

  const currentImg = images[currentIndex] || images[0] || 'https://via.placeholder.com/600x800?text=No+Photo';

  return (
    <div 
      className="relative w-full h-full sm:w-[240px] sm:h-[360px] bg-black sm:rounded-2xl overflow-hidden sm:shadow-2xl flex flex-col pointer-events-auto"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Progress Bars */}
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
        {images.map((_, idx) => (
          <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-none"
              style={{ 
                width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' 
              }}
            />
          </div>
        ))}
      </div>
      
      {/* Close Button */}
      <button 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-3 z-30 text-white drop-shadow-md hover:scale-110"
      >
        <X size={24} />
      </button>

      {/* Image Background */}
      <img 
        src={currentImg} 
        alt="Issue Image" 
        className="absolute inset-0 w-full h-full object-cover"
        onClick={(e) => { e.stopPropagation(); onFullScreen(currentImg); }}
      />

      {/* Click Zones for Prev/Next (z-20) */}
      <div className="absolute top-0 bottom-1/3 left-0 w-1/3 z-20 cursor-pointer" onClick={handlePrev} />
      <div className="absolute top-0 bottom-1/3 right-0 w-1/3 z-20 cursor-pointer" onClick={handleNext} />

      {/* Gradient Overlay for Text */}
      <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-10 pointer-events-none" />

      {/* Text & Action Buttons Container */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-30 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 drop-shadow-md">
            <div className="flex items-center gap-2 mb-1">
               <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm ${
                 issue.status === 'resolved' ? 'bg-emerald-500 text-white' :
                 issue.status === 'in-progress' ? 'bg-blue-500 text-white' :
                 'bg-amber-500 text-white'
               }`}>
                 {issue.status}
               </span>
            </div>
            <h2 className="text-lg font-black text-white leading-tight">{issue.title}</h2>
            {issue.description && (
              <p className="text-sm text-white/90 line-clamp-2 mt-1">{issue.description}</p>
            )}
            {issue.specific_location && (
              <p className="text-xs text-white/70 flex items-center gap-1 mt-1">
                <MapPin size={12} /> {issue.specific_location}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onClose(); 
            }}
            className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 rounded-xl py-3 font-bold text-white text-sm transition-colors flex items-center justify-center gap-2 active:scale-95 pointer-events-auto"
          >
            <MapPin size={16} /> Locate on Map
          </button>
          {onShare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 rounded-xl text-white transition-colors active:scale-95 pointer-events-auto flex items-center justify-center"
              title="Share Issue"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
