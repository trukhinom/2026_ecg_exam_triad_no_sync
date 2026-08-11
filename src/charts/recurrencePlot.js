// src/charts/recurrencePlot.js
//
// Cross-recurrence plot (CRQA), one example pair/phase. N×N matrix -
// rendered via <canvas>/putImageData, not an SVG rect per cell (at N in
// the hundreds that would be N² DOM nodes). The matrix is already
// downsampled and normalized in Python (see data/README.md §4) - this
// file only draws it.
//
// Input data format: { "n": 250, "values": [0.8, 0.1, ...] } (row-major,
// length n*n); values are a continuous 0..1 "state closeness" (1 = the
// closest state pair in this matrix, dark pixel), not strictly binary
// recurrence - block-averaging for downsampling naturally turns binary
// 0/1 into the fraction of recurrent points per block.

export function renderRecurrencePlot(containerId, data, options = {}) {
  const { title = "Cross-recurrence plot", caption = "" } = options;
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const wrap = document.createElement("div");

  const titleEl = document.createElement("p");
  titleEl.style.fontFamily = "var(--font-display)";
  titleEl.style.fontSize = "1rem";
  titleEl.style.margin = "0 0 0.5rem";
  titleEl.textContent = title;
  wrap.appendChild(titleEl);

  const { n, values } = data;
  const displaySize = Math.min(container.clientWidth || 500, 500);

  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  canvas.style.width = `${displaySize}px`;
  canvas.style.height = `${displaySize}px`;
  canvas.style.imageRendering = "pixelated"; // keeps blocks crisp when scaled up
  canvas.style.border = "1px solid var(--color-border)";
  wrap.appendChild(canvas);

  if (caption) {
    const captionEl = document.createElement("p");
    captionEl.style.fontSize = "0.75rem";
    captionEl.style.color = "var(--color-ink-soft)";
    captionEl.style.marginTop = "0.5rem";
    captionEl.textContent = caption;
    wrap.appendChild(captionEl);
  }

  container.appendChild(wrap);

  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(n, n);
  for (let i = 0; i < values.length; i++) {
    const v = Math.max(0, Math.min(1, values[i])); // clamp, just in case, to 0..1
    const shade = Math.round(255 * (1 - v)); // v=1 (close states) -> dark pixel
    imageData.data[i * 4 + 0] = shade;
    imageData.data[i * 4 + 1] = shade;
    imageData.data[i * 4 + 2] = shade;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}
