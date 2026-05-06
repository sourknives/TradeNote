# Reports Charts Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the runtime bug that prevents every ECharts visualization on the Reports view (`/reports`) from rendering, by page-guarding the Dashboard-only pie-chart side-effect at the top of `useECharts(param)`.

**Architecture:** One-line semantic guard in `src/utils/charts.js`. The `useECharts` entry function unconditionally tries to init `pieChart1`/`pieChart2` DOM nodes that only exist on the Dashboard page. On Reports the elements are `null`, `echarts.init(null)` throws `Cannot read properties of null (reading 'getAttribute')`, and the throw aborts `useECharts` before any of the `handleCharts('reportDailyPL', …)` calls run. Wrapping the pie-chart loop in `if (pageId.value === 'dashboard')` preserves Dashboard behavior and unblocks every Report ECharts (Daily P&L, Cumulative P&L, Daily Volume, Win Rate, Drawdown, Moving Avg, Volatility, plus the six `reportBar*` variants).

**Tech Stack:** Vue 3 + Pinia + Vue Router, ECharts 5, Vite 5 build, Express + Parse Server backend, MongoDB, Docker compose for local dev. Verification is manual in the running app at `http://localhost:8080` (no JS test framework is configured in `package.json`).

**Spec:** `docs/superpowers/specs/2026-05-06-reports-charts-fix-design.md`

---

### Task 1: Apply the page-guard in `useECharts`

**Files:**
- Modify: `src/utils/charts.js` (function `useECharts`, currently lines ~32–92)

**Pre-context — what's there today:**

The current function unconditionally runs the pie-chart loop, then calls `handleCharts(...)` for each chart family:

```js
export async function useECharts(param) {
    for (let index = 1; index <= 2; index++) {
        var chartId = 'pieChart' + index
        if (param == "clear") {
            echarts.init(document.getElementById(chartId)).clear()
        }

        if (param == "init") {
            let green
            let red
            if (index == 1) {
                green = (totals[amountCase.value + 'WinsCount'] / totals.trades)
                red = (totals[amountCase.value + 'LossCount'] / totals.trades)
                await usePieChart(chartId, green, red)
            }
            if (index == 2 && satisfactionArray.length > 0) {
                let satisfied = satisfactionArray.filter(obj => obj.satisfaction == true).length
                let dissatisfied = satisfactionArray.filter(obj => obj.satisfaction == false).length
                if (satisfactionArray.length > 0) {
                    green = satisfied / satisfactionArray.length
                    red = dissatisfied / satisfactionArray.length
                }
                await usePieChart(chartId, green, red)
            }
        }
    }

    function handleCharts(prefix, useChartFunction) {
        let elements = document.querySelectorAll(`[id^="${prefix}"]`);
        elements.forEach(element => {
            if (param == "clear") {
                echarts.init(element).clear();
            }
            if (param == "init" || param == prefix) {
                useChartFunction(element.id);
            }
        });
    }

    handleCharts('lineBarChart', useLineBarChart);
    handleCharts('barChart', useBarChart);
    handleCharts('barChartNegative', useBarChartNegative);

    // Report chart types
    handleCharts('reportDailyPL', useReportDailyPLChart);
    handleCharts('reportCumulativePL', useReportCumulativePLChart);
    handleCharts('reportDailyVolume', useReportDailyVolumeChart);
    handleCharts('reportWinRate', useReportWinRateChart);
    handleCharts('reportDrawdown', useReportDrawdownChart);
    handleCharts('reportMovingAvg', useReportMovingAvgChart);
    handleCharts('reportVolatility', useReportVolatilityChart);
    handleCharts('reportBar', useReportBarChart);
}
```

`pageId` is already imported on line 1 of `charts.js` (no new imports needed).

- [ ] **Step 1: Wrap the pie-chart loop in a `pageId.value === 'dashboard'` guard.**

In `src/utils/charts.js`, find the `for (let index = 1; index <= 2; index++) { ... }` loop at the top of `useECharts`. Wrap it with a page guard so it only runs on the Dashboard view:

