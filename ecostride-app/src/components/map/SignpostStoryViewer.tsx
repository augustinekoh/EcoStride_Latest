import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  signpost: any;
  images: string[];
  onClose: () => void;
  onLike: (e: React.MouseEvent, sp: any) => void;
  onViewProfile: (authorId: string, username: string) => void;
  onFullScreen: (img: string) => void;
}

export const SignpostStoryViewer: React.FC<Props> = ({ 
  signpost, 
  images, 
  onClose, 
  onLike, 
  onViewProfile,
  onFullScreen
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showLikeAnim, setShowLikeAnim] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setProgress(0);
  }, [signpost.id]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setProgress(p => (p >= 100 ? 100 : p + 2));
    }, 100);
    return () => clearInterval(interval);
  }, [isPaused]);

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

  const currentImg = images[currentIndex] || images[0];
  const authorName = signpost.authorUsername || signpost.authorEmail || 'Guest';

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
        <X size={20} />
      </button>

      {/* Image Background */}
      <img 
        src={currentImg} 
        alt="Signpost Story" 
        className="absolute inset-0 w-full h-full object-cover"
        onClick={(e) => { e.stopPropagation(); onFullScreen(currentImg); }}
      />

      {/* Click Zones for Prev/Next (z-20) */}
      <div className="absolute top-0 bottom-1/3 left-0 w-1/3 z-20 cursor-pointer" onClick={handlePrev} />
      <div className="absolute top-0 bottom-1/3 right-0 w-1/3 z-20 cursor-pointer" onClick={handleNext} />

      {/* Gradient Overlay for Text */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10 pointer-events-none" />

      {/* Text & Like Button Container */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-30 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl bg-white/20 backdrop-blur-sm p-1.5 rounded-xl border border-white/30 text-white">{signpost.emoji}</span>
          <div className="flex-1 drop-shadow-md">
            <p 
              className="text-xs text-white/90 font-bold truncate max-w-[140px] cursor-pointer hover:underline pointer-events-auto"
              onClick={(e) => { e.stopPropagation(); onViewProfile(signpost.authorId, authorName); }}
            >
              {authorName}
            </p>
            <p className="text-sm font-black text-white">{signpost.message}</p>
          </div>
        </div>
        
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            setShowLikeAnim(true);
            setTimeout(() => setShowLikeAnim(false), 1000);
            onLike(e, signpost); 
          }}
          className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 rounded-xl py-2 font-bold text-white text-sm transition-colors flex items-center justify-center gap-1 active:scale-95 mt-1 pointer-events-auto relative overflow-hidden"
        >
          👍 Energy <span className="bg-white/90 px-1.5 rounded-full text-slate-900 text-xs ml-1 font-black">{signpost.likes || 0}</span>
          
          {/* Ripple / Highlight effect */}
          {showLikeAnim && (
            <div className="absolute inset-0 bg-white/40 animate-ping rounded-xl pointer-events-none" />
          )}
        </button>
      </div>

      {/* Floating Thumbs Up Emoji Animation */}
      {showLikeAnim && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
          <div className="text-6xl animate-bounce drop-shadow-2xl opacity-0 transition-opacity duration-300" style={{ animation: 'bounce 1s ease-out forwards, fadeOutUp 1s ease-out forwards' }}>
            👍
          </div>
          <style>{`
            @keyframes fadeOutUp {
              0% { opacity: 0; transform: translateY(20px) scale(0.5); }
              20% { opacity: 1; transform: translateY(0) scale(1.2); }
              80% { opacity: 1; transform: translateY(-40px) scale(1); }
              100% { opacity: 0; transform: translateY(-80px) scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};
