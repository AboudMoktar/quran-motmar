import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where, doc, setDoc, getDocs } from "firebase/firestore"
import { db } from "../firebase"
import { useAuth } from "../context/AuthContext"
import { SURAHS, TAJWID_OPTIONS, HIFZ_OPTIONS, surahName, progressPercent } from "../utils/quran"

export default function Progress() {
  const { user, role } = useAuth()
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState("")
  const [students, setStudents] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [records, setRecords] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [historyStudentId, setHistoryStudentId] = useState("")
  const [studentHistory, setStudentHistory] = useState([])
  const [classHistory, setClassHistory] = useState([])
  const [openDates, setOpenDates] = useState({})

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
    if (!classId) {
      setStudents([])
      return
    }
    const q = query(collection(db, "students"), where("classId", "==", classId))
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => !s.deletedAt))
    })
    return unsub
  }, [classId])

  useEffect(() => {
    if (!classId || !date) return
    const load = async () => {
      const snap = await getDocs(
        query(collection(db, "progress"), where("classId", "==", classId), where("date", "==", date))
      )
      setRecords(snap.empty ? {} : snap.docs[0].data().records || {})
    }
    load()
  }, [classId, date])

  useEffect(() => {
    if (!classId) {
      setClassHistory([])
      return
    }
    const unsub = onSnapshot(query(collection(db, "progress"), where("classId", "==", classId)), (snap) => {
      const list = snap.docs
        .map((d) => d.data())
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      setClassHistory(list)
    })
    return unsub
  }, [classId])

  const setStudentField = (studentId, field, value) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [field]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage("")
    try {
      await setDoc(doc(db, "progress", `${classId}_${date}`), {
        classId,
        date,
        records,
      })
      setMessage("تم حفظ التقدم بنجاح")
    } catch {
      setMessage("حدث خطأ أثناء الحفظ")
    }
    setSaving(false)
    setTimeout(() => setMessage(""), 3000)
  }

  useEffect(() => {
    if (!classId || !historyStudentId) {
      setStudentHistory([])
      return
    }
    const load = async () => {
      const snap = await getDocs(query(collection(db, "progress"), where("classId", "==", classId)))
      const list = snap.docs
        .map((d) => d.data())
        .filter((p) => historyStudentId in (p.records || {}))
        .map((p) => ({ date: p.date, ...p.records[historyStudentId] }))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      setStudentHistory(list)
    }
    load()
  }, [classId, historyStudentId])

  const toggleDate = (d) => {
    setOpenDates((prev) => ({ ...prev, [d]: !prev[d] }))
  }

  const studentName = (id) => students.find((s) => s.id === id)?.name || id

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">التقدم القرآني</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 space-y-3">
        <select
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setHistoryStudentId("") }}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="">اختر القسم</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        />
      </div>

      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg p-3 mb-4 text-center">
          {message}
        </div>
      )}

      {classId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
          <p className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">تسجيل التقدم — {date}</p>
          <div className="space-y-4">
            {students.map((s) => {
              const rec = records[s.id] || {}
              return (
                <div key={s.id} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-0">
                  <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">{s.name}</p>
                  <select
                    value={rec.surah || ""}
                    onChange={(e) => setStudentField(s.id, "surah", Number(e.target.value))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm mb-2 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">اختر السورة المحفوظة</option>
                    {SURAHS.map((su) => (
                      <option key={su.number} value={su.number}>
                        {su.name} ({progressPercent(su.number)}%)
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">تقييم الحفظ</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {HIFZ_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setStudentField(s.id, "hifz", opt)}
                        className={`py-1.5 rounded-lg text-xs border ${
                          rec.hifz === opt
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">تقييم التجويد</p>
                  <div className="flex gap-2">
                    {TAJWID_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setStudentField(s.id, "tajwid", opt)}
                        className={`flex-1 py-1.5 rounded-lg text-xs border ${
                          rec.tajwid === opt
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {students.length === 0 && (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">لا يوجد طلاب في هذا القسم</p>
            )}
          </div>

          {students.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium mt-4 disabled:opacity-60"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ التقدم"}
            </button>
          )}
        </div>
      )}

      {classId && students.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
          <p className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">سجل تقدم طالب</p>
          <select
            value={historyStudentId}
            onChange={(e) => setHistoryStudentId(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm mb-3 dark:bg-gray-700 dark:text-white"
          >
            <option value="">اختر الطالب</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {historyStudentId && (
            <div className="space-y-2">
              {studentHistory.map((h, i) => (
                <div key={i} className="border-b border-gray-200 dark:border-gray-700 pb-2 last:border-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{h.date}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                      {h.surah ? `${surahName(h.surah)} (${progressPercent(h.surah)}%)` : "لم يسجل"}
                    </span>
                    {h.hifz && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">حفظ: {h.hifz}</span>
                    )}
                    {h.tajwid && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">تجويد: {h.tajwid}</span>
                    )}
                  </div>
                </div>
              ))}
              {studentHistory.length === 0 && (
                <p className="text-gray-400 dark:text-gray-500 text-xs text-center py-3">لا يوجد سجل بعد</p>
              )}
            </div>
          )}
        </div>
      )}

      {classId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <p className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">سجل القسم الكامل</p>
          <div className="space-y-2">
            {classHistory.map((entry) => {
              const count = Object.keys(entry.records || {}).length
              return (
                <div key={entry.date} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <button
                    onClick={() => toggleDate(entry.date)}
                    className="w-full flex items-center justify-between text-right"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.date}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{count} طالب</span>
                  </button>
                  {openDates[entry.date] && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                      {Object.entries(entry.records || {}).map(([sid, rec]) => (
                        <div key={sid} className="text-xs">
                          <p className="font-medium text-gray-700 dark:text-gray-300 mb-0.5">{studentName(sid)}</p>
                          <p className="text-gray-500 dark:text-gray-400">
                            {rec.surah ? `${surahName(rec.surah)} (${progressPercent(rec.surah)}%)` : "-"}
                            {rec.hifz ? ` — حفظ: ${rec.hifz}` : ""}
                            {rec.tajwid ? ` — تجويد: ${rec.tajwid}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {classHistory.length === 0 && (
              <p className="text-gray-400 dark:text-gray-500 text-xs text-center py-3">لا يوجد سجل بعد لهذا القسم</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
