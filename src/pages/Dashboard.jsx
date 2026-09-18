import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { PAYMENT_ALERT_DAY, MONTHLY_FEE } from "../config"

const LOW_ATTENDANCE_THRESHOLD = 70
const MONTH_LABELS = {
  "01": "جانفي", "02": "فيفري", "03": "مارس", "04": "أفريل",
  "05": "ماي", "06": "جوان", "07": "جويلية", "08": "أوت",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر"
}

export default function Dashboard() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [attendance, setAttendance] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [openClasses, setOpenClasses] = useState({})

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const dayOfMonth = now.getDate()

  useEffect(() => {
    const load = async () => {
      const [classesSnap, studentsSnap, teachersSnap, attendanceSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "students")),
        getDocs(query(collection(db, "users"), where("role", "==", "teacher"))),
        getDocs(collection(db, "attendance")),
        getDocs(query(collection(db, "payments"), where("month", "==", currentMonthKey))),
      ])
      setClasses(classesSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setStudents(studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setTeachers(teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setAttendance(attendanceSnap.docs.map((d) => d.data()))
      setPayments(paymentsSnap.docs.map((d) => d.data()))
      setLoading(false)
    }
    load()
  }, [])

  const toggleClass = (id) => {
    setOpenClasses((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const marksInRange = (docs, from, to, classId) =>
    docs
      .filter((a) => a.date >= from && a.date <= to && (!classId || a.classId === classId))
      .flatMap((a) => Object.values(a.records || {}))

  const rateOf = (marks) => {
    if (marks.length === 0) return null
    const present = marks.filter(Boolean).length
    return Math.round((present / marks.length) * 100)
  }

  const todayMarks = marksInRange(attendance, today, today, null)
  const todayRate = rateOf(todayMarks)
  const todayPresent = todayMarks.filter(Boolean).length
  const todayAbsent = todayMarks.length - todayPresent

  const periodMarks = marksInRange(attendance, startDate, endDate, null)
  const periodRate = rateOf(periodMarks)
  const periodPresent = periodMarks.filter(Boolean).length
  const periodAbsent = periodMarks.length - periodPresent

  const studentsByClass = (classId) => students.filter((s) => s.classId === classId)

  const classRate = (classId) => rateOf(marksInRange(attendance, startDate, endDate, classId))

  const studentRate = (student) => {
    const effectiveStart = student.enrollDate && student.enrollDate > startDate
      ? student.enrollDate
      : startDate
    const marks = attendance
      .filter((a) => a.date >= effectiveStart && a.date <= endDate && a.records && student.id in a.records)
      .map((a) => a.records[student.id])
    return rateOf(marks)
  }

  const teacherStats = (teacherId) => {
    const teacherClasses = classes.filter((c) => c.teacherId === teacherId)
    const classIds = teacherClasses.map((c) => c.id)
    const studentCount = students.filter((s) => classIds.includes(s.classId)).length
    const marks = attendance
      .filter((a) => a.date >= startDate && a.date <= endDate && classIds.includes(a.classId))
      .flatMap((a) => Object.values(a.records || {}))
    return {
      classCount: teacherClasses.length,
      studentCount,
      rate: rateOf(marks),
    }
  }

  const lowAttendanceStudents = students
    .filter((s) => s.active !== false)
    .map((s) => ({ ...s, rate: studentRate(s) }))
    .filter((s) => s.rate !== null && s.rate < LOW_ATTENDANCE_THRESHOLD)
    .sort((a, b) => a.rate - b.rate)

  const paidStudentIds = new Set(payments.map((p) => p.studentId))
  const unpaidStudents = students.filter((s) => s.active !== false && !paidStudentIds.has(s.id))
  const showPaymentAlert = dayOfMonth >= PAYMENT_ALERT_DAY

  const activeStudentsCount = students.filter((s) => s.active !== false).length

  if (loading) {
    return <div className="text-center py-10 text-gray-500">جارٍ التحميل...</div>
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">لوحة التحكم</h2>

      {showPaymentAlert && unpaidStudents.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-medium text-sm text-red-700 mb-1">
            تنبيه: اشتراكات غير مدفوعة لشهر {MONTH_LABELS[currentMonthKey.slice(5)]}
          </p>
          <p className="text-xs text-red-500 mb-3">
            يرجى التواصل مع أولياء الأمور التالية أسماؤهم لتذكيرهم بالاشتراك ({MONTHLY_FEE} د.ت)
          </p>
          <div className="space-y-2">
            {unpaidStudents.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.className}</p>
                </div>
                <a href={`tel:${s.parentPhone}`} className="text-sm text-emerald-700 font-medium" dir="ltr">
                  {s.parentPhone || "-"}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
          <p className="text-2xl font-bold text-emerald-700">{activeStudentsCount}</p>
          <p className="text-xs text-gray-500">الطلاب النشطون</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
          <p className="text-2xl font-bold text-emerald-700">{classes.length}</p>
          <p className="text-xs text-gray-500">عدد الأقسام</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
          <p className="text-2xl font-bold text-emerald-700">{teachers.length}</p>
          <p className="text-xs text-gray-500">عدد المعلمين</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
          <p className="text-2xl font-bold text-emerald-700">
            {todayRate === null ? "-" : `${todayRate}%`}
          </p>
          <p className="text-xs text-gray-500">نسبة الحضور اليوم</p>
        </div>
      </div>

      {todayMarks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex justify-around text-center">
          <div>
            <p className="text-lg font-bold text-emerald-700">{todayPresent}</p>
            <p className="text-xs text-gray-500">حاضر اليوم</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{todayAbsent}</p>
            <p className="text-xs text-gray-500">غائب اليوم</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <p className="font-medium text-sm mb-3">إحصائيات فترة محددة</p>
        <div className="flex gap-2 mb-3">
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
        {periodMarks.length === 0 ? (
          <p className="text-gray-400 text-xs text-center py-2">لا يوجد سجل حضور في هذه الفترة</p>
        ) : (
          <div className="flex justify-around text-center">
            <div>
              <p className="text-lg font-bold text-emerald-700">{periodRate}%</p>
              <p className="text-xs text-gray-500">نسبة الحضور</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-700">{periodPresent}</p>
              <p className="text-xs text-gray-500">حاضر</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">{periodAbsent}</p>
              <p className="text-xs text-gray-500">غائب</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <p className="font-medium text-sm mb-3">الأقسام</p>
        <div className="space-y-2">
          {classes.map((c) => {
            const count = studentsByClass(c.id).length
            const rate = classRate(c.id)
            return (
              <div key={c.id} className="border rounded-lg p-3">
                <button
                  onClick={() => toggleClass(c.id)}
                  className="w-full flex items-center justify-between text-right"
                >
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.teacherName} — {count} طالب</p>
                  </div>
                  <span className="text-xs text-emerald-700 font-medium">
                    {rate === null ? "-" : `${rate}%`}
                  </span>
                </button>
                {openClasses[c.id] && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    {studentsByClass(c.id).map((s) => (
                      <p key={s.id} className="text-xs text-gray-600">{s.name}</p>
                    ))}
                    {count === 0 && (
                      <p className="text-xs text-gray-400">لا يوجد طلاب</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {classes.length === 0 && (
            <p className="text-gray-400 text-xs text-center py-2">لا توجد أقسام بعد</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <p className="font-medium text-sm mb-3">المعلمون</p>
        <div className="space-y-2">
          {teachers.map((t) => {
            const stats = teacherStats(t.id)
            return (
              <div key={t.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-gray-500">
                    {stats.classCount} أقسام — {stats.studentCount} طالب
                  </p>
                </div>
                <span className="text-xs text-emerald-700 font-medium">
                  {stats.rate === null ? "-" : `${stats.rate}%`}
                </span>
              </div>
            )
          })}
          {teachers.length === 0 && (
            <p className="text-gray-400 text-xs text-center py-2">لا يوجد معلمون بعد</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <p className="font-medium text-sm mb-3">
          تنبيه: طلاب بنسبة حضور منخفضة (أقل من {LOW_ATTENDANCE_THRESHOLD}%)
        </p>
        <div className="space-y-2">
          {lowAttendanceStudents.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b pb-2 last:border-0">
              <div>
                <p className="text-sm">{s.name}</p>
                <p className="text-xs text-gray-500">{s.className}</p>
              </div>
              <span className="text-xs text-red-600 font-medium">{s.rate}%</span>
            </div>
          ))}
          {lowAttendanceStudents.length === 0 && (
            <p className="text-gray-400 text-xs text-center py-2">لا يوجد طلاب بنسبة حضور منخفضة</p>
          )}
        </div>
      </div>
    </div>
  )
}
