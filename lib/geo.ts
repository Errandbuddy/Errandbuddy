/** Great-circle distance between two lat/lng points, in kilometers. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius, km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

/** Approximate lat/lng centers for major Nigerian cities, used as a fallback
 * when a user hasn't shared precise geolocation. Contributors: replace with a
 * real geocoding provider — see ROADMAP.md. */
export const NIGERIAN_CITIES: Record<string, { lat: number; lng: number }> = {
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Abuja: { lat: 9.0765, lng: 7.3986 },
  "Port Harcourt": { lat: 4.8156, lng: 7.0498 },
  Ibadan: { lat: 7.3775, lng: 3.947 },
  Kano: { lat: 12.0022, lng: 8.592 },
  Enugu: { lat: 6.5244, lng: 7.5086 },
  Benin_City: { lat: 6.335, lng: 5.6037 },
  Kaduna: { lat: 10.5222, lng: 7.4383 },
  Uyo: { lat: 5.0378, lng: 7.9088 },
  Abeokuta: { lat: 7.1475, lng: 3.3619 }
};
