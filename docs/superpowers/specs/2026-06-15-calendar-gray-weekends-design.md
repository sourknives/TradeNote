# Calendar: Gray Out Weekends — Design

**Date:** 2026-06-15
**Status:** Approved

## Goal

Visually mute Saturday/Sunday columns on the Calendar (both the big month grid and the 12 mini-calendars) with a subtle gray, since they are never trading days.

## Background

Both calendar grids order columns Sunday→Saturday (header `days = ["Su",...,"Sa"]`). Weekend columns are index **0 (Sun)** and **6 (Sat)**:
- Big month grid: cells loop `(cell, ci) in week` → `ci` is the column.
- Mini-calendars: columns loop `(day, dIdx) in days` → `dIdx` is the column.

Calendar styles live in `src/assets/style-dark.css` (single theme). The big-grid cell background is normally transparent (`.tvCell`); P&L is shown via text color (`.tvAmount.tvWin/.tvLoss`), so a weekend background never conflicts there. Mini-cell P&L uses background classes (`.greenTradeDiv/.redTradeDiv`), so the weekend rule is scoped to not override them.

## Implementation

**`src/components/Calendar.vue`** (class bindings only):
1. Big-grid header row: `v-for="(day, di) in days"` and add `{ 'tvWeekendHeader': di === 0 || di === 6 }` to the header cell class.
2. Big-grid day cell: add `'tvWeekend': ci === 0 || ci === 6` to the cell's class object.
3. Mini-cal cell: add `'tvWeekendMini': dIdx === 0 || dIdx === 6` to the `calDivMini` class object.

**`src/assets/style-dark.css`** (subtle gray):
```css
/* Weekend (Sat/Sun) columns — non-trading days, muted */
.tvHeaderCell.tvWeekendHeader { opacity: 0.5; }
.tvCell.tvWeekend { background: rgba(255, 255, 255, 0.05); }
.tvCell.tvWeekend .tvDayNum { color: rgba(255, 255, 255, 0.4); }
.calDivMini.tvWeekendMini:not(.greenTradeDiv):not(.redTradeDiv) { background: rgba(255, 255, 255, 0.05); }
```

The `:not(...)` guard means a (hypothetical) weekend trade still shows its green/red P&L color rather than gray.

## Behavior

- Sat/Sun cells in both grids get a subtle gray fill; the Su/Sa big-grid headers are dimmed.
- Weekday cells, P&L coloring, the Gross/Net toggle, and all other behavior are unchanged.
- The shade is a one-line tweak in `style-dark.css` if the user wants it stronger/lighter.

## Verification

Full `npm run build` (compiles the `.vue`), tests still green, rebuild/redeploy; confirm in-app that weekend columns read as muted gray in both the big calendar and the mini-calendars, and weekday cells look unchanged.

## Out of scope

- Hiding weekends entirely (Mon–Fri layout).
- Any change to other views or data.
