# Calendar UX (Bundle 1)

**Date:** 2026-05-06
**Branch:** `feature/reports-page`
**Status:** Spec — awaiting user review before plan

## Context

The Calendar view is currently the user's preferred mental model for reviewing daily trading activity, but the current implementation has several friction points and missing information. This bundle addresses four user-requested items plus two small adjacents that have negligible additional cost when the calendar is being touched anyway.

## Goal

Make the Calendar view the primary daily-context surface in TradeNote. Ship Sunday-first weekday ordering, week and month P/L summaries, and direct navigation from the calendar to the daily detail view.

## Scope

### In scope (user-requested)

1. **Sunday-first weekday order** — applied to *every* calendar surface in the app, not just the main view.
2. **Calendar as default landing page** — post-login and post-auth-check redirects go to `/calendar` instead of `/dashboard`. Sidebar reorders so Calendar appears above Dashboard under "Analyze".
3. **Weekly P/L column on the right** — adds an 8th column to the main Calendar grid showing each week's summed P/L (with green/red coloring).
4. **Monthly P/L total above the calendar** — replaces the current bare month-name header with a header that shows the month name + total P/L for the displayed month + trade count.

### In scope (small adjacents I'd add)

5. **Day-cell satisfaction icon** — when a day has a satisfaction marker (👍/👎) recorded in `satisfactionArray`, render a small thumb icon in the corner of that day's cell. Data is already captured in Daily/Diary; currently invisible on Calendar.
6. **Click-day → Daily** — clicking a day cell in the main Calendar navigates to `/daily` with `selectedMonth` set to that day's month. Day-level scroll-to-trade is **out of scope** for this bundle (would need a new URL param + Daily-side handling).

### Out of scope

