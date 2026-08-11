# Data format

Each chart type expects its own format. Below is the spec and the
reasoning behind the format choice for each case.

## 1. Time series (`renderTimeSeries`) — long-format CSV

File: one row = one point for one participant at one point in time.

```
participant,phase,time_s,value
participant_1,Baseline,0,42.1
participant_1,Baseline,10,43.0
...
```

- `participant` — anonymized ID (`participant_1`/`participant_2`/`participant_3`)
- `phase` — `Baseline` / `Exam` (exactly like this, capitalized — as in your
  `ecg.py`: `df_triad["Phase"] = np.where(..., "Baseline", "Exam")`). Any
  other phase value won't break the chart — it just won't get a background
  shade (see `PHASE_COLORS[phase] || "none"` in `timeSeries.js`)
- `time_s` — time in seconds **from `common_start`** (the same reference
  point as every other file below — see §5)
- `value` — the metric's value (RMSSD, HR, etc.)

Long format was chosen over wide (one column per participant) because:
(1) it's robust to a different number of points per participant, (2) it
needs no schema change to add a metric — just a new CSV with a different
`value`.

**If you need several metrics** (e.g. both HR and RMSSD) — make a
separate CSV per metric and call `renderTimeSeries` twice with different
`containerId`/`yLabel`. Simpler than combining metrics with different
units on one chart.

## 2. Pairwise synchrony matrix (`renderSynchronyHeatmap`) — wide-format CSV

File: a square matrix, first column is the participant name (as the row
id), remaining columns are the same participants.

```
participant,participant_1,participant_2,participant_3
participant_1,0.0,0.42,0.61
participant_2,0.42,0.0,0.55
participant_3,0.61,0.55,0.0
```

