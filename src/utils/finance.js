export const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"]
export const MONTH_LABELS = {
  "01": "جانفي", "02": "فيفري", "03": "مارس", "04": "أفريل",
  "05": "ماي", "06": "جوان", "07": "جويلية", "08": "أوت",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر"
}

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-")
  return `${MONTH_LABELS[m] || m} ${y}`
}

export function monthsInRange(startKey, endKey) {
  const months = []
  let [y, m] = startKey.split("-").map(Number)
  const [ey, em] = endKey.split("-").map(Number)
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

export function lastDayOfMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export const STATUS_LABELS = {
  paid: "مدفوع",
  partial: "مدفوع جزئياً",
  unpaid: "غير مدفوع",
  exempt: "معفى",
}

export function computeStudentMonth(payments, exemptions, fee) {
  const paid = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const exempted = exemptions.reduce((sum, e) => sum + (e.amount || 0), 0)
  const payable = Math.max(0, fee - exempted)
  const remaining = Math.max(0, payable - paid)

  let status
  if (payable === 0) status = "exempt"
  else if (paid === 0) status = "unpaid"
  else if (paid >= payable) status = "paid"
  else status = "partial"

  return { due: fee, paid, exempted, payable, remaining, status }
}
