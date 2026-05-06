import {
    totals,
    totalsByDate,
    groups,
    filteredTradesTrades,
    amountCase,
    reportStats,
    reportDetailedStats,
    reportWinDayStats,
    reportLossDayStats,
    reportDrawdownStats,
    reportTagBreakdown,
    reportCompareGroupA,
    reportCompareGroupB
} from "../stores/globals.js"

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)
import duration from 'dayjs/plugin/duration.js'
dayjs.extend(duration)


/**************************************
 * STATISTICAL HELPER FUNCTIONS
 **************************************/

/**
 * Computes the population standard deviation of an array of numeric values.
 * Returns 0 if the array has fewer than 2 elements.
 *
 * @param {number[]} values - Array of numbers
 * @returns {number} Population standard deviation
 */
export function useStandardDeviation(values) {
    if (!values || values.length < 2) return 0
    const n = values.length
    const mean = values.reduce((sum, v) => sum + v, 0) / n
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n
    return Math.sqrt(variance)
}

/**
 * Computes the K-Ratio: slope / std-error of the OLS linear regression
 * fitted to a cumulative P&L equity curve array.
 * A higher K-Ratio indicates a smoother, more consistent equity curve.
 * Returns 0 if the array has fewer than 2 points.
 *
 * @param {number[]} equityCurve - Array of cumulative P&L values (chronological)
 * @returns {number} K-Ratio
 */
export function useKRatio(equityCurve) {
    if (!equityCurve || equityCurve.length < 2) return 0
    const n = equityCurve.length
    // x = [0, 1, 2, ..., n-1]
    const xMean = (n - 1) / 2
    const yMean = equityCurve.reduce((sum, v) => sum + v, 0) / n

    let ssXY = 0
    let ssXX = 0
    for (let i = 0; i < n; i++) {
        const xDev = i - xMean
        ssXY += xDev * (equityCurve[i] - yMean)
        ssXX += xDev * xDev
    }

    if (ssXX === 0) return 0

    const slope = ssXY / ssXX

    // Residuals and standard error of slope
    let ssRes = 0
    for (let i = 0; i < n; i++) {
        const predicted = yMean + slope * (i - xMean)
        ssRes += Math.pow(equityCurve[i] - predicted, 2)
    }

    const mse = ssRes / (n - 2)
    const slopeSE = Math.sqrt(mse / ssXX)

    if (slopeSE === 0) return 0
    const ratio = slope / slopeSE
    return isFinite(ratio) ? ratio : 0
}

/**
 * Computes the System Quality Number (SQN).
 * SQN = (avgPL / stdDev) * sqrt(numTrades)
 * A higher SQN (>= 2) generally indicates a tradable system.
 *
 * @param {number} avgPL - Average P&L per trade
 * @param {number} stdDev - Standard deviation of trade P&L values
 * @param {number} numTrades - Total number of trades
 * @returns {number} SQN value
 */
export function useSQN(avgPL, stdDev, numTrades) {
    if (!stdDev || stdDev === 0 || !numTrades || numTrades === 0) return 0
    return (avgPL / stdDev) * Math.sqrt(numTrades)
}

/**
 * Computes the Kelly Criterion percentage for optimal position sizing.
 * Kelly% = W - (1 - W) / (avgWin / |avgLoss|)
 * where W is the win rate (0-1), avgWin is the mean winning trade amount,
 * and avgLoss is the mean losing trade amount (may be positive or negative, abs is taken).
 * Returns 0 on invalid inputs.
 *
 * @param {number} winRate - Fraction of winning trades (0 to 1)
 * @param {number} avgWin - Average profit on winning trades
 * @param {number} avgLoss - Average loss on losing trades (sign-agnostic)
 * @returns {number} Kelly percentage
 */
export function useKellyPercentage(winRate, avgWin, avgLoss) {
    const absLoss = Math.abs(avgLoss)
    if (!absLoss || absLoss === 0 || !avgWin || avgWin === 0) return 0
    const payoffRatio = avgWin / absLoss
    if (payoffRatio === 0) return 0
    const kelly = winRate - (1 - winRate) / payoffRatio
    return Math.max(-1, Math.min(1, kelly))
}

/**
 * Computes the maximum consecutive winning or losing streak from an array
 * of daily P&L values.
 *
 * @param {number[]} dailyPLArray - Array of daily P&L numbers (chronological)
 * @param {boolean} isWin - true to count consecutive positive days, false for negative
 * @returns {number} Longest consecutive streak length
 */
export function useMaxConsecutive(dailyPLArray, isWin) {
    if (!dailyPLArray || dailyPLArray.length === 0) return 0
    let max = 0
    let current = 0
    for (const pl of dailyPLArray) {
        const condition = isWin ? pl > 0 : pl < 0
        if (condition) {
            current++
            if (current > max) max = current
        } else {
            current = 0
        }
    }
    return max
}

