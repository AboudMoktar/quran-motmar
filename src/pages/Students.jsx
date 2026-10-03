import { useEffect, useRef, useState } from "react"
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from "firebase/firestore"
import * as XLSX from "xlsx"
import { Search, Pencil, Phone, Upload, Download, X } from "lucide-react"
import { db } from "../firebase"
import FAB from "../components/FAB"
import BottomSheet from "../components/BottomSheet"
import FloatingInput from "../components/FloatingInput"
import FloatingSelect from "../components/FloatingSelect"
import { logActivity } from "../utils/activityLog"
import { useAuth } from "../context/AuthContext"

// Local-timezone-safe equivalent of `date.toISOString().slice(0, 10)` —
// toISOString() converts to UTC first, which shifts the calendar day back
// by one between local midnight and 1am in Tunisia (UTC+1). Only for
// "now" lookups below — NOT for toDateString()'s Date-object branch,
// where the xlsx library already builds its dates in UTC, so
// toISOString() there is the correct read, not a bug.
function toLocalISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function calculateAge(birthDate) {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

const emptyForm = {
  firstName: "",
  lastName: "",
  birthDate: "",
  parentName: "",
  parentPhone: "",
  level: "",
  classId: "",
  enrollDate: toLocalISODate(new Date()),
  active: true,
}

const CLASS_CAPACITY = 20

// Column header variants accepted in the imported Excel file (matched trimmed/lowercased)
const COLUMN_ALIASES = {
  firstName: ["الإسم", "الاسم", "firstname", "first name"],
  lastName: ["اللقب", "lastname", "last name", "surname"],
  birthDate: ["تاريخ الولادة", "birthdate", "birth date"],
  parentName: ["اسم الولي", "ولي الأمر", "parent", "parentname"],
  parentPhone: ["هاتف الولي", "رقم هاتف الولي", "رقم الهاتف", "phone", "parentphone"],
  level: ["المستوى", "المستوى القرآني", "مقدار الحفظ", "level"],
  className: ["القسم", "الفصل", "class", "classname"],
  enrollDate: ["تاريخ التسجيل", "enrolldate", "enroll date"],
  active: ["نشط", "الحالة", "active", "status"],
}

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase()
}

function findValue(row, field) {
  const aliases = COLUMN_ALIASES[field].map(normalizeHeader)
  for (const key of Object.keys(row)) {
    if (aliases.includes(normalizeHeader(key))) return row[key]
  }
  return undefined
}

function toDateString(value) {
  if (!value) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const str = String(value).trim()
  // Already looks like YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  // DD/MM/YYYY or DD-MM-YYYY
  const m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  }
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return ""
}

function toActiveBool(value) {
  if (value === undefined || value === "") return true
  const str = String(value).trim().toLowerCase()
  if (["لا", "غير نشط", "false", "0", "no", "inactive"].includes(str)) return false
  return true
}

