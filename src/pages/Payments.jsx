import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where, doc, setDoc, deleteDoc } from "firebase/firestore"
import { Search } from "lucide-react"
import { db } from "../firebase"
import { useAuth } from "../context/AuthContext"
import { getMonthlyFee } from "./Settings"

const MONTHS = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"
]
const MONTH_LABELS = {
  "01": "جانفي", "02": "فيفري", "03": "مارس", "04": "أفريل",
  "05": "ماي", "06": "جوان", "07": "جويلية", "08": "أوت",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر"
}

export default function Payments() {
  const { user, role } = useAuth()
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState("")
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState("")
  const [monthlyFee, setMonthlyFee] = useState(null)
  const now = new Date()
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(MONTHS[now.getMonth()])
  const [payments, setPayments] = useState({})
  const [historyStudentId, setHistoryStudentId] = useState("")
  const [history, setHistory] = useState([])
  const [message, setMessage] = useState("")

  const monthKey = `${year}-${month}`

  useEffect(() => {
    getMonthlyFee().then(setMonthlyFee)
  }, [])

  useEffect(() => {
    const q = role === "teacher"
      ? query(collection(db, "classes"), where("teacherId", "==", user.uid))
      : collection(db, "classes")
    const unsub = onSnapshot(q, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [role, user])

  useEffect(() => {
    if (!classId) {
      setStudents([])
      return
    }
    const q = query(collection(db, "students"), where("classId", "==", classId))
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [classId])

  useEffect(() => {
    if (!classId) return
    const q = query(
      collection(db, "payments"),
      where("classId", "==", classId),
      where("month", "==", monthKey)
    )
    const unsub = onSnapshot(q, (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.data().studentId] = d.data() })
      setPayments(map)
    })
    return unsub
  }, [classId, monthKey])

  const togglePaid = async (student) => {
    if (monthlyFee === null) return
    const paymentId = `${student.id}_${monthKey}`
    setMessage("")

    if (payments[student.id]) {
      const confirmed = confirm(`هل تريد إلغاء تسجيل دفع ${student.name} لشهر ${MONTH_LABELS[month]}؟`)
      if (!confirmed) return
      await deleteDoc(doc(db, "payments", paymentId))
      setMessage(`تم إلغاء تسجيل الدفع لـ ${student.name}`)
    } else {
      const confirmed = confirm(
        `تأكيد استلام اشتراك ${student.name} لشهر ${MONTH_LABELS[month]} ${year} بمبلغ ${monthlyFee} د.ت؟`
      )
      if (!confirmed) return
      await setDoc(doc(db, "payments", paymentId), {
        studentId: student.id,
        classId,
        month: monthKey,
        amount: monthlyFee,
        paidDate: new Date().toISOString().slice(0, 10),
      })
      setMessage(`تم تأكيد استلام اشتراك ${student.name} بنجاح ✅`)
    }
    setTimeout(() => setMessage(""), 4000)
  }

  useEffect(() => {
    if (!historyStudentId) {
      setHistory([])
      return
    }
    const q = query(collection(db, "payments"), where("studentId", "==", historyStudentId))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => d.data())
        .sort((a, b) => (a.month < b.month ? 1 : -1))
      setHistory(list)
    })
    return unsub
  }, [historyStudentId])

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">الاشتراكات الشهرية</h2>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 space-y-3">
        <select
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setHistoryStudentId(""); setMessage(""); setSearch("") }}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">اختر القسم</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{MONTH_LABELS[m]}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <p className="text-xs text-gray-500">
          قيمة الاشتراك الشهري: {monthlyFee === null ? "..." : `${monthlyFee} د.ت`}
        </p>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-3 mb-4 text-center">
          {message}
        </div>
      )}

      {classId && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <p className="text-sm font-medium mb-3">قائمة الطلاب - {MONTH_LABELS[month]} {year}</p>

          <div className="relative mb-3">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="بحث عن طالب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-lg pr-9 pl-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            {filteredStudents.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span className="text-sm">{s.name}</span>
                <button
                  onClick={() => togglePaid(s)}
                  className={`px-3 py-1 rounded-lg text-xs ${
                    payments[s.id] ? "bg-emerald-700 text-white" : "bg-red-100 text-red-700"
                  }`}
                >
                  {payments[s.id] ? "مدفوع ✓" : "غير مدفوع"}
                </button>
              </div>
            ))}
            {filteredStudents.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">
                {search ? "لا توجد نتائج" : "لا يوجد طلاب في هذا القسم"}
              </p>
            )}
          </div>
        </div>
      )}

      {classId && students.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm font-medium mb-3">سجل الاشتراكات لطالب</p>
          <select
            value={historyStudentId}
            onChange={(e) => setHistoryStudentId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
          >
            <option value="">اختر الطالب</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {historyStudentId && (
            <div className="space-y-1">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b py-1 last:border-0">
                  <span>{MONTH_LABELS[h.month.slice(5)]} {h.month.slice(0, 4)}</span>
                  <span className="text-emerald-700">{h.amount} د.ت - {h.paidDate}</span>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-gray-400 text-xs text-center py-3">لا يوجد سجل دفع بعد</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
