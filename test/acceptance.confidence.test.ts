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

describe("acceptance: confidence gating", () => {
it("suppresses oneLineIntent when wind is stale (>30 minutes old) even if confidence remains HIGH", () => {
  const input = baseInput();

  input.wind = {
    speedMph: 12,
    directionDeg: 0,
    updatedAtUnixMs: Date.now() - 31 * 60 * 1000,
  };

  const out = decide(input);

  // Confidence may remain HIGH, but intent must be suppressed
  expect(out.oneLineIntent).toBeUndefined();
});

  it("drops confidence and suppresses oneLineIntent when course is not confirmed", () => {
    const input = baseInput();
    input.isCourseConfirmed = false;

    const out = decide(input);

    expect(out.confidence).not.toBe("HIGH");
    expect(out.oneLineIntent).toBeUndefined();
  });
});
