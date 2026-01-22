import type { LatLng } from "./types";

/**
 * Haversine distance in yards.
 */
export function distanceYds(a: LatLng, b: LatLng): number {
  const R = 6371e3; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;

  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);

  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ),
      Math.sqrt(1 - (sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ))
    );

  const meters = R * c;
  return meters * 1.0936133; // meters -> yards
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}
/**
 * Move a point by distance (yards) along a bearing (degrees).
 * Uses a spherical approximation; good enough for golf-scale distances.
 */
export function moveLatLngByYds(origin: LatLng, bearingDegIn: number, distanceYds: number): LatLng {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const distanceMeters = distanceYds / 1.0936133;
  const R = 6371e3;

  const brng = toRad(bearingDegIn);
  const φ1 = toRad(origin.lat);
  const λ1 = toRad(origin.lng);

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(distanceMeters / R) +
      Math.cos(φ1) * Math.sin(distanceMeters / R) * Math.cos(brng)
  );

  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distanceMeters / R) * Math.cos(φ1),
      Math.cos(distanceMeters / R) - Math.sin(φ1) * Math.sin(φ2)
    );

  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}
