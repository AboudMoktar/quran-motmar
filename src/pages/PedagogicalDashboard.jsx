import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { ChevronLeft } from "lucide-react"
import { db } from "../firebase"
import { SURAHS } from "../utils/quran"
import { getAllSessions } from "../utils/classNotebook"

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

function lastLessonsLabel(lessons) {
  const list = lessons || []
  if (list.length === 0) return "-"
  return list.map((l) => surahName(l.surah)).join("، ")
}

// لوحة واحدة تجمع كل ما سبق (الأقسام/الأساتذة/الحصص) في نظرة عامة، مع
// إمكانية الضغط على أي عنصر للانتقال مباشرة إلى تفاصيله في "تطور الأقسام"
// أو "متابعة الأساتذة" (عبر رابط يحمل classId / teacherId).
export default function PedagogicalDashboard() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    })
    return unsub
  }, [])

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "teacher"))
    const unsub = onSnapshot(q, (snap) => {
      setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => !t.deletedAt))
    })
    return unsub
  }, [])

  useEffect(() => {
    setLoadingSessions(true)
    getAllSessions().then((list) => {
      setSessions(list)
      setLoadingSessions(false)
    })
  }, [])

  const lastSessionForClass = (classId) => sessions.find((s) => s.classId === classId) || null
  const lastSessionForTeacher = (teacherId) => sessions.find((s) => s.teacherId === teacherId) || null
  const classesCountForTeacher = (teacherId) => classes.filter((c) => c.teacherId === teacherId).length

  const recentSessions = sessions.slice(0, 8)

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">📊 المتابعة البيداغوجية</h2>

      {loadingSessions && (
        <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">جارٍ التحميل...</p>
      )}

      {!loadingSessions && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">الأقسام</p>
              <span className="text-xs text-gray-500 dark:text-gray-400">عدد الأقسام: {classes.length}</span>
            </div>
            <div className="space-y-2">
              {classes.map((c) => {
                const last = lastSessionForClass(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/classes-progress?classId=${c.id}`)}
                    className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 flex items-center justify-between text-right"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {last ? `📖 آخر درس: ${lastLessonsLabel(last.lessons)}` : "لا توجد حصص مسجّلة بعد"}
                      </p>
                      {last && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">📅 {friendlyDate(last.date)}</p>
                      )}
                    </div>
                    <ChevronLeft size={18} className="text-gray-400 shrink-0" />
                  </button>
                )
              })}
              {classes.length === 0 && (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">لا توجد أقسام بعد</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">الأساتذة</p>
              <span className="text-xs text-gray-500 dark:text-gray-400">عدد الأساتذة: {teachers.length}</span>
            </div>
            <div className="space-y-2">
              {teachers.map((t) => {
                const last = lastSessionForTeacher(t.id)
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/teachers-tracking?teacherId=${t.id}`)}
                    className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 flex items-center justify-between text-right"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        🏫 {classesCountForTeacher(t.id)} قسم — {last ? `آخر حصة: ${friendlyDate(last.date)}` : "لا توجد حصص مسجّلة بعد"}
                      </p>
                    </div>
                    <ChevronLeft size={18} className="text-gray-400 shrink-0" />
                  </button>
                )
              })}
              {teachers.length === 0 && (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">لا يوجد أساتذة بعد</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">الحصص</p>
              <span className="text-xs text-gray-500 dark:text-gray-400">عدد الحصص المسجّلة: {sessions.length}</span>
            </div>
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <button
                  key={`${s.classId}_${s.date}`}
                  onClick={() => navigate(`/classes-progress?classId=${s.classId}`)}
                  className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 flex items-center justify-between text-right"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">📅 {friendlyDate(s.date)} — {s.className}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">👨‍🏫 {s.teacherName || "-"} — {(s.lessons || []).length} دروس</p>
                  </div>
                  <ChevronLeft size={18} className="text-gray-400 shrink-0" />
                </button>
              ))}
              {sessions.length === 0 && (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">لا توجد حصص مسجّلة بعد</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
