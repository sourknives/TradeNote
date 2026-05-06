# TradeNote ↔ Tradervue Gap Analysis & 2nd-Iteration Roadmap

**Date:** 2026-05-06
**Branch:** `feature/reports-page`
**Status:** Findings doc — not a single-bundle spec. Each section below is a candidate for its own future spec.

This document captures (a) three concrete bugs surfaced during today's work, (b) a feature-by-feature comparison against Tradervue, and (c) a prioritized roadmap with effort estimates. Use it to pick what gets the next iteration.

---

## Part 1 — Three concrete bugs found today

### Bug A: Chronic `'icon' undefined` Vue render error (every page load)

- **Source:** `src/components/Nav.vue:192` and `:196` — `pages.filter(item => item.id == pageId)[0].icon` throws when `pageId.value` doesn't appear in the local `pages` array.
- **Why it fires:** the `pages` array (`Nav.vue:12-`) is missing entries for `reports`, `imports`, `checkout`, `checkoutSuccess`. Since the `feature/reports-page` branch added the Reports route without updating `Nav.vue`, navigation to `/reports` throws on every render.
- **Side effects:** the error is non-fatal (Vue catches and continues), but it pollutes the console and may abort sibling renders inside the same Vue update cycle. Modal flows on Daily that depend on a clean render cycle are suspect.
- **Fix scope:** ~10 lines in one file.
- **Fix:** add the missing entries; defensively use `find()` with a fallback in the template:
  ```vue
  <i v-if="pages.find(p => p.id === pageId)" v-bind:class="(pages.find(p => p.id === pageId)).icon" class="me-1"></i>
  {{ (pages.find(p => p.id === pageId) || {name: ''}).name }}
  ```
  Plus add `{ id: 'reports', name: 'Reports', icon: 'uil uil-chart-bar' }`, `{ id: 'imports', name: 'Imports', icon: 'uil uil-upload' }`, etc.
- **Effort:** 15 min (XS).

### Bug B: Calendar day-cell text cutoff

- **Source:** `src/assets/style-dark.css:807-815` — at `min-width: 768px`, `.calDivDash` is sized `height: 90px; width: 40px; padding: 1em`. The 16px-each-side padding eats ~32px of the 90px height, leaving ~58px usable. With three lines (day number + "N trades" + "$XXX") and ~14px line-height, content overflows the bottom edge and is clipped.
- **Why "width: 40px"** never matters: cells are inside Bootstrap `col` containers that stretch; the fixed width has no effect (overridden by flex). Code smell, not a render bug.
- **Fix scope:** 3 CSS values in one file.
- **Fix:**
  ```css
  @media (min-width: 768px) {
      .calDivDash {
          margin: 1px;
          border: 1px solid lightgray;
          height: 110px;       /* was 90px — needs more room with weekly-total column too */
          padding: 0.4em;      /* was 1em — too aggressive */
          /* width removed — let the parent col control width */
      }
  }
  ```
- **Effort:** 5 min (XS). Could ship same commit as Bug A.

### Bug C: Polygon → Massive — diagnostic, not fix

