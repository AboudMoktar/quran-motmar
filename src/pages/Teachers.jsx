import { useEffect, useState } from "react"
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore"
import { createUserWithEmailAndPassword, signOut } from "firebase/auth"
import { db, secondaryAuth, LOGIN_DOMAIN } from "../firebase"

export default function Teachers() {
  const [teachers, setTeachers] = useState([])
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

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

    const cleanUsername = username.trim().toLowerCase()
    if (!cleanUsername || !password || !name.trim()) {
      setError("يرجى ملء اسم المستخدم وكلمة المرور والاسم")
      return
    }
    if (password.length < 6) {
      setError("يجب أن تتكون كلمة المرور من 6 أحرف على الأقل")
      return
    }

    setLoading(true)
    try {
      const email = `${cleanUsername}@${LOGIN_DOMAIN}`
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)

      await setDoc(doc(db, "users", cred.user.uid), {
        role: "teacher",
        username: cleanUsername,
        name: name.trim(),
        phone: phone.trim(),
      })

      await signOut(secondaryAuth)

      setUsername("")
      setPassword("")
      setName("")
      setPhone("")
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("اسم المستخدم مستخدم بالفعل")
      } else {
        setError("حدث خطأ أثناء الإضافة")
      }
    }
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (confirm("هل تريد حذف هذا المعلم من القائمة؟")) {
      await deleteDoc(doc(db, "users", id))
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">المعلمون</h2>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 mb-6 space-y-3">
        <input
          placeholder="اسم المستخدم (تسجيل الدخول)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "جارٍ الإضافة..." : "إضافة معلم"}
        </button>
      </form>

      <div className="space-y-2">
        {teachers.map((t) => (
          <div key={t.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{t.name}</p>
              <p className="text-xs text-gray-500">@{t.username} — {t.phone}</p>
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
