import { BackgroundGeolocation, type Location, type CallbackError } from '@capgo/background-geolocation';
import { Preferences } from '@capacitor/preferences';
import * as turf from '@turf/turf';
import { apiClient } from './api';

const PREF_WALK_ID = 'active_walk_id';
const PREF_START_TIME = 'walk_start_time';
const PREF_DISTANCE = 'walk_distance_km';
const PREF_LAST_LAT = 'walk_last_lat';
const PREF_LAST_LNG = 'walk_last_lng';

// Minimum GPS accuracy in meters to accept a location update
const MAX_ACCURACY_METERS = 50;

export async function startWalkSession(): Promise<string | null> {
  try {
    // 1. Call backend to start
    const res = await apiClient('/walks/start', { method: 'POST' });
    if (!res.walkId) throw new Error('Failed to start walk on backend');

    const walkId = res.walkId;

    // 2. Clear previous prefs
    await Preferences.remove({ key: PREF_WALK_ID });
    await Preferences.remove({ key: PREF_START_TIME });
    await Preferences.remove({ key: PREF_DISTANCE });
    await Preferences.remove({ key: PREF_LAST_LAT });
    await Preferences.remove({ key: PREF_LAST_LNG });

    await Preferences.set({ key: PREF_WALK_ID, value: walkId });
    await Preferences.set({ key: PREF_START_TIME, value: res.startedAt });
    await Preferences.set({ key: PREF_DISTANCE, value: '0' });

    // 3. Configure and start Capgo tracking
    // NOTE: Capgo expects a sync (void) callback, not async.
    // We wrap the async work inside a void callback with error handling.
    await BackgroundGeolocation.start(
      {
        backgroundMessage: 'EcoStride: Walk Mode active. Tracking your walking route.',
        backgroundTitle: 'EcoStride Walk Mode',
        requestPermissions: true,
        stale: false,
        distanceFilter: 10,
      },
      (location: Location | undefined, error: CallbackError | undefined) => {
        if (error) {
          console.error('Background Geolocation error:', error);
          return;
        }
        if (!location) return;

        // BUG 6 FIX: Filter out inaccurate GPS points
        if (location.accuracy > MAX_ACCURACY_METERS) {
          console.log(`Skipping inaccurate GPS point: accuracy=${location.accuracy}m`);
          return;
        }

        // Run async Preferences work inside a void callback
        void (async () => {
          try {
            const walkIdObj = await Preferences.get({ key: PREF_WALK_ID });
            if (!walkIdObj.value) return; // Walk not active

            const lastLatStr = await Preferences.get({ key: PREF_LAST_LAT });
            const lastLngStr = await Preferences.get({ key: PREF_LAST_LNG });
            const distanceStr = await Preferences.get({ key: PREF_DISTANCE });

            let currentDistance = parseFloat(distanceStr.value || '0');

            if (lastLatStr.value && lastLngStr.value) {
              const from = turf.point([parseFloat(lastLngStr.value), parseFloat(lastLatStr.value)]);
              const to = turf.point([location.longitude, location.latitude]);

              const dist = turf.distance(from, to, { units: 'kilometers' });
              currentDistance += dist;
              await Preferences.set({ key: PREF_DISTANCE, value: currentDistance.toString() });
            }

            await Preferences.set({ key: PREF_LAST_LAT, value: location.latitude.toString() });
            await Preferences.set({ key: PREF_LAST_LNG, value: location.longitude.toString() });
          } catch (err) {
            console.error('Error processing background location:', err);
          }
        })();
      }
    );

    return walkId;
  } catch (err) {
    console.error('Error starting walk session:', err);
    return null;
  }
}

export async function stopWalkSession(): Promise<{ distance: number, coins: number } | null> {
  try {
    // 1. Get local data FIRST (before stopping native service)
    const walkIdObj = await Preferences.get({ key: PREF_WALK_ID });
    const distanceStr = await Preferences.get({ key: PREF_DISTANCE });

    if (!walkIdObj.value) {
      console.log('No active walk session to stop');
      // Still attempt to stop native service in case it's orphaned
      await BackgroundGeolocation.stop().catch(() => {});
      return null;
    }

    const walkId = walkIdObj.value;
    const distance = parseFloat(distanceStr.value || '0');

    // 2. Finalize on backend FIRST (before stopping native service)
    // This way if backend fails, native service keeps running and user can retry
    const res = await apiClient(`/walks/${walkId}/end`, {
      method: 'POST',
      body: JSON.stringify({ distance_km: distance }),
    });

    if (res.error) {
      throw new Error(res.error);
    }

    // 3. Backend succeeded — NOW stop native tracking
    await BackgroundGeolocation.stop();

    // 4. Clear local state only after everything succeeded
    await Preferences.remove({ key: PREF_WALK_ID });
    await Preferences.remove({ key: PREF_START_TIME });
    await Preferences.remove({ key: PREF_DISTANCE });
    await Preferences.remove({ key: PREF_LAST_LAT });
    await Preferences.remove({ key: PREF_LAST_LNG });

    return { distance: res.distance_km, coins: res.coinsAwarded };
  } catch (err) {
    console.error('Error stopping walk session:', err);
    // Do NOT clear Preferences or stop native service here, so user can retry
    throw err;
  }
}

export async function isWalkTrackingActive(): Promise<boolean> {
  const walkIdObj = await Preferences.get({ key: PREF_WALK_ID });
  return !!walkIdObj.value;
}

export async function getCurrentWalkDistance(): Promise<number> {
  const distanceStr = await Preferences.get({ key: PREF_DISTANCE });
  return parseFloat(distanceStr.value || '0');
}
