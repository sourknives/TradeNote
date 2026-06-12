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
