import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { LOGO_BASE64 } from "../assets/logo"

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
      <header
        className="text-white p-3"
        style={{ background: "linear-gradient(135deg, #065f46, #047857)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <img src={LOGO_BASE64} className="w-9 h-9 object-contain rounded-full bg-white p-0.5" />
            <h1 className="font-bold text-sm">الرابطة الوطنية للقرآن الكريم</h1>
          </div>
          <button onClick={logout} className="text-xs bg-emerald-900 px-3 py-1 rounded-lg">
            خروج
          </button>
        </div>
        <p className="text-[11px] text-gold-500">
          متصل الآن: {name || "غير معروف"} ({ROLE_LABELS[role] || role})
        </p>
      </header>

      <nav className="flex bg-white border-b border-gray-200 overflow-hidden">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`flex-1 min-w-0 text-center py-2 px-1 text-[10px] whitespace-nowrap overflow-hidden text-ellipsis ${
              location.pathname === link.to
                ? "text-emerald-700 border-b-2 border-gold-500 font-medium"
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
