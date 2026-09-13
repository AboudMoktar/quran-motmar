import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where, doc, setDoc, getDocs } from "firebase/firestore"
import { db } from "../firebase"
import { useAuth } from "../context/AuthContext"

const DAYS_LABELS = {
  sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء",
  thu: "الخميس", fri: "الجمعة", sat: "السبت"
}

export default function Attendance() {
  const { user, role } = useAuth()
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState("")
  const [students, setStudents] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [records, setRecords] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [historyStudentId, setHistoryStudentId] = useState("")
  const [history, setHistory] = useState([])

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
    if (!classId || !date) return
    const load = async () => {
      const snap = await getDocs(
        query(collection(db, "attendance"), where("classId", "==", classId), where("date", "==", date))
      )
      setRecords(snap.empty ? {} : snap.docs[0].data().records || {})
    }
    load()
  }, [classId, date])

  const toggle = (studentId) => {
    setRecords((prev) => ({ ...prev, [studentId]: !prev[studentId] }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage("")
    try {
      await setDoc(doc(db, "attendance", `${classId}_${date}`), {
        classId,
        date,
        records,
      })
      setMessage("تم حفظ الحضور بنجاح")
    } catch {
      setMessage("حدث خطأ أثناء الحفظ")
    }
    setSaving(false)
  }

  useEffect(() => {
    if (!classId || !historyStudentId) {
      setHistory([])
      return
    }
    const load = async () => {
      const snap = await getDocs(query(collection(db, "attendance"), where("classId", "==", classId)))
      const list = snap.docs
        .map((d) => d.data())
        .filter((a) => historyStudentId in (a.records || {}))
        .map((a) => ({ date: a.date, present: a.records[historyStudentId] }))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      setHistory(list)
    }
    load()
  }, [classId, historyStudentId])

  const selectedClass = classes.find((c) => c.id === classId)

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">الحضور</h2>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 space-y-3">
        <select
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setHistoryStudentId("") }}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">اختر القسم</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {selectedClass && (
          <p className="text-xs text-gray-500">
            أيام الحصص: {(selectedClass.days || []).map((d) => DAYS_LABELS[d]).join("، ")} — {selectedClass.time}
          </p>
        )}

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {classId && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <p className="text-sm font-medium mb-3">قائمة الطلاب</p>
          <div className="space-y-2">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span className="text-sm">{s.name}</span>
                <button
                  onClick={() => toggle(s.id)}
                  className={`px-3 py-1 rounded-lg text-xs ${
                    records[s.id] ? "bg-emerald-700 text-white" : "bg-red-100 text-red-700"
                  }`}
                >
                  {records[s.id] ? "حاضر" : "غائب"}
                </button>
              </div>
            ))}
            {students.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">لا يوجد طلاب في هذا القسم</p>
            )}
          </div>

          {students.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium mt-4 disabled:opacity-60"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ الحضور"}
            </button>
          )}
          {message && <p className="text-xs text-center mt-2 text-gray-600">{message}</p>}
        </div>
      )}

      {classId && students.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm font-medium mb-3">سجل الحضور لطالب</p>
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
                  <span>{h.date}</span>
                  <span className={h.present ? "text-emerald-700" : "text-red-600"}>
                    {h.present ? "حاضر" : "غائب"}
                  </span>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-gray-400 text-xs text-center py-3">لا يوجد سجل بعد</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
