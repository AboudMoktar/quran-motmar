import { useEffect, useState } from "react"
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from "firebase/firestore"
import { db } from "../firebase"

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
      setName("")
      setLevel("")
      setTeacherId("")
      setDays([])
      setTime("")
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
    keys.map((k) => DAYS.find((d) => d.key === k)?.label).join("، ")

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
          placeholder="المستو
