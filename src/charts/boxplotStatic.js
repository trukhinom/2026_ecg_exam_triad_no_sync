// src/charts/boxplotStatic.js
//
// Generic box-and-whisker chart: participant × phase (Baseline/Exam), box
// statistics are PRECOMPUTED in Python (q1/median/q3/whiskers/n - see
// box_stats() in the export script), not recomputed in the browser - D3
// has no built-in box-plot primitive (unlike Plotly), and keeping the
// statistical logic (whisker rule, outlier definition) in one place - in
// Python, alongside the rest of the methodology - is more reliable than
// duplicating it in JS. This file is reused for HR (0.4) and RMSSD (0.7)
// - same render code, different data and labels. Hover shows the box's
// full stats (not just whatever's under the cursor, since there's no
// continuous line to read a "nearest point" from - hover here is per
// discrete box/outlier, via createTooltip() rather than attachLineHover()).

import * as d3 from "d3";
import { PARTICIPANT_COLORS, PARTICIPANT_LABELS } from "../utils/participantStyle.js";
import { makeParticipantFilterable } from "../utils/participantFilter.js";
import { createTooltip } from "../utils/hoverTooltip.js";

/**
 * @param {string} containerId
 * @param {Array<{participant, phase, q1, median, q3, whiskerLow, whiskerHigh, n}>} boxStats - see loadData.js -> loadBoxStats
 * @param {Array<{participant, phase, value}>} outliers - see loadData.js -> loadOutliers
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {string} [options.yLabel]
 * @param {string} [options.unit] - unit suffix for the hover tooltip (e.g. " bpm")
 * @param {string[]} [options.phaseOrder] - left-to-right phase order (default ["Baseline","Exam"])
 */
