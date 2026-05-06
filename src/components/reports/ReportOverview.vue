<script setup>
import { ref, computed } from 'vue'
import {
    reportChartsMounted,
    renderData,
    totalsByDate,
    amountCase,
    timeZoneTrade,
    reportOverviewPeriod,
    reportOverviewSubTab,
    filteredTrades
} from '../../stores/globals'
import { useThousandCurrencyFormat } from '../../utils/utils'
import calendarize from 'calendarize'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)
import timezone from 'dayjs/plugin/timezone.js'
dayjs.extend(timezone)

// ── Calendar sub-tab ──────────────────────────────────────────────────────────

const calendarYear = ref(dayjs().year())

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

/**
 * Build 12 months of calendar data for the selected year.
 * Each day cell is enriched with hasData / profit flags drawn from totalsByDate.
 */
const yearlyCalendarData = computed(() => {
    const year = calendarYear.value
    const result = []

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        // Build a JS Date that lands inside this month/year so calendarize can
        // work out the correct weekday offset. We use a local string that is
        // timezone-safe because calendarize only needs the date part.
        const dateForCalendarize = new Date(year, monthIndex, 1)

        // calendarize with offset 0 means weeks start on Sunday
        const rawWeeks = calendarize(dateForCalendarize, 0)

        const weeks = rawWeeks.map(week =>
            week.map(dayNum => {
                if (dayNum === 0) {
                    return { num: 0, hasData: false, profit: false }
                }

                // Build an ISO date string for this day so we can compare
                // against the unix-keyed totalsByDate without timezone drift.
                const mm = String(monthIndex + 1).padStart(2, '0')
                const dd = String(dayNum).padStart(2, '0')
                const isoDate = `${year}-${mm}-${dd}`

                let hasData = false
                let profit = false

                // totalsByDate keys are unix timestamps (start-of-day in trade TZ)
                for (const tsKey of Object.keys(totalsByDate)) {
                    const entry = totalsByDate[tsKey]
                    const tz = timeZoneTrade.value || 'America/New_York'
                    const entryDay = dayjs.unix(Number(tsKey)).tz(tz)

                    if (
                        entryDay.year() === year &&
                        entryDay.month() === monthIndex &&
                        entryDay.date() === dayNum
                    ) {
                        hasData = true
                        const proceeds = entry[(amountCase.value || 'gross') + 'Proceeds'] || 0
                        profit = proceeds >= 0
                        break
                    }
                }

                return { num: dayNum, hasData, profit }
            })
        )

        result.push({ name: MONTH_NAMES[monthIndex], weeks })
    }

    return result
})
</script>

