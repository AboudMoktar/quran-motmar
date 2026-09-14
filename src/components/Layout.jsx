import { useAuth } from "../context/AuthContext"
import { LOGO_BASE64 } from "../assets/logo"
import { ASSOCIATION_NAME, BRANCH_LABEL } from "../config"
import BottomNav from "./BottomNav"

const ROLE_LABELS = { admin: "مدير", teacher: "معلم" }

export default function Layout({ children }) {
  const { role, name, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="text-white p-3"
        style={{ background: "linear-gradient(135deg, #065f46, #047857)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <img src={LOGO_BASE64} className="w-9 h-9 object-contain rounded-full bg-white p-0.5" />
            <div>
              <h1 className="font-bold text-xs leading-tight">{ASSOCIATION_NAME}</h1>
              <p className="text-[10px] text-emerald-100 leading-tight">{BRANCH_LABEL}</p>
            </div>
          </div>
          <button onClick={logout} className="text-xs bg-emerald-900 px-3 py-1 rounded-lg">
            خروج
          </button>
        </div>
        <p className="text-[11px] text-gold-500">
          متصل الآن: {name || "غير معروف"} ({ROLE_LABELS[role] || role})
        </p>
      </header>

      <main className="p-4 pb-20">{children}</main>

      <BottomNav role={role} />
    </div>
  )
}
