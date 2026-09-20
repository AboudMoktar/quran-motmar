import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { getMonthlyFee } from "./Settings"
import { MONTHS, monthLabel, monthsInRange, lastDayOfMonth, computeStudentMonth, STATUS_LABELS } from "../utils/finance"
import { exportExcelMultiSheet } from "../utils/exportExcel"
import { printMultiSection } from "../utils/printReport"
import { Search } from "lucide-react"

export default function Finance() {
  const [classes, setClasses] = useState([])
  const nowMonthKey = new Date().toISOString().slice(0, 7)
  const [finStart, setFinStart] = useState(nowMonthKey)
  const [finEnd, setFinEnd] = useState(nowMonthKey)
  const [classFilter, setClassFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState(null)

  const [studentQuery, setStudentQuery] = useState("")
  const [selectedStudentId, setSelectedStudentId] = useState("")

  useEffect(() => {
    getDocs(collection(db, "classes")).then((snap) =>
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    )
  }, [])

  const loadSummary = async () => {
    if (finStart > finEnd) {
      setError("الشهر الأول يجب أن يكون قبل الشهر الأخير")
      return
    }
    setLoading(true)
    setError("")
    setSelectedStudentId("")
    try {
      const [studentsSnap, classesSnap, paymentsSnap, exemptionsSnap, fee] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "classes")),
        getDocs(query(collection(db, "payments"), where("month", ">=", finStart), where("month", "<=", finEnd))),
        getDocs(query(collection(db, "exemptions"), where("month", ">=", finStart), where("month", "<=", finEnd))),
        getMonthlyFee(),
      ])

      const allStudents = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const studentMap = {}
      allStudents.forEach((s) => { studentMap[s.id] = s })
      const classMap = {}
      classesSnap.docs.forEach((d) => { classMap[d.id] = d.data().name })

      const allPayments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const allExemptions = exemptionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      const months = monthsInRange(finStart, finEnd)
      const activeStudents = allStudents.filter((s) => !s.deletedAt && s.active !== false)

      let totalDue = 0, totalPaid = 0, totalExempted = 0, totalRemaining = 0
      const byMonth = {}
      const byClass = {}
      const statusCounts = { paid: 0, partial: 0, unpaid: 0, exempt: 0 }
      const unpaidRows = []

      months.forEach((mk) => {
        const cutoff = lastDayOfMonth(mk)
        const concerned = activeStudents.filter((s) =>
          (!s.enrollDate || s.enrollDate <= cutoff) &&
          (classFilter === "all" || s.classId === classFilter)
        )
        byMonth[mk] = { students: concerned.length, due: 0, paid: 0, exempted: 0, remaining: 0 }

        concerned.forEach((s) => {
          const sPayments = allPayments.filter((p) => p.studentId === s.id && p.month === mk)
          const sExemptions = allExemptions.filter((ex) => ex.studentId === s.id && ex.month === mk)
          const stat = computeStudentMonth(sPayments, sExemptions, fee)

          totalDue += stat.due
          totalPaid += stat.paid
          totalExempted += stat.exempted
          totalRemaining += stat.remaining

          byMonth[mk].due += stat.due
          byMonth[mk].paid += stat.paid
          byMonth[mk].exempted += stat.exempted
          byMonth[mk].remaining += stat.remaining

          const className = classMap[s.classId] || "غير محدد"
          if (!byClass[className]) byClass[className] = { students: new Set(), due: 0, paid: 0, exempted: 0, remaining: 0 }
          byClass[className].students.add(s.id)
          byClass[className].due += stat.due
          byClass[className].paid += stat.paid
          byClass[className].exempted += stat.exempted
          byClass[className].remaining += stat.remaining

          statusCounts[stat.status]++

          if (stat.remaining > 0) {
            unpaidRows.push({
              "الطالب": s.name, "القسم": className, "الشهر": monthLabel(mk),
              "المستحق": stat.due, "المدفوع": stat.paid, "المعفى": stat.exempted, "المتبقي": stat.remaining,
            })
          }
        })
      })

      const paymentRows = allPayments
        .filter((p) => classFilter === "all" || p.classId === classFilter)
        .map((p) => ({
          "الطالب": studentMap[p.studentId]?.name || "طالب محذوف",
          "القسم": classMap[p.classId] || "قسم محذوف",
          "الشهر": monthLabel(p.month),
          "المبلغ": p.amount,
          "طريقة الدفع": "نقداً",
          "تاريخ الدفع": p.paidDate,
        }))
        .sort((a, b) => (a["تاريخ الدفع"] < b["تاريخ الدفع"] ? 1 : -1))

      const exemptionRows = allExemptions
        .filter((ex) => classFilter === "all" || ex.classId === classFilter)
        .map((ex) => ({
          "الطالب": studentMap[ex.studentId]?.name || "طالب محذوف",
          "القسم": classMap[ex.classId] || "قسم محذوف",
          "الشهر": monthLabel(ex.month),
          "المبلغ المعفى": ex.amount,
          "السبب": ex.reason || "-",
          "التاريخ": ex.date,
        }))
        .sort((a, b) => (a["التاريخ"] < b["التاريخ"] ? 1 : -1))

      const monthRows = months.map((mk) => ({
        "الشهر": monthLabel(mk),
        "عدد الطلاب": byMonth[mk].students,
        "المستحق": byMonth[mk].due,
        "المدفوع": byMonth[mk].paid,
        "المعفى": byMonth[mk].exempted,
        "المتبقي": byMonth[mk].remaining,
        "نسبة الاستخلاص": byMonth[mk].due > 0 ? `${Math.round((byMonth[mk].paid / byMonth[mk].due) * 100)}%` : "-",
      }))

      const classRows = Object.entries(byClass).map(([name, v]) => ({
        "القسم": name,
        "عدد الطلاب": v.students.size,
        "المستحق": v.due,
        "المدفوع": v.paid,
        "المعفى": v.exempted,
        "المتبقي": v.remaining,
        "نسبة الاستخلاص": v.due > 0 ? `${Math.round((v.paid / v.due) * 100)}%` : "-",
      }))

      setSummary({
        totalDue, totalPaid, totalExempted, totalRemaining,
        rate: totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0,
        statusCounts, months, byMonth, byClass, monthRows, classRows,
        unpaidRows, paymentRows, exemptionRows,
        studentsList: activeStudents,
        fee,
      })
    } catch {
      setError("حدث خطأ أثناء تحميل البيانات")
    }
    setLoading(false)
  }

  const handleExportExcel = () => {
    if (!summary) return
    const overviewRows = [{
      "المبلغ المستحق": summary.totalDue,
      "المبلغ المدفوع": summary.totalPaid,
      "المبلغ المتبقي": summary.totalRemaining,
      "الإعفاءات": summary.totalExempted,
      "نسبة الاستخلاص": `${summary.rate}%`,
      "مدفوع بالكامل": summary.statusCounts.paid,
      "مدفوع جزئياً": summary.statusCounts.partial,
      "غير مدفوع": summary.statusCounts.unpaid,
      "معفى": summary.statusCounts.exempt,
    }]
    exportExcelMultiSheet("financial_report", [
      { name: "ملخص مالي", headerLines: [`الفترة: من ${monthLabel(finStart)} إلى ${monthLabel(finEnd)}`], rows: overviewRows },
      { name: "الاشتراكات", rows: summary.monthRows },
      { name: "المدفوعات", rows: summary.paymentRows },
      { name: "المتأخرات", rows: summary.unpaidRows },
      { name: "الإعفاءات", rows: summary.exemptionRows },
      { name: "حسب القسم", rows: summary.classRows },
    ])
  }

  const handlePrintOverview = () => {
    if (!summary) return
    printMultiSection({
      title: "التقرير المالي",
      sections: [
        {
          heading: `نظرة عامة: من ${monthLabel(finStart)} إلى ${monthLabel(finEnd)}`,
          rows: [{
            "المستحق": `${summary.totalDue} د.ت`,
            "المدفوع": `${summary.totalPaid} د.ت`,
            "المتبقي": `${summary.totalRemaining} د.ت`,
            "الإعفاءات": `${summary.totalExempted} د.ت`,
            "نسبة الاستخلاص": `${summary.rate}%`,
          }],
        },
        { heading: "حسب الشهر", rows: summary.monthRows },
        { heading: "حسب القسم", rows: summary.classRows },
      ],
    })
  }

  const handlePrintUnpaid = () => {
    if (!summary) return
    printMultiSection({
      title: "تقرير المتأخرات",
      sections: [{
        heading: `الفترة: من ${monthLabel(finStart)} إلى ${monthLabel(finEnd)} — إجمالي المتأخرات: ${summary.totalRemaining} د.ت`,
        rows: summary.unpaidRows,
      }],
    })
  }

  const handlePrintPayments = () => {
    if (!summary) return
    printMultiSection({
      title: "تقرير المدفوعات",
      sections: [{
        heading: `الفترة: من ${monthLabel(finStart)} إلى ${monthLabel(finEnd)}`,
        rows: summary.paymentRows,
      }],
    })
  }

  const selectedStudent = summary?.studentsList.find((s) => s.id === selectedStudentId)
  const [studentDetail, setStudentDetail] = useState(null)

  useEffect(() => {
    if (!selectedStudentId || !summary) { setStudentDetail(null); return }
    const load = async () => {
      const [paySnap, exSnap] = await Promise.all([
        getDocs(query(collection(db, "payments"), where("studentId", "==", selectedStudentId))),
        getDocs(query(collection(db, "exemptions"), where("studentId", "==", selectedStudentId))),
      ])
      const payments = paySnap.docs.map((d) => d.data())
      const exemptions = exSnap.docs.map((d) => d.data())
      const months = [...new Set([...payments.map((p) => p.month), ...exemptions.map((e) => e.month)])].sort().reverse()
      const rows = months.map((mk) => {
        const stat = computeStudentMonth(
          payments.filter((p) => p.month === mk),
          exemptions.filter((e) => e.month === mk),
          summary.fee
        )
        return { month: mk, ...stat }
      })
      const totals = rows.reduce((acc, r) => ({
        due: acc.due + r.due, paid: acc.paid + r.paid,
        remaining: acc.remaining + r.remaining, exempted: acc.exempted + r.exempted,
      }), { due: 0, paid: 0, remaining: 0, exempted: 0 })
      setStudentDetail({ rows, totals })
    }
    load()
  }, [selectedStudentId, summary])

  const filteredStudentOptions = summary
    ? summary.studentsList.filter((s) => s.name.toLowerCase().includes(studentQuery.toLowerCase()))
    : []

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">الوضعية المالية</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">من شهر</label>
            <input
              type="month"
              value={finStart}
              onChange={(e) => { setFinStart(e.target.value); setSummary(null) }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">إلى شهر</label>
            <input
              type="month"
              value={finEnd}
              onChange={(e) => { setFinEnd(e.target.value); setSummary(null) }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        <select
          value={classFilter}
          onChange={(e) => { setClassFilter(e.target.value); setSummary(null) }}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="all">جميع الأقسام</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {error && <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>}
        <button
          onClick={loadSummary}
          disabled={loading}
          className="w-full bg-gray-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
        >
          {loading ? "جارٍ التحميل..." : "عرض التقرير"}
        </button>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{summary.totalDue} د.ت</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">المبلغ المستحق</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{summary.totalPaid} د.ت</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">المبلغ المدفوع</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{summary.totalRemaining} د.ت</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">المبلغ المتبقي</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
              <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{summary.totalExempted} د.ت</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">الإعفاءات</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 text-center">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{summary.rate}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">نسبة الاستخلاص</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
            <p className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">وضعية الطلاب</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{summary.statusCounts.paid}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">مدفوع</p>
              </div>
              <div>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{summary.statusCounts.partial}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">جزئي</p>
              </div>
              <div>
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{summary.statusCounts.unpaid}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">غير مدفوع</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{summary.statusCounts.exempt}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">معفى</p>
              </div>
            </div>
          </div>

          {summary.months.length > 1 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
              <p className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">حسب الشهر</p>
              <div className="space-y-1">
                {summary.monthRows.map((r) => (
                  <div key={r["الشهر"]} className="flex items-center justify-between text-xs border-b border-gray-200 dark:border-gray-700 py-1.5 last:border-0">
                    <span className="text-gray-900 dark:text-gray-100">{r["الشهر"]}</span>
                    <span className="text-gray-500 dark:text-gray-400">{r["المدفوع"]} / {r["المستحق"]} د.ت ({r["نسبة الاستخلاص"]})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {classFilter === "all" && summary.classRows.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
              <p className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">حسب القسم</p>
              <div className="space-y-1">
                {summary.classRows.map((r) => (
                  <div key={r["القسم"]} className="flex items-center justify-between text-xs border-b border-gray-200 dark:border-gray-700 py-1.5 last:border-0">
                    <span className="text-gray-900 dark:text-gray-100">{r["القسم"]}</span>
                    <span className="text-gray-500 dark:text-gray-400">{r["المدفوع"]} / {r["المستحق"]} د.ت ({r["نسبة الاستخلاص"]})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
            <p className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">
              المتأخرات ({summary.unpaidRows.length})
            </p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {summary.unpaidRows.slice(0, 20).map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-b border-gray-200 dark:border-gray-700 py-1.5 last:border-0">
                  <div>
                    <p className="text-gray-900 dark:text-gray-100">{r["الطالب"]}</p>
                    <p className="text-gray-400 dark:text-gray-500">{r["القسم"]} — {r["الشهر"]}</p>
                  </div>
                  <span className="text-red-600 dark:text-red-400 font-medium">{r["المتبقي"]} د.ت</span>
                </div>
              ))}
              {summary.unpaidRows.length > 20 && (
                <p className="text-xs text-gray-400 text-center pt-2">و {summary.unpaidRows.length - 20} آخرين — انظر التصدير الكامل</p>
              )}
              {summary.unpaidRows.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">لا توجد متأخرات</p>
              )}
            </div>
            <button
              onClick={handlePrintUnpaid}
              className="w-full mt-3 bg-gray-700 text-white rounded-lg py-2 text-sm"
            >
              طباعة تقرير المتأخرات
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
            <p className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">البحث عن طالب</p>
            <div className="relative mb-3">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="اكتب اسم الطالب..."
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pr-9 pl-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            {studentQuery && (
              <div className="max-h-32 overflow-y-auto mb-3 space-y-1">
                {filteredStudentOptions.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudentId(s.id); setStudentQuery(s.name) }}
                    className="block w-full text-right text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {selectedStudent && studentDetail && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex justify-around text-center mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{studentDetail.totals.due} د.ت</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">مستحق</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{studentDetail.totals.paid} د.ت</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">مدفوع</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{studentDetail.totals.remaining} د.ت</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">متبقي</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {studentDetail.rows.map((r) => (
                    <div key={r.month} className="flex items-center justify-between text-xs border-b border-gray-100 dark:border-gray-700 py-1 last:border-0">
                      <span className="text-gray-900 dark:text-gray-100">{monthLabel(r.month)}</span>
                      <span className="text-gray-500 dark:text-gray-400">{r.paid} / {r.due} — {STATUS_LABELS[r.status]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-2">
            <p className="font-medium text-sm mb-1 text-gray-900 dark:text-gray-100">التصدير</p>
            <button onClick={handleExportExcel} className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm">
              تصدير Excel (كل التقارير)
            </button>
            <div className="flex gap-2">
              <button onClick={handlePrintOverview} className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm">
                PDF نظرة عامة
              </button>
              <button onClick={handlePrintPayments} className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm">
                PDF المدفوعات
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
