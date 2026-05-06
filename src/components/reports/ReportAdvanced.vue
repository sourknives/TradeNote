<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import {
    filteredTradesTrades,
    amountCase,
    renderData,
    reportChartsMounted,
    reportAdvancedXAxis,
    reportAdvancedYAxis
} from '../../stores/globals'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)

// ── Axis configuration ────────────────────────────────────────────────────────

const axisOptions = [
    { value: 'pAndL',      label: 'P&L' },
    { value: 'perSharePL', label: 'Per-Share P&L' },
    { value: 'duration',   label: 'Duration (min)' },
    { value: 'volume',     label: 'Volume' },
    { value: 'entryPrice', label: 'Entry Price' },
    { value: 'dayOfWeek',  label: 'Day of Week' },
    { value: 'timeOfDay',  label: 'Time of Day' },
    { value: 'commission', label: 'Commission' }
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Chart instance ────────────────────────────────────────────────────────────

let chartInstance = null

// ── Value extractor ───────────────────────────────────────────────────────────

/**
 * Extract the numeric value for a single trade given an axis key.
 * Returns null when the required field is missing so that the caller can
 * skip the data point gracefully.
 */
function extractValue(trade, axisKey) {
    const ac = amountCase.value || 'gross'

    switch (axisKey) {
        case 'pAndL': {
            const v = trade[ac + 'Proceeds']
            return v != null ? Number(v) : null
        }
        case 'perSharePL': {
            const v = trade[ac + 'SharePL']
            return v != null ? Number(v) : null
        }
        case 'duration': {
            if (trade.exitTime == null || trade.entryTime == null) return null
            return (trade.exitTime - trade.entryTime) / 60
        }
        case 'volume': {
            const v = trade.buyQuantity != null ? trade.buyQuantity : trade.quantity
            return v != null ? Number(v) : null
        }
        case 'entryPrice': {
            return trade.entryPrice != null ? Number(trade.entryPrice) : null
        }
        case 'dayOfWeek': {
            if (trade.td == null && trade.entryTime == null) return null
            const ts = trade.td != null ? trade.td : trade.entryTime
            return dayjs.unix(Number(ts)).day()
        }
        case 'timeOfDay': {
            if (trade.entryTime == null) return null
            // Return fractional hours so the axis is continuous (e.g. 9.5 = 09:30)
            const d = dayjs.unix(Number(trade.entryTime))
            return d.hour() + d.minute() / 60
        }
        case 'commission': {
            return trade.commission != null ? Number(trade.commission) : null
        }
        default:
            return null
    }
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function getAxisLabel(value) {
    return axisOptions.find(o => o.value === value)?.label || value
}

/**
 * For 'dayOfWeek' we want categorical tick labels rather than bare numbers.
 */
function buildAxisConfig(axisKey) {
    if (axisKey === 'dayOfWeek') {
        return {
            type: 'category',
            data: DAY_LABELS
        }
    }
    return { type: 'value' }
}

// ── Chart render ──────────────────────────────────────────────────────────────

function renderScatterChart() {
    const el = document.getElementById('reportScatterChart')
    if (!el) return

    // Dispose of the previous instance before re-initialising to prevent
    // ECharts from stacking multiple canvases on the same DOM node.
    if (chartInstance) {
        chartInstance.dispose()
        chartInstance = null
    }

    chartInstance = echarts.init(el)

    const xKey = reportAdvancedXAxis.value
    const yKey = reportAdvancedYAxis.value
    const ac = amountCase.value || 'gross'

    const scatterData = []

    filteredTradesTrades.forEach(trade => {
        const x = extractValue(trade, xKey)
        const y = extractValue(trade, yKey)
        if (x == null || y == null) return

        // Third element carries the gross proceeds so the colour callback can
        // determine win/loss without needing a closure over amountCase.
        const proceeds = trade[ac + 'Proceeds'] != null ? Number(trade[ac + 'Proceeds']) : 0

        // For 'dayOfWeek' axis, map the numeric day to its label string so
        // that ECharts plots it against the category axis correctly.
        const xPlot = xKey === 'dayOfWeek' ? DAY_LABELS[x] : x
        const yPlot = yKey === 'dayOfWeek' ? DAY_LABELS[y] : y

        scatterData.push([xPlot, yPlot, proceeds])
    })

    const xAxisConfig = {
        ...buildAxisConfig(xKey),
        name: getAxisLabel(xKey),
        nameLocation: 'center',
        nameGap: 30
    }

    const yAxisConfig = {
        ...buildAxisConfig(yKey),
        name: getAxisLabel(yKey),
        nameLocation: 'center',
        nameGap: 50
    }

    chartInstance.setOption({
        tooltip: {
            trigger: 'item',
            formatter(params) {
                const [x, y, proceeds] = params.data
                const xLabel = getAxisLabel(xKey)
                const yLabel = getAxisLabel(yKey)
                return `${xLabel}: ${x}<br/>${yLabel}: ${y}<br/>P&L: ${proceeds >= 0 ? '+' : ''}${proceeds.toFixed(2)}`
            }
        },
        grid: {
            containLabel: true,
            left: '5%',
            right: '5%',
            bottom: '10%',
            top: '8%'
        },
        xAxis: xAxisConfig,
        yAxis: yAxisConfig,
        series: [
            {
                type: 'scatter',
                data: scatterData,
                symbolSize: 8,
                itemStyle: {
                    // params.data[2] is the proceeds value stored above
                    color(params) {
                        return params.data[2] >= 0 ? '#22c55e' : '#ef4444'
                    },
                    opacity: 0.8
                }
            }
        ]
    })

    // Make the chart responsive when its container is resized.
    window.addEventListener('resize', () => {
        if (chartInstance && !chartInstance.isDisposed()) {
            chartInstance.resize()
        }
    })
}

// ── Lifecycle + watchers ──────────────────────────────────────────────────────

onMounted(async () => {
    await nextTick()
    if (reportChartsMounted.value) {
        renderScatterChart()
    }
})

// Re-render when the user changes an axis dropdown
watch(reportAdvancedXAxis, () => {
    nextTick(renderScatterChart)
})

watch(reportAdvancedYAxis, () => {
    nextTick(renderScatterChart)
})

// Re-render when global data refreshes (renderData incremented by parent)
watch(renderData, async () => {
    await nextTick()
    if (reportChartsMounted.value) {
        renderScatterChart()
    }
})
</script>

<template>
    <div class="dailyCard">

        <!-- ── Axis selectors ─────────────────────────────────────────────── -->
        <div class="row g-2 mb-3">
            <div class="col-12 col-sm-6">
                <label class="dashInfoTitle d-block mb-1" for="xAxisSelect">
                    X-Axis
                </label>
                <select
                    id="xAxisSelect"
                    v-model="reportAdvancedXAxis"
                    class="form-select form-select-sm"
                    aria-label="X-axis metric"
                >
                    <option
                        v-for="opt in axisOptions"
                        :key="opt.value"
                        :value="opt.value"
                    >
                        {{ opt.label }}
                    </option>
                </select>
            </div>

            <div class="col-12 col-sm-6">
                <label class="dashInfoTitle d-block mb-1" for="yAxisSelect">
                    Y-Axis
                </label>
                <select
                    id="yAxisSelect"
                    v-model="reportAdvancedYAxis"
                    class="form-select form-select-sm"
                    aria-label="Y-axis metric"
                >
                    <option
                        v-for="opt in axisOptions"
                        :key="opt.value"
                        :value="opt.value"
                    >
                        {{ opt.label }}
                    </option>
                </select>
            </div>
        </div>

        <!-- ── Scatter chart ──────────────────────────────────────────────── -->
        <div
            id="reportScatterChart"
            style="width: 100%; height: 500px;"
            role="img"
            :aria-label="'Scatter chart of ' + getAxisLabel(reportAdvancedXAxis) + ' vs ' + getAxisLabel(reportAdvancedYAxis)"
        ></div>

    </div>
</template>

<!--
Usage example
─────────────
Import and register the component inside a parent view (e.g. Reports.vue).

    import ReportAdvanced from '../components/reports/ReportAdvanced.vue'

    <ReportAdvanced />

The component reads the following globals from stores/globals.js:
  • filteredTradesTrades   – flat array of all filtered trade objects
  • amountCase             – 'gross' | 'net' (determines which P&L fields to read)
  • renderData             – incremented by useMountReports() to trigger
                             a full chart re-render after data refreshes
  • reportChartsMounted    – set to true by useMountReports() once data is ready
  • reportAdvancedXAxis    – persisted x-axis selection (default: 'pAndL')
  • reportAdvancedYAxis    – persisted y-axis selection (default: 'volume')

Scatter point colours:
  • Green  (#22c55e) – trade P&L >= 0
  • Red    (#ef4444) – trade P&L <  0

Each axis option and its field mapping:
  pAndL       → trade[amountCase + 'Proceeds']
  perSharePL  → trade[amountCase + 'SharePL']
  duration    → (exitTime - entryTime) / 60  (minutes)
  volume      → trade.buyQuantity || trade.quantity
  entryPrice  → trade.entryPrice
  dayOfWeek   → dayjs.unix(trade.td).day()   (0=Sun … 6=Sat)
  timeOfDay   → fractional hours from trade.entryTime
  commission  → trade.commission
-->
