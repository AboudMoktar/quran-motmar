import { Plus } from "lucide-react"

export default function FAB({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 left-4 w-14 h-14 rounded-full bg-emerald-700 text-white shadow-lg flex items-center justify-center z-40"
    >
      <Plus size={26} />
    </button>
  )
}
