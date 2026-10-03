import { useEffect, useState } from "react"
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { ASSOCIATION_NAME, BRANCH_LABEL } from "../config"
import { getMonthlyFee } from "./Settings"
import { classTimeLabel } from "./Classes"
import { getSessionsForClass, buildReviewMessage } from "../utils/classNotebook"

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"]
const MONTH_LABELS = {
  "01": "جانفي", "02": "فيفري", "03": "مارس", "04": "أفريل",
  "05": "ماي", "06": "جوان", "07": "جويلية", "08": "أوت",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر"
}
const LOW_ATTENDANCE_THRESHOLD = 70

const DAYS_LABELS = {
  sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء",
  thu: "الخميس", fri: "الجمعة", sat: "السبت"
}

const DAY_KEYS_BY_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

function classScheduleLine(cls) {
  if (!cls) return ""
  const days = (cls.days || []).map((d) => DAYS_LABELS[d]).join(" - ")
  const time = classTimeLabel(cls)
  return [days, time].filter(Boolean).join(" — ")
}

function dayNameForDate(dateStr) {
  if (!dateStr) return ""
  const idx = new Date(`${dateStr}T00:00:00`).getDay()
  return DAYS_LABELS[DAY_KEYS_BY_INDEX[idx]] || ""
}

// Formats a Date as a local YYYY-MM-DD string. toISOString() converts to UTC
// first, which silently rolls the date back by one day for any positive UTC
// offset (e.g. Tunisia, UTC+1) whenever it's applied to a local midnight —
// exactly the bug that made "the next Sunday" come out as a Saturday.
function toLocalISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// Finds the soonest date (today or later) that falls on one of the class's
// scheduled days, so the announcement date follows the قسم's own timetable
// instead of being picked manually every time.
function nextSessionDate(cls) {
  if (!cls || !(cls.days || []).length) return ""
  const scheduledIndices = cls.days.map((d) => DAY_KEYS_BY_INDEX.indexOf(d)).filter((i) => i >= 0)
  if (scheduledIndices.length === 0) return ""
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    if (scheduledIndices.includes(d.getDay())) return toLocalISODate(d)
  }
  return ""
}

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
  return toLocalISODate(d)
}

