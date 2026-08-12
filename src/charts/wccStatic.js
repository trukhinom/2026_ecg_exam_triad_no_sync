// src/charts/wccStatic.js
//
// Windowed Cross-Correlation: sliding Pearson r between each pair of
// participants' instantaneous HR, one line per pair (not per participant -
// see pairStyle.js for why this uses its own color/label scheme instead of
// participantStyle.js). Click-to-filter here is a SEPARATE, LOCAL toggle
// (its own small hidden-set, scoped to this one chart) rather than the
// shared participantFilter.js - that module is specifically about single
// participants staying in sync across every participant-keyed chart on
// the page, and there's no other "pair"-keyed chart for a pair's
// visibility to sync with. Also has phase shading (from the exam_start
// marker, like the other continuous charts that don't carry their own
// phase column) and hover.

import * as d3 from "d3";
import { PAIR_COLORS, PAIR_LABELS } from "../utils/pairStyle.js";
import { getContentWidth } from "../utils/containerWidth.js";
import { drawPhaseShading } from "../utils/phaseShading.js";
import { formatSeconds } from "../utils/formatTime.js";
import { attachLineHover } from "../utils/hoverTooltip.js";

/**
 * @param {string} containerId
 * @param {Array<{pair: string, time_s: number, r: number}>} data - see loadData.js -> loadPairTimeSeries
 * @param {Array<{label: string, time_s: number}>} [markers]
 */
export function renderWcc(containerId, data, markers = []) {
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  const width = getContentWidth(container, 800);
  const height = 340;
  const margin = { top: 36, right: 16, bottom: 32, left: 48 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append("svg").attr("width", width).attr("height", height + 28);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const xDomain = d3.extent(data, (d) => d.time_s);
  const x = d3.scaleLinear().domain(xDomain).range([0, innerW]);
  const rExtent = d3.extent(data, (d) => d.r);
  const rPad = (rExtent[1] - rExtent[0]) * 0.08;
  const y = d3.scaleLinear().domain([rExtent[0] - rPad, rExtent[1] + rPad]).nice().range([innerH, 0]);

  svg.append("text")
    .attr("x", margin.left).attr("y", 20)
    .style("font-family", "var(--font-display)").style("font-size", "1rem")
    .text("WCC");

  drawPhaseShading(g, x, innerH, xDomain, markers);

  // Zero line - r=0 means "no linear relationship this window", a natural
  // reference for a correlation chart (unlike the other charts, which start
  // their y-axis at 0 rather than draw a zero-reference line through it).
  g.append("line")
    .attr("x1", 0).attr("x2", innerW).attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "var(--color-border)").attr("stroke-width", 1);

  g.append("g").attr("class", "axis")
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
    .text("Pearson r");

  const byPair = new Map();
  const line = d3.line()
    .x((d) => x(d.time_s))
    .y((d) => y(d.r))
    .curve(d3.curveMonotoneX);

  d3.group(data, (d) => d.pair).forEach((values, pair) => {
    const sorted = [...values].sort((a, b) => a.time_s - b.time_s);
    byPair.set(pair, sorted);
    // Invisible fat hit path first, same reasoning as every other line
    // chart - a 1.5px stroke is too thin to reliably click.
    g.append("path")
      .datum(sorted)
      .attr("data-pair", pair)
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 12)
      .attr("d", line);
    g.append("path")
      .datum(sorted)
      .attr("data-pair", pair)
      .attr("fill", "none")
      .attr("stroke", PAIR_COLORS[pair] || "#999")
      .attr("stroke-width", 1.5)
      .attr("d", line);
  });

  markers
    .filter((m) => m.time_s >= xDomain[0] && m.time_s <= xDomain[1])
    .forEach((m) => {
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
  byPair.forEach((_, pair) => {
    const item = legend.append("span").attr("class", "legend-item").attr("data-pair", pair);
    item.append("span").attr("class", "legend-swatch").style("background", PAIR_COLORS[pair] || "#999");
    item.append("span").text(PAIR_LABELS[pair] || pair);
  });

  // Local click-to-toggle, scoped to this chart only (see file header for
  // why this doesn't use the shared participantFilter.js).
  const hiddenPairs = new Set();
  function applyVisibility() {
    byPair.forEach((_, pair) => {
      const hide = hiddenPairs.has(pair);
      g.selectAll(`[data-pair="${pair}"]`).style("display", hide ? "none" : null);
      legend.select(`.legend-item[data-pair="${pair}"]`).classed("legend-item--muted", hide);
    });
  }
  function toggle(pair) {
    if (hiddenPairs.has(pair)) hiddenPairs.delete(pair);
    else hiddenPairs.add(pair);
    applyVisibility();
  }
  legend.selectAll(".legend-item")
    .classed("legend-item--clickable", true)
    .on("click", function () { toggle(d3.select(this).attr("data-pair")); });
  g.selectAll("[data-pair]")
    .classed("chart-el--clickable", true)
    .on("click", function () { toggle(d3.select(this).attr("data-pair")); });

  attachLineHover({
    container, svg, g, x, innerW, innerH,
    marginLeft: margin.left, marginTop: margin.top,
    byParticipant: byPair, getTime: (d) => d.time_s, getValue: (d) => d.r,
    formatValue: (v) => v.toFixed(3),
    colors: PAIR_COLORS, labels: PAIR_LABELS,
  });
}
