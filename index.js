// index.js — entry point.
//
// Same principle as the course template: this file only orchestrates -
// it loads data and calls the render functions from src/charts/*.js.
// Edit a specific chart's logic in its own file under src/charts/, not here.

import {
  loadTimeSeries,
  loadSynchronyMatrix,
  loadWideTimeSeries,
  loadInstantaneousHr,
  loadTrendWithSd,
  loadBoxStats,
  loadOutliers,
  loadLabeledSeries,
  loadAlignmentPath,
  loadJSON,
  loadMarkers,
} from "./src/utils/loadData.js";
import { renderTimeSeries } from "./src/charts/timeSeries.js";
import { renderSynchronyHeatmap } from "./src/charts/synchronyHeatmap.js";
import { renderEcgOverlayStatic } from "./src/charts/ecgOverlayStatic.js";
import { renderHrOverlayStatic, renderRrIntervalOverlay } from "./src/charts/hrOverlayStatic.js";
import { renderTrendWithSd } from "./src/charts/trendWithSdStatic.js";
import { renderBoxplot } from "./src/charts/boxplotStatic.js";
import { renderDtwAlignmentExample } from "./src/charts/dtwAlignmentExample.js";
import { renderNetwork } from "./src/charts/network.js";
import { renderRecurrencePlot } from "./src/charts/recurrencePlot.js";

// Fixed width for any chart rendered two-up (Baseline/Exam side by side) -
// with .chart-row now using CSS grid (1fr 1fr, see style.css) each column
// is ~408px on an 880px-max-width page, minus .chart-container's own 1rem
// padding on each side (32px) - leaves ~376px available for the SVG
// itself. 360 keeps a small safety margin instead of exactly maxing it out.
const PAIRED_CHART_WIDTH = 360;

async function main() {
  // markers.csv is optional (vertical markers like exam start) - if the
  // file doesn't exist yet, silently continue without markers instead of
  // breaking the whole page.
  let markers = [];
  try {
    markers = await loadMarkers("./data/markers.csv");
  } catch {
    markers = [];
  }

  // --- 2.1 ECG (overlay, 3 participants) ---
  const waveform = await loadWideTimeSeries("./data/ecg_raw.csv");
  const examStartMarker = markers.find((m) => m.label === "exam_start");
  renderEcgOverlayStatic("chart-ecg-overlay", waveform, markers, {
    centerOn: examStartMarker?.time_s,
  });

  // --- 2.2 HR + 2.5 RR intervals (same underlying data, see hrOverlayStatic.js) ---
  const hrData = await loadInstantaneousHr("./data/instantaneous_hr.csv");
  renderHrOverlayStatic("chart-instantaneous-hr", hrData, markers);
  renderRrIntervalOverlay("chart-rr-interval", hrData, markers);

  // --- 2.3 HR trend (mean ± SD) ---
  const hrTrendData = await loadTrendWithSd("./data/hr_trend_sd.csv");
  renderTrendWithSd("chart-hr-trend", hrTrendData, markers, { title: "HR trend (mean ± SD)", yLabel: "bpm", unit: " bpm" });

  // --- 2.4 HR distribution by phase ---
  const [hrBoxStats, hrOutliers] = await Promise.all([
    loadBoxStats("./data/hr_box_stats.csv"),
    loadOutliers("./data/hr_box_outliers.csv"),
  ]);
  renderBoxplot("chart-hr-boxplot", hrBoxStats, hrOutliers, { title: "HR distribution", yLabel: "bpm", unit: " bpm" });

  // --- 2.6 RMSSD - sliding window, whole session ---
  const rmssdData = await loadTimeSeries("./data/rmssd.csv");
  renderTimeSeries("chart-timeseries", rmssdData, markers, { yLabel: "RMSSD, ms", unit: " ms" });

  // --- 2.7 RMSSD distribution by phase ---
  const [rmssdBoxStats, rmssdOutliers] = await Promise.all([
    loadBoxStats("./data/rmssd_box_stats.csv"),
    loadOutliers("./data/rmssd_box_outliers.csv"),
  ]);
  renderBoxplot("chart-rmssd-boxplot", rmssdBoxStats, rmssdOutliers, { title: "RMSSD distribution", yLabel: "ms", unit: " ms" });

  // --- 3.1 DTW distance matrix (Baseline / Exam, side by side) ---
  const [dtwBaseline, dtwExam] = await Promise.all([
    loadSynchronyMatrix("./data/dtw_matrix_baseline.csv"),
    loadSynchronyMatrix("./data/dtw_matrix_exam.csv"),
  ]);
  const dtwAllValues = [...dtwBaseline.matrix.flat(), ...dtwExam.matrix.flat()];
  const dtwDomain = [0, Math.max(...dtwAllValues)]; // 0 = identical (diagonal), not -1..1 like correlation
  renderSynchronyHeatmap("chart-dtw-baseline", dtwBaseline, {
    domain: dtwDomain, hideRedundantHalf: true, width: PAIRED_CHART_WIDTH,
  });
  renderSynchronyHeatmap("chart-dtw-exam", dtwExam, {
    domain: dtwDomain, hideRedundantHalf: true, width: PAIRED_CHART_WIDTH,
  });

  // --- 3.2-3.4 DTW alignment example, all three pairs ---
  const dtwAlignmentPairs = [
    { containerId: "chart-dtw-alignment-p1p2", stem: "p1p2" },
    { containerId: "chart-dtw-alignment-p2p3", stem: "p2p3" },
    { containerId: "chart-dtw-alignment-p3p1", stem: "p3p1" },
  ];
  await Promise.all(
    dtwAlignmentPairs.map(async ({ containerId, stem }) => {
      const [series, path] = await Promise.all([
        loadLabeledSeries(`./data/dtw_alignment_${stem}_series.csv`),
        loadAlignmentPath(`./data/dtw_alignment_${stem}_path.csv`),
      ]);
      renderDtwAlignmentExample(containerId, series, path);
    })
  );

  // --- 3.5 Pairwise synchrony matrix (draft placeholder, unchanged) ---
  const synchronyData = await loadSynchronyMatrix("./data/example_synchrony_matrix.csv");
  renderSynchronyHeatmap("chart-heatmap", synchronyData, { domain: [-1, 1] });

  // --- 3.6 Synchrony network (Baseline / Exam, side by side) ---
  const [networkBaseline, networkExam] = await Promise.all([
    loadJSON("./data/network_baseline.json"),
    loadJSON("./data/network_exam.json"),
  ]);
  renderNetwork("chart-network-baseline", networkBaseline, { title: "Baseline", width: PAIRED_CHART_WIDTH });
  renderNetwork("chart-network-exam", networkExam, { title: "Exam", width: PAIRED_CHART_WIDTH });

  // --- 3.7 Recurrence plot (example) ---
  const recurrenceData = await loadJSON("./data/recurrence_example.json");
  renderRecurrencePlot("chart-recurrence", recurrenceData, {
    title: "Cross-recurrence (example pair, example phase)",
    caption: "1 = the closest state pair in this matrix (dark pixel) - see data/README.md §4",
  });
}

main().catch((err) => {
  console.error("Report initialization error:", err);
});
