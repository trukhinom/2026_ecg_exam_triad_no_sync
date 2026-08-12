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

Place in `public/data/` (NOT a plain `data/` folder at the project root —
Vite only copies `public/` into the production build; a `data/` folder
next to `index.html` works in `npm run dev` but silently disappears from
`npm run build`'s output):

| File | Format | Section on the page |
|---|---|---|
| `ecg_raw.csv` | wide | 2.1 ECG |
| `instantaneous_hr.csv` | long | 2.2 HR, 2.5 RR intervals (recomputed on the fly) |
| `hr_trend_sd.csv` | long | 2.3 HR trend |
| `hr_box_stats.csv` + `hr_box_outliers.csv` | long | 2.4 HR distribution |
| `rmssd.csv` | long, with `ci_low`/`ci_high` | 2.6 RMSSD |
| `rmssd_box_stats.csv` + `rmssd_box_outliers.csv` | long | 2.7 RMSSD distribution |
| `wcc.csv` | long, keyed by pair | 3.1 WCC |
| `dtw_matrix_baseline.csv` + `dtw_matrix_exam.csv` | wide | 3.2 DTW matrix |
| `dtw_alignment_p1p2_series.csv` + `_path.csv` | long | 3.3 DTW alignment example (Participant 1 × 2) |
| `dtw_alignment_p2p3_series.csv` + `_path.csv` | long | 3.4 DTW alignment example (Participant 2 × 3) |
| `dtw_alignment_p3p1_series.csv` + `_path.csv` | long | 3.5 DTW alignment example (Participant 3 × 1) |
| `network_baseline.json` + `network_exam.json` | JSON | 3.6 Synchrony network |
| `markers.csv` | long, optional | vertical markers on 2.1/2.2/2.3/2.5/2.6/3.1 |

**Every `time_s` in every CSV is seconds from `common_start`** (the start
of the whole recording) — one shared reference point across all files.
Full spec — `public/data/README.md`. The Python export for all of this
was discussed in chat.

Dropped from the page (and no longer exported): the draft "Pairwise
synchrony matrix" placeholder and the Recurrence plot — see chat for why.
If you still have `example_synchrony_matrix.csv`/`recurrence_example.json`
lying around, they're unused and safe to delete.

## 3. Project structure

```
ecg-triad-synchrony/
├── index.html
├── style.css
├── index.js                — entry point, orchestration only
├── vite.config.js           — base path for GitHub Pages deployment
├── .github/workflows/       — deploy.yml, auto-builds + deploys on push to main
├── public/data/
│   ├── README.md            — format spec, one section per file
│   └── *.csv, *.json        — your data (see the table above)
└── src/
    ├── utils/
    │   ├── loadData.js          — CSV/JSON loading and parsing
    │   ├── participantStyle.js  — SINGLE source of participant colors/labels
    │   ├── pairStyle.js         — same idea, for participant PAIRS (used by WCC)
    │   ├── participantFilter.js — page-wide click-to-filter (legend + chart elements, synced across every chart)
    │   ├── phaseShading.js      — Baseline/Exam background shading, derived from the exam_start marker
    │   ├── formatTime.js        — shared time-axis tick formatter ("Ns")
    │   └── hoverTooltip.js      — shared hover tooltip (line charts + boxplots + WCC)
    └── charts/
        ├── ecgOverlayStatic.js      — 2.1 ECG
        ├── hrOverlayStatic.js       — 2.2 HR + 2.5 RR intervals (renderHrOverlayStatic / renderRrIntervalOverlay)
        ├── trendWithSdStatic.js     — 2.3 HR trend
        ├── boxplotStatic.js         — 2.4 / 2.7 box plots (shared renderer)
        ├── timeSeries.js            — 2.6 RMSSD
        ├── wccStatic.js              — 3.1 WCC
        ├── synchronyHeatmap.js      — 3.2 DTW matrix (shared renderer, keyed by data file)
        ├── dtwAlignmentExample.js   — 3.3 / 3.4 / 3.5 DTW alignment examples (same renderer, 3 pairs)
        └── network.js               — 3.6 Synchrony network
```

Same principle as before: `index.js` is orchestration only, all chart
logic lives in its own file under `src/charts/`. Participant colors/labels
come from `src/utils/participantStyle.js` — don't add your own copy in a
new chart. Pair colors/labels (WCC only, so far) come from
`src/utils/pairStyle.js` instead — a different entity (a pair, not a
single participant), deliberately a different palette.

## 4. What's already implemented

Every module in the table above is implemented and static in the zoom/pan
sense (no zoom/pan, a decision made while working on the ECG/HR charts,
see the chat history) — but hover tooltips ARE implemented everywhere,
and click-to-filter is implemented everywhere too. Every
PARTICIPANT-keyed chart shares ONE state across the whole page (see
`participantFilter.js`) — hiding a participant on any chart hides them on
every other chart. WCC (3.1) is keyed by pair, not by participant, so it
has its own LOCAL click-to-filter instead (own hidden-set, scoped to that
one chart only, not synced anywhere else).

## 5. Next steps

Describe any further charts you need.
