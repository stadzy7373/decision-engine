import { describe, it, expect } from "vitest";
import { decide } from "../src/engine";
import type { DecisionEngineInput } from "../src/types";

function baseInput(): DecisionEngineInput {
  return {
    holeId: "1",
    par: 4,
    teeBoxId: "blue",
    teeboxLocation: { lat: 35.0, lng: -78.0 },
    greenCenter: { lat: 35.001, lng: -78.0 },
    hazards: [],
    gpsAccuracyMeters: 6,
    player: {
      clubCarryYds: { D: 250, "3W": 235, "5i": 175, "7i": 150, "9i": 125 },
      missBias: "right",
    },
    isCourseConfirmed: true,
    isTeeBoxConfirmed: true,
  };
}

describe("acceptance: wind edge cases", () => {
  it("caps wind adjustment so effective distance cannot increase by more than 15 yards", () => {
    const input = baseInput();

    // Extreme wind should not push effective distance beyond cap.
    input.wind = {
      speedMph: 100,
      directionDeg: 0,
      updatedAtUnixMs: Date.now(),
    };

    const out = decide(input);

    // In current MVP engine, wind adjustment is treated as headwind and capped at +15
    expect(out.effectiveDistanceYds - out.distanceToPinYds).toBeLessThanOrEqual(15);
  });
});

describe("acceptance: missing club data", () => {
  it("returns null recommendedClub when player has no club distances (but still returns distances + target)", () => {
    const input = baseInput();
    input.player.clubCarryYds = {}; // missing data

    const out = decide(input);

    expect(out.recommendedClub).toBeNull();
    expect(out.distanceToPinYds).toBeGreaterThan(0);
    expect(out.targetZone).not.toBeNull();
    expect(out.landingEllipse).not.toBeNull();

    // Confidence should drop due to insufficient club data
    expect(out.confidence).not.toBe("HIGH");
  });
});