```js
export async function useECharts(param) {
    if (pageId.value === 'dashboard') {
        for (let index = 1; index <= 2; index++) {
            var chartId = 'pieChart' + index
            if (param == "clear") {
                echarts.init(document.getElementById(chartId)).clear()
            }

            if (param == "init") {
                let green
                let red
                if (index == 1) {
                    green = (totals[amountCase.value + 'WinsCount'] / totals.trades)
                    red = (totals[amountCase.value + 'LossCount'] / totals.trades)
                    await usePieChart(chartId, green, red)
                }
                if (index == 2 && satisfactionArray.length > 0) {
                    let satisfied = satisfactionArray.filter(obj => obj.satisfaction == true).length
                    let dissatisfied = satisfactionArray.filter(obj => obj.satisfaction == false).length
                    if (satisfactionArray.length > 0) {
                        green = satisfied / satisfactionArray.length
                        red = dissatisfied / satisfactionArray.length
                    }
                    await usePieChart(chartId, green, red)
                }
            }
        }
    }

    function handleCharts(prefix, useChartFunction) {
        let elements = document.querySelectorAll(`[id^="${prefix}"]`);
        elements.forEach(element => {
            if (param == "clear") {
                echarts.init(element).clear();
            }
            if (param == "init" || param == prefix) {
                useChartFunction(element.id);
            }
        });
    }

    handleCharts('lineBarChart', useLineBarChart);
    handleCharts('barChart', useBarChart);
    handleCharts('barChartNegative', useBarChartNegative);

    // Report chart types
    handleCharts('reportDailyPL', useReportDailyPLChart);
    handleCharts('reportCumulativePL', useReportCumulativePLChart);
    handleCharts('reportDailyVolume', useReportDailyVolumeChart);
    handleCharts('reportWinRate', useReportWinRateChart);
    handleCharts('reportDrawdown', useReportDrawdownChart);
    handleCharts('reportMovingAvg', useReportMovingAvgChart);
    handleCharts('reportVolatility', useReportVolatilityChart);
    handleCharts('reportBar', useReportBarChart);
}
```

The only change is wrapping the existing `for (let index = 1; index <= 2; index++) { ... }` loop with `if (pageId.value === 'dashboard') { ... }`. Everything else is preserved verbatim.

- [ ] **Step 2: Save the file and confirm the diff is minimal.**

