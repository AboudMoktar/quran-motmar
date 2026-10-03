import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { PAYMENT_ALERT_DAY } from "../config"
import { getMonthlyFee } from "./Settings"

// Local-timezone-safe equivalent of `date.toISOString().slice(0, 10)` —
// toISOString() converts to UTC first, which shifts the calendar day back
// by one between local midnight and 1am in Tunisia (UTC+1).
function toLocalISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// يحوّل رقم هاتف محلي (مثال: "20123456") إلى الصيغة الدولية التي يتطلبها
// رابط wa.me (بدون "+" وبدون صفر في البداية، مع بادئة رمز البلد تونس 216) —
// إن كان الرقم يبدأ أصلاً بـ"216" أو "+216" يُترك كما هو بعد التنظيف فقط.
function toWhatsAppNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("216")) return digits
  return `216${digits.replace(/^0+/, "")}`
}

// يفتح محادثة واتساب مباشرة مع رقم هاتف محدد (الأستاذ المعني) مع نص جاهز —
// هذا يُرسل تنبيهًا فعليًا وشخصيًا لصاحب الرقم مباشرة (بخلاف رسالة عامة في
// مجموعة، حيث لا يوجد ضمان أن يراها الأستاذ المعني أو يُشعَر بها فعليًا).
function openWhatsAppTo(phone, text) {
  const number = toWhatsAppNumber(phone)
  if (!number) return
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank")
}

