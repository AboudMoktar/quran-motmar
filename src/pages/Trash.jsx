import { useEffect, useState } from "react"
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { db } from "../firebase"
import { logActivity } from "../utils/activityLog"

const TYPE_LABELS = { students: "طالب", classes: "قسم", users: "عضو فريق" }
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function formatDate(ts) {
  return new Date(ts).toLocaleString("ar-TN", { dateStyle: "medium", timeStyle: "short" })
}

export default function Trash() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const unsubs = ["students", "classes", "users"].map((col) =>
      onSnapshot(collection(db, col), (snap) => {
        setItems((prev) => {
          const others = prev.filter((i) => i.col !== col)
          const deleted = snap.docs
            .map((d) => ({ id: d.id, col, ...d.data() }))
            .filter((d) => d.deletedAt)
          return [...others, ...deleted]
        })
      })
    )
    return () => unsubs.forEach((u) => u())
  }, [])

  const handleRestore = async (item) => {
    await updateDoc(doc(db, item.col, item.id), { deletedAt: null })
    logActivity("استعادة من المحذوفات", item.name || item.username || item.id)
  }

  const handlePermanentDelete = async (item) => {
    if (confirm("هذا الإجراء نهائي ولا يمكن التراجع عنه. هل تريد المتابعة؟")) {
      await deleteDoc(doc(db, item.col, item.id))
      logActivity("حذف نهائي", item.name || item.username || item.id)
    }
  }

  const sorted = [...items].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">المحذوفات</h2>
      <p className="text-xs text-gray-500 mb-4">
        العناصر المحذوفة تُحفظ هنا مؤقتًا ويمكن استعادتها في أي وقت.
      </p>
      <div className="space-y-2">
        {sorted.map((item) => {
          const daysLeft = item.deletedAt
            ? Math.max(0, Math.ceil((item.deletedAt + SEVEN_DAYS_MS - Date.now()) / (24 * 60 * 60 * 1000)))
            : 0
          return (
            <div key={`${item.col}_${item.id}`} className="bg-white rounded-xl shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium">{item.name || item.username}</p>
                  <p className="text-xs text-gray-500">
                    {TYPE_LABELS[item.col]} — حُذف في {formatDate(item.deletedAt)}
                  </p>
                </div>
                <span className="text-xs text-amber-600">{daysLeft} يوم متبقي</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRestore(item)}
                  className="flex-1 bg-emerald-700 text-white rounded-lg py-1.5 text-xs"
                >
                  استعادة
                </button>
                <button
                  onClick={() => handlePermanentDelete(item)}
                  className="flex-1 bg-red-600 text-white rounded-lg py-1.5 text-xs"
                >
                  حذف نهائي
                </button>
              </div>
            </div>
          )
        })}
        {sorted.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">المحذوفات فارغة</p>
        )}
      </div>
    </div>
  )
}
