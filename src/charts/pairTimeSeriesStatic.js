// src/charts/pairTimeSeriesStatic.js
//
// Generic line chart for a metric computed PER PAIR of participants over
// time (not per single participant) - one line per pair, using
// pairStyle.js's own color/label scheme (not participantStyle.js - see
// that file for why). Two metrics currently share this renderer:
//   - WCC (3.1): sliding Pearson r, one value per window
//   - WCLC lag (3.x): the SAME sliding-window machinery, but the value is
//     the time shift (seconds) at that window's best-correlated lag, not
//     the correlation itself - answers "who's ahead of whom, and by how
//     much", something a plain r(t) chart can't show at all.
// Click-to-filter uses the shared pairFilter.js (own state, separate from
// participantFilter.js, since a "pair" isn't a participant) - hiding a
// pair on WCC also hides it on WCLC lag, and vice versa. Also has phase
// shading (from the exam_start marker, like the other continuous charts
// that don't carry their own phase column) and hover.

import * as d3 from "d3";
import { PAIR_COLORS, PAIR_LABELS } from "../utils/pairStyle.js";
import { makePairFilterable } from "../utils/pairFilter.js";
import { drawPhaseShading } from "../utils/phaseShading.js";
import { formatSeconds } from "../utils/formatTime.js";
import { attachLineHover } from "../utils/hoverTooltip.js";

/**
 * @param {string} containerId
 * @param {Array<object>} data - long format, each point has pair/time_s + valueKey
 * @param {Array<{label: string, time_s: number}>} markers
 * @param {object} options
 * @param {string} options.valueKey - name of the value field (e.g. "r" or "lagS")
 * @param {string} options.title - chart title
 * @param {string} options.yLabel - Y-axis label
 * @param {string} options.unit - unit suffix for the hover tooltip
 * @param {(v: number) => string} [options.formatValue]
 */
function renderPairTimeSeries(containerId, data, markers, { valueKey, title, yLabel, unit, formatValue = (v) => v.toFixed(2) }) {
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  // Fixed design-time width, not measured from the DOM - the SVG scales
  // to its actual container size via viewBox + width:100% below, which
  // lets the BROWSER'S CSS engine handle the real sizing (same mechanism
  // as `main { max-width: 880px }`) instead of a JS clientWidth read that
  // has proven fragile across screen sizes twice now (see chat).
  const width = 800;
  const height = 340;
  const margin = { top: 36, right: 16, bottom: 32, left: 48 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height + 28}`)
    .attr("width", "100%")
    .attr("height", "auto")
    .style("display", "block");
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const xDomain = d3.extent(data, (d) => d.time_s);
  const x = d3.scaleLinear().domain(xDomain).range([0, innerW]);
  const vExtent = d3.extent(data, (d) => d[valueKey]);
  const vPad = (vExtent[1] - vExtent[0]) * 0.08;
  const y = d3.scaleLinear().domain([vExtent[0] - vPad, vExtent[1] + vPad]).nice().range([innerH, 0]);

  svg.append("text")
    .attr("x", margin.left).attr("y", 20)
    .style("font-family", "var(--font-display)").style("font-size", "1rem")
    .text(title);

  drawPhaseShading(g, x, innerH, xDomain, markers);

  // Zero line - both r and lag have a meaningful "0" (no correlation /
  // no time shift) - a natural reference, unlike the other charts, which
  // start their y-axis at 0 rather than draw a zero-reference line
  // through the middle of the plotted range.
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
    .text(yLabel);

  const byPair = new Map();
  const line = d3.line()
    .x((d) => x(d.time_s))
    .y((d) => y(d[valueKey]))
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
  makePairFilterable({ chartElements: g, legend, pairs: [...byPair.keys()] });

  attachLineHover({
    container, svg, g, x, innerW, innerH,
    marginLeft: margin.left, marginTop: margin.top,
    byParticipant: byPair, getTime: (d) => d.time_s, getValue: (d) => d[valueKey],
    formatValue,
    colors: PAIR_COLORS, labels: PAIR_LABELS,
    unit,
  });
}

/**
 * @param {string} containerId
 * @param {Array<{pair: string, time_s: number, r: number}>} data - see loadData.js -> loadPairTimeSeries
 * @param {Array<{label: string, time_s: number}>} [markers]
 */
export function renderWcc(containerId, data, markers = []) {
  renderPairTimeSeries(containerId, data, markers, {
    valueKey: "r", title: "WCC", yLabel: "Pearson r", unit: "",
    formatValue: (v) => v.toFixed(3),
  });
}

/**
 * @param {string} containerId
 * @param {Array<{pair: string, time_s: number, lagS: number}>} data - see loadData.js -> loadPairTimeSeries
 * @param {Array<{label: string, time_s: number}>} [markers]
 */
export function renderWclcLag(containerId, data, markers = []) {
  renderPairTimeSeries(containerId, data, markers, {
    valueKey: "lagS", title: "WCLC — lag", yLabel: "lag, s", unit: "s",
    formatValue: (v) => v.toFixed(0),
  });
}
