// src/utils/hoverTooltip.js
//
// Shared hover-tooltip machinery. A tooltip like this existed once in
// timeSeries.js and was removed - not because tooltips were unwanted, but
// because THAT ONE was broken (position:absolute with no position:relative
// on its parent, so it rendered off-screen) and, at the time, nobody had
// asked for hover on any chart, so removing it for consistency was simpler
// than fixing a feature no one needed yet. Now it's being asked for
// explicitly, on every line chart and the boxplots - built once, correctly,
// here, instead of six separate copies of the same bug.

import * as d3 from "d3";
import { PARTICIPANT_COLORS, PARTICIPANT_LABELS } from "./participantStyle.js";
import { isHidden } from "./participantFilter.js";
import { formatSeconds } from "./formatTime.js";

/**
 * Low-level positioned tooltip. Sets position:relative on `container`
 * itself, so callers never have to remember that CSS requirement again.
 */
export function createTooltip(container) {
  container.style("position", "relative");
  const el = container.append("div").attr("class", "hover-tooltip");
  return {
    show(html, left, top) {
      el.style("opacity", 1).style("left", `${left}px`).style("top", `${top}px`).html(html);
    },
    hide() {
      el.style("opacity", 0);
    },
  };
}

/**
 * Wires up hover for a line chart: a vertical crosshair + a tooltip
 * listing every currently-visible participant's nearest value. Skips
 * participants hidden via the shared participant filter (participantFilter.js)
 * so the tooltip matches what's actually drawn on screen.
 *
 * @param {object} params
 * @param {d3.Selection} params.container - chart's root container
 * @param {d3.Selection} params.svg
 * @param {d3.Selection} params.g
 * @param {d3.ScaleLinear} params.x
 * @param {number} params.innerW
 * @param {number} params.innerH
 * @param {number} params.marginLeft
 * @param {number} params.marginTop
 * @param {Map<string, Array<object>>} params.byParticipant - participant -> points, sorted by time
 * @param {(point: object) => number} params.getTime
 * @param {(point: object) => number} params.getValue
 * @param {(value: number, point?: object) => string} [params.formatValue] -
 *   receives the value from getValue and, as a second arg, the full
 *   nearest data point - most charts only need the first arg, but charts
 *   with extra fields to show (e.g. trendWithSdStatic's ±SD) can use the second.
 * @param {string} [params.unit] - short unit suffix appended after the value (e.g. "bpm")
 * @param {Record<string,string>} [params.colors] - defaults to PARTICIPANT_COLORS;
 *   pass a different map (e.g. PAIR_COLORS) for charts keyed by something
 *   other than a single participant.
 * @param {Record<string,string>} [params.labels] - same idea, defaults to PARTICIPANT_LABELS
 */
export function attachLineHover({
  container, svg, g, x, innerW, innerH, marginLeft, marginTop,
  byParticipant, getTime, getValue, formatValue = (v) => v.toFixed(1), unit = "",
  colors = PARTICIPANT_COLORS, labels = PARTICIPANT_LABELS,
}) {
  const tooltip = createTooltip(container);

  const hoverLine = g.append("line")
    .attr("y1", 0).attr("y2", innerH)
    .attr("stroke", "var(--color-ink-soft)")
    .attr("stroke-dasharray", "3,3")
    .style("opacity", 0)
    .style("pointer-events", "none");

  svg.append("rect")
    .attr("width", innerW).attr("height", innerH)
    .attr("transform", `translate(${marginLeft},${marginTop})`)
    .attr("fill", "transparent")
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event, g.node());
      const t = x.invert(mx);
      hoverLine.attr("x1", x(t)).attr("x2", x(t)).style("opacity", 1);

      const rows = [];
      byParticipant.forEach((points, p) => {
        if (isHidden(p) || points.length === 0) return;
        const nearest = d3.least(points, (d) => Math.abs(getTime(d) - t));
        const color = colors[p] || "#999";
        rows.push(
          `<span style="color:${color}">●</span> ${labels[p] || p}: ${formatValue(getValue(nearest), nearest)}${unit}`
        );
      });
      if (rows.length === 0) return; // every participant currently hidden

      tooltip.show(
        `<div style="opacity:0.75;margin-bottom:2px">${formatSeconds(t)}</div>${rows.join("<br>")}`,
        mx + marginLeft + 12,
        marginTop
      );
    })
    .on("mouseleave", () => {
      hoverLine.style("opacity", 0);
      tooltip.hide();
    });
}
