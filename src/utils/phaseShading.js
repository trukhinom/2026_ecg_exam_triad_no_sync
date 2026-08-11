// src/utils/phaseShading.js
//
// Draws Baseline/Exam background shading derived from the exam_start
// marker instead of a per-point phase column - ecg_raw.csv/
// instantaneous_hr.csv/hr_trend_sd.csv don't carry a phase column (only
// rmssd.csv does, see data/README.md §1); everything before exam_start is
// Baseline, everything after is Exam, so the marker alone is enough to
// shade both regions for ANY chart that already loads markers.csv - no
// need to duplicate a phase column into every export file.
//
// timeSeries.js (RMSSD) does NOT use this - it already has a real
// per-point phase column and shades from that directly, which is a touch
// more precise and doesn't depend on markers.csv being present at all.
// This module is for the other charts, which have no phase column.

/**
 * @param {d3.Selection} g - the chart's <g>; call this BEFORE drawing axes/
 *   lines so the shading lands behind them in the DOM (append order = z-order)
 * @param {d3.ScaleLinear} x
 * @param {number} innerH
 * @param {[number, number]} xDomain - [start, end] of the VISIBLE x range -
 *   not necessarily the full dataset (e.g. the ECG chart's short excerpt)
 * @param {Array<{label: string, time_s: number}>} markers
 */
export function drawPhaseShading(g, x, innerH, xDomain, markers) {
  const examStart = markers.find((m) => m.label === "exam_start")?.time_s;
  if (examStart == null) return; // no marker loaded - nothing to shade against

  const [x0, x1] = xDomain;

  if (examStart > x0) {
    g.append("rect")
      .attr("x", x(x0)).attr("y", 0)
      .attr("width", Math.max(0, x(Math.min(examStart, x1)) - x(x0)))
      .attr("height", innerH)
      .attr("fill", "var(--phase-baseline)")
      .attr("opacity", 0.6);
  }
  if (examStart < x1) {
    g.append("rect")
      .attr("x", x(Math.max(examStart, x0))).attr("y", 0)
      .attr("width", Math.max(0, x(x1) - x(Math.max(examStart, x0))))
      .attr("height", innerH)
      .attr("fill", "var(--phase-exam)")
      .attr("opacity", 0.6);
  }
}
