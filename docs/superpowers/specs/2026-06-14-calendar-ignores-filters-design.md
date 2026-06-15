# Calendar Ignores Filters — Design

**Date:** 2026-06-14
**Status:** Approved

## Goal

The Calendar view should always display **all logged trades in the database**, never limited by any Filters-bar selection (date range, account, position, or tag).

## Background

TradeNote stores view filters in per-browser localStorage and applies them in one place — `loopTrades` ([src/utils/trades.js:158](../../../src/utils/trades.js#L158)) — for every page, including the Calendar. The Calendar's data window is set in `useGetSelectedRange` ([src/utils/utils.js:950](../../../src/utils/utils.js#L950)) to the selected year, and `useGetTrades` ([src/utils/trades.js:305](../../../src/utils/trades.js#L305)) bounds the Parse query by that range. `calendar.js` itself does not filter; it renders `filteredTrades` for the year of `selectedMonth`.

Result today: the Calendar is bounded to one year and is further narrowed by account/position/tag selections, so a stale or narrow filter hides logged trades.

## Decision

The Calendar ignores **all** filters (date range, account, position, tag). Other views (Dashboard, Daily, Reports) are unchanged and keep respecting filters.

## Implementation

Three edits, two files:

1. **`src/utils/utils.js`, `useGetSelectedRange` calendar branch.** Set `selectedRange = {start: 0, end: 0}` (the existing "all dates" sentinel) instead of the year bounds. The displayed year still derives from `selectedMonth`, which `calendar.js` uses independently, so year navigation is unchanged.

2. **`src/utils/trades.js`, `useGetTrades` else branch.** When `startD === 0 && endD === 0`, skip the `greaterThanOrEqualTo`/`lessThan` `dateUnix` bounds so the query returns all trades. Otherwise behave exactly as today. Keep `ascending("dateUnix")` and `limit(queryLimit.value)`.

3. **`src/utils/trades.js`, `loopTrades` include condition (line 158).** Short-circuit to include every trade when `pageId.value === "calendar"`, i.e. `if (pageId.value === "calendar" || (<existing condition>))`. This bypasses date + account + position + tag in a single place.

## Behavior

- On the Calendar, every logged trade is loaded and counted regardless of filter selections.
- The Calendar remains a one-year-at-a-time grid (its inherent design); navigating years browses history, and any year shown contains complete, unfiltered data.
- The Filters bar is still visible on the Calendar but has no effect there. (Optional future polish: grey it out on the calendar page. Out of scope.)

## Verification

No isolated unit test is practical — this path is tightly coupled to Parse/Vue/globals. Verify by: `node --check` on both files, a full `npm run build`, rebuilding the app image, and confirming in-app that the Calendar shows all years/accounts regardless of filter selections.

## Out of scope

- Disabling/hiding the Filters bar on the Calendar page.
- Any change to Dashboard/Daily/Reports filtering.
