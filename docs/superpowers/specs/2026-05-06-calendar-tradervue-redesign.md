# Calendar Tradervue Redesign

**Date:** 2026-05-06
**Branch:** `feature/calendar-tradervue-redesign`
**Status:** Spec — auto-approved by user (5 explicit requirements + 2 clarifying answers + 1 added day-jump requirement)

## Goal

Re-skin the Calendar page to match Tradervue's visual conventions and add a year-at-a-glance grid plus a day-level jump from Calendar → Daily.

## User-stated requirements (verbatim, with resolutions)

1. **Red/Green dollar amount per day. # trades in smaller font, light gray.** Text-driven coloring; trade count subordinate.
2. **Week # header matching day font (size, weight, etc.). Dollar amount in red/green.** Numbered weeks (Week 1…Week N within the visible month, Tradervue convention). Header style identical to `Su/Mo/Tu` headers.
3. **Cal should have static background color, should not change to red or green.** No `greenTradeDiv` / `redTradeDiv` background tinting on the main grid. Cells use the standard `dailyCard`-style neutral background.
4. **Monthly P&L: $ right-justified above Cal.** Replace the current center-aligned month header with: ◀ arrow on left, month name center, monthly $ + trade count right-justified.
5. **Mini cal of each month of year with a shortcut to open.** All 12 months always visible below the main grid. Clicking a mini-cal's month-name header loads that month into the main grid.

**Plus a follow-up requirement:**

6. **Clicking a day jumps to that specific day's trade entry on Daily** (not just the month). Persist the target day's `dateUnix` in `sessionStorage` on click; in `Daily.vue` `onMounted`, read it once, scroll the matching day card into view.

## Out of scope

- The 30/60/90/Yearly **view-mode toggle** — removed (always-on year view replaces it).
- The **P&L vs Satisfaction toggle** in the pinned filter bar on Calendar — removed (no background to swap; satisfaction is always the corner icon, P&L is always the big number).
- Mini-cal styling beyond what's already there (still tiny green/red day-cell tints; no room for $).
- The Daily page's mini-calendar widget — out of scope (it's a different layout).
- Yearly heatmap inside Reports → Overview → Calendar — out of scope (separate component, separate visual language).

## Current state — anchors

- `src/components/Calendar.vue` — main calendar grid + (current) mini-cals shown only in `yearly` mode.
- `src/utils/calendar.js:30-103` — `useLoadCalendar()` populates `calendarData` (main month) and `miniCalendarsData` (other months). Currently gated on `calendarViewMode`.
- `src/utils/calendar.js:81-86` — when matching a trade to a day, `tempData.pAndL` and `tempData.satisfaction` are set on the cell. We'll add `tempData.dateUnix = trade.dateUnix` here so the click handler doesn't need to re-derive it.
- `src/views/Calendar.vue:25-37` — view-mode toggle (`30 Days / 60 Days / 90 Days / Yearly`). Removed.
- `src/views/Daily.vue:781` — `<div v-for="(itemTrade, index) in filteredTrades" class="row mt-2">`. Add `:id="'day-' + itemTrade.dateUnix"`.
- `src/components/Filters.vue` — pinned bar's P&L/Satisfaction toggle. Currently shown when `filters[pageId].includes('plSatisfaction')`. Remove `'plSatisfaction'` from the Calendar filter list (or remove the pinned block entirely if not needed elsewhere — it's only used on Calendar, so remove the `'plSatisfaction'` entry from `filters['calendar']`).
- `src/assets/style-dark.css` — needs new classes for the redesigned cells; old `greenTradeDiv`/`redTradeDiv` stay defined (still used by mini-cals and possibly Daily widget) but won't be applied to main grid cells.

## Design

### 1. Day cell template

```
┌──────────────────┐
│ 8           👍   │   day# top-left (small, neutral gray); 👍/👎 top-right when set
│                  │
│      +$187       │   BIG bold; green if ≥0, red if <0
│                  │
│     1 trades     │   small, light gray
└──────────────────┘
```

Empty days (no trades): show only the day number top-left; rest blank.

