import { BackgroundGeolocation, type Location, type CallbackError } from '@capgo/background-geolocation';
import { CapacitorPedometer, type MeasurementEvent } from '@capgo/capacitor-pedometer';
import type { PluginListenerHandle } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import * as turf from '@turf/turf';
import { apiClient } from './api';

const PREF_WALK_ID = 'active_walk_id';
const PREF_START_TIME = 'walk_start_time';
const PREF_DISTANCE = 'walk_distance_km';
const PREF_LAST_LAT = 'walk_last_lat';
const PREF_LAST_LNG = 'walk_last_lng';
const PREF_NAV_TARGET = 'walk_nav_target';
const PREF_CHEAT_DISTANCE = 'walk_cheat_distance_km';
const PREF_SPOOFED_COUNT = 'walk_spoofed_count';
const PREF_LAST_TIME = 'walk_last_time';
const PREF_STEPS = 'walk_steps';

export interface NavTarget {
  id?: string;
  storeName?: string;
  category?: string;
  location: [number, number];
  offers?: any[];
}

// MAX_ACCURACY_METERS: We set this to 150m to ensure GPS points are reasonably accurate.
const MAX_ACCURACY_METERS = 150;

let pedometerListener: PluginListenerHandle | null = null;
let latestSpeedKmh = 0;

export async function getCurrentSpeedKmh(): Promise<number> {
  return latestSpeedKmh;
}

