import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { Link } from "react-router-dom"
import { Pencil, Trash2, ChevronDown, ChevronUp, X, LayoutDashboard } from "lucide-react"
import { db } from "../firebase"
import { useAuth } from "../context/AuthContext"
import { SURAHS, surahName } from "../utils/quran"
import {
  getSessionsForClass,
  saveSession,
  deleteSession,
  newLessonId,
} from "../utils/classNotebook"
import { logActivity } from "../utils/activityLog"
import FAB from "../components/FAB"
import BottomSheet from "../components/BottomSheet"

// نفس الدالة المستعملة في بقية التطبيق لتجنّب مشكلة توقيت UTC عند بناء
// تاريخ اليوم محليًا.
function toLocalISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const DAYS_LABELS = {
  sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء",
  thu: "الخميس", fri: "الجمعة", sat: "السبت"
}
const DAY_KEYS_BY_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

// "السبت 03/10/2026" بدل "2026-10-03" فقط — نفس أسلوب العرض المستعمل في
// Messages.jsx، لعرض أوضح على الهاتف (مجرد تنسيق، لا يغيّر التاريخ المحفوظ).
function friendlyDate(dateStr) {
  if (!dateStr) return ""
  const [y, m, d] = dateStr.split("-")
  const dayName = DAYS_LABELS[DAY_KEYS_BY_INDEX[new Date(`${dateStr}T00:00:00`).getDay()]]
  return `${dayName} ${d}/${m}/${y}`
}

// نص مختصر لسطر واحد عند طي الحصة، مثل: "📖 3 دروس: النبأ، النازعات، عبس" —
// فقط لتسهيل التصفح السريع دون الحاجة لفتح كل حصة؛ التفاصيل الكاملة (من/إلى
// آية) تبقى داخل القائمة المفصّلة عند الفتح.
function lessonsSummary(lessons) {
  const list = lessons || []
  if (list.length === 0) return "لا توجد دروس"
  const names = list.map((l) => surahName(l.surah)).join("، ")
  return `📖 ${list.length} ${list.length === 1 ? "درس" : "دروس"}: ${names}`
}

const emptyLessonRow = () => ({ id: newLessonId(), surah: "", fromAyah: "", toAyah: "" })

