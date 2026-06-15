# Calendar: Make Whole Mini-Calendar Clickable — Design

**Date:** 2026-06-15
**Status:** Approved

## Goal

Clicking anywhere in a year-at-a-glance mini-calendar (not just its month-name header) jumps to that month in the big grid.

## Background

Each mini-calendar ([Calendar.vue:263-291](../../../src/components/Calendar.vue#L263)) is an outer tile → inner `row me-2` container (holds the `tvMiniCalActive` blue border) → `tvMiniCalHeader` (the only element wired to `jumpToMiniMonth(calData)`) → day grid. The mini-cal day cells have no click handlers, so there is no conflict moving the click up to the container.

## Implementation

**`src/components/Calendar.vue`:**
- Move `v-on:click="jumpToMiniMonth(calData)"` from the `tvMiniCalHeader` div to the inner `row me-2` container, and add a `tvMiniCalTile` class to that container.
- Remove the now-redundant click from the header (keep its existing classes/hover styling).

**`src/assets/style-dark.css`:**
```css
.tvMiniCalTile { cursor: pointer; border-radius: 4px; }
.tvMiniCalTile:hover { background: rgba(255, 255, 255, 0.03); }
```
Background-only hover → no layout shift; signals the whole tile is clickable.

## Behavior

- Click anywhere within any of the 12 mini-calendars to load that month into the big grid.
- The whole tile triggers the existing "load month" action (not a per-day jump).
- Everything else (active highlight, weekend gray, gross/net, etc.) unchanged.

## Verification

Full `npm run build`, tests green, rebuild/redeploy; confirm clicking different areas of a mini-cal (header, day grid, empty space) all jump to that month, and the cursor/hover reads as clickable.

## Out of scope

- Per-day click-through from a mini-calendar to a specific Daily date.