/**
 * Approximates a one-tailed t-test p-value to assess whether the mean P&L
 * is statistically different from zero (i.e. not due to random chance).
 * Uses the Abramowitz & Stegun rational approximation for the normal CDF.
 * Returns a value between 0 and 1; lower values indicate stronger significance.
 *
 * @param {number} mean - Sample mean
 * @param {number} stdDev - Sample standard deviation
 * @param {number} N - Number of observations
 * @returns {number} Approximate p-value (one-tailed)
 */
export function useProbabilityOfRandomChance(mean, stdDev, N) {
    if (!stdDev || stdDev === 0 || !N || N < 2) return 1
    const se = stdDev / Math.sqrt(N)
    if (se === 0) return 0
    const t = mean / se

    // Approximate normal CDF using Abramowitz & Stegun method
    const absT = Math.abs(t)
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911
    const x = 1 / (1 + p * absT)
    const poly = x * (a1 + x * (a2 + x * (a3 + x * (a4 + x * a5))))
    const cdf = 1 - poly * Math.exp(-absT * absT / 2) / Math.sqrt(2 * Math.PI)

    // One-tailed p-value
    const pValue = t >= 0 ? 1 - cdf : cdf
    return Math.max(0, Math.min(1, pValue))
}

/**
 * Computes the average hold time in minutes for winning or losing trades,
 * based on the active amountCase (gross vs. net).
 *
 * @param {Object[]} trades - Array of individual trade objects
 * @param {'winners'|'losers'} type - Whether to average winning or losing trades
 * @param {string} amountCaseValue - 'gross' or 'net'
 * @returns {number} Average hold time in minutes (0 if no qualifying trades)
 */
export function useAverageHoldTime(trades, type, amountCaseValue) {
    if (!trades || trades.length === 0) return 0

    const proceedsKey = amountCaseValue === 'gross' ? 'grossProceeds' : 'netProceeds'
    const qualifying = trades.filter(t => {
        const pl = t[proceedsKey]
        return type === 'winners' ? pl > 0 : pl < 0
    })

    if (qualifying.length === 0) return 0

    const totalMinutes = qualifying.reduce((sum, t) => {
        if (t.entryTime == null || t.exitTime == null) return sum
        const diffSeconds = t.exitTime - t.entryTime
        return sum + diffSeconds / 60
    }, 0)

    return totalMinutes / qualifying.length
}

/**
 * Walks the chronological totalsByDate object to compute the full drawdown series.
 * A drawdown begins when cumulative P&L falls below its prior peak and ends
 * when the curve recovers to or exceeds that peak.
 *
 * @param {Object} totalsByDateObj - Keyed by date unix timestamp (string), each entry has grossProceeds / netProceeds
 * @param {string} amountCaseValue - 'gross' or 'net'
 * @returns {{
 *   drawdowns: Array<{start: number, end: number|null, amount: number, days: number, trades: number}>,
 *   maxDrawdown: number,
 *   avgDrawdown: number,
 *   currentDrawdown: number,
 *   daysInDrawdown: number,
 *   avgDaysInDrawdown: number,
 *   avgTradesInDrawdown: number
 * }}
 */
