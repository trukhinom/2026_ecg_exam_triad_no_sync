// src/utils/containerWidth.js
//
// Returns a container's actual CONTENT width - clientWidth alone includes
// the container's own left/right padding, so sizing a child (e.g. an SVG)
// directly to clientWidth overflows the container by one padding-width.
// Small and easy to miss on desktop (~32px against an ~830px column), but
// became clearly visible on mobile once the fixed 360px paired-chart width
// (a separate, larger bug - see network.js/synchronyHeatmap.js) was removed
// and charts went back to sizing themselves purely from the container.

/**
 * @param {d3.Selection} container
 * @param {number} [fallback] - used if the container isn't in the DOM yet
 *   (clientWidth reads 0) or has no measurable width
 */
export function getContentWidth(container, fallback = 800) {
  const node = container.node();
  if (!node) return fallback;
  const style = getComputedStyle(node);
  const paddingH = parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0");
  const width = node.clientWidth - paddingH;
  return width > 0 ? width : fallback;
}
