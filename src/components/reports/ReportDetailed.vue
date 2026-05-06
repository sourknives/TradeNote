<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { reportDetailedStats, amountCase, renderData, groups, reportChartsMounted } from '../../stores/globals'
import { useThousandCurrencyFormat, useTwoDecCurrencyFormat, useXDecFormat } from '../../utils/utils'

// Sub-tab state: 'daysTimes' | 'priceVolume' | 'instruments'
const subTab = ref('daysTimes')

// ECharts instances initialized while their sub-tab was hidden (v-show=false) render at 0×0.
// Resize them once a sub-tab becomes visible so they fill the now-visible container.
watch(subTab, () => {
    nextTick(() => {
        document.querySelectorAll('[_echarts_instance_]').forEach(el => {
            const inst = echarts.getInstanceByDom(el)
            if (inst && !inst.isDisposed()) inst.resize()
        })
    })
})

// Compute per-symbol summary rows from groups.symbols (an object keyed by symbol name,
// each value being an array of trade objects).
const symbolRows = computed(() => {
    if (!groups.symbols || typeof groups.symbols !== 'object') return []

    return Object.entries(groups.symbols).map(([symbol, trades]) => {
        const count = trades.length
        const wins = trades.filter(t => (t[amountCase.value + 'Proceeds'] ?? 0) > 0).length
        const winRate = count > 0 ? (wins / count) * 100 : 0
        const pl = trades.reduce((sum, t) => sum + (t[amountCase.value + 'Proceeds'] ?? 0), 0)
        const avgTrade = count > 0 ? pl / count : 0
        return { symbol, count, winRate, pl, avgTrade }
    }).sort((a, b) => b.pl - a.pl)
})

// Helper: return '-' when a value is null/undefined/NaN
function fmt(value, formatter) {
    if (value == null || (typeof value === 'number' && isNaN(value))) return '-'
    return formatter(value)
}
</script>

