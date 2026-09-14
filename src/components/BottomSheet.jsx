import { X } from "lucide-react"

export default function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative bg-white w-full rounded-t-2xl max-h-[80vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h3 className="font-bold text-sm">{title}</h3>
          <button onClick={onClose} className="text-gray-400">
            <X size={22} />
          </button>
        </div>
        <div className="p-4 pb-10">{children}</div>
      </div>
    </div>
  )
}
