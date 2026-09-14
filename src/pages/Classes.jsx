import { useEffect, useState } from "react"
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from "firebase/firestore"
import { Search } from "lucide-react"
import { db } from "../firebase"
import FAB from "../components/FAB"
import BottomSheet from "../components/BottomSheet"

const DAYS = [
  { key: "sun", label: "الأحد" },
  { key: "mon", label: "الإثنين" },
  { key: "tue", label: "الثلاثاء" },
  { key: "wed", label: "الأربعاء" },
  { key: "thu", label: "الخميس" },
  { key: "fri", label: "الجمعة" },
  { key: "sat", label: "السبت" },
]

export default function Classes() {
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)

  const [name, setName] = useState("")
  const [level, setLevel] = useState("")
  const [teacherId, setTeacherId] = useState("")
  const [days, setDays] = useState([])
  const [time, setTime] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "teacher"))
    const unsub = onSnapshot(q, (snap) => {
      setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  const toggleDay = (key) => {
    setDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    )
  }

  const resetForm = () => {
    setName("")
    setLevel("")
    setTeacherId("")
    setDays([])
    setTime("")
    setError("")
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError("")
    if (!name.trim() || !teacherId || days.length === 0 || !time) {
      setError("يرجى ملء جميع الحقول واختيار يوم واحد على الأقل")
      return
    }
    const teacher = teachers.find((t) => t.id === teacherId)
    try {
      await addDoc(collection(db, "classes"), {
        name: name.trim(),
        level: level.trim(),
        teacherId,
        teacherName: teacher?.name || "",
        days,
        time,
      })
      resetForm()
      setSheetOpen(false)
    } catch {
      setError("حدث خطأ أثناء الإضافة")
    }
  }

  const handleDelete = async (id) => {
    if (confirm("هل تريد حذف هذا القسم؟")) {
      await deleteDoc(doc(db, "classes", id))
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
            <button onClick={() => handleDelete(c.id)} className="text-red-600 text-xs">
              حذف
            </button>
          </div>
        ))}
        {filteredClasses.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">
            {search ? "لا توجد نتائج" : "لا توجد أقسام بعد"}
          </p>
        )}
      </div>

      <FAB onClick={() => setSheetOpen(true)} />

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="إضافة قسم">
        <form onSubmit={handleAdd} className="space-y-3">
          <input
            placeholder="اسم القسم"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="المستوى"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
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
                  days.includes(d.key)
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
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button type="submit" className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium">
            إضافة قسم
          </button>
        </form>
      </BottomSheet>
    </div>
  )
}
