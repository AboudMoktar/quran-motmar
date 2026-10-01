import { runTransaction, doc, getDoc, getDocs, deleteDoc, collection, query, where } from "firebase/firestore"
import { db } from "../firebase"

// ---------------------------------------------------------------------------
// Single source of truth for receipt numbers.
//
// Rule: one student + one month = one receipt = one permanent number, never
// random, never based on Firebase IDs or print order. Both places in the app
// that can produce a receipt — recording a real payment (Payments.jsx) and
// pre-issuing the whole month in one click (Reports.jsx) — call the SAME
// function below and read/write the SAME Firestore collection ("receipts",
// one doc per studentId + year + month). This is what guarantees a single
// student can never end up with two different numbers for the same month.
//
// Numbers are handed out from a yearly counter ("counters/{year}") that only
// ever increments — a deleted/cancelled receipt is never reused, so gaps in
// the sequence are possible but numbers never go backwards and never repeat.
// ---------------------------------------------------------------------------

function receiptId(year, month, studentId) {
  return `${year}-${month}_${studentId}`
}

// Returns { receiptNo, isNew } for a given student + month, creating the
// receipt (and reserving the next sequential number) the first time it's
// needed, and simply returning the existing number on every later call for
// the same studentId + year + month — whether that call comes from
// recording a payment, reprinting, or re-running the monthly batch.
export async function getOrCreateReceipt({ studentId, studentName, classId, className, year, month, amount }) {
  const monthKey = `${year}-${month}`
  const receiptRef = doc(db, "receipts", receiptId(year, month, studentId))

  // Fast path: the receipt already exists (by far the most common case).
  const existing = await getDoc(receiptRef)
  if (existing.exists()) {
    return { receiptNo: existing.data().receiptNo, isNew: false }
  }

  // Backward compatibility: a real payment may already have been recorded
  // for this student + month under the OLD logic (before this fix), with its
  // own ad hoc number stored directly on the "payments" document. Reuse that
  // number instead of burning a fresh one, so a receipt already handed to a
  // parent keeps the exact number printed on it.
  const priorPaymentSnap = await getDocs(
    query(collection(db, "payments"), where("studentId", "==", studentId), where("month", "==", monthKey))
  )
  const priorReceiptNo = priorPaymentSnap.docs.map((d) => d.data()).find((p) => p.receiptNo)?.receiptNo

  const counterRef = doc(db, "counters", String(year))

  const receiptNo = await runTransaction(db, async (transaction) => {
    // Re-check inside the transaction in case another call created it
    // between the fast-path check above and now (two taps in a row, etc).
    const again = await transaction.get(receiptRef)
    if (again.exists()) return again.data().receiptNo

    const baseData = {
      studentId,
      studentName: studentName || "",
      classId: classId || "",
      className: className || "",
      month: monthKey,
      year,
      amount: amount || 0,
      createdAt: Date.now(),
      printCount: 0,
    }

    if (priorReceiptNo) {
      transaction.set(receiptRef, { ...baseData, receiptNo: priorReceiptNo })
      return priorReceiptNo
    }

    const counterSnap = await transaction.get(counterRef)
    const last = counterSnap.exists() ? counterSnap.data().lastNumber || 0 : 0
    const next = last + 1
    const shortYear = String(year).slice(-2)
    const newNo = `${String(next).padStart(4, "0")}/${shortYear}`

    transaction.set(counterRef, { year: String(year), lastNumber: next }, { merge: true })
    transaction.set(receiptRef, { ...baseData, receiptNo: newNo })
    return newNo
  })

  return { receiptNo, isNew: true }
}

// Marks a receipt as printed again — returns the new print count. Never
// creates a receipt and never changes its number; call getOrCreateReceipt
// first if the receipt might not exist yet.
export async function registerReceiptPrint({ studentId, year, month }) {
  const receiptRef = doc(db, "receipts", receiptId(year, month, studentId))
  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(receiptRef)
    const current = snap.exists() ? snap.data().printCount || 0 : 0
    const next = current + 1
    transaction.set(receiptRef, { printCount: next }, { merge: true })
    return next
  })
}

// Deletes the reserved (but never actually paid) receipts for a month, so
// they can be reissued cleanly — e.g. to fix numbers that were scrambled by
// an earlier version of this logic. Receipts tied to a real payment are
// never touched, so an already-handed-out number is never changed.
export async function resetUnpaidReceiptsForMonth(year, month) {
  const monthKey = `${year}-${month}`
  const paidSnap = await getDocs(query(collection(db, "payments"), where("month", "==", monthKey)))
  const paidStudentIds = new Set(paidSnap.docs.map((d) => d.data().studentId))

  const receiptsSnap = await getDocs(query(collection(db, "receipts"), where("month", "==", monthKey)))
  await Promise.all(
    receiptsSnap.docs.filter((d) => !paidStudentIds.has(d.data().studentId)).map((d) => deleteDoc(d.ref))
  )
}
