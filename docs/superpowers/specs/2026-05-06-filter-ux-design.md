# Filter UX (Bundle 2 — 2A + 2C)

**Date:** 2026-05-06
**Branch:** `feature/reports-page`
**Status:** Spec — awaiting user review before plan

## Problem

Today the Filters component (`src/components/Filters.vue`) is an accordion: click "Filters" header → expand → adjust controls → click "Filter" button → page re-mounts. This is a 4-click sequence to do something as cheap as toggling Gross↔Net or jumping from "Last Week" to "Last 30 Days." The user reports this as a daily papercut.

## Goal

Eliminate the click cost for the highest-frequency filter changes by surfacing them as always-visible inline controls that apply on change. Bigger and rarer filter changes (custom date range, account selection, multi-tag selection) stay behind the existing accordion with the existing apply pattern.

## Scope

### In scope

1. **Pinned filter bar** — a single horizontal row of always-visible controls placed above the existing collapsible Filters section. Page-aware composition (different controls per page). Apply-on-change (no "Filter" button needed for pinned controls).
2. **Period preset chips on Dashboard and Reports** — instead of opening the dropdown to choose "Last 30 Days" / "This Year" / "All", these become one-tap chip buttons in the pinned bar. The existing dropdown (with all 16 period options) stays in the accordion for less-common ranges.
3. **Pinned Gross/Net** — a single pill toggle visible above the accordion on every page that has the gross/net filter (everywhere except Screenshots' specific layout, which doesn't apply here). One click flips it.
4. **Pinned P&L↔Satisfaction color toggle on Calendar** — already a single dropdown today; promotes to a pill toggle in the pinned bar since it's the second-most-frequent control on the Calendar page.

### Out of scope

- **Replacing the existing accordion entirely.** This would be a bigger rewrite (option 2B from the brainstorm). Deferred — let's see if 2A+2C reduces the daily papercut enough on its own first.
- **Removing or restructuring the existing controls inside the accordion.** They stay where they are. The pinned bar is purely additive.
- **New filter capabilities** (e.g., a "compare to prior period" toggle, multi-month selection, etc.). Not in this bundle.
- **Removing the "Filter" button** from inside the accordion. Some controls (date range, multi-tag) need a deliberate apply step. Keeping it.
- **Mobile redesign of the filter bar.** Will use existing Bootstrap responsive utilities (wrap on small screens) but not custom-design a separate mobile flow.

## Current state — anchors

- `src/components/Filters.vue:28-34` — the page-to-filters map:
  ```js
  let filters = ref({
      "dashboard": ["accounts", "periodRange", "grossNet", "positions", "timeFrame", "ratio", "tags"],
      "reports":   ["accounts", "periodRange", "grossNet", "positions", "tags"],
      "calendar":  ["month", "grossNet", "plSatisfaction"],
      "daily":     ["accounts", "month", "grossNet", "positions", "tags"],
      "screenshots": ["accounts", "grossNet", "positions", "tags"],
  })
  ```
- `src/components/Filters.vue:195-259` — `saveFilter()` persists all selections to `localStorage` and re-mounts the page (`useMountDashboard`, `useMountDaily`, `useMountReports`, `useMountCalendar`, `useRefreshScreenshot`).
- `src/components/Filters.vue:300-358` — the always-visible filter summary line (`Filters ↑ All accounts | Last Week | Gross data | ...`) and the accordion toggle.
- `src/components/Filters.vue:361+` — the `v-show="filtersOpen"` block containing all the controls and the green "Filter" apply button.
- `src/utils/utils.js:215-311` — `useGetPeriods()` populates `periodRange` with 17 entries (`all`, `last30Days`, `thisWeek`, `lastWeek`, `lastWeekTilNow`, `lastTwoWeeks`, `lastTwoWeeksTilNow`, `thisMonth`, `lastMonth`, `lastMonthTilNow`, `lastTwoMonths`, `lastTwoMonthsTilNow`, `lastThreeMonths`, `lastThreeMonthsTilNow`, `thisYear`, `lastYear`, `custom`). The pinned chips will reference a small subset of these by `value`.
- `src/stores/globals.js` — `selectedGrossNet`, `selectedPeriodRange`, `selectedDateRange`, `selectedPlSatisfaction`, `tempSelectedPlSatisfaction`, `amountCase`, `amountCapital` are the relevant reactives.