<template>
    <div>
        <!-- ============================================================
             STATISTICS TABLE
        ============================================================ -->
        <div class="row mb-4">
            <!-- Left column (12 metrics) -->
            <div class="col-12 col-lg-6">
                <div class="dailyCard p-3">
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Total P&amp;L</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats[amountCase + 'TotalPL'], useThousandCurrencyFormat) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Number of Trades</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.numTrades, v => useXDecFormat(v, 0)) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Number of Trading Days</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.numTradingDays, v => useXDecFormat(v, 0)) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Avg Daily P&amp;L</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats[amountCase + 'AvgDailyPL'], useTwoDecCurrencyFormat) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Avg Daily Volume</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.avgDailyVolume, v => useXDecFormat(v, 0)) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Win Rate</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.winRate, v => useXDecFormat(v, 2) + '%') }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Loss Rate</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.lossRate, v => useXDecFormat(v, 2) + '%') }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Profit Factor</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.profitFactor, v => useXDecFormat(v, 2)) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Avg Winning Trade</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats[amountCase + 'AvgWinningTrade'], useTwoDecCurrencyFormat) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Avg Losing Trade</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats[amountCase + 'AvgLosingTrade'], useTwoDecCurrencyFormat) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Largest Win</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats[amountCase + 'LargestWin'], useTwoDecCurrencyFormat) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Largest Loss</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats[amountCase + 'LargestLoss'], useTwoDecCurrencyFormat) }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right column (13 metrics) -->
            <div class="col-12 col-lg-6 mt-3 mt-lg-0">
                <div class="dailyCard p-3">
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Avg Win/Share</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats[amountCase + 'AvgWinPerShare'], useTwoDecCurrencyFormat) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Avg Loss/Share</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats[amountCase + 'AvgLossPerShare'], useTwoDecCurrencyFormat) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Max Consecutive Wins</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.maxConsecWins, v => useXDecFormat(v, 0)) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Max Consecutive Losses</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.maxConsecLosses, v => useXDecFormat(v, 0)) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Avg Hold Time (Winners)</div>
                        <div class="col-5 text-end">
                            {{ reportDetailedStats.avgHoldTimeWinners ?? '-' }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Avg Hold Time (Losers)</div>
                        <div class="col-5 text-end">
                            {{ reportDetailedStats.avgHoldTimeLosers ?? '-' }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Std Deviation</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats[amountCase + 'StdDeviation'], useTwoDecCurrencyFormat) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">K-Ratio</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.kRatio, v => useXDecFormat(v, 4)) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">SQN</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.sqn, v => useXDecFormat(v, 2)) }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Kelly %</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.kellyPct, v => useXDecFormat(v, 2) + '%') }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Probability of Random Chance</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.probRandomChance, v => useXDecFormat(v, 2) + '%') }}
                        </div>
                    </div>
                    <div class="row mb-1">
                        <div class="col-7 text-start dashInfoTitle">Avg Trades/Day</div>
                        <div class="col-5 text-end">
                            {{ fmt(reportDetailedStats.avgTradesPerDay, v => useXDecFormat(v, 2)) }}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================
             SUB-TAB NAVIGATION
        ============================================================ -->
        <div class="nav nav-tabs mb-3" role="tablist">
            <button
                :class="'nav-link ' + (subTab === 'daysTimes' ? 'active' : '')"
                type="button"
                role="tab"
                @click="subTab = 'daysTimes'"
            >Days / Times</button>
            <button
                :class="'nav-link ' + (subTab === 'priceVolume' ? 'active' : '')"
                type="button"
                role="tab"
                @click="subTab = 'priceVolume'"
            >Price / Volume</button>
            <button
                :class="'nav-link ' + (subTab === 'instruments' ? 'active' : '')"
                type="button"
                role="tab"
                @click="subTab = 'instruments'"
            >Instruments</button>
        </div>

        <!-- ============================================================
             SUB-TAB: DAYS / TIMES
        ============================================================ -->
        <div v-show="subTab === 'daysTimes'">
            <div class="row">
                <div class="col-12 col-xl-6 mb-3">
                    <div class="dailyCard p-2">
                        <h6 class="ps-2 pt-1">P&amp;L by Day of Week</h6>
                        <div v-bind:key="renderData" id="reportBarDay" class="chartClass"></div>
                    </div>
                </div>
                <div class="col-12 col-xl-6 mb-3">
                    <div class="dailyCard p-2">
                        <h6 class="ps-2 pt-1">P&amp;L by Hour</h6>
                        <div v-bind:key="renderData" id="reportBarHour" class="chartClass"></div>
                    </div>
                </div>
                <div class="col-12 col-xl-6 mb-3">
                    <div class="dailyCard p-2">
                        <h6 class="ps-2 pt-1">Performance by Day of Week</h6>
                        <div v-bind:key="renderData" id="reportBarDayPerf" class="chartClass"></div>
                    </div>
                </div>
                <div class="col-12 col-xl-6 mb-3">
                    <div class="dailyCard p-2">
                        <h6 class="ps-2 pt-1">Performance by Hour</h6>
                        <div v-bind:key="renderData" id="reportBarHourPerf" class="chartClass"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================
             SUB-TAB: PRICE / VOLUME
        ============================================================ -->
        <div v-show="subTab === 'priceVolume'">
            <div class="row">
                <div class="col-12 col-xl-6 mb-3">
                    <div class="dailyCard p-2">
                        <h6 class="ps-2 pt-1">P&amp;L by Entry Price</h6>
                        <div v-bind:key="renderData" id="reportBarEntryPrice" class="chartClass"></div>
                    </div>
                </div>
                <div class="col-12 col-xl-6 mb-3">
                    <div class="dailyCard p-2">
                        <h6 class="ps-2 pt-1">P&amp;L by Volume</h6>
                        <div v-bind:key="renderData" id="reportBarVolume" class="chartClass"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================
             SUB-TAB: INSTRUMENTS
        ============================================================ -->
        <div v-show="subTab === 'instruments'">
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th scope="col" class="dashInfoTitle">Symbol</th>
                            <th scope="col" class="dashInfoTitle text-end">Trades</th>
                            <th scope="col" class="dashInfoTitle text-end">Win %</th>
                            <th scope="col" class="dashInfoTitle text-end">P&amp;L</th>
                            <th scope="col" class="dashInfoTitle text-end">Avg Trade</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in symbolRows" :key="row.symbol">
                            <td>{{ row.symbol }}</td>
                            <td class="text-end">{{ useXDecFormat(row.count, 0) }}</td>
                            <td class="text-end">{{ useXDecFormat(row.winRate, 1) }}%</td>
                            <td
                                class="text-end"
                                :class="row.pl >= 0 ? 'text-success' : 'text-danger'"
                            >{{ useTwoDecCurrencyFormat(row.pl) }}</td>
                            <td
                                class="text-end"
                                :class="row.avgTrade >= 0 ? 'text-success' : 'text-danger'"
                            >{{ useTwoDecCurrencyFormat(row.avgTrade) }}</td>
                        </tr>
                        <tr v-if="symbolRows.length === 0">
                            <td colspan="5" class="text-center dashInfoTitle py-3">No data available</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
