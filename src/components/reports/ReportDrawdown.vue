<script setup>
import { reportDrawdownStats, renderData, reportChartsMounted } from '../../stores/globals'
import { useThousandCurrencyFormat, useTwoDecCurrencyFormat, useXDecFormat } from '../../utils/utils'

// Helper: return '-' when a value is null/undefined/NaN
function fmt(value, formatter) {
    if (value == null || (typeof value === 'number' && isNaN(value))) return '-'
    return formatter(value)
}
</script>

<template>
    <div>
        <div v-if="reportDrawdownStats.maxDrawdown != null">
            <!-- ============================================================
                 STAT CARDS ROW
            ============================================================ -->
            <div class="row mb-4">
                <!-- Average Drawdown -->
                <div class="col-6 col-lg mb-2 mb-lg-0">
                    <div class="dailyCard">
                        <h5 class="titleWithDesc">
                            {{ fmt(reportDrawdownStats.avgDrawdown, useTwoDecCurrencyFormat) }}
                        </h5>
                        <span class="dashInfoTitle">Average Drawdown</span>
                    </div>
                </div>

                <!-- Biggest Drawdown -->
                <div class="col-6 col-lg mb-2 mb-lg-0">
                    <div class="dailyCard">
                        <h5 class="titleWithDesc">
                            {{ fmt(reportDrawdownStats.maxDrawdown, useTwoDecCurrencyFormat) }}
                        </h5>
                        <span class="dashInfoTitle">Biggest Drawdown</span>
                    </div>
                </div>

                <!-- Avg Days in Drawdown -->
                <div class="col-6 col-lg mb-2 mb-lg-0">
                    <div class="dailyCard">
                        <h5 class="titleWithDesc">
                            {{ fmt(reportDrawdownStats.avgDaysInDrawdown, v => useXDecFormat(v, 1)) }}
                        </h5>
                        <span class="dashInfoTitle">Avg Days in Drawdown</span>
                    </div>
                </div>

                <!-- Total Days in Drawdown -->
                <div class="col-6 col-lg mb-2 mb-lg-0">
                    <div class="dailyCard">
                        <h5 class="titleWithDesc">
                            {{ fmt(reportDrawdownStats.daysInDrawdown, v => useXDecFormat(v, 0)) }}
                        </h5>
                        <span class="dashInfoTitle">Total Days in Drawdown</span>
                    </div>
                </div>

                <!-- Avg Trades in Drawdown -->
                <div class="col-6 col-lg mb-2 mb-lg-0">
                    <div class="dailyCard">
                        <h5 class="titleWithDesc">
                            {{ fmt(reportDrawdownStats.avgTradesInDrawdown, v => useXDecFormat(v, 1)) }}
                        </h5>
                        <span class="dashInfoTitle">Avg Trades in Drawdown</span>
                    </div>
                </div>
            </div>

            <!-- ============================================================
                 CHART: DRAWDOWN
            ============================================================ -->
            <div class="row mb-3">
                <div class="col-12">
                    <div class="dailyCard p-2">
                        <h6 class="ps-2 pt-1">Drawdown</h6>
                        <div v-bind:key="renderData" id="reportDrawdownChart" class="chartClass"></div>
                    </div>
                </div>
            </div>

            <!-- ============================================================
                 CHART: P&L MOVING AVERAGE
            ============================================================ -->
            <div class="row mb-3">
                <div class="col-12">
                    <div class="dailyCard p-2">
                        <h6 class="ps-2 pt-1">P&amp;L Moving Average</h6>
                        <div v-bind:key="renderData" id="reportMovingAvgChart" class="chartClass"></div>
                    </div>
                </div>
            </div>

            <!-- ============================================================
                 CHART: P&L VOLATILITY
            ============================================================ -->
            <div class="row mb-3">
                <div class="col-12">
                    <div class="dailyCard p-2">
                        <h6 class="ps-2 pt-1">P&amp;L Volatility</h6>
                        <div v-bind:key="renderData" id="reportVolatilityChart" class="chartClass"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- No-data state shown when drawdown stats have not been computed yet -->
        <div v-else class="text-center dashInfoTitle py-5">
            No drawdown data available for the selected period
        </div>
    </div>
</template>
