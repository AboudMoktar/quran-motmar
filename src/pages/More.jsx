import { Link } from "react-router-dom"
import { Users, FileBarChart, Wallet, TrendingUp, BookMarked, MessageCircle, Settings as SettingsIcon, History, Trash2, ChevronLeft } from "lucide-react"

const ITEMS = [
  { to: "/teachers", label: "الفريق", icon: Users },
  { to: "/progress", label: "التقدم القرآني", icon: BookMarked },
  { to: "/reports", label: "التقارير", icon: FileBarChart },
  { to: "/payments", label: "الاشتراكات", icon: Wallet },
  { to: "/finance", label: "الوضعية المالية", icon: TrendingUp },
  { to: "/messages", label: "الرسائل", icon: MessageCircle },
  { to: "/logs", label: "سجل النشاط", icon: History },
  { to: "/trash", label: "المحذوفات", icon: Trash2 },
  { to: "/settings", label: "الإعدادات", icon: SettingsIcon },
]

export default function More() {
  return (
    <div>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">المزيد</h2>
      <div className="space-y-2">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4"
            >
              <div className="flex items-center gap-3">
                <Icon size={20} className="text-emerald-700 dark:text-emerald-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
              </div>
              <ChevronLeft size={18} className="text-gray-400" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
