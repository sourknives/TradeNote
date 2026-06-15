# Calendar: Restore Gross/Net Toggle, Drop Satisfaction — Design

**Date:** 2026-06-15
**Status:** Approved

## Goal

1. Restore a Gross/Net toggle on the Calendar (lost when the Filters pane was removed).
2. Remove satisfaction from the Calendar (the user does not track it); always color by P&L.

## Background

`components/Calendar.vue` reads `amountCase` reactively — computeds (`weeklyTotals`, `monthlyTotal`), `cellPL`, and cell class bindings all derive from `amountCase` at render time, and `calendar.js`/`useLoadCalendar` never bakes it in. So flipping `amountCase` updates the grid instantly with no refetch.

The same component is rendered on **both** the Calendar page (`pageId === 'calendar'`: main month grid + 12 mini-calendars) and as the Daily-page widget (`v-else` branch). Satisfaction (`selectedPlSatisfaction`, plus 👍/👎 icons) is used in the calendar-only paths *and* the Daily widget. Per the user, satisfaction is dropped from the Calendar only and left intact on Daily.

## Implementation (single file: `src/components/Calendar.vue`)

1. **Imports:** add `selectedGrossNet` and `amountCapital` to the globals import. **Keep** `selectedPlSatisfaction` — the Daily widget branch still uses it.

2. **Toggle handler** (script):
   ```js
   function pickGrossNetCalendar(value) {
       selectedGrossNet.value = value
       amountCase.value = value
       amountCapital.value = value.charAt(0).toUpperCase() + value.slice(1)
       localStorage.setItem('selectedGrossNet', value)
   }
   ```
   No remount needed; reactive bindings re-render. Uses the same `selectedGrossNet` localStorage key as the rest of the app, so the choice persists and stays consistent across views.

3. **Toggle UI:** a centered, calendar-only (`v-show="pageId === 'calendar'"`) text pill at the top of the template — two clickable spans, "Gross" / "Net", active one `fw-bold`, inactive `dashInfoTitle` (muted) — matching the calendar header's text/icon style.

4. **Drop satisfaction from the Calendar (calendar-only paths):**
   - Remove the 👍/👎 `<i>` icons in the main month grid (current lines 181-184).
   - Mini-calendar coloring (current lines 259-260): replace `selectedPlSatisfaction == 'pl' ? <P&L> : <satisfaction>` with the **P&L-only** condition.
   - Remove the 👍/👎 `<i>` icons in the mini-calendars (current lines 264-269).
   - **Leave the Daily-page `v-else` branch untouched** (lines ~212-236), including its satisfaction coloring and icons.

## Behavior

- Calendar shows a Gross/Net toggle; clicking re-colors and re-values the grid and mini-calendars instantly; choice persists.
- Calendar always colors by P&L regardless of any stale `selectedPlSatisfaction` value; no satisfaction icons on the Calendar.
- Daily page satisfaction is unchanged. Filter pane still absent; calendar still opens on current month and shows all trades.

## Verification

Full `npm run build` (compiles the `.vue`), tests still green, rebuild/redeploy; confirm in-app: toggle flips Gross↔Net and recolors, persists across a reload, and no thumbs/satisfaction remain on the Calendar.

## Out of scope

- Removing satisfaction from the Daily page or elsewhere.
- Any data/other-view changes.
