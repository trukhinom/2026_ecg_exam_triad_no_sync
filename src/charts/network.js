// src/charts/network.js
//
// Force-directed synchrony graph: nodes are participants, edge
// thickness/opacity is synchrony strength for that pair. Three nodes -
// the layout almost always settles into a triangle (too few forces to
// get a meaningfully different geometry); the graph is still useful as a
// compact "who's more connected to whom" summary next to the matrix
// (§3.1) - line thickness reads faster than comparing cell numbers.

import * as d3 from "d3";
import { PARTICIPANT_COLORS, PARTICIPANT_LABELS } from "../utils/participantStyle.js";
import { toggleParticipant, onFilterChange, isHidden } from "../utils/participantFilter.js";

/**
 * @param {string} containerId
 * @param {{nodes: Array<{id: string, role?: string}>, links: Array<{source: string, target: string, weight: number}>}} graph
 * @param {object} [options]
 * @param {string} [options.title]
 */
export function renderNetwork(containerId, graph, options = {}) {
  const { title = "Synchrony network" } = options;
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  // Fixed design-time width, not measured from the DOM - the SVG scales to
  // its actual container size via viewBox + width:100% below (handles both
  // the desktop 2-column grid and the mobile 1-column stack, see style.css
  // .chart-row), instead of a JS clientWidth read that has proven fragile
  // across screen sizes twice now (see chat).
  const width = 500;
  const height = 360;

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height + 20}`)
    .attr("width", "100%")
    .attr("height", "auto")
    .style("display", "block");
  svg.append("text")
    .attr("x", 12).attr("y", 18)
    .style("font-family", "var(--font-display)").style("font-size", "1rem")
    .text(title);
  const g = svg.append("g").attr("transform", "translate(0,20)");

  // Copies of nodes/links - forceSimulation mutates the objects (adds
  // x/y/vx/vy and replaces link.source/target with references to the
  // node objects), so we don't pass the original graph directly, in case
  // the caller re-renders it (e.g. on re-render).
  const nodes = graph.nodes.map((d) => ({ ...d }));
  const links = graph.links.map((d) => ({ ...d }));

  const weightExtent = d3.extent(links, (d) => d.weight);
  const widthScale = d3.scaleLinear().domain(weightExtent).range([1.5, 8]).clamp(true);
  const opacityScale = d3.scaleLinear().domain(weightExtent).range([0.25, 0.85]).clamp(true);

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id)
      .distance((d) => 160 - 90 * widthScale(d.weight) / 8)) // stronger synchrony -> shorter edge
    .force("charge", d3.forceManyBody().strength(-260))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide(34))
    .stop();

  // Static chart - no animation: settle the layout immediately (300
  // ticks is plenty for three nodes) and draw once.
  for (let i = 0; i < 300; i++) simulation.tick();

  const link = g.append("g").selectAll("line")
    .data(links).join("line")
    .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y)
    .attr("stroke", "var(--color-ink-soft)")
    .attr("stroke-width", (d) => widthScale(d.weight))
    .attr("opacity", (d) => opacityScale(d.weight));

  const linkLabel = g.append("g").selectAll("text.link-label")
    .data(links).join("text")
    .attr("class", "link-label")
    .attr("x", (d) => (d.source.x + d.target.x) / 2)
    .attr("y", (d) => (d.source.y + d.target.y) / 2 - 4)
    .attr("text-anchor", "middle")
    .style("font-size", "0.7rem")
    .style("fill", "var(--color-ink-soft)")
    .text((d) => d.weight.toFixed(2));

  const node = g.append("g").selectAll("circle")
    .data(nodes).join("circle")
    .attr("cx", (d) => d.x).attr("cy", (d) => d.y)
    .attr("r", 22)
    .attr("fill", (d) => PARTICIPANT_COLORS[d.id] || "#999")
    .attr("stroke", "var(--color-surface)")
    .attr("stroke-width", 2);

  const nodeLabel = g.append("g").selectAll("text.node-label")
    .data(nodes).join("text")
    .attr("class", "node-label")
    .attr("x", (d) => d.x).attr("y", (d) => d.y + 38)
    .attr("text-anchor", "middle")
    .style("font-size", "0.75rem")
    .text((d) => PARTICIPANT_LABELS[d.id] || d.id);

  // Clicking a node dims it and its incident edges (not display:none like
  // the other charts: removing the node entirely would leave edges
  // "hanging in the air", which would visually break the graph worse than
  // just asking to focus on the rest). Shares the SAME page-wide filter
  // state as every other chart (participantFilter.js) - hiding a
  // participant elsewhere dims them here too, and vice versa.
  function applyHiddenState() {
    node.style("opacity", (d) => (isHidden(d.id) ? 0.15 : 1));
    nodeLabel.style("opacity", (d) => (isHidden(d.id) ? 0.3 : 1));
    link.style("opacity", (d) => (isHidden(d.source.id) || isHidden(d.target.id) ? 0.05 : opacityScale(d.weight)));
    linkLabel.style("opacity", (d) => (isHidden(d.source.id) || isHidden(d.target.id) ? 0 : 1));
  }
  node.style("cursor", "pointer").on("click", (event, d) => toggleParticipant(d.id));
  nodeLabel.style("cursor", "pointer").on("click", (event, d) => toggleParticipant(d.id));
  onFilterChange(applyHiddenState);
}
