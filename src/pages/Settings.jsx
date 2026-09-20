import { useEffect, useState } from "react"
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore"
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
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupError, setBackupError] = useState("")

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

  const handleBackup = async () => {
    setBackupLoading(true)
    setBackupError("")
    try {
      const collections = ["classes", "students", "users", "attendance", "payments", "progress"]
      const data = {}
      for (const name of collections) {
        const snap = await getDocs(collection(db, name))
        data[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      }
      data.exportDate = new Date().toISOString()

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `quran-motmar-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setBackupError("حدث خطأ أثناء إنشاء النسخة الاحتياطية")
    }
    setBackupLoading(false)
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500 dark:text-gray-400">جارٍ التحميل...</div>
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">الإعدادات</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">قيمة الاشتراك الشهري</p>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="relative">
            <input
              type="number"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">د.ت</span>
          </div>
          {message && <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </form>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          هذا التغيير يطبق على الاشتراكات الجديدة ورسائل التذكير — لا يغيّر الاشتراكات المسجلة سابقًا.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">نسخة احتياطية من البيانات</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          يقوم هذا الزر بتحميل ملف واحد يحتوي على جميع بيانات التطبيق (الأقسام، الطلاب، الفريق، الحضور، الاشتراكات، التقدم القرآني) كنسخة احتياطية.
        </p>
        {backupError && <p className="text-xs text-red-600 dark:text-red-400">{backupError}</p>}
        <button
          onClick={handleBackup}
          disabled={backupLoading}
          className="w-full bg-gray-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
        >
          {backupLoading ? "جارٍ التحضير..." : "تحميل نسخة احتياطية"}
        </button>
      </div>
    </div>
  )
}