## Design

### Pinned bar layout

A single `<div>` placed at the top of the existing `<template>` in `Filters.vue`, **above** the existing card. It uses Bootstrap utility classes (`d-flex flex-wrap gap-2 align-items-center mb-2`) so controls wrap to a second line on narrow screens.

Layout per page:

| Page | Pinned controls (left → right) |
|---|---|
| Dashboard | [Gross / Net] · [Period chips: 30d · 3M · YTD · All] |
| Reports | [Gross / Net] · [Period chips: 30d · 3M · YTD · All] |
| Calendar | [Gross / Net] · [Color: P&L · Satisfaction] |
| Daily | [Gross / Net] |
| Screenshots | [Gross / Net] |

The accordion below remains identical to today. It still owns: account selection, custom date range pickers, full periodRange dropdown, month picker, multi-tag selection, position filter, timeframe, ratio, and the "Filter" apply button.

### Pinned controls — visual style

Each pinned control is a small btn-group of pill buttons:

```vue
<div class="btn-group btn-group-sm" role="group" aria-label="...">
    <button
        type="button"
        v-for="opt in options"
        :key="opt.value"
        :class="'btn ' + (selected === opt.value ? 'btn-primary' : 'btn-outline-secondary')"
        @click="onPick(opt.value)"
    >{{ opt.label }}</button>
</div>
```

The `btn-primary` style on the active option provides clear visual feedback. Existing Bootstrap dark-mode styles apply.

### Behavior — Gross / Net pill

```vue
<div class="btn-group btn-group-sm">
    <button :class="...selectedGrossNet === 'gross' ? primary : outline" @click="pickGrossNet('gross')">Gross</button>
    <button :class="...selectedGrossNet === 'net' ? primary : outline" @click="pickGrossNet('net')">Net</button>
</div>
```

`pickGrossNet(value)`:
1. Update `selectedGrossNet.value = value`.
2. Update `amountCase.value = value` and `amountCapital.value = value.charAt(0).toUpperCase() + value.slice(1)` (matching existing `saveFilter()` logic at lines 216-218).
3. Persist: `localStorage.setItem('selectedGrossNet', value)`.
4. Trigger page mount via the existing `applyAndMount()` helper (see "Helper extraction" below).

### Behavior — Period preset chips (Dashboard, Reports)

The pinned chips: **30d**, **3M**, **YTD**, **All**. They map to existing period values:

| Chip label | `periodRange` value | `periodRange.label` |
|---|---|---|
| 30d | `last30Days` | "Last 30 Days" |
| 3M | `lastThreeMonthsTilNow` | "Last Three Months Until Now" |
| YTD | `thisYear` | "This Year" |
| All | `all` | "All" |

`pickPeriod(value)`:
1. Find the entry in `periodRange` where `element.value === value` and assign to `selectedPeriodRange.value`.
2. Set `selectedDateRange.value = { start: selectedPeriodRange.value.start, end: selectedPeriodRange.value.end }` to keep the calendar-style date range in sync (matches the existing `inputDateRange` logic at lines 143-156).
3. Persist both: `localStorage.setItem('selectedPeriodRange', JSON.stringify(selectedPeriodRange.value))` and `localStorage.setItem('selectedDateRange', JSON.stringify(selectedDateRange.value))`.
4. Call `applyAndMount()`.

The accordion's existing `<select>` dropdown for `periodRange` stays — users can still pick less-common ranges like "Last Two Weeks" or "Last Year" from there.

### Behavior — P&L↔Satisfaction (Calendar)

Today this is a `<select>` inside the accordion that writes to `tempSelectedPlSatisfaction`, and `saveFilter()` copies temp → `selectedPlSatisfaction` on apply (lines 232-236). The pinned version skips the temp variable entirely — direct assign on click.

```vue
<div class="btn-group btn-group-sm">
    <button :class="...selectedPlSatisfaction === 'pl' ? primary : outline" @click="pickPlSatisfaction('pl')">P&amp;L</button>
    <button :class="...selectedPlSatisfaction === 'satisfaction' ? primary : outline" @click="pickPlSatisfaction('satisfaction')">Satisfaction</button>
</div>
```

