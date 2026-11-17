import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * The column set is fixed. Ops has asked for control over it — that is
 * NWP-101 — but today everyone gets every column, including the card
 * last four, whether or not the file is going to a merchant.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/**
 * What ships when the caller does not choose. The card last four is left out:
 * a file handed to a merchant should not carry it unless someone opts in.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ColumnSelection =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; error: string }

/**
 * Turns the `columns` query value into a validated column list.
 *
 * Column names come from the client, so each one is checked against
 * EXPORT_COLUMNS. Nothing else ever reaches `toCsv`. An absent value means
 * "the defaults"; a present but empty value is an empty selection and is
 * rejected rather than producing an empty file.
 */
export function parseColumns(param: string | null | undefined): ColumnSelection {
  if (param === null || param === undefined) {
    return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }
  }
  if (param.trim() === "") {
    return { ok: false, error: "Select at least one column." }
  }

  const requested = param.split(",").map((name) => name.trim())
  const unknown = requested.filter(
    (name) => !(EXPORT_COLUMNS as readonly string[]).includes(name),
  )
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown column: ${unknown.join(", ")}.` }
  }

  // Keep the order the caller asked for, and drop repeats.
  return {
    ok: true,
    columns: [...new Set(requested)] as ExportColumn[],
  }
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * `payments-2026-08-13.csv`, or `payments-disputed-2026-08-13.csv` when a
 * label says what the scope was. The label is reduced to lowercase letters,
 * digits and underscores, so it can never alter the header it ends up in.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  const safe = label?.toLowerCase().replace(/[^a-z0-9_]/g, "")
  return safe ? `payments-${safe}-${day}.csv` : `payments-${day}.csv`
}