CSS additions (new class `tvCell` for "Tradervue cell"):

```css
.tvCell {
    border: 1px solid rgba(255,255,255,0.08);
    background: transparent;            /* matches dailyCard */
    border-radius: 4px;
    padding: 6px 8px;
    height: 110px;                       /* matches updated calDivDash */
    position: relative;
    display: flex;
    flex-direction: column;
    cursor: default;
}
.tvCell.tvCellClickable { cursor: pointer; }
.tvCell.tvCellClickable:hover { background: rgba(255,255,255,0.04); }

.tvDayNum { font-size: 12px; color: rgba(255,255,255,0.55); }

.tvAmount {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
}
.tvAmount.tvWin  { color: #22c55e; }
.tvAmount.tvLoss { color: #ef4444; }

.tvTradeCount {
    text-align: center;
    font-size: 11px;
    color: rgba(255,255,255,0.45);
}

.tvSatIcon {
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 12px;
}
.tvSatIcon.tvWin  { color: #22c55e; }
.tvSatIcon.tvLoss { color: #ef4444; }
```

### 2. Week column

- Header: literal text "Week" — uses the same font/weight as day-of-week headers (no special class needed; just same containing `<div>{{ ... }}</div>` style).
- Cell content: `Week N` label (small, neutral gray) + `±$XXX` (bold red/green).
- N = 1, 2, 3, … per visible week row.

```
┌──────────────────┐
│   Week 1         │   small label, neutral gray
│                  │
│      -$53        │   bold red/green
└──────────────────┘
```

CSS additions:

```css
.tvWeekLabel {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    text-align: center;
}
```

The amount uses the same `.tvAmount` class as day cells.

### 3. Header above grid

Three-column layout, vertically aligned:

```
[ ◀ ]  [        April 2026         ]  [   -$277   17 trades  ]
```

- Left col (2): `◀` arrow.
- Center col (8): month name only, center-aligned, `fw-bold`.
- Right col (2): monthly $ (red/green, bold) on top, trade count below in small light gray.

(Current spec already had monthly total inline center; this redesign moves it to the right col and stacks $ above trade count for a cleaner look.)

### 4. Year-at-a-glance below grid

- Always visible on `/calendar` (no toggle).
- **12 mini-calendars in Jan → Dec order**, Bootstrap 4×3 grid: `col-6 col-md-4 col-xl-3` (responsive).
- Includes the currently-selected month (visually highlighted as "active" — see below) so the grid always has 12 entries, not 11.
- Each mini-cal:
  - Month name header is a clickable button (`.pointerClass` + hover style).
  - Click → set `selectedMonth` to that month, persist to localStorage, call `useMountCalendar(true)`. **Stays on `/calendar`**, just swaps the main month.
  - Existing cell tints inside mini-cals: keep (green/red dots, no $).
  - Active month (matches `selectedMonth.value.start`): outlined with `border: 2px solid #3b82f6` (or similar accent) so the user can always see which month is currently in the main grid.

**Ordering fix:** today `useLoadCalendar()` does `miniCalendarsData.unshift(calendarJson)` which produces Dec → Jan order. Change to `push` so iteration order (Jan → Dec) is preserved. Also remove the "skip if monthUnix == selectedMonth.value.start" guard in the loop — always include all 12.

```js
function jumpToMiniMonth(calData) {
    // calData[0][0].month is the formatted month name; we need a unix to set selectedMonth
    // Easier: derive from miniCalendarsData index — see implementation note below.
}
```

**Implementation note:** the cleanest source of truth for "what month is this mini-cal showing" is the `month` string on `calData[0][0]`. But parsing back to a unix is fragile. Instead, add a `monthStartUnix` field at the top of `calendarJson` in `useLoadCalendar` (alongside the existing data), so each mini-cal carries its own start unix.

In `calendar.js`, immediately after `let calendarJson = {}`:

```js
calendarJson.__monthStartUnix = dayjs(param1 * 1000).tz(timeZoneTrade.value).startOf('month').unix()
```

In `Calendar.vue`, the click handler:

```js
function jumpToMiniMonth(calData) {
    const monthStart = calData.__monthStartUnix
    if (!monthStart) return
    selectedMonth.value = {
        start: monthStart,
        end: dayjs.unix(monthStart).tz(timeZoneTrade.value).endOf('month').unix()
    }
    localStorage.setItem('selectedMonth', JSON.stringify(selectedMonth.value))
    useMountCalendar(true)
}
```

Note: `__monthStartUnix` lives alongside week-indexed numeric keys (0, 1, 2, …) inside `calendarJson`. The existing template iterations like `v-for="line in calendarData"` will accidentally include this when it iterates by `for...in`. Mitigation: use `Number.isFinite(Number(key))` guard in the iteration **OR** rename the key to a numeric-friendly form. Simpler: change to `v-for="(line, key) in calendarData" v-if="!isNaN(Number(key))"`. We do this once for both `calendarData` and `miniCalendarsData` iterations.

Actually cleaner: use a Vue `computed` filter that drops the meta key when the template iterates. Even cleaner: store the meta as an array element at index `-1` is awkward. Cleanest: add a sibling object — change `calendarJson` to have shape `{ __monthStartUnix: ..., weeks: { 0: [...], 1: [...] } }`. But this is a bigger refactor.

**Decision for spec:** add `__monthStartUnix` as a non-numeric key, and update template iterations to use `v-for="(line, key) in calendarData" v-show="!isNaN(Number(key))"`. Three iterator sites in `Calendar.vue` need the guard. Same trick I'd use anywhere I want metadata on a numerically-indexed dict in JS.

### 5. Day-cell click → specific day on Daily

In `calendar.js`, when matching a trade to a day, also store `dateUnix`:

```js
if (trade != undefined && Object.keys(trade).length != 0 && element2 != 0) {
    tempData.pAndL = trade.pAndL
    tempData.satisfaction = trade.satisfaction
    tempData.dateUnix = trade.dateUnix   // ← NEW
}
```

In `Calendar.vue`, the `jumpToDaily(cell)` handler:

```js
function jumpToDaily(cell) {
    if (!cell || cell === 0) return
    if (!cell.pAndL || !cell.pAndL.trades) return
    if (cell.dateUnix) {
        sessionStorage.setItem('jumpToDailyDate', String(cell.dateUnix))
    }
    localStorage.setItem('selectedMonth', JSON.stringify(selectedMonth.value))
    window.location.href = '/daily'
}
```

In `Daily.vue`, after the existing `useMountDaily()` in `onMounted`, add:

```js
import { nextTick } from 'vue'

const jumpDate = sessionStorage.getItem('jumpToDailyDate')
if (jumpDate) {
    sessionStorage.removeItem('jumpToDailyDate')   // one-shot
    nextTick(() => {
        const el = document.getElementById('day-' + jumpDate)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    })
}
```

In `Daily.vue` template line 781, add an `:id`:

```vue
<div :id="'day-' + itemTrade.dateUnix" v-for="(itemTrade, index) in filteredTrades" class="row mt-2">
```

The `dateUnix` value used in Calendar comes from `trade.dateUnix` (from `filteredTrades`), and the `dateUnix` used in Daily's day cards comes from the same `filteredTrades` collection — same source, same key, no normalization risk.

### 6. Removed UI elements

- `src/views/Calendar.vue` lines 25-37 — view-mode toggle. Delete the entire `<div class="col-12 text-center mb-2">` block.
- `src/components/Filters.vue` `filters['calendar']` entry — remove `'plSatisfaction'`. Net: `'calendar': ['month', 'grossNet']`. The pinned-bar P&L/Satisfaction block (lines added in Bundle 2) stays in code; it just won't render on Calendar because `filters[pageId].includes('plSatisfaction')` is false. (No need to delete the block; could be useful for future surfaces.)
- `src/components/Calendar.vue` template — remove all uses of `greenTradeDiv`/`redTradeDiv` on the **main** day cells (keep on mini-cal cells). The `selectedPlSatisfaction` reference goes away from the main grid.

