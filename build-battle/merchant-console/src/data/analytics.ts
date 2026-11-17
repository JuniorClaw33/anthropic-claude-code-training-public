import { GENERATED_AT } from "./generate"
import { merchants } from "./merchants"
import { filterPayments } from "./queries"
import { store } from "./store"
import { volumeFor } from "./volume"

/**
 * Weekly rollups for the monitoring dashboard. Buckets are UTC weeks ending
 * on the generation date, oldest first.
 */

const WEEK_MS = 7 * 86_400_000

export interface WeekBucket {
  date: string
  start: number
  end: number
}

export function weeks(count = 12): WeekBucket[] {
  const buckets: WeekBucket[] = []
  const anchor = GENERATED_AT.getTime()
  for (let i = count - 1; i >= 0; i--) {
    const end = anchor - i * WEEK_MS
    const start = end - WEEK_MS
    buckets.push({
      date: new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
      }).format(new Date(start)),
      start,
      end,
    })
  }
  return buckets
}

/** The query-builder bounds for a week: `start` up to, but not including, `end`. */
const windowOf = (week: WeekBucket) => ({
  from: new Date(week.start).toISOString(),
  to: new Date(week.end - 1).toISOString(),
})

/** Captured volume this period against the period before it. */
export function volumeByWeek(count = 12) {
  const current = weeks(count)
  return current.map((week) => {
    const previous: WeekBucket = {
      ...week,
      start: week.start - count * WEEK_MS,
      end: week.end - count * WEEK_MS,
    }
    return {
      date: week.date,
      "This period": volumeFor({ ...windowOf(week), status: "captured" }),
      "Previous period": volumeFor({ ...windowOf(previous), status: "captured" }),
    }
  })
}

/** Payment count against captured volume, for the biaxial chart. */
export function countAndVolumeByWeek(count = 12) {
  return weeks(count).map((week) => ({
    date: week.date,
    Payments: filterPayments(windowOf(week)).length,
    "Captured volume": volumeFor({ ...windowOf(week), status: "captured" }),
  }))
}

/** Approved against failed, rendered as a percentage stack. */
export function authorizationByWeek(count = 12) {
  return weeks(count).map((week) => {
    const total = filterPayments(windowOf(week)).length
    const failed = filterPayments({ ...windowOf(week), status: "failed" }).length
    return { date: week.date, Approved: total - failed, Failed: failed }
  })
}

/** Share of payments that ended in a dispute, per week. */
export function disputeRateByWeek(count = 12) {
  return weeks(count).map((week) => {
    const total = filterPayments(windowOf(week)).length
    const disputed = filterPayments({
      ...windowOf(week),
      status: "disputed",
    }).length
    return {
      date: week.date,
      "Dispute rate": total ? disputed / total : 0,
    }
  })
}

/** Per-merchant rollup for the merchants tab. */
export function merchantRollup() {
  return merchants
    .map((merchant) => {
      const payments = filterPayments({ merchantId: merchant.id })
      const failed = filterPayments({
        merchantId: merchant.id,
        status: "failed",
      }).length
      const disputes = store.disputes.filter(
        (d) => d.merchantId === merchant.id,
      )

      return {
        merchant,
        payments: payments.length,
        // A merchant's volume is in its own currency, not the reporting one.
        volume: volumeFor({
          merchantId: merchant.id,
          status: "captured",
          currency: merchant.currency,
        }),
        disputes: disputes.length,
        authRate: payments.length
          ? (payments.length - failed) / payments.length
          : 0,
      }
    })
    .sort((a, b) => b.volume - a.volume)
}
