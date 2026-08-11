# How to use this template

## 1. Setup

```bash
cd ecg-triad-synchrony
npm install
npm run dev
```

`npm run dev` starts the Vite dev server (usually at `http://localhost:5173`)
with hot reload — edits to `.js`/`.css` show up in the browser immediately.

For a final build (static files for upload/hosting):

```bash
npm run build
```

## 2. Your data

Place in `data/`:

| File | Format | Section on the page |
|---|---|---|
| `ecg_raw.csv` | wide | 2.1 ECG |
| `instantaneous_hr.csv` | long | 2.2 HR, 2.5 RR intervals (recomputed on the fly) |
| `hr_trend_sd.csv` | long | 2.3 HR trend |
| `hr_box_stats.csv` + `hr_box_outliers.csv` | long | 2.4 HR distribution |
| `rmssd.csv` | long | 2.6 RMSSD |
| `rmssd_box_stats.csv` + `rmssd_box_outliers.csv` | long | 2.7 RMSSD distribution |
| `dtw_matrix_baseline.csv` + `dtw_matrix_exam.csv` | wide | 3.1 DTW matrix |
| `dtw_alignment_p1p2_series.csv` + `_path.csv` | long | 3.2 DTW alignment example (Participant 1 × 2) |
| `dtw_alignment_p2p3_series.csv` + `_path.csv` | long | 3.3 DTW alignment example (Participant 2 × 3) |
| `dtw_alignment_p3p1_series.csv` + `_path.csv` | long | 3.4 DTW alignment example (Participant 3 × 1) |
| `example_synchrony_matrix.csv` | wide | 3.5 Matrix (placeholder, don't change until you've decided on the visualization) |
| `network_baseline.json` + `network_exam.json` | JSON | 3.6 Synchrony network |
| `recurrence_example.json` | JSON | 3.7 Recurrence plot |
| `markers.csv` | long, optional | vertical markers on 2.1/2.2/2.3/2.5/2.6 |

**Every `time_s` in every CSV is seconds from `common_start`** (the start
of the whole recording) — one shared reference point across all files.
Full spec — `data/README.md`. The Python export for all of this was
discussed in chat.

## 3. Project structure

```
ecg-triad-synchrony/
├── index.html
├── style.css
├── index.js               — entry point, orchestration only
├── data/
│   ├── README.md           — format spec, one section per file
│   └── *.csv, *.json       — your data (see the table above)
└── src/
    ├── utils/
    │   ├── loadData.js          — CSV/JSON loading and parsing
    │   ├── participantStyle.js  — SINGLE source of participant colors/labels
    │   ├── participantFilter.js — page-wide click-to-filter (legend + chart elements, synced across every chart)
    │   ├── phaseShading.js      — Baseline/Exam background shading, derived from the exam_start marker
    │   ├── formatTime.js        — shared time-axis tick formatter ("Ns")
    │   └── hoverTooltip.js      — shared hover tooltip (line charts + boxplots)
    └── charts/
        ├── ecgOverlayStatic.js      — 2.1 ECG
        ├── hrOverlayStatic.js       — 2.2 HR + 2.5 RR intervals (renderHrOverlayStatic / renderRrIntervalOverlay)
        ├── trendWithSdStatic.js     — 2.3 HR trend
        ├── boxplotStatic.js         — 2.4 / 2.7 box plots (shared renderer)
        ├── timeSeries.js            — 2.6 RMSSD
        ├── synchronyHeatmap.js      — 3.1 DTW matrix / 3.5 Matrix (shared renderer)
        ├── dtwAlignmentExample.js   — 3.2 / 3.3 / 3.4 DTW alignment examples (same renderer, 3 pairs)
        ├── network.js               — 3.6 Synchrony network
        └── recurrencePlot.js        — 3.7 Recurrence plot
```

Same principle as before: `index.js` is orchestration only, all chart
logic lives in its own file under `src/charts/`. Participant colors/labels
come from `src/utils/participantStyle.js` — don't add your own copy in a
new chart.

## 4. What's already implemented

Every module in the table above is implemented and static in the zoom/pan
sense (no zoom/pan, a decision made while working on the ECG/HR charts,
see the chat history) - but hover tooltips and click-to-filter (across
every chart at once, see participantFilter.js) ARE implemented. The only
thing left as a placeholder on purpose is section "3.5 Pairwise synchrony
matrix": it's currently a placeholder, waiting on your decision about the
visualization (discussed in chat — the numbers duplicate in a symmetric
matrix, you're considering an alternative).

## 5. Next steps

Describe any further charts you need, or send real data for "3.5 Matrix"
(WCC mean|r| — export code is already in the chat) together with your
visualization decision once you've made it.