Run:
```
git diff src/utils/charts.js
```
Expected: the diff for this fix shows ONLY the new `if (pageId.value === 'dashboard') {` line added before the `for` loop and a matching closing `}` after it. (Note: the file already has prior uncommitted work on this branch — that's expected. The fix should add ~2 lines on top.)

---

### Task 2: Rebuild the running container so the change is served

The running container at `tradenote_app` was built from a now-stale snapshot of the source. The Dockerfile (`docker/Dockerfile`) does `npm run build` at image build time and serves the resulting `dist/` via Express. The container does not hot-reload. To pick up the fix the image must be rebuilt.

- [ ] **Step 1: Rebuild the tradenote service in place.**

Run from the repo root:
```
docker compose -f docker-compose-local.yml up -d --build tradenote
```
Expected: docker rebuilds the `tradenote:latest` image (this runs `npm install` then `npm run build` inside the container; takes ~1–2 minutes), then restarts the `tradenote_app` container. Final output ends with something like `Container tradenote_app  Started`.

- [ ] **Step 2: Confirm the container is up and serving.**

Run:
```
docker ps --filter "name=tradenote_app" --format "{{.Names}}: {{.Status}}"
```
Expected: `tradenote_app: Up <a few seconds/minutes>`.

---

### Task 3: Verify Reports charts render in the live app

This is the acceptance test. There is no JS test framework in this codebase, so verification is performed by loading the app in a browser and inspecting the DOM/console.

- [ ] **Step 1: Open the Reports page and confirm console is clean.**

In the browser, navigate to `http://localhost:8080/reports`. Open DevTools console.

Expected:
- The previously-seen error `TypeError: Cannot read properties of null (reading 'getAttribute')` is **gone**.
- The console log sequence shows `MOUNTING REPORTS` → `Calculating report stats` → `Duration mount reports: ...ms` with no `getAttribute` error after it.

- [ ] **Step 2: Verify Overview tab — 4 charts render.**

The `Overview → Recent` sub-tab is selected by default. Confirm the four chart frames now render content:
- **Daily P&L** — bar chart with green (positive day) and red (negative day) bars.
- **Cumulative P&L** — smooth line chart with area fill.
- **Daily Volume** — bar chart in indigo.
- **Win Rate** — bar chart with bars colored green ≥50%, red <50%, y-axis 0–100%.

To confirm ECharts is mounted (DevTools Console):
```
({
  dailyPL: !!document.querySelector('#reportDailyPLChart [_echarts_instance_]'),
  cumulPL: !!document.querySelector('#reportCumulativePLChart [_echarts_instance_]'),
  volume: !!document.querySelector('#reportDailyVolumeChart [_echarts_instance_]'),
  winRate: !!document.querySelector('#reportWinRateChart [_echarts_instance_]')
})
```
Expected: all four `true`.

- [ ] **Step 3: Verify Detailed → Days/Times sub-tab — 4 charts render.**

Click `Detailed`. The default sub-tab is `Days/Times`. Confirm the four charts render:
- P&L by Day of Week (`reportBarDay`)
- P&L by Hour (`reportBarHour`)
- Performance by Day of Week (`reportBarDayPerf`)
- Performance by Hour (`reportBarHourPerf`)

DevTools Console check:
```
['reportBarDay','reportBarHour','reportBarDayPerf','reportBarHourPerf'].reduce((a,id)=>(a[id]=!!document.querySelector('#'+id+' [_echarts_instance_]'),a),{})
```
Expected: all four `true`.

If any are `false` despite the fix, this is the **hidden-tab sizing follow-up** noted in the spec — see Task 5.

- [ ] **Step 4: Verify Detailed → Price/Volume sub-tab — 2 charts render.**

Click the `Price / Volume` sub-tab inside Detailed. Confirm:
- P&L by Entry Price (`reportBarEntryPrice`)
- P&L by Volume (`reportBarVolume`)

DevTools Console check:
```
['reportBarEntryPrice','reportBarVolume'].reduce((a,id)=>(a[id]=!!document.querySelector('#'+id+' [_echarts_instance_]'),a),{})
```
Expected: both `true` if a chart is visible. (If the sub-tab was previously hidden when `useECharts("init")` ran, follow-up may be needed — see Task 5.)

- [ ] **Step 5: Verify Drawdown tab — 3 charts render.**

Click the `Drawdown` tab. Confirm:
- Drawdown chart (`reportDrawdownChart`) — red area chart.
- P&L Moving Average (`reportMovingAvgChart`) — green/red bars + amber line.
- P&L Volatility (`reportVolatilityChart`) — purple line with area fill.

DevTools Console check:
```
['reportDrawdownChart','reportMovingAvgChart','reportVolatilityChart'].reduce((a,id)=>(a[id]=!!document.querySelector('#'+id+' [_echarts_instance_]'),a),{})
```
Expected: all three `true` (subject to the same hidden-tab caveat).

- [ ] **Step 6: Verify Compare tab — table-only, unaffected.**

Click `Compare`. The page should render:
- Quick Reports preset dropdown
- Group A / Group B filter cards side-by-side
- "Generate Report" button

No ECharts on this tab. Confirm the page renders without console errors.

- [ ] **Step 7: Verify Tag Breakdown tab — table-only, unaffected.**

Click `Tag Breakdown`. The page should render:
- Summary / Detailed toggle
- Table of tags with inline colored bars (CSS divs, not ECharts).

No ECharts on this tab. Confirm the page renders without console errors.

- [ ] **Step 8: Verify Advanced tab — self-mounted scatter renders.**

Click `Advanced`. Confirm:
- X-Axis and Y-Axis selector dropdowns visible.
- A scatter chart (`reportScatterChart`) renders with green/red dots.

DevTools Console check:
```
!!document.querySelector('#reportScatterChart [_echarts_instance_]')
```
Expected: `true`. (This chart self-mounts inside the component and is unaffected by the `useECharts` fix, but worth confirming nothing regressed.)

- [ ] **Step 9: Smoke-test Dashboard — pie charts still render.**

Click `Dashboard` in the sidebar (or navigate to `http://localhost:8080/dashboard`). Confirm:
- The two pie charts in the Overview ID-cards section render (Win/Loss split + Satisfaction).
- DevTools Console check:
```
({pieChart1: !!document.querySelector('#pieChart1 [_echarts_instance_]'), pieChart2: !!document.querySelector('#pieChart2 [_echarts_instance_]')})
```
Expected: `pieChart1: true`. `pieChart2` will be `true` if `satisfactionArray.length > 0`, otherwise `false` (this is existing behavior, not a regression).

- [ ] **Step 10: Smoke-test filter re-render on Reports.**

Navigate back to `/reports`. Click the `Filters ↑` header to expand it. Toggle Gross/Net (e.g., select "Net"). Click `Filter`. Confirm:
- The page re-renders.
- All previously-rendered charts re-render with new data.
- No `getAttribute` errors in the console.

This exercises the `Filters.vue:saveFilter()` → `useMountReports()` → `useECharts("clear")` (called from `saveFilter`) → `useECharts("init")` path end-to-end.

---

### Task 4: Acceptance review

- [ ] **Step 1: Confirm the spec's acceptance criteria are met.**

Cross-check each item from `docs/superpowers/specs/2026-05-06-reports-charts-fix-design.md` "Acceptance criteria":

1. Every ECharts visualization listed in Verify-after items 1–4 of the spec (= Tasks 3.2 through 3.5 above) renders with data — confirmed in steps above.
2. On `/dashboard`, `pieChart1` (and `pieChart2` when satisfaction data exists) still render — confirmed in step 9.
3. `Cannot read properties of null (reading 'getAttribute')` no longer appears on Reports load — confirmed in step 1.
4. Filter changes on Reports re-render charts without errors — confirmed in step 10.

If all four pass, Task 4 is complete and 3D is done.

- [ ] **Step 2: Do not commit.**

The user has substantial uncommitted work on this branch (`feature/reports-page`) that they will commit on their own schedule. Leave the working tree dirty. Do not run `git add` or `git commit`. The only file touched by this plan is `src/utils/charts.js`, which the user already had as a modified file in their working tree before this fix.

---

### Task 5: Conditional follow-up — hidden-tab sizing (only if needed)

**Skip this task entirely if Tasks 3.3, 3.4, and 3.5 all showed `true` for every chart.**

If any of those steps showed an ECharts instance bound to a chart container but the chart itself was visibly empty or sized 0×0, that's the hidden-tab sizing issue noted in the spec. Indicators:
- `_echarts_instance_` attribute is present (chart was initialized).
- But the chart is visually blank, or `document.getElementById(id).getBoundingClientRect()` shows `width: 0` or `height: 0` while the tab is active.
- Or the chart only appears after a window resize.

**Files:**
- Modify: `src/views/Reports.vue` (currently lines 30–32 — the `selectTab` function)

- [ ] **Step 1: Add a resize hook on tab change.**

Update `src/views/Reports.vue` `selectTab` to call `chart.resize()` for any ECharts instances in the activated tab. Update to:

```js
import { nextTick } from 'vue'
import * as echarts from 'echarts'

function selectTab(tabId) {
    selectedReportTab.value = tabId
    nextTick(() => {
        document.querySelectorAll('[_echarts_instance_]').forEach(el => {
            const inst = echarts.getInstanceByDom(el)
            if (inst && !inst.isDisposed()) inst.resize()
        })
    })
}
```

Add the imports if they aren't already present at the top of the `<script setup>` block.

- [ ] **Step 2: Rebuild and verify.**

Re-run the Task 2 rebuild step:
```
docker compose -f docker-compose-local.yml up -d --build tradenote
```

Then re-run Tasks 3.3, 3.4, 3.5 in the browser. Charts in previously-hidden tabs should now render at full size on first visit.

If charts are still empty 0×0, the issue is that ECharts wasn't initialized on those elements at mount time at all (because the elements were `display: none`). In that case, the deeper fix is **lazy init** — call the relevant `handleCharts(...)` for that tab inside `selectTab` before resizing. That's a bigger change; spec it as a separate item rather than expanding this plan.

---

## Self-Review

**1. Spec coverage:**
- Spec § Fix → Task 1. ✓
- Spec § Verify-after items 1–7 → Tasks 3.2 through 3.8 (one task step per item). ✓
- Spec § Verify-after item 8 (Dashboard smoke test) → Task 3.9. ✓
- Spec § Possible follow-up: hidden-tab sizing → Task 5. ✓
- Spec § Acceptance criteria → Task 4.1. ✓
- Spec § Risk and rollback → covered implicitly: single-file, single-line guard, no commit. ✓

**2. Placeholder scan:**
- No "TBD"/"TODO"/"implement later".
- No "add appropriate error handling" without code.
- All code blocks are full and self-contained.
- All commands have expected output.

**3. Type/symbol consistency:**
- `pageId` import on `charts.js:1` confirmed before plan was written.
- `pageId.value === 'dashboard'` matches the existing pattern in `useECharts` and elsewhere in the codebase.
- Chart DOM IDs in verification steps (`reportDailyPLChart`, `reportBarDay`, etc.) match the templates in `src/components/reports/*.vue` exactly.
- Functions referenced in step 5 of Task 5 (`echarts.getInstanceByDom`, `inst.resize()`, `inst.isDisposed()`) are public ECharts API.

**4. Scope check:**
- One sub-project, one bug fix, one source file change, optional one-step follow-up. Appropriate granularity.
