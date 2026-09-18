import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { exportExcel, exportExcelMultiSheet } from "../utils/exportExcel"
import { printReport, printMultiSection } from "../utils/printReport"

const DAYS_LABELS = {
  sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء",
  thu: "الخميس", fri: "الجمعة", sat: "السبت"
}

export default function Reports() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [byClassSelection, setByClassSelection] = useState("all")
  const [attClassId, setAttClassId] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    getDocs(collection(db, "classes")).then((snap) =>
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])

  useEffect(() => {
    getDocs(collection(db, "students")).then((snap) =>
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
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

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">التقارير</h2>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm">قائمة الأقسام</p>
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

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm">قائمة الطلاب (كل الطلاب)</p>
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

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm">قوائم الطلاب حسب الأقسام</p>
        <select
          value={byClassSelection}
          onChange={(e) => setByClassSelection(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
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

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm">سجل الحضور</p>
        <select
          value={attClassId}
          onChange={(e) => setAttClassId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
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
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
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
    </div>
  )
}
