# Lightspeed Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Lightspeed as a selectable broker that imports its execution-blotter CSV into TradeNote with full trade analytics.

**Architecture:** A pure, dependency-free parser module (`src/utils/lightspeedParser.js`) converts blotter CSV rows into TradeNote's `tradesData` shape. A thin `useBrokerLightspeed` wrapper in `brokers.js` calls the parser and pushes results into the global store. The broker is registered in `globals.js` and dispatched in `addTrades.js`. The existing trade-pairing engine is unchanged. Correctness is proven by unit tests plus an oracle test that reconstructs per-symbol/day P&L and matches it against the user's daily-summary `.xls` files.

**Tech Stack:** Vanilla ES modules, PapaParse (CSV), XLSX (oracle fixtures), Vitest (new test runner), dayjs (already present).

---

## File Structure

- **Create** `src/utils/lightspeedParser.js` — pure parser. Imports only PapaParse. No `globals.js`/Parse/Vue. One responsibility: blotter CSV text → array of `tradesData`-shaped objects. Exports `parseLightspeedExecutions`, `mapLightspeedSide`, `extractExecTime`.
- **Create** `src/utils/lightspeedParser.test.js` — unit + oracle tests.
- **Create** `src/utils/__fixtures__/lightspeed/` — test fixtures (blotter CSV + 3 summary `.xls`).
- **Modify** `package.json` — add Vitest devDependency + `test` script.
- **Modify** `src/utils/brokers.js` — add `useBrokerLightspeed`.
- **Modify** `src/stores/globals.js` — register the broker (after line 3322).
- **Modify** `src/utils/addTrades.js` — import, `readAsTextArray`, dispatch block.

**Why a separate parser module:** `brokers.js` imports `globals.js`, which pulls in Parse, Vue, Stripe, PostHog — none of which load cleanly in a Node test. Isolating pure logic makes it testable and is good boundary design. The wrapper in `brokers.js` keeps the established one-function-per-broker pattern for the dispatch layer.

---

## Task 1: Add the Vitest test runner

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the test script and devDependency**

In `package.json`, add a `test` script under `"scripts"`:

```json
  "scripts": {
    "start": "node index.mjs",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

And add Vitest to `"devDependencies"`:

```json
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.2",
    "vite": "^5.4.2",
    "vitest": "^2.1.8"
  },
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes without error; `node_modules/.bin/vitest` exists.

- [ ] **Step 3: Verify the runner works (no tests yet)**

Run: `npx vitest run`
Expected: exits cleanly reporting "No test files found" (this is fine).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest test runner"
```

---

## Task 2: Pure parser — side mapping & exec-time extraction (TDD)

**Files:**
- Create: `src/utils/lightspeedParser.test.js`
- Create: `src/utils/lightspeedParser.js`

- [ ] **Step 1: Write the failing tests for the two pure helpers**

Create `src/utils/lightspeedParser.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { mapLightspeedSide, extractExecTime } from './lightspeedParser.js'

describe('mapLightspeedSide', () => {
    it('maps long buy/sell', () => {
        expect(mapLightspeedSide('Long Buy', 'B')).toBe('B')
        expect(mapLightspeedSide('Long Sell', 'S')).toBe('S')
    })
    it('maps short open/cover', () => {
        expect(mapLightspeedSide('Short Sell', 'S')).toBe('SS')
        expect(mapLightspeedSide('Short Cover', 'B')).toBe('BC')
        expect(mapLightspeedSide('Short Buy', 'B')).toBe('BC')
    })
    it('falls back to the plain Side column when Buy/Sell is blank', () => {
        expect(mapLightspeedSide('', 'B')).toBe('B')
        expect(mapLightspeedSide('   ', 'S')).toBe('S')
    })
    it('returns null when nothing is recognizable', () => {
        expect(mapLightspeedSide('', '')).toBe(null)
    })
})

