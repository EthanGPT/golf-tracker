export type WeatherContext = {
  windSpeedKmh?: number;
  windDirectionDeg?: number;
  windDirectionLabel?: string;
  temperatureC?: number;
  fetchedAt?: string;
  source?: string;
};

export type ShotWindContext = {
  windSpeedKmh: number;
  windFromDeg: number;
  shotBearingDeg: number;
  headwindKmh: number;
  tailwindKmh: number;
  crosswindKmh: number;
  crosswindDirection: "left-to-right" | "right-to-left" | "none";
  relativeAngleDeg: number;
  label: string;
};

export type WindDistanceAdjustment = {
  actualDistanceM: number;
  effectiveDistanceM: number;
  adjustmentM: number;
  adjustmentPercent: number;
  confidence: "low" | "medium" | "high";
  componentKmh: number;
  appliedComponent: "headwind" | "tailwind" | "none";
  capApplied: boolean;
};

export type RelativeWind = {
  headwindKmh: number;
  tailwindKmh: number;
  crosswindKmh: number;
  crosswindDirection: "left-to-right" | "right-to-left" | "none";
  relativeAngleDeg: number;
  label: string;
};

// Conservative V1 empirical model. This is an estimate for playing context,
// not a ball-flight simulation; coefficients are intentionally easy to tune.
export const WIND_MODEL_V1 = {
  headwindPerKmh: 0.008,
  tailwindPerKmh: 0.005,
  minComponentKmh: 2,
  maxHeadwindAdjustment: 0.3,
  maxTailwindAdjustment: 0.2,
} as const;

export function calculateWindAdjustedDistance(
  actualDistanceM: number,
  wind: ShotWindContext | undefined,
): WindDistanceAdjustment | undefined {
  if (!wind || !Number.isFinite(actualDistanceM)) return undefined;
  const headwind = wind.headwindKmh;
  const tailwind = wind.tailwindKmh;
  if (headwind < WIND_MODEL_V1.minComponentKmh && tailwind < WIND_MODEL_V1.minComponentKmh) {
    return {
      actualDistanceM,
      effectiveDistanceM: actualDistanceM,
      adjustmentM: 0,
      adjustmentPercent: 0,
      confidence: "low",
      componentKmh: Math.max(headwind, tailwind),
      appliedComponent: "none",
      capApplied: false,
    };
  }
  if (headwind >= tailwind) {
    const rawPercent = headwind * WIND_MODEL_V1.headwindPerKmh;
    const adjustmentPercent = Math.min(rawPercent, WIND_MODEL_V1.maxHeadwindAdjustment);
    return {
      actualDistanceM,
      effectiveDistanceM: actualDistanceM * (1 + adjustmentPercent),
      adjustmentM: actualDistanceM * adjustmentPercent,
      adjustmentPercent,
      confidence: "medium",
      componentKmh: headwind,
      appliedComponent: "headwind",
      capApplied: rawPercent > adjustmentPercent,
    };
  }
  const rawPercent = tailwind * WIND_MODEL_V1.tailwindPerKmh;
  const adjustmentPercent = Math.min(rawPercent, WIND_MODEL_V1.maxTailwindAdjustment);
  return {
    actualDistanceM,
    effectiveDistanceM: actualDistanceM * (1 - adjustmentPercent),
    adjustmentM: -actualDistanceM * adjustmentPercent,
    adjustmentPercent: -adjustmentPercent,
    confidence: "medium",
    componentKmh: tailwind,
    appliedComponent: "tailwind",
    capApplied: rawPercent > adjustmentPercent,
  };
}

const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

export function resolveWindRelativeToShot(input: {
  windSpeed: number;
  windFromDegrees: number;
  shotBearingDegrees: number;
}): RelativeWind {
  const windFromDeg = normalizeDegrees(input.windFromDegrees);
  const shot = normalizeDegrees(input.shotBearingDegrees);
  // Meteorological bearings describe where wind comes FROM, so reverse it to
  // obtain the direction the air actually travels.
  const windTravel = normalizeDegrees(windFromDeg + 180);
  const relativeAngleDeg = normalizeDegrees(windTravel - shot);
  const radians = (relativeAngleDeg * Math.PI) / 180;
  const alongShot = input.windSpeed * Math.cos(radians);
  const cross = input.windSpeed * Math.sin(radians);
  const headwindKmh = Math.max(0, -alongShot);
  const tailwindKmh = Math.max(0, alongShot);
  const crosswindKmh = Math.abs(cross);
  const crosswindDirection = crosswindKmh < 0.0001
    ? "none"
    : cross > 0
      ? "left-to-right"
      : "right-to-left";
  const label = headwindKmh >= 2
    ? `${Math.round(headwindKmh)} km/h headwind`
    : tailwindKmh >= 2
      ? `${Math.round(tailwindKmh)} km/h helping`
      : crosswindKmh >= 2
        ? `${Math.round(crosswindKmh)} km/h ${crosswindDirection === "left-to-right" ? "L→R" : "R→L"}`
        : "";
  return { headwindKmh, tailwindKmh, crosswindKmh, crosswindDirection, relativeAngleDeg, label };
}

