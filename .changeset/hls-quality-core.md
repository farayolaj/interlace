---
"@interlacejs/core": minor
---

Add an optional quality capability to the `VideoAdapter` contract: `QualityLevel`, `QualityCapableAdapter` (`getQualityLevels`, `getQualityLevel`, `getActiveQualityLevel`, `setQualityLevel`, with `-1` meaning Auto), the `supportsQuality(adapter)` type guard, and a `"qualitychange"` adapter event. Existing adapters are unaffected.