export function useDrawdownSeries(totalsByDateObj, amountCaseValue) {
    const empty = {
        drawdowns: [],
        maxDrawdown: 0,
        avgDrawdown: 0,
        currentDrawdown: 0,
        daysInDrawdown: 0,
        avgDaysInDrawdown: 0,
        avgTradesInDrawdown: 0
    }

    if (!totalsByDateObj || Object.keys(totalsByDateObj).length === 0) return empty

    const proceedsKey = amountCaseValue === 'gross' ? 'grossProceeds' : 'netProceeds'
    const tradesKey = amountCaseValue === 'gross'
        ? (d) => (d.grossWinsCount || 0) + (d.grossLossCount || 0)
        : (d) => (d.netWinsCount || 0) + (d.netLossCount || 0)

    // Sort date keys chronologically (keys are unix timestamp strings); filter out non-numeric keys
    const sortedKeys = Object.keys(totalsByDateObj)
        .filter(k => !isNaN(Number(k)))
        .sort((a, b) => Number(a) - Number(b))

    let cumPL = 0
    let peak = 0
    let inDrawdown = false
    let drawdownStart = null
    let drawdownPeak = 0
    const drawdowns = []

    for (const key of sortedKeys) {
        const day = totalsByDateObj[key]
        const pl = day[proceedsKey] || 0
        const numTrades = tradesKey(day)
        cumPL += pl

        if (cumPL > peak) {
            // New peak: if we were in a drawdown, close it
            if (inDrawdown) {
                const lastDD = drawdowns[drawdowns.length - 1]
                lastDD.end = Number(key)
                // amount is already tracked as max(peak - cumPL) during the drawdown
                inDrawdown = false
            }
            peak = cumPL
        }

        if (cumPL < peak) {
            if (!inDrawdown) {
                // Start a new drawdown
                inDrawdown = true
                drawdownStart = Number(key)
                drawdownPeak = peak
                drawdowns.push({
                    start: drawdownStart,
                    end: null,
                    amount: 0,
                    days: 0,
                    trades: 0
                })
            }
            // Update current drawdown metrics
            const lastDD = drawdowns[drawdowns.length - 1]
            lastDD.amount = Math.max(lastDD.amount, drawdownPeak - cumPL)
            lastDD.days = Math.round(
                Math.abs(dayjs.unix(Number(key)).diff(dayjs.unix(drawdownStart), 'day'))
            ) + 1
            lastDD.trades += numTrades
        }
    }

    // If still in drawdown at the end of the data, leave end as null (open drawdown)
    const closedDrawdowns = drawdowns.filter(d => d.amount > 0)
    const maxDrawdown = closedDrawdowns.reduce((max, d) => Math.max(max, d.amount), 0)
    const avgDrawdown = closedDrawdowns.length > 0
        ? closedDrawdowns.reduce((sum, d) => sum + d.amount, 0) / closedDrawdowns.length
        : 0
    const avgDaysInDrawdown = closedDrawdowns.length > 0
        ? closedDrawdowns.reduce((sum, d) => sum + (d.days || 0), 0) / closedDrawdowns.length
        : 0
    const avgTradesInDrawdown = closedDrawdowns.length > 0
        ? closedDrawdowns.reduce((sum, d) => sum + (d.trades || 0), 0) / closedDrawdowns.length
        : 0

    // Total calendar days spent in any drawdown
    const daysInDrawdown = closedDrawdowns.reduce((sum, d) => sum + (d.days || 0), 0)

    // Current drawdown: how far below the last peak are we right now
    const currentDrawdown = peak - cumPL > 0 ? peak - cumPL : 0

    return {
        drawdowns: closedDrawdowns,
        maxDrawdown,
        avgDrawdown,
        currentDrawdown,
        daysInDrawdown,
        avgDaysInDrawdown,
        avgTradesInDrawdown
    }
}

/**
 * Computes a simple rolling (moving) average over an array of values.
 * For indices where fewer than `window` previous values exist, uses all
 * available values up to that point.
 *
 * @param {number[]} values - Array of numeric values
 * @param {number} window - Rolling window size
 * @returns {number[]} Array of rolling average values, same length as input
 */
export function useMovingAverage(values, window) {
    if (!values || values.length === 0) return []
    return values.map((_, i) => {
        const start = Math.max(0, i - window + 1)
        const slice = values.slice(start, i + 1)
        return slice.reduce((sum, v) => sum + v, 0) / slice.length
    })
}

/**
 * Computes a rolling standard deviation over an array of values.
 * Uses population std deviation within each window.
 * For indices where fewer than `window` previous values exist, uses all
 * available values up to that point.
 *
 * @param {number[]} values - Array of numeric values
 * @param {number} window - Rolling window size
 * @returns {number[]} Array of rolling std deviation values, same length as input
 */
export function useRollingStdDev(values, window) {
    if (!values || values.length === 0) return []
    return values.map((_, i) => {
        const start = Math.max(0, i - window + 1)
        const slice = values.slice(start, i + 1)
        return useStandardDeviation(slice)
    })
}


/**************************************
 * ORCHESTRATION FUNCTIONS
 **************************************/

/**
 * Computes a comprehensive set of performance statistics from trades and daily totals.
 * Returns an object with 25+ metrics covering P&L, risk, win/loss ratios, and
 * advanced statistical measures (SQN, K-Ratio, Kelly, probability of random chance).
 *
 * @param {Object[]} tradesArray - Array of individual trade objects (filteredTradesTrades)
 * @param {Object} totalsByDateObj - Daily totals keyed by date unix (totalsByDate)
 * @param {Object} totalsObj - Aggregate totals object (totals)
 * @param {string} amountCaseValue - 'gross' or 'net'
 * @returns {Object} Detailed stats object
 */