export default function ClassNotebook() {
  const { user, name, role } = useAuth()
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState("")
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [openDates, setOpenDates] = useState({})

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingDate, setEditingDate] = useState(null) // null = إضافة حصة جديدة
  const [date, setDate] = useState(toLocalISODate(new Date()))
  const [lessons, setLessons] = useState([emptyLessonRow()])
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const q = role === "teacher"
      ? query(collection(db, "classes"), where("teacherId", "==", user.uid))
      : collection(db, "classes")
    const unsub = onSnapshot(q, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    })
    return unsub
  }, [role, user])

  const selectedClass = classes.find((c) => c.id === classId)

  const loadSessions = async (id) => {
    if (!id) {
      setSessions([])
      return
    }
    setLoadingSessions(true)
    const list = await getSessionsForClass(id)
    setSessions(list)
    setLoadingSessions(false)
  }

  useEffect(() => {
    loadSessions(classId)
    setOpenDates({})
  }, [classId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDate = (d) => setOpenDates((prev) => ({ ...prev, [d]: !prev[d] }))

  const openAdd = () => {
    setEditingDate(null)
    setDate(toLocalISODate(new Date()))
    setLessons([emptyLessonRow()])
    setNotes("")
    setError("")
    setSheetOpen(true)
  }

  const openEdit = (session) => {
    setEditingDate(session.date)
    setDate(session.date)
    setLessons(
      (session.lessons || []).length > 0
        ? session.lessons.map((l) => ({ id: l.id || newLessonId(), surah: l.surah, fromAyah: l.fromAyah, toAyah: l.toAyah }))
        : [emptyLessonRow()]
    )
    setNotes(session.notes || "")
    setError("")
    setSheetOpen(true)
  }

  const addLessonRow = () => setLessons((prev) => [...prev, emptyLessonRow()])

  const removeLessonRow = (id) => setLessons((prev) => prev.filter((l) => l.id !== id))

  const setLessonField = (id, field, value) =>
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (!date) {
      setError("يرجى اختيار التاريخ")
      return
    }

    // كل سطر فيه أي قيمة مُدخلة يجب أن يكون كاملاً (سورة + من + إلى)، وإلا
    // نرفض الحفظ بدل تجاهل السطر بصمت.
    const touched = lessons.filter((l) => l.surah || l.fromAyah || l.toAyah)
    if (touched.length === 0) {
      setError("يرجى إضافة سورة واحدة على الأقل")
      return
    }
    const incomplete = touched.find((l) => !l.surah || !l.fromAyah || !l.toAyah)
    if (incomplete) {
      setError("يرجى إكمال كل سورة (السورة، من الآية، إلى الآية) أو حذف السطر غير المكتمل")
      return
    }
    const invalidRange = touched.find((l) => Number(l.fromAyah) > Number(l.toAyah))
    if (invalidRange) {
      setError("رقم الآية الأولى يجب أن يكون أصغر من أو يساوي رقم الآية الأخيرة")
      return
    }

    setSaving(true)
    try {
      const cleanLessons = touched.map((l) => ({
        id: l.id,
        surah: Number(l.surah),
        fromAyah: Number(l.fromAyah),
        toAyah: Number(l.toAyah),
      }))

      // إذا غيّر الأستاذ تاريخ حصة كانت موجودة، فهذا ينتقل إلى معرّف وثيقة
      // جديد ({classId}_{date}) — يجب حذف الوثيقة القديمة أولاً لتجنّب بقاء
      // نسخة مكررة بالتاريخ السابق.
      if (editingDate && editingDate !== date) {
        await deleteSession(classId, editingDate)
      }

      // الحصة تُنسب دائمًا إلى أستاذ القسم الرسمي (selectedClass.teacherId/Name)
      // وليس إلى من يسجّلها فعليًا — فالإدارة قد تملأ كراس قسم نيابة عن
      // الأستاذ (كما في هذه الحالة)، وإن نُسبت الحصة لحساب الإدارة بدل
      // الأستاذ، لن تظهر إطلاقًا في "متابعة الأساتذة" الخاصة به رغم أنه
      // الأستاذ الفعلي لهذا القسم. الأستاذ نفسه لا يرى هنا إلا أقسامه هو على
      // أي حال (الفلترة أعلاه)، فهذا لا يغيّر شيئًا في حالته — فقط حالة
      // الإدارة التي قد تُسجّل نيابة عن أستاذ آخر.
      await saveSession({
        classId,
        className: selectedClass?.name || "",
        teacherId: selectedClass?.teacherId || user.uid,
        teacherName: selectedClass?.teacherName || name || "",
        date,
        lessons: cleanLessons,
        notes: notes.trim(),
      })

      logActivity(editingDate ? "تعديل حصة في كراس القسم" : "إضافة حصة في كراس القسم", `${selectedClass?.name || ""} — ${date}`)
      setSheetOpen(false)
      await loadSessions(classId)
    } catch {
      setError("حدث خطأ أثناء الحفظ")
    }
    setSaving(false)
  }

  const handleDelete = async (session) => {
    if (confirm("هل تريد حذف هذه الحصة نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.")) {
      await deleteSession(session.classId, session.date)
      logActivity("حذف حصة من كراس القسم", `${session.className || ""} — ${session.date}`)
      await loadSessions(classId)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          📚 {selectedClass ? `كراس قسم ${selectedClass.name}` : "كراس القسم"}
        </h2>
        {/* رابط إلى المتابعة البيداغوجية (نظرة عامة + تصدير PDF/Excel)، مفتوح
            الآن للأستاذ أيضًا على بياناته الخاصة فقط. */}
        <Link
          to="/pedagogical-dashboard"
          className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium"
        >
          <LayoutDashboard size={14} />
          التقارير
        </Link>
      </div>

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
        {classes.length === 0 && (
          <p className="text-gray-400 dark:text-gray-500 text-xs text-center pt-3">
            لا يوجد أي قسم مسند إليك حاليًا
          </p>
        )}
      </div>

      {classId && (
        <div className="space-y-2">
          {loadingSessions && (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">جارٍ التحميل...</p>
          )}

          {!loadingSessions && sessions.map((session) => (
            <div key={session.date} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3">
              <button
                onClick={() => toggleDate(session.date)}
                className="w-full flex items-center justify-between"
              >
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">📅 {friendlyDate(session.date)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">👨‍🏫 الأستاذ: {session.teacherName || "-"}</p>
                  {!openDates[session.date] && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{lessonsSummary(session.lessons)}</p>
                  )}
                </div>
                {openDates[session.date] ? (
                  <ChevronUp size={18} className="text-gray-400" />
                ) : (
                  <ChevronDown size={18} className="text-gray-400" />
                )}
              </button>

              {openDates[session.date] && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">📖 الدروس:</p>
                    <div className="space-y-1">
                      {(session.lessons || []).map((l) => (
                        <p key={l.id} className="text-xs text-gray-700 dark:text-gray-300">
                          • سورة {surahName(l.surah)} — {l.fromAyah} → {l.toAyah}
                        </p>
                      ))}
                    </div>
                  </div>
                  {session.notes && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">📝 ملاحظة:</p>
                      <p className="text-xs text-gray-700 dark:text-gray-300">{session.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openEdit(session)}
                      className="flex-1 flex items-center justify-center gap-1 border border-gray-300 dark:border-gray-600 rounded-lg py-1.5 text-xs text-emerald-700 dark:text-emerald-400"
                    >
                      <Pencil size={14} /> تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(session)}
                      className="flex-1 flex items-center justify-center gap-1 border border-gray-300 dark:border-gray-600 rounded-lg py-1.5 text-xs text-red-600 dark:text-red-400"
                    >
                      <Trash2 size={14} /> حذف
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {!loadingSessions && sessions.length === 0 && (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">
              لا توجد حصص مسجّلة بعد لهذا القسم
            </p>
          )}
        </div>
      )}

      {classId && <FAB onClick={openAdd} />}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingDate ? "تعديل حصة" : "➕ إضافة حصة"}
        footer={
          <button
            type="submit"
            form="notebook-form"
            disabled={saving}
            className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        }
      >
        <form id="notebook-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">📅 التاريخ</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">الدروس</p>
            <div className="space-y-3">
              {lessons.map((lesson, idx) => (
                <div key={lesson.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {idx === 0 ? "الدرس الأول" : `الدرس ${idx + 1}`}
                    </p>
                    {lessons.length > 1 && (
                      <button type="button" onClick={() => removeLessonRow(lesson.id)} className="text-gray-400">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <select
                    value={lesson.surah}
                    onChange={(e) => setLessonField(lesson.id, "surah", e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">📖 اختر السورة</option>
                    {SURAHS.map((su) => (
                      <option key={su.number} value={su.number}>{su.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="🔢 من الآية"
                      value={lesson.fromAyah}
                      onChange={(e) => setLessonField(lesson.id, "fromAyah", e.target.value)}
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="🔢 إلى الآية"
                      value={lesson.toAyah}
                      onChange={(e) => setLessonField(lesson.id, "toAyah", e.target.value)}
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLessonRow}
              className="w-full mt-2 border border-emerald-700 text-emerald-700 dark:text-emerald-400 rounded-lg py-2 text-sm"
            >
              ➕ إضافة سورة أخرى
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">📝 ملاحظات الأستاذ — اختياري</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>

          {error && <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>}
        </form>
      </BottomSheet>
    </div>
  )
}
