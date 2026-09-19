import { useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { ASSOCIATION_NAME, BRANCH_LABEL, MONTHLY_FEE } from "../config"

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"]
const MONTH_LABELS = {
  "01": "جانفي", "02": "فيفري", "03": "مارس", "04": "أفريل",
  "05": "ماي", "06": "جوان", "07": "جويلية", "08": "أوت",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر"
}

function openWhatsapp(text) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, "_blank")
}

function copyText(text, onDone) {
  navigator.clipboard.writeText(text).then(() => onDone())
}

export default function Messages() {
  const [startDate, setStartDate] = useState("")
  const [startNotes, setStartNotes] = useState("")
  const [startCopied, setStartCopied] = useState(false)

  const now = new Date()
  const [month, setMonth] = useState(MONTHS[now.getMonth()])
  const [year, setYear] = useState(String(now.getFullYear()))
  const [includeNames, setIncludeNames] = useState(false)
  const [paymentCopied, setPaymentCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [unpaidNames, setUnpaidNames] = useState([])

  const buildStartMessage = () => {
    const dateLine = startDate ? `يوم ${startDate}` : ""
    return [
      `السلام عليكم أولياء الأمور الكرام،`,
      ``,
      `نعلمكم أن الدراسة القرآنية ${ASSOCIATION_NAME} ${BRANCH_LABEL} ستنطلق ${dateLine}.`,
      startNotes.trim() ? startNotes.trim() : "",
      ``,
      `بارك الله فيكم`,
    ].filter(Boolean).join("\n")
  }

  const loadUnpaid = async () => {
    setLoading(true)
    try {
      const monthKey = `${year}-${month}`
      const [studentsSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(query(collection(db, "payments"), where("month", "==", monthKey))),
      ])
      const students = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.active !== false)
      const paidIds = new Set(paymentsSnap.docs.map((d) => d.data().studentId))
      const unpaid = students.filter((s) => !paidIds.has(s.id))
      setUnpaidNames(unpaid.map((s) => s.name))
    } catch {
      setUnpaidNames([])
    }
    setLoading(false)
  }

  const buildPaymentMessage = () => {
    const lines = [
      `السلام عليكم أولياء الأمور الكرام،`,
      ``,
      `نذكركم بضرورة تسديد الاشتراك الشهري لشهر ${MONTH_LABELS[month]} ${year} (${MONTHLY_FEE} د.ت) في أقرب وقت ممكن.`,
    ]
    if (includeNames && unpaidNames.length > 0) {
      lines.push(``, `الطلاب المعنيون:`)
      unpaidNames.forEach((n) => lines.push(`- ${n}`))
    }
    lines.push(``, `شكرًا لتعاونكم`)
    return lines.join("\n")
  }

  const handlePaymentAction = async (action) => {
    if (includeNames && unpaidNames.length === 0) {
      await loadUnpaid()
    }
    const text = buildPaymentMessage()
    if (action === "whatsapp") {
      openWhatsapp(text)
    } else {
      copyText(text, () => {
        setPaymentCopied(true)
        setTimeout(() => setPaymentCopied(false), 2500)
      })
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">الرسائل</h2>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm">إعلام ببداية الدراسة</p>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          placeholder="ملاحظات إضافية (اختياري)"
          value={startNotes}
          onChange={(e) => setStartNotes(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-line">
          {buildStartMessage()}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openWhatsapp(buildStartMessage())}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm"
          >
            فتح واتساب
          </button>
          <button
            onClick={() => copyText(buildStartMessage(), () => { setStartCopied(true); setTimeout(() => setStartCopied(false), 2500) })}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm"
          >
            {startCopied ? "تم النسخ ✓" : "نسخ النص"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm">تذكير بالاشتراك الشهري</p>
        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => { setMonth(e.target.value); setUnpaidNames([]) }}
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{MONTH_LABELS[m]}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => { setYear(e.target.value); setUnpaidNames([]) }}
            className="w-24 border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={includeNames}
            onChange={(e) => { setIncludeNames(e.target.checked); setUnpaidNames([]) }}
          />
          تضمين أسماء الطلاب غير المسددين (يُنصح بعدم التفعيل في رسالة جماعية)
        </label>
        {loading && <p className="text-xs text-gray-400">جارٍ التحميل...</p>}
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-line">
          {buildPaymentMessage()}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handlePaymentAction("whatsapp")}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm"
          >
            فتح واتساب
          </button>
          <button
            onClick={() => handlePaymentAction("copy")}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm"
          >
            {paymentCopied ? "تم النسخ ✓" : "نسخ النص"}
          </button>
        </div>
      </div>
    </div>
  )
}
