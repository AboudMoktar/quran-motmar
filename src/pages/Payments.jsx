import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc } from "firebase/firestore"
import { Search, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { db } from "../firebase"
import { useAuth } from "../context/AuthContext"
import { getMonthlyFee } from "./Settings"
import { MONTHS, MONTH_LABELS, STATUS_LABELS, computeStudentMonth } from "../utils/finance"
import { logActivity } from "../utils/activityLog"
import BottomSheet from "../components/BottomSheet"

const STATUS_STYLES = {
  paid: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
  partial: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
  unpaid: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
  exempt: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
}

export default function Payments() {
  const { user, role, isAdminLevel } = useAuth()
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState("")
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState("")
  const [monthlyFee, setMonthlyFee] = useState(null)
  const now = new Date()
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(MONTHS[now.getMonth()])
  const [payments, setPayments] = useState([])
  const [exemptions, setExemptions] = useState([])
  const [expandedId, setExpandedId] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState("payment")
  const [formStudent, setFormStudent] = useState(null)
  const [formAmount, setFormAmount] = useState("")
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formNote, setFormNote] = useState("")
  const [formReason, setFormReason] = useState("")
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const monthKey = `${year}-${month}`

  useEffect(() => {
    getMonthlyFee().then(setMonthlyFee)
  }, [])

  useEffect(() => {
    const q = role === "teacher"
      ? query(collection(db, "classes"), where("teacherId", "==", user.uid))
      : collection(db, "classes")
    const unsub = onSnapshot(q, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    })
    return unsub
  }, [role, user])

  useEffect(() => {
    if (!classId) { setStudents([]); return }
    const q = query(collection(db, "students"), where("classId", "==", classId))
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => !s.deletedAt))
    })
    return unsub
  }, [classId])

  useEffect(() => {
    if (!classId) return
    const q = query(collection(db, "payments"), where("classId", "==", classId), where("month", "==", monthKey))
    const unsub = onSnapshot(q, (snap) => {
      setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [classId, monthKey])

  useEffect(() => {
    if (!classId) return
    const q = query(collection(db, "exemptions"), where("classId", "==", classId), where("month", "==", monthKey))
    const unsub = onSnapshot(q, (snap) => {
      setExemptions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [classId, monthKey])

  const forStudent = (list, studentId) => list.filter((x) => x.studentId === studentId)

  const openForm = (student, mode) => {
    const stat = computeStudentMonth(forStudent(payments, student.id), forStudent(exemptions, student.id), monthlyFee || 0)
    setFormStudent(student)
    setFormMode(mode)
    setFormAmount(String(stat.remaining || ""))
    setFormDate(new Date().toISOString().slice(0, 10))
    setFormNote("")
    setFormReason("")
    setFormError("")
    setFormOpen(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormError("")
    const amount = Number(formAmount)
    if (!amount || amount <= 0) {
      setFormError("يرجى إدخال مبلغ صحيح")
      return
    }
    setSaving(true)
    try {
      if (formMode === "payment") {
        await addDoc(collection(db, "payments"), {
          studentId: formStudent.id,
          classId,
          month: monthKey,
          amount,
          paidDate: formDate,
          note: formNote.trim(),
          mode: "نقداً",
          recordedBy: user.uid,
        })
        logActivity("تسجيل دفعة", `${formStudent.name} — ${amount} د.ت`)
      } else {
        if (!formReason.trim()) {
          setFormError("يرجى إدخال سبب الإعفاء")
          setSaving(false)
          return
        }
        await addDoc(collection(db, "exemptions"), {
          studentId: formStudent.id,
          classId,
          month: monthKey,
          amount,
          reason: formReason.trim(),
          note: formNote.trim(),
          date: formDate,
          recordedBy: user.uid,
        })
        logActivity("تسجيل إعفاء", `${formStudent.name} — ${amount} د.ت`)
      }
      setFormOpen(false)
    } catch {
      setFormError("حدث خطأ أثناء الحفظ")
    }
    setSaving(false)
  }

  const handleDeleteEntry = async (col, entry) => {
    if (confirm("هل تريد حذف هذا السجل؟ سيتم إعادة حساب الوضعية المالية.")) {
      await deleteDoc(doc(db, col, entry.id))
      logActivity(col === "payments" ? "حذف دفعة" : "حذف إعفاء", `${entry.amount} د.ت`)
    }
  }

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">اشتراكات التلاميذ</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 space-y-3">
        <select
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setExpandedId(""); setSearch("") }}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
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
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{MONTH_LABELS[m]}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          قيمة الاشتراك الشهري: {monthlyFee === null ? "..." : `${monthlyFee} د.ت`}
        </p>
      </div>

      {classId && (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="بحث عن طالب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pr-9 pl-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            {filteredStudents.map((s) => {
              const sPayments = forStudent(payments, s.id)
              const sExemptions = forStudent(exemptions, s.id)
              const stat = computeStudentMonth(sPayments, sExemptions, monthlyFee || 0)
              const expanded = expandedId === s.id
              const history = [
                ...sPayments.map((p) => ({ ...p, kind: "payment", d: p.paidDate })),
                ...sExemptions.map((ex) => ({ ...ex, kind: "exemption", d: ex.date })),
              ].sort((a, b) => (a.d < b.d ? 1 : -1))

              return (
                <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3">
                  <button
                    onClick={() => setExpandedId(expanded ? "" : s.id)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {stat.paid} / {stat.due} د.ت
                        {stat.exempted > 0 && ` — معفى ${stat.exempted} د.ت`}
                        {stat.remaining > 0 && ` — متبقي ${stat.remaining} د.ت`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-lg ${STATUS_STYLES[stat.status]}`}>
                        {STATUS_LABELS[stat.status]}
                      </span>
                      {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                      {history.length > 0 && (
                        <div className="space-y-1">
                          {history.map((h) => (
                            <div key={`${h.kind}_${h.id}`} className="flex items-center justify-between text-xs border-b border-gray-100 dark:border-gray-700 py-1 last:border-0">
                              <span className="text-gray-600 dark:text-gray-300">
                                {h.kind === "payment" ? "دفعة" : "إعفاء"} {h.amount} د.ت — {h.d}
                                {h.kind === "exemption" && h.reason ? ` (${h.reason})` : ""}
                              </span>
                              {isAdminLevel && (
                                <button onClick={() => handleDeleteEntry(h.kind === "payment" ? "payments" : "exemptions", h)}>
                                  <Trash2 size={14} className="text-red-500" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {stat.remaining > 0 ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => openForm(s, "payment")}
                            className="flex-1 bg-emerald-700 text-white rounded-lg py-1.5 text-xs"
                          >
                            تسجيل دفعة
                          </button>
                          {isAdminLevel && (
                            <button
                              onClick={() => openForm(s, "exemption")}
                              className="flex-1 bg-blue-700 text-white rounded-lg py-1.5 text-xs"
                            >
                              تسجيل إعفاء
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">لا يوجد مبلغ متبقي لهذا الشهر</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {filteredStudents.length === 0 && (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">
                {search ? "لا توجد نتائج" : "لا يوجد طلاب في هذا القسم"}
              </p>
            )}
          </div>
        </>
      )}

      <BottomSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={formStudent ? `${formMode === "payment" ? "تسجيل دفعة" : "تسجيل إعفاء"} — ${formStudent.name}` : ""}
        footer={
          <button
            type="submit"
            form="payment-form"
            disabled={saving}
            className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        }
      >
        <form id="payment-form" onSubmit={handleFormSubmit} className="space-y-3">
          <label className="block text-xs text-gray-500 dark:text-gray-400">المبلغ (د.ت)</label>
          <input
            type="number"
            value={formAmount}
            onChange={(e) => setFormAmount(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
          {formMode === "exemption" && (
            <>
              <label className="block text-xs text-gray-500 dark:text-gray-400">سبب الإعفاء</label>
              <input
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
              />
            </>
          )}
          <label className="block text-xs text-gray-500 dark:text-gray-400">التاريخ</label>
          <input
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
          <label className="block text-xs text-gray-500 dark:text-gray-400">ملاحظة (اختياري)</label>
          <input
            value={formNote}
            onChange={(e) => setFormNote(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
          {formMode === "payment" && (
            <p className="text-xs text-gray-400 dark:text-gray-500">طريقة الدفع: نقداً</p>
          )}
          {formError && <p className="text-red-600 dark:text-red-400 text-xs">{formError}</p>}
        </form>
      </BottomSheet>
    </div>
  )
}
