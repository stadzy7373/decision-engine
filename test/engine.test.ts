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

describe("decision engine", () => {
  it("is deterministic for identical inputs", () => {
    const input = baseInput();
    const a = decide(input);
    const b = decide(input);
    expect(a).toEqual(b);
  });

it("returns HIGH confidence with good inputs", () => {
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

  it("drops confidence when GPS accuracy is poor", () => {
    const input = baseInput();
    input.gpsAccuracyMeters = 50;
    const out = decide(input);
    expect(out.confidence).toBe("MEDIUM"); // could be LOW depending on other deductions
  });

  it("uses greenCenter when pinLocation is missing", () => {
    const input = baseInput();
    delete input.pinLocation;
    const out = decide(input);
    expect(out.distanceToPinYds).toBeGreaterThan(0);
  });

  it("still recommends a club when candidates are sparse", () => {
    const input = baseInput();
    input.player.clubCarryYds = { D: 250 };
    const out = decide(input);
    expect(out.recommendedClub).toBe("D");
  });
});
