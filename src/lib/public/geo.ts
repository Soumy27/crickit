/**
 * Distances, for "near me".
 *
 * A ground's position is stored to two decimal places, about a kilometre. That
 * finds the ground without pinning a scorer's phone, or anyone's house, to a spot.
 */

export interface Place {
  lat: number;
  lng: number;
}

export const NEARBY_KM = 50;

export function validPlace(lat: unknown, lng: unknown): Place | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function coarsePlace({ lat, lng }: Place): Place {
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance, which is what the haversine formula gives. */
export function distanceKm(a: Place, b: Place): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A box around a point: cheap for the database to filter before the exact distance. */
export function boundingBox({ lat, lng }: Place, km: number) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(0.01, Math.cos(toRadians(lat))));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}
