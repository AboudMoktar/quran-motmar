import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, Users, CalendarCheck, BookOpen, MoreHorizontal } from "lucide-react"

const ADMIN_TABS = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/students", label: "الطلاب", icon: Users },
  { to: "/attendance", label: "الحضور", icon: CalendarCheck },
  { to: "/classes", label: "الأقسام", icon: BookOpen },
  { to: "/more", label: "المزيد", icon: MoreHorizontal },
]

const TEACHER_TABS = [
  { to: "/attendance", label: "الحضور", icon: CalendarCheck },
  { to: "/payments", label: "الاشتراكات", icon: Users },
]

export default function BottomNav({ role }) {
  const location = useLocation()
  const tabs = role === "admin" ? ADMIN_TABS : TEACHER_TABS

  const isActive = (to) => {
    if (to === "/more") {
      return ["/teachers", "/reports", "/payments", "/more"].includes(location.pathname)
    }
    return location.pathname === to
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = isActive(tab.to)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
          >
            <Icon
              size={22}
              className={active ? "text-emerald-700" : "text-gray-400"}
              strokeWidth={active ? 2.5 : 2}
            />
            <span className={`text-[10px] ${active ? "text-emerald-700 font-medium" : "text-gray-400"}`}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
