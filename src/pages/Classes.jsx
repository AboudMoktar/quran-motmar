import { useEffect, useState } from "react"
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from "firebase/firestore"
import { Search, Pencil } from "lucide-react"
import { db } from "../firebase"
import FAB from "../components/FAB"
import BottomSheet from "../components/BottomSheet"
import FloatingInput from "../components/FloatingInput"
import FloatingSelect from "../components/FloatingSelect"
import { logActivity } from "../utils/activityLog"

const DAYS = [
  { key: "sun", label: "الأحد" },
  { key: "mon", label: "الإثنين" },
  { key: "tue", label: "الثلاثاء" },
  { key: "wed", label: "الأربعاء" },
  { key: "thu", label: "الخميس" },
  { key: "fri", label: "الجمعة" },
  { key: "sat", label: "السبت" },
]
const DAY_KEYS_BY_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

const DEFAULT_CAPACITY = 20

const emptyForm = { name: "", level: "", teacherId: "", schedule: [], capacity: String(DEFAULT_CAPACITY) }

// السعة القصوى لهذا القسم (عدد الطلاب) — حقل اختياري لكل قسم؛ الأقسام
// القديمة التي لا تملك هذا الحقل بعد تأخذ القيمة الافتراضية 20 دون أي
// ترحيل يدوي للبيانات.
export function getCapacity(c) {
  const n = Number(c?.capacity)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAPACITY
}

// ---------------------------------------------------------------------------
// "الجدول الزمني" (schedule) — مصفوفة {day, timeFrom, timeTo}، توقيت مستقل
// لكل يوم من أيام القسم (قسم قد يُدرَّس أكثر من مرة في الأسبوع بتوقيت مختلف
// لكل يوم، مثلاً السبت 14:30-16:00 والأحد 10:00-11:30). getSchedule() تدعم
// الأقسام القديمة التي كانت تحفظ "days" + "timeFrom"/"timeTo" واحد مشترك
// لكل الأيام (قبل هذا التحديث) دون الحاجة لأي ترحيل يدوي للبيانات — تُشتق
// لها جدولاً بنفس التوقيت مكرراً لكل يوم من "days".
// ---------------------------------------------------------------------------
export function getSchedule(c) {
  if (!c) return []
  if (Array.isArray(c.schedule) && c.schedule.length > 0) return c.schedule
  return (c.days || []).map((day) => ({ day, timeFrom: c.timeFrom || c.time || "", timeTo: c.timeTo || "" }))
}

export function scheduleDayKeys(c) {
  return getSchedule(c).map((e) => e.day)
}

// توقيت يوم أسبوع محدد (day key) لهذا القسم، أو null إن لم يكن من أيامه.
export function timeForDay(c, dayKey) {
  return getSchedule(c).find((e) => e.day === dayKey) || null
}

// توقيت تاريخ محدد (YYYY-MM-DD) حسب يوم أسبوعه — يُستعمل بدل الاعتماد على
// توقيت واحد عام للقسم، لأن كل يوم قد يكون له توقيت مختلف الآن.
export function timeForDate(c, dateStr) {
  if (!dateStr) return null
  const dayKey = DAY_KEYS_BY_INDEX[new Date(`${dateStr}T00:00:00`).getDay()]
  return timeForDay(c, dayKey)
}

// ملخص قصير للتوقيت وحده (بدون أيام) — يُستعمل حين تكون كل الأيام بنفس
// التوقيت (الحالة الأغلب)، وإلا يُشار إلى اختلاف التوقيت بين الأيام بدل
// عرض توقيت واحد قد يكون خاطئاً لبعض الأيام.
export function classTimeLabel(c) {
  const schedule = getSchedule(c)
  if (schedule.length === 0) return ""
  const unique = [...new Set(schedule.map((e) => `${e.timeFrom}|${e.timeTo}`))]
  if (unique.length === 1) {
    const [from, to] = unique[0].split("|")
    if (from && to) return `${from} - ${to}`
    return from || ""
  }
  return "أوقات متعددة حسب اليوم"
}

// نص كامل لكل أيام وتوقيتات القسم، مثل:
// "السبت 14:30-16:00 — الأحد 10:00-11:30"
export function scheduleLabel(c) {
  return getSchedule(c)
    .map((e) => {
      const dayLabel = DAYS.find((d) => d.key === e.day)?.label || e.day
      const time = e.timeFrom && e.timeTo ? `${e.timeFrom}-${e.timeTo}` : (e.timeFrom || "")
      return time ? `${dayLabel} ${time}` : dayLabel
    })
    .join(" — ")
}

