import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { exportExcel } from "../utils/exportExcel"
import { printReport } from "../utils/printReport"

const DAYS_LABELS = {
  sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء",
  thu: "الخميس", fri: "الجمعة", sat: "السبت"
}

export default function Reports() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [attClassId, setAttClassId] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

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

  const loadAttendanceRows = async () => {
    const snap = await getDocs(
      query(
        collection(db, "attendance"),
        where("classId", "==", attClassId),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      )
    )
    const cls = classes.find((c) => c.id === attClassId)
    const studentMap = {}
    students.filter((s) => s.classId === attClassId).forEach((s) => { studentMap[s.id] = s.name })

    const rows = []
    snap.docs
      .map((d) => d.data())
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .forEach((a) => {
        Object.entries(a.records || {}).forEach(([studentId, present]) => {
          rows.push({
            "التاريخ": a.date,
            "الطالب": studentMap[studentId] || studentId,
            "الحالة": present ? "حاضر" : "غائب",
          })
        })
      })
    return { rows, className: cls?.name || "" }
  }

  const handleAttendanceExcel = async () => {
    setLoading(true)
    const { rows } = await loadAttendanceRows()
    exportExcel("attendance", rows)
    setLoading(false)
  }

  const handleAttendancePrint = async () => {
    setLoading(true)
    const { rows, className } = await loadAttendanceRows()
    printReport({
      title: "سجل الحضور",
      subtitle: `${className} - من ${startDate} إلى ${endDate}`,
      rows,
    })
    setLoading(false)
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">التقارير</h2>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">
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

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">
        <p className="font-medium text-sm">قائمة الطلاب</p>
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

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
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
        <div className="flex gap-2">
          <button
            onClick={handleAttendanceExcel}
            disabled={!attClassId || loading}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            Excel
          </button>
          <button
            onClick={handleAttendancePrint}
            disabled={!attClassId || loading}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            PDF / طباعة
          </button>
        </div>
      </div>
    </div>
  )
}
