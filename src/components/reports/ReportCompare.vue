<script setup>
import { ref } from 'vue'
import dayjs from 'dayjs'
import {
    filteredTradesTrades,
    amountCase,
    availableTags,
    reportCompareFiltersA,
    reportCompareFiltersB,
    reportCompareGroupA,
    reportCompareGroupB
} from '../../stores/globals'
import { useThousandCurrencyFormat, useTwoDecCurrencyFormat, useXDecFormat } from '../../utils/utils'

// ── Preset definitions ────────────────────────────────────────────────────────

const PRESETS = [
    { label: 'Win vs Loss', a: { plFilter: 'winners' }, b: { plFilter: 'losers' } },
    { label: 'Long vs Short', a: { side: 'long' }, b: { side: 'short' } }
]

// ── Local UI state ────────────────────────────────────────────────────────────

const showResults = ref(false)
const selectedPreset = ref(null)

// ── Preset application ────────────────────────────────────────────────────────

function applyPreset(preset) {
    selectedPreset.value = preset.label

    // Reset both filter sets to defaults then overlay preset values
    Object.assign(reportCompareFiltersA, {
        symbol: '', tags: [], side: 'all', duration: 'all', plFilter: 'all',
        dateStart: null, dateEnd: null,
        ...preset.a
    })
    Object.assign(reportCompareFiltersB, {
        symbol: '', tags: [], side: 'all', duration: 'all', plFilter: 'all',
        dateStart: null, dateEnd: null,
        ...preset.b
    })
}

// ── Tag checkbox helpers ──────────────────────────────────────────────────────

function toggleTag(filtersRef, tagId) {
    const idx = filtersRef.tags.indexOf(tagId)
    if (idx === -1) {
        filtersRef.tags.push(tagId)
    } else {
        filtersRef.tags.splice(idx, 1)
    }
}

// ── Filter application ────────────────────────────────────────────────────────

/**
 * Return the subset of trades that match the given filter set.
 * Mirrors the filtering logic used in the main trades pipeline without
 * mutating any global reactive state.
 */
function useApplyReportFilters(trades, filters) {
    return trades.filter(trade => {
        // Symbol filter (case-insensitive substring match)
        if (filters.symbol && filters.symbol.trim() !== '') {
            const sym = (trade.symbol || '').toLowerCase()
            if (!sym.includes(filters.symbol.trim().toLowerCase())) return false
        }

        // Tags filter – trade must carry at least one of the selected tags
        if (filters.tags && filters.tags.length > 0) {
            const tradeTags = (trade.tags || []).map(t => (typeof t === 'object' ? t.id : t))
            const hasMatch = filters.tags.some(id => tradeTags.includes(id))
            if (!hasMatch) return false
        }

        // Side filter
        if (filters.side && filters.side !== 'all') {
            if ((trade.side || '').toLowerCase() !== filters.side) return false
        }

        // Duration filter (calendar-day based, consistent with reports.js)
        if (filters.duration && filters.duration !== 'all') {
            const entryDay = trade.entryTime ? dayjs.unix(trade.entryTime).format('YYYYMMDD') : null
            const exitDay = trade.exitTime ? dayjs.unix(trade.exitTime).format('YYYYMMDD') : null
            const isOvernight = entryDay && exitDay && entryDay !== exitDay
            if (filters.duration === 'intraday' && isOvernight) return false
            if (filters.duration === 'multiday' && !isOvernight) return false
        }

        // P&L filter
        if (filters.plFilter && filters.plFilter !== 'all') {
            const proceeds = trade[(amountCase.value || 'gross') + 'Proceeds'] || 0
            if (filters.plFilter === 'winners' && proceeds <= 0) return false
            if (filters.plFilter === 'losers' && proceeds >= 0) return false
        }

        return true
    })
}

// ── Stats builders ────────────────────────────────────────────────────────────

/**
 * Aggregate a flat list of trade objects into the totalsByDate shape that
 * useCalculateDetailedStats expects: an object keyed by trade-date unix
 * timestamp (td), each entry holding gross/net sums for that day.
 */
