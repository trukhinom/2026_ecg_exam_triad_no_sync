// src/charts/hrOverlayStatic.js
//
// Static per-beat (one point per heartbeat) line chart of three
// participants on shared axes - same logic as ecgOverlayStatic.js
// (hover, click-to-filter, phase shading, plain-seconds axis). The core
// (renderBeatValueOverlay) is generalized over the value key and Y-axis
// label so that instantaneous HR (bpm) and RR intervals (ms) -
// mathematically the same series (RR_ms = 60000/HR_bpm) - are drawn by
// the same code, without copying the whole file for a second unit.

import * as d3 from "d3";
import { PARTICIPANT_COLORS, PARTICIPANT_LABELS } from "../utils/participantStyle.js";
import { makeParticipantFilterable } from "../utils/participantFilter.js";
import { drawPhaseShading } from "../utils/phaseShading.js";
import { formatSeconds } from "../utils/formatTime.js";
import { attachLineHover } from "../utils/hoverTooltip.js";

/**
 * @param {string} containerId
 * @param {Array<object>} data - long format, each point has participant/time_s + valueKey
 * @param {Array<{label: string, time_s: number}>} markers
 * @param {object} options
 * @param {string} options.valueKey - name of the value field (e.g. "hr_bpm" or "rr_ms")
 * @param {string} options.title - chart title ("HR" / "RR intervals")
 * @param {string} options.yLabel - Y-axis label ("bpm" / "ms")
 * @param {string} options.unit - unit suffix for the hover tooltip (" bpm" / " ms")
 */
function renderBeatValueOverlay(containerId, data, markers, { valueKey, title, yLabel, unit }) {
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  const participants = [...new Set(data.map((d) => d.participant))];
  const width = container.node().clientWidth || 900;
  const height = 280;
  const margin = { top: 36, right: 20, bottom: 30, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append("svg").attr("width", width).attr("height", height + 26);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const xDomain = d3.extent(data, (d) => d.time_s);
  const x = d3.scaleLinear().domain(xDomain).range([0, innerW]);
  const yExtent = d3.extent(data, (d) => d[valueKey]);
  const yPad = (yExtent[1] - yExtent[0]) * 0.08;
  const y = d3.scaleLinear().domain([yExtent[0] - yPad, yExtent[1] + yPad]).nice().range([innerH, 0]);

  svg.append("text")
    .attr("x", margin.left).attr("y", 20)
    .style("font-family", "var(--font-display)").style("font-size", "1rem")
    .text(title);

  drawPhaseShading(g, x, innerH, xDomain, markers);

  g.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(formatSeconds));
  g.append("text").attr("class", "axis")
    .attr("x", innerW).attr("y", innerH + margin.bottom - 4)
    .attr("text-anchor", "end").style("font-size", "0.7rem")
    .text("time, s (elapsed since recording start)");
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));
  g.append("text").attr("class", "axis")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2).attr("y", -40)
    .attr("text-anchor", "middle").style("font-size", "0.75rem")
    .text(yLabel);

  const line = d3.line()
    .x((d) => x(d.time_s))
    .y((d) => y(d[valueKey]))
    .curve(d3.curveMonotoneX);

  const byParticipant = new Map();
  d3.group(data, (d) => d.participant).forEach((values, p) => {
    const sorted = [...values].sort((a, b) => a.time_s - b.time_s);
    byParticipant.set(p, sorted);
    // Invisible fat hit path first, widens the clickable area beyond the
    // 1.5px visible stroke - see the same pattern in ecgOverlayStatic.js.
    g.append("path")
      .datum(sorted)
      .attr("data-participant", p)
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 12)
      .attr("d", line);
    g.append("path")
      .datum(sorted)
      .attr("data-participant", p)
      .attr("fill", "none")
      .attr("stroke", PARTICIPANT_COLORS[p] || "#999")
      .attr("stroke-width", 1.5)
      .attr("d", line);
  });

  markers.forEach((m) => {
    g.append("line")
      .attr("x1", x(m.time_s)).attr("x2", x(m.time_s))
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "#c0392b").attr("stroke-width", 1.5).attr("stroke-dasharray", "5,3");
    g.append("text")
      .attr("x", x(m.time_s) + 4).attr("y", -6)
      .style("font-size", "0.7rem").style("fill", "#c0392b")
      .text(m.label);
  });

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
    byParticipant, getTime: (d) => d.time_s, getValue: (d) => d[valueKey],
    unit,
  });
}

/**
 * @param {string} containerId
 * @param {Array<{participant: string, time_s: number, hr_bpm: number}>} data - see loadData.js -> loadInstantaneousHr
 * @param {Array<{label: string, time_s: number}>} [markers]
 */
export function renderHrOverlayStatic(containerId, data, markers = []) {
  renderBeatValueOverlay(containerId, data, markers, {
    valueKey: "hr_bpm", title: "HR", yLabel: "bpm", unit: " bpm",
  });
}

/**
 * RR intervals - NOT a separate Python export: RR_ms = 60000 / HR_bpm,
 * the same beat, the same timestamp. Recomputed here from the already
 * loaded instantaneous_hr.csv (see index.js) instead of duplicating the
 * same series across two CSVs.
 *
 * @param {string} containerId
 * @param {Array<{participant: string, time_s: number, hr_bpm: number}>} hrData
 * @param {Array<{label: string, time_s: number}>} [markers]
 */
export function renderRrIntervalOverlay(containerId, hrData, markers = []) {
  const rrData = hrData.map((d) => ({
    participant: d.participant,
    time_s: d.time_s,
    rr_ms: 60000 / d.hr_bpm,
  }));
  renderBeatValueOverlay(containerId, rrData, markers, {
    valueKey: "rr_ms", title: "RR intervals", yLabel: "ms", unit: " ms",
  });
}