export default function Messages() {
  const [classes, setClasses] = useState([])
  const [startClassId, setStartClassId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [startText, setStartText] = useState("")
  const [startEdited, setStartEdited] = useState(false)
  const [startCopied, setStartCopied] = useState(false)
  const [numbersCopied, setNumbersCopied] = useState(false)
  const [enrolledRecipients, setEnrolledRecipients] = useState([])
  const [loadingEnrolled, setLoadingEnrolled] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    })
    return unsub
  }, [])

  const startClass = classes.find((c) => c.id === startClassId)

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
  const [absenceTo, setAbsenceTo] = useState(toLocalISODate(now))
  const [absenceText, setAbsenceText] = useState("")
  const [absenceEdited, setAbsenceEdited] = useState(false)
  const [absenceCopied, setAbsenceCopied] = useState(false)
  const [absenceNumbersCopied, setAbsenceNumbersCopied] = useState(false)
  const [loadingAbsence, setLoadingAbsence] = useState(false)
  const [absenceRecipients, setAbsenceRecipients] = useState([])
  const [absenceIncludeNames, setAbsenceIncludeNames] = useState(false)

  // رسالة مراجعة حسب القسم (المرحلة 8) — تُبنى انطلاقًا من حصة محدَّدة من
  // كراس القسم (المرحلة 7)، ثم يختار المستخدم المستلمين، ولا تُرسل أي رسالة
  // إلا بعد تأكيد نهائي صريح.
  const [reviewClassId, setReviewClassId] = useState("")
  const [reviewSessions, setReviewSessions] = useState([])
  const [loadingReviewSessions, setLoadingReviewSessions] = useState(false)
  const [reviewSessionDate, setReviewSessionDate] = useState("")
  const [reviewText, setReviewText] = useState("")
  const [reviewStudents, setReviewStudents] = useState([]) // طلبة القسم الذين لهم رقم هاتف ولي صالح
  const [loadingReviewStudents, setLoadingReviewStudents] = useState(false)
  const [reviewRecipientMode, setReviewRecipientMode] = useState("all") // "all" | "selected"
  const [reviewSelectedIds, setReviewSelectedIds] = useState(new Set())
  const [reviewError, setReviewError] = useState("")
  const [reviewCopied, setReviewCopied] = useState(false)
  const [reviewNumbersCopied, setReviewNumbersCopied] = useState(false)

  // نوع الرسالة المختار حاليًا — الصفحة أصبحت كتلة واحدة تعرض فقط حقول
  // النوع المختار، بدل خمس بطاقات معروضة كلها في آن واحد.
  const [messageType, setMessageType] = useState("start")

  // رسالة مخصصة (جديدة) — نص حرّ + اختيار المستلمين من قائمة كل الطلاب
  // (الكل محدَّد افتراضيًا، مع إمكانية إلغاء تحديد من لا يُراد مراسلته).
  const [customText, setCustomText] = useState("")
  const [customSearch, setCustomSearch] = useState("")
  const [customStudents, setCustomStudents] = useState([])
  const [customSelectedIds, setCustomSelectedIds] = useState(new Set())
  const [loadingCustomStudents, setLoadingCustomStudents] = useState(false)
  const [customLoaded, setCustomLoaded] = useState(false)
  const [customError, setCustomError] = useState("")
  const [customCopied, setCustomCopied] = useState(false)
  const [customNumbersCopied, setCustomNumbersCopied] = useState(false)

  useEffect(() => {
    getMonthlyFee().then(setMonthlyFee)
  }, [])

  const defaultStartMessage = () => {
    const className = startClass?.name || "القسم"
    const dayLabel = startDate ? dayNameForDate(startDate) : "اليوم المحدد"
    const timeFrom = startClass?.timeFrom || startClass?.time || ""
    const timeTo = startClass?.timeTo || ""
    const timeLine = timeFrom && timeTo
      ? `من الساعة ${timeFrom} إلى ${timeTo}`
      : timeFrom
        ? `الساعة ${timeFrom}`
        : "حسب التوقيت المعتاد"
    return [
      `السلام عليكم ورحمة الله وبركاته،`,
      `أولياء الأمور الكرام،`,
      `نعلمكم أن حصة قسم «${className}» بـ${BRANCH_LABEL}، التابع لـ${ASSOCIATION_NAME}، ستُقام في موعدها المحدد.`,
      `📅 اليوم: ${dayLabel}`,
      `🕝 التوقيت: ${timeLine}`,
      ``,
      `بارك الله فيكم وجزاكم خيرًا.`,
    ].join("\n")
  }

  // Selecting a قسم automatically picks the next date matching its own
  // scheduled days, instead of relying on a manually-typed date.
  const handleStartClassChange = (id) => {
    setStartClassId(id)
    setEnrolledRecipients([])
    const cls = classes.find((c) => c.id === id)
    const suggested = nextSessionDate(cls)
    if (suggested) setStartDate(suggested)
  }

  const startDayMismatch =
    startClass && startDate && (startClass.days || []).length > 0 &&
    !(startClass.days || []).includes(DAY_KEYS_BY_INDEX[new Date(`${startDate}T00:00:00`).getDay()])

  useEffect(() => {
    if (!startEdited) setStartText(defaultStartMessage())
  }, [startDate, startClassId, classes]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!startClassId) return []
    if (enrolledRecipients.length > 0) return enrolledRecipients
    setLoadingEnrolled(true)
    try {
      const snap = await getDocs(query(collection(db, "students"), where("classId", "==", startClassId)))
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

  // اختيار القسم يحمّل حصصه (من كراس القسم) وطلبته (لأرقام هواتف الأولياء).
  const handleReviewClassChange = async (id) => {
    setReviewClassId(id)
    setReviewSessionDate("")
    setReviewText("")
    setReviewError("")
    setReviewRecipientMode("all")
    setReviewSelectedIds(new Set())
    setReviewSessions([])
    setReviewStudents([])
    if (!id) return

    setLoadingReviewSessions(true)
    setLoadingReviewStudents(true)
    try {
      const [sessions, studentsSnap] = await Promise.all([
        getSessionsForClass(id),
        getDocs(query(collection(db, "students"), where("classId", "==", id))),
      ])
      setReviewSessions(sessions)
      const students = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => !s.deletedAt && s.active !== false && s.parentPhone && s.parentPhone.trim())
      setReviewStudents(students)
    } catch {
      setReviewError("تعذّر تحميل حصص هذا القسم")
    }
    setLoadingReviewSessions(false)
    setLoadingReviewStudents(false)
  }

  // اختيار حصة يولّد نص الرسالة تلقائيًا انطلاقًا من دروسها (نفس
  // buildReviewMessage المستعملة في كراس القسم).
  const handleReviewSessionChange = (date) => {
    setReviewSessionDate(date)
    setReviewError("")
    const session = reviewSessions.find((s) => s.date === date)
    setReviewText(session ? buildReviewMessage(session) : "")
  }

  const resetReviewText = () => {
    const session = reviewSessions.find((s) => s.date === reviewSessionDate)
    if (session) setReviewText(buildReviewMessage(session))
  }

  const toggleReviewStudent = (id) => {
    setReviewSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const reviewRecipients = () =>
    (reviewRecipientMode === "all" ? reviewStudents : reviewStudents.filter((s) => reviewSelectedIds.has(s.id)))
      .map((s) => ({ name: s.name, phone: s.parentPhone.trim() }))

  // إرسال فعلي فقط بعد تأكيد صريح من المستخدم (يذكر عدد المستلمين)، تمامًا
  // كما تنص المواصفات: "لا ترسل أي رسالة دون تأكيد نهائي من المستخدم".
  const handleReviewConfirmSend = () => {
    setReviewError("")
    const recipients = reviewRecipients()
    if (recipients.length === 0) {
      setReviewError("لا يوجد مستلمون بأرقام هواتف صالحة ضمن الاختيار الحالي")
      return
    }
    if (!confirm(`سيتم فتح تطبيق الرسائل لإرسال هذا النص إلى ${recipients.length} ولي أمر. هل تريد المتابعة؟`)) return
    openSms(recipients.map((r) => r.phone), reviewText)
  }

  // يُحمَّل مرة واحدة فقط عند أول اختيار لنوع "رسالة مخصصة"، وليس في كل
  // مرة — بنفس أسلوب enrolledRecipients في القسم الأول.
  const loadCustomStudents = async () => {
    if (customLoaded) return
    setLoadingCustomStudents(true)
    setCustomError("")
    try {
      const snap = await getDocs(collection(db, "students"))
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => !s.deletedAt && s.active !== false && s.parentPhone && s.parentPhone.trim())
        .map((s) => ({ id: s.id, name: s.name, phone: s.parentPhone.trim(), className: s.className || "" }))
      setCustomStudents(list)
      setCustomSelectedIds(new Set(list.map((s) => s.id))) // الكل محدَّد افتراضيًا
      setCustomLoaded(true)
    } catch {
      setCustomError("تعذّر تحميل قائمة الطلاب")
    }
    setLoadingCustomStudents(false)
  }

  useEffect(() => {
    if (messageType === "custom") loadCustomStudents()
  }, [messageType]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCustomStudent = (id) => {
    setCustomSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllCustom = () => setCustomSelectedIds(new Set(customStudents.map((s) => s.id)))
  const deselectAllCustom = () => setCustomSelectedIds(new Set())

  const customFilteredStudents = customStudents.filter((s) =>
    (s.name || "").toLowerCase().includes(customSearch.toLowerCase())
  )

  const customRecipients = () => customStudents.filter((s) => customSelectedIds.has(s.id))

  // إرسال فعلي فقط بعد تأكيد صريح يذكر عدد المستلمين، بنفس مبدأ رسالة
  // المراجعة حسب القسم.
  const handleCustomConfirmSend = () => {
    setCustomError("")
    if (!customText.trim()) {
      setCustomError("يرجى كتابة نص الرسالة")
      return
    }
    const recipients = customRecipients()
    if (recipients.length === 0) {
      setCustomError("لم يتم اختيار أي مستلم")
      return
    }
    if (!confirm(`سيتم فتح تطبيق الرسائل لإرسال هذا النص إلى ${recipients.length} ولي أمر. هل تريد المتابعة؟`)) return
    openSms(recipients.map((r) => r.phone), customText)
  }

  const handleCustomCopyNumbers = () => {
    const recipients = customRecipients()
    if (recipients.length === 0) {
      setCustomError("لم يتم اختيار أي مستلم")
      return
    }
    copyText(recipients.map((r) => r.phone).join(", "), () => {
      setCustomNumbersCopied(true)
      setTimeout(() => setCustomNumbersCopied(false), 2500)
    })
  }

  const handleReviewCopyNumbers = () => {
    const recipients = reviewRecipients()
    if (recipients.length === 0) {
      setReviewError("لا يوجد مستلمون بأرقام هواتف صالحة ضمن الاختيار الحالي")
      return
    }
    copyText(recipients.map((r) => r.phone).join(", "), () => {
      setReviewNumbersCopied(true)
      setTimeout(() => setReviewNumbersCopied(false), 2500)
    })
  }

  const MESSAGE_TYPES = [
    { id: "start", label: "📅 موعد الحصة" },
    { id: "payment", label: "💳 تذكير الاشتراك" },
    { id: "absence", label: "📋 تذكير الغياب" },
    { id: "review", label: "📖 رسالة مراجعة حسب القسم" },
    { id: "custom", label: "✉️ رسالة مخصصة" },
  ]

  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">الرسائل</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3 border-t-4 border-gold-500">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">نوع الرسالة</p>
        <select
          value={messageType}
          onChange={(e) => setMessageType(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-medium dark:bg-gray-700 dark:text-white"
        >
          {MESSAGE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">

        {messageType === "start" && (
        <>
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">إعلام أولياء الأمور بموعد الحصة (لكل قسم)</p>
        <select
          value={startClassId}
          onChange={(e) => handleStartClassChange(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="">اختر القسم</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {startClass && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            أيام وأوقات حصص هذا القسم: {classScheduleLine(startClass) || "غير محددة"}
          </p>
        )}
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        />
        {startDayMismatch && (
          <p className="text-red-600 dark:text-red-400 text-xs">
            تنبيه: هذا التاريخ ({dayNameForDate(startDate)}) ليس من أيام حصص هذا القسم
          </p>
        )}
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
          المستلمون: أولياء أمور طلاب هذا القسم فقط ({enrolledRecipients.length > 0 ? `${enrolledRecipients.length} رقم` : startClassId ? "سيتم تحميلهم عند الإرسال" : "اختر قسماً أولاً"})
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleStartSms}
            disabled={loadingEnrolled || !startClassId}
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
          disabled={!startClassId}
          className="w-full text-emerald-700 dark:text-emerald-400 text-xs py-1 disabled:opacity-60"
        >
          {numbersCopied ? "تم نسخ الأرقام ✓" : "نسخ أرقام الهواتف (احتياطي)"}
        </button>
        </>
        )}

        {messageType === "payment" && (
        <>
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
        </>
        )}

        {messageType === "absence" && (
        <>
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
        </>
        )}

        {messageType === "review" && (
        <>
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">📱 رسالة مراجعة حسب القسم</p>
        <select
          value={reviewClassId}
          onChange={(e) => handleReviewClassChange(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        >
          <option value="">اختر القسم</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {reviewClassId && loadingReviewSessions && (
          <p className="text-xs text-gray-400 dark:text-gray-500">جارٍ تحميل حصص هذا القسم...</p>
        )}

        {reviewClassId && !loadingReviewSessions && (
          <select
            value={reviewSessionDate}
            onChange={(e) => handleReviewSessionChange(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          >
            <option value="">اختر الحصة أو الدرس المطلوب الاعتماد عليه</option>
            {reviewSessions.map((s) => (
              <option key={s.date} value={s.date}>
                {dayNameForDate(s.date)} {s.date} — {(s.lessons || []).length} دروس
              </option>
            ))}
            {reviewSessions.length === 0 && <option value="" disabled>لا توجد حصص مسجّلة لهذا القسم</option>}
          </select>
        )}

        {reviewSessionDate && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">نص الرسالة (قابل للتعديل)</p>
              <button onClick={resetReviewText} className="text-xs text-emerald-700 dark:text-emerald-400">
                استعادة النص الافتراضي
              </button>
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            />

            <p className="text-xs text-gray-500 dark:text-gray-400">المستلمون</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReviewRecipientMode("all")}
                className={`flex-1 py-2 rounded-lg text-xs border ${
                  reviewRecipientMode === "all" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                }`}
              >
                جميع أولياء القسم
              </button>
              <button
                type="button"
                onClick={() => setReviewRecipientMode("selected")}
                className={`flex-1 py-2 rounded-lg text-xs border ${
                  reviewRecipientMode === "selected" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                }`}
              >
                طلبة محددين
              </button>
            </div>

            {loadingReviewStudents && (
              <p className="text-xs text-gray-400 dark:text-gray-500">جارٍ تحميل طلبة القسم...</p>
            )}

            {reviewRecipientMode === "selected" && !loadingReviewStudents && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                {reviewStudents.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={reviewSelectedIds.has(s.id)}
                      onChange={() => toggleReviewStudent(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
                {reviewStudents.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">
                    لا يوجد طلبة لهذا القسم لهم رقم هاتف ولي مسجّل
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {reviewRecipientMode === "all"
                ? `${reviewStudents.length} رقم (كل أولياء القسم)`
                : `${reviewSelectedIds.size} طالب مختار`}
            </p>

            {reviewError && <p className="text-red-600 dark:text-red-400 text-xs">{reviewError}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleReviewConfirmSend}
                className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm"
              >
                ✅ تأكيد الإرسال
              </button>
              <button
                onClick={() => copyText(reviewText, () => { setReviewCopied(true); setTimeout(() => setReviewCopied(false), 2500) })}
                className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm"
              >
                {reviewCopied ? "تم النسخ ✓" : "نسخ النص"}
              </button>
            </div>
            <button
              onClick={handleReviewCopyNumbers}
              className="w-full text-emerald-700 dark:text-emerald-400 text-xs py-1"
            >
              {reviewNumbersCopied ? "تم نسخ الأرقام ✓" : "نسخ أرقام الهواتف (احتياطي)"}
            </button>
          </>
        )}
        </>
        )}

        {messageType === "custom" && (
        <>
        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">✉️ رسالة مخصصة</p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">نص الرسالة</p>
        </div>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          rows={6}
          placeholder="اكتب نص الرسالة هنا..."
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
        />

        <p className="text-xs text-gray-500 dark:text-gray-400">
          المستلمون (الكل محدَّد افتراضيًا — يمكن إلغاء تحديد من لا تريد مراسلته)
        </p>

        {loadingCustomStudents && (
          <p className="text-xs text-gray-400 dark:text-gray-500">جارٍ تحميل قائمة الطلاب...</p>
        )}

        {!loadingCustomStudents && customStudents.length > 0 && (
          <>
            <input
              value={customSearch}
              onChange={(e) => setCustomSearch(e.target.value)}
              placeholder="بحث عن طالب..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs dark:bg-gray-700 dark:text-white"
            />
            <div className="flex gap-2">
              <button type="button" onClick={selectAllCustom} className="flex-1 text-xs py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                تحديد الكل
              </button>
              <button type="button" onClick={deselectAllCustom} className="flex-1 text-xs py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                إلغاء تحديد الكل
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
              {customFilteredStudents.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={customSelectedIds.has(s.id)}
                    onChange={() => toggleCustomStudent(s.id)}
                  />
                  {s.name} <span className="text-gray-400 dark:text-gray-500">— {s.className}</span>
                </label>
              ))}
              {customFilteredStudents.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">لا توجد نتائج</p>
              )}
            </div>
          </>
        )}

        {!loadingCustomStudents && customStudents.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
            لا يوجد طلاب بأرقام هواتف أولياء صالحة
          </p>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          {customSelectedIds.size} من {customStudents.length} مستلم مختار
        </p>

        {customError && <p className="text-red-600 dark:text-red-400 text-xs">{customError}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleCustomConfirmSend}
            className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm"
          >
            ✅ تأكيد الإرسال
          </button>
          <button
            onClick={() => copyText(customText, () => { setCustomCopied(true); setTimeout(() => setCustomCopied(false), 2500) })}
            className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm"
          >
            {customCopied ? "تم النسخ ✓" : "نسخ النص"}
          </button>
        </div>
        <button
          onClick={handleCustomCopyNumbers}
          className="w-full text-emerald-700 dark:text-emerald-400 text-xs py-1"
        >
          {customNumbersCopied ? "تم نسخ الأرقام ✓" : "نسخ أرقام الهواتف (احتياطي)"}
        </button>
        </>
        )}

        </div>
      </div>
    </div>
  )
}