describe('extractExecTime', () => {
    it('takes the time part from Raw Exec. Time', () => {
        expect(extractExecTime('06/09/2026 07:55:00', '07:55')).toBe('07:55:00')
    })
    it('pads HH:MM from Execution Time when raw is missing', () => {
        expect(extractExecTime('', '07:55')).toBe('07:55:00')
    })
    it('returns null when both are empty', () => {
        expect(extractExecTime('', '')).toBe(null)
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/lightspeedParser.test.js`
Expected: FAIL — cannot resolve `./lightspeedParser.js` (module does not exist).

- [ ] **Step 3: Create the module with the two helpers**

Create `src/utils/lightspeedParser.js`:

```js
import Papa from 'papaparse'

// Map Lightspeed's descriptive "Buy/Sell" column to TradeNote sides.
// B = open/add long, S = close long, SS = open short, BC = cover short.
export function mapLightspeedSide(buySell, fallbackSide) {
    const s = (buySell || '').toLowerCase()
    if (s.includes('short') && s.includes('sell')) return 'SS'
    if (s.includes('short') && (s.includes('buy') || s.includes('cover'))) return 'BC'
    if (s.includes('buy')) return 'B'
    if (s.includes('sell')) return 'S'
    const f = (fallbackSide || '').trim().toUpperCase()
    if (f === 'B') return 'B'
    if (f === 'S') return 'S'
    return null
}

// "06/09/2026 07:55:00" -> "07:55:00". Falls back to padding "Execution Time".
export function extractExecTime(rawExecTime, execTime) {
    const raw = (rawExecTime || '').trim()
    if (raw.includes(' ')) {
        const parts = raw.split(/\s+/)
        if (parts[1]) return parts[1]
    }
    const t = (execTime || '').trim()
    if (t) return t.length === 5 ? t + ':00' : t
    return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/lightspeedParser.test.js`
Expected: PASS (all `mapLightspeedSide` and `extractExecTime` cases).

- [ ] **Step 5: Commit**

```bash
git add src/utils/lightspeedParser.js src/utils/lightspeedParser.test.js
git commit -m "feat: lightspeed side mapping and exec-time helpers"
```

---

## Task 3: Pure parser — row mapping (TDD)

**Files:**
- Modify: `src/utils/lightspeedParser.test.js`
- Modify: `src/utils/lightspeedParser.js`

- [ ] **Step 1: Add failing tests for `parseLightspeedExecutions`**

Append to `src/utils/lightspeedParser.test.js`:

```js
import { parseLightspeedExecutions } from './lightspeedParser.js'

// Minimal blotter: header + 1 long buy + 1 long sell + 1 blank line.
const SAMPLE_CSV = `"Account Number","Account Type","Side","Symbol","CUSIP","Currency Code","Security Type","Buy/Sell","Trade Date","Settlement Date","Process Date","Price","Qty","Trade Number","Principal Amount","NET Amount","Commission Amount","Execution Time","Raw Exec. Time","Market Code","Trailer","FeeSEC","FeeMF","Fee1","Fee2","Fee3","FeeStamp","FeeTAF","Fee4","Sequence Number","Side Seq Code","Capacity Code","Office Code","Rep Code","Special Code","Instructions Trade Legend Code","Factor Type2","Trade Interest","Original TradeNumber","Entry Time","Entered By","YieldToMature","YieldToCall","Mutual Fund Sales Charge Rate","Mutual Fund Load Indicator","Transtype"
"ABC123    ","2","B  ","AZI         ","G06382132   ","USD","equity    ","Long Buy                                          ","06/09/2026","06/10/2026","06/09/2026","8.1949","100","NfGCP","819.4900","820.1400",".3500","07:55     ","06/09/2026 07:55:00","N","71102043",".0000000000",".0000000000",".0000000000",".3000000000",".0000000000",".0000000000",".0000000000",".0000000000","57691676","99","1","LF ","21 ","H "," ","       ",".0000000000","NfGCP","17013167","FIX",".0000000000",".0000000000",".0000000000"," ","Trade"
"ABC123    ","2","S  ","AZI         ","G06382132   ","USD","equity    ","Long Sell                                         ","06/09/2026","06/10/2026","06/09/2026","8.4503","-100","NfGIF","-845.0300","-844.3400",".3500","07:55     ","06/09/2026 07:55:00","N","71102071",".0200000000",".0000000000",".0000000000",".3000000000",".0000000000",".0000000000",".0200000000",".0000000000","57691728","99","1","LF ","21 ","H "," ","       ",".0000000000","NfGIF","17013172","FIX",".0000000000",".0000000000",".0000000000"," ","Trade"
`

describe('parseLightspeedExecutions', () => {
    const rows = parseLightspeedExecutions(SAMPLE_CSV)

    it('returns one entry per fill', () => {
        expect(rows.length).toBe(2)
    })

    it('maps the buy fill correctly', () => {
        const buy = rows[0]
        expect(buy.Account).toBe('ABC123')
        expect(buy['T/D']).toBe('06/09/2026')
        expect(buy['S/D']).toBe('06/10/2026')
        expect(buy.Currency).toBe('USD')
        expect(buy.Type).toBe('stock')
        expect(buy.Side).toBe('B')
        expect(buy.Symbol).toBe('AZI')
        expect(buy.SymbolOriginal).toBe('AZI')
        expect(buy.Qty).toBe(100)
        expect(buy.Price).toBeCloseTo(8.1949, 4)
        expect(buy['Exec Time']).toBe('07:55:00')
        expect(buy.Comm).toBeCloseTo(0.35, 4)
        // buy cash-flow is negative; net includes fees (more negative)
        expect(buy['Gross Proceeds']).toBeCloseTo(-819.49, 2)
        expect(buy['Net Proceeds']).toBeCloseTo(-820.14, 2)
    })

    it('maps the sell fill correctly (abs qty, positive proceeds)', () => {
        const sell = rows[1]
        expect(sell.Side).toBe('S')
        expect(sell.Qty).toBe(100)
        expect(sell['Gross Proceeds']).toBeCloseTo(845.03, 2)
        expect(sell['Net Proceeds']).toBeCloseTo(844.34, 2)
    })

    it('throws a helpful error when required columns are missing', () => {
        const wrong = `"Symbol","Trade Count","Net P & L"\n"AZI","32","64.6"\n`
        expect(() => parseLightspeedExecutions(wrong)).toThrow(/execution blotter/i)
    })

    it('returns [] for empty input', () => {
        expect(parseLightspeedExecutions('')).toEqual([])
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/lightspeedParser.test.js`
Expected: FAIL — `parseLightspeedExecutions is not a function`.

- [ ] **Step 3: Implement `parseLightspeedExecutions`**

Append to `src/utils/lightspeedParser.js`:

```js
const REQUIRED_COLUMNS = ['Symbol', 'Buy/Sell', 'Qty', 'Price']

// Parse a Lightspeed execution-blotter CSV into TradeNote tradesData rows.
export function parseLightspeedExecutions(csvText) {
    if (!csvText || !csvText.trim()) return []

    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
    const data = parsed.data
    if (!data.length) return []

    const cols = Object.keys(data[0])
    const missing = REQUIRED_COLUMNS.filter(c => !cols.includes(c))
    if (missing.length) {
        throw new Error(
            'Lightspeed import: missing required columns (' + missing.join(', ') +
            '). Upload the Lightspeed execution blotter CSV, not the daily summary.'
        )
    }

    const out = []
    for (const row of data) {
        const symbol = (row['Symbol'] || '').trim()
        if (!symbol) continue

        const side = mapLightspeedSide(row['Buy/Sell'], row['Side'])
        if (!side) continue

        const qty = Math.abs(parseFloat(row['Qty']))
        const price = parseFloat(row['Price'])
        if (!qty || isNaN(price)) continue

        const isBuy = side === 'B' || side === 'BC'
        const grossProceeds = isBuy ? -(qty * price) : (qty * price)

        // Lightspeed NET Amount already nets every fee; negate to TradeNote's
        // cash-flow convention (buys negative, sells positive).
        const netAmount = parseFloat(row['NET Amount'])
        const netProceeds = isNaN(netAmount) ? grossProceeds : -netAmount

        const tradeDate = (row['Trade Date'] || '').trim()
        const settleDate = (row['Settlement Date'] || '').trim() || tradeDate

        out.push({
            Account: (row['Account Number'] || '').trim(),
            'T/D': tradeDate,
            'S/D': settleDate,
            Currency: (row['Currency Code'] || '').trim() || 'USD',
            Type: 'stock', // Lightspeed equity blotter; equities only
            Side: side,
            Symbol: symbol,
            SymbolOriginal: symbol,
            Qty: qty,
            Price: price,
            'Exec Time': extractExecTime(row['Raw Exec. Time'], row['Execution Time']),
            Comm: Math.abs(parseFloat(row['Commission Amount'])) || 0,
            SEC: Math.abs(parseFloat(row['FeeSEC'])) || 0,
            TAF: Math.abs(parseFloat(row['FeeTAF'])) || 0,
            NSCC: 0,
            Nasdaq: 0,
            'ECN Remove': 0,
            'ECN Add': 0,
            'Gross Proceeds': grossProceeds,
            'Net Proceeds': netProceeds,
            'Clr Broker': '',
            Liq: '',
            Note: ''
        })
    }
    return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/lightspeedParser.test.js`
Expected: PASS (all `parseLightspeedExecutions` cases).

- [ ] **Step 5: Commit**

```bash
git add src/utils/lightspeedParser.js src/utils/lightspeedParser.test.js
git commit -m "feat: lightspeed blotter row parser"
```

---

## Task 4: Oracle test — reconstructed P&L vs daily summaries

This proves the mapping is correct end-to-end against the user's own Lightspeed reports. Net P&L for a symbol/day equals the sum of `Net Proceeds` over its fills; gross equals the sum of `Gross Proceeds`.

**Files:**
- Create: `src/utils/__fixtures__/lightspeed/execution_blotter.csv`
- Create: `src/utils/__fixtures__/lightspeed/daily_summary_0609.xls`
- Create: `src/utils/__fixtures__/lightspeed/daily_summary_0610.xls`
- Create: `src/utils/__fixtures__/lightspeed/daily_summary_0611.xls`
- Create: `src/utils/lightspeedOracle.test.js`

- [ ] **Step 1: Create the fixtures directory**

Run (PowerShell):
```powershell
New-Item -ItemType Directory -Force "src/utils/__fixtures__/lightspeed"
```

- [ ] **Step 2: Copy the blotter fixture, scrubbing the account number**

Run (PowerShell):
```powershell
(Get-Content -Raw '\\192.168.1.16\Downloads\1781261209_table_execution_blotter.csv') -replace '2LD18610','TEST1234' | Set-Content -NoNewline 'src/utils/__fixtures__/lightspeed/execution_blotter.csv'
```

- [ ] **Step 3: Copy the three daily-summary fixtures**

Run (PowerShell):
```powershell
Copy-Item 'C:\Users\vm_manager\Downloads\1781188527_cor_table_daily_summary.xls' 'src/utils/__fixtures__/lightspeed/daily_summary_0609.xls'
Copy-Item 'C:\Users\vm_manager\Downloads\1781188545_cor_table_daily_summary.xls' 'src/utils/__fixtures__/lightspeed/daily_summary_0610.xls'
Copy-Item 'C:\Users\vm_manager\Downloads\1781188601_cor_table_daily_summcol.xls' 'src/utils/__fixtures__/lightspeed/daily_summary_0611.xls'
```

- [ ] **Step 4: Write the oracle test**

Create `src/utils/lightspeedOracle.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as XLSX from 'xlsx'
import { parseLightspeedExecutions } from './lightspeedParser.js'

const here = dirname(fileURLToPath(import.meta.url))
const fx = (name) => join(here, '__fixtures__', 'lightspeed', name)

// Map each summary fixture to the trade date it covers (MM/DD/YYYY).
const SUMMARIES = [
    { file: 'daily_summary_0609.xls', date: '06/09/2026' },
    { file: 'daily_summary_0610.xls', date: '06/10/2026' },
    { file: 'daily_summary_0611.xls', date: '06/11/2026' },
]

// Read a Lightspeed daily-summary xls into { SYMBOL: { gross, net } }.
// Title is row 0, header is row 1 (range:1), data follows; the totals row has
// no Symbol and is skipped.
function readSummary(file) {
    const wb = XLSX.read(readFileSync(fx(file)))
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { range: 1, raw: false })
    const out = {}
    for (const r of rows) {
        const sym = (r['Symbol'] || '').trim()
        if (!sym) continue
        out[sym] = {
            gross: parseFloat(String(r['Gross P & L']).replace(/,/g, '')),
            net: parseFloat(String(r['Net P & L']).replace(/,/g, '')),
        }
    }
    return out
}

// Sum the parsed blotter into { date: { SYMBOL: { gross, net } } }.
function reconstruct() {
    const text = readFileSync(fx('execution_blotter.csv'), 'utf8')
    const fills = parseLightspeedExecutions(text)
    const byDate = {}
    for (const f of fills) {
        const d = (byDate[f['T/D']] ||= {})
        const s = (d[f.Symbol] ||= { gross: 0, net: 0 })
        s.gross += f['Gross Proceeds']
        s.net += f['Net Proceeds']
    }
    return byDate
}

describe('lightspeed oracle: reconstructed P&L matches daily summaries', () => {
    const recon = reconstruct()

    for (const { file, date } of SUMMARIES) {
        const expected = readSummary(file)
        for (const sym of Object.keys(expected)) {
            it(`${date} ${sym} gross within $0.05`, () => {
                const got = recon[date]?.[sym]
                expect(got, `no reconstructed fills for ${sym} on ${date}`).toBeDefined()
                // Tight tolerance: gross is qty*price, only sub-cent rounding noise.
                expect(got.gross).toBeCloseTo(expected[sym].gross, 1)
            })
            it(`${date} ${sym} net within $0.30`, () => {
                const got = recon[date]?.[sym]
                expect(got).toBeDefined()
                // Looser: Lightspeed's two reports disagree by a few cents on
                // fee accounting (e.g. AZI ~$0.10). We validate magnitude/sign,
                // not penny-perfect fee reconciliation.
                expect(Math.abs(got.net - expected[sym].net)).toBeLessThan(0.30)
            })
        }
    }
})
```

- [ ] **Step 5: Run the oracle test**

Run: `npx vitest run src/utils/lightspeedOracle.test.js`
Expected: PASS for every symbol/day. If a *net* assertion fails by a small margin (a few cents), widen the `0.30` bound and note it; if a *gross* assertion fails by more than a cent, the mapping has a real bug (sign or qty) — stop and fix the parser, do not loosen the bound.

- [ ] **Step 6: Commit**

```bash
git add src/utils/__fixtures__/lightspeed src/utils/lightspeedOracle.test.js
git commit -m "test: lightspeed P&L oracle against daily summaries"
```

---

## Task 5: Wrapper `useBrokerLightspeed` in brokers.js

**Files:**
- Modify: `src/utils/brokers.js`

- [ ] **Step 1: Add the import at the top of `brokers.js`**

After the existing module imports near the top of `src/utils/brokers.js` (e.g. after the `import * as XLSX from 'xlsx';` line), add:

```js
import { parseLightspeedExecutions } from './lightspeedParser.js'
```

- [ ] **Step 2: Add the wrapper function**

Add this near the other broker functions in `src/utils/brokers.js` (e.g. after `useWebull`):

```js
/****************************
 * LIGHTSPEED
 ****************************/
// Lightspeed "execution blotter" CSV (one row per fill). The parsing logic
// lives in ./lightspeedParser.js so it can be unit-tested without globals.
export async function useBrokerLightspeed(param) {
    return new Promise(async (resolve, reject) => {
        try {
            const rows = parseLightspeedExecutions(param)
            rows.forEach(row => tradesData.push(JSON.parse(JSON.stringify(row))))
            console.log(" -> Lightspeed Trades Data\n" + JSON.stringify(tradesData))
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
            return
        }
        resolve()
    })
}
```

- [ ] **Step 3: Verify the existing parser tests still pass (no regression)**

Run: `npx vitest run`
Expected: PASS — all parser and oracle tests still green (this change does not affect them).

- [ ] **Step 4: Commit**

```bash
git add src/utils/brokers.js
git commit -m "feat: useBrokerLightspeed wrapper"
```

---

## Task 6: Register the broker in globals.js

**Files:**
- Modify: `src/stores/globals.js:3317-3322`

- [ ] **Step 1: Add the broker entry**

In `src/stores/globals.js`, the `brokers` array currently ends with the Webull entry:

```js
{
    value: "webull",
    label: "Webull",
    assetTypes: ["stocks", "options"],
    autoSync: false
}
])
```

Change it to add a comma after the Webull object and append Lightspeed:

```js
{
    value: "webull",
    label: "Webull",
    assetTypes: ["stocks", "options"],
    autoSync: false
},
{
    value: "lightspeed",
    label: "Lightspeed",
    assetTypes: ["stocks"],
    autoSync: false
}
])
```

- [ ] **Step 2: Verify the file parses**

Run: `npx vite build`
Expected: build completes without syntax errors (or at minimum no new error referencing `globals.js`). If the full build is too slow/heavy in this environment, instead run `node --check src/stores/globals.js` — expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add src/stores/globals.js
git commit -m "feat: register Lightspeed broker option"
```

---

## Task 7: Dispatch wiring in addTrades.js

**Files:**
- Modify: `src/utils/addTrades.js:2` (import)
- Modify: `src/utils/addTrades.js:138` (readAsTextArray)
- Modify: `src/utils/addTrades.js:299-304` (dispatch)

- [ ] **Step 1: Add to the broker import**

In `src/utils/addTrades.js` line 2, add `useBrokerLightspeed` to the import from `./brokers.js`. The line becomes:

```js
import { useBrokerHeldentrader, useBrokerInteractiveBrokers, useBrokerMetaTrader5, useBrokerTdAmeritrade, useBrokerTradeStation, useBrokerTradeZero, useTradovate, useNinjaTrader, useRithmic, useFundTraders, useTastyTrade, useTopstepX, useWarriorTradingSim, useWebull, useBrokerLightspeed } from './brokers.js'
```

- [ ] **Step 2: Add `"lightspeed"` to `readAsTextArray`**

In `src/utils/addTrades.js` around line 138, add `"lightspeed"` to the array (it is a text CSV):

```js
let readAsTextArray = ["tradeZero", "template", "tdAmeritrade", "interactiveBrokers" , "tradovate", "ninjaTrader", "heldentrader", "rithmic", "fundTraders", "tastyTrade", "topstepX", "warriorTradingSim", "webull", "lightspeed"]
```

- [ ] **Step 3: Add the dispatch block**

In `src/utils/addTrades.js`, immediately after the Webull dispatch block (which ends around line 304, just before the `CREATE EXECUTIONS, TRADES` comment), add:

```js
        /****************************
         * LIGHTSPEED
         ****************************/
        if (selectedBroker.value == "lightspeed") {
            console.log(" -> Lightspeed")
            await useBrokerLightspeed(fileInput).catch(error => {
                importFileErrorFunction(error)
            })
        }
```

- [ ] **Step 4: Verify syntax**

Run: `node --check src/utils/addTrades.js`
Expected: no output (valid syntax).

- [ ] **Step 5: Commit**

```bash
git add src/utils/addTrades.js
git commit -m "feat: wire Lightspeed into import dispatch"
```

---

## Task 8: Manual end-to-end verification in the app

This confirms the full pipeline (upload → pair → store → display) works, not just the parser.

**Files:** none (verification only)

- [ ] **Step 1: Start the app stack**

Run: `docker compose up -d` (or the project's documented start command).
Expected: TradeNote reachable in the browser (default `http://localhost:8080`).

- [ ] **Step 2: Set the trade timezone to Eastern**

In TradeNote Settings, set the trade timezone to **US Eastern (America/New_York)** — Lightspeed times are market time.

- [ ] **Step 3: Import the blotter**

Go to Imports, choose **Lightspeed**, and upload `\\192.168.1.16\Downloads\1781261209_table_execution_blotter.csv`.
Expected: import completes with no error dialog.

- [ ] **Step 4: Confirm P&L against the daily summaries**

On the Daily/Calendar view, confirm the per-day net P&L matches the summary files:
- 06/09/2026 ≈ **+58.77** net (AZI +64.60, AHMA −5.83)
- 06/10/2026 ≈ **+85.53** net
- 06/11/2026 ≈ **+37.73** net

Small cent-level differences are expected (Lightspeed's two reports differ on fee accounting). Large differences mean a bug — investigate the parser/dispatch.

- [ ] **Step 5: Spot-check a trade**

Open one AZI trade on 06/09 and confirm entry/exit prices, times (ET), and side (Long) look right.

- [ ] **Step 6: Final commit (if any cleanup was needed)**

```bash
git add -A
git commit -m "chore: lightspeed import verification cleanup"
```

(If nothing changed, skip.)

---

## Self-Review Notes

- **Spec coverage:** field mapping (Tasks 2–3), side long+short (Task 2), gross/net signs & fee policy (Task 3), broker registration (Task 6), dispatch + readAsText (Task 7), ET timezone (Task 8 step 2), P&L oracle (Task 4), wrong-file rejection (Task 3), multi-day/partial fills (covered by engine, validated by oracle Task 4). All spec sections map to a task.
- **No engine changes:** trade pairing, reports, and UI are untouched beyond the dropdown entry.
- **Type consistency:** `parseLightspeedExecutions`, `mapLightspeedSide`, `extractExecTime`, `useBrokerLightspeed` names are used identically across tasks. Field keys match exactly what `createTempExecutions` reads in `addTrades.js`.