- **Status:** Polygon.io rebranded to Massive.com on **2025-10-30** (per [Polygon.io is Now Massive](https://massive.com/blog/polygon-is-now-massive)). Per their own announcement, "APIs, accounts, and integrations continue to work without interruption" — the `https://api.polygon.io/v2/aggs/ticker/...` endpoints used in `addTrades.js:720` and `Daily.vue:721` should still resolve.
- **User has key configured:** localStorage shows `apis: [{provider: 'polygon', keyLen: 32}]`.
- **Why charts may not appear:** the candlestick fetches inside the Daily-trade modal, which is reached via a Bootstrap modal dialog. During today's testing, clicking a trade card on `/daily` did not visibly open a modal — likely the chronic Bug A render error in the Vue update cycle is interfering (the modal's onMount + the `bs-toggle="modal"` data-attributes both depend on a clean render). If we fix Bug A first, the Polygon path is highly likely to work as-is.
- **Verification path:** after Bug A fix, click a trade on `/daily`, watch DevTools Network for `api.polygon.io/v2/aggs/...` request + 200 response, then watch the modal for the candlestick.
- **Future-proofing (Tradervue-mimic territory):**
  - Rename "Polygon" labels in Settings UI → "Massive (formerly Polygon)" for clarity.
  - Optionally add a config switch for the new `api.massive.com` domain when/if Massive deprecates the polygon.io subdomain.
- **Effort:** Diagnostic done. Suspected fix is Bug A cascade. **Re-test after Bug A.** If still broken, separate bug. Effort to re-test: 5 min.

---

## Part 2 — Tradervue feature inventory and gap analysis

Tradervue's public marketing material plus generally-known features (trade replay, mistakes tagging, etc.) compared against TradeNote's current state on this branch.

Legend:
- 🟢 = TradeNote has parity or near-parity
- 🟡 = TradeNote has it but weaker than Tradervue
- 🔴 = TradeNote does not have it

### 2.1 — Reports module

| Tradervue feature | TradeNote status | Notes |
|---|---|---|
| Time-of-day P&L analysis | 🟢 Parity | Detailed → Days/Times → "P&L by Hour" + "Performance by Hour". Could go finer-grained for first 30 min (Bundle 3B). |
| Symbol profitability | 🟢 Parity | Detailed → Instruments table. |
| Win-rate / profit factor / streaks | 🟢 Parity | Detailed tab covers these. |
| **Exit performance vs. best potential P/L (MFE %)** | 🔴 Missing | Tradervue's signature report. Data IS captured (`excursion`, MFE prices stored) but no surfacing. **This is Bundle 3A in the agreed sequence.** |
| MAE / stop-adherence analysis | 🔴 Missing | Same data substrate as above. |
| Equity curve | 🟢 Parity | Cumulative P&L chart on Reports → Overview + Dashboard. |
| Drawdown analysis | 🟢 Parity | Reports → Drawdown tab (just unblocked today via 3D fix). |
| K-Ratio / SQN / Kelly% | 🟢 Tradervue doesn't even ship these | Reports → Detailed stats grid. Differentiator FOR TradeNote. |
| Tag/setup breakdown | 🟢 Parity | Reports → Tag Breakdown tab. |
| Compare A vs B (filter sets) | 🟢 Parity | Reports → Compare tab. |
| Period comparison ("this month vs last month") | 🟡 Weaker | Compare is filter-set based; period-over-period would need its own preset. Small lift. |
| Goal tracking (P/L target vs actual) | 🔴 Missing | No goal entity exists. |

### 2.2 — Trade list, filters, calendar

| Tradervue feature | TradeNote status | Notes |
|---|---|---|
| Calendar heatmap (monthly P/L) | 🟢 Parity (now Sun-first, weekly column, monthly total — Bundle 1) |  |
| Yearly heatmap | 🟢 Parity | Reports → Overview → Calendar sub-tab. |
| Trade list with quick-filter | 🟡 Weaker | TradeNote uses an accordion (now improved by Bundle 2 pinned chips). Tradervue has dedicated filter chips inline at all times. |
| Saved filter views | 🔴 Missing | Tradervue lets you save named filter combos ("Long mornings", "Small caps over $5") and switch between them. |

### 2.3 — Trade detail modal & charts

| Tradervue feature | TradeNote status | Notes |
|---|---|---|
| Per-trade candlestick chart | 🟢 Parity (when working) | Polygon/Massive integration exists; suspected blocked by Bug A. |
| **Trade replay** (animated entry/exit on chart with timeline scrubber) | 🔴 Missing | Tradervue's iconic differentiator. Animated playback of executions over the chart, with a Play / Pause / Speed control. |
| Multi-execution position rollup | 🟡 Weaker | TradeNote has `executions` per trade but UI only shows single entry/exit price. Tradervue rolls up multi-execution positions to a clear VWAP entry/exit. |
| Chart annotations (drawings, levels) | 🔴 Missing | Tradervue uses TradingView; TradeNote uses raw ECharts. |
| Multi-timeframe chart switching | 🔴 Missing | TradeNote fetches 1-minute bars only. Tradervue lets you switch 1m/5m/15m/1h/D. |

### 2.4 — Journaling & reflection

| Tradervue feature | TradeNote status | Notes |
|---|---|---|
| Per-trade notes | 🟢 Parity | `tradeNote` reactive + Daily modal. |
| Per-day diary | 🟢 Parity | Diary tab. |
| Satisfaction tracking | 🟢 Parity (better) | TradeNote has 👍/👎 per day AND per trade. Tradervue's flavor is more like "mistake tags." |
| **Mistake tagging** | 🔴 Missing | Tradervue's "Mistakes" is a structured taxonomy ("Chased entry", "Moved stop", "Held too long") with a dedicated report showing $$ impact of each mistake. TradeNote has free-text tags but no canonical mistake taxonomy. |
| Trade screenshots | 🟢 Parity | Screenshots tab + Markerjs2 annotations. |
| Lesson-of-the-trade prompt | 🔴 Missing | Tradervue has a "What did I learn?" field on each trade; surfaces in periodic review. |

### 2.5 — Setups / Playbooks

| Tradervue feature | TradeNote status | Notes |
|---|---|---|
| Free-text playbook | 🟢 Parity | Playbook tab. |
| **Structured setups with named criteria** | 🔴 Missing | Tradervue's Playbook has named setups with entry rules / exit rules / examples; trades can be linked to a setup. TradeNote's playbook is just rich-text notes. |
| Per-setup performance reports | 🟡 Weaker | TradeNote has Tag Breakdown which is the foothold; user already uses tags like `reversal`, `micro_pullback`, `1m_pullback` (matches Tradervue's setup convention). Step from "tag breakdown" to "setup with criteria checklist" is real but moderate work. |

### 2.6 — Imports & data

| Tradervue feature | TradeNote status | Notes |
|---|---|---|
| Broker import (80+ brokers per Tradervue) | 🟡 Partial | TradeNote supports a handful (TradeStation, Tradovate, TopstepX, Webull, Warrior Trading SIM, manual CSV). Adding more is incremental. |
| Auto-import / scheduled sync | 🔴 Missing | Tradervue can pull broker data automatically on a schedule. TradeNote is manual upload. |
| Multi-account aggregation | 🟢 Parity | Account selector exists. |
| Market data API (Polygon/Massive, Databento) | 🟢 Parity (when Bug A is fixed) |  |

### 2.7 — Sharing, mentoring, social

| Tradervue feature | TradeNote status | Notes |
|---|---|---|
| Public trade share link | 🔴 Missing | "Share this trade" produces a public URL. |
| Mentor / coach view | 🔴 Missing | A user can grant a mentor read-only access. |
| Trader feed / following | 🔴 Missing | Social feature. |

### 2.8 — Goals, motivation, accountability

| Tradervue feature | TradeNote status | Notes |
|---|---|---|
| Weekly/monthly P/L goal | 🔴 Missing | Set a goal, track progress to date. |
| Streak tracking (consecutive green days) | 🟡 Weaker | Stats include max consecutive wins/losses, but no UI nudge or live counter. |
| Daily review prompts | 🔴 Missing | Tradervue nudges you to journal. |
| Discipline score | 🔴 Missing | Aggregate metric of "did I follow my plan" derived from satisfaction + setup adherence. |

### 2.9 — Polish / DX

| Tradervue feature | TradeNote status | Notes |
|---|---|---|
| Mobile-friendly | 🟡 Weaker | TradeNote uses responsive Bootstrap but several charts/grids feel desktop-first. |
| Dark mode | 🟢 Parity | Already dark by default. |
| Keyboard shortcuts | 🔴 Missing | Tradervue has `j` / `k` for prev/next trade, etc. |
| Undo / soft-delete | 🟡 Weaker | TradeNote has popover delete confirmation but no undo. |

---

## Part 3 — Prioritized roadmap with effort estimates

Effort scale: **XS** = <1 hr · **S** = 1–4 hrs · **M** = 4–16 hrs · **L** = 16–40 hrs · **XL** = >40 hrs.

### Tier 1 — Ship next (highest user value per hour)

| # | Item | Effort | Why high priority |
|---|---|---|---|
| 1 | **Bug A** — Nav.vue `'icon'` fix | XS | 10-line fix, kills a chronic console error, likely unblocks the Polygon candlestick chart (Bug C) as a side effect. |
| 2 | **Bug B** — Calendar text cutoff CSS | XS | Visual polish on the surface you just made the home page. 5-min change. |
| 3 | **Bug C re-test** — Polygon/Massive after A is fixed | XS | If trades still don't show charts, opens its own debugging branch. |
| 4 | **Bundle 3A — MFE/MAE Trade Quality Report** (already in agreed sequence) | M | Tradervue's signature feature. Data is captured; no surface yet. Highest report-side leverage for momentum traders. |

**Tier 1 total: ~M** (mostly the Bundle 3A work; bugs are sub-hour).

### Tier 2 — High-leverage Tradervue catch-up

| # | Item | Effort | Notes |
|---|---|---|---|
| 5 | **Trade Replay** (animated execution timeline on the candlestick) | M-L | Tradervue's iconic feature. Build on existing ECharts candlestick + `executions` array. ECharts has built-in `markPoint` and animation primitives. ~2-day spike. |
| 6 | **Mistake taxonomy + Mistakes report** | S-M | Add a `mistakes` collection (typed enum: `chased_entry`, `moved_stop`, `cut_winner_short`, `held_loser`, …). Quick-tag UI in Daily modal. New report tab showing $$ impact per mistake type. |
| 7 | **Saved filter views** | S | Persist filter combos by name to localStorage; switcher dropdown in the pinned bar. Builds directly on Bundle 2's pinned bar. |
| 8 | **Period-over-period comparison preset** | S | Extend the existing Compare tab with a "vs prior period" preset. Most of the engine already exists. |
| 9 | **Multi-timeframe chart switcher** (1m / 5m / 15m / 1h / D) | M | Already fetching 1m from Polygon/Massive; Polygon supports all timeframes via the `range/{multiplier}/{timespan}` URL. Aggregator stays the same. |
| 10 | **First-N-minutes / Open-hour focus charts** (originally Bundle 3B candidate) | S | Specifically valuable for small-cap momentum. 5-min buckets 09:30-10:30. New chart on Detailed tab. |

**Tier 2 total: M-L per item; ~3-4 weeks if you ship them serially.**

### Tier 3 — Structured setups & discipline (deeper product work)

| # | Item | Effort | Notes |
|---|---|---|---|
| 11 | **Structured Setup Library** (named setups w/ entry/exit criteria, link trades) | L | Tradervue parity for Playbook. New "Setup" entity (Parse class), CRUD UI, link-from-trade flow, per-setup performance pages. |
| 12 | **Discipline Score** (aggregate satisfaction + setup adherence + mistake count) | M | Depends on #11 + Mistakes (#6). Single number per day/week. |
| 13 | **Weekly/Monthly Goal tracking** | M | New entity, simple UI. |
| 14 | **Auto-import from broker on schedule** | XL | Per-broker; broker APIs vary widely. Probably not worth chasing parity. |
| 15 | **Lesson-of-trade prompt + periodic review surface** | S | Adds a `lesson` field to trade; aggregates into a Reports tab. |

### Tier 4 — Nice-to-haves / sharing

| # | Item | Effort |
|---|---|---|
| 16 | Public/private trade share links | M-L |
| 17 | Mentor/coach read-only view | XL |
| 18 | Keyboard shortcuts (`j`/`k` for prev/next trade) | S |
| 19 | Mobile re-layout for Reports tabs | M |
| 20 | Multi-execution VWAP rollup display | S |

### Tier 5 — Probably skip (Tradervue advantage but low marginal value for this user)

- TradingView chart embed (TradeNote's ECharts is functional; TradingView would require iframes and licensing)
- Trader social feed
- 80+ broker integrations (incremental, not a coherent project)

---

## Part 4 — Recommended next steps

Given the agreed sequence is **3D ✅ → Bundle 1 ✅ → Bundle 2 ✅ → Bundle 3A**, the cleanest path is:

1. **Quick patch sweep** (Bug A + Bug B + re-test C) — one small spec, ~30 min total. Ship before 3A so the Reports surface is clean for the next big build.
2. **Bundle 3A — MFE/MAE Trade Quality Report** as planned. This delivers the single biggest Tradervue gap closure (exit performance vs. best potential P/L) for this user's style.
3. **Pick 2-3 from Tier 2** for an "iteration 2" sprint. My picks based on effort × impact:
   - **#7 Saved filter views** — small win, builds on Bundle 2.
   - **#5 Trade Replay** — biggest "wow" feature; differentiator.
   - **#10 Open-hour focus** — fits the user's small-cap momentum style perfectly.

Tier 3 (structured setups, discipline score) is worth doing but not before Tier 1 + 2 ship.

## Sequencing

This is a meta-document, not a single sub-project spec. The next concrete deliverable is the **quick patch sweep** spec (covers Bugs A, B, C re-test). After that, Bundle 3A begins per the originally agreed sequence.

## Sources

- Tradervue feature inventory drawn from [tradervue.com](https://www.tradervue.com/) (public marketing) and general product knowledge.
- Polygon → Massive rebrand: [Polygon.io is Now Massive](https://massive.com/blog/polygon-is-now-massive) (effective 2025-10-30; APIs continue working).
