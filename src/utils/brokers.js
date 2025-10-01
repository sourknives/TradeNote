
//"T/D": "month/day/2022",

import { tradesData, timeZoneTrade, futureContractsJson, futuresTradeStationFees, futuresTradovateFees, selectedTradovateTier, futuresTopstepXFees } from "../stores/globals.js"

/* MODULES */
import Parse from 'parse/dist/parse.min.js'
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
import Papa from 'papaparse';
import _ from 'lodash'
import * as XLSX from 'xlsx';


tradesData.length = 0

/****************************
 * TRADEZERO
 ****************************/
export async function useBrokerTradeZero(param) {
    return new Promise(async (resolve, reject) => {
        //File import

        try {
            //we need to recreate the JSON with proper date format + we simplify

            let tempArray = []

            if (typeof param === "string") {
                let papaParse = Papa.parse(param, { header: true })
                tempArray = papaParse.data
            } else {
                tempArray = param
            }
            const types = ["stock", "future", "forex", "call", "put"]
            tempArray.forEach(element => {
                if (element.Type == "" || !types.includes(element.Type)) {
                    element.Type = "stock"

                }
                element.SymbolOriginal = element["Symbol"]
                tradesData.push(JSON.parse(JSON.stringify(element)))
            });
            //console.log("tradesData " + JSON.stringify(tradesData))
        } catch (error) {
            //console.log("  --> ERROR " + error)
            reject(error)
        }


        resolve()
    })
}

/****************************
 * METATRADER 5
 ****************************/
