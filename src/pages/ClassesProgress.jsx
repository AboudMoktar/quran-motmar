import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { collection, onSnapshot } from "firebase/firestore"
import { ChevronDown, ChevronUp } from "lucide-react"
import { db } from "../firebase"
import { SURAHS } from "../utils/quran"
import { getSessionsForClass } from "../utils/classNotebook"

// نفس دوال التنسيق المستعملة في ClassNotebook.jsx (عرض فقط، بدون أي تعديل
// على المنطق أو البيانات) — مكررة هنا محليًا بدل استيرادها من صفحة أخرى،
// حتى تبقى كل صفحة مستقلة بذاتها.
const DAYS_LABELS = {
  sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء",
  thu: "الخميس", fri: "الجمعة", sat: "السبت"
}
const DAY_KEYS_BY_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

function friendlyDate(dateStr) {
  if (!dateStr) return ""
  const [y, m, d] = dateStr.split("-")
  const dayName = DAYS_LABELS[DAY_KEYS_BY_INDEX[new Date(`${dateStr}T00:00:00`).getDay()]]
  return `${dayName} ${d}/${m}/${y}`
}

function surahName(num) {
  return SURAHS.find((s) => s.number === num)?.name || "-"
}

export default function ClassesProgress() {
  const [searchParams] = useSearchParams()
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState("")
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [openDates, setOpenDates] = useState({})

  // الإدارة ترى كل الأقسام (بدون تصفية حسب الأستاذ)، بنفس طريقة
  // Classes.jsx.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    })
    return unsub
  }, [])

  // يفتح القسم مباشرة إن جاء رابط من "المتابعة البيداغوجية" يحمل
  // ?classId=... — بمجرد تحميل قائمة الأقسام، ولمرة واحدة فقط.
  useEffect(() => {
    const requested = searchParams.get("classId")
    if (requested && classes.some((c) => c.id === requested) && !classId) {
      setClassId(requested)
    }
  }, [classes, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!classId) {
      setSessions([])
      return
    }
    setLoading(true)
    setOpenDates({})
    getSessionsForClass(classId).then((list) => {
      setSessions(list)
      setLoading(false)
    })
  }, [classId])

  const toggleDate = (d) => setOpenDates((prev) => ({ ...prev, [d]: !prev[d] }))

  const selectedClass = classes.find((c) => c.id === classId)
  const lastSession = sessions[0] || null

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">📊 تطور الأقسام</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="">اختر القسم</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {classId && loading && (
        <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">جارٍ التحميل...</p>
      )}

      {classId && !loading && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              قسم {selectedClass?.name}
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{sessions.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">عدد الحصص</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  {lastSession ? friendlyDate(lastSession.date) : "-"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">تاريخ آخر حصة</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">📖 آخر السور التي تم تدريسها:</p>
              {lastSession ? (
                <div className="space-y-0.5">
                  {(lastSession.lessons || []).map((l) => (
                    <p key={l.id} className="text-xs text-gray-700 dark:text-gray-300">
                      • {surahName(l.surah)} {l.fromAyah}–{l.toAyah}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">لا توجد حصص مسجّلة بعد</p>
              )}
            </div>
          </div>

          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">جميع الدروس بالترتيب الزمني</p>
          <div className="space-y-2">
            {sessions.map((session) => (
              <div key={session.date} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3">
                <button
                  onClick={() => toggleDate(session.date)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">📅 {friendlyDate(session.date)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">👨‍🏫 الأستاذ: {session.teacherName || "-"}</p>
                  </div>
                  {openDates[session.date] ? (
                    <ChevronUp size={18} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={18} className="text-gray-400" />
                  )}
                </button>
                {openDates[session.date] && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    <div className="space-y-1">
                      {(session.lessons || []).map((l) => (
                        <p key={l.id} className="text-xs text-gray-700 dark:text-gray-300">
                          • سورة {surahName(l.surah)} — {l.fromAyah} → {l.toAyah}
                        </p>
                      ))}
                    </div>
                    {session.notes && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">📝 ملاحظة:</p>
                        <p className="text-xs text-gray-700 dark:text-gray-300">{session.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">
                لا توجد حصص مسجّلة بعد لهذا القسم
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
