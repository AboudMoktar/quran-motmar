import { useEffect, useState } from "react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "../firebase"
import { MONTHLY_FEE as DEFAULT_FEE } from "../config"

export async function getMonthlyFee() {
  try {
    const snap = await getDoc(doc(db, "settings", "app"))
    if (snap.exists() && snap.data().monthlyFee) {
      return snap.data().monthlyFee
    }
  } catch {
    // ignore, fallback below
  }
  return DEFAULT_FEE
}

export default function Settings() {
  const [fee, setFee] = useState(DEFAULT_FEE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    getMonthlyFee().then((v) => {
      setFee(v)
      setLoading(false)
    })
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")
    try {
      await setDoc(doc(db, "settings", "app"), { monthlyFee: Number(fee) }, { merge: true })
      setMessage("تم الحفظ بنجاح")
    } catch {
      setMessage("حدث خطأ أثناء الحفظ")
    }
    setSaving(false)
    setTimeout(() => setMessage(""), 3000)
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">جارٍ التحميل...</div>
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">الإعدادات</h2>
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm">قيمة الاشتراك الشهري</p>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="relative">
            <input
              type="number"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">د.ت</span>
          </div>
          {message && <p className="text-xs text-emerald-700">{message}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </form>
        <p className="text-xs text-gray-400">
          هذا التغيير يطبق على الاشتراكات الجديدة ورسائل التذكير — لا يغيّر الاشتراكات المسجلة سابقًا.
        </p>
      </div>
    </div>
  )
}
