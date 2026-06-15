<script setup>
import { computed } from 'vue'
import { pageId, selectedMonth, selectedPlSatisfaction, amountCase, amountCapital, selectedGrossNet, calendarData, miniCalendarsData, timeZoneTrade, spinnerLoadingPage, calendarViewMode } from '../stores/globals';
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

// ── Helpers to filter out the __monthStartUnix meta key when iterating ───
// calendarData and per-mini-cal calData both have numeric week-row keys
// (0, 1, 2, ...) plus a non-numeric `__monthStartUnix` meta key. The
// `weekRows` computed/helper drops the meta when iterating in templates.
function weekRowsOf(data) {
    if (!data) return []
    return Object.keys(data)
        .filter(k => !isNaN(Number(k)))
        .sort((a, b) => Number(a) - Number(b))
        .map(k => data[k])
}
const mainWeekRows = computed(() => weekRowsOf(calendarData))

// ── Per-week summed P/L (for the rightmost "Week N" column) ──────────────
const weeklyTotals = computed(() => {
    return mainWeekRows.value.map(week => {
        if (!Array.isArray(week)) return 0
        let sum = 0
        for (const cell of week) {
            if (cell && cell !== 0 && cell.pAndL && typeof cell.pAndL[amountCase.value + 'Proceeds'] === 'number') {
                sum += cell.pAndL[amountCase.value + 'Proceeds']
            }
        }
        return sum
    })
})

// ── Per-week summed trade count (for the rightmost "Week N" column) ─────
const weeklyTradeCounts = computed(() => {
    return mainWeekRows.value.map(week => {
        if (!Array.isArray(week)) return 0
        let count = 0
        for (const cell of week) {
            if (cell && cell !== 0 && cell.pAndL && typeof cell.pAndL.trades === 'number') {
                count += cell.pAndL.trades
            }
        }
        return count
    })
})

