# Lightspeed Import — Design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)

## Goal

Add Lightspeed as a selectable broker in TradeNote's import flow, ingesting
Lightspeed's **execution blotter** CSV (one row per fill) so trades reconstruct
with full analytics (entry/exit, P&L, timing, MFE/MAE, charts) like every other
execution-level broker.

## Background

Lightspeed offers two relevant exports:

- **Daily summary** (`*_cor_table_daily_summary.xls` / `*_daily_summcol.xls`) —
  aggregated per symbol per day (net/gross P&L, share counts, fees). No fills,
  prices, or timestamps. **Not used** — it cannot drive TradeNote's trade engine.
- **Execution blotter** (`*_table_execution_blotter.csv`) — one row per fill with
  symbol, side, quantity, price, and timestamp. **This is the import source.**

The daily-summary files are retained only as a verification oracle (see Testing).

TradeNote's pipeline expects each broker importer to push rows into the global
`tradesData` array. A shared engine (`createTempExecutions` → `createExecutions`
→ trade pairing in `addTrades.js`) then groups fills by trade date, pairs them
per symbol chronologically into round-trip trades, and computes all metrics. No
changes to that engine are required.

## File format

Lightspeed execution blotter CSV: 46 columns, header row, all values
double-quoted and space-padded. Sells carry a negative `Qty`. Leading-dot
decimals (e.g. `.3500`) parse correctly with `parseFloat`. May contain a trailing
empty line. A single file may span multiple trade dates.

Relevant columns: `Account Number`, `Currency Code`, `Security Type`, `Buy/Sell`,
`Symbol`, `Trade Date`, `Settlement Date`, `Price`, `Qty`, `Commission Amount`,
`Execution Time`, `Raw Exec. Time`, `Principal Amount`, `NET Amount`, `FeeSEC`,
`FeeTAF`.

## Field mapping

Each fill row maps to a `tradesData` entry:

| `tradesData` field | Source | Transform |
|---|---|---|
| `Account` | `Account Number` | trim |
| `T/D` | `Trade Date` | as-is (`MM/DD/YYYY`) |
| `S/D` | `Settlement Date` | as-is (`MM/DD/YYYY`) |
| `Currency` | `Currency Code` | trim (e.g. `USD`) |
| `Type` | `Security Type` | `equity` → `stock`; else `stock` fallback |
| `Side` | `Buy/Sell` | mapping below |
| `Symbol` | `Symbol` | trim |
| `SymbolOriginal` | `Symbol` | trim |
| `Qty` | `Qty` | `Math.abs(parseFloat(...))` |
| `Price` | `Price` | `parseFloat` |
| `Exec Time` | `Raw Exec. Time` | take time part after the space → `HH:MM:SS` |
| `Comm` | `Commission Amount` | `parseFloat` |
| `SEC` | `FeeSEC` | `parseFloat` |
| `TAF` | `FeeTAF` | `parseFloat` |
| `NSCC` | — | `0` |
| `Nasdaq` | — | `0` |
| `ECN Remove` | — | `0` |
| `ECN Add` | — | `0` |
| `Gross Proceeds` | computed | buy → `-(qty*price)`, sell → `+(qty*price)` |
| `Net Proceeds` | `NET Amount` | `-(parseFloat(NET Amount))` |
| `Clr Broker` | — | `""` |
| `Liq` | — | `""` |
| `Note` | — | `""` |

`qty` is the absolute fill size; `price` is the absolute fill price.

### Side mapping (`Buy/Sell` column)

Case-insensitive, substring-based for robustness against trailing padding:

- contains `short` and `sell`  → `SS` (open short)
- contains `short` and (`buy` or `cover`) → `BC` (cover short)
- contains `buy`  → `B` (open/add long)
- contains `sell` → `S` (close long)

Fallback if `Buy/Sell` is blank/unrecognized: use the plain `Side` column
(`B`/`S`) → `B` or `S`. (Shorts always carry explicit "Short" wording, so the
fallback only ever applies to longs.)

### Proceeds & fees rationale

- `Gross Proceeds` is recomputed from `qty*price` to match the existing broker
  convention (`brokers.js` Webull/Warrior) and stay self-consistent.
- `Net Proceeds = -(NET Amount)`. Lightspeed's `NET Amount` already nets every
  fee (commission, SEC, TAF, regulatory), so net P&L reconstructs **exactly**.
  Buys are positive principal in Lightspeed and negative cash-flow in TradeNote,
  hence the sign flip.
- Per the "net-accurate, simple fees" decision: only `Comm`, `SEC`, and `TAF`
  are itemized. Residual small reg/exchange fees are still reflected in net P&L
  via `Net Proceeds`, just not broken out in the fee report.

## Implementation

Three touch points, following the established one-function-per-broker pattern:

1. **`src/utils/brokers.js`** — add `export async function useBrokerLightspeed(param)`:
   - `Papa.parse(param, { header: true, skipEmptyLines: true })`
   - Validate required columns (`Symbol`, `Buy/Sell`, `Qty`, `Price`); throw a
     clear error if missing (so a wrong file — e.g. the daily summary — is
     rejected with a helpful message).
   - For each row: skip blanks, map per the table, push to `tradesData`.

2. **`src/stores/globals.js`** — add to the `brokers` array:
   ```js
   { value: "lightspeed", label: "Lightspeed", assetTypes: ["stocks"], autoSync: false }
   ```

3. **`src/utils/addTrades.js`**:
   - Import `useBrokerLightspeed` from `./brokers.js`.
   - Add `"lightspeed"` to `readAsTextArray` (it's a text CSV).
   - Add the dispatch block:
     ```js
     if (selectedBroker.value == "lightspeed") {
         await useBrokerLightspeed(fileInput).catch(error => importFileErrorFunction(error))
     }
     ```

No changes to the trade-pairing engine, reports, or UI beyond the dropdown entry.

## Edge cases

- **Negative `Qty` on sells** — handled via `Math.abs`.
- **Partial fills** (e.g. 25/38/75 shares) — handled by the engine's quantity
  accumulation; no special handling needed.
- **Multi-day files** — engine groups by `T/D`.
- **Interleaved scalps** (many in/out cycles per symbol/day) — engine pairs
  chronologically; each completed in/out cycle becomes one trade.
- **Trailing empty line / padded quotes** — `skipEmptyLines` + per-field trim.
- **Timezone** — execution times are passed naive; TradeNote applies the user's
  `timeZoneTrade` setting (same as all brokers). User must set their TradeNote
  timezone to match the timezone of the Lightspeed export.
- **Wrong file uploaded** (daily summary instead of blotter) — required-column
  validation rejects it with a clear message.

## Testing

Test-driven, using the user's real sample files as fixtures:

1. **Unit — field mapping:** parse the blotter sample; assert representative rows
   map correctly (side, abs qty, time extraction, gross/net signs).
2. **Integration — P&L oracle:** run the sample blotter through the importer +
   trade engine and assert reconstructed **per-symbol, per-day net P&L matches
   the daily-summary `.xls` files**:
   - 06/09: AZI `+64.60`, AHMA `-5.83`
   - 06/10 total `+85.53` (CLWT/DAIC/DSY/VSME/WCT)
   - 06/11 total `+37.73` (EDHL/FGL/PPCB/VELO)
3. **Robustness:** blank rows skipped; wrong-file (daily summary) rejected with
   a clear error; a synthetic short round-trip (SS→BC) reconstructs as a short.

## Out of scope

- Auto-sync / API integration (file upload only).
- Importing the daily-summary format as trades.
- Options/futures/forex from Lightspeed (equities only for now).
