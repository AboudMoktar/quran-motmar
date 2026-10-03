import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { ChevronLeft, Search, X, FileText, FileSpreadsheet } from "lucide-react"
import { db } from "../firebase"
import { useAuth } from "../context/AuthContext"
import { SURAHS } from "../utils/quran"
import { getAllSessions } from "../utils/classNotebook"
import { exportExcel, exportExcelMultiSheet } from "../utils/exportExcel"
import { printReport, printMultiSection } from "../utils/printReport"

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
// هذه الصفحة مفتوحة الآن للإدارة والأساتذة معًا: الإدارة ترى كل الأقسام
// والأساتذة والحصص كما كانت، بينما يرى الأستاذ فقط أقسامه وحصصه الخاصة
// (فلترة تلقائية حسب uid)، بدون قسم "الأساتذة" الذي يبقى خاصًا بالإدارة.
// الانتقال إلى "تطور الأقسام"/"متابعة الأساتذة" (صفحتان خاصتان بالإدارة)
// يبقى متاحًا فقط للإدارة؛ الأستاذ يرى بياناته هنا مباشرة بدون انتقال.
export default function PedagogicalDashboard() {
  const navigate = useNavigate()
  const { user, isAdminLevel } = useAuth()
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  // فلاتر البحث والتصفية — كل الفلاتر اختيارية وتُطبَّق محليًا على الحصص
  // المحمّلة مسبقًا (sessions)، بدون أي قراءة إضافية من Firestore.
  const [filterClassId, setFilterClassId] = useState("")
  const [filterTeacherId, setFilterTeacherId] = useState("")
  const [filterSurah, setFilterSurah] = useState("")
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")

  // الإدارة تقرأ كل الأقسام بدون فلترة (كما كانت)؛ الأستاذ يقرأ فقط أقسامه
  // الخاصة عبر where("teacherId","==",uid) — بنفس الاستعلام المستعمل في
  // ClassNotebook.jsx، حتى يتوافق مع قاعدة الصلاحيات الحالية في Firestore.
  useEffect(() => {
    if (!user) return
    const q = isAdminLevel
      ? collection(db, "classes")
      : query(collection(db, "classes"), where("teacherId", "==", user.uid))
    const unsub = onSnapshot(q, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    })
    return unsub
  }, [isAdminLevel, user])

  // قائمة كل الأساتذة (لقسم "الأساتذة" وفلتر الأستاذ) — للإدارة فقط، لأن
  // صفحة "متابعة الأساتذة" نفسها تبقى خاصة بالإدارة.
  useEffect(() => {
    if (!isAdminLevel) {
      setTeachers([])
      return
    }
    const q = query(collection(db, "users"), where("role", "==", "teacher"))
    const unsub = onSnapshot(q, (snap) => {
      setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => !t.deletedAt))
    })
    return unsub
  }, [isAdminLevel])

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

  // الأستاذ لا يرى هنا إلا أقسامه وحصصه الخاصة فقط — نفس منطق التصفية
  // المستعمل في ClassNotebook.jsx (teacherId === uid). الإدارة ترى الكل.
  const effectiveClasses = isAdminLevel ? classes : classes.filter((c) => c.teacherId === user?.uid)
  const effectiveSessions = isAdminLevel ? sessions : sessions.filter((s) => s.teacherId === user?.uid)

  const recentSessions = effectiveSessions.slice(0, 8)

  const hasActiveFilters =
    filterClassId || filterTeacherId || filterSurah || filterFrom || filterTo

  const resetFilters = () => {
    setFilterClassId("")
    setFilterTeacherId("")
    setFilterSurah("")
    setFilterFrom("")
    setFilterTo("")
  }

  const filteredSessions = hasActiveFilters
    ? effectiveSessions.filter((s) => {
        if (filterClassId && s.classId !== filterClassId) return false
        if (filterTeacherId && s.teacherId !== filterTeacherId) return false
        if (filterSurah && !(s.lessons || []).some((l) => String(l.surah) === String(filterSurah))) return false
        if (filterFrom && s.date < filterFrom) return false
        if (filterTo && s.date > filterTo) return false
        return true
      })
    : []

  // ===== ترابط فلتر القسم وفلتر الأستاذ =====
  // عند اختيار قسم: لا حاجة لاختيار الأستاذ بعدها — يُضبط فلتر الأستاذ
  // تلقائيًا على أستاذ هذا القسم. وعند اختيار أستاذ: قائمة الأقسام تُصبح
  // محصورة في أقسامه فقط (ويُمسح اختيار قسم سابق إن لم يكن من أقسامه).
  const classOptionsForFilter = filterTeacherId
    ? effectiveClasses.filter((c) => c.teacherId === filterTeacherId)
    : effectiveClasses

  const teacherOptionsForFilter = filterClassId
    ? teachers.filter((t) => t.id === effectiveClasses.find((c) => c.id === filterClassId)?.teacherId)
    : teachers

  const handleFilterClassChange = (value) => {
    setFilterClassId(value)
    if (value) {
      const cls = effectiveClasses.find((c) => c.id === value)
      if (cls?.teacherId) setFilterTeacherId(cls.teacherId)
    }
  }

  const handleFilterTeacherChange = (value) => {
    setFilterTeacherId(value)
    if (value && filterClassId) {
      const cls = effectiveClasses.find((c) => c.id === filterClassId)
      if (cls && cls.teacherId !== value) setFilterClassId("")
    }
  }

  // ===== تصدير PDF / Excel — يُصدَّر دائمًا ما هو معروض حاليًا على الشاشة:
  // النتائج المصفّاة فقط إن كان هناك فلتر نشط، وإلا نظرة عامة كاملة (نفس
  // بيانات effectiveClasses/effectiveSessions المعروضة، مع قسم "الأساتذة"
  // للإدارة فقط). لا قراءة إضافية من Firestore — تصدير محلي بالكامل. =====
  const classRows = (list) =>
    list.map((c) => {
      const last = lastSessionForClass(c.id)
      return {
        القسم: c.name,
        "آخر حصة": last ? friendlyDate(last.date) : "-",
        "آخر الدروس": lastLessonsLabel(last?.lessons),
      }
    })

  const teacherRows = () =>
    teachers.map((t) => {
      const last = lastSessionForTeacher(t.id)
      return {
        الأستاذ: t.name,
        "عدد الأقسام": classesCountForTeacher(t.id),
        "آخر حصة": last ? friendlyDate(last.date) : "-",
      }
    })

  const sessionRows = (list) =>
    list.map((s) => ({
      التاريخ: friendlyDate(s.date),
      القسم: s.className || "-",
      الأستاذ: s.teacherName || "-",
      الدروس: lastLessonsLabel(s.lessons),
      ملاحظات: s.notes || "-",
    }))

  const filtersSummary = () => {
    const parts = []
    if (filterClassId) parts.push(`القسم: ${classes.find((c) => c.id === filterClassId)?.name || "-"}`)
    if (filterTeacherId) parts.push(`الأستاذ: ${teachers.find((t) => t.id === filterTeacherId)?.name || "-"}`)
    if (filterSurah) parts.push(`السورة: ${SURAHS.find((s) => String(s.number) === String(filterSurah))?.name || "-"}`)
    if (filterFrom) parts.push(`من: ${filterFrom}`)
    if (filterTo) parts.push(`إلى: ${filterTo}`)
    return parts
  }

  const handleExportPdf = () => {
    if (hasActiveFilters) {
      printReport({
        title: "تقرير الحصص المصفّاة",
        subtitleLines: filtersSummary(),
        rows: sessionRows(filteredSessions),
      })
      return
    }
    const sections = [
      { heading: "الأقسام", rows: classRows(effectiveClasses) },
      ...(isAdminLevel ? [{ heading: "الأساتذة", rows: teacherRows() }] : []),
      { heading: "الحصص", rows: sessionRows(effectiveSessions) },
    ]
    printMultiSection({ title: "المتابعة البيداغوجية", sections })
  }

  const handleExportExcel = () => {
    if (hasActiveFilters) {
      exportExcel("حصص_مصفاة", sessionRows(filteredSessions), filtersSummary())
      return
    }
    const sheets = [
      { name: "الأقسام", rows: classRows(effectiveClasses) },
      ...(isAdminLevel ? [{ name: "الأساتذة", rows: teacherRows() }] : []),
      { name: "الحصص", rows: sessionRows(effectiveSessions) },
    ]
    exportExcelMultiSheet("المتابعة_البيداغوجية", sheets)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">📊 المتابعة البيداغوجية</h2>
        {!loadingSessions && (
          <div className="flex gap-2">
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1 bg-gray-700 text-white rounded-lg px-2.5 py-1.5 text-xs"
            >
              <FileText size={14} />
              PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 bg-emerald-700 text-white rounded-lg px-2.5 py-1.5 text-xs"
            >
              <FileSpreadsheet size={14} />
              Excel
            </button>
          </div>
        )}
      </div>

      {loadingSessions && (
        <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">جارٍ التحميل...</p>
      )}

      {!loadingSessions && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Search size={16} className="text-emerald-700 dark:text-emerald-400" />
                البحث والتصفية
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
                >
                  <X size={14} />
                  مسح الفلاتر
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterClassId}
                onChange={(e) => handleFilterClassChange(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-xs dark:bg-gray-700 dark:text-white"
              >
                <option value="">كل الأقسام</option>
                {classOptionsForFilter.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {isAdminLevel && (
                <select
                  value={filterTeacherId}
                  onChange={(e) => handleFilterTeacherChange(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-xs dark:bg-gray-700 dark:text-white"
                >
                  <option value="">كل الأساتذة</option>
                  {teacherOptionsForFilter.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}

              <select
                value={filterSurah}
                onChange={(e) => setFilterSurah(e.target.value)}
                className="col-span-2 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-xs dark:bg-gray-700 dark:text-white"
              >
                <option value="">كل السور</option>
                {SURAHS.map((s) => (
                  <option key={s.number} value={s.number}>{s.name}</option>
                ))}
              </select>

              <div>
                <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-xs dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-xs dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  عدد النتائج: {filteredSessions.length}
                </p>
                <div className="space-y-2">
                  {filteredSessions.map((s) => {
                    const Wrapper = isAdminLevel ? "button" : "div"
                    return (
                      <Wrapper
                        key={`filtered_${s.classId}_${s.date}`}
                        onClick={isAdminLevel ? () => navigate(`/classes-progress?classId=${s.classId}`) : undefined}
                        className="w-full bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between text-right"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">📅 {friendlyDate(s.date)} — {s.className}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">👨‍🏫 {s.teacherName || "-"} — 📖 {lastLessonsLabel(s.lessons)}</p>
                        </div>
                        {isAdminLevel && <ChevronLeft size={18} className="text-gray-400 shrink-0" />}
                      </Wrapper>
                    )
                  })}
                  {filteredSessions.length === 0 && (
                    <p className="text-gray-400 dark:text-gray-500 text-xs text-center py-4">
                      لا توجد حصص مطابقة لهذا البحث
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">الأقسام</p>
              <span className="text-xs text-gray-500 dark:text-gray-400">عدد الأقسام: {effectiveClasses.length}</span>
            </div>
            <div className="space-y-2">
              {effectiveClasses.map((c) => {
                const last = lastSessionForClass(c.id)
                const Wrapper = isAdminLevel ? "button" : "div"
                return (
                  <Wrapper
                    key={c.id}
                    onClick={isAdminLevel ? () => navigate(`/classes-progress?classId=${c.id}`) : undefined}
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
                    {isAdminLevel && <ChevronLeft size={18} className="text-gray-400 shrink-0" />}
                  </Wrapper>
                )
              })}
              {effectiveClasses.length === 0 && (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">لا توجد أقسام بعد</p>
              )}
            </div>
          </div>

          {isAdminLevel && (
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
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">الحصص</p>
              <span className="text-xs text-gray-500 dark:text-gray-400">عدد الحصص المسجّلة: {effectiveSessions.length}</span>
            </div>
            <div className="space-y-2">
              {recentSessions.map((s) => {
                const Wrapper = isAdminLevel ? "button" : "div"
                return (
                  <Wrapper
                    key={`${s.classId}_${s.date}`}
                    onClick={isAdminLevel ? () => navigate(`/classes-progress?classId=${s.classId}`) : undefined}
                    className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 flex items-center justify-between text-right"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">📅 {friendlyDate(s.date)} — {s.className}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">👨‍🏫 {s.teacherName || "-"} — {(s.lessons || []).length} دروس</p>
                    </div>
                    {isAdminLevel && <ChevronLeft size={18} className="text-gray-400 shrink-0" />}
                  </Wrapper>
                )
              })}
              {effectiveSessions.length === 0 && (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">لا توجد حصص مسجّلة بعد</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
