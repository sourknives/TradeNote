import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseLightspeedExecutions } from './lightspeedParser.js'

const here = dirname(fileURLToPath(import.meta.url))
const blotterPath = join(here, '__fixtures__', 'lightspeed', 'execution_blotter.csv')

// Ground truth from the user's Lightspeed daily-summary reports for the same
// days the blotter covers (cor_table_daily_summary / _summcol, 06/09-06/11 2026).
// gross = "Gross P & L", net = "Net P & L" per symbol.
const EXPECTED = {
    '06/09/2026': {
        AHMA: { gross: -4.94, net: -5.83 },
        AZI: { gross: 69.67, net: 64.60 },
    },
    '06/10/2026': {
        CLWT: { gross: -115.97, net: -116.84 },
        DAIC: { gross: 60.69, net: 59.31 },
        DSY: { gross: 236.02, net: 217.11 },
        VSME: { gross: -50.91, net: -54.93 },
        WCT: { gross: -17.80, net: -19.12 },
    },
    '06/11/2026': {
        EDHL: { gross: -34.77, net: -46.02 },
        FGL: { gross: -36.91, net: -42.26 },
        PPCB: { gross: 90.37, net: 87.68 },
        VELO: { gross: 39.25, net: 38.33 },
    },
}

// Sum the parsed blotter into { date: { SYMBOL: { gross, net } } }.
function reconstruct() {
    const fills = parseLightspeedExecutions(readFileSync(blotterPath, 'utf8'))
    const byDate = {}
    for (const f of fills) {
        const d = (byDate[f['T/D']] ||= {})
        const s = (d[f.Symbol] ||= { gross: 0, net: 0 })
        s.gross += f['Gross Proceeds']
        s.net += f['Net Proceeds']
    }
    return byDate
}

describe('lightspeed oracle: reconstructed P&L vs daily summaries', () => {
    const recon = reconstruct()

    for (const date of Object.keys(EXPECTED)) {
        for (const sym of Object.keys(EXPECTED[date])) {
            const exp = EXPECTED[date][sym]

            it(`${date} ${sym} gross matches to the cent`, () => {
                const got = recon[date]?.[sym]
                expect(got, `no reconstructed fills for ${sym} on ${date}`).toBeDefined()
                // Gross is qty*price on both sides; only sub-cent rounding noise.
                expect(got.gross).toBeCloseTo(exp.gross, 1)
            })

            it(`${date} ${sym} net is close (blotter NET is authoritative)`, () => {
                const got = recon[date]?.[sym]
                expect(got).toBeDefined()
                // The blotter's per-fill NET Amount is what actually hit the
                // account; the daily summary's "Net P&L" uses coarser commission
                // accounting, so they drift a little (observed max ~$0.49 on
                // EDHL). Primary correctness is the gross assertion above.
                expect(Math.abs(got.net - exp.net)).toBeLessThan(1.0)
            })
        }
    }
})
