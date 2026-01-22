import type {
  DecisionEngineInput,
  FreshnessPolicy,
  FreshnessReport,
  FreshnessState,
} from "./types";

function ageMinutes(updatedAtUnixMs: number): number {
  return (Date.now() - updatedAtUnixMs) / 60000;
}

export function evaluateFreshness(
  input: DecisionEngineInput,
  policy: FreshnessPolicy
): FreshnessReport {
  const wind: FreshnessState = !input.wind
    ? "MISSING"
    : ageMinutes(input.wind.updatedAtUnixMs) > policy.windMaxAgeMinutes
      ? "STALE"
      : "FRESH";

  return { wind };
}

export function shouldSuppressIntent(
  report: FreshnessReport,
  policy: FreshnessPolicy
): boolean {
  return policy.suppressIntentIfStale.some((k) => report[k] !== "FRESH");
}
