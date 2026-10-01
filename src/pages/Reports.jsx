import { useEffect, useState } from "react"
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { db } from "../firebase"
import { exportExcel, exportExcelMultiSheet } from "../utils/exportExcel"
import { printReport, printMultiSection, printReceipt, printReceiptsGrid } from "../utils/printReport"
import { surahName, progressPercent } from "../utils/quran"
import { classTimeLabel } from "./Classes"
import { calculateAge } from "./Students"
import { MONTHS, MONTH_LABELS, monthLabel } from "../utils/finance"
import { getMonthlyFee } from "./Settings"
import { getOrCreateReceipt, registerReceiptPrint, resetUnpaidReceiptsForMonth } from "../utils/receiptCounter"

const DAYS_LABELS = {
  sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء",
  thu: "الخميس", fri: "الجمعة", sat: "السبت"
}

// Local (not UTC) YYYY-MM-DD — toISOString() would roll the date back by a
// day for any positive UTC offset (e.g. Tunisia) when called near midnight.
function toLocalISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function firstDayOfMonth() {
  const d = new Date()
  d.setDate(1)
  return toLocalISODate(d)
}

export default function Reports() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [byClassSelection, setByClassSelection] = useState("all")
  const [attClassId, setAttClassId] = useState("")
  const [startDate, setStartDate] = useState(toLocalISODate(new Date()))
  const [endDate, setEndDate] = useState(toLocalISODate(new Date()))
  const [progClassId, setProgClassId] = useState("")
  const [progStart, setProgStart] = useState(toLocalISODate(new Date()))
  const [progEnd, setProgEnd] = useState(toLocalISODate(new Date()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [progError, setProgError] = useState("")
  const [progLoading, setProgLoading] = useState(false)

  const [receiptsClassId, setReceiptsClassId] = useState("all")
  const [receiptsFrom, setReceiptsFrom] = useState(firstDayOfMonth())
  const [receiptsTo, setReceiptsTo] = useState(toLocalISODate(new Date()))
  const [receiptsLoading, setReceiptsLoading] = useState(false)
  const [receiptsError, setReceiptsError] = useState("")
  const [receipts, setReceipts] = useState(null)
  const [reprintingId, setReprintingId] = useState("")

  const [batchClassId, setBatchClassId] = useState("all")
  const [batchMonth, setBatchMonth] = useState(MONTHS[new Date().getMonth()])
  const [batchYear, setBatchYear] = useState(String(new Date().getFullYear()))
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchError, setBatchError] = useState("")
  const [batchResult, setBatchResult] = useState(null)
  const [batchProgress, setBatchProgress] = useState(null)
  const [batchPrintData, setBatchPrintData] = useState(null)
  const [wipeLoading, setWipeLoading] = useState(false)
  const [wipeResult, setWipeResult] = useState("")

  useEffect(() => {
    getDocs(collection(db, "classes")).then((snap) =>
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    )
  }, [])

  useEffect(() => {
    getDocs(collection(db, "students")).then((snap) =>
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => !s.deletedAt))
    )
  }, [])

  const classRows = () =>
    classes.map((c) => ({
      "اسم القسم": c.name,
      "المستوى": c.level,
      "المعلم": c.teacherName,
      "الأيام": (c.days || []).map((d) => DAYS_LABELS[d]).join(" - "),
      "الوقت": classTimeLabel(c),
    }))

  const studentRows = () =>
    students.map((s) => ({
      "الاسم": s.name,
      "السن": calculateAge(s.birthDate) ?? "-",
      "هاتف ولي الأمر": s.parentPhone,
      "المستوى": s.level,
      "القسم": s.className,
      "تاريخ التسجيل": s.enrollDate,
    }))

  const studentsByClassData = () => {
    const targetClasses = byClassSelection === "all"
      ? classes
      : classes.filter((c) => c.id === byClassSelection)

    return targetClasses.map((c) => ({
      className: c.name,
      teacherName: c.teacherName,
      rows: students
        .filter((s) => s.classId === c.id)
        .map((s) => ({
          "الاسم": s.name,
          "السن": calculateAge(s.birthDate) ?? "-",
          "هاتف ولي الأمر": s.parentPhone,
          "المستوى": s.level,
          "تاريخ التسجيل": s.enrollDate,
        })),
    }))
  }

  const handleStudentsByClassExcel = () => {
    const data = studentsByClassData()
    if (byClassSelection !== "all" && data.length === 1) {
      exportExcel(`students_${data[0].className}`, data[0].rows, [
        `القسم: ${data[0].className}`,
        `المعلم: ${data[0].teacherName}`,
        `عدد الطلاب: ${data[0].rows.length}`,
      ])
      return
    }
    const sheets = data.map((d) => ({
      name: d.className,
      headerLines: [`القسم: ${d.className}`, `المعلم: ${d.teacherName}`, `عدد الطلاب: ${d.rows.length}`],
      rows: d.rows,
    }))
    exportExcelMultiSheet("students_by_class", sheets)
  }

  const handleStudentsByClassPrint = () => {
    const data = studentsByClassData()
    if (byClassSelection !== "all" && data.length === 1) {
      printReport({
        title: `قائمة طلاب: ${data[0].className}`,
        subtitleLines: [`المعلم: ${data[0].teacherName}`, `عدد الطلاب: ${data[0].rows.length}`],
        rows: data[0].rows,
      })
      return
    }
    const sections = data
      .filter((d) => d.rows.length > 0)
      .map((d) => ({
        heading: `${d.className} - المعلم: ${d.teacherName} (${d.rows.length} طالب)`,
        rows: d.rows,
      }))
    printMultiSection({ title: "قوائم الطلاب حسب الأقسام", sections })
  }

  const loadAttendancePivot = async () => {
    const snap = await getDocs(
      query(collection(db, "attendance"), where("classId", "==", attClassId))
    )
    const cls = classes.find((c) => c.id === attClassId)
    const classStudents = students.filter((s) => s.classId === attClassId)

    const records = snap.docs
      .map((d) => d.data())
      .filter((a) => a.date >= startDate && a.date <= endDate)
      .sort((a, b) => (a.date > b.date ? 1 : -1))

    const rows = classStudents.map((s) => {
      const row = { "الطالب": s.name }
      records.forEach((r) => {
        const beforeEnrollment = s.enrollDate && r.date < s.enrollDate
        if (beforeEnrollment) {
          row[r.date] = "-"
        } else {
          const present = r.records ? r.records[s.id] : undefined
          row[r.date] = present === undefined ? "-" : (present ? "حاضر" : "غائب")
        }
      })
      return row
    })

    return {
      rows,
      hasDates: records.length > 0,
      className: cls?.name || "",
      teacherName: cls?.teacherName || "",
    }
  }

  const handleAttendanceExcel = async () => {
    setLoading(true)
    setError("")
    try {
      const { rows, hasDates, className, teacherName } = await loadAttendancePivot()
      if (!hasDates || rows.length === 0) {
        setError("لا يوجد سجل حضور في هذه الفترة")
      } else {
        exportExcel("attendance", rows, [
          `القسم: ${className}`,
          `المعلم: ${teacherName}`,
          `الفترة: من ${startDate} إلى ${endDate}`,
        ])
      }
    } catch {
      setError("حدث خطأ أثناء تحميل البيانات")
    }
    setLoading(false)
  }

  const handleAttendancePrint = async () => {
    setLoading(true)
    setError("")
    try {
      const { rows, hasDates, className, teacherName } = await loadAttendancePivot()
      if (!hasDates || rows.length === 0) {
        setError("لا يوجد سجل حضور في هذه الفترة")
      } else {
        printReport({
          title: "سجل الحضور",
          subtitleLines: [
            `القسم: ${className}`,
            `المعلم: ${teacherName}`,
            `الفترة: من ${startDate} إلى ${endDate}`,
          ],
          rows,
        })
      }
    } catch {
      setError("حدث خطأ أثناء تحميل البيانات")
    }
    setLoading(false)
  }

  const loadProgressPivot = async () => {
    const snap = await getDocs(
      query(collection(db, "progress"), where("classId", "==", progClassId))
    )
    const cls = classes.find((c) => c.id === progClassId)
    const classStudents = students.filter((s) => s.classId === progClassId)

    const records = snap.docs
      .map((d) => d.data())
      .filter((p) => p.date >= progStart && p.date <= progEnd)
      .sort((a, b) => (a.date > b.date ? 1 : -1))

    const rows = classStudents.map((s) => {
      const row = { "الطالب": s.name }
      records.forEach((r) => {
        const rec = r.records ? r.records[s.id] : undefined
        if (!rec) {
          row[r.date] = "-"
        } else {
          const parts = []
          if (rec.surah) parts.push(`${surahName(rec.surah)} (${progressPercent(rec.surah)}%)`)
          if (rec.hifz) parts.push(`حفظ: ${rec.hifz}`)
          if (rec.tajwid) parts.push(`تجويد: ${rec.tajwid}`)
          row[r.date] = parts.length > 0 ? parts.join(" / ") : "-"
        }
      })
      return row
    })

    return {
      rows,
      hasDates: records.length > 0,
      className: cls?.name || "",
      teacherName: cls?.teacherName || "",
    }
  }

  const handleProgressExcel = async () => {
    setProgLoading(true)
    setProgError("")
    try {
      const { rows, hasDates, className, teacherName } = await loadProgressPivot()
      if (!hasDates || rows.length === 0) {
        setProgError("لا يوجد سجل تقدم في هذه الفترة")
      } else {
        exportExcel("quran_progress", rows, [
          `القسم: ${className}`,
          `المعلم: ${teacherName}`,
          `الفترة: من ${progStart} إلى ${progEnd}`,
        ])
      }
    } catch {
      setProgError("حدث خطأ أثناء تحميل البيانات")
    }
    setProgLoading(false)
  }

  const handleProgressPrint = async () => {
    setProgLoading(true)
    setProgError("")
    try {
      const { rows, hasDates, className, teacherName } = await loadProgressPivot()
      if (!hasDates || rows.length === 0) {
        setProgError("لا يوجد سجل تقدم في هذه الفترة")
      } else {
        printReport({
          title: "سجل التقدم القرآني",
          subtitleLines: [
            `القسم: ${className}`,
            `المعلم: ${teacherName}`,
            `الفترة: من ${progStart} إلى ${progEnd}`,
          ],
          rows,
        })
      }
    } catch {
      setProgError("حدث خطأ أثناء تحميل البيانات")
    }
    setProgLoading(false)
  }

  // ---------- Payment receipts register (printable list, with a note when a
  // receipt has been printed more than once) ----------

  const noteForPrintCount = (count) => {
    if (!count || count <= 0) return "-"
    if (count === 1) return "طُبع مرة واحدة"
    return `⚠️ طُبع ${count} مرات`
  }

  const receiptRows = (list) =>
    list.map((p) => {
      const student = students.find((s) => s.id === p.studentId)
      const cls = classes.find((c) => c.id === p.classId)
      return {
        "رقم الوصل": p.receiptNo || "-",
        "التاريخ": p.paidDate,
        "اسم الطالب": student?.name || p.studentName || "-",
        "القسم": cls?.name || p.className || "-",
        "الشهر": p.month ? monthLabel(p.month) : "-",
        "المبلغ": `${p.amount} د.ت`,
        "ملاحظة": noteForPrintCount(p.printCount),
      }
    })

  const loadReceipts = async () => {
    setReceiptsLoading(true)
    setReceiptsError("")
    try {
      const snap = await getDocs(collection(db, "payments"))
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.paidDate >= receiptsFrom && p.paidDate <= receiptsTo)
        .filter((p) => receiptsClassId === "all" || p.classId === receiptsClassId)
        .sort((a, b) => (a.paidDate < b.paidDate ? 1 : a.paidDate > b.paidDate ? -1 : a.receiptNo < b.receiptNo ? 1 : -1))
      setReceipts(list)
      if (list.length === 0) setReceiptsError("لا توجد وصولات دفع في هذه الفترة")
      return list
    } catch {
      setReceiptsError("حدث خطأ أثناء تحميل البيانات")
      setReceipts(null)
      return []
    } finally {
      setReceiptsLoading(false)
    }
  }

  const receiptsTotal = (list) => list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  const handleReceiptsExcel = async () => {
    const list = receipts ?? (await loadReceipts())
    if (list.length === 0) return
    exportExcel("receipts", receiptRows(list), [
      `الفترة: من ${receiptsFrom} إلى ${receiptsTo}`,
      `عدد الوصولات: ${list.length}`,
      `المجموع: ${receiptsTotal(list)} د.ت`,
    ])
  }

  const handleReceiptsPrint = async () => {
    const list = receipts ?? (await loadReceipts())
    if (list.length === 0) return
    printReport({
      title: "سجل وصولات الدفع",
      subtitleLines: [
        `الفترة: من ${receiptsFrom} إلى ${receiptsTo}`,
        `عدد الوصولات: ${list.length}`,
        `المجموع: ${receiptsTotal(list)} د.ت`,
      ],
      rows: receiptRows(list),
    })
  }

  const handleReprint = async (p) => {
    if (reprintingId) return
    const student = students.find((s) => s.id === p.studentId)
    const cls = classes.find((c) => c.id === p.classId)
    setReprintingId(p.id)
    try {
      const paymentMonthKey = p.month || ""
      const [pYear, pMonth] = paymentMonthKey.split("-")
      const nextCount = await registerReceiptPrint({ studentId: p.studentId, year: pYear, month: pMonth })
      await updateDoc(doc(db, "payments", p.id), { printCount: nextCount })
      setReceipts((prev) => (prev ? prev.map((x) => (x.id === p.id ? { ...x, printCount: nextCount } : x)) : prev))
      printReceipt({
        studentName: student?.name || p.studentName || "-",
        className: cls?.name || p.className || "-",
        monthText: p.month ? monthLabel(p.month) : "-",
        amount: p.amount,
        date: p.paidDate,
        note: p.note,
        receiptNo: p.receiptNo || "—",
        duplicateCount: nextCount,
      })
    } catch {
      setReceiptsError("تعذّرت إعادة الطباعة")
    }
    setReprintingId("")
  }

  // ---------- One-time dev cleanup: wipes ALL test receipts/payments so the
  // sequence can genuinely restart at 0001. Driven from inside the app
  // (same authenticated Firestore connection) instead of the Firebase
  // console's "Supprimer la collection" on mobile, which only deletes
  // documents in batches and can silently leave some behind on a slow
  // connection — which is exactly what caused numbers to resume at 0016
  // instead of 0001 after an apparently-complete console deletion.
  const handleWipeTestReceipts = async () => {
    if (
      !window.confirm(
        "سيتم حذف كل محتوى 'payments' و 'receipts' نهائياً (بيانات تجريبية فقط). لا يمكن التراجع. متابعة؟"
      )
    )
      return
    setWipeLoading(true)
    setWipeResult("")
    try {
      const [paymentsSnap, receiptsSnap] = await Promise.all([
        getDocs(collection(db, "payments")),
        getDocs(collection(db, "receipts")),
      ])
      await Promise.all([
        ...paymentsSnap.docs.map((d) => deleteDoc(d.ref)),
        ...receiptsSnap.docs.map((d) => deleteDoc(d.ref)),
      ])
      setWipeResult(`تم حذف ${paymentsSnap.docs.length} دفعة و ${receiptsSnap.docs.length} وصل نهائياً.`)
      setReceipts(null)
      setBatchResult(null)
      setBatchPrintData(null)
    } catch (err) {
      setWipeResult(`خطأ أثناء الحذف: ${err?.code || err?.message || "غير معروف"}`)
    }
    setWipeLoading(false)
  }

  // ---------- Monthly pre-issued receipts, ready to hand out on the 1st of
  // the month (before most students have actually paid). These go through
  // the exact same getOrCreateReceipt()/"receipts" collection as a real
  // payment recorded in الدفوعات — so a student who gets a pre-issued
  // receipt here and then pays normally keeps the SAME number, and a
  // student who already paid before this batch runs keeps THEIR number
  // too. Re-running this for the same month never burns new numbers for
  // students who already have one; it only prints them again (and marks
  // them "COPIE" since registerReceiptPrint bumps their print count).
  //
  // forceRegenerate=true first deletes any reserved-but-never-actually-paid
  // numbers for this month (receipts with no matching real payment), so
  // they get fresh, cleanly ordered numbers. A receipt already tied to a
  // real payment is never touched or renumbered.
  const handleIssueMonthlyReceipts = async (forceRegenerate = false) => {
    setBatchLoading(true)
    setBatchError("")
    setBatchResult(null)
    setBatchProgress(null)
    setBatchPrintData(null)
    try {
      const monthKey = `${batchYear}-${batchMonth}`
      const targetStudents = students.filter(
        (s) => s.active !== false && !s.waitlisted && (batchClassId === "all" || s.classId === batchClassId)
      )
      if (targetStudents.length === 0) {
        setBatchError("لا يوجد طلاب نشطون لهذا الاختيار")
        setBatchLoading(false)
        return
      }

      if (forceRegenerate) {
        await resetUnpaidReceiptsForMonth(batchYear, batchMonth)
      }

      // Sort students into printing order FIRST (same order they'll appear
      // on the page: by class, then by name), so any brand-new numbers are
      // handed out in that same order and increment correctly as you read
      // the page — not in whatever order Firestore happened to return them.
      const orderedStudents = [...targetStudents].sort((a, b) => {
        const clsA = classes.find((c) => c.id === a.classId)?.name || a.className || ""
        const clsB = classes.find((c) => c.id === b.classId)?.name || b.className || ""
        const byClass = clsA.localeCompare(clsB, "ar")
        if (byClass !== 0) return byClass
        return (a.name || "").localeCompare(b.name || "", "ar")
      })

      const fee = await getMonthlyFee()
      const receiptsList = []
      let newlyIssued = 0
      let i = 0
      for (const s of orderedStudents) {
        i++
        setBatchProgress({ done: i, total: orderedStudents.length })
        const cls = classes.find((c) => c.id === s.classId)
        const className = cls?.name || s.className || ""
        const { receiptNo, isNew } = await getOrCreateReceipt({
          studentId: s.id,
          studentName: s.name,
          classId: s.classId,
          className,
          year: batchYear,
          month: batchMonth,
          amount: fee,
        })
        if (isNew) newlyIssued++
        const printCount = await registerReceiptPrint({ studentId: s.id, year: batchYear, month: batchMonth })
        receiptsList.push({
          studentId: s.id,
          studentName: s.name,
          classId: s.classId,
          className,
          receiptNo,
          amount: fee,
          isCopy: printCount > 1,
        })
      }

      // Dynamic part: look up who has actually paid for this month right now
      // (even though most of the batch is printed before most people pay),
      // so a receipt for someone who already paid shows their real payment
      // date instead of a blank line to fill by hand.
      const paymentsSnap = await getDocs(query(collection(db, "payments"), where("month", "==", monthKey)))
      const paidDateByStudent = {}
      paymentsSnap.docs.forEach((d) => {
        const p = d.data()
        const current = paidDateByStudent[p.studentId]
        if (!current || p.paidDate > current) paidDateByStudent[p.studentId] = p.paidDate
      })
      const enrichedReceipts = receiptsList.map((r) => ({
        ...r,
        paidDate: paidDateByStudent[r.studentId] || null,
      }))

      setBatchResult({ total: enrichedReceipts.length, newlyIssued })
      // Don't call printReceiptsGrid() here directly: on mobile browsers,
      // window.print() silently does nothing if it fires too long after the
      // original tap (here, several seconds of Firestore round-trips per
      // student). Instead, save the data and let the "طباعة الآن" button
      // below call printReceiptsGrid() directly from ITS OWN tap, which is
      // immediate and reliably opens the print dialog.
      setBatchPrintData({ monthText: monthLabel(monthKey), receipts: enrichedReceipts })
    } catch (err) {
      setBatchError(`حدث خطأ أثناء إصدار الوصولات: ${err?.code || err?.message || "غير معروف"}`)
    }
    setBatchProgress(null)
    setBatchLoading(false)
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">التقارير</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">قائمة الأقسام</p>
        <div className="flex gap-2">
          <button
            onClick={() => exportExcel("classes", classRows())}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm"
          >
            Excel
          </button>
          <button
            onClick={() => printReport({ title: "قائمة الأقسام", rows: classRows() })}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm"
          >
            PDF / طباعة
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">قائمة الطلاب (كل الطلاب)</p>
        <div className="flex gap-2">
          <button
            onClick={() => exportExcel("students", studentRows())}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm"
          >
            Excel
          </button>
          <button
            onClick={() => printReport({ title: "قائمة الطلاب", rows: studentRows() })}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm"
          >
            PDF / طباعة
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">قوائم الطلاب حسب الأقسام</p>
        <select
          value={byClassSelection}
          onChange={(e) => setByClassSelection(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="all">جميع الأقسام</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={handleStudentsByClassExcel}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm"
          >
            Excel
          </button>
          <button
            onClick={handleStudentsByClassPrint}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm"
          >
            PDF / طباعة
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">سجل الحضور</p>
        <select
          value={attClassId}
          onChange={(e) => setAttClassId(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="">اختر القسم</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleAttendanceExcel}
            disabled={!attClassId || loading}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {loading ? "..." : "Excel"}
          </button>
          <button
            onClick={handleAttendancePrint}
            disabled={!attClassId || loading}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {loading ? "..." : "PDF / طباعة"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">سجل التقدم القرآني</p>
        <select
          value={progClassId}
          onChange={(e) => setProgClassId(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="">اختر القسم</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={progStart}
            onChange={(e) => setProgStart(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
          <input
            type="date"
            value={progEnd}
            onChange={(e) => setProgEnd(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>
        {progError && <p className="text-red-600 dark:text-red-400 text-xs">{progError}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleProgressExcel}
            disabled={!progClassId || progLoading}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {progLoading ? "..." : "Excel"}
          </button>
          <button
            onClick={handleProgressPrint}
            disabled={!progClassId || progLoading}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {progLoading ? "..." : "PDF / طباعة"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mt-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">سجل وصولات الدفع (جاهز للطباعة)</p>
        <select
          value={receiptsClassId}
          onChange={(e) => { setReceiptsClassId(e.target.value); setReceipts(null); setReceiptsError("") }}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="all">كل الأقسام</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={receiptsFrom}
            onChange={(e) => { setReceiptsFrom(e.target.value); setReceipts(null); setReceiptsError("") }}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
          <input
            type="date"
            value={receiptsTo}
            onChange={(e) => { setReceiptsTo(e.target.value); setReceipts(null); setReceiptsError("") }}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>
        {receiptsError && <p className="text-red-600 dark:text-red-400 text-xs">{receiptsError}</p>}
        <div className="flex gap-2">
          <button
            onClick={loadReceipts}
            disabled={receiptsLoading}
            className="flex-1 bg-emerald-800 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {receiptsLoading ? "جارٍ التحميل..." : "عرض القائمة"}
          </button>
          <button
            onClick={handleReceiptsExcel}
            disabled={receiptsLoading}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            Excel
          </button>
          <button
            onClick={handleReceiptsPrint}
            disabled={receiptsLoading}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            PDF / طباعة
          </button>
        </div>

        {receipts && receipts.length > 0 && (
          <div className="pt-2 space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {receipts.length} وصل — المجموع: {receiptsTotal(receipts)} د.ت
            </p>
            <div className="max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
              {receipts.map((p) => {
                const student = students.find((s) => s.id === p.studentId)
                const cls = classes.find((c) => c.id === p.classId)
                const isDuplicate = (p.printCount || 0) > 1
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                        {student?.name || "-"} — {p.amount} د.ت
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {p.receiptNo || "-"} — {p.paidDate} — {cls?.name || "-"}
                      </p>
                      {isDuplicate && (
                        <p className="text-[11px] text-red-600 dark:text-red-400">
                          ⚠️ طُبع {p.printCount} مرات
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleReprint(p)}
                      disabled={reprintingId === p.id}
                      className="shrink-0 text-xs text-emerald-700 dark:text-emerald-400 disabled:opacity-60"
                    >
                      {reprintingId === p.id ? "..." : "طباعة الوصل"}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mt-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">إصدار وصولات الشهر مسبقاً (8 بالصفحة)</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          بنقرة واحدة: يُصدر وصل لكل طالب نشط لهذا الشهر برقم رسمي، ويُطبع 8 وصولات في كل صفحة A4 — حتى قبل أن يدفع معظم الطلاب، لتُملأ يدوياً (التاريخ والإمضاء) عند الدفع الفعلي.
        </p>
        <select
          value={batchClassId}
          onChange={(e) => setBatchClassId(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="all">كل الأقسام</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            value={batchMonth}
            onChange={(e) => setBatchMonth(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{MONTH_LABELS[m]}</option>
            ))}
          </select>
          <input
            type="number"
            value={batchYear}
            onChange={(e) => setBatchYear(e.target.value)}
            className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>
        {batchError && <p className="text-red-600 dark:text-red-400 text-xs">{batchError}</p>}
        {batchProgress && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            جارٍ المعالجة: {batchProgress.done} / {batchProgress.total}
          </p>
        )}
        {batchResult && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            {batchResult.total} وصل جاهز للطباعة ({batchResult.newlyIssued} وصل جديد
            {batchResult.total > batchResult.newlyIssued ? ` — ${batchResult.total - batchResult.newlyIssued} صدر مسبقاً وأُعيدت طباعته بنفس الرقم` : ""})
          </p>
        )}
        <button
          onClick={() => handleIssueMonthlyReceipts(false)}
          disabled={batchLoading}
          className="w-full bg-emerald-800 text-white rounded-lg py-2 text-sm disabled:opacity-60"
        >
          {batchLoading ? `جارٍ الإصدار... ${batchProgress ? `(${batchProgress.done}/${batchProgress.total})` : ""}` : "إصدار وتجهيز وصولات الشهر"}
        </button>
        {batchPrintData && (
          <button
            onClick={() => printReceiptsGrid(batchPrintData)}
            className="w-full bg-blue-700 text-white rounded-lg py-2 text-sm font-bold"
          >
            🖨️ طباعة الآن ({batchPrintData.receipts.length} وصل)
          </button>
        )}
        <button
          onClick={() => {
            if (
              window.confirm(
                "سيتم حذف الأرقام المحجوزة غير المدفوعة فعلياً لهذا الشهر فقط وإعادة إصدارها مرتبة. أرقام أي طالب دفع فعلاً لن تتغيّر. متابعة؟"
              )
            ) {
              handleIssueMonthlyReceipts(true)
            }
          }}
          disabled={batchLoading}
          className="w-full border border-red-300 text-red-700 dark:text-red-400 dark:border-red-700 rounded-lg py-2 text-xs disabled:opacity-60"
        >
          إعادة ترقيم وإصدار من جديد لهذا الشهر (لحذف الترقيم القديم غير المرتّب)
        </button>

        <div className="border-t border-dashed border-red-300 dark:border-red-800 pt-3 mt-1">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
            للتجربة فقط: حذف نهائي لكل الدفوعات والوصولات في كامل التطبيق (كل الأشهر)، لإعادة الترقيم من 0001
            بشكل مضمون 100٪. استعمله فقط قبل البدء الفعلي بالتطبيق.
          </p>
          {wipeResult && <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-2">{wipeResult}</p>}
          <button
            onClick={handleWipeTestReceipts}
            disabled={wipeLoading}
            className="w-full border border-red-400 text-red-700 dark:text-red-400 dark:border-red-700 rounded-lg py-2 text-xs font-bold disabled:opacity-60"
          >
            {wipeLoading ? "جارٍ الحذف..." : "🗑️ حذف نهائي لكل الدفوعات والوصولات (تجريبي)"}
          </button>
        </div>
      </div>
    </div>
  )
}
