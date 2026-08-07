export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const getWalkingRoute = async (start: [number, number], end: [number, number]) => {
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return {
        geoJson: data.routes[0].geometry,
        distanceKm: (data.routes[0].distance / 1000).toFixed(2)
      };
    }
  } catch (err) {
    console.error('Failed to fetch route', err);
  }
  return null;
};

// Haversine distance in meters
export const getDistanceMeters = (loc1: [number, number], loc2: [number, number]) => {
  const R = 6371e3; // metres
  const φ1 = loc1[1] * Math.PI/180;
  const φ2 = loc2[1] * Math.PI/180;
  const Δφ = (loc2[1]-loc1[1]) * Math.PI/180;
  const Δλ = (loc2[0]-loc1[0]) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};
