<script setup>
import { onBeforeMount } from 'vue'
import SpinnerLoadingPage from '../components/SpinnerLoadingPage.vue';
import Filters from '../components/Filters.vue'
import NoData from '../components/NoData.vue';
import Calendar from '../components/Calendar.vue';
import { spinnerLoadingPage, calendarData, filteredTrades, calendarViewMode } from '../stores/globals';
import { useMountCalendar } from '../utils/utils'

onBeforeMount(async () => {
    useMountCalendar()
})

async function setViewMode(mode) {
    calendarViewMode.value = mode
    useMountCalendar(true)
}
</script>

<template>
    <SpinnerLoadingPage />
    <div v-show="!spinnerLoadingPage" class="row mt-2 mb-2">
        <Filters />

        <!-- ============ VIEW MODE TOGGLE ============ -->
        <div class="col-12 text-center mb-2">
            <div class="btn-group" role="group">
                <button :class="'btn btn-sm ' + (calendarViewMode == '30' ? 'btn-primary' : 'btn-outline-secondary')"
                    @click="setViewMode('30')">30 Days</button>
                <button :class="'btn btn-sm ' + (calendarViewMode == '60' ? 'btn-primary' : 'btn-outline-secondary')"
                    @click="setViewMode('60')">60 Days</button>
                <button :class="'btn btn-sm ' + (calendarViewMode == '90' ? 'btn-primary' : 'btn-outline-secondary')"
                    @click="setViewMode('90')">90 Days</button>
                <button :class="'btn btn-sm ' + (calendarViewMode == 'yearly' ? 'btn-primary' : 'btn-outline-secondary')"
                    @click="setViewMode('yearly')">Yearly</button>
            </div>
        </div>

        <div v-if="filteredTrades.length == 0">
            <NoData />
        </div>
        <div v-else>
            <!-- ============ CALENDAR ============ -->
            <div v-show="calendarData" class="col-12 text-center mt-2 align-self-start">
                <div class="dailyCard">
                    <div class="row justify-content-center">
                        <Calendar />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>