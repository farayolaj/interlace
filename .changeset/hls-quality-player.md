---
"@interlacejs/player": minor
---

Add a built-in quality control. When the adapter supports quality and reports at least two levels, the player shows a quality button in the top-right corner of the video frame, with a menu of Auto, each level from high to low, and "Data saver" on the lowest. It fades out during playback after 2.5 s without pointer movement, and is hidden while content is open. New props: `showQualityControl` (default `true`) and `strings` (`qualityLabel`, `qualityAutoLabel`, `qualityDataSaverLabel`). `QualityControl` is also exported. `OverlayLayer` accepts `children` for controls drawn above the anchors.
