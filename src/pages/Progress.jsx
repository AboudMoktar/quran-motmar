import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where, doc, setDoc, getDocs } from "firebase/firestore"
import { db } from "../firebase"
import { useAuth } from "../context/AuthContext"

const SURAHS = [
  { number: 114, name: "الناس" }, { number: 113, name: "الفلق" }, { number: 112, name: "الإخلاص" },
  { number: 111, name: "المسد" }, { number: 110, name: "النصر" }, { number: 109, name: "الكافرون" },
  { number: 108, name: "الكوثر" }, { number: 107, name: "الماعون" }, { number: 106, name: "قريش" },
  { number: 105, name: "الفيل" }, { number: 104, name: "الهمزة" }, { number: 103, name: "العصر" },
  { number: 102, name: "التكاثر" }, { number: 101, name: "القارعة" }, { number: 100, name: "العاديات" },
  { number: 99, name: "الزلزلة" }, { number: 98, name: "البينة" }, { number: 97, name: "القدر" },
  { number: 96, name: "العلق" }, { number: 95, name: "التين" }, { number: 94, name: "الشرح" },
  { number: 93, name: "الضحى" }, { number: 92, name: "الليل" }, { number: 91, name: "الشمس" },
  { number: 90, name: "البلد" }, { number: 89, name: "الفجر" }, { number: 88, name: "الغاشية" },
  { number: 87, name: "الأعلى" }, { number: 86, name: "الطارق" }, { number: 85, name: "البروج" },
  { number: 84, name: "الانشقاق" }, { number: 83, name: "المطففين" }, { number: 82, name: "الانفطار" },
  { number: 81, name: "التكوير" }, { number: 80, name: "عبس" }, { number: 79, name: "النازعات" },
  { number: 78, name: "النبأ" }, { number: 77, name: "المرسلات" }, { number: 76, name: "الإنسان" },
  { number: 75, name: "القيامة" }, { number: 74, name: "المدثر" }, { number: 73, name: "المزمل" },
  { number: 72, name: "الجن" }, { number: 71, name: "نوح" }, { number: 70, name: "المعارج" },
  { number: 69, name: "الحاقة" }, { number: 68, name: "القلم" }, { number: 67, name: "الملك" },
  { number: 66, name: "التحريم" }, { number: 65, name: "الطلاق" }, { number: 64, name: "التغابن" },
  { number: 63, name: "المنافقون" }, { number: 62, name: "الجمعة" }, { number: 61, name: "الصف" },
  { number: 60, name: "الممتحنة" }, { number: 59, name: "الحشر" }, { number: 58, name: "المجادلة" },
  { number: 57, name: "الحديد" }, { number: 56, name: "الواقعة" }, { number: 55, name: "الرحمن" },
  { number: 54, name: "القمر" }, { number: 53, name: "النجم" }, { number: 52, name: "الطور" },
  { number: 51, name: "الذاريات" }, { number: 50, name: "ق" }, { number: 49, name: "الحجرات" },
  { number: 48, name: "الفتح" }, { number: 47, name: "محمد" }, { number: 46, name: "الأحقاف" },
  { number: 45, name: "الجاثية" }, { number: 44, name: "الدخان" }, { number: 43, name: "الزخرف" },
  { number: 42, name: "الشورى" }, { number: 41, name: "فصلت" }, { number: 40, name: "غافر" },
  { number: 39, name: "الزمر" }, { number: 38, name: "ص" }, { number: 37, name: "الصافات" },
  { number: 36, name: "يس" }, { number: 35, name: "فاطر" }, { number: 34, name: "سبأ" },
  { number: 33, name: "الأحزاب" }, { number: 32, name: "السجدة" }, { number: 31, name: "لقمان" },
  { number: 30, name: "الروم" }, { number: 29, name: "العنكبوت" }, { number: 28, name: "القصص" },
  { number: 27, name: "النمل" }, { number: 26, name: "الشعراء" }, { number: 25, name: "الفرقان" },
  { number: 24, name: "النور" }, { number: 23, name: "المؤمنون" }, { number: 22, name: "الحج" },
  { number: 21, name: "الأنبياء" }, { number: 20, name: "طه" }, { number: 19, name: "مريم" },
  { number: 18, name: "الكهف" }, { number: 17, name: "الإسراء" }, { number: 16, name: "النحل" },
  { number: 15, name: "الحجر" }, { number: 14, name: "إبراهيم" }, { number: 13, name: "الرعد" },
  { number: 12, name: "يوسف" }, { number: 11, name: "هود" }, { number: 10, name: "يونس" },
  { number: 9, name: "التوبة" }, { number: 8, name: "الأنفال" }, { number: 7, name: "الأعراف" },
  { number: 6, name: "الأنعام" }, { number: 5, name: "المائدة" }, { number: 4, name: "النساء" },
  { number: 3, name: "آل عمران" }, { number: 2, name: "البقرة" }, { number: 1, name: "الفاتحة" },
]

const TAJWID_OPTIONS = ["ممتاز", "جيد", "يحتاج إلى تحسين"]

function surahName(num) {
  return SURAHS.find((s) => s.number === num)?.name || "-"
}

function progressPercent(num) {
  return Math.round(((115 - num) / 114) * 100)
}

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
        query(collection(db, "progress"), where("classId", "==", classId), where("date", "==", date))
      )
      setRecords(snap.empty ? {} : snap.docs[0].data().records || {})
    }
    load()
  }, [classId, date])

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
      setHistory([])
      return
    }
    const load = async () => {
      const snap = await getDocs(query(collection(db, "progress"), where("classId", "==", classId)))
      const list = snap.docs
        .map((d) => d.data())
        .filter((p) => historyStudentId in (p.records || {}))
        .map((p) => ({ date: p.date, ...p.records[historyStudentId] }))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      setHistory(list)
    }
    load()
  }, [classId, historyStudentId])

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">التقدم القرآني</h2>

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

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-3 mb-4 text-center">
          {message}
        </div>
      )}

      {classId && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <p className="text-sm font-medium mb-3">تسجيل التقدم</p>
          <div className="space-y-4">
            {students.map((s) => {
              const rec = records[s.id] || {}
              return (
                <div key={s.id} className="border-b pb-3 last:border-0">
                  <p className="text-sm font-medium mb-2">{s.name}</p>
                  <select
                    value={rec.surah || ""}
                    onChange={(e) => setStudentField(s.id, "surah", Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
                  >
                    <option value="">اختر السورة المحفوظة</option>
                    {SURAHS.map((su) => (
                      <option key={su.number} value={su.number}>
                        {su.name} ({progressPercent(su.number)}%)
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    {TAJWID_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setStudentField(s.id, "tajwid", opt)}
                        className={`flex-1 py-1.5 rounded-lg text-xs border ${
                          rec.tajwid === opt
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-white text-gray-600 border-gray-300"
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
              <p className="text-gray-400 text-sm text-center py-4">لا يوجد طلاب في هذا القسم</p>
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
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm font-medium mb-3">سجل تقدم طالب</p>
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
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b py-2 last:border-0">
                  <span className="text-gray-500">{h.date}</span>
                  <span>{h.surah ? surahName(h.surah) : "-"}</span>
                  <span className="text-emerald-700">{h.surah ? `${progressPercent(h.surah)}%` : "-"}</span>
                  <span className="text-xs text-gray-500">{h.tajwid || "-"}</span>
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