export function useCalculateDetailedStats(tradesArray, totalsByDateObj, totalsObj, amountCaseValue) {
    const isGross = amountCaseValue === 'gross'
    const proceedsKey = isGross ? 'grossProceeds' : 'netProceeds'
    const winsKey = isGross ? 'grossWins' : 'netWins'
    const lossKey = isGross ? 'grossLoss' : 'netLoss'
    const winsCountKey = isGross ? 'grossWinsCount' : 'netWinsCount'
    const lossCountKey = isGross ? 'grossLossCount' : 'netLossCount'
    const sharePLWinsKey = isGross ? 'grossSharePLWins' : 'netSharePLWins'
    const sharePLLossKey = isGross ? 'grossSharePLLoss' : 'netSharePLLoss'

    // --- Totals ---
    const totalGrossPL = totalsObj.grossProceeds || 0
    const totalNetPL = totalsObj.netProceeds || 0
    const numTrades = totalsObj.trades || 0

    // --- Daily aggregates ---
    const dateKeys = Object.keys(totalsByDateObj || {}).filter(k => !isNaN(Number(k)))
    const numTradingDays = dateKeys.length

    const dailyPLValues = dateKeys.map(k => (totalsByDateObj[k][proceedsKey] || 0))
    const dailyVolumeValues = dateKeys.map(k => {
        const d = totalsByDateObj[k]
        return (d.buyQuantity || 0) + (d.sellQuantity || 0)
    })
    const dailyTradeCountValues = dateKeys.map(k => (totalsByDateObj[k].trades || 0))

    const avgDailyPL = numTradingDays > 0
        ? dailyPLValues.reduce((s, v) => s + v, 0) / numTradingDays
        : 0
    const avgDailyVolume = numTradingDays > 0
        ? dailyVolumeValues.reduce((s, v) => s + v, 0) / numTradingDays
        : 0
    const avgTradesPerDay = numTradingDays > 0
        ? dailyTradeCountValues.reduce((s, v) => s + v, 0) / numTradingDays
        : 0

    // --- Per-trade averages ---
    const winsCount = totalsObj[winsCountKey] || 0
    const lossCount = totalsObj[lossCountKey] || 0
    const totalWins = totalsObj[winsKey] || 0
    const totalLoss = totalsObj[lossKey] || 0

    const avgWinningTrade = winsCount > 0 ? totalWins / winsCount : 0
    const avgLosingTrade = lossCount > 0 ? totalLoss / lossCount : 0  // negative value

    // Per-share averages
    const avgWinPerShare = winsCount > 0 ? (totalsObj[sharePLWinsKey] || 0) / winsCount : 0
    const avgLossPerShare = lossCount > 0 ? (totalsObj[sharePLLossKey] || 0) / lossCount : 0

    // --- Largest individual trades ---
    let largestWin = 0
    let largestLoss = 0
    if (tradesArray && tradesArray.length > 0) {
        for (const t of tradesArray) {
            const pl = t[proceedsKey] || 0
            if (pl > largestWin) largestWin = pl
            if (pl < largestLoss) largestLoss = pl
        }
    }

    // --- Consecutive streaks (daily) ---
    const sortedDailyPL = dateKeys
        .slice()
        .sort((a, b) => Number(a) - Number(b))
        .map(k => totalsByDateObj[k][proceedsKey] || 0)

    const maxConsecutiveWins = useMaxConsecutive(sortedDailyPL, true)
    const maxConsecutiveLosses = useMaxConsecutive(sortedDailyPL, false)

    // --- Win / Loss rates ---
    const winRate = numTrades > 0 ? winsCount / numTrades : 0
    const lossRate = numTrades > 0 ? lossCount / numTrades : 0

    // --- Profit Factor ---
    const profitFactor = Math.abs(totalLoss) > 0 ? Math.abs(totalWins / totalLoss) : 0

    // --- Average hold times ---
    const avgHoldTimeWinners = useAverageHoldTime(tradesArray || [], 'winners', amountCaseValue)
    const avgHoldTimeLosers = useAverageHoldTime(tradesArray || [], 'losers', amountCaseValue)

    // --- Advanced stats ---
    const tradePLValues = (tradesArray || []).map(t => t[proceedsKey] || 0)
    const avgTradePL = numTrades > 0
        ? tradePLValues.reduce((s, v) => s + v, 0) / numTrades
        : 0
    const stdDeviation = useStandardDeviation(tradePLValues)

    // Equity curve for K-Ratio: cumulative sum of sorted-by-date daily P&L
    let cumSum = 0
    const equityCurve = sortedDailyPL.map(pl => {
        cumSum += pl
        return cumSum
    })
    const kRatio = useKRatio(equityCurve)
    const sqn = useSQN(avgTradePL, stdDeviation, numTrades)
    const kellyPct = useKellyPercentage(winRate, avgWinningTrade, Math.abs(avgLosingTrade))
    const probRandomChance = useProbabilityOfRandomChance(avgTradePL, stdDeviation, numTrades)

    // Active P&L based on amountCase
    const totalPL = isGross ? totalGrossPL : totalNetPL
    const winRatePercent = winRate * 100
    const lossRatePercent = lossRate * 100

    // Build dynamic property names matching component access patterns
    const prefix = amountCaseValue // 'gross' or 'net'
    return {
        totalGrossPL,
        totalNetPL,
        totalPL,
        // Dynamic keys for components that use amountCase + 'PropertyName'
        [prefix + 'TotalPL']: totalPL,
        [prefix + 'AvgDailyPL']: avgDailyPL,
        [prefix + 'AvgWinningTrade']: avgWinningTrade,
        [prefix + 'AvgLosingTrade']: avgLosingTrade,
        [prefix + 'LargestWin']: largestWin,
        [prefix + 'LargestLoss']: largestLoss,
        [prefix + 'AvgWinPerShare']: avgWinPerShare,
        [prefix + 'AvgLossPerShare']: avgLossPerShare,
        [prefix + 'StdDeviation']: stdDeviation,
        numTrades,
        numTradingDays,
        avgDailyPL,
        avgDailyVolume,
        avgTradesPerDay,
        avgWinningTrade,
        avgLosingTrade,
        avgWinPerShare,
        avgLossPerShare,
        largestWin,
        largestLoss,
        maxConsecutiveWins,
        maxConsecutiveLosses,
        maxConsecWins: maxConsecutiveWins,
        maxConsecLosses: maxConsecutiveLosses,
        winRate: winRatePercent,
        lossRate: lossRatePercent,
        winsCount,
        lossCount,
        profitFactor,
        avgHoldTimeWinners,
        avgHoldTimeLosers,
        stdDeviation,
        kRatio,
        sqn,
        kellyPct,
        probRandomChance
    }
}

