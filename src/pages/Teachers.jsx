import { useEffect, useState } from "react"
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore"
import { createUserWithEmailAndPassword, signOut } from "firebase/auth"
import { Search, Eye, EyeOff, Pencil } from "lucide-react"
import { db, secondaryAuth, LOGIN_DOMAIN } from "../firebase"
import FAB from "../components/FAB"
import BottomSheet from "../components/BottomSheet"
import { logActivity } from "../utils/activityLog"

const ONLINE_WINDOW_MS = 5 * 60 * 1000
const ROLE_LABELS = { staff: "إداري", teacher: "معلم" }

function isOnline(lastActive) {
  return !!lastActive && Date.now() - lastActive < ONLINE_WINDOW_MS
}

const emptyForm = { username: "", password: "", name: "", phone: "", role: "teacher" }

export default function Teachers() {
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "in", ["teacher", "staff"]))
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowPassword(false)
    setError("")
    setSheetOpen(true)
  }

  const openEdit = (m) => {
    setEditingId(m.id)
    setForm({ username: m.username || "", password: "", name: m.name || "", phone: m.phone || "", role: m.role })
    setShowPassword(false)
    setError("")
    setSheetOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (editingId) {
      if (!form.name.trim()) {
        setError("يرجى إدخال الاسم")
        return
      }
      try {
        await updateDoc(doc(db, "users", editingId), {
          name: form.name.trim(),
          phone: form.phone.trim(),
          role: form.role,
        })
        logActivity("تعديل عضو", form.name.trim())
        setSheetOpen(false)
      } catch {
        setError("حدث خطأ أثناء الحفظ")
      }
      return
    }

    const cleanUsername = form.username.trim().toLowerCase()
    if (!cleanUsername || !form.password || !form.name.trim()) {
      setError("يرجى ملء اسم المستخدم وكلمة المرور والاسم")
      return
    }
    if (form.password.length < 6) {
      setError("يجب أن تتكون كلمة المرور من 6 أحرف على الأقل")
      return
    }

    setLoading(true)
    try {
      const email = `${cleanUsername}@${LOGIN_DOMAIN}`
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, form.password)

      await setDoc(doc(db, "users", cred.user.uid), {
        role: form.role,
        username: cleanUsername,
        name: form.name.trim(),
        phone: form.phone.trim(),
      })

      await signOut(secondaryAuth)
      logActivity("إضافة عضو", `${form.name.trim()} (${ROLE_LABELS[form.role]})`)
      setSheetOpen(false)
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("اسم المستخدم مستخدم بالفعل")
      } else {
        setError("حدث خطأ أثناء الإضافة")
      }
    }
    setLoading(false)
  }

  const handleDelete = async (m) => {
    if (confirm("هل تريد حذف هذا العضو من الفريق؟")) {
      await deleteDoc(doc(db, "users", m.id))
      logActivity("حذف عضو", m.name)
    }
  }

  const filteredMembers = members.filter((m) =>
    (m.name || "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">الفريق</h2>

      <div className="relative mb-4">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="بحث..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg pr-10 pl-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        {filteredMembers.map((m) => (
          <div key={m.id} className="bg-white rounded-xl shadow-sm p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{m.name}</p>
                  {isOnline(m.lastActive) && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      متصل الآن
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">@{m.username} — {m.phone}</p>
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 mt-1">
                  {ROLE_LABELS[m.role] || m.role}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => openEdit(m)} className="text-emerald-700">
                  <Pencil size={16} />
                </button>
                <button onClick={() => handleDelete(m)} className="text-red-600 text-xs">
                  حذف
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredMembers.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">
            {search ? "لا توجد نتائج" : "لا يوجد أعضاء بعد"}
          </p>
        )}
      </div>

      <FAB onClick={openAdd} />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? "تعديل عضو" : "إضافة عضو"}
        footer={
          <button
            type="submit"
            form="member-form"
            disabled={loading}
            className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
          >
            {loading ? "جارٍ الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة"}
          </button>
        }
      >
        <form id="member-form" onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-gray-500">نوع الحساب</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, role: "teacher" })}
              className={`flex-1 py-2 rounded-lg text-sm border ${
                form.role === "teacher" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-600 border-gray-300"
              }`}
            >
              معلم
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, role: "staff" })}
              className={`flex-1 py-2 rounded-lg text-sm border ${
                form.role === "staff" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-600 border-gray-300"
              }`}
            >
              إداري (صلاحيات كاملة)
            </button>
          </div>

          {!editingId && (
            <>
              <input
                placeholder="اسم المستخدم (تسجيل الدخول)"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="كلمة المرور"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 pl-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </>
          )}

          <input
            placeholder="الاسم الكامل"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="رقم الهاتف"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </form>
      </BottomSheet>
    </div>
  )
}
