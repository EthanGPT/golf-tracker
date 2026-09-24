import type {
  CourseDefinition,
  HazardDefinition,
  HazardType,
  HoleDefinition,
  LatLng,
  TeeBox,
  TeeDefinition,
} from "./course";

export type GeometryConfidence = "verified" | "probable" | "unresolved";
export type FeatureProvenance = {
  source: string;
  sourceId?: string;
  confidence: GeometryConfidence;
  fetchedAt?: string;
  attribution?: string;
  sourceUrl?: string;
  association?: "explicit-hole" | "inferred" | "cross-source" | "unresolved";
  centreMethod?: "explicit-centre" | "front-centre-back" | "polygon-centroid";
};
export type CourseSearchResult = {
  externalId: string;
  name: string;
  locationName?: string;
  latitude: number;
  longitude: number;
};
export type ExternalCourseMetadata = CourseSearchResult & {
  tees?: { id: string; name: string; colour?: string }[];
  holes?: {
    number: number;
    par?: number;
    distancesM?: Record<string, number>;
  }[];
};
export type ExternalGeometryFeature = {
  id: string;
  kind:
    | "hole"
    | "green"
    | "tee"
    | "bunker"
    | "water_hazard"
    | "lateral_water_hazard"
    | "out_of_bounds"
    | "pin"
    | "target"
    | "centreline";
  ref?: string;
  par?: number;
  tee?: string;
  greenPart?: "front" | "centre" | "back";
  points: LatLng[];
  provenance: FeatureProvenance;
};
export type ExternalCourseGeometry = {
  features: ExternalGeometryFeature[];
  attribution: string;
  fetchedAt: string;
  diagnostics?: {
    requested: number;
    successful: number;
    failures: { hole: number; status?: number; error?: string; url: string }[];
  };
};
export type CachedCourse = {
  course: CourseDefinition;
  provenance: FeatureProvenance[];
  providerIds: string[];
  fetchedAt: string;
  schemaVersion: number;
  providerVersion?: string;
  geometryCoverage?: { greenCentres: number; expectedHoles: number };
};

export type HoleGeometryMatch = {
  holeNumber?: number;
  confidence: GeometryConfidence;
  score: number;
  reason: string;
};

export type OsmResolutionReport = {
  resolvedGreenCount: number;
  unresolvedGreenCount: number;
  resolvedTeeCount: number;
  unresolvedTeeCount: number;
  resolvedHazardCount: number;
  unresolvedHazardCount: number;
  perHole: Record<number, HoleGeometryMatch>;
  ambiguousClusters: string[];
};

export const GOLFTRAXX_HERMANUS_PROVIDER_VERSION = "golftraxx-public-2026-09-24";

export interface CourseMetadataProvider {
  searchCourses(query: string): Promise<CourseSearchResult[]>;
  getCourseDetails(externalId: string): Promise<ExternalCourseMetadata>;
}
export interface CourseGeometryProvider {
  getCourseGeometry(input: {
    latitude: number;
    longitude: number;
    courseName?: string;
  }): Promise<ExternalCourseGeometry>;
}