function buildTotalsByDate(trades) {
    const map = {}
    trades.forEach(trade => {
        const key = trade.td
        if (key == null) return
        if (!map[key]) {
            map[key] = {
                grossProceeds: 0, netProceeds: 0,
                grossWins: 0, netWins: 0,
                grossLoss: 0, netLoss: 0,
                grossWinsCount: 0, netWinsCount: 0,
                grossLossCount: 0, netLossCount: 0,
                buyQuantity: 0, sellQuantity: 0,
                commission: 0, fees: 0,
                trades: 0, executions: 0
            }
        }
        const d = map[key]
        d.grossProceeds += trade.grossProceeds || 0
        d.netProceeds += trade.netProceeds || 0
        d.grossWins += trade.grossWins || 0
        d.netWins += trade.netWins || 0
        d.grossLoss += trade.grossLoss || 0
        d.netLoss += trade.netLoss || 0
        d.grossWinsCount += (trade.grossProceeds || 0) >= 0 ? 1 : 0
        d.netWinsCount += (trade.netProceeds || 0) >= 0 ? 1 : 0
        d.grossLossCount += (trade.grossProceeds || 0) < 0 ? 1 : 0
        d.netLossCount += (trade.netProceeds || 0) < 0 ? 1 : 0
        d.buyQuantity += trade.buyQuantity || 0
        d.sellQuantity += trade.sellQuantity || 0
        d.commission += trade.commission || 0
        d.fees += (trade.commission || 0) + (trade.sec || 0) + (trade.taf || 0) + (trade.nscc || 0) + (trade.nasdaq || 0)
        d.trades += 1
        d.executions += trade.executionsCount || 0
    })
    return map
}

/**
 * Aggregate a flat trade list into the single totals object shape that
 * mirrors the global totals reactive object.
 */
function buildTotals(trades) {
    const t = {
        grossProceeds: 0, netProceeds: 0,
        grossWins: 0, netWins: 0,
        grossLoss: 0, netLoss: 0,
        grossWinsCount: 0, netWinsCount: 0,
        grossLossCount: 0, netLossCount: 0,
        grossSharePL: 0, netSharePL: 0,
        buyQuantity: 0, sellQuantity: 0,
        commission: 0, fees: 0,
        trades: 0, executions: 0
    }
    trades.forEach(trade => {
        t.grossProceeds += trade.grossProceeds || 0
        t.netProceeds += trade.netProceeds || 0
        t.grossWins += trade.grossWins || 0
        t.netWins += trade.netWins || 0
        t.grossLoss += trade.grossLoss || 0
        t.netLoss += trade.netLoss || 0
        t.grossSharePL += trade.grossSharePL || 0
        t.netSharePL += trade.netSharePL || 0
        t.buyQuantity += trade.buyQuantity || 0
        t.sellQuantity += trade.sellQuantity || 0
        t.commission += trade.commission || 0
        t.fees += (trade.commission || 0) + (trade.sec || 0) + (trade.taf || 0) + (trade.nscc || 0) + (trade.nasdaq || 0)
        t.trades += 1
        t.executions += trade.executionsCount || 0
        if ((trade.grossProceeds || 0) >= 0) t.grossWinsCount++
        else t.grossLossCount++
        if ((trade.netProceeds || 0) >= 0) t.netWinsCount++
        else t.netLossCount++
    })
    return t
}

/**
 * Derive a comprehensive stats object from the aggregated trade data.
 * The amountCaseVal parameter is the string 'gross' or 'net'.
 */
