import type {
  DecisionEngineInput,
  DecisionEngineOutput,
  ConfidenceLevel,
  TargetZone,
  LandingEllipse,
  Hazard,
} from "./types";

import { bearingDeg, distanceYds, moveLatLngByYds } from "./geo";

import { evaluateFreshness, shouldSuppressIntent } from "./freshness";

const FRESHNESS_POLICY = {
  windMaxAgeMinutes: 30,
  suppressIntentIfStale: ["wind"],
} as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeConfidence(input: DecisionEngineInput): ConfidenceLevel {
  let score = 100;

  if (!input.isCourseConfirmed) score -= 40;
  if (!input.isTeeBoxConfirmed) score -= 10;

  if (input.gpsAccuracyMeters > 12) score -= 30;

  const knownClubs = Object.keys(input.player.clubCarryYds).length;
  if (knownClubs < 5) score -= 25;

  if (!input.pinLocation) score -= 10;

  if (input.wind) {
    const ageMin = (Date.now() - input.wind.updatedAtUnixMs) / 60000;
    if (ageMin > 30) score -= 10;
  }

  if (score >= 70) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}
function effectiveDistanceYds(input: DecisionEngineInput, baseYds: number): number {
  let eff = baseYds;

  // Elevation: 1 yd per 3 ft, cap ±12
  if (typeof input.elevationDeltaFeet === "number") {
    const adj = clamp(input.elevationDeltaFeet / 3, -12, 12);
    eff += adj;
  }

  // Temperature: ±1% per 20°F from 70°F baseline, cap ±3%
  if (typeof input.temperatureF === "number") {
    const delta = input.temperatureF - 70;
    const pct = clamp(delta / 20 * 0.01, -0.03, 0.03);
    eff *= 1 + pct;
  }

  // Wind: head +1 yd per mph, tail -0.5 yd per mph, cap ±15
  // MVP: treat all wind as headwind (placeholder) until we have shot direction context.
  if (input.wind) {
    const w = input.wind.speedMph;
    const windAdj = clamp(w * 1, -15, 15);
    eff += windAdj;
  }

  return Math.round(eff);
}

function pickClub(input: DecisionEngineInput, effYds: number): string | null {
  const clubs = Object.entries(input.player.clubCarryYds)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => ({ club: k, carry: v as number }));

  if (clubs.length === 0) return null;

  // Tee shot band (MVP): -30 / +15
  const min = effYds - 30;
  const max = effYds + 15;

  const candidates = clubs
    .filter((c) => c.carry >= min && c.carry <= max)
    .sort((a, b) => Math.abs(a.carry - effYds) - Math.abs(b.carry - effYds));

  if (candidates.length > 0) {
    // Tie-break: more controllable (shorter club) => lower carry, if close
    const best = candidates[0];
    const close = candidates.filter((c) => Math.abs(c.carry - effYds) <= 5);
    if (close.length > 1) {
      close.sort((a, b) => a.carry - b.carry);
      return close[0].club;
    }
    return best.club;
  }

  // Fallback: choose closest but prefer short of target (safety)
  clubs.sort((a, b) => a.carry - b.carry);
  const under = clubs.filter((c) => c.carry <= effYds).pop();
  return under?.club ?? clubs[0].club;
}

function isPrimaryDanger(h: Hazard): boolean {
  return h.type === "water" || h.type === "ob";
}

function avoidHazards(
  input: DecisionEngineInput,
  center: { lat: number; lng: number }
): { lat: number; lng: number } {
  const bufferYds = 12;
  let adjusted = { ...center };

  for (let iter = 0; iter < 4; iter++) {
    let moved = false;

    for (const hz of input.hazards) {
      if (!isPrimaryDanger(hz)) continue;

      const d = distanceYds(adjusted, hz.center);
      const minSafe = hz.radiusYds + bufferYds;

      if (d < minSafe) {
        const brng =
          d < 1
            ? bearingDeg(
                input.teeboxLocation,
                input.pinLocation ?? input.greenCenter
              )
            : bearingDeg(hz.center, adjusted);

        const push = minSafe - d + 6;
        adjusted = moveLatLngByYds(adjusted, brng, push);
        moved = true;
      }
    }

    if (!moved) break;
  }

  return adjusted;
}

function applyMissBias(
  input: DecisionEngineInput,
  center: { lat: number; lng: number }
): { lat: number; lng: number } {
  const bias = input.player.missBias;
  if (!bias) return center;

  const shotBearing = bearingDeg(input.teeboxLocation, center);

  const lateralYds =
    bias === "right" ? -10 :
    bias === "left" ? 10 :
    0;

  const longShortYds =
    bias === "short" ? 8 :
    bias === "long" ? -8 :
    0;

  let adjusted = center;

  if (lateralYds !== 0) {
    const lateralBearing =
      (shotBearing + (lateralYds > 0 ? 90 : 270)) % 360;
    adjusted = moveLatLngByYds(adjusted, lateralBearing, Math.abs(lateralYds));
  }

  if (longShortYds !== 0) {
    adjusted = moveLatLngByYds(adjusted, shotBearing, longShortYds);
  }

  return adjusted;
}

function defaultTargetZone(input: DecisionEngineInput): TargetZone {
  const baseCenter = input.pinLocation ?? input.greenCenter;
  const biased = applyMissBias(input, baseCenter);
  const safe = avoidHazards(input, biased);
  return { center: safe, radiusYds: 12 };
}


function computeLandingEllipse(input: DecisionEngineInput, target: TargetZone): LandingEllipse {
  const dist = distanceYds(input.teeboxLocation, target.center);
  const width = clamp(dist * 0.08, 10, 35);
  const length = clamp(dist * 0.06, 8, 25);
  const bearing = bearingDeg(input.teeboxLocation, target.center);

  return {
    center: target.center,
    widthYds: Math.round(width),
    lengthYds: Math.round(length),
    bearingDeg: Math.round(bearing),
  };
}

export function decide(input: DecisionEngineInput): DecisionEngineOutput {
  const pin = input.pinLocation ?? input.greenCenter;
  const base = Math.round(distanceYds(input.teeboxLocation, pin));
  const eff = effectiveDistanceYds(input, base);

  const confidence = computeConfidence(input);

  const freshness = evaluateFreshness(input, FRESHNESS_POLICY);
  const suppressIntent = shouldSuppressIntent(freshness, FRESHNESS_POLICY);

  // In LOW confidence, we still provide a conservative club and basic target,
  // but higher layers may hide insight strip.
  const recommendedClub = pickClub(input, eff);

  const targetZone = defaultTargetZone(input);
  const landingEllipse = computeLandingEllipse(input, targetZone);

  const out: DecisionEngineOutput = {
    distanceToPinYds: base,
    effectiveDistanceYds: eff,
    recommendedClub,
    targetZone,
    landingEllipse,
    confidence,
  };

if (confidence === "HIGH" && !suppressIntent) {
  out.oneLineIntent = "Favor center. Commit to your stock swing.";
}
  return out;
}

