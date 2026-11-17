import { afterEach, describe, expect, it } from "vitest"
import { countAndVolumeByWeek, volumeByWeek, weeks } from "./analytics"
import { dailyVolume, headlineMetrics } from "./metrics"
import { store } from "./store"

/**
 * The dashboard totals are money that ops reads aloud, so these pin the
 * three things that are easy to break quietly: amounts stay integer minor
 * units, days are bucketed in UTC whatever the server's timezone is, and one
 * number is derived one way wherever it appears.
 *
 * Expected values are recomputed here from the store without using the code
 * under test, so a shared mistake cannot pass both sides.
 */

const usd = store.payments.filter((p) => p.currency === "USD")
const sum = (amounts: { amount: number }[]) =>
  amounts.reduce((total, p) => total + p.amount, 0)

const originalTz = process.env.TZ
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ
  else process.env.TZ = originalTz
})

describe("dailyVolume", () => {
  it("keeps amounts as whole integer minor units", () => {
    for (const day of dailyVolume(120)) {
      expect(Number.isInteger(day.captured)).toBe(true)
      expect(Number.isInteger(day.refunded)).toBe(true)
    }
  })

  it("buckets by the UTC date, even when the server runs in another timezone", () => {
    const expected = new Map<string, number>()
    for (const p of usd.filter((p) => p.status === "captured")) {
      const key = p.createdAt.slice(0, 10)
      expected.set(key, (expected.get(key) ?? 0) + p.amount)
    }

    for (const tz of ["Pacific/Auckland", "America/Los_Angeles", "UTC"]) {
      process.env.TZ = tz
      for (const day of dailyVolume(120)) {
        expect(day.captured, `${day.date} in ${tz}`).toBe(
          expected.get(day.date) ?? 0,
        )
      }
    }
  })

  it("counts only USD, because the figures are reported as USD", () => {
    const total = dailyVolume(120).reduce((t, d) => t + d.captured, 0)
    expect(total).toBe(sum(usd.filter((p) => p.status === "captured")))
  })
})

describe("headlineMetrics", () => {
  it("reconciles with the daily series: gross volume is captured plus refunded", () => {
    const days = dailyVolume(120)
    const fromDays = days.reduce((t, d) => t + d.captured + d.refunded, 0)
    expect(headlineMetrics().grossVolume).toBe(fromDays)
  })

  it("does not add euros and pounds into a USD total", () => {
    const expected = sum(
      usd.filter((p) => p.status === "captured" || p.status === "refunded"),
    )
    expect(store.payments.some((p) => p.currency !== "USD")).toBe(true)
    expect(headlineMetrics().grossVolume).toBe(expected)
  })

  it("sums only USD disputes into the amount at risk", () => {
    const open = store.disputes.filter(
      (d) =>
        d.currency === "USD" &&
        (d.status === "needs_response" || d.status === "under_review"),
    )
    expect(headlineMetrics().disputedAmount).toBe(sum(open))
  })

  it("counts every payment, whatever its currency", () => {
    expect(headlineMetrics().paymentCount).toBe(store.payments.length)
  })
})

describe("weekly rollups", () => {
  const week = weeks(12)[11]
  const inWeek = (p: { createdAt: string }) => {
    const at = new Date(p.createdAt).getTime()
    return at >= week.start && at < week.end
  }

  it("reports captured volume in whole minor units, without losing the cents", () => {
    const expected = sum(
      usd.filter((p) => p.status === "captured" && inWeek(p)),
    )
    const latest = volumeByWeek(12)[11]
    expect(latest["This period"]).toBe(expected)
    expect(Number.isInteger(latest["This period"])).toBe(true)
  })

  it("derives captured volume the same way in both rollups", () => {
    expect(countAndVolumeByWeek(12)[11]["Captured volume"]).toBe(
      volumeByWeek(12)[11]["This period"],
    )
  })
})
