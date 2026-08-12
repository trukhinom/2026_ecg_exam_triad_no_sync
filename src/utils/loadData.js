// src/utils/loadData.js
//
// Thin wrapper over d3-fetch: one central data-loading module, so the
// parsing format (column types) isn't duplicated in every chart module.

import * as d3 from "d3";

/**
 * Loads a time series in long format:
 * participant,phase,time_s,value
 *
 * @param {string} url - path to the CSV, e.g. "./data/rmssd.csv"
 * @returns {Promise<Array<{participant: string, phase: string, time_s: number, value: number}>>}
 */
export async function loadTimeSeries(url) {
  return d3.csv(url, (d) => ({
    participant: d.participant,
    phase: d.phase,
    time_s: +d.time_s,
    value: +d.value,
  }));
}

/**
 * Loads a time series in long format WITH a bootstrap 95% CI band:
 * participant,phase,time_s,value,ci_low,ci_high (see data/README.md, section 1).
 * Currently only rmssd.csv has the ci_low/ci_high columns - loadTimeSeries()
 * above stays the plain version for any future chart that doesn't need a
 * band, rather than making every caller carry unused ciLow/ciHigh fields.
 *
 * @param {string} url
 * @returns {Promise<Array<{participant: string, phase: string, time_s: number, value: number, ciLow: number, ciHigh: number}>>}
 */
export async function loadTimeSeriesWithCI(url) {
  return d3.csv(url, (d) => ({
    participant: d.participant,
    phase: d.phase,
    time_s: +d.time_s,
    value: +d.value,
    ciLow: +d.ci_low,
    ciHigh: +d.ci_high,
  }));
}

/**
 * Loads a pair-keyed time series, long format: pair,time_s,r
 * (see data/README.md, section 14). "pair" is p1p2/p2p3/p3p1 - the SAME
 * anonymized stems used by the DTW alignment files (section 13) - not a
 * participant id, so this does NOT reuse loadTimeSeries()'s participant
 * field naming.
 * @param {string} url
 * @returns {Promise<Array<{pair: string, time_s: number, r: number}>>}
 */
export async function loadPairTimeSeries(url) {
  return d3.csv(url, (d) => ({
    pair: d.pair,
    time_s: +d.time_s,
    r: +d.r,
  }));
}

/**
 * Loads a square pairwise synchrony matrix in wide format: first column
 * is the participant id, remaining columns are that participant's values
 * against every other participant (see data/dtw_matrix_baseline.csv).
 *
 * @param {string} url
 * @returns {Promise<{participants: string[], matrix: number[][]}>}
 */
export async function loadSynchronyMatrix(url) {
  const raw = await d3.csv(url);
  const participants = raw.columns.slice(1); // all columns except the first (id)
  const matrix = raw.map((row) => participants.map((p) => +row[p]));
  return { participants, matrix };
}

/**
 * Loads arbitrary JSON (for the network graph: {nodes, links}).
 * @param {string} url
 */
export async function loadJSON(url) {
  return d3.json(url);
}

/**
 * Loads a multi-participant signal on a shared time axis, wide format:
 * time_s,participant_1,participant_2,participant_3 (see data/README.md, section 5).
 *
 * IMPORTANT: does not use d3.autoType - it turns an empty CSV cell (how
 * pandas .to_csv() writes NaN by default) into `null`, not `NaN`.
 * `Number.isNaN(null)` is `false`, so the chart below wouldn't recognize
 * the gap (see .defined() in ecgOverlayStatic.js) and would draw a line
 * straight through it instead of breaking it. Empty strings are coerced
 * to NaN explicitly here.
 *
 * @param {string} url
 * @returns {Promise<{time_s: number[], series: Record<string, number[]>}>}
 */
export async function loadWideTimeSeries(url) {
  const raw = await d3.csv(url, (d) => {
    const row = { time_s: +d.time_s };
    for (const key in d) {
      if (key === "time_s") continue;
      row[key] = d[key] === "" ? NaN : +d[key];
    }
    return row;
  });
  const participants = raw.columns.filter((c) => c !== "time_s");
  const time_s = raw.map((d) => d.time_s);
  const series = {};
  participants.forEach((p) => {
    series[p] = raw.map((d) => d[p]);
  });
  return { time_s, series };
}

/**
 * Loads instantaneous HR, long format: participant,time_s,hr_bpm
 * (see data/README.md, section 6).
 * @param {string} url
 * @returns {Promise<Array<{participant: string, time_s: number, hr_bpm: number}>>}
 */
export async function loadInstantaneousHr(url) {
  return d3.csv(url, (d) => ({
    participant: d.participant,
    time_s: +d.time_s,
    hr_bpm: +d.hr_bpm,
  }));
}

/**
 * Loads a sliding-window mean ± SD trend, long format:
 * participant,time_s,mean_bpm,sd_bpm (see data/README.md, section 10).
 * @param {string} url
 */
export async function loadTrendWithSd(url) {
  return d3.csv(url, (d) => ({
    participant: d.participant,
    time_s: +d.time_s,
    mean: +d.mean_bpm,
    sd: +d.sd_bpm,
  }));
}

/**
 * Loads box-plot statistics, long format:
 * participant,phase,q1,median,q3,whisker_low,whisker_high,n
 * (see data/README.md, section 11).
 * @param {string} url
 */
export async function loadBoxStats(url) {
  return d3.csv(url, (d) => ({
    participant: d.participant,
    phase: d.phase,
    q1: +d.q1,
    median: +d.median,
    q3: +d.q3,
    whiskerLow: +d.whisker_low,
    whiskerHigh: +d.whisker_high,
    n: +d.n,
  }));
}

/**
 * Loads box-plot outliers, long format: participant,phase,value
 * (see data/README.md, section 11).
 * @param {string} url
 */
export async function loadOutliers(url) {
  return d3.csv(url, (d) => ({
    participant: d.participant,
    phase: d.phase,
    value: +d.value,
  }));
}

/**
 * Loads a single labeled series (e.g. a z-scored series for the DTW
 * alignment example), long format: participant,time_s,value
 * (see data/README.md, section 13).
 * @param {string} url
 */
export async function loadLabeledSeries(url) {
  return d3.csv(url, (d) => ({
    participant: d.participant,
    time_s: +d.time_s,
    value: +d.value,
  }));
}

/**
 * Loads a DTW alignment path (indices of matched points), format: i,j
 * (see data/README.md, section 13).
 * @param {string} url
 * @returns {Promise<Array<{i: number, j: number}>>}
 */
export async function loadAlignmentPath(url) {
  return d3.csv(url, (d) => ({ i: +d.i, j: +d.j }));
}

/**
 * Loads vertical event markers (e.g. exam start) for drawing on charts:
 * label,time_s (see data/README.md, section 7).
 * The file is optional - if it doesn't exist yet, the caller must handle
 * the rejection itself (see the example in index.js) and simply not draw
 * markers.
 * @param {string} url
 * @returns {Promise<Array<{label: string, time_s: number}>>}
 */
export async function loadMarkers(url) {
  return d3.csv(url, (d) => ({
    label: d.label,
    time_s: +d.time_s,
  }));
}
