import { Hook, isBlockingHook, isNonBlockingHook, Placement } from "./types";

export interface HookOverlapViolation {
  type: "blocking-overlap" | "nonblocking-spatial-overlap";
  hookIndex1: number;
  hookIndex2: number;
  description: string;
}

export interface HookValidationOptions {
  /** Minimum time (in seconds) that must separate two blocking hooks */
  minBlockingSeparation?: number;
}

/**
 * Checks if two rectangles (placements) overlap.
 */
function doPlacementsOverlap(p1: Placement, p2: Placement): boolean {
  return !(
    p1.x + p1.width <= p2.x ||
    p2.x + p2.width <= p1.x ||
    p1.y + p1.height <= p2.y ||
    p2.y + p2.height <= p1.y
  );
}

/**
 * Validates hook overlaps according to the library's rules:
 * - Blocking hooks must not overlap with other blocking hooks (respect minBlockingSeparation)
 * - Non-blocking hooks may overlap in time, but not spatially during overlapping time ranges
 */
export function validateHookOverlaps(
  hooks: Hook[],
  options: HookValidationOptions = {},
): HookOverlapViolation[] {
  const violations: HookOverlapViolation[] = [];
  const minBlockingSeparation = options.minBlockingSeparation ?? 1; // Default 1 second

  for (let i = 0; i < hooks.length; i++) {
    const hookA = hooks[i];
    if (!hookA) continue;

    for (let j = i + 1; j < hooks.length; j++) {
      const hookB = hooks[j];
      if (!hookB) continue;

      // Check blocking-vs-blocking overlap
      if (isBlockingHook(hookA) && isBlockingHook(hookB)) {
        const timeDiff = Math.abs(hookA.timestamp - hookB.timestamp);
        if (timeDiff < minBlockingSeparation) {
          violations.push({
            type: "blocking-overlap",
            hookIndex1: i,
            hookIndex2: j,
            description: `Blocking hooks ${i} and ${j} are too close together (separation: ${timeDiff}s, required: ${minBlockingSeparation}s)`,
          });
        }
      }

      // Check non-blocking spatial overlap during time overlap
      if (isNonBlockingHook(hookA) && isNonBlockingHook(hookB)) {
        // Check if time ranges overlap
        const timeOverlap = !(
          hookA.end <= hookB.start || hookB.end <= hookA.start
        );

        if (
          timeOverlap &&
          doPlacementsOverlap(hookA.placement, hookB.placement)
        ) {
          violations.push({
            type: "nonblocking-spatial-overlap",
            hookIndex1: i,
            hookIndex2: j,
            description: `Non-blocking hooks ${i} and ${j} have overlapping spatial placement during overlapping time ranges`,
          });
        }
      }

      // Blocking hooks can overlap with non-blocking hooks spatially/temporally, but
      // the non-blocking hook's time range should not fully contain the blocking timestamp
      // (this is more of a UX concern; not enforced here as per design doc)
    }
  }

  return violations;
}