export function renderBoxplot(containerId, boxStats, outliers, options = {}) {
  const { title = "Distribution by phase", yLabel = "value", unit = "", phaseOrder = ["Baseline", "Exam"] } = options;

  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  const participants = [...new Set(boxStats.map((d) => d.participant))];
  // Fixed design-time width, not measured from the DOM - the SVG scales
  // to its actual container size via viewBox + width:100% below, which
  // lets the BROWSER'S CSS engine handle the real sizing (same mechanism
  // as `main { max-width: 880px }`) instead of a JS clientWidth read that
  // has proven fragile across screen sizes twice now (see chat).
  const width = 700;
  const height = 320;
  const margin = { top: 36, right: 20, bottom: 36, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height + 26}`)
    .attr("width", "100%")
    .attr("height", "auto")
    .style("display", "block");
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Grouped by phase (outer axis), one column per participant inside it.
  const x0 = d3.scaleBand().domain(phaseOrder).range([0, innerW]).paddingOuter(0.15).paddingInner(0.3);
  const x1 = d3.scaleBand().domain(participants).range([0, x0.bandwidth()]).padding(0.25);

  const allVals = [
    ...boxStats.flatMap((d) => [d.whiskerLow, d.whiskerHigh]),
    ...outliers.map((d) => d.value),
  ];
  const yPad = (d3.max(allVals) - d3.min(allVals)) * 0.08;
  const y = d3.scaleLinear()
    .domain([d3.min(allVals) - yPad, d3.max(allVals) + yPad])
    .nice()
    .range([innerH, 0]);

  svg.append("text")
    .attr("x", margin.left).attr("y", 20)
    .style("font-family", "var(--font-display)").style("font-size", "1rem")
    .text(title);

  g.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x0));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
  g.append("text").attr("class", "axis")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2).attr("y", -40)
    .attr("text-anchor", "middle").style("font-size", "0.75rem")
    .text(yLabel);

  const boxWidth = x1.bandwidth();
  const tooltip = createTooltip(container);

  boxStats.forEach((d) => {
    if (!phaseOrder.includes(d.phase)) return; // unknown phase - skip, don't crash
    const cx = x0(d.phase) + x1(d.participant) + boxWidth / 2;
    const color = PARTICIPANT_COLORS[d.participant] || "#999";
    // One <g> per (participant, phase) - so the legend only needs to
    // hide/show ONE node, not five separate elements (whisker, 2 caps,
    // box, median), and hover only needs one pair of listeners.
    const boxG = g.append("g").attr("data-participant", d.participant);

    // whisker: vertical line from low to high
    boxG.append("line")
      .attr("x1", cx).attr("x2", cx)
      .attr("y1", y(d.whiskerLow)).attr("y2", y(d.whiskerHigh))
      .attr("stroke", color).attr("stroke-width", 1);

    // caps at the ends of the whisker
    [d.whiskerLow, d.whiskerHigh].forEach((v) => {
      boxG.append("line")
        .attr("x1", cx - boxWidth * 0.2).attr("x2", cx + boxWidth * 0.2)
        .attr("y1", y(v)).attr("y2", y(v))
        .attr("stroke", color).attr("stroke-width", 1);
    });

    // the box itself: q1..q3
    boxG.append("rect")
      .attr("x", cx - boxWidth / 2).attr("width", boxWidth)
      .attr("y", y(d.q3)).attr("height", Math.max(1, y(d.q1) - y(d.q3)))
      .attr("fill", color).attr("fill-opacity", 0.35)
      .attr("stroke", color).attr("stroke-width", 1.25);

    // median
    boxG.append("line")
      .attr("x1", cx - boxWidth / 2).attr("x2", cx + boxWidth / 2)
      .attr("y1", y(d.median)).attr("y2", y(d.median))
      .attr("stroke", color).attr("stroke-width", 2);

    // Hover: full box stats, not just whatever's under the cursor.
    boxG.style("cursor", "default")
      .on("mousemove", (event) => {
        const [mx, my] = d3.pointer(event, container.node());
        tooltip.show(
          `<div style="opacity:0.75;margin-bottom:2px">${PARTICIPANT_LABELS[d.participant] || d.participant} — ${d.phase}</div>` +
          `median: ${d.median.toFixed(1)}${unit}<br>` +
          `Q1–Q3: ${d.q1.toFixed(1)}–${d.q3.toFixed(1)}${unit}<br>` +
          `whiskers: ${d.whiskerLow.toFixed(1)}–${d.whiskerHigh.toFixed(1)}${unit}<br>` +
          `n=${d.n}`,
          mx + 12, my - 12
        );
      })
      .on("mouseleave", () => tooltip.hide());
  });

  // Outliers - points drawn on top of the boxes, with a light horizontal
  // jitter so they don't collapse into a single vertical line when there
  // are many.
  const jitter = d3.randomUniform(-boxWidth * 0.15, boxWidth * 0.15);
  outliers.forEach((d) => {
    if (!phaseOrder.includes(d.phase)) return;
    const cx = x0(d.phase) + x1(d.participant) + boxWidth / 2 + jitter();
    g.append("circle")
      .attr("data-participant", d.participant)
      .attr("cx", cx).attr("cy", y(d.value)).attr("r", 2)
      .attr("fill", PARTICIPANT_COLORS[d.participant] || "#999")
      .attr("fill-opacity", 0.6)
      .on("mousemove", (event) => {
        const [mx, my] = d3.pointer(event, container.node());
        tooltip.show(
          `<div style="opacity:0.75;margin-bottom:2px">${PARTICIPANT_LABELS[d.participant] || d.participant} — ${d.phase}</div>` +
          `outlier: ${d.value.toFixed(1)}${unit}`,
          mx + 12, my - 12
        );
      })
      .on("mouseleave", () => tooltip.hide());
  });

  const legend = container.append("div").attr("class", "legend");
  participants.forEach((p) => {
    const item = legend.append("span").attr("class", "legend-item").attr("data-participant", p);
    item.append("span").attr("class", "legend-swatch").style("background", PARTICIPANT_COLORS[p] || "#999");
    item.append("span").text(PARTICIPANT_LABELS[p] || p);
  });
  // The selector catches both the boxes' <g data-participant> (the node
  // itself, not its descendants - display:none on the group hides
  // everything inside it) and the outliers' <circle data-participant>.
  makeParticipantFilterable({ chartElements: g, legend, participants });
}