<template>
    <!-- ── Sub-navigation ─────────────────────────────────────────────────── -->
    <div class="d-flex align-items-center gap-2 mb-3">
        <button
            :class="'btn btn-sm ' + (reportOverviewSubTab == 'recent' ? 'btn-primary' : 'btn-outline-secondary')"
            @click="reportOverviewSubTab = 'recent'"
            type="button"
        >
            Recent
        </button>
        <button
            :class="'btn btn-sm ' + (reportOverviewSubTab == 'calendar' ? 'btn-primary' : 'btn-outline-secondary')"
            @click="reportOverviewSubTab = 'calendar'"
            type="button"
        >
            Calendar
        </button>
    </div>

    <!-- ── RECENT sub-tab ─────────────────────────────────────────────────── -->
    <div v-show="reportOverviewSubTab == 'recent'">

        <!-- Period toggle -->
        <div class="d-flex align-items-center gap-2 mb-3">
            <span class="dashInfoTitle">Period:</span>
            <button
                v-for="period in [30, 60, 90]"
                :key="period"
                :class="'btn btn-sm ' + (reportOverviewPeriod == period ? 'btn-primary' : 'btn-outline-secondary')"
                @click="reportOverviewPeriod = period"
                type="button"
            >
                {{ period }}
            </button>
        </div>

        <!-- 2 × 2 chart grid -->
        <div class="row">
            <!-- Gross Daily P&L -->
            <div class="col-12 col-xl-6 mb-3">
                <div class="dailyCard">
                    <h6>Daily P&amp;L</h6>
                    <div
                        v-bind:key="renderData"
                        id="reportDailyPLChart"
                        class="chartClass"
                    ></div>
                </div>
            </div>

            <!-- Gross Cumulative P&L -->
            <div class="col-12 col-xl-6 mb-3">
                <div class="dailyCard">
                    <h6>Cumulative P&amp;L</h6>
                    <div
                        v-bind:key="renderData"
                        id="reportCumulativePLChart"
                        class="chartClass"
                    ></div>
                </div>
            </div>

            <!-- Daily Volume -->
            <div class="col-12 col-xl-6 mb-3">
                <div class="dailyCard">
                    <h6>Daily Volume</h6>
                    <div
                        v-bind:key="renderData"
                        id="reportDailyVolumeChart"
                        class="chartClass"
                    ></div>
                </div>
            </div>

            <!-- Win Rate -->
            <div class="col-12 col-xl-6 mb-3">
                <div class="dailyCard">
                    <h6>Win Rate</h6>
                    <div
                        v-bind:key="renderData"
                        id="reportWinRateChart"
                        class="chartClass"
                    ></div>
                </div>
            </div>
        </div>
    </div>

    <!-- ── CALENDAR sub-tab ───────────────────────────────────────────────── -->
    <div v-show="reportOverviewSubTab == 'calendar'">

        <!-- Year selector header -->
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">Yearly Calendar</h6>
            <div class="d-flex align-items-center gap-1">
                <button
                    class="btn btn-sm btn-outline-secondary"
                    @click="calendarYear--"
                    type="button"
                    aria-label="Previous year"
                >
                    <i class="uil uil-angle-left-b"></i>
                </button>
                <span class="fw-bold px-1">{{ calendarYear }}</span>
                <button
                    class="btn btn-sm btn-outline-secondary"
                    @click="calendarYear++"
                    type="button"
                    aria-label="Next year"
                >
                    <i class="uil uil-angle-right-b"></i>
                </button>
            </div>
        </div>

        <!-- 12-month grid  (3 columns on md+, 2 on sm, 1 on xs) -->
        <div class="row">
            <div
                v-for="(monthData, monthIndex) in yearlyCalendarData"
                :key="monthIndex"
                class="col-6 col-md-4 col-xl-3 mb-3"
            >
                <div class="dailyCard p-2">

                    <!-- Month name -->
                    <div class="fw-bold mb-1 small">{{ monthData.name }}</div>

                    <!-- Weekday headers -->
                    <div class="d-flex small text-muted mb-1">
                        <div
                            v-for="d in ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']"
                            :key="d"
                            style="width: 14.28%; text-align: center;"
                        >
                            {{ d }}
                        </div>
                    </div>

                    <!-- Day rows -->
                    <div
                        v-for="(week, wi) in monthData.weeks"
                        :key="wi"
                        class="d-flex"
                    >
                        <div
                            v-for="(day, di) in week"
                            :key="di"
                            style="width: 14.28%; text-align: center; padding: 1px;"
                        >
                            <div
                                v-if="day.num > 0"
                                :style="
                                    'border-radius: 2px; font-size: 11px; ' +
                                    (day.hasData
                                        ? (day.profit
                                            ? 'background-color: rgba(34,197,94,0.6); color: #fff;'
                                            : 'background-color: rgba(239,68,68,0.6); color: #fff;')
                                        : '')
                                "
                            >
                                {{ day.num }}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>

    </div>
</template>

<!--
Usage example
─────────────
Import and register the component inside a parent view (e.g. Reports.vue).

    import ReportOverview from '../components/reports/ReportOverview.vue'

    <ReportOverview />

The component reads / writes the following globals from stores/globals.js:
  • reportOverviewSubTab   – 'recent' | 'calendar'
  • reportOverviewPeriod   – 30 | 60 | 90
  • totalsByDate           – populated by useTotalTrades()
  • amountCase             – 'gross' | 'net'
  • timeZoneTrade          – IANA timezone string
  • renderData             – incremented by the parent mount routine to force
                             ECharts re-render via v-bind:key

Chart rendering (reportDailyPLChart, reportCumulativePLChart,
reportDailyVolumeChart, reportWinRateChart) is driven by useECharts("init")
called from useMountReports() in utils.js after reportChartsMounted is set
to true.
-->