/** Weather directions are meteorological: they describe where wind comes from. */
export function calculateShotWind(
  weather: WeatherContext | undefined,
  shotBearingDeg: number,
): ShotWindContext | undefined {
  if (weather?.windSpeedKmh === undefined || weather.windDirectionDeg === undefined)
    return undefined;
  const windFromDeg = normalizeDegrees(weather.windDirectionDeg);
  const shot = normalizeDegrees(shotBearingDeg);
  const relative = resolveWindRelativeToShot({
    windSpeed: weather.windSpeedKmh,
    windFromDegrees: windFromDeg,
    shotBearingDegrees: shot,
  });
  return {
    windSpeedKmh: weather.windSpeedKmh,
    windFromDeg,
    shotBearingDeg: shot,
    ...relative,
  };
}

export function formatShotWind(context: ShotWindContext, thresholdKmh = 2) {
  const components: string[] = [];
  if (context.headwindKmh >= thresholdKmh)
    components.push(`${Math.round(context.headwindKmh)} km/h headwind`);
  if (context.tailwindKmh >= thresholdKmh)
    components.push(`${Math.round(context.tailwindKmh)} km/h tailwind`);
  if (context.crosswindKmh >= thresholdKmh)
    components.push(
      `${Math.round(context.crosswindKmh)} km/h ${context.crosswindDirection === "left-to-right" ? "L→R" : "R→L"}`,
    );
  return components.join(" · ");
}

export type WeatherProvider = {
  getCurrentWeather(input: {
    latitude: number;
    longitude: number;
    timezone?: string;
  }): Promise<WeatherContext>;
};

export const WEATHER_CACHE_TTL_MS = 25 * 60 * 1000;

export function windDirectionLabel(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

export const openMeteoProvider: WeatherProvider = {
  async getCurrentWeather({ latitude, longitude, timezone }) {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,wind_speed_10m,wind_direction_10m",
      wind_speed_unit: "kmh",
      timezone: timezone || "auto",
    });
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    );
    if (!response.ok)
      throw new Error(`Weather request failed: ${response.status}`);
    const payload = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        wind_speed_10m?: number;
        wind_direction_10m?: number;
      };
    };
    const current = payload.current || {};
    const direction = current.wind_direction_10m;
    return {
      temperatureC: current.temperature_2m,
      windSpeedKmh: current.wind_speed_10m,
      windDirectionDeg: direction,
      windDirectionLabel:
        direction === undefined ? undefined : windDirectionLabel(direction),
      fetchedAt: new Date().toISOString(),
      source: "open-meteo",
    };
  },
};

type CachedWeather = { weather: WeatherContext; cachedAt: number };
const memoryCache = new Map<string, CachedWeather>();

function cacheKey(courseId: string) {
  return `weather:${courseId}`;
}

export function readCachedWeather(courseId: string): CachedWeather | undefined {
  try {
    if (typeof localStorage === "undefined") return memoryCache.get(courseId);
    const raw = localStorage.getItem(cacheKey(courseId));
    return raw ? (JSON.parse(raw) as CachedWeather) : undefined;
  } catch {
    return undefined;
  }
}

export async function getCourseWeather(
  courseId: string,
  coordinates: { latitude: number; longitude: number; timezone?: string },
  provider: WeatherProvider = openMeteoProvider,
) {
  const cached = readCachedWeather(courseId);
  if (cached && Date.now() - cached.cachedAt < WEATHER_CACHE_TTL_MS)
    return cached.weather;
  try {
    const weather = await provider.getCurrentWeather(coordinates);
    const entry = { weather, cachedAt: Date.now() } satisfies CachedWeather;
    memoryCache.set(courseId, entry);
    if (typeof localStorage !== "undefined")
      localStorage.setItem(cacheKey(courseId), JSON.stringify(entry));
    return weather;
  } catch {
    return cached?.weather;
  }
}
