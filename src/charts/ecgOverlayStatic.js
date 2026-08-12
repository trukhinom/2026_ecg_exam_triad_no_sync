// src/charts/ecgOverlayStatic.js
//
// Static (non-interactive, in the zoom/pan sense) overlay of raw ECG for
// three participants on shared axes - modeled on your sketch: lines + a
// zero baseline + minimal axis labels. Does have hover (crosshair +
// tooltip, see hoverTooltip.js) and click-to-filter (participantFilter.js).
// D3 SVG, not Plotly/canvas - renders once and doesn't animate, so SVG
// performance at ~39000 points per line (5 min × 130 Hz) isn't an issue
// (unlike the frame-by-frame animation the original canvas monitor had).

import * as d3 from "d3";
import { PARTICIPANT_COLORS, PARTICIPANT_LABELS } from "../utils/participantStyle.js";
import { makeParticipantFilterable } from "../utils/participantFilter.js";
import { drawPhaseShading } from "../utils/phaseShading.js";
import { formatSeconds } from "../utils/formatTime.js";
import { attachLineHover } from "../utils/hoverTooltip.js";

// Target visual density: how many pixels are given to one second of
// signal. At 120 px/s a QRS complex (~0.1s) takes up ~12px - enough for
// the shape to read as a narrow spike instead of blending into
// neighboring beats (at a typical HR of 60-100 bpm, ~80-140px remain
// between adjacent R-waves - beats stay visually separated). This is a
// starting point, not a precisely calibrated number - if complexes still
// look cramped, increase PX_PER_SECOND (at the same innerW this just
// shortens the auto-computed window duration).
const PX_PER_SECOND = 120;
// Lower bound on the excerpt duration - without it, a narrow screen (e.g.
// mobile, ~380px) would auto-compute ~3 seconds, too little even for a
// couple of beats of context. Only applies to the AUTO computation; if
// windowDuration is passed explicitly in options, this floor doesn't
// touch it.
const MIN_WINDOW_DURATION_S = 5;

/**
 * @param {string} containerId
 * @param {{time_s: number[], series: Record<string, number[]>}} waveform - see loadData.js -> loadWideTimeSeries
 * @param {Array<{label: string, time_s: number}>} [markers] - optional, see loadData.js -> loadMarkers
 * @param {object} [options]
 * @param {number} [options.windowDuration] - visible excerpt duration, seconds.
 *   If not set - computed AUTOMATICALLY from the chart's real width
 *   (innerW / PX_PER_SECOND), i.e. "how many complexes fit in the drawing
 *   area" is literally what gets computed here, not a constant.
 * @param {number} [options.windowStart] - which second of the recording to start the excerpt at.
 *   If not set and centerOn is given - the window is centered on centerOn.
 *   If neither is set - starts from the beginning of the recording (0).
 * @param {number} [options.centerOn] - time_s to center the window on
 *   (e.g. the exam_start marker's time) - only used when windowStart
 *   isn't passed explicitly.
 *
 * WHY THERE IS A DURATION LIMIT AT ALL: at 130 Hz the full 5-minute
 * ecg_raw.csv is ~39000 points per line. Showing all 5 minutes and
 * distinguishable complexes on one static chart at the same time is
 * physically impossible - it's a screen-resolution limit (see
 * data/README.md §8 for the full breakdown), not something that a more
 * precise task description could work around.
 */
