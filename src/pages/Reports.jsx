import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { exportExcel, exportExcelMultiSheet } from "../utils/exportExcel"
import { printReport, printMultiSection } from "../utils/printReport"
import { surahName, progressPercent } from "../utils/quran"
import { getMonthlyFee } from "./Settings"

const DAYS_LABELS = {
  sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء",
  thu: "الخميس", fri: "الجمعة", sat: "السبت"
}
const MONTH_LABELS = {
  "01": "جانفي", "02": "فيفري", "03": "مارس", "04": "أفريل",
  "05": "ماي", "06": "جوان", "07": "جويلية", "08": "أوت",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر"
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-")
  return `${MONTH_LABELS[m] || m} ${y}`
}

function monthsInRange(startKey, endKey) {
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

function lastDayOfMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export default function Reports() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [byClassSelection, setByClassSelection] = useState("all")
  const [attClassId, setAttClassId] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [progClassId, setProgClassId] = useState("")
  const [progStart, setProgStart] = useState(new Date().toISOString().slice(0, 10))
  const [progEnd, setProgEnd] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [progError, setProgError] = useState("")
  const [progLoading, setProgLoading] = useState(false)

  const nowMonthKey = new Date().toISOString().slice(0, 7)
  const [finStart, setFinStart] = useState(nowMonthKey)
  const [finEnd, setFinEnd] = useState(nowMonthKey)
  const [finLoading, setFinLoading] = useState(false)
  const [finError, setFinError] = useState("")
  const [finSummary, setFinSummary] = useState(null)

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
      "الوقت": c.time,
    }))

  const studentRows = () =>
    students.map((s) => ({
      "الاسم": s.name,
      "السن": s.age,
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
          "السن": s.age,
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

  const loadFinancialData = async () => {
    if (finStart > finEnd) {
      setFinError("الشهر الأول يجب أن يكون قبل الشهر الأخير")
      return null
    }
    setFinLoading(true)
    setFinError("")
    try {
      const [snap, allStudentsSnap, allClassesSnap, fee] = await Promise.all([
        getDocs(collection(db, "payments")),
        getDocs(collection(db, "students")),
        getDocs(collection(db, "classes")),
        getMonthlyFee(),
      ])
      const studentMap = {}
      allStudentsSnap.docs.forEach((d) => { studentMap[d.id] = d.data() })
      const classMap = {}
      allClassesSnap.docs.forEach((d) => { classMap[d.id] = d.data().name })

      const months = monthsInRange(finStart, finEnd)

      const payments = snap.docs
        .map((d) => d.data())
        .filter((p) => p.month >= finStart && p.month <= finEnd)

      const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
      const count = payments.length

      const byClass = {}
      payments.forEach((p) => {
        const name = classMap[p.classId] || "غير محدد"
        if (!byClass[name]) byClass[name] = { total: 0, count: 0 }
        byClass[name].total += p.amount || 0
        byClass[name].count += 1
      })

      const byMonth = {}
      months.forEach((mk) => { byMonth[mk] = { real: 0, count: 0, expected: 0, expectedCount: 0 } })
      payments.forEach((p) => {
        if (!byMonth[p.month]) byMonth[p.month] = { real: 0, count: 0, expected: 0, expectedCount: 0 }
        byMonth[p.month].real += p.amount || 0
        byMonth[p.month].count += 1
      })

      months.forEach((mk) => {
        const cutoff = lastDayOfMonth(mk)
        const activeCount = students.filter(
          (s) => s.active !== false && (!s.enrollDate || s.enrollDate <= cutoff)
        ).length
        byMonth[mk].expected = activeCount * fee
        byMonth[mk].expectedCount = activeCount
      })

      const totalExpected = Object.values(byMonth).reduce((sum, v) => sum + v.expected, 0)

      const detailRows = payments
        .map((p) => ({
          "الطالب": studentMap[p.studentId]?.name || "طالب محذوف",
          "القسم": classMap[p.classId] || "قسم محذوف",
          "الشهر": monthLabel(p.month),
          "المبلغ": p.amount,
          "تاريخ الدفع": p.paidDate,
        }))
        .sort((a, b) => (a["تاريخ الدفع"] < b["تاريخ الدفع"] ? 1 : -1))

      const summary = { total, count, totalExpected, byClass, byMonth, months, fee, detailRows }
      setFinSummary(summary)
      setFinLoading(false)
      return summary
    } catch {
      setFinError("حدث خطأ أثناء تحميل البيانات")
      setFinLoading(false)
      return null
    }
  }

  const handleFinancialExcel = async () => {
    const summary = finSummary || (await loadFinancialData())
    if (!summary) return
    if (summary.count === 0) {
      setFinError("لا يوجد اشتراكات مدفوعة في هذه الفترة")
      return
    }
    const overviewRows = [{
      "إجمالي الإيرادات الفعلية (د.ت)": summary.total,
      "إجمالي الإيرادات المتوقعة (د.ت)": summary.totalExpected,
      "الفرق (فعلي - متوقع) (د.ت)": summary.total - summary.totalExpected,
      "عدد الاشتراكات المسددة": summary.count,
    }]
    const monthRows = summary.months.map((mk) => ({
      "الشهر": monthLabel(mk),
      "الإيرادات الفعلية (د.ت)": summary.byMonth[mk].real,
      "عدد الاشتراكات": summary.byMonth[mk].count,
      "الإيرادات المتوقعة (د.ت)": summary.byMonth[mk].expected,
      "عدد الطلاب النشطين": summary.byMonth[mk].expectedCount,
    }))
    const classRows2 = Object.entries(summary.byClass).map(([name, v]) => ({
      "القسم": name,
      "عدد الاشتراكات": v.count,
      "المجموع (د.ت)": v.total,
    }))
    exportExcelMultiSheet("financial_report", [
      { name: "نظرة عامة", rows: overviewRows },
      { name: "حسب الشهر", rows: monthRows },
      { name: "حسب القسم", rows: classRows2 },
      { name: "التفاصيل", rows: summary.detailRows },
    ])
  }

  const handleFinancialPrint = async () => {
    const summary = finSummary || (await loadFinancialData())
    if (!summary) return
    if (summary.count === 0) {
      setFinError("لا يوجد اشتراكات مدفوعة في هذه الفترة")
      return
    }
    const overviewRows = [{
      "الإيرادات الفعلية": `${summary.total} د.ت`,
      "الإيرادات المتوقعة": `${summary.totalExpected} د.ت`,
      "الفرق (فعلي - متوقع)": `${summary.total - summary.totalExpected} د.ت`,
      "عدد الاشتراكات": summary.count,
    }]
    const monthRows = summary.months.map((mk) => ({
      "الشهر": monthLabel(mk),
      "فعلي (د.ت)": summary.byMonth[mk].real,
      "عدد": summary.byMonth[mk].count,
      "متوقع (د.ت)": summary.byMonth[mk].expected,
      "طلاب نشطون": summary.byMonth[mk].expectedCount,
    }))
    const classRows2 = Object.entries(summary.byClass).map(([name, v]) => ({
      "القسم": name,
      "عدد الاشتراكات": v.count,
      "المجموع (د.ت)": v.total,
    }))
    printMultiSection({
      title: "التقرير المالي",
      sections: [
        { heading: `نظرة عامة: من ${monthLabel(finStart)} إلى ${monthLabel(finEnd)}`, rows: overviewRows },
        { heading: "حسب الشهر", rows: monthRows },
        { heading: "حسب القسم", rows: classRows2 },
        { heading: "تفاصيل الدفعات", rows: summary.detailRows },
      ],
    })
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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">التقرير المالي</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">من شهر</label>
            <input
              type="month"
              value={finStart}
              onChange={(e) => { setFinStart(e.target.value); setFinSummary(null) }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">إلى شهر</label>
            <input
              type="month"
              value={finEnd}
              onChange={(e) => { setFinEnd(e.target.value); setFinSummary(null) }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {finError && <p className="text-red-600 dark:text-red-400 text-xs">{finError}</p>}

        <button
          onClick={loadFinancialData}
          disabled={finLoading}
          className="w-full bg-gray-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
        >
          {finLoading ? "جارٍ التحميل..." : "عرض الملخص"}
        </button>

        {finSummary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{finSummary.total} د.ت</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">الإيرادات الفعلية</p>
              </div>
              <div className="text-center bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{finSummary.totalExpected} د.ت</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">الإيرادات المتوقعة</p>
              </div>
              <div className="text-center bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{finSummary.count}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">عدد الاشتراكات</p>
              </div>
              <div className="text-center bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className={`text-lg font-bold ${
                  finSummary.total - finSummary.totalExpected >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {finSummary.total - finSummary.totalExpected} د.ت
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">الفرق (فعلي - متوقع)</p>
              </div>
            </div>

            {finSummary.months.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">حسب الشهر</p>
                <div className="space-y-1">
                  {finSummary.months.map((mk) => (
                    <div key={mk} className="flex items-center justify-between text-xs border-b border-gray-200 dark:border-gray-700 py-1.5 last:border-0">
                      <span className="text-gray-900 dark:text-gray-100">{monthLabel(mk)}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {finSummary.byMonth[mk].real} / {finSummary.byMonth[mk].expected} د.ت
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(finSummary.byClass).length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">حسب القسم</p>
                <div className="space-y-1">
                  {Object.entries(finSummary.byClass).map(([name, v]) => (
                    <div key={name} className="flex items-center justify-between text-xs border-b border-gray-200 dark:border-gray-700 py-1 last:border-0">
                      <span className="text-gray-900 dark:text-gray-100">{name}</span>
                      <span className="text-gray-500 dark:text-gray-400">{v.count} اشتراك — {v.total} د.ت</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleFinancialExcel}
            disabled={finLoading}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            Excel
          </button>
          <button
            onClick={handleFinancialPrint}
            disabled={finLoading}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            PDF / طباعة
          </button>
        </div>
      </div>
    </div>
  )
}