- Filter UX overhaul (Bundle 2 — separate spec).
- Inline pinned Gross/Net toggle on Calendar (deferred to Bundle 2's filter pin work to avoid two parallel UX changes on the same surface).
- Yearly view of the main Calendar (the existing `calendarViewMode === 'yearly'` is already there and unchanged).
- Click-to-day day-level focus inside Daily.vue (additive future work, not blocking this bundle).
- Renaming or restyling the existing CSS classes (`calDivDay`, `calDivDash`, `calDivMini`, `greenTradeDiv`, `redTradeDiv`).

## Current state — anchors

- `src/components/Calendar.vue:21` — `const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]` (the weekday header array used by both main and mini calendars on the Calendar page).
- `src/utils/calendar.js:41` — `let calendarizeData = calendarize(dateForCalendarize, 1)` — the second arg `1` makes the [`calendarize`](https://github.com/lukeed/calendarize) library return weeks starting on Monday. Passing `0` would make it Sunday-first.
- `src/components/reports/ReportOverview.vue:21` — duplicate weekday header array `['Mo','Tu','We','Th','Fr','Sa','Su']` for the yearly heatmap inside the Reports → Overview tab.
- `src/components/reports/ReportOverview.vue:47` — `const rawWeeks = calendarize(dateForCalendarize, 1)` — same library call inside the yearly heatmap.
- `src/views/Calendar.vue:43-58` — the page layout. Currently shows month-name header + nav arrows, then the `<Calendar />` component, then mini-calendars below.
- `src/components/Calendar.vue:42-80` — main calendar template, column-major rendering: an outer `v-for="day in days"` creates one CSS `col` per weekday, inside each is a `v-for="line in calendarData"` for the weeks.
- `src/components/SideMenu.vue:18-29` — sidebar order under "ANALYZE" is currently Dashboard, Reports, Daily, Calendar.
- `src/components/LoginRegister.vue:40,75` — `window.location.replace("/dashboard")` after successful login/register.
- `src/utils/utils.js:194` — `window.location.replace("/dashboard")` in the auth check fallback.
- `src/utils/addTrades.js:2296` — `window.location.href = "/dashboard"` after first-time trade upload. Probably also should land on Calendar.
- `src/views/CheckoutSuccess.vue:30,35` and `src/views/Checkout.vue:33` — payment flow redirects to `/dashboard`. **Out of scope** for this bundle — payments-related, not the daily user landing flow.

## Design

### 1. Sunday-first

Three coordinated changes:

- **`src/components/Calendar.vue`** — change `days` array to `["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]`.
- **`src/utils/calendar.js`** — change both `calendarize(dateForCalendarize, 1)` call sites to pass `0`.
- **`src/components/reports/ReportOverview.vue`** — change `days` array (line 21) to `["Su","Mo","Tu","We","Th","Fr","Sa"]` and `calendarize` call (line 47) to pass `0`.

This single coordinated swap keeps the calendarize output and the column headers aligned.

### 2. Calendar as default landing

**Redirects to update:**

- `src/components/LoginRegister.vue:40,75` — `window.location.replace("/dashboard")` → `"/calendar"`.
- `src/utils/utils.js:194` — same swap.
- `src/utils/addTrades.js:2296` — `window.location.href = "/dashboard"` → `"/calendar"` (post-import landing).

**Sidebar reorder** in `src/components/SideMenu.vue` under "ANALYZE": Calendar moves to the top. New order: Calendar, Dashboard, Reports, Daily.

**Router root** stays as `Login` at `/`. The login form is what shows for unauthenticated visits; once authed, the redirects above take you to `/calendar`. No router-level redirect added for `/`.

**Payment redirects** (`Checkout.vue`, `CheckoutSuccess.vue`) **not changed** — those are post-payment confirmation flows where Dashboard's revenue-style view may be more appropriate; out of scope for this bundle.

### 3. Weekly P/L column

Adds an 8th CSS column to the main Calendar grid. The column header is `Week`. Each row (week) shows the sum of `pAndL[amountCase + 'Proceeds']` for the days in that row. Coloring follows the same convention as cells: positive → `greenTradeDiv` background, negative → `redTradeDiv`, zero/null → no background.

**Where it applies:**
- ✅ Main Calendar on `/calendar` (when `pageId === 'calendar'`)
- ❌ Mini-calendars on the same page (too small, would clutter)
- ❌ Daily-page calendar widget (different layout, different purpose)
- ❌ Yearly heatmap in Reports → Overview (already pure heatmap, P/L not its job)

**Implementation outline (Calendar.vue):**

The current template iterates `<div class="col" v-for="day in days">` — 7 columns. After that loop ends, add one more `<div class="col">` whose header is `Week` and whose cells iterate `calendarData` (the weeks) and sum the day proceeds.

Concrete computed (in `<script setup>`):

```js
import { computed } from 'vue'

const weeklyTotals = computed(() => {
    const totals = []
    for (const wkIndex in calendarData) {
        const week = calendarData[wkIndex]
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
```

And the template addition (after the existing 7-column `v-for`):

```vue
<div class="col" v-show="pageId === 'calendar'">
    <div>Week</div>
    <div v-for="(weekTotal, wi) in weeklyTotals" :key="'wt-' + wi">
        <div class="row">
            <div
                v-bind:class="[
                    {
                        'greenTradeDiv': weekTotal > 0,
                        'redTradeDiv': weekTotal < 0,
                        'calDivDay': pageId == 'daily',
                        'calDivDash': pageId == 'calendar'
                    },
                    'col'
                ]"
            >
                <p v-show="weekTotal !== 0" class="mb-1">
                    {{ useThousandCurrencyFormat(parseInt(weekTotal)) }}
                </p>
            </div>
        </div>
    </div>
</div>
```

The `v-show="pageId === 'calendar'"` guard means the Daily-page version of `<Calendar />` (a small inline widget) doesn't get the extra column. Same `Calendar.vue` component, but the Week column is conditional.

### 4. Monthly P/L total above calendar

Currently `src/components/Calendar.vue:50-54` renders just `{{ calendarData[0][0].month }}` (the formatted month name). Replace with a richer header that shows month + month total + trade count, with color.

Computed values needed (in Calendar.vue `<script setup>`):

```js
const monthlyTotal = computed(() => {
    let sum = 0
    let trades = 0
    for (const wkIndex in calendarData) {
        for (const cell of calendarData[wkIndex]) {
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
```

Updated header template (replaces the existing 3-col arrow/title/arrow):

```vue
<div class="row align-items-center">
    <div class="col-2">
        <i class="uil uil-angle-left-b pointerClass" v-on:click="monthLastNext(-1)"></i>
    </div>
    <div class="col-8 text-center">
        <div v-if="calendarData.hasOwnProperty(0)">
            <span class="fw-bold">{{ calendarData[0][0].month }}</span>
            <span
                v-show="monthlyTotal.trades > 0"
                v-bind:class="monthlyTotal.sum >= 0 ? 'text-success ms-3' : 'text-danger ms-3'"
            >
                {{ useThousandCurrencyFormat(parseInt(monthlyTotal.sum)) }}
            </span>
            <span class="dashInfoTitle ms-2" v-show="monthlyTotal.trades > 0">
                · {{ monthlyTotal.trades }} trade{{ monthlyTotal.trades === 1 ? '' : 's' }}
            </span>
        </div>
    </div>
    <div class="col-2 text-end">
        <i class="uil uil-angle-right-b pointerClass" v-on:click="monthLastNext(1)"></i>
    </div>
</div>
```

The total is hidden when there are zero trades for the month (no clutter on empty months).

### 5. Day-cell satisfaction icon

`satisfactionArray` is a global reactive array of `{ dateUnix, satisfaction }` records (boolean `true` = thumbs-up, `false` = thumbs-down). The per-day satisfaction value is **already** populated onto each cell at calendar-load time: `useLoadCalendar` does `tempData.satisfaction = trade.satisfaction` (`src/utils/calendar.js:83`). So no new lookup is needed — the cell already has `cell.satisfaction`.

Template addition inside the existing day cell, after the day number:

```vue
<i
    v-if="line[index].satisfaction === true"
    class="uil uil-thumbs-up greenTrade"
    style="position: absolute; top: 2px; right: 4px; font-size: 12px;"
></i>
<i
    v-if="line[index].satisfaction === false"
    class="uil uil-thumbs-down redTrade"
    style="position: absolute; top: 2px; right: 4px; font-size: 12px;"
></i>
```

The cell parent (`calDivDay` / `calDivDash`) needs `position: relative`. Verify in CSS — if not, add it locally to the cell wrapper.

This is independent of `selectedPlSatisfaction` (which controls cell *background* color mode). The icon shows the thumb regardless of which color mode is active, so users can see both signals (P/L color via mode + thumb icon directly).

### 6. Click-day → Daily

Day cells in the main Calendar become clickable. Clicking a day:
1. Sets `selectedMonth.value` to that day's month start.
2. Persists to `localStorage.setItem('selectedMonth', JSON.stringify(selectedMonth.value))`.
3. Navigates to `/daily`.

This mirrors what `monthLastNext` already does for arrow navigation. Guarded so only days with data are clickable (no point clicking empty cells).

```js
import dayjs from 'dayjs'
function jumpToDaily(cell) {
    if (!cell || cell === 0 || !cell.day || cell.day === 0) return
    if (!cell.pAndL || !cell.pAndL.trades) return  // only clickable if there are trades
    // calendarData[0][0].month is the formatted month name; we already have selectedMonth scoped to this month
    // No need to recompute selectedMonth — it's already set to the displayed month
    localStorage.setItem('selectedMonth', JSON.stringify(selectedMonth.value))
    window.location.href = '/daily'
}
```

Add `v-on:click="jumpToDaily(line[index])"` to the day cell wrapper. Add `pointerClass` cursor styling when the cell has trades.

**Why `window.location.href` rather than `router.push`:** the codebase uses `window.location` for navigation everywhere (`LoginRegister.vue`, `utils.js`, `addTrades.js`, etc.) — match the existing pattern.

## Behavior matrix — where each change applies

| Change | Main Calendar (`/calendar`) | Mini-cal on Calendar page | Calendar widget on Daily page | Yearly heatmap in Reports |
| --- | --- | --- | --- | --- |
| Sunday-first | ✅ | ✅ | ✅ (same component) | ✅ |
| Weekly P/L column | ✅ | ❌ (too cluttered) | ❌ | ❌ |
| Monthly total header | ✅ | ❌ | ❌ (Daily already has its own header) | ❌ |
| Satisfaction thumb icon | ✅ | ✅ | ✅ | ❌ (heatmap is by-day color only) |
| Click-day → Daily | ✅ | ❌ | ❌ (already on Daily) | ❌ |

## Risk and rollback

- All changes are confined to: `Calendar.vue`, `calendar.js`, `Calendar` view, `ReportOverview.vue`, `LoginRegister.vue`, `SideMenu.vue`, `utils.js`, `addTrades.js`. No data, no schema, no API.
- Each numbered change is independently revertable.
- Visual smoke test on the running app at `http://localhost:8080/calendar` and `http://localhost:8080/reports` (yearly heatmap) covers all surface area.

## Acceptance criteria

1. On all calendars in the app (`/calendar` main + mini, the widget on `/daily`, and the yearly heatmap in Reports → Overview → Calendar), the leftmost weekday column header is `Su` (Sunday) and dates land in the correct columns.
2. After successful login at `/`, the browser lands at `/calendar` (not `/dashboard`).
3. After successful registration, same — lands at `/calendar`.
4. After completing a first trade import, the user lands at `/calendar`.
5. The sidebar under "ANALYZE" lists Calendar first.
6. On `/calendar` the main calendar grid has 8 columns: Su Mo Tu We Th Fr Sa Week. The Week column shows each row's summed P/L in green/red.
7. Above the main calendar grid, the month header shows: month name + total P/L (colored) + trade count, when the displayed month has any trades.
8. Day cells with `satisfaction === true` show a green thumbs-up icon in the top-right corner; cells with `satisfaction === false` show a red thumbs-down icon. The icon coexists with the cell's P/L (or satisfaction) background color.
9. Clicking a day cell that has trades navigates to `/daily` with that month selected.
10. Existing Calendar features still work: month navigation arrows, view-mode toggle (30/60/90/yearly), Filter panel, Filters' P&L vs Satisfaction color mode switch.

## Sequencing

This is sub-project 2 of 4 in the agreed sequence: **3D ✅ → Bundle 1 (this) → Bundle 2 (Filter UX) → Bundle 3A (MFE/MAE Trade Quality)**. Each is independently shippable.