export default function Classes() {
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")

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

  // إضافة/حذف يوم من الجدول — عند الإضافة يُنشأ سطر جديد بتوقيت فارغ
  // (يملأه المستخدم بعدها)، وليس نسخاً عن توقيت يوم آخر، لأن لكل يوم الآن
  // توقيته المستقل.
  const toggleDay = (key) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.some((e) => e.day === key)
        ? prev.schedule.filter((e) => e.day !== key)
        : [...prev.schedule, { day: key, timeFrom: "", timeTo: "" }],
    }))
  }

  const updateScheduleTime = (key, field, value) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((e) => (e.day === key ? { ...e, [field]: value } : e)),
    }))
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError("")
    setSheetOpen(true)
  }

  const openEdit = (c) => {
    setEditingId(c.id)
    setForm({
      name: c.name || "",
      level: c.level || "",
      teacherId: c.teacherId || "",
      schedule: getSchedule(c),
      capacity: String(getCapacity(c)),
    })
    setError("")
    setSheetOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.teacherId || form.schedule.length === 0) {
      setError("يرجى ملء جميع الحقول واختيار يوم واحد على الأقل")
      return
    }
    const incompleteDay = form.schedule.find((d) => !d.timeFrom || !d.timeTo)
    if (incompleteDay) {
      setError(`يرجى تحديد وقت البداية والنهاية ليوم ${DAYS.find((d) => d.key === incompleteDay.day)?.label || incompleteDay.day}`)
      return
    }
    const invalidDay = form.schedule.find((d) => d.timeTo <= d.timeFrom)
    if (invalidDay) {
      setError(`وقت النهاية يجب أن يكون بعد وقت البداية ليوم ${DAYS.find((d) => d.key === invalidDay.day)?.label || invalidDay.day}`)
      return
    }
    const capacityNum = Number(form.capacity)
    if (!Number.isInteger(capacityNum) || capacityNum <= 0) {
      setError("يرجى إدخال سعة صحيحة للقسم (عدد صحيح أكبر من صفر)")
      return
    }
    const teacher = teachers.find((t) => t.id === form.teacherId)
    const data = {
      name: form.name.trim(),
      level: form.level.trim(),
      teacherId: form.teacherId,
      teacherName: teacher?.name || "",
      schedule: form.schedule,
      days: form.schedule.map((d) => d.day),
      capacity: capacityNum,
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, "classes", editingId), data)
        logActivity("تعديل قسم", data.name)
      } else {
        await addDoc(collection(db, "classes"), { ...data, deletedAt: null })
        logActivity("إضافة قسم", data.name)
      }
      setSheetOpen(false)
    } catch {
      setError("حدث خطأ أثناء الحفظ")
    }
  }

  const handleDelete = async (c) => {
    if (confirm("هل تريد نقل هذا القسم إلى المحذوفات؟ يمكن استعادته خلال 7 أيام.")) {
      await updateDoc(doc(db, "classes", c.id), { deletedAt: Date.now() })
      logActivity("نقل قسم إلى المحذوفات", c.name)
    }
  }

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">الأقسام</h2>

      <div className="relative mb-4">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="بحث عن قسم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pr-10 pl-3 py-2 text-sm dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div className="space-y-2">
        {filteredClasses.map((c) => (
          <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{c.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.level} - {c.teacherName}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{scheduleLabel(c)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">السعة القصوى: {getCapacity(c)} طالب</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => openEdit(c)} className="text-emerald-700 dark:text-emerald-400">
                <Pencil size={16} />
              </button>
              <button onClick={() => handleDelete(c)} className="text-red-600 dark:text-red-400 text-xs">
                حذف
              </button>
            </div>
          </div>
        ))}
        {filteredClasses.length === 0 && (
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">
            {search ? "لا توجد نتائج" : "لا توجد أقسام بعد"}
          </p>
        )}
      </div>

      <FAB onClick={openAdd} />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? "تعديل القسم" : "إضافة قسم"}
        footer={
          <button type="submit" form="class-form" className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium">
            {editingId ? "حفظ التعديلات" : "إضافة قسم"}
          </button>
        }
      >
        <form id="class-form" onSubmit={handleSubmit} className="space-y-3">
          <FloatingInput
            label="اسم القسم"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <FloatingInput
            label="المستوى"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
          />
          <FloatingSelect
            label="المعلم"
            value={form.teacherId}
            onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
          >
            <option value="" hidden></option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </FloatingSelect>
          <FloatingInput
            label="السعة القصوى (عدد الطلاب)"
            type="number"
            min="1"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          />

          <p className="text-sm text-gray-600 dark:text-gray-300">أيام الحصص وتوقيتها (كل يوم بتوقيته الخاص)</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                type="button"
                key={d.key}
                onClick={() => toggleDay(d.key)}
                className={`px-3 py-1 rounded-full text-xs border ${
                  form.schedule.some((e) => e.day === d.key)
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {form.schedule.length > 0 && (
            <div className="space-y-2">
              {DAYS.filter((d) => form.schedule.some((e) => e.day === d.key)).map((d) => {
                const entry = form.schedule.find((e) => e.day === d.key)
                return (
                  <div key={d.key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{d.label}</p>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">من</label>
                        <input
                          type="time"
                          value={entry.timeFrom}
                          onChange={(e) => updateScheduleTime(d.key, "timeFrom", e.target.value)}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">إلى</label>
                        <input
                          type="time"
                          value={entry.timeTo}
                          onChange={(e) => updateScheduleTime(d.key, "timeTo", e.target.value)}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {error && <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>}
        </form>
      </BottomSheet>
    </div>
  )
}