/**
 * Splits dates into win days vs. loss days and computes detailed stats for each group.
 * A win day is any date where the selected P&L (gross or net) is > 0.
 * A loss day is any date where the selected P&L is < 0.
 * Breakeven days (pl === 0) are excluded from both groups.
 *
 * @param {Object} totalsByDateObj - Daily totals keyed by date unix
 * @param {string} amountCaseValue - 'gross' or 'net'
 * @returns {{ winDays: Object, lossDays: Object }} Detailed stats for each group
 */
export function useCalculateWinLossDayStats(totalsByDateObj, amountCaseValue) {
    const proceedsKey = amountCaseValue === 'gross' ? 'grossProceeds' : 'netProceeds'

    const allKeys = Object.keys(totalsByDateObj || {}).filter(k => !isNaN(Number(k)))
    const winDayKeys = allKeys.filter(
        k => (totalsByDateObj[k][proceedsKey] || 0) > 0
    )
    const lossDayKeys = allKeys.filter(
        k => (totalsByDateObj[k][proceedsKey] || 0) < 0
    )

    // Build a subset totalsByDate for each group
    const buildSubset = (keys) => {
        const subset = {}
        for (const k of keys) subset[k] = totalsByDateObj[k]
        return subset
    }

    const winDayTotals = buildSubset(winDayKeys)
    const lossDayTotals = buildSubset(lossDayKeys)

    // Build a dummy totals object aggregated from the subset keys
    const aggregateTotals = (subset, ac) => {
        const isGross = ac === 'gross'
        const winsKey = isGross ? 'grossWins' : 'netWins'
        const lossKey = isGross ? 'grossLoss' : 'netLoss'
        const winsCountKey = isGross ? 'grossWinsCount' : 'netWinsCount'
        const lossCountKey = isGross ? 'grossLossCount' : 'netLossCount'
        const sharePLWinsKey = isGross ? 'grossSharePLWins' : 'netSharePLWins'
        const sharePLLossKey = isGross ? 'grossSharePLLoss' : 'netSharePLLoss'

        let grossProceeds = 0, netProceeds = 0, trades = 0
        let grossWins = 0, grossLoss = 0, netWins = 0, netLoss = 0
        let grossWinsCount = 0, grossLossCount = 0, netWinsCount = 0, netLossCount = 0
        let grossSharePLWins = 0, grossSharePLLoss = 0, netSharePLWins = 0, netSharePLLoss = 0
        let buyQuantity = 0, sellQuantity = 0

        for (const k of Object.keys(subset)) {
            const d = subset[k]
            grossProceeds += d.grossProceeds || 0
            netProceeds += d.netProceeds || 0
            trades += d.trades || 0
            grossWins += d.grossWins || 0
            grossLoss += d.grossLoss || 0
            netWins += d.netWins || 0
            netLoss += d.netLoss || 0
            grossWinsCount += d.grossWinsCount || 0
            grossLossCount += d.grossLossCount || 0
            netWinsCount += d.netWinsCount || 0
            netLossCount += d.netLossCount || 0
            grossSharePLWins += d.grossSharePLWins || 0
            grossSharePLLoss += d.grossSharePLLoss || 0
            netSharePLWins += d.netSharePLWins || 0
            netSharePLLoss += d.netSharePLLoss || 0
            buyQuantity += d.buyQuantity || 0
            sellQuantity += d.sellQuantity || 0
        }

        return {
            grossProceeds, netProceeds, trades,
            grossWins, grossLoss, netWins, netLoss,
            grossWinsCount, grossLossCount, netWinsCount, netLossCount,
            grossSharePLWins, grossSharePLLoss, netSharePLWins, netSharePLLoss,
            buyQuantity, sellQuantity
        }
    }

    const winDaysStats = useCalculateDetailedStats(
        [],
        winDayTotals,
        aggregateTotals(winDayTotals, amountCaseValue),
        amountCaseValue
    )
    const lossDaysStats = useCalculateDetailedStats(
        [],
        lossDayTotals,
        aggregateTotals(lossDayTotals, amountCaseValue),
        amountCaseValue
    )

    return {
        winDays: winDaysStats,
        lossDays: lossDaysStats
    }
}

