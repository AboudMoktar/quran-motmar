import { useEffect, useState } from "react"
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from "firebase/firestore"
import { Search, Pencil } from "lucide-react"
import { db } from "../firebase"
import FAB from "../components/FAB"
import BottomSheet from "../components/BottomSheet"
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

const emptyForm = { name: "", level: "", teacherId: "", days: [], time: "" }

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

  const toggleDay = (key) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(key) ? prev.days.filter((d) => d !== key) : [...prev.days, key],
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
      days: c.days || [],
      time: c.time || "",
    })
    setError("")
    setSheetOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.teacherId || form.days.length === 0 || !form.time) {
      setError("يرجى ملء جميع الحقول واختيار يوم واحد على الأقل")
      return
    }
    const teacher = teachers.find((t) => t.id === form.teacherId)
    const data = {
      name: form.name.trim(),
      level: form.level.trim(),
      teacherId: form.teacherId,
      teacherName: teacher?.name || "",
      days: form.days,
      time: form.time,
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

  const dayLabels = (keys) =>
    keys.map((k) => DAYS.find((d) => d.key === k)?.label).join(" - ")

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">الأقسام</h2>

      <div className="relative mb-4">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="بحث عن قسم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg pr-10 pl-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        {filteredClasses.map((c) => (
          <div key={c.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{c.name}</p>
              <p className="text-xs text-gray-500">{c.level} - {c.teacherName}</p>
              <p className="text-xs text-gray-400">{dayLabels(c.days || [])} - {c.time}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => openEdit(c)} className="text-emerald-700">
                <Pencil size={16} />
              </button>
              <button onClick={() => handleDelete(c)} className="text-red-600 text-xs">
                حذف
              </button>
            </div>
          </div>
        ))}
        {filteredClasses.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">
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
          <input
            placeholder="اسم القسم"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="المستوى"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={form.teacherId}
            onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">اختر المعلم</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <p className="text-sm text-gray-600">ايام الحصص</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                type="button"
                key={d.key}
                onClick={() => toggleDay(d.key)}
                className={`px-3 py-1 rounded-full text-xs border ${
                  form.days.includes(d.key)
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <label className="block text-sm text-gray-600">وقت الحصة</label>
          <input
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          {error && <p className="text-red-600 text-xs">{error}</p>}
        </form>
      </BottomSheet>
    </div>
  )
}