// يفتح واتساب (تطبيق الهاتف أو واتساب ويب) مع نص جاهز، بدون رقم هاتف محدد —
// يُستعمل فقط كبديل احتياطي لإعلام المجموعة كلها دفعة واحدة (مثلاً حين لا
// يتوفر رقم هاتف لأستاذ معيّن)، حيث يختار المستخدم يدويًا المحادثة/المجموعة
// المطلوبة من قائمة واتساب.
function openWhatsAppBroadcast(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
}

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
  const [notebookToday, setNotebookToday] = useState([])
  const [payments, setPayments] = useState([])
  const [monthlyFee, setMonthlyFee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(toLocalISODate(new Date()))
  const [endDate, setEndDate] = useState(toLocalISODate(new Date()))
  const [openClasses, setOpenClasses] = useState({})

  const now = new Date()
  const today = toLocalISODate(now)
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const dayOfMonth = now.getDate()

  useEffect(() => {
    const load = async () => {
      const todayStr = toLocalISODate(new Date())
      const [classesSnap, studentsSnap, teachersSnap, attendanceSnap, notebookSnap, paymentsSnap, fee] = await Promise.all([
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "students")),
        getDocs(query(collection(db, "users"), where("role", "==", "teacher"))),
        getDocs(collection(db, "attendance")),
        getDocs(query(collection(db, "classNotebook"), where("date", "==", todayStr))),
        getDocs(query(collection(db, "payments"), where("month", "==", currentMonthKey))),
        getMonthlyFee(),
      ])
      setClasses(classesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
      setStudents(studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => !s.deletedAt))
      setTeachers(teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => !t.deletedAt))
      setAttendance(attendanceSnap.docs.map((d) => d.data()))
      setNotebookToday(notebookSnap.docs.map((d) => d.data()))
      setPayments(paymentsSnap.docs.map((d) => d.data()))
      setMonthlyFee(fee)
      setLoading(false)
    }
    load()
  }, [])

  const toggleClass = (id) => {
    setOpenClasses((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Only students who are still active (not deleted, active !== false) count toward
  // attendance rates — this keeps the dashboard dynamic: a rate never reflects a
  // student who was later removed or deactivated, even if old attendance records
  // for that student still exist in Firestore.
  const activeStudentIds = new Set(students.filter((s) => s.active !== false).map((s) => s.id))

  const marksInRange = (docs, from, to, classId) =>
    docs
      .filter((a) => a.date >= from && a.date <= to && (!classId || a.classId === classId))
      .flatMap((a) =>
        Object.entries(a.records || {})
          .filter(([studentId]) => activeStudentIds.has(studentId))
          .map(([, present]) => present)
      )

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
      .flatMap((a) =>
        Object.entries(a.records || {})
          .filter(([studentId]) => activeStudentIds.has(studentId))
          .map(([, present]) => present)
      )
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

  // أقسام أُخذ فيها الحضور اليوم (أي حصة فعلية حصلت) لكن لم يُسجَّل لها بعد
  // "كراس القسم" لنفس اليوم — تنبيه للإدارة لتذكير الأستاذ المعني بملء الكراس.
  const classIdsWithAttendanceToday = new Set(
    attendance.filter((a) => a.date === today && a.classId).map((a) => a.classId)
  )
  const classIdsWithNotebookToday = new Set(notebookToday.map((n) => n.classId))
  const classesMissingNotebookToday = classes.filter(
    (c) => classIdsWithAttendanceToday.has(c.id) && !classIdsWithNotebookToday.has(c.id)
  )

  // نفس الأقسام لكن مُجمَّعة حسب الأستاذ، لأن أستاذاً واحداً قد يكون
  // مسؤولاً عن أكثر من قسم فيهما حصة اليوم بلا كراس مُسجَّل — رسالة واحدة
  // شخصية لكل أستاذ تذكر كل أقسامه المعنية دفعة واحدة، بدل رسالة منفصلة
  // لكل قسم.
  const teachersMissingNotebookToday = (() => {
    const map = new Map()
    classesMissingNotebookToday.forEach((c) => {
      const teacher = teachers.find((t) => t.id === c.teacherId)
      const key = teacher?.id || c.teacherId || c.teacherName || c.id
      if (!map.has(key)) {
        map.set(key, { teacher, teacherName: c.teacherName || teacher?.name || "-", classes: [] })
      }
      map.get(key).classes.push(c)
    })
    return Array.from(map.values())
  })()

  // رسالة شخصية لأستاذ واحد (تُرسَل مباشرة إلى رقمه عبر واتساب) — أفضل من
  // إشارة "@" نصية في رسالة جماعية، لأنها تصل فعليًا وتُشعِر صاحبها مباشرة.
  const teacherReminderMessage = (entry) => {
    const lines = [
      `السلام عليكم ${entry.teacherName}،`,
      "",
      entry.classes.length === 1
        ? `نلاحظ أن كراس القسم لحصة اليوم (${today}) لقسم «${entry.classes[0].name}» لم يُسجَّل بعد.`
        : `نلاحظ أن كراس القسم لحصة اليوم (${today}) لم يُسجَّل بعد للأقسام التالية:`,
      ...(entry.classes.length > 1 ? entry.classes.map((c) => `- ${c.name}`) : []),
      "",
      "الرجاء تسجيل الحصة في كراس القسم في أقرب وقت ممكن.",
      "بارك الله فيكم وجزاكم خيرًا.",
    ]
    return lines.join("\n")
  }

  // رسالة جماعية احتياطية فقط — تُستعمل حين لا يتوفر رقم هاتف لأستاذ معيّن،
  // فتُرسَل للمجموعة كاملة بدل عدم إعلام أحد.
  const notebookReminderMessage = () => {
    const lines = [
      "السلام عليكم ورحمة الله وبركاته،",
      "",
      `تذكير بملء كراس القسم لحصة اليوم (${today}):`,
      ...teachersMissingNotebookToday.map((entry) =>
        `- ${entry.classes.map((c) => c.name).join("، ")}: ${entry.teacherName}`
      ),
      "",
      "الرجاء تسجيل الحصة في كراس القسم في أقرب وقت ممكن.",
      "بارك الله فيكم وجزاكم خيرًا.",
    ]
    return lines.join("\n")
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500 dark:text-gray-400">جارٍ التحميل...</div>
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">لوحة التحكم</h2>

      {showPaymentAlert && unpaidStudents.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 mb-4">
          <p className="font-medium text-sm text-red-700 dark:text-red-300 mb-1">
            تنبيه: اشتراكات غير مدفوعة لشهر {MONTH_LABELS[currentMonthKey.slice(5)]}
          </p>
          <p className="text-xs text-red-500 dark:text-red-300/80 mb-3">
            يرجى التواصل مع أولياء الأمور التالية أسماؤهم لتذكيرهم بالاشتراك ({monthlyFee} د.ت)
          </p>
          <div className="space-y-2 mb-3">
            {unpaidStudents.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.className}</p>
                </div>
                <a href={`tel:${s.parentPhone}`} className="text-sm text-emerald-700 dark:text-emerald-400 font-medium" dir="ltr">
                  {s.parentPhone || "-"}
                </a>
              </div>
            ))}
          </div>
          <Link
            to="/messages"
            className="block w-full text-center bg-red-600 dark:bg-red-700 text-white rounded-lg py-2 text-sm font-medium"
          >
            إرسال رسالة تذكير جماعية
          </Link>
        </div>
      )}

      {classesMissingNotebookToday.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 mb-4">
          <p className="font-medium text-sm text-amber-700 dark:text-amber-300 mb-1">
            تنبيه: كراس القسم لم يُملأ اليوم
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-300/80 mb-3">
            الأقسام التالية سُجّل فيها الحضور اليوم لكن الأستاذ لم يسجّل بعد حصة اليوم في كراس القسم
          </p>
          <div className="space-y-2">
            {teachersMissingNotebookToday.map((entry) => (
              <div key={entry.teacher?.id || entry.teacherName} className="bg-white dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.teacherName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.classes.map((c) => c.name).join("، ")}
                    </p>
                  </div>
                  {entry.teacher?.phone && (
                    <a href={`tel:${entry.teacher.phone}`} className="text-sm text-amber-700 dark:text-amber-400 font-medium" dir="ltr">
                      {entry.teacher.phone}
                    </a>
                  )}
                </div>
                {entry.teacher?.phone ? (
                  <button
                    onClick={() => openWhatsAppTo(entry.teacher.phone, teacherReminderMessage(entry))}
                    className="w-full bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg py-1.5 text-xs font-medium"
                  >
                    إرسال تذكير عبر واتساب مباشرة لهذا الأستاذ
                  </button>
                ) : (
                  <p className="text-[11px] text-red-500 dark:text-red-400 text-center">
                    لا يوجد رقم هاتف مسجَّل لهذا الأستاذ — استعمل الإرسال الجماعي أدناه
                  </p>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => openWhatsAppBroadcast(notebookReminderMessage())}
            className="w-full bg-gray-700 dark:bg-gray-600 text-white rounded-lg py-2 text-sm font-medium mt-3"
          >
            أو إرسال تذكير جماعي عبر واتساب (لمن لا يوجد رقمه)
          </button>
          <p className="text-[11px] text-amber-600 dark:text-amber-300/70 mt-1 text-center">
            الزر الأخضر يفتح محادثة واتساب مباشرة مع هاتف الأستاذ المعني، فيصله التنبيه فعليًا. الزر الرمادي بديل احتياطي فقط يفتح واتساب بدون مستلم محدد، لتختار المجموعة يدويًا.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeStudentsCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">الطلاب النشطون</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{classes.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">عدد الأقسام</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{teachers.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">عدد المعلمين</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center border-t-4 border-gold-500">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {todayRate === null ? "-" : `${todayRate}%`}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">نسبة الحضور اليوم</p>
        </div>
      </div>

      {todayMarks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 flex justify-around text-center">
          <div>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{todayPresent}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">حاضر اليوم</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{todayAbsent}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">غائب اليوم</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
        <p className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">إحصائيات فترة محددة</p>
        <div className="flex gap-2 mb-3">
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
        {periodMarks.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-xs text-center py-2">لا يوجد سجل حضور في هذه الفترة</p>
        ) : (
          <div className="flex justify-around text-center">
            <div>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{periodRate}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">نسبة الحضور</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{periodPresent}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">حاضر</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{periodAbsent}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">غائب</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
        <p className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">الأقسام</p>
        <div className="space-y-2">
          {classes.map((c) => {
            const count = studentsByClass(c.id).length
            const rate = classRate(c.id)
            return (
              <div key={c.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <button
                  onClick={() => toggleClass(c.id)}
                  className="w-full flex items-center justify-between text-right"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.teacherName} — {count} طالب</p>
                  </div>
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    {rate === null ? "-" : `${rate}%`}
                  </span>
                </button>
                {openClasses[c.id] && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
                    {studentsByClass(c.id).map((s) => (
                      <p key={s.id} className="text-xs text-gray-600 dark:text-gray-300">{s.name}</p>
                    ))}
                    {count === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">لا يوجد طلاب</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {classes.length === 0 && (
            <p className="text-gray-400 dark:text-gray-500 text-xs text-center py-2">لا توجد أقسام بعد</p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
        <p className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">المعلمون</p>
        <div className="space-y-2">
          {teachers.map((t) => {
            const stats = teacherStats(t.id)
            return (
              <div key={t.id} className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {stats.classCount} أقسام — {stats.studentCount} طالب
                  </p>
                </div>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  {stats.rate === null ? "-" : `${stats.rate}%`}
                </span>
              </div>
            )
          })}
          {teachers.length === 0 && (
            <p className="text-gray-400 dark:text-gray-500 text-xs text-center py-2">لا يوجد معلمون بعد</p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <p className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">
          تنبيه: طلاب بنسبة حضور منخفضة (أقل من {LOW_ATTENDANCE_THRESHOLD}%)
        </p>
        <div className="space-y-2 mb-3">
          {lowAttendanceStudents.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 last:border-0">
              <div>
                <p className="text-sm text-gray-900 dark:text-gray-100">{s.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.className}</p>
              </div>
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">{s.rate}%</span>
            </div>
          ))}
          {lowAttendanceStudents.length === 0 && (
            <p className="text-gray-400 dark:text-gray-500 text-xs text-center py-2">لا يوجد طلاب بنسبة حضور منخفضة</p>
          )}
        </div>
        {lowAttendanceStudents.length > 0 && (
          <Link
            to="/messages"
            className="block w-full text-center bg-amber-600 dark:bg-amber-700 text-white rounded-lg py-2 text-sm font-medium"
          >
            إرسال رسالة تذكير بالغياب
          </Link>
        )}
      </div>
    </div>
  )
}
