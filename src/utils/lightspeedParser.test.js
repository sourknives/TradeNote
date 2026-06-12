import { describe, it, expect } from 'vitest'
import { mapLightspeedSide, extractExecTime, parseLightspeedExecutions } from './lightspeedParser.js'

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
