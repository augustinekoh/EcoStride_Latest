import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, ArrowDown, Check, Sparkles } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  disabled?: boolean;
  onRefresh?: () => Promise<any> | void;
  pullThreshold?: number;
  maxPull?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  disabled = false,
  onRefresh,
  pullThreshold = 65,
  maxPull = 100,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  // Gesture tracking refs
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isValidPullRef = useRef(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Helper to find the relevant scroll container
  const findScrollContainer = (target: HTMLElement | null): HTMLElement | null => {
    let current: HTMLElement | null = target;
    const root = containerRef.current;

    while (current && current !== root) {
      const overflowY = window.getComputedStyle(current).overflowY;
      const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight;
      if (isScrollable) {
        return current;
      }
      current = current.parentElement;
    }
    return root;
  };

  // Helper to check if any scroll container in the hierarchy is scrolled down
  const isHierarchyAtTop = (target: HTMLElement | null): boolean => {
    let current: HTMLElement | null = target;
    const root = containerRef.current;

    while (current && current !== document.body) {
      if (current.scrollTop > 0) {
        return false;
      }
      if (current === root) break;
      current = current.parentElement;
    }
    return true;
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(55);

    const promises: Promise<any>[] = [];

    // 1. If explicit prop is provided
    if (onRefresh) {
      try {
        promises.push(Promise.resolve(onRefresh()));
      } catch (err) {
        console.error('Explicit onRefresh failed:', err);
      }
    }

    // 2. Global app refresh for user profile, coins, mails, unread chats
    if (typeof (window as any).triggerAppRefresh === 'function') {
      try {
        promises.push(Promise.resolve((window as any).triggerAppRefresh()));
      } catch (err) {
        console.error('triggerAppRefresh failed:', err);
      }
    }

    // 3. Dispatch app:refresh event for active view components to register their promises
    try {
      window.dispatchEvent(
        new CustomEvent('app:refresh', {
          detail: {
            registerPromise: (p: Promise<any>) => {
              if (p && typeof p.then === 'function') {
                promises.push(p);
              }
            }
          }
        })
      );
    } catch (err) {
      console.error('Dispatch app:refresh failed:', err);
    }

    // Minimum delay for pleasing visual feedback
    const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 600));
    // Safety timeout cap so indicator is NEVER stuck
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 8000));

    try {
      await Promise.race([
        Promise.allSettled([...promises, minDelayPromise]),
        timeoutPromise
      ]);
    } catch (e) {
      console.error('Refresh promise settling encountered an error:', e);
    }

    // Show quick success state
    setRefreshSuccess(true);
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Reset smoothly
    setRefreshSuccess(false);
    setIsRefreshing(false);
    setPullDistance(0);
    setIsPulling(false);
  }, [isRefreshing, onRefresh]);

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;

    const target = e.target as HTMLElement;

    // Strict exclusion: Mapbox, map elements, inputs, buttons, sliders, or elements marked no-pull
    if (
      target.closest('.mapboxgl-map') ||
      target.closest('.mapboxgl-canvas') ||
      target.closest('.mapboxgl-ctrl') ||
      target.closest('[class*="mapboxgl"]') ||
      target.closest('[data-no-pull-refresh]') ||
      target.closest('input, textarea, select')
    ) {
      isValidPullRef.current = false;
      return;
    }

    // Verify all scroll containers up to root are at scrollTop <= 0
    if (!isHierarchyAtTop(target)) {
      isValidPullRef.current = false;
      return;
    }

    const scrollContainer = findScrollContainer(target);
    scrollContainerRef.current = scrollContainer;

    if (scrollContainer && scrollContainer.scrollTop > 0) {
      isValidPullRef.current = false;
      return;
    }

    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    startXRef.current = touch.clientX;
    isValidPullRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isValidPullRef.current || disabled || isRefreshing) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - startYRef.current;
    const deltaX = touch.clientX - startXRef.current;

    // Check if scroll container has moved down
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop > 0) {
      isValidPullRef.current = false;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    // Ignore horizontal swipes (e.g. tabs, carousels)
    if (Math.abs(deltaX) > Math.abs(deltaY) * 0.8 && Math.abs(deltaX) > 10) {
      isValidPullRef.current = false;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    // Only handle downward pull when at top
    if (deltaY > 0) {
      // Damping formula for natural resistance
      const distance = Math.min(maxPull, deltaY * 0.42);
      setPullDistance(distance);
      setIsPulling(true);

      // Prevent native pull-to-refresh on Android Chrome / iOS Safari when we handle it
      if (e.cancelable && distance > 10) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = () => {
    if (!isValidPullRef.current || disabled || isRefreshing) {
      isValidPullRef.current = false;
      return;
    }

    isValidPullRef.current = false;

    if (pullDistance >= pullThreshold) {
      handleRefresh();
    } else {
      setIsPulling(false);
      setPullDistance(0);
    }
  };

  // Mouse Drag support for desktop browser testing
  const isMouseDownRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || isRefreshing) return;
    const target = e.target as HTMLElement;

    if (
      target.closest('.mapboxgl-map') ||
      target.closest('.mapboxgl-canvas') ||
      target.closest('.mapboxgl-ctrl') ||
      target.closest('[class*="mapboxgl"]') ||
      target.closest('[data-no-pull-refresh]') ||
      target.closest('input, textarea, select, button, a')
    ) {
      return;
    }

    if (!isHierarchyAtTop(target)) return;

    const scrollContainer = findScrollContainer(target);
    if (scrollContainer && scrollContainer.scrollTop > 0) return;

    scrollContainerRef.current = scrollContainer;
    isMouseDownRef.current = true;
    startYRef.current = e.clientY;
    startXRef.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || disabled || isRefreshing) return;

    const deltaY = e.clientY - startYRef.current;
    const deltaX = e.clientX - startXRef.current;

    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop > 0) {
      isMouseDownRef.current = false;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY) * 0.8 && Math.abs(deltaX) > 10) {
      isMouseDownRef.current = false;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    if (deltaY > 0) {
      const distance = Math.min(maxPull, deltaY * 0.42);
      setPullDistance(distance);
      setIsPulling(true);
    }
  };

  const handleMouseUp = () => {
    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;

    if (pullDistance >= pullThreshold && !isRefreshing) {
      handleRefresh();
    } else {
      setIsPulling(false);
      setPullDistance(0);
    }
  };

  const isReady = pullDistance >= pullThreshold;
  const progressRatio = Math.min(1, pullDistance / pullThreshold);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Center Pull-to-Refresh Pill */}
      {!disabled && (pullDistance > 6 || isRefreshing || refreshSuccess) && (
        <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none flex justify-center items-start pt-3 sm:pt-4">
          <div
            className={`flex items-center gap-2.5 px-4 py-2 rounded-full border shadow-xl backdrop-blur-xl transition-all duration-200 ${
              refreshSuccess
                ? 'bg-emerald-500/95 text-white border-emerald-400 shadow-emerald-500/30'
                : isRefreshing
                ? 'bg-white/95 dark:bg-slate-800/95 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-slate-700 shadow-teal-500/10'
                : isReady
                ? 'bg-emerald-50/95 dark:bg-slate-800/95 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-emerald-500/20 scale-105'
                : 'bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 shadow-slate-900/10'
            }`}
            style={{
              transform: isRefreshing || refreshSuccess
                ? 'translateY(8px)'
                : `translateY(${Math.min(20, (pullDistance / pullThreshold) * 20)}px)`,
              opacity: isRefreshing || refreshSuccess ? 1 : Math.min(1, pullDistance / (pullThreshold * 0.5)),
            }}
          >
            {/* Status Icon */}
            <div className="w-5 h-5 flex items-center justify-center relative">
              {refreshSuccess ? (
                <Check size={16} strokeWidth={3} className="text-white animate-in zoom-in-50 duration-200" />
              ) : isRefreshing ? (
                <Loader2 size={16} className="animate-spin text-teal-600 dark:text-teal-400" />
              ) : (
                <ArrowDown
                  size={15}
                  strokeWidth={2.5}
                  className="transition-transform duration-200"
                  style={{
                    transform: isReady ? 'rotate(180deg)' : `rotate(${progressRatio * 180}deg)`,
                    color: isReady ? 'var(--color-teal-dark, #10b981)' : undefined,
                  }}
                />
              )}
            </div>

            {/* Status Text */}
            <span className="text-xs font-black tracking-wide select-none">
              {refreshSuccess
                ? 'Updated!'
                : isRefreshing
                ? 'Refreshing EcoStride...'
                : isReady
                ? 'Release to refresh'
                : 'Pull down to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Children container */}
      <div className="w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
};
