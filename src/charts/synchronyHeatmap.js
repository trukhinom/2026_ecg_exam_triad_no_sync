// src/charts/synchronyHeatmap.js
//
// Pairwise synchrony heatmap. Expects {participants, matrix} - see
// loadData.js -> loadSynchronyMatrix(). Fits WCC/WCLC/CRQA/DTW summary
// coefficients (one number per participant pair per phase), NOT a full
// recurrence plot - see recurrencePlot.js (canvas) for that.

import * as d3 from "d3";
import { PARTICIPANT_LABELS } from "../utils/participantStyle.js";

/**
 * @param {string} containerId
 * @param {{participants: string[], matrix: number[][]}} data
 * @param {object} [options]
 * @param {[number, number]} [options.domain] - color scale value range, default [-1, 1]
 * @param {boolean} [options.hideRedundantHalf=false] - show only the lower
 *   triangle (i >= j). The matrix is symmetric (synchrony(A,B) = synchrony(B,A)),
 *   so the full matrix duplicates every number twice - this already raised
 *   the question "what do the duplicated numbers show" for the placeholder
 *   version of the chart; for DTW (also symmetric by construction) this is
 *   turned on by default at the call site.
 * @param {number} [options.width] - fixed width in px. Set this explicitly
 *   when rendering two of these side by side (Baseline/Exam) - same
 *   reasoning as the `width` option in network.js.
 */
export function renderSynchronyHeatmap(containerId, data, options = {}) {
  const { participants, matrix } = data;
  const { domain = [-1, 1], hideRedundantHalf = false, width: fixedWidth } = options;

  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  const size = fixedWidth || Math.min(container.node().clientWidth || 400, 420);
  const margin = { top: 60, right: 16, bottom: 16, left: 110 };
  const cell = (size - margin.left - margin.right) / participants.length;
  const width = margin.left + cell * participants.length + margin.right;
  const height = margin.top + cell * participants.length + margin.bottom;

  const svg = container.append("svg").attr("width", width).attr("height", height);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const color = d3.scaleSequential(d3.interpolateRdYlBu).domain([domain[1], domain[0]]);
  // domain is reversed so high synchrony (e.g. near 1) reads as the "warm"
  // end of the scale - swap the order if you need the opposite.

  const cells = [];
  participants.forEach((rowP, i) => {
    participants.forEach((colP, j) => {
      if (hideRedundantHalf && j > i) return; // upper triangle - duplicate of the lower one
      cells.push({ row: rowP, col: colP, i, j, value: matrix[i][j] });
    });
  });

  g.selectAll("rect")
    .data(cells)
    .join("rect")
    .attr("x", (d) => d.j * cell)
    .attr("y", (d) => d.i * cell)
    .attr("width", cell)
    .attr("height", cell)
    .attr("fill", (d) => color(d.value))
    .attr("stroke", "var(--color-surface)")
    .append("title")
    .text((d) => `${PARTICIPANT_LABELS[d.row] || d.row} × ${PARTICIPANT_LABELS[d.col] || d.col}: ${d.value.toFixed(3)}`);

  g.selectAll("text.cell-label")
    .data(cells.filter((d) => d.i !== d.j)) // diagonal (self) is not labeled
    .join("text")
    .attr("class", "cell-label")
    .attr("x", (d) => d.j * cell + cell / 2)
    .attr("y", (d) => d.i * cell + cell / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .style("font-size", "0.75rem")
    .style("fill", (d) => (Math.abs(d.value) > (domain[1] - domain[0]) * 0.35 ? "#fff" : "#1b2430"))
    .text((d) => d.value.toFixed(2));

  // Row/column labels - anonymized (Participant 1/2/3)
  g.selectAll("text.row-label")
    .data(participants)
    .join("text")
    .attr("class", "row-label")
    .attr("x", -8)
    .attr("y", (d, i) => i * cell + cell / 2)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "central")
    .style("font-size", "0.8rem")
    .text((d) => PARTICIPANT_LABELS[d] || d);

  g.selectAll("text.col-label")
    .data(hideRedundantHalf ? participants.slice(0, -1) : participants) // with the triangle, the last column is empty
    .join("text")
    .attr("class", "col-label")
    .attr("x", (d, i) => i * cell + cell / 2)
    .attr("y", -8)
    .attr("text-anchor", "middle")
    .style("font-size", "0.8rem")
    .text((d) => PARTICIPANT_LABELS[d] || d);
}
