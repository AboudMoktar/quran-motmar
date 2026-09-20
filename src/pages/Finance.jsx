import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { getMonthlyFee } from "./Settings"
import { MONTHS, monthLabel, monthsInRange, lastDayOfMonth, computeStudentMonth } from "../utils/finance"
import { exportExcelMultiSheet } from "../utils/exportExcel"
import { printMultiSection } from "../utils/printReport"
import { Search } from "lucide-react"

export default function Finance() {
  const [classes, setClasses] = useState([])
  const nowMonthKey = new Date().toISOString().slice(0, 7)
  const [finStart, setFinStart] = useState(nowMonthKey)
  const [finEnd, setFinEnd] = useState(nowMonthKey)
  const [classFilter, setClassFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState(null)

  const [studentQuery, setStudentQuery] = useState("")
  const [selectedStudentId, setSelectedStudentId] = useState("")

  useEffect(() => {
    getDocs(collection(db, "classes")).then((snap) =>
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.deletedAt))
    )
  }, [])

  const loadSummary = async () => {
    if (finStart > finEnd) {
      setError("الشهر الأول يجب أن يكون قبل الشهر الأخير")
      return
    }
    setLoading(true)
    setError("")
    setSelectedStudentId("")
    try {
      const [studentsSnap, classesSnap, paymentsSnap, exemptionsSnap, fee] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "classes")),
        getDocs(query(collection(db, "payments"), where("month", ">=", finStart), where("month", "<=", finEnd))),
        getDocs(query(collection(db, "exemptions"), where("month", ">=", finStart), where("month", "<=", finEnd))),
        getMonthlyFee(),
      ])

      const allStudents = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const studentMap = {}
      allStudents.forEach((s) => { studentMap[s.id] = s })
      const classMap = {}
      classesSnap.docs.forEach((d) => { classMap[d.id] = d.data().name })

      const allPayments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const allExemptions = exemptionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      const months = monthsInRange(finStart, finEnd)
      const activeStudents = allStudents.filter((s) => !s.deletedAt && s.active !== false)

      let totalDue = 0, totalPaid = 0, totalExempted = 0, totalRemaining = 0
      const byMonth = {}
      const byClass = {}
      const statusCounts = { paid: 0, partial: 0, unpaid: 0, exempt: 0 }
      const unpaidRows = []

      months.forEach((mk) => {
        const cutoff = lastDayOfMonth(mk)
        const concerned = activeStudents.filter((s) =>
          (!s.enrollDate || s.enrollDate <= cutoff) &&
          (classFilter === "all" || s.classId === classFilter)
        )
        byMonth[mk] = { students: concerned.length, due: 0, paid: 0, exempted: 0, remaining: 0 }

        concerned.forEach((s) => {
          const sPayments = allPayments.filter((p) => p.studentId === s.id && p.month === mk)
          const sExemptions = allExemptions.filter((ex) => ex.studentId === s.id && ex.month === mk)
          const stat = computeStudentMonth(sPayments, sExemptions, fee)

          totalDue += stat.due
          totalPaid += stat.paid
          totalExempted += stat.exempted
          totalRemaining += stat.remaining

          byMonth[mk].due += stat.due
          byMonth[mk].paid += stat.paid
          byMonth[mk].exempted += stat.exempted
          byMonth[mk].remaining += stat.remaining

          const className = classMap[s.classId] || "غير محدد"
          if (!byClass[className]) byClass[className] = { students: new Set(), due: 0, paid: 0, exempted: 0, remaining: 0 }
          byClass[className].students.add(s.id)
          byClass[className].due += stat.due
          byClass[className].paid += stat.paid
          byClass[className].exempted += stat.exempted
          byClass[className].remaining += stat.remaining

          statusCounts[stat.status]++

          if (stat.remaining > 0) {
            unpaidRows.push({
              "الطالب": s.name, "القسم": className, "الشهر": monthLabel(mk),
              "المستحق": stat.due, "المدفوع": stat.paid, "المعفى": stat.exempted, "المتبقي": stat.remaining,
            })
          }
        })
      })

      const paymentRows = allPayments
        .filter((p) => classFilter === "all" || p.classId === classFilter)
        .map((p) => ({
          "الطالب": studentMap[p.