const coordinate = (value: string | undefined) => {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function parseGolfTraxxHtml(
  html: string,
  holeNumber: number,
  sourceUrl?: string,
): ExternalGeometryFeature[] {
  const read = (name: string) =>
    coordinate(html.match(new RegExp(`var\\s+${name}\\s*=\\s*["']([^"']+)["']`))?.[1]);
  const parts = (["front", "centre", "back"] as const)
    .map((part) => {
      const latitudeName = part === "front" ? "gflatitude" : part === "back" ? "gblatitude" : "gclatitude";
      const longitudeName = part === "front" ? "gflongitude" : part === "back" ? "gblongitude" : "gclongitude";
      return { part, latitude: read(latitudeName), longitude: read(longitudeName) };
    })
    .filter((part): part is { part: "front" | "centre" | "back"; latitude: number; longitude: number } => part.latitude !== undefined && part.longitude !== undefined);
  if (!parts.some((part) => part.part === "centre")) return [];
  const provenance = {
    source: "golftraxx-public",
    sourceId: `hole/${holeNumber}`,
    sourceUrl,
    confidence: "verified" as const,
    association: "explicit-hole" as const,
    centreMethod: "front-centre-back" as const,
    attribution: "GolfTraxx public course data",
  };
  const features: ExternalGeometryFeature[] = parts.map(({ part, latitude, longitude }) => ({
      id: `golftraxx/green/${holeNumber}/${part}`,
      kind: "green",
      ref: String(holeNumber),
      greenPart: part,
      points: [{ latitude, longitude }],
      provenance,
    }));
  const teeLat = read("ttlatitude");
  const teeLong = read("ttlongitude");
  if (teeLat !== undefined && teeLong !== undefined) {
    features.push({
      id: `golftraxx/tee-target/${holeNumber}`,
      kind: "tee",
      ref: String(holeNumber),
      tee: "target",
      points: [{ latitude: teeLat, longitude: teeLong }],
      provenance,
    });
  }
  return features;
}

export function parseKmlPlacemarks(
  kml: string,
  sourceUrl?: string,
): ExternalGeometryFeature[] {
  const features: ExternalGeometryFeature[] = [];
  const placemarkPattern = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi;
  for (const match of kml.matchAll(placemarkPattern)) {
    const block = match[1];
    const name = block.match(/<name[^>]*>([\s\S]*?)<\/name>/i)?.[1]?.trim() || "";
    const coordinates = block.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i)?.[1]
      ?.trim()
      .split(/\s+/)
      .map((value) => value.split(","))
      .map(([longitude, latitude]) => ({ latitude: coordinate(latitude), longitude: coordinate(longitude) }))
      .filter((point): point is { latitude: number; longitude: number } => point.latitude !== undefined && point.longitude !== undefined) || [];
    if (!coordinates.length) continue;
    const hole = name.match(/(?:hole|h)\s*#?\s*(\d{1,2})/i)?.[1] || name.match(/\b(\d{1,2})\b/)?.[1];
    const number = hole ? Number(hole) : undefined;
    const lower = name.toLowerCase();
    const kind: ExternalGeometryFeature["kind"] = lower.includes("center line") || lower.includes("centre line")
      ? "centreline"
      : lower.includes("target")
        ? "target"
        : lower.includes("green") || lower.includes("pin")
      ? "green"
      : lower.includes("tee")
        ? "tee"
        : lower.includes("bunker")
          ? "bunker"
          : lower.includes("water")
            ? "water_hazard"
            : "hole";
    features.push({
      id: `kml/${features.length}`,
      kind,
      ref: number ? String(number) : undefined,
      tee: kind === "tee" ? "white" : undefined,
      points: coordinates,
      provenance: {
        source: "provisualizer-kml",
        sourceId: name,
        sourceUrl,
        confidence: number ? "verified" : "unresolved",
        association: number ? "explicit-hole" : "unresolved",
        centreMethod: kind === "green" ? (coordinates.length > 1 ? "polygon-centroid" : "explicit-centre") : undefined,
        attribution: "ProVisualizer public course data",
      },
    });
  }
  return features;
}

export const golfTraxxPublicGeometryProvider: CourseGeometryProvider = {
  async getCourseGeometry({ courseName }) {
    const name = courseName || "Hermanus Golf Club";
    const layouts = name === "Hermanus Golf Club"
      ? [
          { sourceName: "Hermanus Golf Club (18 holes)", zipcode: "7200SA", offset: 0, count: 18 },
          { sourceName: "Hermanus Golf Club (19 - 27)", zipcode: "SOUTH A", offset: 18, count: 9 },
        ]
      : name === "Arabella Golf Club"
        ? [{ sourceName: "Arabella Golf Club", zipcode: "6381SA", offset: 0, count: 18 }]
      : name === "Zimbali Lakes"
          ? [{ sourceName: "Zimbali Coastal Resort", zipcode: "4390SA", offset: 0, count: 18 }]
          : name === "Hartford Golf Club"
            // Hartford is a nine-hole course played twice. The club uses
            // different back-nine tee positions, so never duplicate the
            // front-nine GPS tee points as if they were the back nine.
            ? [{ sourceName: "Hartford Golf Club", zipcode: "CW8 3AP", offset: 0, count: 9 }]
          : [{ sourceName: name, zipcode: "", offset: 0, count: 18 }];
    const features: ExternalGeometryFeature[] = [];
    const failures: { hole: number; status?: number; error?: string; url: string }[] = [];
    let requested = 0;
    for (const layout of layouts) {
      for (let index = 1; index <= layout.count; index += 1) {
        const holeNumber = layout.offset + index;
          const sourceName = layout.sourceName;
          const url = `https://golftraxx.com/hole-layout?coursename=${encodeURIComponent(sourceName)}&hole=${index}&static=true&zipcode=${encodeURIComponent(layout.zipcode)}`;
        requested += 1;
        try {
          const response = await fetch(url);
          if (!response.ok) {
            failures.push({ hole: holeNumber, status: response.status, url });
            continue;
          }
          const parsed = parseGolfTraxxHtml(await response.text(), holeNumber, url);
          if (!parsed.some((feature) => feature.kind === "green")) {
            failures.push({ hole: holeNumber, error: "No green centre in public payload", url });
            continue;
          }
          features.push(...parsed);
        } catch (error) {
          failures.push({ hole: holeNumber, error: error instanceof Error ? error.message : "Fetch failed", url });
        }
      }
    }
    return {
      features,
      attribution: "GolfTraxx public course data",
      fetchedAt: new Date().toISOString(),
      diagnostics: { requested, successful: requested - failures.length, failures },
    };
  },
};

export function polygonCentre(points: LatLng[]): LatLng | undefined {
  if (!points.length) return undefined;
  const closed =
    points.length > 2 &&
    points[0].latitude === points.at(-1)?.latitude &&
    points[0].longitude === points.at(-1)?.longitude
      ? points.slice(0, -1)
      : points;
  const area =
    closed.reduce((sum, point, index) => {
      const next = closed[(index + 1) % closed.length];
      return (
        sum + point.longitude * next.latitude - next.longitude * point.latitude
      );
    }, 0) / 2;
  if (!area)
    return {
      latitude:
        closed.reduce((sum, point) => sum + point.latitude, 0) / closed.length,
      longitude:
        closed.reduce((sum, point) => sum + point.longitude, 0) / closed.length,
    };
  const latitude =
    closed.reduce((sum, point, index) => {
      const next = closed[(index + 1) % closed.length];
      return (
        sum +
        (point.latitude + next.latitude) *
          (point.longitude * next.latitude - next.longitude * point.latitude)
      );
    }, 0) /
    (6 * area);
  const longitude =
    closed.reduce((sum, point, index) => {
      const next = closed[(index + 1) % closed.length];
      return (
        sum +
        (point.longitude + next.longitude) *
          (point.longitude * next.latitude - next.longitude * point.latitude)
      );
    }, 0) /
    (6 * area);
  return { latitude, longitude };
}

function featureHoleNumber(feature: ExternalGeometryFeature) {
  const number = Number(feature.ref);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

const toMeters = (a: LatLng, b: LatLng) => {
  const latScale = 111_320;
  const lonScale = 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot((a.latitude - b.latitude) * latScale, (a.longitude - b.longitude) * lonScale);
};

const bearing = (from: LatLng, to: LatLng) =>
  Math.atan2(
    (to.longitude - from.longitude) * Math.cos((from.latitude * Math.PI) / 180),
    to.latitude - from.latitude,
  );

const angleDifference = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

const closestDistanceToPath = (point: LatLng, path: LatLng[]) =>
  Math.min(...path.map((candidate) => toMeters(point, candidate)));

function holeFeatureScore(feature: ExternalGeometryFeature, hole: ExternalGeometryFeature) {
  const centre = polygonCentre(feature.points);
  if (!centre || hole.points.length < 2) return 0;
  const end = hole.points.at(-1)!;
  const previous = hole.points.at(-2)!;
  const distance = toMeters(end, centre);
  if (distance > 220) return 0;
  const distanceScore = Math.max(0, 1 - distance / 220);
  const directionScore = 1 - angleDifference(bearing(previous, end), bearing(end, centre)) / Math.PI;
  const pathScore = Math.max(0, 1 - closestDistanceToPath(centre, hole.points) / 300);
  return distanceScore * 0.6 + directionScore * 0.2 + pathScore * 0.2;
}

export function resolveOsmGeometry(
  features: ExternalGeometryFeature[],
  holeNumbers: number[],
): { features: ExternalGeometryFeature[]; report: OsmResolutionReport } {
  const holeWays = features.filter((feature) => feature.kind === "hole");
  const greens = features.filter((feature) => feature.kind === "green");
  const tees = features.filter((feature) => feature.kind === "tee");
  const hazards = features.filter((feature) => hazardType(feature.kind));
  const usedGreens = new Set<string>();
  const mappings = new Map<string, number>();
  const perHole: Record<number, HoleGeometryMatch> = {};
  const ambiguousClusters: string[] = [];

  for (const number of holeNumbers) {
    const hole = holeWays.find((candidate) => featureHoleNumber(candidate) === number);
    if (!hole) continue;
    const candidates = greens
      .filter((green) => !usedGreens.has(green.id) && !featureHoleNumber(green))
      .map((green) => ({ green, score: holeFeatureScore(green, hole) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const second = candidates[1];
    if (!best || best.score < 0.68 || (second && best.score - second.score < 0.1)) {
      if (best && second && best.score - second.score < 0.1)
        ambiguousClusters.push(`Hole ${number}: ${best.green.id} / ${second.green.id}`);
      perHole[number] = {
        confidence: "unresolved",
        score: best?.score || 0,
        reason: best ? "Competing nearby green candidates" : "No green near hole endpoint",
      };
      continue;
    }
    usedGreens.add(best.green.id);
    mappings.set(best.green.id, number);
    perHole[number] = {
      holeNumber: number,
      confidence: "probable",
      score: best.score,
      reason: "Unique green near numbered hole endpoint",
    };
  }

  const assignNearest = (candidate: ExternalGeometryFeature, maxDistance: number) => {
    const centre = polygonCentre(candidate.points);
    if (!centre) return;
    const options = holeWays
      .map((hole) => ({ hole, distance: closestDistanceToPath(centre, hole.points) }))
      .sort((a, b) => a.distance - b.distance);
    const best = options[0];
    const second = options[1];
    const number = best ? featureHoleNumber(best.hole) : undefined;
    if (!number || best.distance > maxDistance || (second && second.distance - best.distance < 15)) return;
    mappings.set(candidate.id, number);
  };
  tees.filter((tee) => !featureHoleNumber(tee)).forEach((tee) => assignNearest(tee, 120));
  hazards.filter((hazard) => !featureHoleNumber(hazard)).forEach((hazard) => assignNearest(hazard, 80));

  const mapped = features.map((feature) => {
    const holeNumber = featureHoleNumber(feature) || mappings.get(feature.id);
    if (!holeNumber) return feature;
    return {
      ...feature,
      ref: String(holeNumber),
      provenance: { ...feature.provenance, confidence: featureHoleNumber(feature) ? feature.provenance.confidence : "probable" as const },
    };
  });
  const count = (kind: ExternalGeometryFeature["kind"]) => features.filter((feature) => feature.kind === kind).length;
  const resolved = (kind: ExternalGeometryFeature["kind"]) => mapped.filter((feature) => feature.kind === kind && featureHoleNumber(feature)).length;
  const resolvedHazards = hazards.filter((hazard) => mappings.has(hazard.id) || featureHoleNumber(hazard)).length;
  return {
    features: mapped,
    report: {
      resolvedGreenCount: resolved("green"),
      unresolvedGreenCount: count("green") - resolved("green"),
      resolvedTeeCount: resolved("tee"),
      unresolvedTeeCount: count("tee") - resolved("tee"),
      resolvedHazardCount: resolvedHazards,
      unresolvedHazardCount: hazards.length - resolvedHazards,
      perHole,
      ambiguousClusters,
    },
  };
}

function hazardType(
  kind: ExternalGeometryFeature["kind"],
): HazardType | undefined {
  const types: Partial<Record<ExternalGeometryFeature["kind"], HazardType>> = {
    bunker: "bunker",
    water_hazard: "water",
    lateral_water_hazard: "penalty-area",
    out_of_bounds: "out-of-bounds",
  };
  return types[kind];
}

export function normalizeCourse(
  metadata: ExternalCourseMetadata,
  geometry: ExternalCourseGeometry,
): CachedCourse {
  const resolved = resolveOsmGeometry(
    geometry.features,
    (metadata.holes || []).map((hole) => hole.number),
  );
  const tees: TeeDefinition[] = (metadata.tees || []).map((tee) => ({
    id: tee.id,
    name: tee.name,
    colour: tee.colour,
  }));
  const holes: HoleDefinition[] = (metadata.holes || []).map((hole) => {
    const features = resolved.features.filter(
      (feature) => featureHoleNumber(feature) === hole.number,
    );
    const greenFeatures = features.filter((feature) => feature.kind === "green");
    const green = greenFeatures.find((feature) => feature.greenPart === "centre") || greenFeatures[0];
    const front = greenFeatures.find((feature) => feature.greenPart === "front");
    const back = greenFeatures.find((feature) => feature.greenPart === "back");
    const centre = green ? polygonCentre(green.points) : undefined;
    const teeBoxes: TeeBox[] = features
      .filter((feature) => feature.kind === "tee" && feature.tee)
      .map((feature) => ({
        teeId: feature.tee!,
        distanceM: hole.distancesM?.[feature.tee!] || 0,
        position: polygonCentre(feature.points),
      }));
    const centreline = features.find((feature) => feature.kind === "centreline")?.points;
    const targets = features
      .filter((feature) => feature.kind === "target")
      .map((feature, index) => ({
        id: feature.id,
        name: `Route target ${index + 1}`,
        position: polygonCentre(feature.points)!,
        kind: "fairway" as const,
        source: feature.provenance.source,
        verified: false,
      }))
      .filter((target) => target.position);
    const hazards: HazardDefinition[] = features.flatMap((feature) => {
      const type = hazardType(feature.kind);
      return type
        ? [
            {
              id: feature.id,
              type,
              position: polygonCentre(feature.points),
              polygon: feature.points,
              notes:
                feature.provenance.confidence === "unresolved"
                  ? "Unresolved external mapping"
                  : undefined,
            },
          ]
        : [];
    });
    return {
      number: hole.number,
      par: hole.par || 4,
      teeBoxes,
      green: centre
        ? {
            centre,
            front: front ? polygonCentre(front.points) : undefined,
            back: back ? polygonCentre(back.points) : undefined,
            polygon: green?.points,
          }
        : undefined,
      hazards,
      centreline,
      targets,
    };
  });
  const provenance = resolved.features.map((feature) => feature.provenance);
  return {
    course: {
      id: metadata.externalId,
      name: metadata.name,
      locationName: metadata.locationName,
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      timezone: "UTC",
      tees,
      holes,
    },
    provenance,
    providerIds: [metadata.externalId],
    fetchedAt: geometry.fetchedAt,
    schemaVersion: 2,
    providerVersion: GOLFTRAXX_HERMANUS_PROVIDER_VERSION,
    geometryCoverage: {
      greenCentres: holes.filter((hole) => Boolean(hole.green?.centre)).length,
      expectedHoles: holes.length,
    },
  };
}

export function mergeImportedGeometry(
  base: CourseDefinition,
  imported: CachedCourse,
): CourseDefinition {
  const importedByHole = new Map(imported.course.holes.map((hole) => [hole.number, hole]));
  return {
    ...base,
    holes: base.holes.map((hole) => {
      const external = importedByHole.get(hole.number);
      if (!external) return { ...hole };
      return {
        ...hole,
        green: hole.green || external.green,
        hazards: hole.hazards?.length ? hole.hazards : external.hazards,
        centreline: hole.centreline,
        targets: hole.targets,
        teeBoxes: hole.teeBoxes.map((tee) => ({
          ...tee,
          position: tee.position || external.teeBoxes.find((candidate) => candidate.teeId === tee.teeId)?.position,
        })),
      };
    }),
  };
}

export async function fetchAndCacheCourseGeometry(
  metadata: ExternalCourseMetadata,
  provider: CourseGeometryProvider = golfTraxxPublicGeometryProvider,
) {
  const geometry = await provider.getCourseGeometry({
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    courseName: metadata.name,
  });
  const normalized = normalizeCourse(metadata, geometry);
  const valid = normalized.course.holes.every((hole) => {
    const centre = hole.green?.centre;
    return !centre || (Number.isFinite(centre.latitude) && Number.isFinite(centre.longitude));
  });
  if (!valid) throw new Error("Imported course geometry failed validation");
  cacheCourse(normalized);
  return normalized;
}

export const openStreetMapGeometryProvider: CourseGeometryProvider = {
  async getCourseGeometry({ latitude, longitude }) {
    const query = `[out:json];(way["golf"](around:5000,${latitude},${longitude});relation["golf"](around:5000,${latitude},${longitude}););out geom;`;
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });
    if (!response.ok)
      throw new Error(`OSM geometry request failed: ${response.status}`);
    const payload = (await response.json()) as {
      elements?: Array<{
        type: string;
        id: number;
        tags?: Record<string, string>;
        geometry?: Array<{ lat: number; lon: number }>;
      }>;
    };
    const features = (payload.elements || []).flatMap((element) => {
      const kind = element.tags?.golf as
        ExternalGeometryFeature["kind"] | undefined;
      if (
        !kind ||
        ![
          "hole",
          "green",
          "tee",
          "bunker",
          "water_hazard",
          "lateral_water_hazard",
          "out_of_bounds",
          "pin",
        ].includes(kind)
      )
        return [];
      return [
        {
          id: `${element.type}/${element.id}`,
          kind,
          ref: element.tags?.ref,
          par: element.tags?.par ? Number(element.tags.par) : undefined,
          tee: element.tags?.tee,
          points: (element.geometry || []).map((point) => ({
            latitude: point.lat,
            longitude: point.lon,
          })),
          provenance: {
            source: "openstreetmap",
            sourceId: `${element.type}/${element.id}`,
            confidence: "probable" as const,
            attribution: "© OpenStreetMap contributors",
          },
        },
      ];
    });
    return {
      features,
      attribution: "© OpenStreetMap contributors",
      fetchedAt: new Date().toISOString(),
    };
  },
};

const cacheKey = (courseId: string) => `course-cache:${courseId}`;
export function cacheCourse(course: CachedCourse) {
  localStorage.setItem(cacheKey(course.course.id), JSON.stringify(course));
}
export function readCachedCourse(courseId: string): CachedCourse | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(courseId));
    return raw ? (JSON.parse(raw) as CachedCourse) : undefined;
  } catch {
    return undefined;
  }
}
