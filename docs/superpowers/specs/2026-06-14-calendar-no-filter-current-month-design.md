# Calendar: No Filter Pane + Default to Current Month — Design

**Date:** 2026-06-14
**Status:** Approved

## Goal

1. Remove the Filters pane from the Calendar view entirely.
2. The Calendar always opens on the current month.

## Background

`views/Calendar.vue` renders `<Filters />` ([line 18](../../../src/views/Calendar.vue#L18)) and loads data via `useMountCalendar` in `onBeforeMount`. Filters.vue's `onBeforeMount` is empty, so the pane is purely controls UI; the calendar reads global refs (`selectedMonth`, `amountCase`) initialized at app login, not by Filters.

`selectedMonth` persists in localStorage and is mutated by the calendar's own navigation ([components/Calendar.vue:95-122](../../../src/components/Calendar.vue#L95)). Because the calendar restores the last-viewed month from that ref/localStorage, it does not reliably open on the current month.

The navigation handlers (`monthLastNext`, `jumpToMiniMonth`) call `useMountCalendar()` directly, so any current-month reset must live in the **view's** `onBeforeMount`, not inside `useMountCalendar` — otherwise prev/next navigation would snap back to the current month.

## Implementation

1. **Remove the Filters pane.** In `src/views/Calendar.vue`, delete the `<Filters />` tag and the `import Filters` line.
   - Consequence: the Gross/Net and P&L-vs-Satisfaction toggles (which live in the Filters pane) are no longer available on the Calendar; it renders using whatever mode is currently set on other views. Accepted per the requirement to remove the pane completely.

2. **Default to current month.** Add `useSetCalendarToCurrentMonth()` to `src/utils/utils.js`:
   ```js
   export function useSetCalendarToCurrentMonth() {
       selectedMonth.value = {
           start: Number(dayjs().tz(timeZoneTrade.value).startOf('month').unix()),
           end: Number(dayjs().tz(timeZoneTrade.value).endOf('month').unix())
       }
   }
   ```
   Call it in `views/Calendar.vue` `onBeforeMount` **before** `useMountCalendar()`. It sets the ref only (not localStorage), so the Daily page's remembered month is unaffected, and navigation within the calendar still works.

## Behavior

- The Calendar shows no Filters pane.
- Navigating to the Calendar route always lands on the current month (market time / ET).
- Prev / next / mini-month navigation works unchanged within the calendar.
- The Calendar continues to show all logged trades (from the earlier "calendar ignores filters" change).
- Dashboard, Daily, Reports, Screenshots keep their Filters pane and behavior.

## Verification

`node --check` on both files, full `npm run build`, rebuild/redeploy image, and confirm in-app: Calendar has no filter pane, opens on the current month, prev/next navigates correctly.

## Out of scope

- Keeping a standalone Gross/Net toggle on the Calendar.
- Any change to other views.
