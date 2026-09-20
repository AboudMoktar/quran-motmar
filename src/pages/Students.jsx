import { useEffect, useState } from "react"
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore"
import { Search, Pencil, Phone } from "lucide-react"
import { db } from "../firebase"
import FAB from "../components/FAB"
import BottomSheet from "../components/BottomSheet"
import { logActivity } from "../utils/activityLog"

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
  active: true,
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
      active: s.active !== undefined ? s.active : true,
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
      active: form.active,
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, "students", editingId), data)
        logActivity("تعديل طالب", fullName)
      } else {
        await addDoc(collection(db, "students"), data)
        logActivity("إضافة طالب", fullName)
      }
      setSheetOpen(false)
    } catch {
      setError("حدث خطأ أثناء الحفظ")
    }
  }

  const handleDelete = async (s) => {
    if (confirm("هل تريد حذف هذا الطالب؟")) {
      await deleteDoc(doc(db, "students", s.id))
      logActivity("حذف طالب", s.name)
    }
  }

  const renderTodayBadge = (studentId) => {
    if (!(studentId in todayStatus)) {
      return <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500">لم يسجل حضور اليوم</span>
    }
    return todayStatus[studentId]
      ? <span className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">حاضر اليوم</span>
      : <span className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700">غائب اليوم</span>
  }

  const renderActiveBadge = (active) =>
    active !== false
      ? <span className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">نشط</span>
      : <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500 border border-gray-200">غير نشط</span>

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
              <div className="flex items-start gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {(s.firstName || s.name || "?").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">
                      {s.name} {age !== null && `(${age} سنة)`}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => openEdit(s)} className="text-emerald-700">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(s)} className="text-red-600 text-xs">
                        حذف
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{s.className} — {s.level}</p>
                  <p className="text-xs text-gray-400">
                    الولي: {s.parentName || "-"}
                    {s.parentPhone && (
                      <a href={`tel:${s.parentPhone}`} className="inline-flex items-center gap-1 text-emerald-700 mr-2">
                        <Phone size={12} /> {s.parentPhone}
                      </a>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {renderTodayBadge(s.id)}
                {renderActiveBadge(s.active)}
              </div>
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
        footer={
          <button type="submit" form="student-form" className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium">
            {editingId ? "حفظ التعديلات" : "إضافة طالب"}
          </button>
        }
      >
        <form id="student-form" onSubmit={handleSubmit} className="space-y-3">
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
          <p className="text-xs text-gray-500">حالة الطالب</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, active: true })}
              className={`flex-1 py-2 rounded-lg text-sm border ${
                form.active ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-600 border-gray-300"
              }`}
            >
              نشط
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, active: false })}
              className={`flex-1 py-2 rounded-lg text-sm border ${
                !form.active ? "bg-gray-600 text-white border-gray-600" : "bg-white text-gray-600 border-gray-300"
              }`}
            >
              غير نشط
            </button>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </form>
      </BottomSheet>
    </div>
  )
}
