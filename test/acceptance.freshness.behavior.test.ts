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

describe("acceptance: freshness gating behavior", () => {
  it("fresh wind enables oneLineIntent on HIGH confidence", () => {
    const input = baseInput();
    input.wind = {
      speedMph: 8,
      directionDeg: 0,
      updatedAtUnixMs: Date.now(),
    };

    const out = decide(input);

    expect(out.confidence).toBe("HIGH");
    expect(out.oneLineIntent).toBeDefined();
  });

  it("missing wind suppresses oneLineIntent but still returns core outputs", () => {
    const input = baseInput();
    // wind intentionally missing

    const out = decide(input);

    expect(out.oneLineIntent).toBeUndefined();

    // Core outputs must still exist
    expect(out.distanceToPinYds).toBeGreaterThan(0);
    expect(out.effectiveDistanceYds).toBeGreaterThan(0);
    expect(out.targetZone).not.toBeNull();
    expect(out.landingEllipse).not.toBeNull();
  });

  it("is deterministic when inputs (including timestamps) are identical", () => {
    const input = baseInput();
    const fixedNow = 1700000000000; // fixed timestamp for determinism

    input.wind = {
      speedMph: 10,
      directionDeg: 90,
      updatedAtUnixMs: fixedNow,
    };

    const a = decide(input);
    const b = decide(input);

    expect(a).toEqual(b);
  });
});
