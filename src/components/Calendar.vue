<script setup>
import { computed } from 'vue'
import { pageId, selectedMonth, selectedPlSatisfaction, amountCase, calendarData, miniCalendarsData, timeZoneTrade, spinnerLoadingPage, calendarViewMode } from '../stores/globals';
import { useThousandCurrencyFormat, useMountCalendar, useMountDaily } from '../utils/utils';
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)
import isoWeek from 'dayjs/plugin/isoWeek.js'
dayjs.extend(isoWeek)
import timezone from 'dayjs/plugin/timezone.js'
dayjs.extend(timezone)
import duration from 'dayjs/plugin/duration.js'
dayjs.extend(duration)
import updateLocale from 'dayjs/plugin/updateLocale.js'
dayjs.extend(updateLocale)
import localizedFormat from 'dayjs/plugin/localizedFormat.js'
dayjs.extend(localizedFormat)
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
dayjs.extend(customParseFormat)


const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

// ── Bundle 1 enhancements ─────────────────────────────────────────────────────

// Sum of P/L for each week row in the currently displayed month.
const weeklyTotals = computed(() => {
    const totals = []
    if (!calendarData) return totals
    for (const wkIndex in calendarData) {
        const week = calendarData[wkIndex]
        if (!Array.isArray(week)) continue
        let sum = 0
        for (const cell of week) {
            if (cell && cell !== 0 && cell.pAndL && typeof cell.pAndL[amountCase.value + 'Proceeds'] === 'number') {
                sum += cell.pAndL[amountCase.value + 'Proceeds']
            }
        }
        totals.push(sum)
    }
    return totals
})

// Total P/L and trade count for the currently displayed month.
const monthlyTotal = computed(() => {
    let sum = 0
    let trades = 0
    if (!calendarData) return { sum, trades }
    for (const wkIndex in calendarData) {
        const week = calendarData[wkIndex]
        if (!Array.isArray(week)) continue
        for (const cell of week) {
            if (cell && cell !== 0 && cell.pAndL) {
                if (typeof cell.pAndL[amountCase.value + 'Proceeds'] === 'number') {
                    sum += cell.pAndL[amountCase.value + 'Proceeds']
                }
                if (typeof cell.pAndL.trades === 'number') {
                    trades += cell.pAndL.trades
                }
            }
        }
    }
    return { sum, trades }
})

// Click handler for day cells on the main Calendar view.
function jumpToDaily(cell) {
    if (!cell || cell === 0) return
    if (!cell.pAndL || !cell.pAndL.trades) return  // only clickable if there are trades
    localStorage.setItem('selectedMonth', JSON.stringify(selectedMonth.value))
    window.location.href = '/daily'
}

//console.log("perdio range "+JSON.stringify(periodRange))

