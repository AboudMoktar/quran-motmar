import { useEffect, useState } from "react"
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { db } from "../firebase"

function formatDate(ts) {
  const d = new Date(ts)
  return d.toLocaleString("ar-TN", { dateStyle: "medium", timeStyle: "short" })
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [userNames, setUserNames] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [logsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(100))),
        getDocs(collection(db, "users")),
      ])
      const names = {}
      usersSnap.docs.forEach((d) => { names[d.id] = d.data().name })
      setUserNames(names)
      setLogs(logsSnap.docs.map((d) => d.data()))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="text-center py-10 text-gray-500">جارٍ التحميل...</div>
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">سجل النشاط</h2>
      <div className="space-y-2">
        {logs.map((log, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-3">
            <p className="text-sm font-medium">{log.action}</p>
            {log.details && <p className="text-xs text-gray-600 mt-0.5">{log.details}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {userNames[log.userId] || "مستخدم غير معروف"} — {formatDate(log.timestamp)}
            </p>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">لا يوجد نشاط مسجل بعد</p>
        )}
      </div>
    </div>
  )
}
