import { filterPayments } from "./queries"
import { Currency, PaymentFilters } from "./types"

/**
 * The currency the dashboard totals are reported in. There are no exchange
 * rates in this codebase, so amounts in other currencies are left out of a
 * USD total rather than added to it as if they were dollars.
 */
export const REPORTING_CURRENCY: Currency = "USD"

/**
 * Total of the payments that match, in integer minor units of one currency.
 *
 * Every dashboard figure that is a sum of payment amounts comes from here, so
 * a number shown in two places is derived once. Payments are selected with the
 * shared query builder, and `currency` defaults to the reporting currency.
 */
export function volumeFor(filters: PaymentFilters = {}): number {
  return filterPayments({ currency: REPORTING_CURRENCY, ...filters }).reduce(
    (total, payment) => total + payment.amount,
    0,
  )
}