### 7. Pinned filter bar — add "Last Year" (LY) preset chip

User feedback: Tradervue's date-range presets are laid out more comprehensively. Smallest-step improvement that matches the user's request: add **Last Year** as a fifth pinned chip (Jan 1 – Dec 31 of the prior calendar year). The underlying `periodRange` entry `lastYear` already exists (`utils.js:294-298`).

In `src/components/Filters.vue`, update `periodPresets`:

```js
const periodPresets = [
    { value: 'last30Days',            label: '30d' },
    { value: 'lastThreeMonthsTilNow', label: '3M'  },
    { value: 'thisYear',              label: 'YTD' },
    { value: 'lastYear',              label: 'LY'  },   // ← NEW
    { value: 'all',                   label: 'All' }
]
```

No other changes needed — the existing `pickPeriod()` handler already looks up the matching `periodRange` entry by value and applies it.

Future polish (not in this spec): expanding the chip set toward Tradervue's full preset list (Today / Yesterday / This Week / Last Week / This Month / Last Month / Custom range) — defer to its own bundle if user wants. The current 5 chips (30d / 3M / YTD / LY / All) cover the most common reporting windows; adding more would crowd the bar.

## Behavior matrix

| Surface | Background coloring | Day cell layout | Week column | 12 mini-cals | Click target |
|---|---|---|---|---|---|
| `/calendar` main grid | None (neutral) | Tradervue (this spec) | Week N + $ | Always visible below | Day cell → /daily#day-{ts} |
| `/calendar` mini-cals | Existing green/red dots | Existing (compact) | None | (Self) | Month name → load that month |
| `/daily` mini-cal widget | Existing | Existing | None | None (only current) | Existing |
| Reports → Overview yearly heatmap | Existing | Existing | None | (12 mini-cals already) | None |

## Risk and rollback

- Surface area: 4 files (`Calendar.vue`, `calendar.js`, `Daily.vue`, `Filters.vue`) + CSS additions in `style-dark.css`. Component view `views/Calendar.vue` also touched (delete view-mode toggle).
- Key-iteration trap (the `__monthStartUnix` meta-key inside `calendarData`/`miniCalendarsData`) — three template iterator sites need `v-show`/`v-if` guards. Listed in the plan.
- Rollback: clean `git revert` of the single commit (or two if I split CSS).

## Acceptance criteria

1. On `/calendar`, every day cell with trades renders: day# top-left, big colored $ centered, "N trades" small below, satisfaction icon top-right when set.
2. Day cells with NO trades show only the day number top-left.
3. No green/red **background** tinting on main grid cells.
4. The Week column has a "Week" header in the same font as `Su/Mo/Tu/We/Th/Fr/Sa`. Each row shows `Week N` label + colored $.
5. Header above the grid: ◀ left, month name center (bold), monthly $ right-justified (colored) with trade count below.
6. Below the main grid, **all 12 mini-calendars are always visible in January-first → December-last order**. The currently-selected month has a visible "active" border/highlight. Clicking any mini-cal's month name (including the active one) sets that month into the main grid.
7. Clicking a day cell with trades navigates to `/daily` AND the matching day's card scrolls into view (smooth scroll).
8. Clicking a day cell without trades does nothing.
9. The 30/60/90/Yearly view-mode toggle is gone.
10. The P&L/Satisfaction toggle is gone from the Calendar pinned bar (still functions if re-enabled on another page).
11. **Pinned period chips on Dashboard and Reports show 5 buttons in this order: 30d · 3M · YTD · LY · All.** Clicking LY filters to Jan 1 → Dec 31 of the prior calendar year (e.g. clicking LY on 2026-05-06 produces 2025-01-01 → 2025-12-31).
12. Existing Calendar features still work: month nav arrows, Filters accordion, pinned Gross/Net pill.
13. No console errors on any of the above flows.

## Sequencing

This is a one-off refinement of Bundle 1 on its own branch (`feature/calendar-tradervue-redesign`). Once shipped and approved, merges back to `feature/reports-page` (or wherever the user prefers).
