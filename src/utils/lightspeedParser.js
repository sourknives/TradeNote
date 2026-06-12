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
