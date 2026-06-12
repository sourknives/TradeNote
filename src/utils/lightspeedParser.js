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
