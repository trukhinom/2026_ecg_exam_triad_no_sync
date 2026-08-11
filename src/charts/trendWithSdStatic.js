// src/charts/trendWithSdStatic.js
//
// Line chart of a sliding-window mean with a ±SD band — modeled on the
// Plotly reference ("HR trend... mean +- SD, 2-min windows"), for the
// whole session, not top-5 devices. The ±SD band is drawn UNDER the mean
// line (d3.area), the line itself on top. Has hover (shows mean ± SD, not
// just mean) and click-to-filter, same as the other line charts.

import * as d3 from "d3";
import { PARTICIPANT_COLORS, PARTICIPANT_LABELS } from "../utils/participantStyle.js";
import { makeParticipantFilterable } from "../utils/participantFilter.js";
import { drawPhaseShading } from "../utils/phaseShading.js";
import { formatSeconds } from "../utils/formatTime.js";
import { attachLineHover } from "../utils/hoverTooltip.js";

/**
 * @param {string} containerId
 * @param {Array<{participant: string, time_s: number, mean: number, sd: number}>} data - see loadData.js -> loadTrendWithSd
 * @param {Array<{label: string, time_s: number}>} [markers]
 * @param {object} [options]
 * @param {string} [options.title] - chart title ("HR trend (mean ± SD)")
 * @param {string} [options.yLabel] - Y-axis label ("bpm")
 * @param {string} [options.unit] - unit suffix for the hover tooltip (" bpm")
 */
export function renderTrendWithSd(containerId, data, markers = [], options = {}) {
  const { title = "Trend (mean ± SD)", yLabel = "value", unit = "" } = options;
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  const participants = [...new Set(data.map((d) => d.participant))];
  const width = container.node().clientWidth || 900;
  const height = 320;
  const margin = { top: 36, right: 20, bottom: 30, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append("svg").attr("width", width).attr("height", height + 26);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const xDomain = d3.extent(data, (d) => d.time_s);
  const x = d3.scaleLinear().domain(xDomain).range([0, innerW]);
  const yMin = d3.min(data, (d) => d.mean - d.sd);
  const yMax = d3.max(data, (d) => d.mean + d.sd);
  const yPad = (yMax - yMin) * 0.08;
  const y = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).nice().range([innerH, 0]);

  svg.append("text")
    .attr("x", margin.left).attr("y", 20)
    .style("font-family", "var(--font-display)").style("font-size", "1rem")
    .text(title);

  drawPhaseShading(g, x, innerH, xDomain, markers);

  g.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(formatSeconds));
  g.append("text").attr("class", "axis")
    .attr("x", innerW).attr("y", innerH + margin.bottom - 4)
    .attr("text-anchor", "end").style("font-size", "0.7rem")
    .text("time, s (elapsed since recording start)");
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
  g.append("text").attr("class", "axis")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2).attr("y", -40)
    .attr("text-anchor", "middle").style("font-size", "0.75rem")
    .text(yLabel);

  const area = d3.area()
    .x((d) => x(d.time_s))
    .y0((d) => y(d.mean - d.sd))
    .y1((d) => y(d.mean + d.sd))
    .curve(d3.curveMonotoneX);

  const line = d3.line()
    .x((d) => x(d.time_s))
    .y((d) => y(d.mean))
    .curve(d3.curveMonotoneX);

  const byParticipant = new Map();
  d3.group(data, (d) => d.participant).forEach((values, p) => {
    const sorted = [...values].sort((a, b) => a.time_s - b.time_s);
    byParticipant.set(p, sorted);
    g.append("path")
      .datum(sorted)
      .attr("data-participant", p)
      .attr("fill", PARTICIPANT_COLORS[p] || "#999")
      .attr("opacity", 0.15)
      .attr("d", area);
  });
  // Lines are drawn in a SEPARATE pass AFTER all bands - otherwise one
  // participant's band would cover another's line if drawn pair by pair.
  byParticipant.forEach((sorted, p) => {
    g.append("path")
      .datum(sorted)
      .attr("data-participant", p)
      .attr("fill", "none")
      .attr("stroke", PARTICIPANT_COLORS[p] || "#999")
      .attr("stroke-width", 2)
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
    byParticipant, getTime: (d) => d.time_s, getValue: (d) => d.mean,
    formatValue: (v, d) => `${v.toFixed(1)} ± ${d.sd.toFixed(1)}`,
    unit,
  });
}
