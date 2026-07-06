import { ContentInstance } from "../content/content-instance";

export interface AggregatedResult {
  /** Sum of result scores for scorable, non-skipped content */
  numerator: number;
  /** Sum of total scores for all scorable content (skipped or not) */
  denominator: number;
  /** Percentage (0-100), or undefined if denominator is 0 */
  percentage?: number;
}

/**
 * Computes aggregated result across all content instances.
 * - Scorable content: completed contributes score/total, skipped contributes 0/total
 * - Non-scorable content: excluded entirely
 */
export function computeAggregatedResult(
  contentInstances: ContentInstance[],
): AggregatedResult {
  let numerator = 0;
  let denominator = 0;

  for (const instance of contentInstances) {
    if (!instance.isScorable()) {
      continue; // Non-scorable content is excluded
    }

    const total = instance.getTotalScore();
    denominator += total;

    if (instance.getState() === "completed") {
      const score = instance.getResultScore();
      if (score !== undefined) {
        numerator += score;
      }
    }
    // Skipped contributes 0 to numerator (already initialized to 0)
  }

  const result: AggregatedResult = {
    numerator,
    denominator,
  };

  if (denominator > 0) {
    result.percentage = (numerator / denominator) * 100;
  }

  return result;
}
