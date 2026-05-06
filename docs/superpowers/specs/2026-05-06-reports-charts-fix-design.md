# Reports charts fix (Bundle 3D)

**Date:** 2026-05-06
**Branch:** `feature/reports-page`
**Status:** Spec — awaiting user review before plan

## Context

The `feature/reports-page` branch introduces a new Reports view with seven tabs (Overview, Detailed, Win vs Loss Days, Drawdown, Compare, Tag Breakdown, Advanced). The data pipeline (`src/utils/reports.js`, `useMountReports` in `src/utils/utils.js`) and ECharts dispatch wiring (`src/utils/charts.js`) are in place, but **every ECharts visualization on the Reports page renders blank**. Stat cards, tables, and the self-mounting Advanced scatter render correctly; only the dispatched ECharts charts are dead.

This spec captures the root cause and the minimum fix needed to unblock the rest of the planned Reports work.

## Root cause

In `src/utils/charts.js`, the entry function `useECharts(param)` (~lines 32–92) begins with an unconditional loop that initializes `pieChart1` and `pieChart2`:

```js
for (let index = 1; index <= 2; index++) {
    var chartId = 'pieChart' + index
    if (param == "clear") {
        echarts.init(document.getElementById(chartId)).clear()
    }
    if (param == "init") {
        // ... compute green/red ...
        await usePieChart(chartId, green, red)
    }
}
```

The `pieChart1`/`pieChart2` DOM elements only exist on the **Dashboard** view. On Reports (and Calendar, Daily, etc.), `document.getElementById('pieChart1')` returns `null`. `echarts.init(null)` then throws `TypeError: Cannot read properties of null (reading 'getAttribute')`.

The throw aborts `useECharts` **before** any of the `handleCharts('reportDailyPL', …)`, `handleCharts('reportDrawdown', …)`, etc. calls execute. Every Reports ECharts visualization is therefore silently blank.

### Empirical confirmation

Verified against the running app at `http://localhost:8080/reports` on 2026-05-06:

- DOM elements exist with proper sizes (e.g., `reportDailyPLChart` is 598×400; `reportDrawdownChart` is 1270×400).
- `document.querySelector('#reportDailyPLChart [_echarts_instance_]')` is `false` — ECharts has never been initialized on these elements.
- Console shows `MOUNTING REPORTS` → `Calculating report stats` → `Duration mount reports: 371ms` (data pipeline succeeds) → `TypeError: Cannot read properties of null (reading 'getAttribute')` (chart init fails).
- The Drawdown tab's stat cards render real values ($118.11 average drawdown, $202.78 biggest drawdown), confirming the data layer is intact and only the visualization layer is broken.

## Fix

**Page-guard the pieChart block** in `src/utils/charts.js`:

```js
export async function useECharts(param) {
    if (pageId.value === 'dashboard') {
        for (let index = 1; index <= 2; index++) {
            // ... existing pieChart1/pieChart2 logic unchanged ...
        }
    }

    function handleCharts(prefix, useChartFunction) { /* unchanged */ }

    handleCharts('lineBarChart', useLineBarChart)
    handleCharts('barChart', useBarChart)
    handleCharts('barChartNegative', useBarChartNegative)
    handleCharts('reportDailyPL', useReportDailyPLChart)
    handleCharts('reportCumulativePL', useReportCumulativePLChart)
    handleCharts('reportDailyVolume', useReportDailyVolumeChart)
    handleCharts('reportWinRate', useReportWinRateChart)
    handleCharts('reportDrawdown', useReportDrawdownChart)
    handleCharts('reportMovingAvg', useReportMovingAvgChart)
    handleCharts('reportVolatility', useReportVolatilityChart)
    handleCharts('reportBar', useReportBarChart)
}
```

`pageId` is already imported into `charts.js:1`.

### Why option A (page-guard) over option B (null-guard each call)

Option B (null-checking inside the loop and inside `usePieChart`) is more defensive but signals that `useECharts` is doing too much — pieChart logic semantically belongs to Dashboard, not to a generic chart-init function. Refactoring the whole function is real scope creep for a bug fix. Option A captures the actual semantic intent in one line and is trivial to revert.

## Verify-after items (live in the running app)

After the fix lands, walk through every Reports tab and confirm:

1. **Overview** — Daily P&L, Cumulative P&L, Daily Volume, Win Rate charts render.
2. **Detailed → Days/Times** — `reportBarDay`, `reportBarHour`, `reportBarDayPerf`, `reportBarHourPerf` render.
3. **Detailed → Price/Volume** — `reportBarEntryPrice`, `reportBarVolume` render.
4. **Drawdown** — Drawdown, P&L Moving Average, Volatility charts render.
5. **Compare** — table-only; should be unaffected.
6. **Tag Breakdown** — table-only; should be unaffected.
7. **Advanced** — self-mounting scatter; should be unaffected.
8. **Smoke test Dashboard** — confirm `pieChart1`/`pieChart2` still render after the page-guard.

### Possible follow-up: hidden-tab sizing

Reports uses `v-show` for tab content. When `useECharts("init")` runs at mount, only the active tab is visible — the others have `display: none` ancestors. ECharts initialized inside hidden DOM frequently renders at 0×0 height and does not auto-resize when the tab is later revealed.

If verify-after items 2–4 show empty charts on first tab visit (but render fine after window resize), follow-up work needed:

- **Either** lazy-init: trigger the relevant `handleCharts(...)` call on tab activation rather than at mount, **or**
- **Or** call `chart.resize()` on tab change for charts already mounted in that tab.

This is held out of the primary fix because we don't yet know whether it's a real problem until option A is applied. If it surfaces, it's small (handful of lines) and gets a follow-up entry, not a full design cycle.

## Out of scope

The following are real but separate from this fix:

- **First Vue render error** (`Cannot read properties of undefined (reading 'icon')`) — visible in console but not blocking any visible rendering. Investigate separately if it surfaces a bug.
- **Tooltips on advanced stats** (K-Ratio, SQN, Kelly%, Probability of Random Chance in the Detailed tab) — content/UX work, not a bug. Candidate for a future Reports polish bundle.
- **Empty-state messaging** on charts when the selected period has no trades — same: polish, not a bug.
- **Refactor of `useECharts`** to dispatch by `pageId` — tempting structurally but pure scope creep.

## Risk and rollback

- Surface area: one function in one file (`src/utils/charts.js`). No schema, no API, no data migration.
- Rollback: `git revert` on the single commit.
- Test plan: load Reports → all 7 tabs render charts. Load Dashboard → pie charts still render. Apply a filter on Reports → charts re-render correctly via the existing `Filters.vue:saveFilter` → `useMountReports` → `useECharts("init")` path.

## Acceptance criteria

1. On `http://localhost:8080/reports`, every ECharts visualization listed in **Verify-after items 1–4** renders with data.
2. On `http://localhost:8080/dashboard`, `pieChart1` and `pieChart2` still render with data.
3. The console error `Cannot read properties of null (reading 'getAttribute')` no longer appears on Reports load.
4. Filter changes on Reports re-render charts without errors.

## Sequencing

This is the first sub-project in the agreed sequence: **3D → Bundle 1 (Calendar UX) → Bundle 2 (Filter UX) → Bundle 3A (MFE/MAE Trade Quality Report).** Each gets its own spec → plan → implementation cycle.