`pickPlSatisfaction(value)`:
1. `selectedPlSatisfaction.value = value`.
2. `localStorage.setItem('selectedPlSatisfaction', value)`.
3. `applyAndMount()`.

### Helper extraction — `applyAndMount()`

Rather than calling `useMountDashboard` / `useMountReports` / `useMountCalendar` / `useMountDaily` / `useRefreshScreenshot` from each pinned-control handler (lots of branching), extract the mount-by-pageId switch from the bottom of `saveFilter()` into a small helper:

```js
async function applyAndMount() {
    if ((pageId.value === "dashboard" || pageId.value === "reports") && hasData.value) {
        useECharts("clear")
    }
    if (pageId.value === "dashboard") useMountDashboard()
    if (pageId.value === "daily") {
        await useMountDaily()
        useCheckVisibleScreen()
    }
    if (pageId.value === "screenshots") {
        await useRefreshScreenshot()
        useCheckVisibleScreen()
    }
    if (pageId.value === "calendar") useMountCalendar(true)
    if (pageId.value === "reports") useMountReports()
}
```

The existing `saveFilter()` (which the accordion's "Filter" button still calls) gets simplified to: persist all the temp values + accordion-only state, then call `applyAndMount()`. No behavior change for the accordion path.

### Pinned bar template — full skeleton

```vue
<!-- ── Pinned filter bar (always visible, apply-on-change) ─────────────── -->
<div class="col-12 mb-2" v-show="hasData">
    <div class="d-flex flex-wrap gap-2 align-items-center">

        <!-- Gross / Net (every page) -->
        <div
            v-show="filters[pageId] && filters[pageId].includes('grossNet')"
            class="btn-group btn-group-sm"
            role="group" aria-label="Gross or Net P&L"
        >
            <button type="button" :class="'btn ' + (selectedGrossNet === 'gross' ? 'btn-primary' : 'btn-outline-secondary')" @click="pickGrossNet('gross')">Gross</button>
            <button type="button" :class="'btn ' + (selectedGrossNet === 'net' ? 'btn-primary' : 'btn-outline-secondary')" @click="pickGrossNet('net')">Net</button>
        </div>

        <!-- Period chips (Dashboard + Reports) -->
        <div
            v-show="filters[pageId] && filters[pageId].includes('periodRange')"
            class="btn-group btn-group-sm"
            role="group" aria-label="Period preset"
        >
            <button
                type="button"
                v-for="preset in periodPresets"
                :key="preset.value"
                :class="'btn ' + (selectedPeriodRange && selectedPeriodRange.value === preset.value ? 'btn-primary' : 'btn-outline-secondary')"
                @click="pickPeriod(preset.value)"
            >{{ preset.label }}</button>
        </div>

        <!-- P&L / Satisfaction toggle (Calendar) -->
        <div
            v-show="filters[pageId] && filters[pageId].includes('plSatisfaction')"
            class="btn-group btn-group-sm"
            role="group" aria-label="Calendar color mode"
        >
            <button type="button" :class="'btn ' + (selectedPlSatisfaction === 'pl' ? 'btn-primary' : 'btn-outline-secondary')" @click="pickPlSatisfaction('pl')">P&amp;L</button>
            <button type="button" :class="'btn ' + (selectedPlSatisfaction === 'satisfaction' ? 'btn-primary' : 'btn-outline-secondary')" @click="pickPlSatisfaction('satisfaction')">Satisfaction</button>
        </div>

    </div>
</div>
```

The `periodPresets` constant (defined in `<script setup>`):

```js
const periodPresets = [
    { value: 'last30Days', label: '30d' },
    { value: 'lastThreeMonthsTilNow', label: '3M' },
    { value: 'thisYear', label: 'YTD' },
    { value: 'all', label: 'All' }
]
```

### Existing summary line — minor adjustment

The summary line above the accordion (today: "All accounts | Last Week | Gross data | ...") currently shows the full state. After this change, the same summary stays — but pieces that the user just changed via pinned controls will already be visible in the pinned chips/pills. Slight redundancy, but the summary covers the broader filter state (accounts, tags, positions, etc.) that aren't pinned, so it stays useful. **No change to the summary line.**

## Behavior matrix — what's pinned vs. what's still in accordion

| Filter | Pinned (above accordion) | In accordion |
|---|---|---|
| Gross / Net | ✅ on every applicable page | ✅ stays as well |
| Period preset (30d / 3M / YTD / All) | ✅ Dashboard + Reports | ✅ full dropdown stays for less-common ranges |
| Custom date range (start / end pickers) | ❌ | ✅ |
| P&L / Satisfaction color mode | ✅ Calendar | ❌ removed from accordion (single source of truth) |
| Accounts | ❌ | ✅ |
| Month picker (Daily, Calendar) | ❌ (already controlled by month nav arrows) | ✅ |
| Tags | ❌ (multi-select; too cluttered to pin) | ✅ |
| Positions | ❌ | ✅ |
| Timeframe (Dashboard) | ❌ | ✅ |
| Ratio (Dashboard) | ❌ | ✅ |

Note: the P&L/Satisfaction toggle moves *out* of the accordion (only one place to change it). Every other accordion control stays put.

## Risk and rollback

- **Surface area:** one file (`src/components/Filters.vue`). Per the behavior matrix the `plSatisfaction` `<select>` is removed from the accordion — single source of truth for that toggle now lives in the pinned bar. (Other accordion controls stay.)
- **Reactivity gotcha:** `selectedGrossNet`, `selectedPeriodRange`, etc. are `ref`s. Click handlers must use `.value =` to set them. Vue templates auto-unwrap refs, but the comparison classes need to be defensive (e.g., `selectedPeriodRange && selectedPeriodRange.value === preset.value`).
- **Edge case:** if `selectedPeriodRange.value === null` on first load (before `useGetPeriods()` resolves), the `null && null.value` short-circuit guards against crashes.
- **Mount loop concern:** apply-on-change calls `applyAndMount()` which re-renders the page. Rapid clicks (3 chip changes in 1 second) would cause 3 re-renders. Mitigation: keep mounts as-is — they're fast (~371ms observed for `useMountReports`), and rapid-clicking is not a realistic flow. Adding a debounce here would be premature.
- **Tour / onboarding:** the existing `Filters.vue:302` has `id="step10"` for the existing card. The pinned bar is inserted *above* it. The onboarding tour (Shepherd) keeps targeting the same element. No tour changes needed.
- **Rollback:** `git revert` on the single commit, no data implications.

## Acceptance criteria

1. On `/dashboard`, the area above the existing Filters card shows: a Gross/Net pill toggle and four period chips (30d, 3M, YTD, All).
2. On `/reports`, same as Dashboard: Gross/Net + period chips.
3. On `/calendar`, the pinned bar shows: Gross/Net + P&L/Satisfaction toggle. No period chips (Calendar uses month nav, not period range).
4. On `/daily`, the pinned bar shows only the Gross/Net toggle.
5. On `/screenshots`, the pinned bar shows only the Gross/Net toggle.
6. Clicking Gross or Net **immediately** re-renders the page (no Filter button click needed). The active button shows `btn-primary` styling.
7. On Dashboard or Reports, clicking a period chip (e.g., "30d") immediately re-renders the page with that period's date range applied. The active chip shows `btn-primary`.
8. On Calendar, clicking P&L or Satisfaction immediately switches the cell coloring mode.
9. The existing accordion still works: clicking the "Filters ↑" header toggles it open/closed. Inside, the full periodRange `<select>` dropdown still functions (for choosing e.g. "Last Two Weeks"). The "Filter" apply button still works for accordion-only changes (e.g., changing accounts and tags together).
10. The summary line on the accordion header (`All accounts | Last Week | Gross data | ...`) reflects the latest state regardless of whether the change came from a pinned control or the accordion.
11. No console errors on any of the above flows.
12. The pinned bar wraps to a second line on narrow viewports (Bootstrap `flex-wrap`).

## Sequencing

This is sub-project 3 of 4 in the agreed sequence: **3D ✅ → Bundle 1 ✅ → Bundle 2 (this) → Bundle 3A (MFE/MAE Trade Quality Report)**. Each is independently shippable.
