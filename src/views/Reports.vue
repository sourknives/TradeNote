<script setup>
import { onBeforeMount, nextTick, ref } from 'vue'
import * as echarts from 'echarts'
import SpinnerLoadingPage from '../components/SpinnerLoadingPage.vue'
import Filters from '../components/Filters.vue'
import NoData from '../components/NoData.vue'
import ReportOverview from '../components/reports/ReportOverview.vue'
import ReportDetailed from '../components/reports/ReportDetailed.vue'
import ReportWinLossDays from '../components/reports/ReportWinLossDays.vue'
import ReportDrawdown from '../components/reports/ReportDrawdown.vue'
import ReportCompare from '../components/reports/ReportCompare.vue'
import ReportTagBreakdown from '../components/reports/ReportTagBreakdown.vue'
import ReportAdvanced from '../components/reports/ReportAdvanced.vue'
import { spinnerLoadingPage, hasData, selectedReportTab, renderData, reportChartsMounted } from '../stores/globals'
import { useMountReports } from '../utils/utils'

const reportTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'detailed', label: 'Detailed' },
    { id: 'winLossDays', label: 'Win vs Loss Days' },
    { id: 'drawdown', label: 'Drawdown' },
    { id: 'compare', label: 'Compare' },
    { id: 'tagBreakdown', label: 'Tag Breakdown' },
    { id: 'advanced', label: 'Advanced' }
]

onBeforeMount(async () => {
    await useMountReports()
})

function selectTab(tabId) {
    selectedReportTab.value = tabId
    // ECharts instances initialized while their tab was hidden (v-show=false) render at 0×0.
    // Resize them once the new tab is shown so they fill the now-visible container.
    nextTick(() => {
        document.querySelectorAll('[_echarts_instance_]').forEach(el => {
            const inst = echarts.getInstanceByDom(el)
            if (inst && !inst.isDisposed()) inst.resize()
        })
    })
}
</script>

<template>
    <SpinnerLoadingPage />
    <div class="row mt-2">
        <div v-show="!spinnerLoadingPage">
            <Filters />
            <div v-if="!hasData">
                <NoData />
            </div>
            <div v-else>
                <nav>
                    <div class="nav nav-tabs mb-2" role="tablist">
                        <button v-for="tab in reportTabs" :key="tab.id"
                            :class="'nav-link ' + (selectedReportTab == tab.id ? 'active' : '')"
                            v-on:click="selectTab(tab.id)" type="button" role="tab">{{ tab.label }}</button>
                    </div>
                </nav>

                <div class="tab-content">
                    <div v-show="selectedReportTab == 'overview'">
                        <ReportOverview />
                    </div>
                    <div v-show="selectedReportTab == 'detailed'">
                        <ReportDetailed />
                    </div>
                    <div v-show="selectedReportTab == 'winLossDays'">
                        <ReportWinLossDays />
                    </div>
                    <div v-show="selectedReportTab == 'drawdown'">
                        <ReportDrawdown />
                    </div>
                    <div v-show="selectedReportTab == 'compare'">
                        <ReportCompare />
                    </div>
                    <div v-show="selectedReportTab == 'tagBreakdown'">
                        <ReportTagBreakdown />
                    </div>
                    <div v-show="selectedReportTab == 'advanced'">
                        <ReportAdvanced />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
