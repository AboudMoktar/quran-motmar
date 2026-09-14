import { Link } from "react-router-dom"
import { Presentation, FileBarChart, Wallet, ChevronLeft } from "lucide-react"

const ITEMS = [
  { to: "/teachers", label: "المعلمون", icon: Presentation },
  { to: "/reports", label: "التقارير", icon: FileBarChart },
  { to: "/payments", label: "الاشتراكات", icon: Wallet },
]

export default function More() {
  return (
    <div>
      <h2 className="text-lg font-bold mb-4">المزيد</h2>
      <div className="space-y-2">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4"
            >
              <div className="flex items-center gap-3">
                <Icon size={20} className="text-emerald-700" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <ChevronLeft size={18} className="text-gray-400" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
