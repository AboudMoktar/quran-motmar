import { runTransaction, doc } from "firebase/firestore"
import { db } from "../firebase"

// Generates sequential receipt numbers per calendar year, e.g. "0001/26", "0002/26", ...
// then resets to "0001/27" on the first receipt of the next year, and so on.
// The counter is stored in Firestore (collection "counters", one doc per year)
// and incremented atomically so two simultaneous payments never get the same number.
export async function getNextReceiptNumber(year) {
  const yearStr = String(year)
  const shortYear = yearStr.slice(-2)
  const counterRef = doc(db, "counters", yearStr)

  const nextNumber = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef)
    const last = snap.exists() ? snap.data().lastNumber || 0 : 0
    const next = last + 1
    transaction.set(counterRef, { year: yearStr, lastNumber: next }, { merge: true })
    return next
  })

  return `${String(nextNumber).padStart(4, "0")}/${shortYear}`
}