// ── Total P/L and trade count for the displayed month ───────────────────
const monthlyTotal = computed(() => {
    let sum = 0
    let trades = 0
    for (const week of mainWeekRows.value) {
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

// ── P&L value extractor for a single day cell (signed number or null) ──
function cellPL(cell) {
    if (!cell || cell === 0 || !cell.pAndL) return null
    const v = cell.pAndL[amountCase.value + 'Proceeds']
    return typeof v === 'number' ? v : null
}

// ── Gross/Net toggle (Calendar) ─────────────────────────────────────────
// Uses the app-wide selectedGrossNet localStorage key so the choice persists
// and stays consistent across views. The grid reads amountCase reactively, so
// no refetch/remount is needed.
function pickGrossNetCalendar(value) {
    selectedGrossNet.value = value
    amountCase.value = value
    amountCapital.value = value.charAt(0).toUpperCase() + value.slice(1)
    localStorage.setItem('selectedGrossNet', value)
}

// ── Click handlers ──────────────────────────────────────────────────────
async function monthLastNext(param) {
    await (spinnerLoadingPage.value = true)
    selectedMonth.value.start = dayjs.tz(selectedMonth.value.start * 1000, timeZoneTrade.value).add(param, 'month').startOf('month').unix()
    selectedMonth.value.end = dayjs.tz(selectedMonth.value.start * 1000, timeZoneTrade.value).endOf('month').unix()
    localStorage.setItem('selectedMonth', JSON.stringify(selectedMonth.value))

    if (pageId.value == "calendar") useMountCalendar()
    if (pageId.value == "daily") useMountDaily()
}

function jumpToDaily(cell) {
    if (!cell || cell === 0) return
    if (!cell.pAndL || !cell.pAndL.trades) return
    if (cell.dateUnix) {
        sessionStorage.setItem('jumpToDailyDate', String(cell.dateUnix))
    }
    localStorage.setItem('selectedMonth', JSON.stringify(selectedMonth.value))
    window.location.href = '/daily'
}

async function jumpToMiniMonth(calData) {
    const monthStart = calData.__monthStartUnix
    if (!monthStart) return
    if (monthStart === selectedMonth.value.start) return // already here
    await (spinnerLoadingPage.value = true)
    selectedMonth.value = {
        start: monthStart,
        end: dayjs.unix(monthStart).tz(timeZoneTrade.value).endOf('month').unix()
    }
    localStorage.setItem('selectedMonth', JSON.stringify(selectedMonth.value))
    useMountCalendar(true)
}
</script>
<template>
    <!-- ── Gross/Net toggle (Calendar only) ──────────────────────────────── -->
    <div v-show="pageId === 'calendar'" class="col-12 d-flex justify-content-center mb-1">
        <div style="display:inline-flex; gap:6px; align-items:center; font-size:13px;">
            <span class="pointerClass"
                v-bind:class="amountCase === 'gross' ? 'fw-bold' : 'dashInfoTitle'"
                v-on:click="pickGrossNetCalendar('gross')">Gross</span>
            <span class="dashInfoTitle">/</span>
            <span class="pointerClass"
                v-bind:class="amountCase === 'net' ? 'fw-bold' : 'dashInfoTitle'"
                v-on:click="pickGrossNetCalendar('net')">Net</span>
        </div>
    </div>

    <!-- ── Header row above the main grid: ◀  Month YYYY  $±total/trades ── -->
    <div class="col-12">
        <div v-bind:class="[pageId === 'calendar' ? 'justify-content-center' : '', 'row']">
            <div v-bind:class="[pageId === 'calendar' ? 'col-12' : '', 'col-12']">
                <div class="row align-items-center">
                    <!-- Left arrow + month name (left/center cluster) -->
                    <div class="col-9 col-md-9 col-xl-9 d-flex align-items-center justify-content-center">
                        <i class="uil uil-angle-left-b pointerClass me-2" v-on:click="monthLastNext(-1)" style="font-size: 20px;"></i>
                        <span v-if="calendarData.hasOwnProperty(0)" class="fw-bold mx-2">
                            {{ calendarData[0][0].month }}
                        </span>
                        <i class="uil uil-angle-right-b pointerClass ms-2" v-on:click="monthLastNext(1)" style="font-size: 20px;"></i>
                    </div>
                    <!-- Right-justified monthly total (Calendar page only) -->
                    <div class="col-3 col-md-3 col-xl-3 text-end" v-if="pageId === 'calendar'">
                        <div v-show="monthlyTotal.trades > 0" style="font-size: 13px;">
                            <span class="dashInfoTitle me-1">Monthly P&amp;L:</span>
                            <span v-bind:class="monthlyTotal.sum >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold'">
                                {{ useThousandCurrencyFormat(parseInt(monthlyTotal.sum)) }}
                            </span>
                            <div class="dashInfoTitle">
                                {{ monthlyTotal.trades }} trade{{ monthlyTotal.trades === 1 ? '' : 's' }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ── Main calendar grid (Tradervue-style cells + Week N column) ───── -->
    <div v-bind:class="[pageId === 'calendar' ? 'col-12 mb-4' : 'col-12']">
        <template v-if="pageId === 'calendar'">
            <!-- Fixed-pixel grid: cells stay 130×150 regardless of viewport -->
            <!-- Day-of-week + Week column headers -->
            <div class="tvRow text-center mt-2 mb-1">
                <div v-for="(day, di) in days" :key="'h-' + day"
                    v-bind:class="['tvHeaderCell', { 'tvWeekendHeader': di === 0 || di === 6 }]">
                    <small class="dashInfoTitle">{{ day }}</small>
                </div>
                <div class="tvHeaderCell">
                    <small class="dashInfoTitle">Week</small>
                </div>
            </div>

            <!-- Week rows -->
            <div class="tvRow" v-for="(week, wi) in mainWeekRows" :key="'week-' + wi">
                <div v-for="(cell, ci) in week" :key="'d-' + wi + '-' + ci"
                    v-show="cell != 0"
                    v-on:click="jumpToDaily(cell)"
                    v-bind:class="[
                        'tvCell',
                        { 'tvCellClickable': cell && cell.pAndL && cell.pAndL.trades, 'tvWeekend': ci === 0 || ci === 6 }
                    ]">
                    <div class="tvDayNum" v-show="cell && cell.day">{{ cell && cell.day }}</div>
                    <div v-if="cellPL(cell) !== null"
                        v-bind:class="['tvAmount', cellPL(cell) >= 0 ? 'tvWin' : 'tvLoss']">
                        {{ useThousandCurrencyFormat(parseInt(cellPL(cell))) }}
                    </div>
                    <div v-if="cell && cell.pAndL && cell.pAndL.trades" class="tvTradeCount">
                        {{ cell.pAndL.trades }} trade{{ cell.pAndL.trades === 1 ? '' : 's' }}
                    </div>
                </div>
                <!-- Empty cell placeholders for days outside the visible month so the row stays aligned -->
                <div v-for="(cell, ci) in week" :key="'e-' + wi + '-' + ci"
                    v-show="cell == 0"
                    class="tvCell" style="visibility: hidden;"></div>
                <!-- Week N total column -->
                <div class="tvCell">
                    <div class="tvWeekLabel">Week {{ wi + 1 }}</div>
                    <div v-if="weeklyTotals[wi] !== 0"
                        v-bind:class="['tvAmount', weeklyTotals[wi] >= 0 ? 'tvWin' : 'tvLoss']">
                        {{ useThousandCurrencyFormat(parseInt(weeklyTotals[wi])) }}
                    </div>
                    <div v-if="weeklyTradeCounts[wi] > 0" class="tvTradeCount">
                        {{ weeklyTradeCounts[wi] }} trade{{ weeklyTradeCounts[wi] === 1 ? '' : 's' }}
                    </div>
                </div>
            </div>
        </template>

        <!-- Daily-page widget keeps the legacy compact cells (responsive Bootstrap layout) -->
        <template v-else>
            <div class="row text-center mt-2 mb-1">
                <div class="col" v-for="day in days" :key="day">
                    <small class="dashInfoTitle">{{ day }}</small>
                </div>
            </div>
            <div class="row" v-for="(week, wi) in mainWeekRows" :key="'week-' + wi">
                <div class="col" v-for="(cell, ci) in week" :key="'d-' + wi + '-' + ci">
                    <div v-show="cell != 0"
                        v-bind:class="[{
                            'greenTradeDiv': selectedPlSatisfaction == 'pl' ? (cell && cell.pAndL && cell.pAndL[amountCase + 'Proceeds'] >= 0) : cell && cell.satisfaction === true,
                            'redTradeDiv': selectedPlSatisfaction == 'pl' ? (cell && cell.pAndL && cell.pAndL[amountCase + 'Proceeds'] < 0) : cell && cell.satisfaction === false,
                            'calDivDay': true
                        }, 'col']" v-bind:style="'position: relative;'">
                        <p class="mb-1 dayNumber" v-show="cell && cell.day">{{ cell && cell.day }}</p>
                        <i v-if="cell && cell.satisfaction === true"
                            class="uil uil-thumbs-up"
                            style="position: absolute; top: 2px; right: 4px; font-size: 12px; color: #22c55e;"></i>
                        <i v-if="cell && cell.satisfaction === false"
                            class="uil uil-thumbs-down"
                            style="position: absolute; top: 2px; right: 4px; font-size: 12px; color: #ef4444;"></i>
                    </div>
                </div>
            </div>
        </template>
    </div>

    <!-- ── Year-at-a-glance: 12 mini-calendars (Jan→Dec), click month name to load ── -->
    <div v-show="pageId == 'calendar'" class="col-12">
        <div class="row">
            <div class="col-6 col-md-4 col-xl-3 mb-3"
                v-for="(calData, index) in miniCalendarsData"
                :key="'mc-' + index">
                <div v-on:click="jumpToMiniMonth(calData)"
                    v-bind:class="[
                    'row me-2 tvMiniCalTile',
                    { 'tvMiniCalActive': calData.__monthStartUnix === selectedMonth.start }
                ]">
                    <div class="tvMiniCalHeader fw-bold mb-1">
                        {{ calData[0][0].month }}
                    </div>
                    <div class="col miniCalBox" v-for="(day, dIdx) in days" :key="'mc-' + index + '-h-' + dIdx">
                        <div><small style="font-size: 8px; color: rgba(255,255,255,0.45);">{{ day }}</small></div>
                        <div v-for="(line, lk) in weekRowsOf(calData)" :key="'mc-' + index + '-r-' + lk">
                            <div class="row">
                                <div v-show="line[dIdx] != 0"
                                    v-bind:class="[{
                                        'greenTradeDiv': line[dIdx] && line[dIdx].pAndL && line[dIdx].pAndL[amountCase + 'Proceeds'] >= 0,
                                        'redTradeDiv': line[dIdx] && line[dIdx].pAndL && line[dIdx].pAndL[amountCase + 'Proceeds'] < 0,
                                        'tvWeekendMini': dIdx === 0 || dIdx === 6
                                    }, 'calDivMini', 'col']"
                                    v-bind:style="'position: relative;'">
                                    <p class="mb-1 dayNumber" v-show="line[dIdx] && line[dIdx].day">{{ line[dIdx] && line[dIdx].day }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