function useCalculateDetailedStats(trades, tbd, totalsObj, amountCaseVal) {
    const ac = amountCaseVal || 'gross'
    const proceeds = totalsObj[ac + 'Proceeds'] || 0
    const wins = totalsObj[ac + 'Wins'] || 0
    const loss = totalsObj[ac + 'Loss'] || 0
    const winsCount = totalsObj[ac + 'WinsCount'] || 0
    const lossCount = totalsObj[ac + 'LossCount'] || 0
    const tradeCount = totalsObj.trades || 0
    const sharePL = totalsObj[ac + 'SharePL'] || 0

    const winRate = tradeCount > 0 ? (winsCount / tradeCount) : 0
    const avgWin = winsCount > 0 ? (wins / winsCount) : 0
    const avgLoss = lossCount > 0 ? (loss / lossCount) : 0
    const profitFactor = loss !== 0 ? Math.abs(wins / loss) : 0
    const avgTrade = tradeCount > 0 ? (proceeds / tradeCount) : 0
    const avgSharePL = tradeCount > 0 ? (sharePL / tradeCount) : 0

    // Largest single-day gain and loss from totalsByDate
    let bestDay = 0
    let worstDay = 0
    Object.values(tbd).forEach(day => {
        const p = day[ac + 'Proceeds'] || 0
        if (p > bestDay) bestDay = p
        if (p < worstDay) worstDay = p
    })

    // Consecutive win/loss streaks from chronologically sorted totals by date
    const sortedDays = Object.keys(tbd)
        .map(Number)
        .sort((a, b) => a - b)
        .map(k => tbd[k][ac + 'Proceeds'] || 0)

    let maxWinStreak = 0, maxLossStreak = 0
    let curWin = 0, curLoss = 0
    sortedDays.forEach(p => {
        if (p >= 0) { curWin++; curLoss = 0 } else { curLoss++; curWin = 0 }
        if (curWin > maxWinStreak) maxWinStreak = curWin
        if (curLoss > maxLossStreak) maxLossStreak = curLoss
    })

    return {
        proceeds,
        wins,
        loss,
        tradeCount,
        winsCount,
        lossCount,
        winRate,
        avgWin,
        avgLoss,
        profitFactor,
        avgTrade,
        avgSharePL,
        bestDay,
        worstDay,
        maxWinStreak,
        maxLossStreak,
        commission: totalsObj.commission || 0,
        fees: totalsObj.fees || 0
    }
}

// ── Report generation ─────────────────────────────────────────────────────────

function generateReport() {
    const tradesA = useApplyReportFilters(filteredTradesTrades, reportCompareFiltersA)
    const tradesB = useApplyReportFilters(filteredTradesTrades, reportCompareFiltersB)

    const statsA = useCalculateDetailedStats(
        tradesA,
        buildTotalsByDate(tradesA),
        buildTotals(tradesA),
        amountCase.value
    )
    const statsB = useCalculateDetailedStats(
        tradesB,
        buildTotalsByDate(tradesB),
        buildTotals(tradesB),
        amountCase.value
    )

    // Mutate reactives in-place so any downstream watchers fire correctly
    Object.keys(reportCompareGroupA).forEach(k => delete reportCompareGroupA[k])
    Object.assign(reportCompareGroupA, statsA)

    Object.keys(reportCompareGroupB).forEach(k => delete reportCompareGroupB[k])
    Object.assign(reportCompareGroupB, statsB)

    showResults.value = true
}

// ── Reset helper ──────────────────────────────────────────────────────────────

function resetFilters(filtersRef) {
    Object.assign(filtersRef, {
        symbol: '', tags: [], side: 'all', duration: 'all', plFilter: 'all',
        dateStart: null, dateEnd: null
    })
}

// ── Colour helper for result cells ───────────────────────────────────────────

function compareClass(valA, valB, higherIsBetter = true) {
    if (valA === valB) return ''
    const aIsLeading = higherIsBetter ? valA > valB : valA < valB
    return aIsLeading ? 'text-success fw-bold' : ''
}

function compareClassB(valA, valB, higherIsBetter = true) {
    if (valA === valB) return ''
    const bIsLeading = higherIsBetter ? valB > valA : valB < valA
    return bIsLeading ? 'text-success fw-bold' : ''
}
</script>