export function renderEcgOverlayStatic(containerId, waveform, markers = [], options = {}) {
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  // Fixed design-time width, not measured from the DOM - the SVG scales
  // to its actual container size via viewBox + width:100% below (see the
  // svg.attr(...) call), instead of a JS clientWidth read that has proven
  // fragile across screen sizes twice now (see chat). One side effect:
  // the auto-windowing logic just below is based on THIS fixed width, not
  // the device's actual screen width - on a narrow phone the same number
  // of seconds/complexes are shown, just scaled down as a whole, rather
  // than recomputing a shorter window for that specific screen.
  const width = 900;
  const height = 320;
  const margin = { top: 36, right: 20, bottom: 30, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const dataStart = waveform.time_s[0];
  const dataEnd = waveform.time_s[waveform.time_s.length - 1];
  const dataDuration = dataEnd - dataStart;

  // Window duration - from the chart's real width unless set explicitly;
  // can't be longer than the actually loaded data (otherwise, on a very
  // wide screen with a short recording, the window would be requested
  // past the end of the file).
  const autoWindowDuration = Math.max(MIN_WINDOW_DURATION_S, innerW / PX_PER_SECOND);
  const windowDuration = Math.min(options.windowDuration ?? autoWindowDuration, dataDuration);

  let windowStart;
  if (options.windowStart != null) {
    windowStart = options.windowStart;
  } else if (options.centerOn != null) {
    windowStart = options.centerOn - windowDuration / 2;
  } else {
    windowStart = dataStart;
  }
  // Keep the window from spilling past the loaded data on either side.
  windowStart = Math.max(dataStart, Math.min(windowStart, dataEnd - windowDuration));
  const windowEnd = windowStart + windowDuration;

  // Slice by time BEFORE building scales/paths - all the code below then
  // only works with the visible window (this also cuts the number of
  // points on the path - drawing the excerpt is faster than the whole file).
  const idx0 = d3.bisectLeft(waveform.time_s, windowStart);
  const idx1 = d3.bisectRight(waveform.time_s, windowEnd);
  const time_s = waveform.time_s.slice(idx0, idx1);
  const series = {};
  const participants = Object.keys(waveform.series);
  participants.forEach((p) => {
    series[p] = waveform.series[p].slice(idx0, idx1);
  });
  const visibleMarkers = markers.filter((m) => m.time_s >= windowStart && m.time_s <= windowEnd);

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height + 26}`) // +legend
    .attr("width", "100%")
    .attr("height", "auto")
    .style("display", "block");
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([windowStart, windowEnd]).range([0, innerW]);

  let yMin = Infinity, yMax = -Infinity;
  participants.forEach((p) => {
    series[p].forEach((v) => {
      if (Number.isNaN(v)) return;
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    });
  });
  const yPad = (yMax - yMin) * 0.1;
  const y = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerH, 0]);

  // Title - the excerpt duration is printed right in the label, since
  // it's no longer a constant but computed from the chart width.
  svg.append("text")
    .attr("x", margin.left).attr("y", 20)
    .style("font-family", "var(--font-display)").style("font-size", "1rem")
    .text(`ECG (${windowDuration.toFixed(1)}s excerpt, starting at ${formatSeconds(windowStart)} of the recording)`);

  // Baseline/Exam shading FIRST, so it stays behind everything else
  // (append order = z-order) - see phaseShading.js for why this is
  // derived from the exam_start marker rather than a phase column.
  drawPhaseShading(g, x, innerH, [windowStart, windowEnd], markers);

  // Zero baseline (like the horizontal "0" in your sketch)
  g.append("line")
    .attr("x1", 0).attr("x2", innerW).attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "var(--color-border)").attr("stroke-width", 1);

  // Axes - minimal labeling, not a full D3 grid. Explicit "time, s" title
  // plus a per-tick "s" suffix (formatSeconds) - both together, so the
  // unit is unambiguous even if someone only glances at one tick.
  g.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(formatSeconds));
  g.append("text").attr("class", "axis")
    .attr("x", innerW).attr("y", innerH + 26)
    .attr("text-anchor", "end").style("font-size", "0.7rem")
    .text("time, s (elapsed since recording start)");
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4));
  g.append("text").attr("class", "axis")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2).attr("y", -40)
    .attr("text-anchor", "middle").style("font-size", "0.75rem")
    .text("µV");

  // Participant lines. .defined() breaks the line on NaN (real recording
  // gaps or the edges of mismatched windows after resampling to the
  // shared grid) - instead of drawing a straight line through the gap,
  // as flagged in the Python export script.
  const line = d3.line()
    .defined((d) => !Number.isNaN(d.v))
    .x((d) => x(d.t))
    .y((d) => y(d.v))
    .curve(d3.curveLinear);

  const byParticipant = new Map();
  participants.forEach((p) => {
    const points = time_s.map((t, i) => ({ t, v: series[p][i] }));
    byParticipant.set(p, points);
    // Invisible fat "hit path" UNDER the visible line - a 1.25px stroke is
    // too thin to reliably click; this widens the clickable area without
    // changing how the line looks. Same data-participant, so it's picked
    // up by makeParticipantFilterable() just like the visible line is.
    g.append("path")
      .datum(points)
      .attr("data-participant", p)
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 12)
      .attr("d", line);
    g.append("path")
      .datum(points)
      .attr("data-participant", p)
      .attr("fill", "none")
      .attr("stroke", PARTICIPANT_COLORS[p] || "#999")
      .attr("stroke-width", 1.25)
      .attr("d", line);
  });

  // Vertical event markers (e.g. exam start) - only the ones that fall
  // inside the visible window; outside it, x(m.time_s) would land outside
  // the chart.
  visibleMarkers.forEach((m) => {
    g.append("line")
      .attr("x1", x(m.time_s)).attr("x2", x(m.time_s))
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "#c0392b").attr("stroke-width", 1.5).attr("stroke-dasharray", "5,3");
    g.append("text")
      .attr("x", x(m.time_s) + 4).attr("y", -6)
      .style("font-size", "0.7rem").style("fill", "#c0392b")
      .text(m.label);
  });

  // Legend and the drawn lines are both clickable, and both stay in sync
  // with every other chart's filter state (see participantFilter.js).
  const legend = container.append("div").attr("class", "legend");
  participants.forEach((p) => {
    const item = legend.append("span").attr("class", "legend-item").attr("data-participant", p);
    item.append("span").attr("class", "legend-swatch").style("background", PARTICIPANT_COLORS[p] || "#999");
    item.append("span").text(PARTICIPANT_LABELS[p] || p);
  });
  makeParticipantFilterable({ chartElements: g, legend, participants });

  attachLineHover({
    container, svg, g, x, innerW, innerH,
    marginLeft: margin.left, marginTop: margin.top,
    byParticipant, getTime: (d) => d.t, getValue: (d) => d.v,
    unit: " µV",
  });
}
