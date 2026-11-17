import { describe, expect, it } from "vitest"
import { filterPayments, parseFilters, sortPayments } from "./queries"
import { store } from "./store"
import { Payment } from "./types"

const parse = (query: string) => parseFilters(new URLSearchParams(query))

describe("parseFilters", () => {
  it("keeps a merchant id that exists", () => {
    expect(parse("merchantId=mch_01").merchantId).toBe("mch_01")
  })

  it("drops a merchant id that is not on the allowlist", () => {
    expect(parse("merchantId=mch_nope").merchantId).toBeUndefined()
    expect(parse("merchantId=%27%20OR%201%3D1").merchantId).toBeUndefined()
  })

  it("accepts ISO dates and timestamps for from and to, normalized to UTC", () => {
    expect(parse("from=2026-08-01").from).toBe("2026-08-01T00:00:00.000Z")
    expect(parse("to=2026-08-01T12:30:00Z").to).toBe("2026-08-01T12:30:00.000Z")
    expect(parse("from=2026-08-01T12:00:00%2B02:00").from).toBe(
      "2026-08-01T10:00:00.000Z",
    )
  })

  it("drops from and to values that are not ISO dates", () => {
    expect(parse("from=yesterday").from).toBeUndefined()
    expect(parse("to=March%205").to).toBeUndefined()
    expect(parse("from=2026-13-45").from).toBeUndefined()
    expect(parse("to=").to).toBeUndefined()
  })

  it("only accepts a whole number for the page", () => {
    expect(parse("page=3").page).toBe(3)
    expect(parse("page=1.5").page).toBe(1)
    expect(parse("page=0").page).toBe(1)
    expect(parse("page=abc").page).toBe(1)
  })

  it("keeps the existing status, sort and direction allowlists", () => {
    expect(parse("status=bogus").status).toBe("all")
    expect(parse("sort=bogus").sort).toBe("createdAt")
    expect(parse("direction=bogus").direction).toBe("desc")
  })

  it("caps the search text", () => {
    expect(parse(`search=${"a".repeat(500)}`).search).toHaveLength(100)
  })
})

describe("filterPayments", () => {
  it("can narrow to one currency", () => {
    const eur = filterPayments({ currency: "EUR" })
    expect(eur.length).toBeGreaterThan(0)
    expect(eur.every((p) => p.currency === "EUR")).toBe(true)
  })

  it("treats `to` as inclusive and `from` as inclusive", () => {
    const at = store.payments[0].createdAt
    const hits = filterPayments({ from: at, to: at })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((p) => p.createdAt === at)).toBe(true)
  })
})

describe("sortPayments", () => {
  const make = (amount: number): Payment => ({
    ...store.payments[0],
    id: `pay_${amount}`,
    amount,
  })

  it("orders amounts as numbers, not as strings", () => {
    const sorted = sortPayments([make(10000), make(900), make(250)], "amount", "asc")
    expect(sorted.map((p) => p.amount)).toEqual([250, 900, 10000])
  })

  it("puts the largest amount first when descending", () => {
    const sorted = sortPayments([make(900), make(10000), make(250)], "amount", "desc")
    expect(sorted.map((p) => p.amount)).toEqual([10000, 900, 250])
  })
})