/**
 * Computes full drawdown analysis for the given daily totals, including
 * series arrays needed by the drawdown, moving-average, and volatility charts.
 *
 * @param {Object} totalsByDateObj - Daily totals keyed by date unix
 * @param {string} amountCaseValue - 'gross' or 'net'
 * @returns {Object} Drawdown analysis object with chart series
 */
export function useCalculateDrawdownStats(totalsByDateObj, amountCaseValue) {
    const drawdownData = useDrawdownSeries(totalsByDateObj, amountCaseValue)

    const proceedsKey = amountCaseValue === 'gross' ? 'grossProceeds' : 'netProceeds'
    const sortedKeys = Object.keys(totalsByDateObj || {})
        .filter(k => !isNaN(Number(k)))
        .sort((a, b) => Number(a) - Number(b))

    // Daily P&L series
    const dailyPLSeries = sortedKeys.map(k => totalsByDateObj[k][proceedsKey] || 0)

    // Moving average (20-day window)
    const movingAvgSeries = useMovingAverage(dailyPLSeries, 20)

    // Rolling volatility (20-day window)
    const volatilitySeries = useRollingStdDev(dailyPLSeries, 20)

    // Drawdown series: track cumulative P&L peak and distance from it
    let cumPL = 0
    let peak = 0
    const drawdownSeries = dailyPLSeries.map(pl => {
        cumPL += pl
        if (cumPL > peak) peak = cumPL
        return Math.max(0, peak - cumPL)
    })

    // Formatted date labels for chart x-axis
    const drawdownDates = sortedKeys.map(k => dayjs.unix(Number(k)).format('l'))

    return {
        ...drawdownData,
        drawdownSeries,
        drawdownDates,
        dailyPLSeries,
        movingAvgSeries,
        volatilitySeries
    }
}

/**
 * Runs useCalculateDetailedStats on two independent groups of trades and returns
 * the results side by side, useful for the compare report tab.
 *
 * @param {Object[]} groupATradesArray - Array of trade objects for group A
 * @param {Object[]} groupBTradesArray - Array of trade objects for group B
 * @param {string} amountCaseValue - 'gross' or 'net'
 * @returns {{ groupA: Object, groupB: Object }}
 */
