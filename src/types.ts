export type LatLng = { lat: number; lng: number };

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type LieType = "tee" | "fairway" | "rough" | "bunker";

export type HazardType = "water" | "ob" | "bunker" | "trees" | "other";

export type Hazard = {
  type: HazardType;
  // MVP: keep geometry simple; expand later to polygons
  // For now a rough circle hazard is enough to test avoidance logic
  center: LatLng;
  radiusYds: number;
};

export type Wind = {
  speedMph: number;
  // degrees: 0 = north, 90 = east
  directionDeg: number;
  updatedAtUnixMs: number;
};

export type PlayerProfile = {
  clubCarryYds: Partial<Record<string, number>>; // e.g. {"7i": 150, "D": 250}
  missBias?: "left" | "right" | "short" | "long";
  // Optional future: dispersion widths, confidence flags
};

export type DecisionEngineInput = {
  holeId: string;
  par: 3 | 4 | 5;
  teeBoxId: string;

  teeboxLocation: LatLng;
  greenCenter: LatLng;
  pinLocation?: LatLng;

  hazards: Hazard[];

  gpsAccuracyMeters: number;

  elevationDeltaFeet?: number;
  temperatureF?: number;
  wind?: Wind;

  lieType?: LieType;

  player: PlayerProfile;

  // Course ambiguity / tee inference states supplied by higher layer
  isCourseConfirmed: boolean;
  isTeeBoxConfirmed: boolean;
};

export type TargetZone = {
  // MVP: represent as center + radius (circle zone) for simplicity
  center: LatLng;
  radiusYds: number;
};

export type LandingEllipse = {
  center: LatLng;
  widthYds: number;
  lengthYds: number;
  bearingDeg: number; // direction from tee toward target
};

export type DecisionEngineOutput = {
  distanceToPinYds: number;
  effectiveDistanceYds: number;

  recommendedClub: string | null;

  targetZone: TargetZone | null;
  landingEllipse: LandingEllipse | null;

  confidence: ConfidenceLevel;

  // Only if confidence HIGH
  oneLineIntent?: string;
};
export type FreshnessState = "FRESH" | "STALE" | "MISSING";

export type FreshnessReport = {
  wind: FreshnessState;
  // Future:
  // temperature: FreshnessState;
  // elevation: FreshnessState;
};

export type FreshnessPolicy = {
  windMaxAgeMinutes: number;

  // If any key listed here is STALE or MISSING => suppress intent
  suppressIntentIfStale: ReadonlyArray<keyof FreshnessReport>;
};
