<script setup>
import { computed, ref } from 'vue'
import { reportTagBreakdown, amountCase } from '../../stores/globals'
import { useThousandCurrencyFormat, useThousandFormat } from '../../utils/utils'

// Toggle state: 'summary' | 'detailed'
const viewMode = ref('summary')

// Largest absolute P&L value across all rows — used to scale the inline bar widths.
// Falls back to 1 to avoid division by zero when there is no data.
const maxPL = computed(() => {
    if (!reportTagBreakdown.length) return 1
    return Math.max(
        1,
        ...reportTagBreakdown.map(item => Math.abs(item[amountCase.value + 'PL'] ?? 0))
    )
})

// Compute a width percentage (0-100) for the inline bar of a given item.
function barWidth(item) {
    const value = Math.abs(item[amountCase.value + 'PL'] ?? 0)
    return Math.min((value / maxPL.value) * 100, 100)
}

// Determine bar colour based on sign.
function barColor(item) {
    return (item[amountCase.value + 'PL'] ?? 0) >= 0 ? '#22c55e' : '#ef4444'
}

// Format helpers — return '-' for missing/NaN values.
function fmtCurrency(value) {
    if (value == null || (typeof value === 'number' && isNaN(value))) return '-'
    return useThousandCurrencyFormat(value)
}

function fmtCount(value) {
    if (value == null || (typeof value === 'number' && isNaN(value))) return '-'
    return useThousandFormat(value)
}

function fmtPct(value) {
    if (value == null || (typeof value === 'number' && isNaN(value))) return '-'
    return (value * 100).toFixed(1) + '%'
}
</script>

<template>
    <div>
        <!-- ============================================================
             VIEW-MODE TOGGLE
        ============================================================ -->
        <div class="d-flex align-items-center gap-2 mb-3">
            <div class="btn-group" role="group" aria-label="View mode">
                <button
                    type="button"
                    :class="'btn btn-sm ' + (viewMode === 'summary' ? 'btn-primary' : 'btn-outline-secondary')"
                    @click="viewMode = 'summary'"
                >Summary</button>
                <button
                    type="button"
                    :class="'btn btn-sm ' + (viewMode === 'detailed' ? 'btn-primary' : 'btn-outline-secondary')"
                    @click="viewMode = 'detailed'"
                >Detailed</button>
            </div>
        </div>

        <!-- ============================================================
             TABLE
        ============================================================ -->
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        <th scope="col" class="dashInfoTitle">Tag</th>
                        <th scope="col" class="dashInfoTitle" style="min-width: 120px;">Graph</th>
                        <th scope="col" class="dashInfoTitle text-end">Gross P&amp;L</th>
                        <th scope="col" class="dashInfoTitle text-end">Count</th>
                        <th scope="col" class="dashInfoTitle text-end">Volume</th>

                        <!-- Additional columns shown only in detailed mode -->
                        <template v-if="viewMode === 'detailed'">
                            <th scope="col" class="dashInfoTitle text-end">Win Rate</th>
                            <th scope="col" class="dashInfoTitle text-end">Avg Trade</th>
                            <th scope="col" class="dashInfoTitle text-end">Avg Win</th>
                            <th scope="col" class="dashInfoTitle text-end">Avg Loss</th>
                        </template>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in reportTagBreakdown" :key="item.tagName">
                        <!-- Tag name -->
                        <td>{{ item.tagName }}</td>

                        <!-- Inline bar -->
                        <td>
                            <div
                                :style="{
                                    width: barWidth(item) + '%',
                                    height: '12px',
                                    backgroundColor: barColor(item),
                                    borderRadius: '2px',
                                    minWidth: barWidth(item) > 0 ? '2px' : '0'
                                }"
                            ></div>
                        </td>

                        <!-- Gross P&L -->
                        <td
                            class="text-end"
                            :class="(item[amountCase + 'PL'] ?? 0) >= 0 ? 'text-success' : 'text-danger'"
                        >
                            {{ fmtCurrency(item[amountCase + 'PL']) }}
                        </td>

                        <!-- Count -->
                        <td class="text-end">{{ fmtCount(item.count) }}</td>

                        <!-- Volume -->
                        <td class="text-end">{{ fmtCount(item.volume) }}</td>

                        <!-- Detailed-only columns -->
                        <template v-if="viewMode === 'detailed'">
                            <td class="text-end">{{ fmtPct(item.winRate) }}</td>
                            <td
                                class="text-end"
                                :class="(item.avgTrade ?? 0) >= 0 ? 'text-success' : 'text-danger'"
                            >{{ fmtCurrency(item.avgTrade) }}</td>
                            <td class="text-end text-success">{{ fmtCurrency(item.avgWin) }}</td>
                            <td class="text-end text-danger">{{ fmtCurrency(item.avgLoss) }}</td>
                        </template>
                    </tr>

                    <tr v-if="!reportTagBreakdown.length">
                        <td
                            :colspan="viewMode === 'detailed' ? 9 : 5"
                            class="text-center dashInfoTitle py-3"
                        >No tag data available</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
