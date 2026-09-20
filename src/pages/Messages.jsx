import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { ASSOCIATION_NAME, BRANCH_LABEL } from "../config"
import { getMonthlyFee } from "./Settings"

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"]
const MONTH_LABELS = {
  "01": "جانفي", "02": "فيفري", "03": "مارس", "04": "أفريل",
  "05": "ماي", "06": "جوان", "07": "جويلية", "08": "أوت",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر"
}
const LOW_ATTENDANCE_THRESHOLD = 70

function openSms(numbers, text) {
  const url = `sms:${numbers.join(",")}?body=${encodeURIComponent(text)}`
  window.location.href = url
}

function copyText(text, onDone) {
  navigator.clipboard.writeText(text).then(() => onDone())
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function Messages() {
  const [startDate, setStartDate] = useState("")
  const [startText, setStartText] = useState("")
  const [startEdited, setStartEdited] = useState(false)
  const [startCopied, setStartCopied] = useState(false)
  const [numbersCopied, setNumbersCopied] = useState(false)
  const [enrolledRecipients, setEnrolledRecipients] = useState([])
  const [loadingEnrolled, setLoadingEnrolled] = useState(false)

  const now = new Date()
  const [month, setMonth] = useState(MONTHS[now.getMonth()])
  const [year, setYear] = useState(String(now.getFullYear()))
  const [monthlyFee, setMonthlyFee] = useState(null)
  const [paymentText, setPaymentText] = useState("")
  const [paymentEdited, setPaymentEdited] = useState(false)
  const [includeNames, setIncludeNames] = useState(false)
  const [paymentCopied, setPaymentCopied] = useState(false)
  const [paymentNumbersCopied, setPaymentNumbersCopied] = useState(false)
  const [loadingUnpaid, setLoadingUnpaid] = useState(false)
  const [unpaidRecipients, setUnpaidRecipients] = useState([])

  const [absenceFrom, setAbsenceFrom] = useState(daysAgo(30))
  const [absenceTo, setAbsenceTo] = useState(now.toISOString().slice(0, 10))
  const [absenceText, setAbsenceText] = useState("")
  const [absenceEdited, setAbsenceEdited] = useState(false)
  const [absenceCopied, setAbsenceCopied] = useState(false)
  const [absenceNumbersCopied, setAbsenceNumbersCopied] = useState(false)
  const [loadingAbsence, setLoadingAbsence] = useState(false)
  const [absenceRecipients, setAbsenceRecipients] = useState([])
  const [absenceIncludeNames, setAbsenceIncludeNames] = useState(false)

  useEffect(() => {
    getMonthlyFee().then(setMonthlyFee)
  }, [])

  const defaultStartMessage = () => {
    const dateLine = startDate ? `يوم ${startDate}` : ""
    return [
      `السلام عليكم أولياء الأمور الكرام،`,
      ``,
      `نعلمكم أن الدراسة القرآنية ${ASSOCIATION_NAME} ${BRANCH_LABEL} ستنطلق ${dateLine}.`,
      ``,
      `بارك الله فيكم`,
    ].join("\n")
  }

  useEffect(() => {
    if (!startEdited) setStartText(defaultStartMessage())
  }, [startDate])

  const defaultPaymentMessage = (recipients) => {
    if (monthlyFee === null) return ""
    const lines = [
      `السلام عليكم أولياء الأمور الكرام،`,
      ``,
      `نذكركم بضرورة تسديد الاشتراك الشهري لشهر ${MONTH_LABELS[month]} ${year} (${monthlyFee} د.ت) في أقرب وقت ممكن.`,
    ]
    if (includeNames && recipients.length > 0) {
      lines.push(``, `الطلاب المعنيون:`)
      recipients.forEach((r) => lines.push(`- ${r.name}`))
    }
    lines.push(``, `شكرًا لتعاونكم`)
    return lines.join("\n")
  }

  useEffect(() => {
    if (!paymentEdited) setPaymentText(defaultPaymentMessage(unpaidRecipients))
  }, [month, year, includeNames, unpaidRecipients, monthlyFee])

  const defaultAbsenceMessage = (recipients) => {
    const lines = [
      `السلام عليكم أولياء الأمور الكرام،`,
      ``,
      `نلاحظ غيابات متكررة لبعض الطلاب خلال الفترة الأخيرة. نرجو منكم متابعة انتظام أبنائكم في الحصص.`,
    ]
    if (absenceIncludeNames && recipients.length > 0) {
      lines.push(``, `الطلاب المعنيون:`)
      recipients.forEach((r) => lines.push(`- ${r.name} (${r.rate}% حضور)`))
    }
    lines.push(``, `شكرًا لتعاونكم`)
    return lines.join("\n")
  }

  useEffect(() => {
    if (!absenceEdited) setAbsenceText(defaultAbsenceMessage(absenceRecipients))
  }, [absenceIncludeNames, absenceRecipients])

  const loadEnrolled = async () => {
    if (enrolledRecipients.length > 0) return enrolledRecipients
    setLoadingEnrolled(true)
    try {
      const snap = await getDocs(collection(db, "students"))
      const students = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => !s.deletedAt && s.active !== false && s.parentPhone && s.parentPhone.trim())
      const recipients = students.map((s) => ({ name: s.name, phone: s.parentPhone.trim() }))
      setEnrolledRecipients(recipients)
      setLoadingEnrolled(false)
      return recipients
    } catch {
      setLoadingEnrolled(false)
      return []
    }
  }

  const loadUnpaid = async () => {
    setLoadingUnpaid(true)
    try {
      const monthKey = `${year}-${month}`
      const [studentsSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(query(collection(db, "payments"), where("month", "==", monthKey))),
      ])
      const students = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => !s.deletedAt && s.active !== false)
      const paidIds = new Set(paymentsSnap.docs.map((d) => d.data().studentId))
      const unpaid = students.filter((s) => !paidIds.has(s.id) && s.parentPhone && s.parentPhone.trim())
      const recipients = unpaid.map((s) => ({ name: s.name, phone: s.parentPhone.trim() }))
      setUnpaidRecipients(recipients)
      setLoadingUnpaid(false)
      return recipients
    } catch {
      setLoadingUnpaid(false)
      return []
    }
  }

  const loadLowAttendance = async () => {
    setLoadingAbsence(true)
    try {
      const [studentsSnap, attendanceSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "attendance")),
      ])
      const students = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => !s.deletedAt && s.active !== false && s.parentPhone && s.parentPhone.trim())
      const records = attendanceSnap.docs
        .map((d) => d.data())
        .filter((a) => a.date >= absenceFrom && a.date <= absenceTo)

      const result = []
      students.forEach((s) => {
        const effectiveStart = s.enrollDate && s.enrollDate > absenceFrom ? s.enrollDate : absenceFrom
        const marks = records
          .filter((a) => a.date >= effectiveStart && a.records && s.id in a.records)
          .map((a) => a.records[s.id])
        if (marks.length === 0) return
        const present = marks.filter(Boolean).length
        const rate = Math.round((present / marks.length) * 100)
        if (rate < LOW_ATTENDANCE_THRESHOLD) {
          result.push({ name: s.name, phone: s.parentPhone.trim(), rate })
        }
      })
      result.sort((a, b) => a.rate - b.rate)
      setAbsenceRecipients(result)
      setLoadingAbsence(false)
      return result
    } catch {
      setLoadingAbsence(false)
      return []
    }
  }

  const handleStartSms = async () => {
    const recipients = await loadEnrolled()
    openSms(recipients.map((r) => r.phone), startText)
  }

  const handleStartCopyNumbers = async () => {
    const recipients = await loadEnrolled()
    copyText(recipients.map((r) => r.phone).join(", "), () => {
      setNumbersCopied(true)
      setTimeout(() => setNumbersCopied(false), 2500)
    })
  }

  const handlePaymentSms = async () => {
    const recipients = unpaidRecipients.length > 0 ? unpaidRecipients : await loadUnpaid()
    openSms(recipients.map((r) => r.phone), paymentText)
  }

  const handlePaymentCopyNumbers = async () => {
    const recipients = unpaidRecipients.length > 0 ? unpaidRecipients : await loadUnpaid()
    copyText(recipients.map((r) => r.phone).join(", "), () => {
      setPaymentNumbersCopied(true)
      setTimeout(() => setPaymentNumbersCopied(false), 2500)
    })
  }

  const handleAbsenceSms = async () => {
    const recipients = absenceRecipients.length > 0 ? absenceRecipients : await loadLowAttendance()
    openSms(recipients.map((r) => r.phone), absenceText)
  }

  const handleAbsenceCopyNumbers = async () => {
    const recipients = absenceRecipients.length > 0 ? absenceRecipients : await loadLowAttendance()
    copyText(recipients.map((r) => r.phone).join(", "), () => {
      setAbsenceNumbersCopied(true)
      setTimeout(() => setAbsenceNumbersCopied(false), 2500)
    })
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">الرسائل</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">إعلام ببداية الدراسة</p>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">نص الرسالة (قابل للتعديل)</p>
          <button
            onClick={() => { setStartText(defaultStartMessage()); setStartEdited(false) }}
            className="text-xs text-emerald-700 dark:text-emerald-400"
          >
            استعادة النص الافتراضي
          </button>
        </div>
        <textarea
          value={startText}
          onChange={(e) => { setStartText(e.target.value); setStartEdited(true) }}
          rows={6}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          المستلمون: جميع أولياء أمور الطلاب النشطين ({enrolledRecipients.length > 0 ? `${enrolledRecipients.length} رقم` : "سيتم تحميلهم عند الإرسال"})
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleStartSms}
            disabled={loadingEnrolled}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {loadingEnrolled ? "جارٍ التحميل..." : "فتح الرسائل"}
          </button>
          <button
            onClick={() => copyText(startText, () => { setStartCopied(true); setTimeout(() => setStartCopied(false), 2500) })}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm"
          >
            {startCopied ? "تم النسخ ✓" : "نسخ النص"}
          </button>
        </div>
        <button
          onClick={handleStartCopyNumbers}
          className="w-full text-emerald-700 dark:text-emerald-400 text-xs py-1"
        >
          {numbersCopied ? "تم نسخ الأرقام ✓" : "نسخ أرقام الهواتف (احتياطي)"}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">تذكير بالاشتراك الشهري</p>
        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => { setMonth(e.target.value); setUnpaidRecipients([]) }}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{MONTH_LABELS[m]}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => { setYear(e.target.value); setUnpaidRecipients([]) }}
            className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={includeNames}
            onChange={(e) => setIncludeNames(e.target.checked)}
          />
          تضمين أسماء الطلاب في نص الرسالة
        </label>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">نص الرسالة (قابل للتعديل)</p>
          <button
            onClick={() => { setPaymentText(defaultPaymentMessage(unpaidRecipients)); setPaymentEdited(false) }}
            className="text-xs text-emerald-700 dark:text-emerald-400"
          >
            استعادة النص الافتراضي
          </button>
        </div>
        <textarea
          value={paymentText}
          onChange={(e) => { setPaymentText(e.target.value); setPaymentEdited(true) }}
          rows={6}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          المستلمون: أولياء أمور الطلاب غير المسددين ({unpaidRecipients.length > 0 ? `${unpaidRecipients.length} رقم` : "سيتم تحميلهم عند الإرسال"})
        </p>
        <div className="flex gap-2">
          <button
            onClick={handlePaymentSms}
            disabled={loadingUnpaid}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {loadingUnpaid ? "جارٍ التحميل..." : "فتح الرسائل"}
          </button>
          <button
            onClick={() => copyText(paymentText, () => { setPaymentCopied(true); setTimeout(() => setPaymentCopied(false), 2500) })}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm"
          >
            {paymentCopied ? "تم النسخ ✓" : "نسخ النص"}
          </button>
        </div>
        <button
          onClick={handlePaymentCopyNumbers}
          className="w-full text-emerald-700 dark:text-emerald-400 text-xs py-1"
        >
          {paymentNumbersCopied ? "تم نسخ الأرقام ✓" : "نسخ أرقام الهواتف (احتياطي)"}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">تذكير بالغياب المتكرر</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          يشمل الطلاب بنسبة حضور أقل من {LOW_ATTENDANCE_THRESHOLD}% خلال الفترة المحددة
        </p>
        <div className="flex gap-2">
          <input
            type="date"
            value={absenceFrom}
            onChange={(e) => { setAbsenceFrom(e.target.value); setAbsenceRecipients([]) }}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
          <input
            type="date"
            value={absenceTo}
            onChange={(e) => { setAbsenceTo(e.target.value); setAbsenceRecipients([]) }}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={absenceIncludeNames}
            onChange={(e) => setAbsenceIncludeNames(e.target.checked)}
          />
          تضمين أسماء الطلاب ونسبة حضورهم في نص الرسالة
        </label>
        {loadingAbsence && <p className="text-xs text-gray-400 dark:text-gray-500">جارٍ التحميل...</p>}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">نص الرسالة (قابل للتعديل)</p>
          <button
            onClick={() => { setAbsenceText(defaultAbsenceMessage(absenceRecipients)); setAbsenceEdited(false) }}
            className="text-xs text-emerald-700 dark:text-emerald-400"
          >
            استعادة النص الافتراضي
          </button>
        </div>
        <textarea
          value={absenceText}
          onChange={(e) => { setAbsenceText(e.target.value); setAbsenceEdited(true) }}
          rows={6}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          المستلمون: {absenceRecipients.length > 0 ? `${absenceRecipients.length} رقم` : "سيتم تحميلهم عند الإرسال"}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleAbsenceSms}
            disabled={loadingAbsence}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {loadingAbsence ? "جارٍ التحميل..." : "فتح الرسائل"}
          </button>
          <button
            onClick={() => copyText(absenceText, () => { setAbsenceCopied(true); setTimeout(() => setAbsenceCopied(false), 2500) })}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm"
          >
            {absenceCopied ? "تم النسخ ✓" : "نسخ النص"}
          </button>
        </div>
        <button
          onClick={handleAbsenceCopyNumbers}
          className="w-full text-emerald-700 dark:text-emerald-400 text-xs py-1"
        >
          {absenceNumbersCopied ? "تم نسخ الأرقام ✓" : "نسخ أرقام الهواتف (احتياطي)"}
        </button>
      </div>
    </div>
  )
}
