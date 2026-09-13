import { useEffect, useState } from "react"
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore"
import { db } from "../firebase"

export default function Teachers() {
  const [teachers, setTeachers] = useState([])
  const [uid, setUid] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.role === "teacher")
      setTeachers(list)
    })
    return unsub
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setError("")
    if (!uid.trim() || !name.trim()) {
      setError("يرجى إدخال المعرف والاسم")
      return
    }
    try {
      await setDoc(doc(db, "users", uid.trim()), {
        role: "teacher",
        name: name.trim(),
        phone: phone.trim(),
      })
      setUid("")
      setName("")
      setPhone("")
    } catch {
      setError("حدث خطأ أثناء الإضافة")
    }
  }

  const handleDelete = async (id) => {
    if (confirm("هل تريد حذف هذا المعلم؟")) {
      await deleteDoc(doc(db, "users", id))
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">المعلمون</h2>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 mb-6 space-y-3">
        <p className="text-xs text-gray-500">
          أنشئ أولاً حساب المعلم من Firebase Authentication، ثم أدخل معرفه هنا (UID)
        </p>
        <input
          placeholder="معرف المستخدم (UID)"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <input
          placeholder="الاسم الكامل"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <input
          placeholder="رقم الهاتف"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <button type="submit" className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium">
          إضافة معلم
        </button>
      </form>

      <div className="space-y-2">
        {teachers.map((t) => (
          <div key={t.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{t.name}</p>
              <p className="text-xs text-gray-500">{t.phone}</p>
            </div>
            <button onClick={() => handleDelete(t.id)} className="text-red-600 text-xs">
              حذف
            </button>
          </div>
        ))}
        {teachers.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">لا يوجد معلمون بعد</p>
        )}
      </div>
    </div>
  )
}
