<script setup>
import { reportWinDayStats, reportLossDayStats } from '../../stores/globals'
import { useThousandCurrencyFormat, useTwoDecCurrencyFormat, useXDecFormat } from '../../utils/utils'

// Helper: return '-' when a value is null/undefined/NaN
function fmt(value, formatter) {
    if (value == null || (typeof value === 'number' && isNaN(value))) return '-'
    return formatter(value)
}
</script>

<template>
    <div>
        <div class="row">
            <!-- ============================================================
                 WINNING DAYS COLUMN
            ============================================================ -->
            <div class="col-12 col-lg-6 mb-3">
                <div class="dailyCard p-3">
                    <h5 class="titleWithDesc mb-3" style="color: #22c55e;">Winning Days</h5>

                    <div v-if="reportWinDayStats.numTrades != null">
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Total Gain</div>
                            <div class="col-4 text-end text-success">
                                {{ fmt(reportWinDayStats.totalPL, useThousandCurrencyFormat) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Daily Gain</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.avgDailyPL, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Daily Volume</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.avgDailyVolume, v => useXDecFormat(v, 0)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Per-Share Gain</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.avgWinPerShare, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Trade Gain</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.avgWinningTrade, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>

                        <hr class="my-2" />

                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Total Number of Trades</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.numTrades, v => useXDecFormat(v, 0)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Winning Trades</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.winsCount, v => useXDecFormat(v, 0)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Losing Trades</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.lossCount, v => useXDecFormat(v, 0)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Winning Trade</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.avgWinningTrade, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Losing Trade</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.avgLosingTrade, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>

                        <hr class="my-2" />

                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Trade P&amp;L Std Deviation</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.stdDeviation, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Probability of Random Chance</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.probRandomChance, v => useXDecFormat(v, 2) + '%') }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">K-Ratio</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.kRatio, v => useXDecFormat(v, 4)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">SQN</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.sqn, v => useXDecFormat(v, 2)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Kelly %</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportWinDayStats.kellyPct, v => useXDecFormat(v, 2) + '%') }}
                            </div>
                        </div>

                        <hr class="my-2" />

                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Hold Time (Winners)</div>
                            <div class="col-4 text-end">
                                {{ reportWinDayStats.avgHoldTimeWinners ?? '-' }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Hold Time (Losers)</div>
                            <div class="col-4 text-end">
                                {{ reportWinDayStats.avgHoldTimeLosers ?? '-' }}
                            </div>
                        </div>
                    </div>

                    <div v-else class="text-center dashInfoTitle py-3">
                        No winning days in selected period
                    </div>
                </div>
            </div>

            <!-- ============================================================
                 LOSING DAYS COLUMN
            ============================================================ -->
            <div class="col-12 col-lg-6 mb-3">
                <div class="dailyCard p-3">
                    <h5 class="titleWithDesc mb-3" style="color: #ef4444;">Losing Days</h5>

                    <div v-if="reportLossDayStats.numTrades != null">
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Total Loss</div>
                            <div class="col-4 text-end text-danger">
                                {{ fmt(reportLossDayStats.totalPL, useThousandCurrencyFormat) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Daily Loss</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.avgDailyPL, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Daily Volume</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.avgDailyVolume, v => useXDecFormat(v, 0)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Per-Share Loss</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.avgLossPerShare, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Trade Loss</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.avgLosingTrade, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>

                        <hr class="my-2" />

                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Total Number of Trades</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.numTrades, v => useXDecFormat(v, 0)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Winning Trades</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.winsCount, v => useXDecFormat(v, 0)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Losing Trades</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.lossCount, v => useXDecFormat(v, 0)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Winning Trade</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.avgWinningTrade, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Losing Trade</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.avgLosingTrade, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>

                        <hr class="my-2" />

                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Trade P&amp;L Std Deviation</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.stdDeviation, useTwoDecCurrencyFormat) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Probability of Random Chance</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.probRandomChance, v => useXDecFormat(v, 2) + '%') }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">K-Ratio</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.kRatio, v => useXDecFormat(v, 4)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">SQN</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.sqn, v => useXDecFormat(v, 2)) }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Kelly %</div>
                            <div class="col-4 text-end">
                                {{ fmt(reportLossDayStats.kellyPct, v => useXDecFormat(v, 2) + '%') }}
                            </div>
                        </div>

                        <hr class="my-2" />

                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Hold Time (Winners)</div>
                            <div class="col-4 text-end">
                                {{ reportLossDayStats.avgHoldTimeWinners ?? '-' }}
                            </div>
                        </div>
                        <div class="row mb-1">
                            <div class="col-8 text-start dashInfoTitle">Avg Hold Time (Losers)</div>
                            <div class="col-4 text-end">
                                {{ reportLossDayStats.avgHoldTimeLosers ?? '-' }}
                            </div>
                        </div>
                    </div>

                    <div v-else class="text-center dashInfoTitle py-3">
                        No losing days in selected period
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
