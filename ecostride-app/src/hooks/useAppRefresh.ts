import { useEffect, useRef } from 'react';

/**
 * Hook for components/views to register a refresh callback with the global PullToRefresh mechanism.
 * The callback's returned Promise (if any) will be tracked so the PullToRefresh indicator waits
 * until the view finishes refreshing its data.
 */
export function useAppRefresh(callback: () => Promise<any> | void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent<{ registerPromise?: (p: Promise<any>) => void }>;
      try {
        const result = callbackRef.current();
        if (result && typeof (result as any).then === 'function' && customEvent.detail?.registerPromise) {
          customEvent.detail.registerPromise(result);
        }
      } catch (err) {
        console.error('Error executing view refresh callback:', err);
      }
    };

    window.addEventListener('app:refresh', handleRefresh);
    return () => {
      window.removeEventListener('app:refresh', handleRefresh);
    };
  }, []);
}
