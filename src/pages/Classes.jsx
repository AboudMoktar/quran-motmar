import { useEffect, useState } from "react"
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from "firebase/firestore"
import { db } from "../firebase"

export default function Classes() {
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [name, setName] = useState("")
  const [level, setLevel] = useState("")
  const [teacherId, setTeacherId] = useState("")
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

  const handleAdd = async (e) => {
    e.preventDefault()
    setError("")
    if (!name.trim() || !teacherId) {
      setError("يرجى إدخال اسم القسم واختيار المعلم")
      return
    }
    const teacher = teachers.find((t) => t.id === teacherId)
    try {
      await addDoc(collection(db, "classes"), {
        name: name.trim(),
        level: level.trim(),
        teacherId,
        teacherName: teacher?.name || "",
      })
      setName("")
      setLevel("")
      setTeacherId("")
    } catch {
      setError("حدث خطأ أثناء الإضافة")
    }
  }

  const handleDelete = async (id) => {
    if (confirm("هل تريد حذف هذا القسم؟")) {
      await deleteDoc(doc(db, "classes", id))
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">الأقسام</h2>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 mb-6 space-y-3">
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
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <button type="submit" className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium">
          إضافة قسم
        </button>
      </form>

      <div className="space-y-2">
        {classes.map((c) => (
          <div key={c.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{c.name}</p>
              <p className="text-xs text-gray-500">{c.level} — {c.teacherName}</p>
            </div>
            <button onClick={() => handleDelete(c.id)} className="text-red-600 text-xs">
              حذف
            </button>
          </div>
        ))}
        {classes.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">لا توجد أقسام بعد</p>
        )}
      </div>
    </div>
  )
}