export default function Students() {
  const { isAdminLevel } = useAuth()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [todayStatus, setTodayStatus] = useState({})
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")

  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "students"), (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => !s.deletedAt))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    })
    return unsub
  }, [])

  useEffect(() => {
    const today = toLocalISODate(new Date())
    const q = query(collection(db, "attendance"), where("date", "==", today))
    const unsub = onSnapshot(q, (snap) => {
      const map = {}
      snap.docs.forEach((d) => {
        const records = d.data().records || {}
        Object.keys(records).forEach((studentId) => {
          map[studentId] = records[studentId]
        })
      })
      setTodayStatus(map)
    })
    return unsub
  }, [])

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError("")
    setSheetOpen(true)
  }

  const openEdit = (s) => {
    setEditingId(s.id)
    setForm({
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      birthDate: s.birthDate || "",
      parentName: s.parentName || "",
      parentPhone: s.parentPhone || "",
      level: s.level || "",
      classId: s.classId || "",
      enrollDate: s.enrollDate || toLocalISODate(new Date()),
      active: s.active !== undefined ? s.active : true,
    })
    setError("")
    setSheetOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate || !form.classId) {
      setError("يرجى إدخال الإسم واللقب وتاريخ الولادة واختيار القسم")
      return
    }
    const cls = classes.find((c) => c.id === form.classId)
    const firstName = form.firstName.trim().replace(/\s+/g, " ")
    const lastName = form.lastName.trim().replace(/\s+/g, " ")
    const fullName = `${firstName} ${lastName}`.trim()
    const currentSeats = students.filter(
      (s) => s.classId === form.classId && !s.waitlisted && s.id !== editingId
    ).length
    const willWaitlist = currentSeats >= CLASS_CAPACITY
    const data = {
      firstName,
      lastName,
      name: fullName,
      birthDate: form.birthDate,
      parentName: form.parentName.trim(),
      parentPhone: form.parentPhone.trim(),
      level: form.level.trim(),
      classId: form.classId,
      className: cls?.name || "",
      enrollDate: form.enrollDate,
      active: form.active,
      waitlisted: willWaitlist,
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, "students", editingId), data)
        logActivity("تعديل طالب", fullName)
      } else {
        await addDoc(collection(db, "students"), { ...data, deletedAt: null })
        logActivity(willWaitlist ? "إضافة طالب (قائمة الانتظار)" : "إضافة طالب", fullName)
      }
      setSheetOpen(false)
      if (willWaitlist) {
        setTimeout(() => alert(`القسم "${cls?.name || ""}" ممتلئ (${CLASS_CAPACITY} طالب) — تمت إضافة الطالب إلى قائمة الانتظار`), 100)
      }
    } catch {
      setError("حدث خطأ أثناء الحفظ")
    }
  }

  const handlePromote = async (s) => {
    const currentSeats = students.filter(
      (x) => x.classId === s.classId && !x.waitlisted && x.id !== s.id
    ).length
    if (currentSeats >= CLASS_CAPACITY) {
      alert(`القسم ممتلئ (${CLASS_CAPACITY} طالب) — لا يمكن الترقية الآن`)
      return
    }
    await updateDoc(doc(db, "students", s.id), { waitlisted: false })
    logActivity("ترقية من قائمة الانتظار", s.name)
  }

  const handleDelete = async (s) => {
    if (confirm("هل تريد نقل هذا الطالب إلى المحذوفات؟ يمكن استعادته خلال 7 أيام.")) {
      await updateDoc(doc(db, "students", s.id), { deletedAt: Date.now() })
      logActivity("نقل طالب إلى المحذوفات", s.name)
    }
  }

  // ---------- Excel import ----------

  const openImport = () => {
    setImportRows([])
    setImportErrors([])
    setImportResult(null)
    setImportOpen(true)
  }

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "الإسم": "محمد",
        "اللقب": "بن علي",
        "تاريخ الولادة": "2015-03-12",
        "اسم الولي": "علي بن علي",
        "هاتف الولي": "20123456",
        "مقدار الحفظ": "جزء عمّ",
        "القسم": classes[0]?.name || "اسم القسم كما هو مسجل في التطبيق",
        "تاريخ التسجيل": toLocalISODate(new Date()),
        "نشط": "نعم",
      },
    ])
    const wb = XLSX.utils.book_new()
    wb.Workbook = { Views: [{ RTL: true }] }
    XLSX.utils.book_append_sheet(wb, ws, "الطلاب")
    XLSX.writeFile(wb, "نموذج_استيراد_الطلاب.xlsx")
  }

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const wb = XLSX.read(data, { type: "array", cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" })

        const existingKey = (name, classId) =>
          `${name.trim().toLowerCase()}|${classId}`
        const existingSet = new Set(
          students.map((s) => existingKey(s.name || "", s.classId || ""))
        )

        const parsed = []
        const errors = []
        const seenInFile = new Set()

        rawRows.forEach((row, idx) => {
          const rowNum = idx + 2 // +1 for header row, +1 for 1-based
          const firstName = String(findValue(row, "firstName") || "").trim().replace(/\s+/g, " ")
          const lastName = String(findValue(row, "lastName") || "").trim().replace(/\s+/g, " ")
          const fullName = `${firstName} ${lastName}`.trim()
          const birthDateRaw = findValue(row, "birthDate")
          const birthDate = toDateString(birthDateRaw)
          const parentName = String(findValue(row, "parentName") || "").trim()
          const parentPhone = String(findValue(row, "parentPhone") || "").trim()
          const level = String(findValue(row, "level") || "").trim()
          const classNameRaw = String(findValue(row, "className") || "").trim()
          const enrollDateRaw = findValue(row, "enrollDate")
          const enrollDate = toDateString(enrollDateRaw) || toLocalISODate(new Date())
          const active = toActiveBool(findValue(row, "active"))

          if (!fullName && !classNameRaw) return // skip fully empty row

          if (!firstName || !lastName) {
            errors.push(`السطر ${rowNum}: الإسم واللقب مطلوبان`)
            return
          }
          if (!birthDate) {
            errors.push(`السطر ${rowNum}: تاريخ الولادة مفقود أو غير صالح`)
            return
          }
          const cls = classes.find(
            (c) => normalizeHeader(c.name) === normalizeHeader(classNameRaw)
          )
          if (!cls) {
            errors.push(`السطر ${rowNum}: القسم "${classNameRaw}" غير موجود في التطبيق`)
            return
          }

          const key = existingKey(fullName, cls.id)
          if (existingSet.has(key) || seenInFile.has(key)) {
            errors.push(`السطر ${rowNum}: "${fullName}" موجود مسبقاً في قسم "${cls.name}" — تم تجاهله`)
            return
          }
          seenInFile.add(key)

          parsed.push({
            firstName,
            lastName,
            name: fullName,
            birthDate,
            parentName,
            parentPhone,
            level,
            classId: cls.id,
            className: cls.name,
            enrollDate,
            active,
          })
        })

        setImportRows(parsed)
        setImportErrors(errors)
      } catch {
        setImportErrors(["تعذّر قراءة الملف. تأكد من أنه بصيغة Excel صحيحة (.xlsx)."])
        setImportRows([])
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  const handleConfirmImport = async () => {
    if (importRows.length === 0) return
    setImporting(true)
    let success = 0
    let failed = 0
    for (const data of importRows) {
      try {
        await addDoc(collection(db, "students"), { ...data, deletedAt: null })
        success++
      } catch {
        failed++
      }
    }
    if (success > 0) {
      logActivity("استيراد طلاب من Excel", `${success} طالب${success > 1 ? "ًا" : ""}`)
    }
    setImportResult({ success, failed })
    setImportRows([])
    setImporting(false)
  }

  const renderTodayBadge = (studentId) => {
    if (!(studentId in todayStatus)) {
      return <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">لم يسجل حضور اليوم</span>
    }
    return todayStatus[studentId]
      ? <span className="text-xs px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">حاضر اليوم</span>
      : <span className="text-xs px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">غائب اليوم</span>
  }

  const renderActiveBadge = (active) =>
    active !== false
      ? <span className="text-xs px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">نشط</span>
      : <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">غير نشط</span>

  const renderWaitlistBadge = (s) =>
    s.waitlisted ? (
      <span className="text-xs px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
        قائمة الانتظار
      </span>
    ) : null

  const formClassSeats = form.classId
    ? students.filter((s) => s.classId === form.classId && !s.waitlisted && s.id !== editingId).length
    : 0

  const filteredStudents = students.filter((s) =>
    (s.name || "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">الطلاب</h2>
        {isAdminLevel && (
          <button
            onClick={openImport}
            className="flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-1.5"
          >
            <Upload size={14} />
            استيراد من Excel
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="بحث عن طالب..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pr-10 pl-3 py-2 text-sm dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div className="space-y-2">
        {filteredStudents.map((s) => {
          const age = calculateAge(s.birthDate)
          return (
            <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {(s.firstName || s.name || "?").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {s.name} {age !== null && `(${age} سنة)`}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => openEdit(s)} className="text-emerald-700 dark:text-emerald-400">
                        <Pencil size={16} />
                      </button>
                      {isAdminLevel && (
                        <button onClick={() => handleDelete(s)} className="text-red-600 dark:text-red-400 text-xs">
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.className} — {s.level}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    الولي: {s.parentName || "-"}
                    {s.parentPhone && (
                      <a href={`tel:${s.parentPhone}`} className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 mr-2">
                        <Phone size={12} /> {s.parentPhone}
                      </a>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                {renderTodayBadge(s.id)}
                {renderActiveBadge(s.active)}
                {renderWaitlistBadge(s)}
                {s.waitlisted && (
                  <button
                    onClick={() => handlePromote(s)}
                    className="text-xs px-2 py-1 rounded-lg bg-emerald-700 text-white"
                  >
                    ترقية من الانتظار
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {filteredStudents.length === 0 && (
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">
            {search ? "لا توجد نتائج" : "لا يوجد طلاب بعد"}
          </p>
        )}
      </div>

      <FAB onClick={openAdd} />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? "تعديل بيانات الطالب" : "إضافة طالب"}
        footer={
          <button type="submit" form="student-form" className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium">
            {editingId ? "حفظ التعديلات" : "إضافة طالب"}
          </button>
        }
      >
        <form id="student-form" onSubmit={handleSubmit} className="space-y-3">
          <FloatingInput
            label="الإسم"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <FloatingInput
            label="اللقب"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <label className="block text-xs text-gray-500 dark:text-gray-400">تاريخ الولادة</label>
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
          {form.birthDate && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">السن: {calculateAge(form.birthDate)} سنة</p>
          )}
          <FloatingInput
            label="اسم الولي"
            value={form.parentName}
            onChange={(e) => setForm({ ...form, parentName: e.target.value })}
          />
          <FloatingInput
            label="رقم هاتف الولي"
            value={form.parentPhone}
            onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
          />
          <FloatingInput
            label="مقدار الحفظ"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
          />
          <FloatingSelect
            label="القسم"
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
          >
            <option value="" hidden></option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </FloatingSelect>
          {form.classId && (
            <p className={`text-xs ${formClassSeats >= CLASS_CAPACITY ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>
              العدد الحالي: {formClassSeats}/{CLASS_CAPACITY}
              {formClassSeats >= CLASS_CAPACITY && " — القسم ممتلئ، سيُضاف الطالب إلى قائمة الانتظار"}
            </p>
          )}
          <label className="block text-xs text-gray-500 dark:text-gray-400">تاريخ التسجيل</label>
          <input
            type="date"
            value={form.enrollDate}
            onChange={(e) => setForm({ ...form, enrollDate: e.target.value })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">حالة الطالب</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, active: true })}
              className={`flex-1 py-2 rounded-lg text-sm border ${
                form.active ? "bg-emerald-700 text-white border-emerald-700" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"
              }`}
            >
              نشط
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, active: false })}
              className={`flex-1 py-2 rounded-lg text-sm border ${
                !form.active ? "bg-gray-600 text-white border-gray-600" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"
              }`}
            >
              غير نشط
            </button>
          </div>
          {error && <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>}
        </form>
      </BottomSheet>

      <BottomSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="استيراد الطلاب من Excel"
        footer={
          importRows.length > 0 ? (
            <button
              onClick={handleConfirmImport}
              disabled={importing}
              className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
            >
              {importing ? "جارٍ الاستيراد..." : `تأكيد استيراد ${importRows.length} طالب`}
            </button>
          ) : null
        }
      >
        <div className="space-y-3">
          {!importResult && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                الأعمدة المطلوبة: الإسم، اللقب، تاريخ الولادة، القسم (يجب أن يطابق اسم قسم موجود في التطبيق).
                يمكن أيضاً إضافة: اسم الولي، هاتف الولي، مقدار الحفظ، تاريخ التسجيل، نشط.
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg py-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <Download size={14} />
                تنزيل نموذج Excel فارغ
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-emerald-700 text-white rounded-lg py-2 text-sm"
              >
                <Upload size={14} />
                اختيار ملف Excel
              </button>

              {importErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                  {importErrors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700 dark:text-red-300">{err}</p>
                  ))}
                </div>
              )}

              {importRows.length > 0 && (
                <div className="space-y-1 max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {importRows.length} طالب جاهز للاستيراد:
                  </p>
                  {importRows.map((r, i) => (
                    <div key={i} className="text-xs text-gray-600 dark:text-gray-300 flex justify-between border-b border-gray-100 dark:border-gray-700 py-1 last:border-0">
                      <span>{r.name}</span>
                      <span className="text-gray-400 dark:text-gray-500">{r.className}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {importResult && (
            <div className="text-center py-4 space-y-2">
              <p className="text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                تم استيراد {importResult.success} طالب بنجاح
              </p>
              {importResult.failed > 0 && (
                <p className="text-red-600 dark:text-red-400 text-xs">
                  فشل استيراد {importResult.failed} سجل
                </p>
              )}
              <button
                onClick={() => setImportOpen(false)}
                className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
              >
                <X size={14} /> إغلاق
              </button>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
