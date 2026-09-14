import { useEffect, useState } from "react"
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from "firebase/firestore"
import { Search } from "lucide-react"
import { db } from "../firebase"
import FAB from "../components/FAB"
import BottomSheet from "../components/BottomSheet"

export default function Students() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [todayStatus, setTodayStatus] = useState({})
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)

  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [parentPhone, setParentPhone] = useState("")
  const [level, setLevel] = useState("")
  const [classId, setClassId] = useState("")
  const [enrollDate, setEnrollDate] = useState(new Date().toISOString().slice(0, 10))
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

  const resetForm = () => {
    setName("")
    setAge("")
    setParentPhone("")
    setLevel("")
    setClassId("")
    setError("")
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError("")
    if (!name.trim() || !age || !classId) {
      setError("يرجى إدخال الاسم والسن واختيار القسم")
      return
    }
    const cls = classes.find((c) => c.id === classId)
    try {
      await addDoc(collection(db, "students"), {
        name: name.trim(),
        age: Number(age),
        parentPhone: parentPhone.trim(),
        level: level.trim(),
        classId,
        className: cls?.name || "",
        enrollDate,
      })
      resetForm()
      setSheetOpen(false)
    } catch {
      setError("حدث خطأ أثناء الإضافة")
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
    s.name.toLowerCase().includes(search.toLowerCase())
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
        {filteredStudents.map((s) => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-sm">{s.name} ({s.age} سنة)</p>
                <p className="text-xs text-gray-500">{s.className} — {s.level}</p>
                <p className="text-xs text-gray-400">ولي الأمر: {s.parentPhone}</p>
              </div>
              <button onClick={() => handleDelete(s.id)} className="text-red-600 text-xs">
                حذف
              </button>
            </div>
            {renderBadge(s.id)}
          </div>
        ))}
        {filteredStudents.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">
            {search ? "لا توجد نتائج" : "لا يوجد طلاب بعد"}
          </p>
        )}
      </div>

      <FAB onClick={() => setSheetOpen(true)} />

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="إضافة طالب">
        <form onSubmit={handleAdd} className="space-y-3">
          <input
            placeholder="الاسم الكامل"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="السن"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="رقم هاتف ولي الأمر"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="المستوى القرآني"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
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
            value={enrollDate}
            onChange={(e) => setEnrollDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button type="submit" className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium">
            إضافة طالب
          </button>
        </form>
      </BottomSheet>
    </div>
  )
}