async function monthLastNext(param) {
    await (spinnerLoadingPage.value = true)
    selectedMonth.value.start = dayjs.tz(selectedMonth.value.start * 1000, timeZoneTrade.value).add(param, 'month').startOf('month').unix()
    /* reuse just created .start because we only show one month at a time */
    selectedMonth.value.end = dayjs.tz(selectedMonth.value.start * 1000, timeZoneTrade.value).endOf('month').unix()
    //console.log("selectedMonth.value.start " + selectedMonth.value.start+" selectedMonth.value.end " + selectedMonth.value.end)
    localStorage.setItem('selectedMonth', JSON.stringify(selectedMonth.value))
    
    if (pageId.value == "calendar") {
        useMountCalendar()
    }

    if (pageId.value == "daily") {
        useMountDaily()
    }
}
</script>
<template>
    <div class="col-12">
        <div v-bind:class="[pageId === 'calendar' ? 'justify-content-center' : '', 'row']">
            <div v-bind:class="[pageId === 'calendar' ? 'col-md-9 col-xl-6' : '', 'col-12']">
                <div class="row align-items-center">
                    <div class="col-2">
                        <i class="uil uil-angle-left-b pointerClass" v-on:click="monthLastNext(-1)"></i>
                    </div>
                    <div class="col-8 text-center">
                        <span v-if="calendarData.hasOwnProperty(0)" class="fw-bold">
                            {{ calendarData[0][0].month }}
                        </span>
                        <span
                            v-if="pageId === 'calendar' && monthlyTotal.trades > 0"
                            v-bind:class="monthlyTotal.sum >= 0 ? 'text-success ms-3' : 'text-danger ms-3'"
                        >
                            {{ useThousandCurrencyFormat(parseInt(monthlyTotal.sum)) }}
                        </span>
                        <span
                            v-if="pageId === 'calendar' && monthlyTotal.trades > 0"
                            class="dashInfoTitle ms-2"
                        >
                            · {{ monthlyTotal.trades }} trade{{ monthlyTotal.trades === 1 ? '' : 's' }}
                        </span>
                    </div>
                    <div class="col-2 text-end">
                        <i class="uil uil-angle-right-b pointerClass" v-on:click="monthLastNext(1)"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div v-bind:class="[pageId === 'calendar' ? 'col-md-10 col-xl-9 col-xxl-6 mb-5' : '', 'col-12']">
        <div class="row">
            <div class="col" v-for="(day, index) in days">
                <div>{{ day }}</div>
                <div v-for="line in calendarData">
                    <div class="row">
                        <div v-show="line[index] != 0"
                            v-on:click="pageId === 'calendar' ? jumpToDaily(line[index]) : null"
                            v-bind:class="[
                                {
                                    'greenTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] >= 0 : line[index].satisfaction == true,
                                    'redTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] < 0 : line[index].satisfaction == false,
                                    'calDivDay': pageId == 'daily',
                                    'calDivDash': pageId == 'calendar',
                                    'pointerClass': pageId === 'calendar' && line[index] && line[index].pAndL && line[index].pAndL.trades
                                },
                                'col'
                            ]"
                            v-bind:style="'position: relative;'">
                            <p class="mb-1 dayNumber" v-show="line[index].day != 0">{{ line[index].day }}</p>
                            <i
                                v-if="line[index].satisfaction === true"
                                class="uil uil-thumbs-up"
                                style="position: absolute; top: 2px; right: 4px; font-size: 12px; color: #22c55e;"
                            ></i>
                            <i
                                v-if="line[index].satisfaction === false"
                                class="uil uil-thumbs-down"
                                style="position: absolute; top: 2px; right: 4px; font-size: 12px; color: #ef4444;"
                            ></i>
                            <div v-if="pageId == 'calendar'" class="d-none d-md-block">
                                <p v-show="line[index].pAndL.trades">{{ line[index].pAndL.trades }} trades</p>
                                <p v-show="line[index].pAndL[amountCase + 'Proceeds']">
                                    {{ useThousandCurrencyFormat(parseInt(line[index].pAndL[amountCase + 'Proceeds'])) }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Weekly P/L column (only on /calendar; not on /daily widget) ─── -->
            <div class="col" v-if="pageId === 'calendar'">
                <div>Week</div>
                <div v-for="(weekTotal, wi) in weeklyTotals" :key="'wt-' + wi">
                    <div class="row">
                        <div
                            v-bind:class="[
                                {
                                    'greenTradeDiv': weekTotal > 0,
                                    'redTradeDiv': weekTotal < 0,
                                    'calDivDash': true
                                },
                                'col'
                            ]"
                        >
                            <p v-show="weekTotal !== 0" class="mb-1 small fw-bold">
                                {{ useThousandCurrencyFormat(parseInt(weekTotal)) }}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div v-show="pageId == 'calendar'" class="col-12">
        <div class="row">
            <div :class="calendarViewMode == 'yearly' ? 'col-6 col-md-4 col-xl-3 mb-3' : 'col-12 col-md-4 col-xl-3 mb-3'" v-for="(calData, index) in miniCalendarsData">
                <div class="row me-2">
                    <div>{{ calData[0][0].month }}</div>
                    <div class="col miniCalBox" v-for="(day, index) in days">
                        <div>{{ day }}</div>
                        <div v-for="line in calData">
                            <div class="row">
                                <div v-show="line[index] != 0"
                                    v-bind:class="[{ 'greenTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] >= 0 : line[index].satisfaction == true, 'redTradeDiv': selectedPlSatisfaction == 'pl' ? line[index].pAndL[amountCase + 'Proceeds'] < 0 : line[index].satisfaction == false }, 'calDivMini', 'col']"
                                    v-bind:style="'position: relative;'">
                                    <p class="mb-1 dayNumber" v-show="line[index].day != 0">{{ line[index].day }}</p>
                                    <i
                                        v-if="line[index].satisfaction === true"
                                        class="uil uil-thumbs-up"
                                        style="position: absolute; top: 0; right: 1px; font-size: 9px; color: #22c55e;"
                                    ></i>
                                    <i
                                        v-if="line[index].satisfaction === false"
                                        class="uil uil-thumbs-down"
                                        style="position: absolute; top: 0; right: 1px; font-size: 9px; color: #ef4444;"
                                    ></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>