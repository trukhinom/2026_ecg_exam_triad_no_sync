// src/charts/timeSeries.js
//
// Line chart: one line per participant, with phase background shading
// (Baseline/Exam, from the data's own phase column - more precise than
// the marker-derived shading the other charts use, see phaseShading.js)
// and vertical event markers (exam start etc.). Has hover (crosshair +
// tooltip, see hoverTooltip.js) - the version that was here before was
// removed for a CSS bug (position:absolute with no position:relative on
// the parent); that bug is fixed once, centrally, in hoverTooltip.js, so
// this is back. Expects data in long format:
// [{participant, phase, time_s, value}, ...] - see loadData.js.

import * as d3 from "d3";
import { PARTICIPANT_COLORS, PARTICIPANT_LABELS } from "../utils/participantStyle.js";
import { makeParticipantFilterable } from "../utils/participantFilter.js";
import { formatSeconds } from "../utils/formatTime.js";
import { attachLineHover } from "../utils/hoverTooltip.js";

// Real phase values in the data - "Baseline"/"Exam" (see ecg.py:
// df_triad["Phase"] = np.where(df_triad["abs_time"] < EXAM_START_UTC,
// "Baseline", "Exam")). A phase key that isn't here simply gets no
// background shading (see PHASE_COLORS[phase] || "none" below) - not an
// error, just no fill.
const PHASE_COLORS = {
  Baseline: "var(--phase-baseline)",
  Exam: "var(--phase-exam)",
};

/**
 * @param {string} containerId - id of the container DOM element
 * @param {Array} data - long format: {participant, phase, time_s, value}
 * @param {Array<{label: string, time_s: number}>} [markers] - optional, see loadData.js -> loadMarkers
 * @param {object} [options]
 * @param {string} [options.yLabel] - Y-axis label (e.g. "RMSSD, ms")
 * @param {string} [options.unit] - unit suffix for the hover tooltip (e.g. " ms")
 */
export function renderTimeSeries(containerId, data, markers = [], options = {}) {
  const { yLabel = "value", unit = "" } = options;
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove(); // re-render (resize / data update)

  const width = container.node().clientWidth || 800;
  const height = 340;
  const margin = { top: 16, right: 16, bottom: 32, left: 48 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height + 28); // + room for the legend

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain(d3.extent(data, (d) => d.time_s))
    .range([0, innerW]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, (d) => d.value) * 1.1])
    .nice()
    .range([innerH, 0]);

  // --- Phase background shading ---
  const phaseExtents = d3.rollup(
    data,
    (v) => d3.extent(v, (d) => d.time_s),
    (d) => d.phase
  );
  phaseExtents.forEach(([t0, t1], phase) => {
    if (!PHASE_COLORS[phase]) return; // unknown phase - no shading, not a gray placeholder
    g.append("rect")
      .attr("x", x(t0))
      .attr("y", 0)
      .attr("width", Math.max(0, x(t1) - x(t0)))
      .attr("height", innerH)
      .attr("fill", PHASE_COLORS[phase])
      .attr("opacity", 0.6);
  });

  // --- Axes ---
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(formatSeconds));
  g.append("text").attr("class", "axis")
    .attr("x", innerW).attr("y", innerH + margin.bottom - 6)
    .attr("text-anchor", "end").style("font-size", "0.7rem")
    .text("time, s (elapsed since recording start)");

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));

  g.append("text")
    .attr("class", "axis")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -36)
    .attr("text-anchor", "middle")
    .style("font-size", "0.75rem")
    .text(yLabel);

  // --- Lines per participant ---
  const byParticipant = new Map();
  const line = d3.line()
    .x((d) => x(d.time_s))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  d3.group(data, (d) => d.participant).forEach((values, participant) => {
    const sorted = [...values].sort((a, b) => a.time_s - b.time_s);
    byParticipant.set(participant, sorted);
    // Invisible fat hit path first, same reasoning as ecgOverlayStatic.js.
    g.append("path")
      .datum(sorted)
      .attr("data-participant", participant)
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 12)
      .attr("d", line);
    g.append("path")
      .datum(sorted)
      .attr("data-participant", participant)
      .attr("fill", "none")
      .attr("stroke", PARTICIPANT_COLORS[participant] || "#999")
      .attr("stroke-width", 2)
      .attr("d", line);
  });

  // --- Vertical event markers (e.g. exam start) ---
  markers
    .filter((m) => m.time_s >= x.domain()[0] && m.time_s <= x.domain()[1])
    .forEach((m) => {
      g.append("line")
        .attr("x1", x(m.time_s)).attr("x2", x(m.time_s))
        .attr("y1", 0).attr("y2", innerH)
        .attr("stroke", "#c0392b").attr("stroke-width", 1.5).attr("stroke-dasharray", "5,3");
      g.append("text")
        .attr("x", x(m.time_s) + 4).attr("y", -4)
        .style("font-size", "0.7rem").style("fill", "#c0392b")
        .text(m.label);
    });

  // --- Legend ---
  const legend = container.append("div").attr("class", "legend");
  byParticipant.forEach((_, participant) => {
    const item = legend.append("span").attr("class", "legend-item").attr("data-participant", participant);
    item.append("span")
      .attr("class", "legend-swatch")
      .style("background", PARTICIPANT_COLORS[participant] || "#999");
    item.append("span").text(PARTICIPANT_LABELS[participant] || participant);
  });
  makeParticipantFilterable({ chartElements: g, legend, participants: [...byParticipant.keys()] });

  attachLineHover({
    container, svg, g, x, innerW, innerH,
    marginLeft: margin.left, marginTop: margin.top,
    byParticipant, getTime: (d) => d.time_s, getValue: (d) => d.value,
    unit,
  });
}