export function useCalculateCompareStats(groupATradesArray, groupBTradesArray, amountCaseValue) {
    const buildTotalsFromTrades = (tradesArr, ac) => {
        const isGross = ac === 'gross'
        let grossProceeds = 0, netProceeds = 0, trades = 0
        let grossWins = 0, grossLoss = 0, netWins = 0, netLoss = 0
        let grossWinsCount = 0, grossLossCount = 0, netWinsCount = 0, netLossCount = 0
        let grossSharePLWins = 0, grossSharePLLoss = 0, netSharePLWins = 0, netSharePLLoss = 0
        let buyQuantity = 0, sellQuantity = 0

        for (const t of tradesArr) {
            grossProceeds += t.grossProceeds || 0
            netProceeds += t.netProceeds || 0
            trades += t.tradesCount || 1
            grossWins += t.grossWins || 0
            grossLoss += t.grossLoss || 0
            netWins += t.netWins || 0
            netLoss += t.netLoss || 0
            grossWinsCount += t.grossWinsCount || 0
            grossLossCount += t.grossLossCount || 0
            netWinsCount += t.netWinsCount || 0
            netLossCount += t.netLossCount || 0
            grossSharePLWins += t.grossSharePLWins || 0
            grossSharePLLoss += t.grossSharePLLoss || 0
            netSharePLWins += t.netSharePLWins || 0
            netSharePLLoss += t.netSharePLLoss || 0
            buyQuantity += t.buyQuantity || 0
            sellQuantity += t.sellQuantity || 0
        }

        return {
            grossProceeds, netProceeds, trades,
            grossWins, grossLoss, netWins, netLoss,
            grossWinsCount, grossLossCount, netWinsCount, netLossCount,
            grossSharePLWins, grossSharePLLoss, netSharePLWins, netSharePLLoss,
            buyQuantity, sellQuantity
        }
    }

    const buildTotalsByDateFromTrades = (tradesArr, ac) => {
        const proceedsKey = ac === 'gross' ? 'grossProceeds' : 'netProceeds'
        const byDate = {}
        for (const t of tradesArr) {
            const dateKey = t.td != null ? String(t.td) : null
            if (!dateKey) continue
            if (!byDate[dateKey]) {
                byDate[dateKey] = {
                    grossProceeds: 0, netProceeds: 0, trades: 0,
                    grossWins: 0, grossLoss: 0, netWins: 0, netLoss: 0,
                    grossWinsCount: 0, grossLossCount: 0, netWinsCount: 0, netLossCount: 0,
                    grossSharePLWins: 0, grossSharePLLoss: 0, netSharePLWins: 0, netSharePLLoss: 0,
                    buyQuantity: 0, sellQuantity: 0
                }
            }
            byDate[dateKey].grossProceeds += t.grossProceeds || 0
            byDate[dateKey].netProceeds += t.netProceeds || 0
            byDate[dateKey].trades += t.tradesCount || 1
            byDate[dateKey].grossWins += t.grossWins || 0
            byDate[dateKey].grossLoss += t.grossLoss || 0
            byDate[dateKey].netWins += t.netWins || 0
            byDate[dateKey].netLoss += t.netLoss || 0
            byDate[dateKey].grossWinsCount += t.grossWinsCount || 0
            byDate[dateKey].grossLossCount += t.grossLossCount || 0
            byDate[dateKey].netWinsCount += t.netWinsCount || 0
            byDate[dateKey].netLossCount += t.netLossCount || 0
            byDate[dateKey].grossSharePLWins += t.grossSharePLWins || 0
            byDate[dateKey].grossSharePLLoss += t.grossSharePLLoss || 0
            byDate[dateKey].netSharePLWins += t.netSharePLWins || 0
            byDate[dateKey].netSharePLLoss += t.netSharePLLoss || 0
            byDate[dateKey].buyQuantity += t.buyQuantity || 0
            byDate[dateKey].sellQuantity += t.sellQuantity || 0
        }
        return byDate
    }

    const groupATotals = buildTotalsFromTrades(groupATradesArray || [], amountCaseValue)
    const groupBTotals = buildTotalsFromTrades(groupBTradesArray || [], amountCaseValue)
    const groupATotalsByDate = buildTotalsByDateFromTrades(groupATradesArray || [], amountCaseValue)
    const groupBTotalsByDate = buildTotalsByDateFromTrades(groupBTradesArray || [], amountCaseValue)

    const groupA = useCalculateDetailedStats(
        groupATradesArray || [],
        groupATotalsByDate,
        groupATotals,
        amountCaseValue
    )
    const groupB = useCalculateDetailedStats(
        groupBTradesArray || [],
        groupBTotalsByDate,
        groupBTotals,
        amountCaseValue
    )

    return { groupA, groupB }
}

/**
 * Filters an array of trades by the provided filter criteria.
 * All filter fields are optional; omitted or null fields are ignored.
 *
 * @param {Object[]} allTrades - Full array of trade objects
 * @param {{
 *   symbol?: string,
 *   tags?: string[],
 *   side?: string,
 *   duration?: string,
 *   plFilter?: string,
 *   dateStart?: number|null,
 *   dateEnd?: number|null
 * }} filters - Filter criteria
 * @param {string} [amountCaseValue] - 'gross' or 'net' (needed for plFilter)
 * @returns {Object[]} Filtered array of trades
 */
export function useApplyReportFilters(allTrades, filters, amountCaseValue) {
    if (!allTrades || allTrades.length === 0) return []
    const ac = amountCaseValue || 'net'
    const proceedsKey = ac === 'gross' ? 'grossProceeds' : 'netProceeds'

    return allTrades.filter(trade => {
        // Symbol filter (case-insensitive partial match)
        if (filters.symbol && filters.symbol.trim() !== '') {
            const sym = (trade.symbol || '').toLowerCase()
            if (!sym.includes(filters.symbol.trim().toLowerCase())) return false
        }

        // Tags filter: trade must have at least one tag matching any in the filter list
        if (filters.tags && filters.tags.length > 0) {
            const tradeTags = (trade.tags || []).map(t => (typeof t === 'object' ? t.id : t))
            const hasTag = filters.tags.some(ft => tradeTags.includes(ft))
            if (!hasTag) return false
        }

        // Side filter: 'long', 'short', or 'all'
        if (filters.side && filters.side !== 'all') {
            if ((trade.side || '').toLowerCase() !== filters.side.toLowerCase()) return false
        }

        // Duration filter: 'intraday', 'overnight'/'multiday', or 'all'
        if (filters.duration && filters.duration !== 'all') {
            const entryDay = trade.entryTime ? dayjs.unix(trade.entryTime).format('YYYYMMDD') : null
            const exitDay = trade.exitTime ? dayjs.unix(trade.exitTime).format('YYYYMMDD') : null
            const isOvernight = entryDay && exitDay && entryDay !== exitDay
            if (filters.duration === 'intraday' && isOvernight) return false
            if ((filters.duration === 'overnight' || filters.duration === 'multiday') && !isOvernight) return false
        }

        // P&L filter: 'winners', 'losers', 'breakeven', or 'all'
        if (filters.plFilter && filters.plFilter !== 'all') {
            const pl = trade[proceedsKey] || 0
            if (filters.plFilter === 'winners' && pl <= 0) return false
            if (filters.plFilter === 'losers' && pl >= 0) return false
            if (filters.plFilter === 'breakeven' && pl !== 0) return false
        }

        // Date range filter (entryTime must fall within [dateStart, dateEnd))
        if (filters.dateStart != null && trade.entryTime < filters.dateStart) return false
        if (filters.dateEnd != null && trade.entryTime >= filters.dateEnd) return false

        return true
    })
}