export async function startWalkSession(target?: NavTarget): Promise<string | null> {
  try {
    // 0. Anti-Cheat: Pedometer Permissions (Foreground & Background)
    try {
      let perm = await CapacitorPedometer.checkPermissions();
      if (perm.activityRecognition !== 'granted') {
        perm = await CapacitorPedometer.requestPermissions();
      }
    } catch (e) {
      console.warn('Pedometer permission check failed, continuing without it.', e);
    }

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
    await Preferences.remove({ key: PREF_NAV_TARGET });
    await Preferences.remove({ key: PREF_CHEAT_DISTANCE });
    await Preferences.remove({ key: PREF_SPOOFED_COUNT });
    await Preferences.remove({ key: PREF_LAST_TIME });
    await Preferences.remove({ key: PREF_STEPS });

    await Preferences.set({ key: PREF_WALK_ID, value: walkId });
    await Preferences.set({ key: PREF_START_TIME, value: res.startedAt });
    await Preferences.set({ key: PREF_DISTANCE, value: '0' });
    await Preferences.set({ key: PREF_CHEAT_DISTANCE, value: '0' });
    await Preferences.set({ key: PREF_SPOOFED_COUNT, value: '0' });
    await Preferences.set({ key: PREF_LAST_TIME, value: Date.now().toString() });
    await Preferences.set({ key: PREF_STEPS, value: '0' });

    if (target) {
      await Preferences.set({ key: PREF_NAV_TARGET, value: JSON.stringify(target) });
    }

    // 2.5 Start Pedometer
    try {
      if (pedometerListener) {
        await pedometerListener.remove();
      }
      pedometerListener = await CapacitorPedometer.addListener('measurement', async (event: MeasurementEvent) => {
        if (event.numberOfSteps !== undefined) {
          // Capgo Pedometer often returns absolute steps during the session. 
          // We will just store the latest value reported.
          await Preferences.set({ key: PREF_STEPS, value: event.numberOfSteps.toString() });
        }
      });
      await CapacitorPedometer.startMeasurementUpdates();
    } catch (e) {
      console.warn('Failed to start pedometer, device might not support it:', e);
    }

    // 3. Configure and start Capgo tracking
    // NOTE: Capgo expects a sync (void) callback, not async.
    // We wrap the async work inside a void callback with error handling.
    await BackgroundGeolocation.start(
      {
        backgroundMessage: 'EcoStride: Walk Mode active. Tracking your walking route.',
        backgroundTitle: 'EcoStride Walk Mode',
        requestPermissions: true,
        stale: false,
        distanceFilter: 5,
      },
      (location: Location | undefined, error: CallbackError | undefined) => {
        if (error) {
          console.error('Background Geolocation error:', error);
          return;
        }
        if (!location) return;

        if (location.accuracy > MAX_ACCURACY_METERS) {
          console.log(`Skipping inaccurate GPS point: accuracy=${location.accuracy}m`);
          return;
        }

        // Run async Preferences work inside a void callback
        void (async () => {
          try {
            const walkIdObj = await Preferences.get({ key: PREF_WALK_ID });
            if (!walkIdObj.value) return; // Walk not active

            // Anti-cheat: Detect Mock Location
            let isSpoofed = false;
            if (location.simulated) {
              const spoofedStr = await Preferences.get({ key: PREF_SPOOFED_COUNT });
              const spoofedCount = parseInt(spoofedStr.value || '0', 10) + 1;
              await Preferences.set({ key: PREF_SPOOFED_COUNT, value: spoofedCount.toString() });
              console.warn('Anti-Cheat: Mock Location detected!');
              isSpoofed = true;
            }

            const lastLatStr = await Preferences.get({ key: PREF_LAST_LAT });
            const lastLngStr = await Preferences.get({ key: PREF_LAST_LNG });
            const lastTimeStr = await Preferences.get({ key: PREF_LAST_TIME });
            const distanceStr = await Preferences.get({ key: PREF_DISTANCE });
            const cheatDistanceStr = await Preferences.get({ key: PREF_CHEAT_DISTANCE });

            let lastLat = 0;
            let lastLng = 0;
            if (lastLatStr.value && lastLngStr.value) {
              lastLat = parseFloat(lastLatStr.value);
              lastLng = parseFloat(lastLngStr.value);
            }

            let safeLocationTime = location.time;
            if (safeLocationTime && safeLocationTime < 1000000000000) {
              safeLocationTime *= 1000; // Convert seconds to milliseconds
            }

            if (!lastLat || !lastLng || isNaN(lastLat) || isNaN(lastLng)) {
              // First point of the session, just initialize and return
              await Preferences.set({ key: PREF_LAST_LAT, value: location.latitude.toString() });
              await Preferences.set({ key: PREF_LAST_LNG, value: location.longitude.toString() });
              await Preferences.set({ key: PREF_LAST_TIME, value: (safeLocationTime || Date.now()).toString() });
              return;
            }

            let currentDistance = parseFloat(distanceStr.value || '0');
            let currentCheatDistance = parseFloat(cheatDistanceStr.value || '0');

            const currentLat = location.latitude;
            const currentLng = location.longitude;

            if (!isNaN(lastLat) && !isNaN(lastLng) && !isNaN(currentLat) && !isNaN(currentLng)) {
              const from = turf.point([lastLng, lastLat]);
              const to = turf.point([currentLng, currentLat]);
              const dist = turf.distance(from, to, { units: 'kilometers' });

              if (!isNaN(dist)) {
                let speedKmh = 0;
                // Use location.speed directly if available, otherwise calculate using math
                if (typeof location.speed === 'number' && location.speed > 0) {
                  speedKmh = location.speed * 3.6;
                } else {
                  const lastTime = parseInt(lastTimeStr.value || '0', 10);
                  const currentTime = safeLocationTime || Date.now();
                  const dtSec = Math.max(1, (currentTime - lastTime) / 1000); // Prevent division by zero
                  speedKmh = (dist / dtSec) * 3600;
                }
                
                latestSpeedKmh = speedKmh;

                // Routing all distance to either Cheat or Valid
                if (isSpoofed || dist > 0.15 || speedKmh > 35) {
                  if (dist > 0.15) console.log(`Anti-drift: Penalizing jump of ${dist * 1000}m as cheat distance`);
                  currentCheatDistance += dist;
                  await Preferences.set({ key: PREF_CHEAT_DISTANCE, value: currentCheatDistance.toString() });
                } else {
                  currentDistance += dist;
                  await Preferences.set({ key: PREF_DISTANCE, value: currentDistance.toString() });
                }
              }
            }

            await Preferences.set({ key: PREF_LAST_LAT, value: location.latitude.toString() });
            await Preferences.set({ key: PREF_LAST_LNG, value: location.longitude.toString() });
            await Preferences.set({ key: PREF_LAST_TIME, value: (safeLocationTime || Date.now()).toString() });
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

export async function resumeWalkSession(): Promise<boolean> {
  try {
    const walkIdObj = await Preferences.get({ key: PREF_WALK_ID });
    if (!walkIdObj.value) return false;

    // 1. Restart Pedometer
    try {
      if (pedometerListener) {
        await pedometerListener.remove();
      }
      pedometerListener = await CapacitorPedometer.addListener('measurement', async (event: MeasurementEvent) => {
        if (event.numberOfSteps !== undefined) {
          await Preferences.set({ key: PREF_STEPS, value: event.numberOfSteps.toString() });
        }
      });
      await CapacitorPedometer.startMeasurementUpdates();
    } catch (e) {
      console.warn('Failed to resume pedometer:', e);
    }

    // 2. Restart Capgo Background Geolocation watcher
    await BackgroundGeolocation.start(
      {
        backgroundMessage: 'EcoStride: Walk Mode active. Tracking your walking route.',
        backgroundTitle: 'EcoStride Walk Mode',
        requestPermissions: true,
        stale: false,
        distanceFilter: 5,
      },
      (location: Location | undefined, error: CallbackError | undefined) => {
        if (error) {
          console.error('Background Geolocation error:', error);
          return;
        }
        if (!location) return;

        if (location.accuracy > MAX_ACCURACY_METERS) {
          console.log(`Skipping inaccurate GPS point: accuracy=${location.accuracy}m`);
          return;
        }

        // Run async Preferences work inside a void callback
        void (async () => {
          try {
            const activeWalk = await Preferences.get({ key: PREF_WALK_ID });
            if (!activeWalk.value) return; // Walk not active

            // Anti-cheat: Detect Mock Location
            let isSpoofed = false;
            if (location.simulated) {
              const spoofedStr = await Preferences.get({ key: PREF_SPOOFED_COUNT });
              const spoofedCount = parseInt(spoofedStr.value || '0', 10) + 1;
              await Preferences.set({ key: PREF_SPOOFED_COUNT, value: spoofedCount.toString() });
              console.warn('Anti-Cheat: Mock Location detected!');
              isSpoofed = true;
            }

            const lastLatStr = await Preferences.get({ key: PREF_LAST_LAT });
            const lastLngStr = await Preferences.get({ key: PREF_LAST_LNG });
            const lastTimeStr = await Preferences.get({ key: PREF_LAST_TIME });
            const distanceStr = await Preferences.get({ key: PREF_DISTANCE });
            const cheatDistanceStr = await Preferences.get({ key: PREF_CHEAT_DISTANCE });

            let lastLat = 0;
            let lastLng = 0;
            if (lastLatStr.value && lastLngStr.value) {
              lastLat = parseFloat(lastLatStr.value);
              lastLng = parseFloat(lastLngStr.value);
            }

            let safeLocationTime = location.time;
            if (safeLocationTime && safeLocationTime < 1000000000000) {
              safeLocationTime *= 1000; // Convert seconds to milliseconds
            }

            if (!lastLat || !lastLng || isNaN(lastLat) || isNaN(lastLng)) {
              await Preferences.set({ key: PREF_LAST_LAT, value: location.latitude.toString() });
              await Preferences.set({ key: PREF_LAST_LNG, value: location.longitude.toString() });
              await Preferences.set({ key: PREF_LAST_TIME, value: (safeLocationTime || Date.now()).toString() });
              return;
            }

            let currentDistance = parseFloat(distanceStr.value || '0');
            let currentCheatDistance = parseFloat(cheatDistanceStr.value || '0');

            const currentLat = location.latitude;
            const currentLng = location.longitude;

            if (!isNaN(lastLat) && !isNaN(lastLng) && !isNaN(currentLat) && !isNaN(currentLng)) {
              const from = turf.point([lastLng, lastLat]);
              const to = turf.point([currentLng, currentLat]);
              const dist = turf.distance(from, to, { units: 'kilometers' });

              if (!isNaN(dist)) {
                let speedKmh = 0;
                if (typeof location.speed === 'number' && location.speed > 0) {
                  speedKmh = location.speed * 3.6;
                } else {
                  const lastTime = parseInt(lastTimeStr.value || '0', 10);
                  const currentTime = safeLocationTime || Date.now();
                  const dtSec = Math.max(1, (currentTime - lastTime) / 1000);
                  speedKmh = (dist / dtSec) * 3600;
                }
                
                latestSpeedKmh = speedKmh;

                if (isSpoofed || dist > 0.15 || speedKmh > 35) {
                  if (dist > 0.15) console.log(`Anti-drift: Penalizing jump of ${dist * 1000}m as cheat distance`);
                  currentCheatDistance += dist;
                  await Preferences.set({ key: PREF_CHEAT_DISTANCE, value: currentCheatDistance.toString() });
                } else {
                  currentDistance += dist;
                  await Preferences.set({ key: PREF_DISTANCE, value: currentDistance.toString() });
                }
              }
            }

            await Preferences.set({ key: PREF_LAST_LAT, value: location.latitude.toString() });
            await Preferences.set({ key: PREF_LAST_LNG, value: location.longitude.toString() });
            await Preferences.set({ key: PREF_LAST_TIME, value: (safeLocationTime || Date.now()).toString() });
          } catch (err) {
            console.error('Error processing background location (resume):', err);
          }
        })();
      }
    );
    return true;
  } catch (err) {
    console.error('Error resuming walk session:', err);
    return false;
  }
}

export async function stopWalkSession(): Promise<{ distance: number, cheatDistance?: number, coins: number, penaltyStatus?: string, penaltyReason?: string } | null> {
  try {
    // 1. Get local data FIRST (before stopping native service)
    const walkIdObj = await Preferences.get({ key: PREF_WALK_ID });
    const distanceStr = await Preferences.get({ key: PREF_DISTANCE });
    const cheatDistanceStr = await Preferences.get({ key: PREF_CHEAT_DISTANCE });
    const spoofedCountStr = await Preferences.get({ key: PREF_SPOOFED_COUNT });
    const stepsStr = await Preferences.get({ key: PREF_STEPS });

    if (!walkIdObj.value) {
      console.log('No active walk session to stop');
      // Still attempt to stop native service in case it's orphaned
      await BackgroundGeolocation.stop().catch(() => { });
      await CapacitorPedometer.stopMeasurementUpdates().catch(() => { });
      return null;
    }

    const walkId = walkIdObj.value;
    const distance = parseFloat(distanceStr.value || '0');
    const cheatDistance = parseFloat(cheatDistanceStr.value || '0');
    const spoofedCount = parseInt(spoofedCountStr.value || '0', 10);
    const steps = parseInt(stepsStr.value || '0', 10);

    // 2. Finalize on backend FIRST (before stopping native service)
    // Send full telemetry to Cloudflare AI for final verdict
    const res = await apiClient(`/walks/${walkId}/end`, {
      method: 'POST',
      body: JSON.stringify({
        distance_km: distance,
        cheat_distance_km: cheatDistance,
        spoofed_count: spoofedCount,
        steps: steps,
        activity_time_minutes: { WALKING: 0 } // We can simulate this if needed
      }),
    });

    if (res.error) {
      throw new Error(res.error);
    }

    // 3. Backend succeeded — NOW stop native tracking
    await BackgroundGeolocation.stop();
    await CapacitorPedometer.stopMeasurementUpdates();
    if (pedometerListener) {
      await pedometerListener.remove();
      pedometerListener = null;
    }

    // 4. Clear local state only after everything succeeded
    await Preferences.remove({ key: PREF_WALK_ID });
    await Preferences.remove({ key: PREF_START_TIME });
    await Preferences.remove({ key: PREF_DISTANCE });
    await Preferences.remove({ key: PREF_CHEAT_DISTANCE });
    await Preferences.remove({ key: PREF_SPOOFED_COUNT });
    await Preferences.remove({ key: PREF_LAST_TIME });
    await Preferences.remove({ key: PREF_LAST_LAT });
    await Preferences.remove({ key: PREF_LAST_LNG });
    await Preferences.remove({ key: PREF_NAV_TARGET });
    await Preferences.remove({ key: PREF_STEPS });

    return {
      distance: res.distance_km,
      cheatDistance: res.cheat_distance_km,
      coins: res.coinsAwarded,
      penaltyStatus: res.penaltyStatus,
      penaltyReason: res.penaltyReason
    };
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

export async function getCurrentCheatDistance(): Promise<number> {
  const cheatDistanceStr = await Preferences.get({ key: PREF_CHEAT_DISTANCE });
  return parseFloat(cheatDistanceStr.value || '0');
}

export async function getNavTarget(): Promise<NavTarget | null> {
  const { value } = await Preferences.get({ key: PREF_NAV_TARGET });
  if (!value) return null;
  try {
    return JSON.parse(value) as NavTarget;
  } catch (e) {
    return null;
  }
}

export async function saveNavTarget(target: NavTarget | null): Promise<void> {
  if (target) {
    await Preferences.set({ key: PREF_NAV_TARGET, value: JSON.stringify(target) });
  } else {
    await Preferences.remove({ key: PREF_NAV_TARGET });
  }
}