<template>
    <!-- ── Quick-preset dropdown ──────────────────────────────────────────── -->
    <div class="d-flex align-items-center gap-2 mb-3">
        <span class="dashInfoTitle">Quick Reports:</span>
        <div class="dropdown">
            <button
                class="btn btn-sm btn-outline-secondary dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
            >
                {{ selectedPreset || 'Select a preset' }}
            </button>
            <ul class="dropdown-menu">
                <li v-for="preset in PRESETS" :key="preset.label">
                    <button
                        class="dropdown-item"
                        type="button"
                        @click="applyPreset(preset)"
                    >
                        {{ preset.label }}
                    </button>
                </li>
            </ul>
        </div>
    </div>

    <!-- ── Two filter panels side by side ────────────────────────────────── -->
    <div class="row mb-3">

        <!-- Group A -->
        <div class="col-12 col-md-6 mb-3 mb-md-0">
            <div class="dailyCard">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">Group A</h6>
                    <button
                        class="btn btn-sm btn-outline-secondary"
                        type="button"
                        @click="resetFilters(reportCompareFiltersA)"
                    >
                        Reset
                    </button>
                </div>

                <!-- Symbol -->
                <div class="mb-2">
                    <label class="dashInfoTitle d-block mb-1">Symbol</label>
                    <input
                        v-model="reportCompareFiltersA.symbol"
                        type="text"
                        class="form-control form-control-sm"
                        placeholder="e.g. AAPL"
                    />
                </div>

                <!-- Tags -->
                <div class="mb-2" v-if="availableTags && availableTags.length > 0">
                    <label class="dashInfoTitle d-block mb-1">Tags</label>
                    <div class="d-flex flex-wrap gap-1">
                        <template v-for="group in availableTags" :key="group.id || group.name">
                            <div
                                v-for="tag in group.tags"
                                :key="tag.id"
                                class="form-check form-check-inline m-0"
                            >
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    :id="'tagA-' + tag.id"
                                    :value="tag.id"
                                    :checked="reportCompareFiltersA.tags.includes(tag.id)"
                                    @change="toggleTag(reportCompareFiltersA, tag.id)"
                                />
                                <label class="form-check-label small" :for="'tagA-' + tag.id">
                                    {{ tag.name }}
                                </label>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Side -->
                <div class="mb-2">
                    <label class="dashInfoTitle d-block mb-1">Side</label>
                    <select v-model="reportCompareFiltersA.side" class="form-select form-select-sm">
                        <option value="all">All</option>
                        <option value="long">Long</option>
                        <option value="short">Short</option>
                    </select>
                </div>

                <!-- Duration -->
                <div class="mb-2">
                    <label class="dashInfoTitle d-block mb-1">Duration</label>
                    <select v-model="reportCompareFiltersA.duration" class="form-select form-select-sm">
                        <option value="all">All</option>
                        <option value="intraday">Intraday</option>
                        <option value="multiday">Multi-day</option>
                    </select>
                </div>

                <!-- P&L -->
                <div class="mb-2">
                    <label class="dashInfoTitle d-block mb-1">P&amp;L</label>
                    <select v-model="reportCompareFiltersA.plFilter" class="form-select form-select-sm">
                        <option value="all">All</option>
                        <option value="winners">Winners</option>
                        <option value="losers">Losers</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Group B -->
        <div class="col-12 col-md-6">
            <div class="dailyCard">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">Group B</h6>
                    <button
                        class="btn btn-sm btn-outline-secondary"
                        type="button"
                        @click="resetFilters(reportCompareFiltersB)"
                    >
                        Reset
                    </button>
                </div>

                <!-- Symbol -->
                <div class="mb-2">
                    <label class="dashInfoTitle d-block mb-1">Symbol</label>
                    <input
                        v-model="reportCompareFiltersB.symbol"
                        type="text"
                        class="form-control form-control-sm"
                        placeholder="e.g. TSLA"
                    />
                </div>

                <!-- Tags -->
                <div class="mb-2" v-if="availableTags && availableTags.length > 0">
                    <label class="dashInfoTitle d-block mb-1">Tags</label>
                    <div class="d-flex flex-wrap gap-1">
                        <template v-for="group in availableTags" :key="group.id || group.name">
                            <div
                                v-for="tag in group.tags"
                                :key="tag.id"
                                class="form-check form-check-inline m-0"
                            >
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    :id="'tagB-' + tag.id"
                                    :value="tag.id"
                                    :checked="reportCompareFiltersB.tags.includes(tag.id)"
                                    @change="toggleTag(reportCompareFiltersB, tag.id)"
                                />
                                <label class="form-check-label small" :for="'tagB-' + tag.id">
                                    {{ tag.name }}
                                </label>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Side -->
                <div class="mb-2">
                    <label class="dashInfoTitle d-block mb-1">Side</label>
                    <select v-model="reportCompareFiltersB.side" class="form-select form-select-sm">
                        <option value="all">All</option>
                        <option value="long">Long</option>
                        <option value="short">Short</option>
                    </select>
                </div>

                <!-- Duration -->
                <div class="mb-2">
                    <label class="dashInfoTitle d-block mb-1">Duration</label>
                    <select v-model="reportCompareFiltersB.duration" class="form-select form-select-sm">
                        <option value="all">All</option>
                        <option value="intraday">Intraday</option>
                        <option value="multiday">Multi-day</option>
                    </select>
                </div>

                <!-- P&L -->
                <div class="mb-2">
                    <label class="dashInfoTitle d-block mb-1">P&amp;L</label>
                    <select v-model="reportCompareFiltersB.plFilter" class="form-select form-select-sm">
                        <option value="all">All</option>
                        <option value="winners">Winners</option>
                        <option value="losers">Losers</option>
                    </select>
                </div>
            </div>
        </div>
    </div>

    <!-- ── Generate button ────────────────────────────────────────────────── -->
    <div class="d-flex justify-content-center mb-4">
        <button
            class="btn btn-primary"
            type="button"
            @click="generateReport"
        >
            Generate Report
        </button>
    </div>

    <!-- ── Results ────────────────────────────────────────────────────────── -->
    <div v-if="showResults">
        <div class="dailyCard">
            <h6 class="mb-3">Comparison Results</h6>

            <div class="table-responsive">
                <table class="table table-sm table-borderless align-middle mb-0">
                    <thead>
                        <tr>
                            <th class="dashInfoTitle">Metric</th>
                            <th class="text-center dashInfoTitle">Group A</th>
                            <th class="text-center dashInfoTitle">Group B</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Net P&L -->
                        <tr>
                            <td class="dashInfoTitle">Total P&amp;L</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.proceeds, reportCompareGroupB.proceeds)"
                            >
                                {{ useThousandCurrencyFormat(reportCompareGroupA.proceeds || 0) }}
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.proceeds, reportCompareGroupB.proceeds)"
                            >
                                {{ useThousandCurrencyFormat(reportCompareGroupB.proceeds || 0) }}
                            </td>
                        </tr>

                        <!-- Trade count -->
                        <tr>
                            <td class="dashInfoTitle">Trades</td>
                            <td class="text-center">{{ reportCompareGroupA.tradeCount || 0 }}</td>
                            <td class="text-center">{{ reportCompareGroupB.tradeCount || 0 }}</td>
                        </tr>

                        <!-- Win rate -->
                        <tr>
                            <td class="dashInfoTitle">Win Rate</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.winRate, reportCompareGroupB.winRate)"
                            >
                                {{ useXDecFormat((reportCompareGroupA.winRate || 0) * 100, 1) }}%
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.winRate, reportCompareGroupB.winRate)"
                            >
                                {{ useXDecFormat((reportCompareGroupB.winRate || 0) * 100, 1) }}%
                            </td>
                        </tr>

                        <!-- Average win -->
                        <tr>
                            <td class="dashInfoTitle">Avg Win</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.avgWin, reportCompareGroupB.avgWin)"
                            >
                                {{ useTwoDecCurrencyFormat(reportCompareGroupA.avgWin || 0) }}
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.avgWin, reportCompareGroupB.avgWin)"
                            >
                                {{ useTwoDecCurrencyFormat(reportCompareGroupB.avgWin || 0) }}
                            </td>
                        </tr>

                        <!-- Average loss -->
                        <tr>
                            <td class="dashInfoTitle">Avg Loss</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.avgLoss, reportCompareGroupB.avgLoss, false)"
                            >
                                {{ useTwoDecCurrencyFormat(reportCompareGroupA.avgLoss || 0) }}
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.avgLoss, reportCompareGroupB.avgLoss, false)"
                            >
                                {{ useTwoDecCurrencyFormat(reportCompareGroupB.avgLoss || 0) }}
                            </td>
                        </tr>

                        <!-- Profit factor -->
                        <tr>
                            <td class="dashInfoTitle">Profit Factor</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.profitFactor, reportCompareGroupB.profitFactor)"
                            >
                                {{ useXDecFormat(reportCompareGroupA.profitFactor || 0, 2) }}
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.profitFactor, reportCompareGroupB.profitFactor)"
                            >
                                {{ useXDecFormat(reportCompareGroupB.profitFactor || 0, 2) }}
                            </td>
                        </tr>

                        <!-- Avg trade -->
                        <tr>
                            <td class="dashInfoTitle">Avg Trade</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.avgTrade, reportCompareGroupB.avgTrade)"
                            >
                                {{ useTwoDecCurrencyFormat(reportCompareGroupA.avgTrade || 0) }}
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.avgTrade, reportCompareGroupB.avgTrade)"
                            >
                                {{ useTwoDecCurrencyFormat(reportCompareGroupB.avgTrade || 0) }}
                            </td>
                        </tr>

                        <!-- Avg per-share P&L -->
                        <tr>
                            <td class="dashInfoTitle">Avg Per-Share P&amp;L</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.avgSharePL, reportCompareGroupB.avgSharePL)"
                            >
                                {{ useTwoDecCurrencyFormat(reportCompareGroupA.avgSharePL || 0) }}
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.avgSharePL, reportCompareGroupB.avgSharePL)"
                            >
                                {{ useTwoDecCurrencyFormat(reportCompareGroupB.avgSharePL || 0) }}
                            </td>
                        </tr>

                        <!-- Best day -->
                        <tr>
                            <td class="dashInfoTitle">Best Day</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.bestDay, reportCompareGroupB.bestDay)"
                            >
                                {{ useThousandCurrencyFormat(reportCompareGroupA.bestDay || 0) }}
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.bestDay, reportCompareGroupB.bestDay)"
                            >
                                {{ useThousandCurrencyFormat(reportCompareGroupB.bestDay || 0) }}
                            </td>
                        </tr>

                        <!-- Worst day -->
                        <tr>
                            <td class="dashInfoTitle">Worst Day</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.worstDay, reportCompareGroupB.worstDay, false)"
                            >
                                {{ useThousandCurrencyFormat(reportCompareGroupA.worstDay || 0) }}
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.worstDay, reportCompareGroupB.worstDay, false)"
                            >
                                {{ useThousandCurrencyFormat(reportCompareGroupB.worstDay || 0) }}
                            </td>
                        </tr>

                        <!-- Max win streak -->
                        <tr>
                            <td class="dashInfoTitle">Max Win Streak</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.maxWinStreak, reportCompareGroupB.maxWinStreak)"
                            >
                                {{ reportCompareGroupA.maxWinStreak || 0 }}
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.maxWinStreak, reportCompareGroupB.maxWinStreak)"
                            >
                                {{ reportCompareGroupB.maxWinStreak || 0 }}
                            </td>
                        </tr>

                        <!-- Max loss streak -->
                        <tr>
                            <td class="dashInfoTitle">Max Loss Streak</td>
                            <td
                                class="text-center"
                                :class="compareClass(reportCompareGroupA.maxLossStreak, reportCompareGroupB.maxLossStreak, false)"
                            >
                                {{ reportCompareGroupA.maxLossStreak || 0 }}
                            </td>
                            <td
                                class="text-center"
                                :class="compareClassB(reportCompareGroupA.maxLossStreak, reportCompareGroupB.maxLossStreak, false)"
                            >
                                {{ reportCompareGroupB.maxLossStreak || 0 }}
                            </td>
                        </tr>

                        <!-- Commission -->
                        <tr>
                            <td class="dashInfoTitle">Commission</td>
                            <td class="text-center">
                                {{ useTwoDecCurrencyFormat(reportCompareGroupA.commission || 0) }}
                            </td>
                            <td class="text-center">
                                {{ useTwoDecCurrencyFormat(reportCompareGroupB.commission || 0) }}
                            </td>
                        </tr>

                        <!-- Total fees -->
                        <tr>
                            <td class="dashInfoTitle">Total Fees</td>
                            <td class="text-center">
                                {{ useTwoDecCurrencyFormat(reportCompareGroupA.fees || 0) }}
                            </td>
                            <td class="text-center">
                                {{ useTwoDecCurrencyFormat(reportCompareGroupB.fees || 0) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<!--
Usage example
─────────────
Import and register the component inside a parent view (e.g. Reports.vue).

    import ReportCompare from '../components/reports/ReportCompare.vue'

    <ReportCompare />

The component reads the following globals from stores/globals.js:
  • filteredTradesTrades   – flat array of all filtered trade objects
  • amountCase             – 'gross' | 'net'
  • availableTags          – reactive array of tag group objects for the
                             tag checkbox UI
  • reportCompareFiltersA / reportCompareFiltersB  – persisted filter state
  • reportCompareGroupA / reportCompareGroupB      – persisted result state

All filtering and aggregation is performed locally inside this component so
that it is self-contained and does not interfere with the global state used
by other report tabs.
-->
