// src/utils/formatTime.js
//
// Single shared tick formatter for every chart's time axis: plain seconds
// with an explicit "s" suffix (e.g. "1682s"), matching timeSeries.js
// (RMSSD), which already used this style. Replaces the earlier per-chart
// formatMMSS() (duplicated in ecgOverlayStatic.js/hrOverlayStatic.js/
// trendWithSdStatic.js) - "19:10" read as clock time (hours:minutes)
// rather than elapsed minutes:seconds, which is exactly the ambiguity
// this format avoids: every tick is unambiguously "N seconds since the
// start of the recording" and never mistaken for a wall-clock time.

export function formatSeconds(totalSeconds) {
  return `${Math.round(totalSeconds)}s`;
}