/**
 * Groups trades by tag and computes per-tag statistics.
 * Trades with no tags are grouped under a synthetic "No Tag" entry.
 *
 * @param {Object[]} tradesArray - Array of individual trade objects
 * @param {string} amountCaseValue - 'gross' or 'net'
 * @returns {Array<{
 *   tagId: string,
 *   tagName: string,
 *   grossPL: number,
 *   netPL: number,
 *   count: number,
 *   volume: number,
 *   avgTrade: number,
 *   winRate: number
 * }>} Sorted array of per-tag statistics (descending by selected P&L)
 */
export function useCalculateTagBreakdown(tradesArray, amountCaseValue) {
    if (!tradesArray || tradesArray.length === 0) return []
    const isGross = amountCaseValue === 'gross'
    const proceedsKey = isGross ? 'grossProceeds' : 'netProceeds'

    const tagMap = {}

    const ensureTag = (id, name) => {
        if (!tagMap[id]) {
            tagMap[id] = {
                tagId: id,
                tagName: name,
                grossPL: 0,
                netPL: 0,
                count: 0,
                volume: 0,
                winsCount: 0
            }
        }
    }

    for (const trade of tradesArray) {
        const tradeTags = trade.tags && trade.tags.length > 0 ? trade.tags : null
        const tagsToApply = tradeTags
            ? tradeTags.map(t => (typeof t === 'object' ? { id: t.id, name: t.name } : { id: t, name: t }))
            : [{ id: '__no_tag__', name: 'No Tag' }]

        for (const tag of tagsToApply) {
            ensureTag(tag.id, tag.name)
            const entry = tagMap[tag.id]
            entry.grossPL += trade.grossProceeds || 0
            entry.netPL += trade.netProceeds || 0
            entry.count += 1
            entry.volume += (trade.buyQuantity || 0) + (trade.sellQuantity || 0)
            if ((trade[proceedsKey] || 0) > 0) entry.winsCount += 1
        }
    }

    const result = Object.values(tagMap).map(entry => ({
        tagId: entry.tagId,
        tagName: entry.tagName,
        grossPL: entry.grossPL,
        netPL: entry.netPL,
        count: entry.count,
        volume: entry.volume,
        avgTrade: entry.count > 0 ? (isGross ? entry.grossPL : entry.netPL) / entry.count : 0,
        winRate: entry.count > 0 ? entry.winsCount / entry.count : 0
    }))

    // Sort descending by selected P&L
    result.sort((a, b) => (isGross ? b.grossPL - a.grossPL : b.netPL - a.netPL))

    return result
}

/**
 * Main orchestration entry point. Called after totals and groups have been
 * populated by useTotalTrades() and useGroupTrades(). Computes all report
 * statistics and populates the reactive report store objects.
 *
 * Populates:
 *   - reportDetailedStats
 *   - reportWinDayStats
 *   - reportLossDayStats
 *   - reportDrawdownStats
 *   - reportTagBreakdown
 *
 * @returns {Promise<void>}
 */
export async function useCalculateReportStats() {
    console.log("  --> Calculating report stats")
    const ac = amountCase.value

    // Detailed stats
    const detailed = useCalculateDetailedStats(filteredTradesTrades, totalsByDate, totals, ac)
    Object.keys(reportDetailedStats).forEach(k => delete reportDetailedStats[k])
    Object.assign(reportDetailedStats, detailed)

    // Win/Loss day stats
    const winLoss = useCalculateWinLossDayStats(totalsByDate, ac)
    Object.keys(reportWinDayStats).forEach(k => delete reportWinDayStats[k])
    Object.assign(reportWinDayStats, winLoss.winDays)
    Object.keys(reportLossDayStats).forEach(k => delete reportLossDayStats[k])
    Object.assign(reportLossDayStats, winLoss.lossDays)

    // Drawdown stats
    const dd = useCalculateDrawdownStats(totalsByDate, ac)
    Object.keys(reportDrawdownStats).forEach(k => delete reportDrawdownStats[k])
    Object.assign(reportDrawdownStats, dd)

    // Tag breakdown
    const tagBd = useCalculateTagBreakdown(filteredTradesTrades, ac)
    reportTagBreakdown.length = 0
    tagBd.forEach(t => reportTagBreakdown.push(t))
}