export async function useBrokerMetaTrader5(param) {
    return new Promise(async (resolve, reject) => {
        try {
            var workbook = XLSX.read(param);
            var result = {};
            workbook.SheetNames.forEach((sheetName) => {
                var roa = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);
                if (roa.length > 0) {
                    result[sheetName] = roa;
                }
            });
            //console.log("result "+JSON.stringify(result))
            let accountKey = result[Object.keys(result)[0]].findIndex(item => item["Trade History Report"] == "Account:")
            //console.log("account key " + accountKey)
            let dealsKey = result[Object.keys(result)[0]].findIndex(item => item["Trade History Report"] == "Deals")
            //console.log("deals key " + dealsKey)

            let accountJson = result[Object.keys(result)[0]][accountKey] // doit it this way instead of naming keys in case key names change
            let account = [Object.values(accountJson)[1]][0].split(" ")[0]
            //console.log("Account "+JSON.stringify(account))

            let dealIterate = true

            for (let i = dealsKey + 2; dealIterate; i++) {
                let temp = {}
                let row = result[Object.keys(result)[0]][i]
                //console.log("row "+JSON.stringify(row))
                if (!row.hasOwnProperty("Trade History Report")) {
                    dealIterate = false
                } else {
                    //console.log("row " + JSON.stringify(row))
                    //check for balance
                    let checkBalance = Object.values(row)[2]
                    if (checkBalance != "balance") {
                        temp.Account = account
                        let tempDate = Object.values(row)[0].split(" ")[0]
                        let newDate = tempDate.split(".")[1] + "/" + tempDate.split(".")[2] + "/" + tempDate.split(".")[0]
                        temp["T/D"] = newDate
                        temp["S/D"] = newDate
                        temp.Currency = "USD"
                        temp.Type = "stock"
                        if (Object.values(row)[2].length == 6 && /^[a-zA-Z]/.test(Object.values(row)[2])) {
                            temp.Type = "forex"
                        }
                        //console.log("  --> Type: " + temp.Type)
                        if (Object.values(row)[3] == "buy" && Object.values(row)[4] == "in") {
                            temp.Side = "B"
                        }
                        if (Object.values(row)[3] == "buy" && Object.values(row)[4] == "out") {
                            temp.Side = "BC"
                        }
                        if (Object.values(row)[3] == "sell" && Object.values(row)[4] == "in") {
                            temp.Side = "SS"
                        }
                        if (Object.values(row)[3] == "sell" && Object.values(row)[4] == "out") {
                            temp.Side = "S"
                        }
                        temp.SymbolOriginal = Object.values(row)[2]
                        temp.Symbol = Object.values(row)[2].replace(/#*/, '')
                        temp.Qty = (Object.values(row)[5]).toString()
                        //console.log(" -> Qty import "+temp.Qty)
                        temp.Price = Object.values(row)[6].toString()
                        temp["Exec Time"] = Object.values(row)[0].split(" ")[1]

                        temp.Comm = (-Object.values(row)[8]).toString()
                        temp.SEC = (-Object.values(row)[9]).toString()
                        temp.TAF = (-Object.values(row)[10]).toString()
                        temp.NSCC = "0"
                        temp.Nasdaq = "0"
                        temp["ECN Remove"] = "0"
                        temp["ECN Add"] = "0"
                        temp["Gross Proceeds"] = Object.values(row)[11].toString()
                        temp["Net Proceeds"] = (Object.values(row)[11] + Object.values(row)[8] + Object.values(row)[9] + Object.values(row)[10]).toString()
                        temp["Clr Broker"] = ""
                        temp.Liq = ""
                        temp.Note = ""
                        tradesData.push(temp)
                    }
                }
            }
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        //console.log("trade data " + JSON.stringify(tradesData))
        resolve()
    })
}


/****************************
 * TD AMERITRADE
 ****************************/
export async function useBrokerTdAmeritrade(param) {
    return new Promise(async (resolve, reject) => {
        try {
            let arrayLines = param.split('\n')
            let account

            let cashBalanceStart
            let cashBalanceEnd
            let accountTradeHistoryStart
            let accountTradeHistoryEnd = 0
            let cashBalanceCsv
            let accountTradeHistoryCsv


            arrayLines.forEach((element, index) => {
                if (element.includes("Account Statement")) {
                    account = element.split(" ")[3]
                    //console.log("account "+account)
                }
                if (element.includes("Cash Balance")) {
                    cashBalanceStart = (index + 1)
                    console.log("  --> Cash Balance start row " + cashBalanceStart)
                }
                if (element.includes("Futures Statements")) {
                    cashBalanceEnd = (index - 3)
                    console.log("  --> Cash Balance end row " + cashBalanceEnd)
                }
                if (element.includes("Account Trade History")) {
                    accountTradeHistoryStart = (index + 1)
                    console.log("  --> Account Trade History start row " + accountTradeHistoryStart)
                }

                if ((element.includes("Options") || element.includes("Futures") || element.includes("Equities") || element.includes("Profits and Losses")) && accountTradeHistoryEnd == 0 && (index - 2) > accountTradeHistoryStart) {
                    accountTradeHistoryEnd = (index - 2)
                    console.log("  --> Account Trade History end row " + accountTradeHistoryEnd)
                }
            });

            for (let index = cashBalanceStart; index <= cashBalanceEnd; index++) {
                const element = arrayLines[index];
                //console.log(" element "+element)
                cashBalanceCsv == undefined ? cashBalanceCsv = element + "\n" : cashBalanceCsv = cashBalanceCsv + element + "\n"

            }
            for (let index2 = accountTradeHistoryStart; index2 <= accountTradeHistoryEnd; index2++) {
                const element2 = arrayLines[index2];
                //console.log("element 2 "+element2)
                accountTradeHistoryCsv == undefined ? accountTradeHistoryCsv = element2 + "\n" : accountTradeHistoryCsv = accountTradeHistoryCsv + element2 + "\n"
            }
            //console.log("cashBalanceCsv \n" + cashBalanceCsv)
            //console.log("accountTradeHistoryCsv \n" + accountTradeHistoryCsv)



            let papaParseCashBalance = Papa.parse(cashBalanceCsv, { header: true })
            let papaParseAccountTradeHistory = Papa.parse(accountTradeHistoryCsv, { header: true })

            let cashBalanceJsonArrayTemp = papaParseCashBalance.data
            let accountTradeHistoryJsonArrayTemp = papaParseAccountTradeHistory.data.reverse()
            let cashBalanceJsonArray = []
            let accountTradeHistoryJsonArray = []

            /*****************************
             * CREATING ACCOUNT TRADE HISTORY
             *****************************/
            const keys2 = Object.keys(accountTradeHistoryJsonArrayTemp);
            for (const key2 of keys2) {
                if (accountTradeHistoryJsonArrayTemp[key2].hasOwnProperty("Symbol")) {
                    accountTradeHistoryJsonArray.push(accountTradeHistoryJsonArrayTemp[key2])
                }
            }

            /*****************************
             * CREATING CASH BALANCE
             *****************************/
            const keys = Object.keys(cashBalanceJsonArrayTemp);
            for (const key of keys) {
                //console.log("key " + JSON.stringify(papaParseCashBalance.data[key]))
                if (cashBalanceJsonArrayTemp[key].TYPE === "TRD" || (cashBalanceJsonArrayTemp[key].TYPE === "RAD" && cashBalanceJsonArrayTemp[key].DESCRIPTION.includes("REMOVAL"))) {
                    cashBalanceJsonArray.push(cashBalanceJsonArrayTemp[key])
                }
            }

            /*****************************
             * CREATING TRADES DATA
             *****************************/

            const pushTradesData = (param1, param2, param3) => {
                return new Promise(async (resolve, reject) => {
                    let descArray = param1.DESCRIPTION.split(" ")

                    let type
                    let side
                    let symb
                    let symbolOriginal
                    let qtyNumber
                    let priceNumber
                    let amount
                    let comm
                    let fees

                    if (param3 == 1) {
                        type = "stock"
                        if (param2.Type == "FUTURE") {
                            type = "future"
                        }
                        if (param2.Type == "CALL" || param2.Type == "PUT") {
                            param2.Type == "CALL" ? type = "call" : type == "put"
                        }

                        if (param2.Side == "BUY" && param2["Pos Effect"] == "TO OPEN") {
                            side = "B"
                        }
                        if (param2.Side == "BUY" && param2["Pos Effect"] == "TO CLOSE") {
                            side = "BC"
                        }
                        if (param2.Side == "SELL" && param2["Pos Effect"] == "TO OPEN") {
                            side = "SS"
                        }
                        if (param2.Side == "SELL" && param2["Pos Effect"] == "TO CLOSE") {
                            side = "S"
                        }

                        symb = param2.Symbol
                        symbolOriginal = symb

                        if (symb.includes("/")) {
                            let temp1 = symb.slice(1)
                            let temp2 = temp1.slice(0, -3)
                            symb = temp2
                        }

                        qtyNumber = Number(param2.Qty)
                        priceNumber = Number(param2.Price)
                        amount = param1.AMOUNT.toString()
                        comm = param1["Commissions & Fees"].toString()
                        fees = param1["Misc Fees"].toString()
                    }
                    if (param3 == 2) {//closing option position on exercice
                        let botSell = descArray[0]
                        botSell == "BOT" ? type = "call" : type = "put"// if buying when exerciing the stock, it's a call because you can then sell it
                        symb = descArray[2]
                        botSell == "BOT" ? side = "S" : side = "BC"
                        let numQty = Math.trunc(descArray[1])
                        let tempQty = numQty / 100
                        botSell == "BOT" ? qtyNumber = tempQty : qtyNumber = -tempQty
                        priceNumber = 0
                        amount = ""
                        comm = param1["Commissions & Fees"].toString()
                        fees = param1["Misc Fees"].toString()
                    }

                    if (param3 == 3) {//opening underlying stock position on exercice
                        type = "stock"
                        let botSell = descArray[0] == "BOT" ? "BUY" : "SELL"
                        symb = descArray[2]
                        botSell == "BOT" ? side = "B" : side = "SS"
                        let numQty = Math.trunc(descArray[1])
                        botSell == "BOT" ? qtyNumber = numQty : qtyNumber = -numQty
                        amount = param1.AMOUNT.toString()
                        comm = param1["Commissions & Fees"].toString()
                        fees = param1["Misc Fees"].toString()
                        let numAmount = parseFloat(amount.replace(/,/g, ''))
                        botSell == "BOT" ? priceNumber = -numAmount / numQty : priceNumber = numAmount / numQty

                    }

                    if (param3 == 4) {//closing option position on removal
                        let botSell
                        Number(descArray[6]) > 0 ? botSell = "BOT" : botSell = "SOLD"
                        symb = descArray[7]
                        type = descArray[descArray.length - 1].toLowerCase()
                        Number(descArray[6]) > 0 ? side = "S" : side = "BC"
                        Number(descArray[6]) > 0 ? qtyNumber = Number(descArray[6]) : qtyNumber = -Number(descArray[6])
                        priceNumber = 0
                        amount = param1.AMOUNT.toString()
                        comm = param1["Commissions & Fees"]
                        fees = param1["Misc Fees"]
                    }

                    let temp = {}
                    temp.Account = account

                    let tempDate = param1.DATE.split(" ")[0]
                    let month = tempDate.split("/")[0]
                    let day = tempDate.split("/")[1]
                    let year = tempDate.split("/")[2]
                    //console.log(" -> Year " + year)
                    //console.log(" -> Year length " + year.length)
                    if (year.length == 4) {
                        temp["T/D"] = param1.DATE
                        temp["S/D"] = param1.DATE
                    } else if (year.length == 2) {
                        let newDate = month + "/" + day + "/20" + year
                        temp["T/D"] = newDate
                        temp["S/D"] = newDate
                    } else {
                        reject("Year length issue")
                    }
                    temp.Currency = "USD"

                    //Type
                    temp.Type = type // if buying when exerciing the stock, it's a call because you can then sell it

                    temp.Side = side

                    temp.SymbolOriginal = symbolOriginal
                    type == "call" || type == "put" ? temp.Symbol = symb + "" + temp.Type.charAt(0) : temp.Symbol = symb

                    qtyNumber >= 0 ? qtyNumber = qtyNumber : qtyNumber = -qtyNumber
                    temp.Qty = qtyNumber.toString()

                    temp.Price = priceNumber.toString()

                    temp["Exec Time"] = param1.TIME
                    //console.log("\n Symbol "+temp.Symbol + " type "+temp.Type+" from "+temp["T/D"]+ " at "+temp["Exec Time"])

                    let numberAmount
                    amount != "" ? numberAmount = parseFloat(amount.replace(/,/g, '')) : numberAmount = 0

                    let numberCommissions
                    comm != "" ? numberCommissions = parseFloat(comm.replace(/,/g, '')) : numberCommissions = 0

                    let numberMisc
                    fees != "" ? numberMisc = parseFloat(fees.replace(/,/g, '')) : numberMisc = 0


                    temp.Comm = (-numberCommissions).toString()
                    temp.SEC = (-numberMisc).toString()
                    temp.TAF = "0"
                    temp.NSCC = "0"
                    temp.Nasdaq = "0"
                    temp["ECN Remove"] = "0"
                    temp["ECN Add"] = "0"
                    temp["Gross Proceeds"] = numberAmount.toString()
                    temp["Net Proceeds"] = (numberAmount + numberCommissions + numberMisc).toString()
                    temp["Clr Broker"] = ""
                    temp.Liq = ""
                    temp.Note = ""

                    tradesData.push(temp)
                    resolve()
                })
            }

            cashBalanceJsonArray.forEach(async (element) => {
                //console.log("\n" + element.DATE + " " + element.TIME)
                //console.log(" element "+JSON.stringify(element))
                if (element.DESCRIPTION.includes("EXERCISE")) {
                    await pushTradesData(element, "", 2) // closing option position
                    await pushTradesData(element, "", 3) // opening underlying stock position
                } else if (element.DESCRIPTION.includes("REMOVAL")) {
                    await pushTradesData(element, "", 4) // closing option position
                } else {
                    let match = false
                    let index = accountTradeHistoryJsonArray.findIndex(x => x["Exec Time"] == element.DATE + " " + element.TIME)
                    if (index != -1) {
                        let el = accountTradeHistoryJsonArray[index]
                        //console.log(" el " + JSON.stringify(el))
                        //await accountTradeHistoryJsonArray.filter((_, i) => i !== index);
                        //await accountTradeHistoryJsonArray.filter(x => x != el);
                        await accountTradeHistoryJsonArray.splice(index, 1); // we need to remove the element that has already been parsed in case different executions at same date and time happened
                        await pushTradesData(element, el, 1)
                        match = true
                    } else {
                        //alert("No matching execution in Account Trade History for execution in Cash Balance on " + element.DATE + " " + element.TIME + ". Please correct your file manually and upload it again.")
                        reject("No matching execution in Account Trade History for execution in Cash Balance on " + element.DATE + " " + element.TIME + ". Please correct your file manually and upload it again.")
                    }
                }
            });
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        //console.log(" -> Trades Data\n" + JSON.stringify(tradesData))
        resolve()

    })
}

/****************************
 * TRADESTATION
 ****************************/
export async function useBrokerTradeStation(param) {
    return new Promise(async (resolve, reject) => {
        try {
            //console.log(" param " + param)
            let newCsv = [];
            let lines = param.split("\n");
            lines.forEach((item, i) => {
                if (i !== 0) newCsv.push(item);
            })

            newCsv = newCsv.join("\n");
            //console.log(newCsv);


            let papaParse = Papa.parse(newCsv, { header: true })

            papaParse.data.forEach(element => {
                //console.log("element " + JSON.stringify(element))
                if (element["Order Status"] == "Filled") {
                    //console.log("element " + JSON.stringify(element))
                    let temp = {}
                    temp.Account = element.Account.toString()

                    let tempDate = element.Entered.split(" ")[0]
                    let newDate = tempDate.split("/")[0] + "/" + tempDate.split("/")[1] + "/20" + tempDate.split("/")[2]

                    temp["T/D"] = newDate
                    temp["S/D"] = newDate
                    temp.Currency = "USD"

                    //Type
                    temp.Type = "stock"
                    if (element["Contract Exp Date"] != "") {
                        temp.Type = "future"
                    }

                    if (element.Type.includes("to Open") || element.Type.includes("to Close")) {
                        element.Symbol.trim().split(" ")[1].charAt(6) == "C" ? temp.Type = "call" : temp.Type = "put"
                    }
                    console.log("  --> Type " + temp.Type)

                    if (element.Type == "Buy") {
                        temp.Side = "B"
                    }
                    if (element.Type == "Buy to Open") {
                        temp.Side = "B"
                    }

                    if (element.Type == "Buy to Cover") {
                        temp.Side = "BC"
                    }
                    if (element.Type == "Buy to Close") {
                        temp.Side = "BC"
                    }

                    if (element.Type == "Sell") {
                        temp.Side = "S"
                    }
                    if (element.Type == "Sell to Close") {
                        temp.Side = "S"
                    }

                    if (element.Type == "Sell Short") {
                        temp.Side = "SS"
                    }
                    if (element.Type == "Sell to Open") {
                        temp.Side = "SS"
                    }

                    temp.SymbolOriginal = element.Symbol.trim()
                    temp.Symbol = element.Symbol.trim()
                    if (temp.Type == "future") {
                        temp.Symbol = temp.Symbol.slice(0, -3)
                    }
                    if (temp.Type == "call" || temp.Type == "put") {
                        temp.Symbol = temp.Symbol.split(" ")[0]
                    }

                    let qtyNumber = Number(element["Qty Filled"])
                    temp.Qty = qtyNumber.toString()

                    //Futures have big prices, comma separated
                    let priceNumber = Number(element["Filled Price"].replace(/,/g, ''))
                    //console.log("priceNumber "+priceNumber)
                    temp.Price = priceNumber.toString()

                    let tempTime = element.Entered.split(" ")[1]
                    let tempTimeAMPM = element.Entered.split(" ")[2]
                    let tempHour = Number(tempTime.split(":")[0])
                    let newTime
                    if (tempTimeAMPM == "PM" && tempHour != 12) {
                        tempHour = tempHour + 12
                        newTime = tempHour + ":" + tempTime.split(":")[1] + ":" + tempTime.split(":")[2]
                    } else {
                        newTime = tempTime
                    }

                    temp["Exec Time"] = newTime

                    let commNumber = Number(element.Commission.replace("$", ""))
                    temp.Comm = commNumber.toString()

                    temp.SEC = "0"
                    temp.TAF = "0"
                    temp.NSCC = "0"
                    temp.Nasdaq = "0"
                    temp["ECN Remove"] = "0"
                    temp["ECN Add"] = "0"

                    let serviceFeeNumber = 0
                    let nfaRegFee = 0.02
                    if (temp.Type == "future") {
                        let echangeFees = futuresTradeStationFees.value.filter(item => item.symbol == temp.Symbol)
                        if (echangeFees) {
                            serviceFeeNumber = (echangeFees[0].fee + nfaRegFee) * temp.Qty
                            console.log("serviceFeeNumber " + serviceFeeNumber)
                            temp.SEC = (serviceFeeNumber).toString()
                        } else {
                            reject("No ECN Fees found")
                        }

                    }

                    let tick
                    let value
                    if (temp.Type == "future") {
                        let contractSpecs = futureContractsJson.value.filter(item => item.symbol == temp.Symbol)
                        tick = contractSpecs[0].tick
                        value = contractSpecs[0].value
                    }

                    //let's prepare and calculate qty and proceeds, depending on side and type
                    let qtyNumberSide
                    let proceedsNumber

                    if (temp.Side == "B" || temp.Side == "BC") {
                        qtyNumberSide = -qtyNumber
                    } else {
                        qtyNumberSide = qtyNumber
                    }

                    if (temp.Type == "stock") {
                        proceedsNumber = (qtyNumberSide * priceNumber)
                    }
                    if (temp.Type == "future") {
                        proceedsNumber = (qtyNumberSide * priceNumber) / tick * value
                    }
                    if (temp.Type == "call" || temp.Type == "put") {
                        proceedsNumber = (qtyNumberSide * 100 * priceNumber)
                    }

                    temp["Gross Proceeds"] = proceedsNumber.toString()
                    temp["Net Proceeds"] = (proceedsNumber - commNumber - serviceFeeNumber).toString()

                    temp["Clr Broker"] = ""
                    temp.Liq = ""
                    temp.Note = ""
                    //console.log("temp "+JSON.stringify(temp))
                    tradesData.push(temp)
                }
            });
            //console.log(" -> Trades Data\n" + JSON.stringify(tradesData))

        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        resolve()
    })
}

/****************************
 * INTERACTIVE BROKERS
 ****************************/
export async function useBrokerInteractiveBrokers(param, param2) {
    return new Promise(async (resolve, reject) => {
        try {
            //console.log("param "+param)
            let papaParse = Papa.parse(param, { header: true })

            papaParse.data.sort((a, b) => dayjs(a["Date/Time"], "YYYYMMDD;HHmmss") - dayjs(b["Date/Time"], "YYYYMMDD;HHmmss"))

            //we need to recreate the JSON with proper date format + we simplify
            //console.log("papaparse " + JSON.stringify(papaParse.data))
            papaParse.data.forEach(element => {
                if (element.ClientAccountID && element.AssetClass != "CASH") {
                    //console.log("element " + JSON.stringify(element))
                    let temp = {}
                    temp.Account = element.ClientAccountID

                    let tempDate = element["Date/Time"].split(";")[0]
                    let tempTime = element["Date/Time"].split(";")[1]


                    //console.log("element.TradeDate. " + element.TradeDate)
                    let tempYear = tempDate.slice(0, 4)
                    let tempMonth = tempDate.slice(4, 6)
                    let tempDay = tempDate.slice(6, 8)
                    let newDate = tempMonth + "/" + tempDay + "/" + tempYear

                    temp["T/D"] = newDate
                    temp["S/D"] = newDate
                    temp.Currency = element.CurrencyPrimary
                    //Type
                    temp.Type = "stock"
                    if (element.AssetClass == "FUT") {
                        temp.Type = "future"
                    }
                    if (element.AssetClass == "OPT") {
                        element["Put/Call"] == "C" ? temp.Type = "call" : temp.Type = "put"
                    }

                    //console.log("  --> Type " + temp.Type)

                    if (element["Buy/Sell"] == "BUY" && (element["Code"].includes("O"))) {
                        temp.Side = "B"
                    }
                    if (element["Buy/Sell"] == "BUY" && (element["Code"].includes("C"))) {
                        temp.Side = "BC"
                    }
                    if (element["Buy/Sell"] == "SELL" && (element["Code"].includes("C"))) {
                        temp.Side = "S"
                    }
                    if (element["Buy/Sell"] == "SELL" && (element["Code"].includes("O"))) {
                        temp.Side = "SS"
                    }

                    temp.SymbolOriginal = element["Symbol"]

                    if (temp.Type == "stock") {
                        temp.Symbol = element["Symbol"]
                    } else {
                        temp.Symbol = element["UnderlyingSymbol"]
                    }

                    temp.Qty = Number(element.Quantity) < 0 ? (-Number(element.Quantity)).toString() : element.Quantity
                    temp.Price = element.Price

                    let tempEntryHour = tempTime.slice(0, 2)
                    let tempEntryMinutes = tempTime.slice(2, 4)
                    let tempEntrySeconds = tempTime.slice(4, 6)

                    temp["Exec Time"] = tempEntryHour + ":" + tempEntryMinutes + ":" + tempEntrySeconds
                    
                    let commNum = Number(element.Commission)
                    temp.Comm = (-commNum).toString()

                    temp.SEC = "0"
                    temp.TAF = "0"
                    temp.NSCC = "0"
                    temp.Nasdaq = "0"
                    temp["ECN Remove"] = "0"
                    temp["ECN Add"] = "0"
                    temp["Gross Proceeds"] = element.Proceeds
                    temp["Net Proceeds"] = element.Proceeds - (-commNum) // I'm not using Net Cash because on same day or sometimes with normal input, Net Cash is not / still not calculated on IBKR side. So I calculate it myself
                    temp["Clr Broker"] = ""
                    temp.Liq = ""
                    temp.Note = ""
                    //console.log("temp "+JSON.stringify(temp))
                    tradesData.push(temp)
                }
            });
            //console.log(" -> Trades Data\n" + JSON.stringify(tradesData))
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        resolve()
    })
}

/****************************
 * TRADOVATE
 ****************************/
export async function useTradovate(param) {
    return new Promise(async (resolve, reject) => {
        try {

            let papaParse = Papa.parse(param, { header: true })
            let papaParseNew = []
            //we need to recreate the JSON with proper date format + we simplify
            papaParse.data.forEach(element => {
                if (element.orderId && element.Status.trim() == "Filled") {
                    //console.log("element " + JSON.stringify(element))
                    element.execTime = dayjs.tz(element["Fill Time"], timeZoneTrade.value).unix()
                    element["B/S"] = element["B/S"].trim()
                    papaParseNew.push(element)
                }
            })

            //console.log(" -> PapaparseNew  " + JSON.stringify(papaParseNew))

            var b = _
                .chain(papaParseNew)
                .orderBy(["execTime"], ["asc"])
                .groupBy("Contract");

            //console.log(" -> b: " + JSON.stringify(b))
            let objectB = JSON.parse(JSON.stringify(b))
            //console.log("object b "+JSON.stringify(objectB))

            // We iterate through each symbol (key2)
            const keys2 = Object.keys(objectB);


            for (const key2 of keys2) {
                var tempExecs = objectB[key2]
                //Count number of wins and losses for later total number of wins and losses
                let newTrade = true
                let strategy
                let totalQty = 0
                for (let i = 0; i < tempExecs.length; i++) {
                    let tempExec = tempExecs[i];
                    //console.log( "-> tempExec: "+JSON.stringify(tempExec))

                    let temp = {}
                    temp.Account = tempExec.Account

                    let month = tempExec.Date.split("/")[0]
                    let day = tempExec.Date.split("/")[1]
                    let year = tempExec.Date.split("/")[2]

                    if (year.length == 4) {
                        temp["T/D"] = tempExec.Date
                        temp["S/D"] = tempExec.Date
                    } else if (year.length == 2) {
                        let newDate = month + "/" + day + "/20" + year
                        temp["T/D"] = newDate
                        temp["S/D"] = newDate
                    } else {
                        reject("Year length issue")
                    }

                    temp.Currency = "USD"
                    temp.Type = "future"

                    let qtyNumber = Number(tempExec["Filled Qty"])
                    temp.Qty = qtyNumber.toString()

                    if (newTrade == true && tempExec["B/S"] == "Buy") { //= new trade
                        newTrade = false
                        strategy = "long"
                        temp.Side = "B"
                        totalQty += qtyNumber

                    } else if (newTrade == true && tempExec["B/S"] == "Sell") {
                        newTrade = false
                        strategy = "short"
                        temp.Side = "SS"
                        totalQty += -qtyNumber
                    }
                    else if (newTrade == false && tempExec["B/S"] == "Buy") {
                        strategy == "long" ? temp.Side = "B" : temp.Side = "BC"
                        totalQty += +qtyNumber
                    }
                    else if (newTrade == false && tempExec["B/S"] == "Sell") {
                        strategy == "long" ? temp.Side = "S" : temp.Side = "SS"
                        totalQty += -qtyNumber
                    }

                    totalQty == 0 ? newTrade = true : newTrade = false

                    temp.SymbolOriginal = tempExec.Contract
                    temp.Symbol = tempExec.Product


                    let priceNumber = Number(tempExec["Avg Fill Price"])
                    temp.Price = priceNumber.toString()

                    //console.log(" Exec Time "+dayjs(tempExec["Fill Time"], "HH:mm:ss").unix())
                    temp["Exec Time"] = dayjs(tempExec["Fill Time"]).format("HH:mm:ss")

                    let contractSpecs = futureContractsJson.value.filter(item => item.symbol == temp.Symbol)
                    //console.log(" -> contractSpecs " + JSON.stringify(contractSpecs))
                    if (contractSpecs.length == 0) {
                        reject("Missing information for future symbol " + temp.Symbol)
                    }
                    let tick = contractSpecs[0].tick
                    let value = contractSpecs[0].value

                    let qtyNumberSide

                    if (temp.Side == "B" || temp.Side == "BC") {
                        qtyNumberSide = -qtyNumber
                    } else {
                        qtyNumberSide = qtyNumber
                    }

                    let proceedsNumber = (qtyNumberSide * priceNumber) / tick * value // contract value (https://www.degiro.co.uk/knowledge/investing-in-futures/index-futures)
                    //console.log(" Symobole "+temp.Symbol+" on "+temp["T/D"]+" has gross proceed of " + proceedsNumber)

                    temp["Gross Proceeds"] = proceedsNumber.toString()

                    let echangeFees = futuresTradovateFees.value.filter(item => item.symbol == temp.Symbol)
                    let commNumber = 0
                    if (echangeFees) {
                        //console.log(" -> exchange fee "+JSON.stringify(echangeFees[0].fee))
                        //console.log(" -> fee "+echangeFees[0].fee[selectedTradovateTier.value])
                        commNumber = echangeFees[0].fee[selectedTradovateTier.value] * qtyNumber
                    } else {
                        reject("No Fees found")
                    }
                    temp.Comm = commNumber.toString()
                    temp.SEC = "0"
                    temp.TAF = "0"
                    temp.NSCC = "0"
                    temp.Nasdaq = "0"
                    temp["ECN Remove"] = "0"
                    temp["ECN Add"] = "0"
                    temp["Net Proceeds"] = (proceedsNumber - commNumber).toString()
                    temp["Clr Broker"] = ""
                    temp.Liq = ""
                    temp.Note = ""
                    //console.log("temp "+JSON.stringify(temp))
                    tradesData.push(temp)



                }
            }

            //console.log(" -> Trades Data\n" + JSON.stringify(tradesData))
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        resolve()
    })
}

/****************************
 * HELDENTRADER (no swing trading)
 ****************************/
// Removed csv lines + reversed csv
export async function useBrokerHeldentrader(param) {
    return new Promise(async (resolve, reject) => {
        try {
            //console.log(" param " + param)

            // 1- remove Trades Report line

            const lines = param.split('\n');

            let found = false
            let lineNumber = 0
            for (let line of lines) {
                lineNumber++;
                if (line.includes("Trades report")) {
                    found = true;
                    break;
                }
            }
            let tempLines = lines.slice(lineNumber)

            // 2- Remove and store the header
            let header = tempLines.shift();

            // 3- Reverse the order of lines (excluding the header)
            let reversedLines = tempLines.reverse();

            // 4- Remove Total
            let foundTotal = false
            let lineNumberTotal = 0
            for (let line of reversedLines) {
                lineNumberTotal++;
                if (line.includes("Total")) {
                    foundTotal = true;
                    break;
                }
            }

            let tempReversedLines = reversedLines.slice(lineNumberTotal)

            // 5- Re-add the header to the top
            tempReversedLines.unshift(header);

            // 6- Recreate the csv
            param = tempReversedLines.join('\n');

            let papaParse = Papa.parse(param, { header: true })
            //we need to recreate the JSON with proper date format + we simplify
            //console.log("papaparse " + JSON.stringify(papaParse.data))
            let newTrade = true
            let strategy
            let totalQty = 0
            papaParse.data.forEach(element => {
                if (element.Account && element.Account != "Total") {
                    let temp = {}
                    temp.Account = element.Account
                    //let tempDate = dayjs(element.Date).tz(timeZoneTrade.value).format('MM/DD/YYYYTHH:mm:ss')
                    //console.log(" tempDate "+tempDate)
                    //console.log("element.TradeDate. " + element.TradeDate)
                    let tempDate = element.Date.split(" ")[0]
                    let tempTime = element.Date.split(" ")[1]
                    let tempDD = tempDate.split(".")[0]
                    let tempMM = tempDate.split(".")[1]
                    let tempYYYY = tempDate.split(".")[2]

                    //let tempTime = element.Date.split(" ")[1]

                    let newTime = tempMM + "/" + tempDD + "/" + tempYYYY + " " + tempTime
                    //console.log(" newTime "+newTime)
                    temp["T/D"] = dayjs(newTime).tz(timeZoneTrade.value).format('MM/DD/YYYY')
                    temp["S/D"] = dayjs(newTime).tz(timeZoneTrade.value).format('MM/DD/YYYY')
                    //console.log("td "+temp["T/D"])
                    temp.Currency = "USD"
                    temp.Type = "stock"
                    /* NO Client order ID means closing trade
                    if (!element["Client order ID"] && element.Operation == "Sell") {
                        temp.Side = "S"
                    }
                    if (!element["Client order ID"] && element.Operation == "Buy") {
                        temp.Side = "BC"
                    }
                    
                    // IF Client order ID and profit == 0 means new trade trade
                    if (element["Client order ID"] && Number(element.Profit) == 0 && element.Operation == "Buy") {
                        temp.Side = "B"
                    }
                    if (element["Client order ID"] && Number(element.Profit) == 0 && element.Operation == "Sell") {
                        temp.Side = "SS"
                    }*/

                    let qtyNumber = Number(element["Amount"])
                    temp.Qty = qtyNumber.toString()

                    if (newTrade == true && element.Operation == "Buy") { //= new trade
                        newTrade = false
                        strategy = "long"
                        temp.Side = "B"
                        totalQty += qtyNumber

                    } else if (newTrade == true && element.Operation == "Sell") {
                        newTrade = false
                        strategy = "short"
                        temp.Side = "SS"
                        totalQty += -qtyNumber
                    }
                    else if (newTrade == false && element.Operation == "Buy") {
                        strategy == "long" ? temp.Side = "B" : temp.Side = "BC"
                        totalQty += +qtyNumber
                    }
                    else if (newTrade == false && element.Operation == "Sell") {
                        strategy == "long" ? temp.Side = "S" : temp.Side = "SS"
                        totalQty += -qtyNumber
                    }

                    totalQty == 0 ? newTrade = true : newTrade = false

                    temp.SymbolOriginal = element.Instrument
                    temp.Symbol = element.Instrument

                    temp.Price = element.Price

                    temp["Exec Time"] = dayjs(newTime).tz(timeZoneTrade.value).format('HH:mm:ss')

                    temp.Comm = Number(-element["Execution fee"]).toString()
                    temp.SEC = "0"
                    temp.TAF = "0"
                    temp.NSCC = "0"
                    temp.Nasdaq = "0"
                    temp["ECN Remove"] = "0"
                    temp["ECN Add"] = "0"
                    temp["Gross Proceeds"] = element.Profit
                    temp["Net Proceeds"] = (Number(temp["Gross Proceeds"]) - Number(-element["Execution fee"])).toString()
                    temp["Clr Broker"] = ""
                    temp.Liq = ""
                    temp.Note = ""
                    //console.log("temp "+JSON.stringify(temp))*/
                    tradesData.push(temp)
                }
            })

            //console.log(" -> Trades Data\n" + JSON.stringify(tradesData))
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        resolve()
    })
}

/****************************
 * NINJATRADER
 ****************************/
export async function useNinjaTrader(param) {
    return new Promise(async (resolve, reject) => {
        try {

            let papaParse = Papa.parse(param, { header: true })
            //we need to recreate the JSON with proper date format + we simplify
            //console.log("papaparse " + JSON.stringify(papaParse.data))

            papaParse.data.forEach(element => {
                if (element.Instrument) {
                    //console.log("element " + JSON.stringify(element))
                    let temp = {}
                    temp.Account = element.Account
                    //console.log("element.TradeDate. " + element.TradeDate)
                    let date = element.Time.split(" ")[0]

                    temp["T/D"] = date
                    temp["S/D"] = date

                    temp.Currency = "USD"
                    temp.Type = "future"

                    let qtyNumber = Number(element.Quantity)
                    temp.Qty = qtyNumber.toString()


                    if (element.Action == "Buy" && element["E/X"] == "Entry") {
                        temp.Side = "B"
                    }
                    if (element.Action == "Buy" && element["E/X"] == "Exit") {
                        temp.Side = "BC"
                    }
                    if (element.Action == "Sell" && element["E/X"] == "Exit") {
                        temp.Side = "S"
                    }
                    if (element.Action == "Sell" && element["E/X"] == "Entry") {
                        temp.Side = "SS"
                    }

                    temp.SymbolOriginal = element.Instrument
                    temp.Symbol = element.Instrument.split(" ")[0]

                    let priceNumber = Number(element.Price)
                    temp.Price = priceNumber.toString()

                    temp["Exec Time"] = dayjs(element.Time).format("HH:mm:ss") // we do not use tz because at start you should precise that you're in NY timezone + in settings set the NY time format before export
                    //console.log(" exect time "+temp["Exec Time"])
                    //temp["Exec Time"] = dayjs(element.Time, "hh:mm:ss A").format("HH:mm:ss")

                    let contractSpecs = futureContractsJson.value.filter(item => item.symbol == temp.Symbol)
                    //console.log(" -> contractSpecs " + JSON.stringify(contractSpecs))
                    if (contractSpecs.length == 0) {
                        reject("Missing information for future symbol " + temp.Symbol)
                    }
                    let tick = contractSpecs[0].tick
                    let value = contractSpecs[0].value

                    let qtyNumberSide

                    if (temp.Side == "B" || temp.Side == "BC") {
                        qtyNumberSide = -qtyNumber
                    } else {
                        qtyNumberSide = qtyNumber
                    }

                    let proceedsNumber = (qtyNumberSide * priceNumber) / tick * value // contract value (https://www.degiro.co.uk/knowledge/investing-in-futures/index-futures)
                    //console.log(" Symobole "+temp.Symbol+" on "+temp["T/D"]+" has gross proceed of " + proceedsNumber)

                    temp["Gross Proceeds"] = proceedsNumber.toString()

                    let commNumber = Number(element.Commission.split("$")[1])
                    temp.Comm = commNumber.toString()

                    temp.SEC = "0"
                    temp.TAF = "0"
                    temp.NSCC = "0"
                    temp.Nasdaq = "0"
                    temp["ECN Remove"] = "0"
                    temp["ECN Add"] = "0"
                    temp["Net Proceeds"] = (proceedsNumber - commNumber).toString()
                    temp["Clr Broker"] = ""
                    temp.Liq = ""
                    temp.Note = ""

                    //console.log("temp " + JSON.stringify(temp))
                    tradesData.push(temp)
                }
            });
            //console.log(" -> Trades Data\n" + JSON.stringify(tradesData))
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        resolve()
    })
}

/****************************
 * RITHMIC (no swing trading)
 ****************************/
// start papaparse from specific line number
export async function useRithmic(param) {
    return new Promise(async (resolve, reject) => {
        try {

            const lines = param.split('\n');
            //console.log(" lines " + lines)

            let found = false
            let lineNumber = 0
            for (let line of lines) {
                lineNumber++;
                if (line.includes("Completed Orders")) {
                    console.log(" line number " + lineNumber)
                    found = true;
                    break;
                }
            }

            param = lines.slice(lineNumber).join('\n');

            let papaParse = Papa.parse(param, { header: true })
            //we need to recreate the JSON with proper date format + we simplify
            //console.log("papaparse " + JSON.stringify(papaParse.data))

            var a = _(papaParse.data)
                .groupBy('Symbol')
                .value()

            let objectA = JSON.parse(JSON.stringify(a))
            const keys = Object.keys(a);


            let newTrade = true
            let strategy
            let totalQty = 0

            for (const key of keys) {

                var tempExecs = objectA[key]

                for (let index = 0; index < tempExecs.length; index++) {
                    let tempExec = tempExecs[index];
                    //console.log("-> tempExec: " + JSON.stringify(tempExec))
                    if (tempExec.Account != "" && (tempExec.Status != "Cancelled" || tempExec.Status != "Failed")) {
                        let temp = {}
                        temp.Account = tempExec.Account

                        let tempUpdateTime
                        for (const key in tempExec) {
                            if (Object.hasOwnProperty.call(tempExec, key) && key.includes("Update Time")) {
                                tempUpdateTime = tempExec[key]
                            }
                        }
                        //console.log(" tempUpdateTime " + tempUpdateTime)

                        let dateTime = tempUpdateTime.split(" ")
                        let month = dateTime[0].split("-")[1]
                        let day = dateTime[0].split("-")[2]
                        let year = dateTime[0].split("-")[0]

                        //08/25/2023
                        let newDate = month + "/" + day + "/" + year
                        temp["T/D"] = newDate
                        temp["S/D"] = newDate

                        temp.Currency = "USD"
                        temp.Type = "future"

                        let qtyNumber = Number(tempExec["Qty Filled"])
                        temp.Qty = qtyNumber.toString()

                        if (newTrade == true && tempExec["Buy/Sell"] == "B") { //= new trade
                            newTrade = false
                            strategy = "long"
                            temp.Side = "B"
                            totalQty += qtyNumber

                        } else if (newTrade == true && tempExec["Buy/Sell"] == "S") {
                            newTrade = false
                            strategy = "short"
                            temp.Side = "SS"
                            totalQty += -qtyNumber
                        }
                        else if (newTrade == false && tempExec["Buy/Sell"] == "B") {
                            strategy == "long" ? temp.Side = "B" : temp.Side = "BC"
                            totalQty += +qtyNumber
                        }
                        else if (newTrade == false && tempExec["Buy/Sell"] == "S") {
                            strategy == "long" ? temp.Side = "S" : temp.Side = "SS"
                            totalQty += -qtyNumber
                        }

                        totalQty == 0 ? newTrade = true : newTrade = false

                        temp.SymbolOriginal = tempExec.Symbol
                        temp.Symbol = tempExec.Symbol.slice(0, -2)


                        let priceNumber = Number(tempExec["Avg Fill Price"])
                        temp.Price = priceNumber.toString()
                        temp["Exec Time"] = dateTime[1]

                        let contractSpecs = futureContractsJson.value.filter(item => item.symbol == temp.Symbol)
                        //console.log(" -> contractSpecs " + JSON.stringify(contractSpecs))
                        if (contractSpecs.length == 0) {
                            reject("Missing information for future symbol " + temp.Symbol)
                        }
                        let tick = contractSpecs[0].tick
                        let value = contractSpecs[0].value

                        let qtyNumberSide

                        if (temp.Side == "B" || temp.Side == "BC") {
                            qtyNumberSide = -qtyNumber
                        } else {
                            qtyNumberSide = qtyNumber
                        }

                        let proceedsNumber = (qtyNumberSide * priceNumber) / tick * value // contract value (https://www.degiro.co.uk/knowledge/investing-in-futures/index-futures)
                        //console.log(" Symobole "+temp.Symbol+" on "+temp["T/D"]+" has gross proceed of " + proceedsNumber)

                        temp["Gross Proceeds"] = proceedsNumber.toString()

                        let commNumber = Number(tempExec["Commission Fill Rate"]) * qtyNumber
                        temp.Comm = commNumber.toString()
                        temp.SEC = "0"
                        temp.TAF = "0"
                        temp.NSCC = "0"
                        temp.Nasdaq = "0"
                        temp["ECN Remove"] = "0"
                        temp["ECN Add"] = "0"
                        temp["Net Proceeds"] = (proceedsNumber - commNumber).toString()
                        temp["Clr Broker"] = ""
                        temp.Liq = ""
                        temp.Note = ""
                        //console.log("temp "+JSON.stringify(temp))
                        tradesData.push(temp)
                    }


                }
            }

            //console.log(" -> Trades Data\n" + JSON.stringify(tradesData))
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        resolve()
    })
}

/****************************
 * FUNDTRADERS (no swing trading)
 ****************************/
// Needs grouping by Symbol
export async function useFundTraders(param) {
    return new Promise(async (resolve, reject) => {
        try {

            let papaParse = Papa.parse(param, { header: true })
            //we need to recreate the JSON with proper date format + we simplify
            //console.log("papaparse " + JSON.stringify(papaParse.data))

            var a = _(papaParse.data)
                .groupBy('Symbol')
                .value()

            let objectA = JSON.parse(JSON.stringify(a))
            const keys = Object.keys(a);

            let newTrade = true
            let strategy
            let totalQty = 0

            for (const key of keys) {

                var tempExecs = objectA[key]

                for (let index = 0; index < tempExecs.length; index++) {
                    let tempExec = tempExecs[index];

                    if (tempExec.Account != "") {
                        let temp = {}
                        temp.Account = tempExec.Account

                        temp["T/D"] = tempExec.Date
                        temp["S/D"] = tempExec.Date

                        temp.Currency = "USD"
                        temp.Type = "stock"

                        let qtyNumber = Number(tempExec.Size)
                        temp.Qty = qtyNumber.toString()

                        if (newTrade == true && tempExec.Action == "BOT") { //= new trade
                            newTrade = false
                            strategy = "long"
                            temp.Side = "B"
                            totalQty += qtyNumber

                        } else if (newTrade == true && tempExec.Action == "SLD") {
                            newTrade = false
                            strategy = "short"
                            temp.Side = "SS"
                            totalQty += -qtyNumber
                        }
                        else if (newTrade == false && tempExec.Action == "BOT") {
                            strategy == "long" ? temp.Side = "B" : temp.Side = "BC"
                            totalQty += +qtyNumber
                        }
                        else if (newTrade == false && tempExec.Action == "SLD") {
                            strategy == "long" ? temp.Side = "S" : temp.Side = "SS"
                            totalQty += -qtyNumber
                        }

                        totalQty == 0 ? newTrade = true : newTrade = false

                        temp.SymbolOriginal = tempExec.Symbol
                        temp.Symbol = tempExec.Symbol


                        let priceNumber = Number(tempExec.Price)
                        temp.Price = priceNumber.toString()
                        temp["Exec Time"] = dayjs(tempExec["Exec Time"], "hh:mm:ss A").format("HH:mm:ss")

                        let qtyNumberSide

                        if (temp.Side == "B" || temp.Side == "BC") {
                            qtyNumberSide = -qtyNumber
                        } else {
                            qtyNumberSide = qtyNumber
                        }

                        let proceedsNumber = (qtyNumberSide * priceNumber)

                        temp["Gross Proceeds"] = proceedsNumber.toString()

                        let commNumber = Number(tempExec["Total Fee"]) + Number(tempExec["Sales Fee"])
                        temp.Comm = commNumber.toString()
                        temp.SEC = "0"
                        temp.TAF = "0"
                        temp.NSCC = "0"
                        temp.Nasdaq = "0"
                        temp["ECN Remove"] = "0"
                        temp["ECN Add"] = "0"
                        temp["Net Proceeds"] = (proceedsNumber - commNumber).toString()
                        temp["Clr Broker"] = ""
                        temp.Liq = ""
                        temp.Note = ""
                        //console.log("temp "+JSON.stringify(temp))
                        tradesData.push(temp)
                    }
                }
            }

            //console.log(" -> Trades Data\n" + JSON.stringify(tradesData))
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        resolve()
    })
}

/****************************
 * TASTYTRADE
 ****************************/
export async function useTastyTrade(param, param2) {
    return new Promise(async (resolve, reject) => {
        try {
            let papaParse = Papa.parse(param, { header: true })

            // we need to sort because in case of option exercice I need to look into the past
            papaParse.data.sort((a, b) => {
                return a.Date.localeCompare(b.Date);
            });
            //console.log("papaparse " + JSON.stringify(papaParse.data))

            papaParse.data.forEach(element => {
                //Exclude void rows, money movement and option cash settlements because I calculate them myself
                if (element.Date != "" && element.Type != "Money Movement" && element["Sub Type"] != "Exercise" && element["Sub Type"] != "Assignment") {
                    //console.log(" sub type "+element["Sub Type"])
                    //console.log("element " + JSON.stringify(element))
                    let temp = {}
                    temp.Account = "TastyTrade1"

                    let tempDate = element.Date.split("T")[0]
                    let tempTime = element.Date.split("T")[1]


                    //console.log("element.TradeDate. " + element.TradeDate)
                    let tempYear = tempDate.slice(0, 4)
                    let tempMonth = tempDate.slice(5, 7)
                    let tempDay = tempDate.slice(8, 10)
                    let newDate = tempMonth + "/" + tempDay + "/" + tempYear

                    temp["T/D"] = newDate
                    temp["S/D"] = newDate
                    temp.Currency = element.Currency

                    //Type
                    temp.Type = "stock"
                    if (element["Instrument Type"] == "Future") {
                        temp.Type = "future"
                    }
                    if (element["Instrument Type"] == "Equity Option") {
                        element["Call or Put"] == "CALL" ? temp.Type = "call" : temp.Type = "put"
                    }
                    //console.log("  --> Type " + temp.Type)

                    if (element["Action"] == "BUY_TO_OPEN") {
                        temp.Side = "B"
                    }
                    if (element["Action"] == "BUY_TO_CLOSE") {
                        temp.Side = "BC"
                    }
                    if (element["Action"] == "SELL_TO_CLOSE") {
                        temp.Side = "S"
                    }
                    if (element["Action"] == "SELL_TO_OPEN") {
                        temp.Side = "SS"
                    }

                    //Case for futures
                    if (element["Action"] == "BUY" && Number(element.Value) == 0) {
                        temp.Side = "B"
                    }
                    if (element["Action"] == "BUY" && Number(element.Value) != 0) {
                        temp.Side = "BC"
                    }
                    if (element["Action"] == "SELL" && Number(element.Value) != 0) {
                        temp.Side = "S"
                    }
                    if (element["Action"] == "SELL" && Number(element.Value) == 0) {
                        temp.Side = "SS"
                    }

                    temp.SymbolOriginal = element["Symbol"]

                    if ((element["Sub Type"] == "Cash Settled Exercise" || element["Sub Type"] == "Cash Settled Assignment" || element["Sub Type"] == "Expiration") && (temp.Type == "call" || temp.Type == "put")) {
                        let index = tradesData.findIndex(obj => obj.SymbolOriginal == temp.SymbolOriginal)
                        if (index != -1) {
                            let side = tradesData[index].Side
                            if (side == "B") temp.Side = "S"
                            if (side == "SS") temp.Side = "BC"
                            console.log(" -> Prior option " + temp.SymbolOriginal + " was " + side)
                        } else {
                            console.log("No prior open option for " + temp.SymbolOriginal + ". This is an issues !")
                            //alert("No prior open option for "+temp.SymbolOriginal+". This is an issues !")
                        }
                    }

                    if (temp.Type == "stock") {
                        temp.Symbol = element["Symbol"]
                    }
                    if (temp.Type == "call" || temp.Type == "put") {
                        temp.Symbol = element["Underlying Symbol"]
                    }
                    if (temp.Type == "future") {
                        temp.Symbol = element["Symbol"].slice(1, -2);
                    }

                    temp.Qty = Number(element.Quantity) < 0 ? (-Number(element.Quantity)).toString() : element.Quantity


                    temp.Price = element["Average Price"]

                    let tempEntryHour = tempTime.slice(0, 2)
                    let tempEntryMinutes = tempTime.slice(2, 4)
                    let tempEntrySeconds = tempTime.slice(4, 6)
                    const dateTime = dayjs.utc(element.Date)
                    const tradeTZ = dateTime.tz(timeZoneTrade.value)
                    const timeInTZ = tradeTZ.format("HH:mm:ss");
                    //console.log("original time "+element.Date+" and timeInTZ "+timeInTZ); 
                    temp["Exec Time"] = timeInTZ

                    let commNum = isNaN(Number(element.Commissions)) ? 0 : Number(element.Commissions)
                    let feeNum = isNaN(Number(element.Fees)) ? 0 : Number(element.Fees)
                    let commNumSum = commNum + feeNum
                    temp.Comm = (-commNumSum).toString()
                    temp.SEC = "0"
                    temp.TAF = "0"
                    temp.NSCC = "0"
                    temp.Nasdaq = "0"
                    temp["ECN Remove"] = "0"
                    temp["ECN Add"] = "0"
                    let valNum = Number(element.Value.replace(/[^\d.-]/g, ''));
                    temp["Gross Proceeds"] = valNum
                    temp["Net Proceeds"] = valNum - (-commNumSum) // I'm not using Net Cash because on same day or sometimes with normal input, Net Cash is not / still not calculated on IBKR side. So I calculate it myself

                    /*if (element["Sub Type"] == "Cash Settled Exercise"){
                        console.log(" valNum "+valNum)
                    }*/


                    temp["Clr Broker"] = ""
                    temp.Liq = ""
                    temp.Note = ""
                    //console.log("temp "+JSON.stringify(temp))
                    tradesData.push(temp)
                }
            });
            //console.log(" -> Trades Data\n" + JSON.stringify(tradesData))
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        resolve()
    })
}

/****************************
 * TOPSTEPX
 ****************************/
export async function useTopstepX(param, param2) {
    return new Promise(async (resolve, reject) => {
        try {
            let papaParse = Papa.parse(param, { header: true })
            //console.log("papaparse " + JSON.stringify(papaParse.data))

            papaParse.data.forEach(element => {
                //Exclude void rows, money movement and option cash settlements because I calculate them myself
                if (element.FilledAt != "" && element.Status == "Filled") {
                    //console.log(" sub type "+element["Sub Type"])
                    //console.log("element " + JSON.stringify(element))
                    let temp = {}
                    temp.Account = element.AccountName

                    let tempDate = element.FilledAt.split(" ")[0]
                    let tempTime = element.FilledAt.split(" ")[1]

                    temp["T/D"] = tempDate
                    temp["S/D"] = tempDate
                    temp.Currency = "USD"

                    //Type
                    temp.Type = "future"

                    if (element.PositionDisposition == "Opening" && element.Side == "Bid") {
                        temp.Side = "B"
                    }
                    if (element.PositionDisposition == "Closing" && element.Side == "Bid") {
                        temp.Side = "BC"
                    }
                    if (element.PositionDisposition == "Closing" && element.Side == "Ask") {
                        temp.Side = "S"
                    }
                    if (element.PositionDisposition == "Opening" && element.Side == "Ask") {
                        temp.Side = "SS"
                    }


                    temp.SymbolOriginal = element.ContractName

                    temp.Symbol = element.ContractName.slice(0, -2);

                    let qtyNumber = Number(element.Size)
                    temp.Qty = qtyNumber.toString()

                    let priceNumber = Number(element.ExecutePrice)
                    temp.Price = priceNumber.toString()

                    temp["Exec Time"] = tempTime

                    let contractSpecs = futureContractsJson.value.filter(item => item.symbol == temp.Symbol)
                    console.log(" -> contractSpecs " + JSON.stringify(contractSpecs))
                    if (contractSpecs.length == 0) {
                        reject("Missing information for future symbol " + temp.Symbol)
                    }
                    let tick = contractSpecs[0].tick
                    let value = contractSpecs[0].value

                    let qtyNumberSide

                    if (temp.Side == "B" || temp.Side == "BC") {
                        qtyNumberSide = -qtyNumber
                    } else {
                        qtyNumberSide = qtyNumber
                    }

                    let proceedsNumber = ((qtyNumberSide * priceNumber) / tick ) * value // contract value (https://www.degiro.com/uk/knowledge/investing-in-futures/index-futures)
                    //console.log(" Symbol "+temp.Symbol+" on "+temp["T/D"]+" has gross proceed of " + proceedsNumber)

                    temp["Gross Proceeds"] = proceedsNumber.toString()

                    let echangeFees = futuresTopstepXFees.value.filter(item => item.symbol == temp.Symbol)
                    let commNumber = 0
                    if (echangeFees) {
                        //console.log(" -> exchange fee "+JSON.stringify(echangeFees[0].fee))
                        commNumber = echangeFees[0].fee * qtyNumber
                    } else {
                        reject("No Fees found")
                    }
                    temp.Comm = commNumber.toString()
                    temp.SEC = "0"
                    temp.TAF = "0"
                    temp.NSCC = "0"
                    temp.Nasdaq = "0"
                    temp["ECN Remove"] = "0"
                    temp["ECN Add"] = "0"
                    temp["Net Proceeds"] = (proceedsNumber - commNumber).toString()
                    temp["Clr Broker"] = ""
                    temp.Liq = ""
                    temp.Note = ""
                    //console.log("temp "+JSON.stringify(temp))
                    tradesData.push(temp)

                }
            });
            console.log(" -> Trades Data\n" + JSON.stringify(tradesData))
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        resolve()
    })
}
/**
**************************
 * WARRIOR TRADING SIM
 ****************************/
export async function useWarriorTradingSim(param) {
    return new Promise(async (resolve, reject) => {
        try {
            let tempArray = []

            if (typeof param === "string") {
                // Parse the CSV data - Warrior Trading SIM format: Date,Time,Symbol,Side,Quantity,Price,
                let lines = param.trim().split('\n')
                
                lines.forEach(line => {
                    if (line.trim()) {
                        let parts = line.split(',')
                        if (parts.length >= 6) {
                            tempArray.push({
                                Date: parts[0],
                                Time: parts[1], 
                                Symbol: parts[2],
                                Side: parts[3],
                                Quantity: parts[4],
                                Price: parts[5]
                            })
                        }
                    }
                })
            } else {
                tempArray = param
            }

            tempArray.forEach(element => {
                if (element.Date && element.Time && element.Symbol && element.Side && element.Quantity && element.Price) {
                    let temp = {}

                    // Account
                    temp.Account = "WarriorTradingSIM"

                    // Convert date from MM/DD/YY to MM/DD/YYYY format
                    let dateParts = element.Date.split('/')
                    let year = dateParts[2]
                    // Convert 2-digit year to 4-digit year (assuming 20xx)
                    if (year.length === 2) {
                        year = '20' + year
                    }
                    let formattedDate = dateParts[0] + '/' + dateParts[1] + '/' + year

                    temp['T/D'] = formattedDate
                    temp['S/D'] = formattedDate

                    // Currency
                    temp.Currency = "USD"

                    // Type - assuming stocks for Warrior Trading SIM
                    temp.Type = "stock"

                    // Side mapping
                    temp.Side = element.Side // B for Buy, S for Sell

                    // Symbol
                    temp.Symbol = element.Symbol
                    temp.SymbolOriginal = element.Symbol

                    // Quantity and Price
                    temp.Qty = parseInt(element.Quantity)
                    temp.Price = parseFloat(element.Price)

                    // Execution Time
                    temp['Exec Time'] = element.Time

                    // Fees and commissions (assuming $0 for SIM)
                    temp.Comm = 0
                    temp.SEC = 0
                    temp.TAF = 0
                    temp.NSCC = 0
                    temp.Nasdaq = 0
                    temp['ECN Remove'] = 0
                    temp['ECN Add'] = 0

                    // Calculate proceeds
                    let quantity = parseInt(element.Quantity)
                    let price = parseFloat(element.Price)
                    let grossProceeds = element.Side === "B" ? -(quantity * price) : (quantity * price)
                    
                    temp['Gross Proceeds'] = grossProceeds
                    temp['Net Proceeds'] = grossProceeds // No fees in SIM

                    // Other fields
                    temp['Clr Broker'] = ""
                    temp.Liq = ""
                    temp.Note = ""

                    tradesData.push(temp)
                }
            });

            console.log(" -> Warrior Trading SIM Trades Data\n" + JSON.stringify(tradesData))
        } catch (error) {
            console.log("  --> ERROR " + error)
            reject(error)
        }
        resolve()
    })
}