Fits any summary synchrony coefficient for a participant pair — WCC,
WCLC, DTW distance, etc., one number per pair, one file per phase
(`dtw_matrix_baseline.csv`, `dtw_matrix_exam.csv` — see §3.1 on the page).
The diagonal is self-similarity: 0.0 is natural for DTW distance (a
series' distance to itself), 1.0 for correlation; the chart never labels
the diagonal with a number either way (see `d.i !== d.j` in the code),
it only colors it.

**The matrix is symmetric by construction**
(`synchrony(A,B) = synchrony(B,A)`, whether for WCC/correlation or DTW
distance) — so the full matrix duplicates every off-diagonal number
twice. The `hideRedundantHalf: true` option in `renderSynchronyHeatmap()`
draws only the lower triangle — use it unless this is a deliberate
low-fi placeholder (as it currently is in section "2. Pairwise synchrony
matrix" on the page — a placeholder, waiting to be replaced, see chat).

## 3. Synchrony network (`network.js`) — JSON

```json
{
  "nodes": [
    { "id": "participant_1", "role": "student" },
    { "id": "participant_2", "role": "student" },
    { "id": "participant_3", "role": "teacher" }
  ],
  "links": [
    { "source": "participant_1", "target": "participant_2", "weight": 0.71 },
    { "source": "participant_1", "target": "participant_3", "weight": 0.48 },
    { "source": "participant_2", "target": "participant_3", "weight": 0.45 }
  ]
}
```

JSON, not CSV, because the graph's structure (nodes + variable-length
edges) doesn't fit a tabular format without duplication.

- `weight` — link strength, **the higher, the stronger the synchrony**
  (the graph draws a thicker, more opaque edge and pulls the nodes
  closer together — the reverse of DTW distance, where SMALLER means
  more similar). In the export script this is `1 / (1 + dtw_distance)` —
  the same DTW as in §2, just inverted from "distance" into "strength".
  If you want WCC/WCLC z-score as the weight instead of DTW — there,
  "higher = stronger" already holds, no inversion needed, just swap in a
  different column at export time
- `role` — optional, only used for a short in-node label (the role's
  first letter) — can be omitted

Two files (`network_baseline.json`, `network_exam.json`) — one per
phase, same as §2.

## 4. Recurrence plot (`recurrencePlot.js`) — JSON, WATCH THE SIZE

```json
{ "n": 250, "values": [0.12, 0.94, 0.30, ...] }
```

`values` is an N×N matrix flattened row-major into a flat array of
length `n*n`. Values are a continuous 0..1 "state closeness" (1 = the
closest state pair in this specific matrix → dark pixel), not strictly
binary recurrence (0/1 "within radius or not") — block-averaging for
downsampling (see below) naturally turns binary 0/1 into a continuous
"fraction of recurrent points per block", which is what gets drawn.

**Important constraint**: the native cross-recurrence matrix (e.g.
between two downsampled HR series via the CRQA method in your `ecg.py`)
can reach ~m×m, where m is a few hundred states per phase. As a JSON
file this isn't just hard to transfer over the network, it's flatly
wrong to render in the browser as row-by-row SVG rectangles (see the
comment in `recurrencePlot.js` — the code there uses `<canvas>`, not SVG).

The matrix is **downsampled on the Python side** (block averaging, not
taking every k-th point — that would lose the structure between samples)
down to 250×250 in the export script — JS receives the already-shrunk
matrix, not the raw one. One representative example is shown (one
participant pair, one phase), not all pairs at once — a full sweep of
pairs×phases would give too many charts for one report page; if you need
all of them, more can be added later the same way (another
`renderRecurrencePlot` call per JSON file pair).

## 5. ECG overlay (`ecgOverlayStatic.js`) — wide CSV

**`ecg_raw.csv`** — wide format, one shared time axis for all
participants (unlike the long format in section 1 — here three signals
sit on one time grid, wide is more compact and doesn't triplicate
`time_s`):

```
time_s,participant_1,participant_2,participant_3
1680.000,-12.30,4.10,8.90
1680.008,15.40,-3.20,12.10
...
```

- `time_s` — seconds **from `common_start`** — the start of the WHOLE
  recording, not the start of this 5-minute excerpt. This applies to
  every file on this page (§1, §5, §6, §7) — a single shared reference
  point is needed so the `exam_start` marker (§7) means the same moment
  on every chart, not just the one it was originally computed for
- `participant_1`/`participant_2`/`participant_3` — anonymized IDs (no
  real names — see ANON_ID in the export script), cleaned ECG signal in
  µV, **on a shared time grid**: all three signals must be resampled
  onto the same grid (the three Polar H10 devices run on different
  clocks, so raw timestamps don't line up sample-for-sample even within
  the shared recording window) — without this, one `time_s` column for
  all three won't work
- No aggregation/averaging at all — every sample as-is, at the native
  sampling rate; aggregation would destroy the shape of the QRS complex
- An empty cell = `NaN` (a real recording gap, or the edge where windows
  don't line up after resampling) — the loader (`loadWideTimeSeries`)
  and the chart (`.defined()` in `ecgOverlayStatic.js`) correctly break
  the line at such gaps instead of drawing a straight line through them
- R-waves aren't needed for this chart (not shown)

**On size**: 5 minutes at 130 Hz per participant is ~39,000 rows (~1 MB).
Grows linearly with the window's duration.

## 6. Instantaneous HR (`hrOverlayStatic.js`) — long CSV, one point per beat

**`instantaneous_hr.csv`**:

```
participant,time_s,hr_bpm
participant_1,1801.220,73.50
participant_1,1802.010,71.20
...
```

- `participant` — the same anonymized IDs as in `ecg_raw.csv`
- `time_s` — seconds from `common_start`, same as everywhere (see §5) —
  the time of the R-wave CLOSING the interval:
  `hr_bpm = 60 / (time_s[i] - time_s[i-1])`, so there's no HR value for
  each participant's first R-wave
- `hr_bpm` — instantaneous heart rate, bpm, unsmoothed (one point per beat)

An order of magnitude or two fewer points than the raw signal (one per
beat, not per sample).

## 7. Event markers (`loadMarkers`) — long CSV, OPTIONAL

**`markers.csv`** — vertical markers on all three data charts (ECG, HR,
time series), e.g. the exam start:

```
label,time_s
exam_start,1800.0
```

- `label` — the label shown by the line (short, in English — like every
  other chart label)
- `time_s` — seconds from `common_start`, the same axis as every file
  above (§1, §5, §6) — NOT from the start of the 5-minute excerpt

The file is optional: if it's missing from `data/`, `index.js` catches
the load error and draws the charts without markers — you can add it
later without touching the code.

`ecgOverlayStatic.js`/`hrOverlayStatic.js` themselves drop any marker
that falls outside their visible window (see §8) — you don't need to
prepare a marker separately per chart, one file covers all three.

## 8. Why the ECG chart shows 15 seconds, not the full 5 minutes

At 130 Hz, the whole `ecg_raw.csv` (5 minutes) is ~39,000 points per
line. At a typical chart width (~1000-1600px) that's 24-39 samples per
pixel, and a single QRS complex is ~15-20 samples (100-150 ms) — that
is, **less than one pixel**. Showing the full 5-minute range and a
distinguishable complex shape on one static (no zoom) chart at the same
time is physically impossible — it's a screen-resolution limit, not a
shortcoming of the code or the task description.

`renderEcgOverlayStatic()` therefore always draws a short excerpt, never
the whole recording. The excerpt's duration is **computed
automatically** from the chart's real width (`innerW / PX_PER_SECOND`, a
constant defined at the top of `ecgOverlayStatic.js`) — i.e. "how many
complexes fit in the drawing area" is literally what's being computed,
not a fixed constant: a wide screen fits more seconds, a narrow one
fewer. The `ecg_raw.csv` file is still loaded in full — only what falls
inside the visible window changes.

What you can configure in `index.js` (the `0.1 ECG` block):
- `centerOn` — which moment to center the window on (by default, the
  `exam_start` marker if it exists in `markers.csv`; otherwise the start
  of the recording)
- `windowDuration` — set explicitly, disables the width-based auto-sizing
- `windowStart` — set explicitly, disables both centering and auto-start

If PX_PER_SECOND (in `ecgOverlayStatic.js`) seems insufficient and
complexes still look cramped — increase the constant, the window will
get shorter at the same chart width.

If you need to present all 5 minutes as one static image without losing
complex visibility — the only option without interactivity is, like
paper ECG strips, to split the recording into several short rows stacked
on top of each other (e.g. 10 rows of 30s each). That's a different
chart — say so if you need it, we'll build it separately.

## 9. Sliding-window RMSSD (used via §1) — whole session, not an excerpt

`rmssd.csv` is the specific file currently loaded into section "2.6
RMSSD" via the §1 format. Unlike `ecg_raw.csv`/`instantaneous_hr.csv`,
there's NO need to limit the export to 5 minutes here — the RMSSD
sliding window (typically 60s/15s step) produces one to two orders of
magnitude fewer points than the raw signal, so the whole session (e.g.
ninety minutes) renders statically with no performance or legibility
problem — unlike the ECG chart (§8), there's no "like a real monitor"
constraint here.

## 10. Mean ± SD trend (`trendWithSdStatic.js`) — long CSV

**`hr_trend_sd.csv`**:

```
participant,time_s,mean_bpm,sd_bpm
participant_1,1740.0,84.2,6.1
participant_1,1770.0,85.0,5.8
...
```

- `time_s` — the sliding window's center, seconds from `common_start` (see §5)
- `mean_bpm`/`sd_bpm` — the mean and standard deviation of instantaneous
  HR inside the window

A separate computation from `rmssd.csv` (§9): there, the window/step are
tuned for RMSSD (needs a minimum of ~20-30 beats per window for a stable
estimate); here you can use a shorter window (e.g. 2 minutes, like your
reference) — HR doesn't need as many accumulated beats for a stable
estimate as RMSSD does, which is sensitive to the number of RR intervals
in the window.

## 11. Box-plot statistics (`boxplotStatic.js`) — long CSV, 2 files, reused for HR and RMSSD

**`*_box_stats.csv`** (`hr_box_stats.csv` / `rmssd_box_stats.csv`):

```
participant,phase,q1,median,q3,whisker_low,whisker_high,n
participant_1,Baseline,78.2,84.0,90.1,65.3,105.4,412
participant_1,Exam,82.0,89.5,97.3,68.0,112.0,689
...
```

**`*_box_outliers.csv`** (`hr_box_outliers.csv` / `rmssd_box_outliers.csv`):

```
participant,phase,value
participant_1,Exam,142.3
participant_1,Exam,138.9
...
```

The statistics (quartiles/whiskers/outliers) are computed **in Python**,
not in the browser — D3, unlike Plotly, has no built-in box-plot
primitive, and the whisker rule (usually 1.5×IQR) and outlier definition
are a methodological choice that's more sensible to keep in one place
with the rest of the methodology (Python) than to duplicate in JS.
`renderBoxplot()` only draws the already-computed numbers.

The same format/render code is used for HR (`0.4`) and RMSSD (`0.7`) —
different input files, the same `boxplotStatic.js`.

## 12. RR intervals (`2.5` on the page) — NO separate file

RR interval and instantaneous HR are the same series of beats
(`RR_ms = 60000 / HR_bpm`), so `renderRrIntervalOverlay()` in
`hrOverlayStatic.js` recomputes it on the fly from the already-loaded
`instantaneous_hr.csv` (§6) — no separate CSV is needed or created. If
you need the "raw" RR specifically (not derived through HR) for
methodological reasons — say so, we'll add a separate export; it's not a
format problem, just a question of which of the two you consider more
"native".

## 13. DTW alignment example (`dtwAlignmentExample.js`) — long CSV + path, one set per pair

An illustration for the DTW matrix (§3.1 on the page): not a summary
number, but the process itself — how far one series had to be "shifted"
relative to the other for the shapes to match. Shown for **all three
pairs** (not just one) — three independent file-sets, one per pair, same
format for each:

| Pair | File stem |
|---|---|
| participant_1 × participant_2 | `dtw_alignment_p1p2_*` |
| participant_2 × participant_3 | `dtw_alignment_p2p3_*` |
| participant_3 × participant_1 | `dtw_alignment_p3p1_*` |

**`dtw_alignment_{stem}_series.csv`** (e.g. `dtw_alignment_p1p2_series.csv`):

```
participant,time_s,value
participant_1,1740.0,-0.42
participant_1,1800.0,0.15
...
participant_2,1740.0,-0.10
participant_2,1800.0,0.38
...
```

- `value` — z-scored RMSSD (the same z-score already used before DTW in
  your `ecg.py` — synchrony in the series' SHAPE, not its absolute level)
- Both series MUST be on the same time grid (the same `rmssd_common` used
  for the DTW matrix) — `dtw_alignment_{stem}_path.csv` refers to
  positional indices inside each series, and they must line up row for
  row with what was fed into the DTW computation itself

**`dtw_alignment_{stem}_path.csv`** (e.g. `dtw_alignment_p1p2_path.csv`):

```
i,j
0,0
1,0
1,1
2,2
...
```

- `i`/`j` — positional (0-based) indices into the first/second series
  respectively, ONE row = one pair of points that DTW considered
  "matching" each other. Not timestamps — indices; the chart itself
  converts them to `time_s`/`value` via position in the matching
  `dtw_alignment_{stem}_series.csv`
- The path is strictly monotonic by construction of DTW (i and j only
  ever increase along the path) — if you end up with a path from a
  different library/implementation, that's worth checking before feeding
  it in here
