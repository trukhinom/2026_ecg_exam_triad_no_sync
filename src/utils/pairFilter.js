// src/utils/pairFilter.js
//
// Page-wide, shared PAIR visibility filter — same idea and structure as
// participantFilter.js, but for charts keyed by a participant PAIR
// (p1p2/p2p3/p3p1: WCC, WCLC lag), not a single participant. Started out
// as a per-chart LOCAL toggle in pairTimeSeriesStatic.js, back when WCC
// was the only pair-keyed chart on the page and there was nothing else to
// sync with — now that WCLC lag exists too, hiding a pair on one should
// hide it on the other, the same reasoning that already justified
// participantFilter.js for participant-keyed charts.

import * as d3 from "d3";

const hidden = new Set();
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function isPairHidden(pair) {
  return hidden.has(pair);
}

export function togglePair(pair) {
  if (hidden.has(pair)) hidden.delete(pair);
  else hidden.add(pair);
  notify();
}

/**
 * Wires up one chart: makes its legend items AND any of its own elements
 * tagged with a matching data-pair attribute clickable, and keeps them in
 * sync with the shared, page-wide pair-filter state.
 *
 * @param {object} params
 * @param {d3.Selection} params.chartElements - selection to search inside
 *   for clickable [data-pair] elements (usually the chart's <g>)
 * @param {d3.Selection} params.legend - the chart's own .legend container
 * @param {string[]} params.pairs - pair ids in this chart (p1p2/p2p3/p3p1)
 */
export function makePairFilterable({ chartElements, legend, pairs }) {
  function applyVisibility() {
    pairs.forEach((pair) => {
      const hide = isPairHidden(pair);
      chartElements.selectAll(`[data-pair="${pair}"]`).style("display", hide ? "none" : null);
      legend.select(`.legend-item[data-pair="${pair}"]`).classed("legend-item--muted", hide);
    });
  }

  legend.selectAll(".legend-item")
    .classed("legend-item--clickable", true)
    .on("click", function () {
      togglePair(d3.select(this).attr("data-pair"));
    });

  chartElements.selectAll("[data-pair]")
    .classed("chart-el--clickable", true)
    .on("click", function () {
      togglePair(d3.select(this).attr("data-pair"));
    });

  listeners.add(applyVisibility);
  applyVisibility(); // apply whatever the shared state already is, right away
}
