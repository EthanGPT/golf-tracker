import type { LatLng } from "./course";
import type { TeeOriginObservation } from "./domain";

export type GeoPosition = LatLng & {
  accuracyM?: number;
  capturedAt: string;
};

export type LocationErrorKind =
  "denied" | "unavailable" | "timeout" | "unsupported";
export class LocationError extends Error {
  kind: LocationErrorKind;
  constructor(kind: LocationErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

export function getCurrentPosition(): Promise<GeoPosition> {
  if (!navigator.geolocation)
    return Promise.reject(new LocationError("unsupported"));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        }),
      (error) =>
        reject(
          new LocationError(
            error.code === 1
              ? "denied"
              : error.code === 3
                ? "timeout"
                : "unavailable",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

export function watchPosition(onPosition: (position: GeoPosition) => void, onError?: (error: LocationError) => void) {
  if (!navigator.geolocation) { onError?.(new LocationError("unsupported")); return () => undefined; }
  const id = navigator.geolocation.watchPosition(
    (position) => onPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyM: position.coords.accuracy, capturedAt: new Date().toISOString() }),
    (error) => onError?.(new LocationError(error.code === 1 ? "denied" : error.code === 3 ? "timeout" : "unavailable")),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

const radians = (value: number) => (value * Math.PI) / 180;

export function distanceBetweenMeters(a: LatLng, b: LatLng) {
  const earthRadius = 6371000;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const latA = radians(a.latitude);
  const latB = radians(b.latitude);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function bearingBetween(a: LatLng, b: LatLng) {
  const latA = radians(a.latitude);
  const latB = radians(b.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const bearing =
    (Math.atan2(
      Math.sin(dLon) * Math.cos(latB),
      Math.cos(latA) * Math.sin(latB) -
        Math.sin(latA) * Math.cos(latB) * Math.cos(dLon),
    ) *
      180) /
    Math.PI;
  return (bearing + 360) % 360;
}

export const TEE_ORIGIN_ACCURACY = { usableM: 20, highConfidenceM: 10 } as const;

export function deriveLearnedTeeOrigin(observations: TeeOriginObservation[]) {
  const eligible = observations.filter(
    (observation) => observation.accuracyM !== undefined && observation.accuracyM <= TEE_ORIGIN_ACCURACY.usableM,
  );
  if (eligible.length < 3) return undefined;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const coordinate = {
    latitude: median(eligible.map((observation) => observation.latitude)),
    longitude: median(eligible.map((observation) => observation.longitude)),
  };
  const distances = eligible.map((observation) => distanceBetweenMeters(observation, coordinate));
  const spreadMetres = Math.max(...distances);
  if (spreadMetres > 25) return undefined;
  return {
    coordinate,
    sampleCount: eligible.length,
    spreadMetres,
    confidence: eligible.length >= 5 && spreadMetres <= 12 ? "high" as const : "medium" as const,
  };
}
