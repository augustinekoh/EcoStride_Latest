import { useState, useEffect, useMemo, useRef } from 'react';
import * as turf from '@turf/turf';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useMapStore } from '../../stores/useMapStore';
import { useDemoStore } from '../../stores/useDemoStore';

export const useMapGeolocation = () => {
  const { currentMode, demoProgress, setActiveView } = useDemoStore();
  const { 
    liveLocation, setLiveLocation, 
    activeRouteGeoJSON, distanceToTarget,
    isWalkModeActive,
    walkedDistanceKm, setWalkedDistanceKm,
    isFreeWalk, setIsFreeWalk
  } = useMapStore();

  const [bearing, setBearing] = useState<number | null>(null);

  // 1. Real-time GPS Tracking
  useEffect(() => {
    let watchIdPromise: Promise<string>;

    const setupGeolocation = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const perm = await Geolocation.checkPermissions();
          if (perm.location !== 'granted') {
            await Geolocation.requestPermissions();
          }
        }
        
        watchIdPromise = Geolocation.watchPosition(
          { enableHighAccuracy: true },
          (pos, err) => {
            if (err) {
              console.warn('GPS watchPosition error:', err);
              // Only kick out if they explicitly denied permissions
              if (Capacitor.isNativePlatform()) {
                Geolocation.checkPermissions().then(perm => {
                  if (perm.location !== 'granted') {
                    alert('GPS location permission is required to access the map. Please allow location access in settings and try again.');
                    setActiveView('landing');
                  }
                }).catch(() => {});
              }
              return;
            }
            if (pos) {
              setLiveLocation([pos.coords.longitude, pos.coords.latitude]);
            }
          }
        );
      } catch (err) {
        console.error('Geolocation init error:', err);
        alert('Could not start GPS tracking.');
      }
    };

    setupGeolocation();

    return () => {
      if (watchIdPromise) {
        watchIdPromise.then(id => {
          if (id) Geolocation.clearWatch({ id });
        });
      }
    };
  }, [setLiveLocation, setActiveView]);

  // 2. Determine the current coordinate (Live GPS vs Demo Interpolation)
  const currentCoordinate = useMemo(() => {
    if (currentMode !== 'demo' || !activeRouteGeoJSON) {
      return liveLocation || [0, 0]; // It should never hit the fallback now since MapView blocks rendering
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
          
          // BUG FIX: Anti-Teleport Filter for Foreground Tracker
          // If the distance jump is > 200 meters in a single tick, it's a GPS drift or Simulator teleport.
          if (distance < 200) {
            additionalDistance = distance / 1000;
          } else {
            console.log(`Foreground tracker skipping unrealistic jump: ${distance} meters`);
          }
        }
      }
      prevCoordRef.current = currentCoordinate as [number, number];

      if (additionalDistance > 0 && !isWalkModeActive) {
        setWalkedDistanceKm(prev => prev + additionalDistance);
      }
      if (calculatedBearing !== null) {
        setBearing(calculatedBearing);
      }
    }
  }, [currentCoordinate, currentMode, distanceToTarget, activeRouteGeoJSON, isFreeWalk, isWalkModeActive]);

  return {
    currentCoordinate,
    walkedDistanceKm,
    setWalkedDistanceKm,
    isFreeWalk,
    setIsFreeWalk,
    bearing
  };
};
