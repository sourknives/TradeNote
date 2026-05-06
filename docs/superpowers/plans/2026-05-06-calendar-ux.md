# Calendar UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Calendar view the primary daily-context surface in TradeNote: Sunday-first weekday order across all calendar surfaces; `/calendar` becomes the post-login default; weekly P/L column on the right; monthly P/L summary above the grid; satisfaction thumb icon on day cells; clicking a day with trades navigates to Daily.

**Architecture:** Surgical edits across 7 files. Phase A (3 changes coordinated): swap weekday ordering everywhere, redirect post-login flows, reorder sidebar. Phase B (1 file): four enhancements to `Calendar.vue` (header total, week column, satisfaction icon, click-day handler). Both phases verified manually in the running Docker app at `http://localhost:8080`.

**Tech Stack:** Vue 3 + Pinia + Vue Router, [`calendarize`](https://github.com/lukeed/calendarize) library, Bootstrap classes, dayjs. Verification is manual (no JS test framework configured).

**Spec:** `docs/superpowers/specs/2026-05-06-calendar-ux-design.md`

---

### Task 1: Sunday-first across all calendar surfaces

**Files:**
- Modify: `src/components/Calendar.vue` (line 21 — `days` array)
- Modify: `src/utils/calendar.js` (line 41 — `calendarize` second arg)
- Modify: `src/components/reports/ReportOverview.vue` (line 21 — `days` array; line 47 — `calendarize` second arg)

The [`calendarize`](https://github.com/lukeed/calendarize) library's second argument is a weekday offset: `0` = Sunday-first, `1` = Monday-first. Both the weekday header array and the `calendarize` call must change together so the column headers stay aligned with the grid.

- [ ] **Step 1: Update `src/components/Calendar.vue` weekday header array.**

Find at line 21:
```js
const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
```
Replace with:
```js
const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
```

- [ ] **Step 2: Update `src/utils/calendar.js` calendarize offset.**

Find at line 41:
```js
let calendarizeData = calendarize(dateForCalendarize, 1) // this creates.value calendar date numbers needed for a table calendar
```
Replace with:
```js
let calendarizeData = calendarize(dateForCalendarize, 0) // 0 = weeks start on Sunday
```

- [ ] **Step 3: Update `src/components/reports/ReportOverview.vue` weekday header array.**

Find at line 21:
```js
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]
```
This is the month names array — leave it. Locate the **weekday** array used by the heatmap. It appears further down in the template at the existing `<div v-for="d in ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']" :key="d">`. Update that inline array:

Find:
```vue
<div
    v-for="d in ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']"
    :key="d"
    style="width: 14.28%; text-align: center;"
>
```
Replace with:
```vue
<div
    v-for="d in ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']"
    :key="d"
    style="width: 14.28%; text-align: center;"
>
```

- [ ] **Step 4: Update `src/components/reports/ReportOverview.vue` calendarize offset.**

Find at line 47:
```js
const rawWeeks = calendarize(dateForCalendarize, 1)
```
Replace with:
```js
const rawWeeks = calendarize(dateForCalendarize, 0)
```

---

### Task 2: Calendar as default landing page

**Files:**
- Modify: `src/components/LoginRegister.vue` (lines 40 and 75 — login + register redirects)
- Modify: `src/utils/utils.js` (line 194 — auth-check fallback redirect)
- Modify: `src/utils/addTrades.js` (line 2296 — post-import landing)
- Modify: `src/components/SideMenu.vue` (lines 18–29 — sidebar order under "ANALYZE")

Payment redirects (`Checkout.vue`, `CheckoutSuccess.vue`) intentionally NOT changed — they're confirmation flows, not the daily user landing.

- [ ] **Step 1: Update post-login redirect in `LoginRegister.vue`.**

Find at line 40:
```js
window.location.replace("/dashboard");
```
Replace with:
```js
window.location.replace("/calendar");
```

- [ ] **Step 2: Update post-register redirect in `LoginRegister.vue`.**

Find at line 75 (separate occurrence inside the `register()` function):
```js
window.location.replace("/dashboard");
```
Replace with:
```js
window.location.replace("/calendar");
```

- [ ] **Step 3: Update auth-check redirect in `utils.js`.**

Find at line 194:
```js
                window.location.replace("/dashboard");
```
Replace with:
```js
                window.location.replace("/calendar");
```

- [ ] **Step 4: Update post-import redirect in `addTrades.js`.**

Find at line 2296:
```js
        window.location.href = "/dashboard"
```
Replace with:
```js
        window.location.href = "/calendar"
```

- [ ] **Step 5: Reorder sidebar — Calendar first under "ANALYZE".**

Find the "ANALYZE" block in `src/components/SideMenu.vue` (lines 18–29):
```vue
                <label class="fw-lighter">ANALYZE</label>
                <a id="step3" v-bind:class="[pageId === 'dashboard' ? 'activeNavCss' : '', 'nav-link', 'mb-2']"
                    href="/dashboard">
                    <i class="uil uil-apps me-2"></i>Dashboard</a>
                <a v-bind:class="[pageId === 'reports' ? 'activeNavCss' : '', 'nav-link', 'mb-2']"
                    href="/reports">
                    <i class="uil uil-chart-bar me-2"></i>Reports</a>
                <a id="step4" v-bind:class="[pageId === 'daily' ? 'activeNavCss' : '', 'nav-link', 'mb-2']" href="/daily">
                    <i class="uil uil-signal-alt-3 me-2"></i>Daily
                </a>
                <a id="step5" v-bind:class="[pageId === 'calendar' ? 'activeNavCss' : '', 'nav-link', 'mb-2']"
                    href="/calendar">
                    <i class="uil uil-calendar-alt me-2"></i>Calendar</a>
```

Replace with the new order (Calendar → Dashboard → Reports → Daily). Tour `step` IDs are kept on the same anchors as before to preserve any onboarding tour referencing them, so each `step3..5` ID stays attached to whichever nav link corresponds to that tour-step in the original definition (Dashboard `step3`, Daily `step4`, Calendar `step5`):

```vue
                <label class="fw-lighter">ANALYZE</label>
                <a id="step5" v-bind:class="[pageId === 'calendar' ? 'activeNavCss' : '', 'nav-link', 'mb-2']"
                    href="/calendar">
                    <i class="uil uil-calendar-alt me-2"></i>Calendar</a>
                <a id="step3" v-bind:class="[pageId === 'dashboard' ? 'activeNavCss' : '', 'nav-link', 'mb-2']"
                    href="/dashboard">
                    <i class="uil uil-apps me-2"></i>Dashboard</a>
                <a v-bind:class="[pageId === 'reports' ? 'activeNavCss' : '', 'nav-link', 'mb-2']"
                    href="/reports">
                    <i class="uil uil-chart-bar me-2"></i>Reports</a>
                <a id="step4" v-bind:class="[pageId === 'daily' ? 'activeNavCss' : '', 'nav-link', 'mb-2']" href="/daily">
                    <i class="uil uil-signal-alt-3 me-2"></i>Daily
                </a>
```

The visual order of the Vue template is what users see; the IDs remain attached to the same links they were on. (No onboarding tour code needs to change.)

---

### Task 3: Weekly P/L column, monthly total header, satisfaction icon, click-day

**Files:**
- Modify: `src/components/Calendar.vue` (`<script setup>` and `<template>`)

All four Bundle 1 enhancements live in the same component, so they're grouped into one task with one rebuild.

- [ ] **Step 1: Update imports and add computed values.**

Find the existing `<script setup>` block at the top of `src/components/Calendar.vue` (lines 1–41) and replace **only the imports + the existing `monthLastNext` function area** as follows. The rest of the file (template) is updated in the next steps.

Replace:
```js
<script setup>
import { pageId, selectedMonth, selectedPlSatisfaction, amountCase, calendarData, miniCalendarsData, timeZoneTrade, spinnerLoadingPage, calendarViewMode } from '../stores/globals';
import { useThousandCurrencyFormat, useMountCalendar, useMountDaily } from '../utils/utils';
import dayjs from 'dayjs'
```

With:
```js
<script setup>
import { computed } from 'vue'
import { pageId, selectedMonth, selectedPlSatisfaction, amountCase, calendarData, miniCalendarsData, timeZoneTrade, spinnerLoadingPage, calendarViewMode } from '../stores/globals';
import { useThousandCurrencyFormat, useMountCalendar, useMountDaily } from '../utils/utils';
import dayjs from 'dayjs'
```

Then, immediately after the existing `const days = ...` line (line 21 in the current file, but now Sunday-first from Task 1), add the following block of computed properties and the `jumpToDaily` helper. Place it directly after the `days` declaration and before the `monthLastNext` function:

```js
// ── Bundle 1 enhancements ─────────────────────────────────────────────────────

// Sum of P/L for each week row in the currently displayed month.
const weeklyTotals = computed(() => {
    const totals = []
    if (!calendarData) return totals
    for (const wkIndex in calendarData) {
        const week = calendarData[wkIndex]
        if (!Array.isArray(week)) continue
        let sum = 0
        for (const cell of week) {
            if (cell && cell !== 0 && cell.pAndL && typeof cell.pAndL[amountCase.value + 'Proceeds'] === 'number') {
                sum += cell.pAndL[amountCase.value + 'Proceeds']
            }
        }
        totals.push(sum)
    }
    return totals
})

// Total P/L and trade count for the currently displayed month.
const monthlyTotal = computed(() => {
    let sum = 0
    let trades = 0
    if (!calendarData) return { sum, trades }
    for (const wkIndex in calendarData) {
        const week = calendarData[wkIndex]
        if (!Array.isArray(week)) continue
        for (const cell of week) {
            if (cell && cell !== 0 && cell.pAndL) {
                if (typeof cell.pAndL[amountCase.value + 'Proceeds'] === 'number') {
                    sum += cell.pAndL[amountCase.value + 'Proceeds']
                }
                if (typeof cell.pAndL.trades === 'number') {
                    trades += cell.pAndL.trades
                }
            }
        }
    }
    return { sum, trades }
})

// Click handler for day cells on the main Calendar view.
function jumpToDaily(cell) {
    if (!cell || cell === 0) return
    if (!cell.pAndL || !cell.pAndL.trades) return  // only clickable if there are trades
    localStorage.setItem('selectedMonth', JSON.stringify(selectedMonth.value))
    window.location.href = '/daily'
}
```

- [ ] **Step 2: Replace the month-name header with the new monthly-total header.**

Find the existing header block in `Calendar.vue` (lines 42–58 in the current file):
```vue
    <div class="col-12">
        <div v-bind:class="[pageId === 'calendar' ? 'justify-content-center' : '', 'row']">
            <div v-bind:class="[pageId === 'calendar' ? 'col-md-9 col-xl-6' : '', 'col-12']">
                <div class="row">
                    <div class="col-2">
                        <i class="uil uil-angle-left-b pointerClass" v-on:click="monthLastNext(-1)"></i>
                    </div>
                    <div class="col-8">
                        <span v-if="calendarData.hasOwnProperty(0)">{{ calendarData[0][0].month }}</span>
                    </div>
                    <div class="col-2">
                        <i class="uil uil-angle-right-b pointerClass" v-on:click="monthLastNext(1)"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>
```

Replace with:
```vue
    <div class="col-12">
        <div v-bind:class="[pageId === 'calendar' ? 'justify-content-center' : '', 'row']">
            <div v-bind:class="[pageId === 'calendar' ? 'col-md-9 col-xl-6' : '', 'col-12']">
                <div class="row align-items-center">
                    <div class="col-2">
                        <i class="uil uil-angle-left-b pointerClass" v-on:click="monthLastNext(-1)"></i>
                    </div>
                    <div class="col-8 text-center">
                        <span v-if="calendarData.hasOwnProperty(0)" class="fw-bold">
                            {{ calendarData[0][0].month }}
                        </span>
                        <span
                            v-if="pageId === 'calendar' && monthlyTotal.trades > 0"
                            v-bind:class="monthlyTotal.sum >= 0 ? 'text-success ms-3' : 'text-danger ms-3'"
                        >
                            {{ useThousandCurrencyFormat(parseInt(monthlyTotal.sum)) }}
                        </span>
                        <span
                            v-if="pageId === 'calendar' && monthlyTotal.trades > 0"
                            class="dashInfoTitle ms-2"
                        >
                            · {{ monthlyTotal.trades }} trade{{ monthlyTotal.trades === 1 ? '' : 's' }}
                        </span>
                    </div>
                    <div class="col-2 text-end">
                        <i class="uil uil-angle-right-b pointerClass" v-on:click="monthLastNext(1)"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>
```

The `pageId === 'calendar'` guards keep the extra month-total UI from appearing in the embedded Calendar widget on `/daily`, where it would be redundant.

- [ ] **Step 3: Add the satisfaction thumb icon and click handler to the day cells.**

Find the main calendar grid block (lines 60–80 in the current file):
```vue
    <div v-bind:class="[pageId === 'calendar' ? 'col-md-10 col-xl-9 col-xxl-6 mb-5' : '', 'col-12']">
        <div class="row">
            <div class="col" v-for="(day, index) in days">
                <div>{{ day }}</div>
                <div v-for="line in calendarData">
                    <div class="row">
                        <div v-show="line[index] != 0"
                            v-bind:class="[{ 'greenTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] >= 0 : line[index].satisfaction == true, 'redTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] < 0 : line[index].satisfaction == false, 'calDivDay': pageId == 'daily', 'calDivDash': pageId == 'calendar' }, 'col']">
                            <p class="mb-1 dayNumber" v-show="line[index].day != 0">{{ line[index].day }}</p>
                            <div v-if="pageId == 'calendar'" class="d-none d-md-block">
                                <p v-show="line[index].pAndL.trades">{{ line[index].pAndL.trades }} trades</p>
                                <p v-show="line[index].pAndL[amountCase + 'Proceeds']">
                                    {{ useThousandCurrencyFormat(parseInt(line[index].pAndL[amountCase + 'Proceeds'])) }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
```

Replace with (changes: cell wrapper gets `position: relative`, click handler, and conditional `pointerClass`; satisfaction thumb icon added inside the cell):
```vue
    <div v-bind:class="[pageId === 'calendar' ? 'col-md-10 col-xl-9 col-xxl-6 mb-5' : '', 'col-12']">
        <div class="row">
            <div class="col" v-for="(day, index) in days">
                <div>{{ day }}</div>
                <div v-for="line in calendarData">
                    <div class="row">
                        <div v-show="line[index] != 0"
                            v-on:click="pageId === 'calendar' ? jumpToDaily(line[index]) : null"
                            v-bind:class="[
                                {
                                    'greenTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] >= 0 : line[index].satisfaction == true,
                                    'redTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] < 0 : line[index].satisfaction == false,
                                    'calDivDay': pageId == 'daily',
                                    'calDivDash': pageId == 'calendar',
                                    'pointerClass': pageId === 'calendar' && line[index] && line[index].pAndL && line[index].pAndL.trades
                                },
                                'col'
                            ]"
                            v-bind:style="'position: relative;'">
                            <p class="mb-1 dayNumber" v-show="line[index].day != 0">{{ line[index].day }}</p>
                            <i
                                v-if="line[index].satisfaction === true"
                                class="uil uil-thumbs-up"
                                style="position: absolute; top: 2px; right: 4px; font-size: 12px; color: #22c55e;"
                            ></i>
                            <i
                                v-if="line[index].satisfaction === false"
                                class="uil uil-thumbs-down"
                                style="position: absolute; top: 2px; right: 4px; font-size: 12px; color: #ef4444;"
                            ></i>
                            <div v-if="pageId == 'calendar'" class="d-none d-md-block">
                                <p v-show="line[index].pAndL.trades">{{ line[index].pAndL.trades }} trades</p>
                                <p v-show="line[index].pAndL[amountCase + 'Proceeds']">
                                    {{ useThousandCurrencyFormat(parseInt(line[index].pAndL[amountCase + 'Proceeds'])) }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Weekly P/L column (only on /calendar; not on /daily widget) ─── -->
            <div class="col" v-if="pageId === 'calendar'">
                <div>Week</div>
                <div v-for="(weekTotal, wi) in weeklyTotals" :key="'wt-' + wi">
                    <div class="row">
                        <div
                            v-bind:class="[
                                {
                                    'greenTradeDiv': weekTotal > 0,
                                    'redTradeDiv': weekTotal < 0,
                                    'calDivDash': true
                                },
                                'col'
                            ]"
                        >
                            <p v-show="weekTotal !== 0" class="mb-1 small fw-bold">
                                {{ useThousandCurrencyFormat(parseInt(weekTotal)) }}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
```

The mini-calendar block at the bottom of `Calendar.vue` (the `v-show="pageId == 'calendar'"` block that iterates `miniCalendarsData`) is **not changed** — mini-calendars stay 7 columns and don't get the satisfaction icon to keep them compact. (Per the spec's behavior matrix: mini-cals get Sunday-first only.)

Wait — the spec **does** include satisfaction icons in mini-cals. Update the mini-cal cells too.

Find the mini-calendar template block (further down in the same file, the section under `<div v-show="pageId == 'calendar'" class="col-12">`):
```vue
                                <div v-show="line[index] != 0"
                                    v-bind:class="[{ 'greenTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] >= 0 : line[index].satisfaction == true, 'redTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] < 0 : line[index].satisfaction == false }, 'calDivMini', 'col']">
                                    <p class="mb-1 dayNumber" v-show="line[index].day != 0">{{ line[index].day }}</p>
                                </div>
```

Replace with (adds `position: relative` and the satisfaction icon, smaller font for the mini-cal context):
```vue
                                <div v-show="line[index] != 0"
                                    v-bind:class="[{ 'greenTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] >= 0 : line[index].satisfaction == true, 'redTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] < 0 : line[index].satisfaction == false }, 'calDivMini', 'col']"
                                    v-bind:style="'position: relative;'">
                                    <p class="mb-1 dayNumber" v-show="line[index].day != 0">{{ line[index].day }}</p>
                                    <i
                                        v-if="line[index].satisfaction === true"
                                        class="uil uil-thumbs-up"
                                        style="position: absolute; top: 0; right: 1px; font-size: 9px; color: #22c55e;"
                                    ></i>
                                    <i
                                        v-if="line[index].satisfaction === false"
                                        class="uil uil-thumbs-down"
                                        style="position: absolute; top: 0; right: 1px; font-size: 9px; color: #ef4444;"
                                    ></i>
                                </div>
```

---

### Task 4: Rebuild the running container

The container serves a baked production build (no hot-reload). Rebuild once after Tasks 1–3 are all applied.

- [ ] **Step 1: Rebuild and restart the tradenote service.**

Run from the repo root:
```
docker compose -f docker-compose-local.yml up -d --build tradenote
```
Expected: Vite build completes, image rebuilt, `tradenote_app` container recreated and started.

- [ ] **Step 2: Confirm container health.**

Run:
```
docker ps --filter "name=tradenote_app" --format "{{.Names}}: {{.Status}}"
```
Expected: `tradenote_app: Up <a few seconds>`.

---

### Task 5: Verify acceptance criteria in the live app

This is the end-to-end smoke test. Each step references one of the 10 acceptance criteria from the spec.

- [ ] **Step 1 (AC #1): Sunday-first on every calendar surface.**

Visit `http://localhost:8080/calendar` (after F5 to bypass cache). Confirm:
- The first weekday header column reads `Su`.
- A known date (e.g., the 1st of a Sunday-starting month) lands in the leftmost column.

Visit `http://localhost:8080/reports`, click `Overview` tab, click `Calendar` sub-tab. Confirm the yearly heatmap shows `Su` as the first weekday in each month.

DevTools console one-liner for verification:
```js
[...document.querySelectorAll('.col > div:first-child, .miniCalBox > div:first-child')].slice(0, 7).map(d => d.textContent.trim())
```
Expected: starts with `Su`.

- [ ] **Step 2 (AC #5): Sidebar order.**

In the left sidebar under "ANALYZE", confirm the order top-to-bottom is: Calendar, Dashboard, Reports, Daily.

- [ ] **Step 3 (AC #2 + #3): Login redirects to /calendar.**

Open an incognito/private window. Visit `http://localhost:8080/`. Log in with the test credentials. Confirm the URL after login is `http://localhost:8080/calendar` (NOT `/dashboard`).

(If you don't want to log out, you can simulate by clearing the Parse session cookie or by inspecting the redirect target in DevTools Network tab during login.)

- [ ] **Step 4 (AC #4): Post-import redirect.**

This is harder to test without going through the full import flow. Optional — verify by code inspection: `git diff src/utils/addTrades.js` shows line 2296 changed to `/calendar`.

- [ ] **Step 5 (AC #6): Weekly P/L column on main Calendar.**

On `/calendar`, confirm:
- The grid has 8 columns: `Su Mo Tu We Th Fr Sa Week`.
- Each row's `Week` cell shows a dollar amount or is blank if there's no P/L.
- Positive weekly totals have a green background; negative ones red.

DevTools spot check:
```js
[...document.querySelectorAll('.row > .col > div:first-child')].map(d => d.textContent.trim()).slice(0, 8)
```
Expected: `["Su","Mo","Tu","We","Th","Fr","Sa","Week"]` (or similar).

- [ ] **Step 6 (AC #7): Monthly total in header.**

On `/calendar`, confirm the header above the grid reads:
`<Month name>  <±$total>  · <N> trade(s)`

(The total + trade count are hidden when the displayed month has zero trades, which is correct.)

Click the `<` arrow to navigate to a previous month. Confirm the header total updates to that month's totals.

- [ ] **Step 7 (AC #8): Satisfaction thumbs.**

On `/calendar`, scroll to a day where you've previously recorded a 👍 or 👎 in the Daily/Diary view. Confirm a small thumbs-up (green) or thumbs-down (red) icon appears in the top-right corner of that cell.

If the user has no satisfaction data for any day in the displayed month, navigate to a month that does, or skip and verify by code inspection.

- [ ] **Step 8 (AC #9): Click-day → Daily.**

On `/calendar`, click a day cell that has trades. Confirm:
- Browser navigates to `/daily`.
- The Daily view loads showing trades for that month.

Click a day cell with **no** trades — confirm nothing happens (no navigation, no error).

- [ ] **Step 9 (AC #10): Existing features still work.**

On `/calendar`:
- Click `<` and `>` month arrows — month changes.
- Click view-mode toggle (30/60/90/Yearly) — view changes; mini-cals appear.
- Open Filters panel, change the Gross/Net selector, click Filter — view re-renders.
- Toggle the P&L vs Satisfaction color mode in the Filters panel — cell background colors switch.

No console errors during any of these.

---

### Task 6: Acceptance review

- [ ] **Step 1: Confirm all 10 spec acceptance criteria pass.**

Cross-check each criterion from `docs/superpowers/specs/2026-05-06-calendar-ux-design.md` "Acceptance criteria" against the verification steps above. If any fails, stop and diagnose before claiming completion.

- [ ] **Step 2: Do not commit.**

The user has substantial uncommitted work on the `feature/reports-page` branch. Do not run `git add` or `git commit`. Leave the working tree dirty for the user to commit on their own schedule.

---

## Self-Review

**1. Spec coverage:**
- Spec § Sunday-first → Task 1 (steps 1-4). ✓
- Spec § Calendar landing → Task 2 (steps 1-5). ✓
- Spec § Weekly column → Task 3 step 3 (template addition + computed in step 1). ✓
- Spec § Monthly total → Task 3 steps 1-2. ✓
- Spec § Satisfaction icon → Task 3 step 3 (main cells + mini-cal cells). ✓
- Spec § Click-day → Task 3 steps 1 (handler) and 3 (click binding). ✓
- Spec § Behavior matrix → respected: weekly column gated to `pageId === 'calendar'`; monthly header gated to `pageId === 'calendar'`; satisfaction icon present in main + mini cells but not in heatmap (heatmap is in ReportOverview.vue which we don't touch for icons). ✓
- Spec § Acceptance criteria 1–10 → mapped to Task 5 steps 1–9 with explicit references. ✓

**2. Placeholder scan:**
- No "TBD" / "TODO" / "implement later".
- All code blocks complete.
- All commands have expected output.
- "Wait — the spec **does** include satisfaction icons in mini-cals" was an in-line correction; the corrected instructions follow it. Acceptable as a teaching note but worth re-reading to make sure the engineer applies the corrected version, not the earlier "not changed" claim.

**3. Type/symbol consistency:**
- `weeklyTotals`, `monthlyTotal`, `jumpToDaily` — defined in script, referenced in template. ✓
- `pageId.value` used elsewhere as `pageId.value == "calendar"` (double `==`). My new code uses `pageId === 'calendar'` (triple `===`) — both work because `pageId` is unwrapped by Vue in templates and is a string in script. ✓
- `useThousandCurrencyFormat` already imported (existing). ✓
- `localStorage.setItem('selectedMonth', ...)` matches the pattern used in `monthLastNext` (line 31 of the original file). ✓

**4. Scope check:**
- 7 files touched, all in scope per spec.
- One sub-project, appropriate granularity. Two rebuild cycles minimized in this single-task structure (everything bundled into Task 4).
