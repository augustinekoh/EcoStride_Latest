import { useState, useEffect, useMemo, useRef } from 'react';
import * as turf from '@turf/turf';
import { useMapStore } from '../../stores/useMapStore';
import { useDemoStore } from '../../stores/useDemoStore';

export const useMapGeolocation = () => {
  const { currentMode, demoProgress, setActiveView } = useDemoStore();
  const { 
    liveLocation, setLiveLocation, 
    activeRouteGeoJSON, distanceToTarget 
  } = useMapStore();

  const [walkedDistanceKm, setWalkedDistanceKm] = useState(0);
  const [isFreeWalk, setIsFreeWalk] = useState(false);
  const [bearing, setBearing] = useState<number | null>(null);

  // 1. Real-time GPS Tracking
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLiveLocation([pos.coords.longitude, pos.coords.latitude]);
      },
      (err) => {
        console.log('GPS Error:', err);
        if (!window.isSecureContext) {
          alert("⚠️ Note: Your mobile browser blocks real GPS over HTTP. Using a mock location for testing.");
          setLiveLocation([103.6400, 1.5600]);
        } else {
          alert('GPS location permission is required to access the map. Please allow location access and try again.');
          setActiveView('landing');
        }
      },
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [setLiveLocation, setActiveView]);

  // 2. Determine the current coordinate (Live GPS vs Demo Interpolation)
  const currentCoordinate = useMemo(() => {
    if (currentMode !== 'demo' || !activeRouteGeoJSON) {
      return liveLocation || [103.6400, 1.5600];
    }
    
    const coords = activeRouteGeoJSON.geometry.coordinates;
    if (!coords || coords.length === 0) return liveLocation || [103.6400, 1.5600];
    if (demoProgress === 0) return coords[0] as [number, number];
    if (demoProgress >= 100) return coords[coords.length - 1] as [number, number];

    const line = turf.lineString(coords);
    const totalLength = turf.length(line, { units: 'meters' });
    const targetDistance = (demoProgress / 100) * totalLength;
    const currentPoint = turf.along(line, targetDistance, { units: 'meters' });
    return currentPoint.geometry.coordinates as [number, number];
  }, [demoProgress, currentMode, liveLocation, activeRouteGeoJSON]);

  // 3. Auto-follow bearing calculation and walked distance accumulator
  const prevCoordRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    const isActiveNavigation = ((currentMode === 'explore' || currentMode === 'demo') && distanceToTarget !== null && activeRouteGeoJSON);
    
    if (isActiveNavigation || isFreeWalk) {
      let calculatedBearing: number | null = null;
      let additionalDistance = 0;

      if (prevCoordRef.current) {
        const distance = turf.distance(turf.point(prevCoordRef.current), turf.point(currentCoordinate), { units: 'meters' });
        // Only update bearing if moved at least 1 meter to prevent jittering when standing still
        if (distance > 1) {
          calculatedBearing = turf.bearing(turf.point(prevCoordRef.current), turf.point(currentCoordinate));
          additionalDistance = distance / 1000;
        }
      }
      prevCoordRef.current = currentCoordinate;

      if (additionalDistance > 0) {
        setWalkedDistanceKm(prev => prev + additionalDistance);
      }
      if (calculatedBearing !== null) {
        setBearing(calculatedBearing);
      }
    }
  }, [currentCoordinate, currentMode, distanceToTarget, activeRouteGeoJSON, isFreeWalk]);

  return {
    currentCoordinate,
    walkedDistanceKm,
    setWalkedDistanceKm,
    isFreeWalk,
    setIsFreeWalk,
    bearing
  };
};
