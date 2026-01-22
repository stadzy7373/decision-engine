import { describe, it, expect } from "vitest";
import { evaluateFreshness, shouldSuppressIntent } from "../src/freshness";
import type { DecisionEngineInput } from "../src/types";

const policy = {
  windMaxAgeMinutes: 30,
  suppressIntentIfStale: ["wind"],
} as const;

function baseInput(): DecisionEngineInput {
  return {
    holeId: "1",
    par: 4,
    teeBoxId: "blue",
    teeboxLocation: { lat: 35.0, lng: -78.0 },
    greenCenter: { lat: 35.001, lng: -78.0 },
    hazards: [],
    gpsAccuracyMeters: 6,
    player: { clubCarryYds: { D: 250 } },
    isCourseConfirmed: true,
    isTeeBoxConfirmed: true,
  };
}

describe("freshness policy", () => {
  it("suppresses intent when wind is missing", () => {
    const input = baseInput();
    const rep = evaluateFreshness(input, policy);
    expect(rep.wind).toBe("MISSING");
    expect(shouldSuppressIntent(rep, policy)).toBe(true);
  });

  it("suppresses intent when wind is stale", () => {
    const input = baseInput();
    input.wind = {
      speedMph: 10,
      directionDeg: 0,
      updatedAtUnixMs: Date.now() - 31 * 60 * 1000,
    };
    const rep = evaluateFreshness(input, policy);
    expect(rep.wind).toBe("STALE");
    expect(shouldSuppressIntent(rep, policy)).toBe(true);
  });

  it("does not suppress intent when wind is fresh", () => {
    const input = baseInput();
    input.wind = {
      speedMph: 10,
      directionDeg: 0,
      updatedAtUnixMs: Date.now() - 5 * 60 * 1000,
    };
    const rep = evaluateFreshness(input, policy);
    expect(rep.wind).toBe("FRESH");
    expect(shouldSuppressIntent(rep, policy)).toBe(false);
  });
});
