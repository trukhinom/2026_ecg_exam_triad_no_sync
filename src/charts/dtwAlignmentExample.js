// src/charts/dtwAlignmentExample.js
//
// DTW illustration: two series (z-scored RMSSD, one pair of participants,
// one phase) are drawn ABOVE one another (not overlaid - thin connector
// lines between DTW-matched points wouldn't read visually if the curves
// crossed), with straight lines between every (i,j) pair from the warping
// path. The connector's slope/length IS "how far the series had to shift
// to find the same shape": a vertical connector = points matched with no
// time shift, a slanted one = a shift was needed.

import * as d3 from "d3";
import { PARTICIPANT_COLORS, PARTICIPANT_LABELS } from "../utils/participantStyle.js";
import { getContentWidth } from "../utils/containerWidth.js";
import { formatSeconds } from "../utils/formatTime.js";

/**
 * @param {string} containerId
 * @param {Array<{participant: string, time_s: number, value: number}>} series - see loadData.js -> loadLabeledSeries; expects EXACTLY 2 participants
 * @param {Array<{i: number, j: number}>} path - see loadData.js -> loadAlignmentPath
 * @param {object} [options]
 * @param {string} [options.title]
 */
export function renderDtwAlignmentExample(containerId, series, path, options = {}) {
  const { title = "DTW alignment example" } = options;
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  const participants = [...new Set(series.map((d) => d.participant))];
  if (participants.length !== 2) {
    container.append("p").text(`renderDtwAlignmentExample: expected exactly 2 participants, got ${participants.length}`);
    return;
  }
  const [pA, pB] = participants;
  const seriesA = series.filter((d) => d.participant === pA).sort((a, b) => a.time_s - b.time_s);
  const seriesB = series.filter((d) => d.participant === pB).sort((a, b) => a.time_s - b.time_s);

  const width = getContentWidth(container, 900);
  const height = 420;
  const margin = { top: 40, right: 20, bottom: 30, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append("svg").attr("width", width).attr("height", height + 26);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const allTimes = [...seriesA, ...seriesB].map((d) => d.time_s);
  const x = d3.scaleLinear().domain(d3.extent(allTimes)).range([0, innerW]);

  // The two series are drawn in two separate vertical bands (not a shared
  // scale) - top half for A, bottom half for B, with a gap between them.
  const bandH = innerH * 0.38;
  const gap = innerH * 0.24;
  const yA = d3.scaleLinear().domain(d3.extent(seriesA, (d) => d.value)).nice().range([bandH, 0]);
  const yB = d3.scaleLinear().domain(d3.extent(seriesB, (d) => d.value)).nice().range([bandH + gap + bandH, bandH + gap]);

  svg.append("text")
    .attr("x", margin.left).attr("y", 20)
    .style("font-family", "var(--font-display)").style("font-size", "1rem")
    .text(title);

  // Connectors are drawn FIRST, so the series lines sit on top of them.
  g.selectAll("line.dtw-link")
    .data(path)
    .join("line")
    .attr("class", "dtw-link")
    .attr("x1", (d) => x(seriesA[d.i]?.time_s))
    .attr("y1", (d) => yA(seriesA[d.i]?.value))
    .attr("x2", (d) => x(seriesB[d.j]?.time_s))
    .attr("y2", (d) => yB(seriesB[d.j]?.value))
    .attr("stroke", "var(--color-ink-soft)")
    .attr("stroke-width", 0.6)
    .attr("opacity", 0.35);

  const lineA = d3.line().x((d) => x(d.time_s)).y((d) => yA(d.value)).curve(d3.curveMonotoneX);
  const lineB = d3.line().x((d) => x(d.time_s)).y((d) => yB(d.value)).curve(d3.curveMonotoneX);

  g.append("path").datum(seriesA).attr("fill", "none")
    .attr("stroke", PARTICIPANT_COLORS[pA] || "#999").attr("stroke-width", 2).attr("d", lineA);
  g.append("path").datum(seriesB).attr("fill", "none")
    .attr("stroke", PARTICIPANT_COLORS[pB] || "#999").attr("stroke-width", 2).attr("d", lineB);

  g.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(formatSeconds));
  g.append("text").attr("class", "axis")
    .attr("x", innerW).attr("y", innerH + margin.bottom - 4)
    .attr("text-anchor", "end").style("font-size", "0.7rem")
    .text("time, s (elapsed since recording start)");

  g.append("text").attr("x", 0).attr("y", -6).style("font-size", "0.75rem")
    .style("fill", PARTICIPANT_COLORS[pA]).text(`${PARTICIPANT_LABELS[pA] || pA} (z-score)`);
  g.append("text").attr("x", 0).attr("y", bandH + gap - 6).style("font-size", "0.75rem")
    .style("fill", PARTICIPANT_COLORS[pB]).text(`${PARTICIPANT_LABELS[pB] || pB} (z-score)`);
}
