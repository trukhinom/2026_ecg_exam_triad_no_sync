// src/utils/participantFilter.js
//
// Page-wide, shared participant visibility filter. Replaces the earlier
// legendFilter.js, which kept a separate hidden-set PER chart — clicking
// a legend item only affected that one chart. Here there is exactly ONE
// hidden-set for the whole page: every chart subscribes to it and
// re-applies its own visibility whenever ANY chart toggles a participant
// (including a different chart), so hiding participant_1 on the ECG chart
// also hides them on HR, RMSSD, the boxplots, etc.
//
// Also wires up click-to-toggle on the chart's OWN drawn elements (lines,
// boxes, network nodes), not just the legend — clicking the visible line
// itself hides it, same as clicking its legend swatch.

import * as d3 from "d3";

const hidden = new Set();
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function isHidden(participant) {
  return hidden.has(participant);
}

export function toggleParticipant(participant) {
  if (hidden.has(participant)) hidden.delete(participant);
  else hidden.add(participant);
  notify();
}

/**
 * Low-level subscription for charts that can't use makeParticipantFilterable()
 * as-is (e.g. network.js, which dims nodes/edges instead of hiding them and
 * has no .legend div at all). Registers fn to run now and again on every
 * future toggle, anywhere on the page.
 */
export function onFilterChange(fn) {
  listeners.add(fn);
  fn();
}

/**
 * Wires up one chart: makes its legend items AND any of its own elements
 * tagged with a matching data-participant attribute clickable, and keeps
 * them in sync with the shared, page-wide filter state.
 *
 * @param {object} params
 * @param {d3.Selection} params.chartElements - selection to search inside
 *   for clickable [data-participant] elements (usually the chart's <g>)
 * @param {d3.Selection} params.legend - the chart's own .legend container
 * @param {string[]} params.participants - participant ids in this chart
 * @param {(participant: string, hide: boolean) => void} [params.onApply] -
 *   optional extra hook, called per participant whenever visibility is
 *   (re)applied — used by charts that need something other than plain
 *   display:none (e.g. network.js dims instead of hiding).
 */
export function makeParticipantFilterable({ chartElements, legend, participants, onApply }) {
  function applyVisibility() {
    participants.forEach((p) => {
      const hide = isHidden(p);
      if (onApply) {
        onApply(p, hide);
      } else {
        chartElements.selectAll(`[data-participant="${p}"]`).style("display", hide ? "none" : null);
      }
      legend.select(`.legend-item[data-participant="${p}"]`).classed("legend-item--muted", hide);
    });
  }

  legend.selectAll(".legend-item")
    .classed("legend-item--clickable", true)
    .on("click", function () {
      toggleParticipant(d3.select(this).attr("data-participant"));
    });

  chartElements.selectAll("[data-participant]")
    .classed("chart-el--clickable", true)
    .on("click", function () {
      toggleParticipant(d3.select(this).attr("data-participant"));
    });

  listeners.add(applyVisibility);
  applyVisibility(); // apply whatever the shared state already is, right away
}
