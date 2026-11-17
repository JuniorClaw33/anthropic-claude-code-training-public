import { lastUtcDays } from "@/lib/dates"
import { GENERATED_AT } from "./generate"
import { filterPayments } from "./queries"
import { store } from "./store"
import { REPORTING_CURRENCY, volumeFor } from "./volume"

/**
 * Dashboard metrics. Money figures are integer minor units of the reporting
 * currency (USD), because the overview is an internal ops screen rather than
 * a merchant statement. Display code turns them into text.
 */

export interface DailyVolume {
  date: string
  captured: number
  refunded: number
}

/**
 * Volume per UTC calendar day, oldest first. "Refunded" is the original
 * amount of payments whose status is refunded, so a day's captured and refunded
 * figures together are that day's gross volume.
 */
export function dailyVolume(days = 30): DailyVolume[] {
  return lastUtcDays(days, GENERATED_AT).map((date) => {
    const window = { from: `${date}T00:00:00.000Z`, to: `${date}T23:59:59.999Z` }
    return {
      date,
      captured: volumeFor({ ...window, status: "captured" }),
      refunded: volumeFor({ ...window, status: "refunded" }),
    }
  })
}

export function headlineMetrics() {
  // Gross volume is the original amount of every payment that was captured,
  // including the ones refunded since, before refunds come off.
  const grossVolume =
    volumeFor({ status: "captured" }) + volumeFor({ status: "refunded" })

  const paymentCount = filterPayments({}).length
  const failed = filterPayments({ status: "failed" }).length
  const authRate = paymentCount ? (paymentCount - failed) / paymentCount : 0

  const openDisputes = store.disputes.filter(
    (d) => d.status === "needs_response" || d.status === "under_review",
  )

  return {
    grossVolume,
    authRate,
    paymentCount,
    openDisputes: openDisputes.length,
    // Disputes are not payments, so they are not in the query builder; the
    // amount at risk is reported in the reporting currency only.
    disputedAmount: openDisputes
      .filter((d) => d.currency === REPORTING_CURRENCY)
      .reduce((sum, d) => sum + d.amount, 0),
  }
}
