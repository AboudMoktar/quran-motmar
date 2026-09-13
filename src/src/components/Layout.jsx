import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Layout({ children }) {
  const { role, logout } = useAuth()
  const location = useLocation()

  const links = [
    { to: "/teachers", label: "المعلمون" },
    { to: "/classes", label: "الأقسام" },
    { to: "/students", label: "الطلاب" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-emerald-700 text-white p-4 flex items-center justify-between">
        <h1 className="font-bold text-sm">الرابطة الوطنية للقرآن الكريم</h1>
        <button onClick={logout} className="text-sm bg-emerald-800 px-3 py-1 rounded-lg">
          خروج
        </button>
      </header>

      {role === "admin" && (
        <nav className="flex bg-white border-b overflow-x-auto">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-4 py-3 text-sm whitespace-nowrap ${
                location.pathname === link.to
                  ? "text-emerald-700 border-b-2 border-emerald-700 font-medium"
                  : "text-gray-500"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      <main className="p-4">{children}</main>
    </div>
  )
}
