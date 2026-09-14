import { useEffect, useState } from "react"
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore"
import { Search, Pencil } from "lucide-react"
import { db } from "../firebase"
import FAB from "../components/FAB"
import BottomSheet from "../components/BottomSheet"

function calculateAge(birthDate) {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

const emptyForm = {
  firstName: "",
  lastName: "",
  birthDate: "",
  parentName: "",
  parentPhone: "",
  level: "",
  classId: "",
  enrollDate: new Date().toISOString().slice(0, 10),
}

export default function Students() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [todayStatus, setTodayStatus] = useState({})
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "students"), (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const q = query(collection(db, "attendance"), where("date", "==", today))
    const unsub = onSnapshot(q, (snap) => {
      const map = {}
      snap.docs.forEach((d) => {
        const records = d.data().records || {}
        Object.keys(records).forEach((studentId) => {
          map[studentId] = records[studentId]
        })
      })
      setTodayStatus(map)
    })
    return unsub
  }, [])

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError("")
    setSheetOpen(true)
  }

  const openEdit = (s) => {
    setEditingId(s.id)
    setForm({
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      birthDate: s.birthDate || "",
      parentName: s.parentName || "",
      parentPhone: s.parentPhone || "",
      level: s.level || "",
      classId: s.classId || "",
      enrollDate: s.enrollDate || new Date().toISOString().slice(0, 10),
    })
    setError("")
    setSheetOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate || !form.classId) {
      setError("يرجى إدخال الإسم واللقب وتاريخ الولادة واختيار القسم")
      return
    }
    const cls = classes.find((c) => c.id === form.classId)
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`
    const data = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      name: fullName,
      birthDate: form.birthDate,
      parentName: form.parentName.trim(),
      parentPhone: form.parentPhone.trim(),
      level: form.level.trim(),
      classId: form.classId,
      className: cls?.name || "",
      enrollDate: form.enrollDate,
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, "students", editingId), data)
      } else {
        await addDoc(collection(db, "students"), data)
      }
      setSheetOpen(false)
    } catch {
      setError("حدث خطأ أثناء الحفظ")
    }
  }

  const handleDelete = async (id) => {
    if (confirm("هل تريد حذف هذا الطالب؟")) {
      await deleteDoc(doc(db, "students", id))
    }
  }

  const renderBadge = (studentId) => {
    if (!(studentId in todayStatus)) {
      return <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500">لم يسجل بعد</span>
    }
    return todayStatus[studentId]
      ? <span className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">حاضر اليوم</span>
      : <span className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700">غائب اليوم</span>
  }

  const filteredStudents = students.filter((s) =>
    (s.name || "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">الطلاب</h2>

      <div className="relative mb-4">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="بحث عن طالب..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg pr-10 pl-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        {filteredStudents.map((s) => {
          const age = calculateAge(s.birthDate)
          return (
            <div key={s.id} className="bg-white rounded-xl shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">
                    {s.name} {age !== null && `(${age} سنة)`}
                  </p>
                  <p className="text-xs text-gray-500">{s.className} — {s.level}</p>
                  <p className="text-xs text-gray-400">
                    الولي: {s.parentName || "-"} — {s.parentPhone || "-"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => openEdit(s)} className="text-emerald-700">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-600 text-xs">
                    حذف
                  </button>
                </div>
              </div>
              {renderBadge(s.id)}
            </div>
          )
        })}
        {filteredStudents.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">
            {search ? "لا توجد نتائج" : "لا يوجد طلاب بعد"}
          </p>
        )}
      </div>

      <FAB onClick={openAdd} />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? "تعديل بيانات الطالب" : "إضافة طالب"}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="الإسم"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="اللقب"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <label className="block text-xs text-gray-500">تاريخ الولادة</label>
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          {form.birthDate && (
            <p className="text-xs text-emerald-700">السن: {calculateAge(form.birthDate)} سنة</p>
          )}
          <input
            placeholder="اسم الولي"
            value={form.parentName}
            onChange={(e) => setForm({ ...form, parentName: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="رقم هاتف الولي"
            value={form.parentPhone}
            onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="المستوى القرآني"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">اختر القسم</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="block text-xs text-gray-500">تاريخ التسجيل</label>
          <input
            type="date"
            value={form.enrollDate}
            onChange={(e) => setForm({ ...form, enrollDate: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button type="submit" className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium">
            {editingId ? "حفظ التعديلات" : "إضافة طالب"}
          </button>
        </form>
      </BottomSheet>
    </div>
  )
}
