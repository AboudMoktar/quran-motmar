import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

const ROLE_LABELS = { admin: "مدير", teacher: "معلم" }

export default function Layout({ children }) {
  const { role, name, logout } = useAuth()
  const location = useLocation()

  const adminLinks = [
    { to: "/dashboard", label: "لوحة التحكم" },
    { to: "/teachers", label: "المعلمون" },
    { to: "/classes", label: "الأقسام" },
    { to: "/students", label: "الطلاب" },
    { to: "/reports", label: "التقارير" },
  ]
  const commonLinks = [{ to: "/attendance", label: "الحضور" }]
  const links = role === "admin" ? [...adminLinks, ...commonLinks] : commonLinks

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-emerald-700 text-white p-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-bold text-sm">الرابطة الوطنية للقرآن الكريم</h1>
          <button onClick={logout} className="text-xs bg-emerald-800 px-3 py-1 rounded-lg">
            خروج
          </button>
        </div>
        <p className="text-xs text-emerald-100">
          متصل الآن: {name || "غير معروف"} ({ROLE_LABELS[role] || role})
        </p>
      </header>

      <nav className="flex flex-wrap bg-white border-b">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`px-3 py-2 text-xs whitespace-nowrap ${
              location.pathname === link.to
                ? "text-emerald-700 border-b-2 border-emerald-700 font-medium"
                : "text-gray-500"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <main className="p-4">{children}</main>
    </div>
  )
}
