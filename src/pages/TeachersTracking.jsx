import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { ChevronDown, ChevronUp } from "lucide-react"
import { db } from "../firebase"
import { SURAHS } from "../utils/quran"
import { getSessionsForTeacher } from "../utils/classNotebook"

// نفس دوال التنسيق المستعملة في ClassNotebook.jsx / ClassesProgress.jsx
// (عرض فقط، بدون أي تعديل على المنطق أو البيانات).
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

// هذه الصفحة للمتابعة فقط — بدون أي ترتيب أو تقييم أو نقاط للأساتذة، بنفس
// ما هو منصوص عليه صراحة في المواصفات (لا ترتيب، لا تقييم).
export default function TeachersTracking() {
  const [searchParams] = useSearchParams()
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [teacherId, setTeacherId] = useState("")
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [openKeys, setOpenKeys] = useState({})

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "teacher"))
    const unsub = onSnapshot(q, (snap) => {
      setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => !t.deletedAt))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    })
    return unsub
  }, [])

  // يفتح الأستاذ مباشرة إن جاء رابط من "المتابعة البيداغوجية" يحمل
  // ?teacherId=... — بمجرد تحميل قائمة الأساتذة، ولمرة واحدة فقط.
  useEffect(() => {
    const requested = searchParams.get("teacherId")
    if (requested && teachers.some((t) => t.id === requested) && !teacherId) {
      setTeacherId(requested)
    }
  }, [teachers, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!teacherId) {
      setSessions([])
      return
    }
    setLoading(true)
    setOpenKeys({})
    getSessionsForTeacher(teacherId).then((list) => {
      setSessions(list)
      setLoading(false)
    })
  }, [teacherId])

  const toggleKey = (k) => setOpenKeys((prev) => ({ ...prev, [k]: !prev[k] }))

  const selectedTeacher = teachers.find((t) => t.id === teacherId)
  // الأقسام المُسندة حاليًا لهذا الأستاذ (من classes.teacherId الحيّ) — قد
  // تختلف عن الأقسام الظاهرة في سجل الحصص القديم إذا أُعيد إسناد قسم لاحقًا.
  const assignedClasses = classes.filter((c) => c.teacherId === teacherId)
  const lastSession = sessions[0] || null

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">👨‍🏫 متابعة الأساتذة</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="">اختر الأستاذ</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {teacherId && loading && (
        <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">جارٍ التحميل...</p>
      )}

      {teacherId && !loading && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              الأستاذ {selectedTeacher?.name}
            </p>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">🏫 الأقسام التي يدرّسها:</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {assignedClasses.length > 0 ? assignedClasses.map((c) => c.name).join("، ") : "لا يوجد قسم مسند حاليًا"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{sessions.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">عدد الحصص المسجّلة</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  {lastSession ? friendlyDate(lastSession.date) : "-"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">تاريخ آخر حصة</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">📖 آخر السور والآيات:</p>
              {lastSession ? (
                <div className="space-y-0.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400">🏫 {lastSession.className}</p>
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

          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">السجل الكامل للحصص</p>
          <div className="space-y-2">
            {sessions.map((session) => {
              const key = `${session.classId}_${session.date}`
              return (
                <div key={key} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3">
                  <button
                    onClick={() => toggleKey(key)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">📅 {friendlyDate(session.date)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">🏫 {session.className || "-"}</p>
                    </div>
                    {openKeys[key] ? (
                      <ChevronUp size={18} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-400" />
                    )}
                  </button>
                  {openKeys[key] && (
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
              )
            })}
            {sessions.length === 0 && (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">
                لا توجد حصص مسجّلة بعد لهذا الأستاذ
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
