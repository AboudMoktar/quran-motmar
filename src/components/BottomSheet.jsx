import { useEffect, useState } from "react"
import { X } from "lucide-react"

function useViewportHeight() {
  const [height, setHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  )

  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport
      setHeight(vv ? vv.height : window.innerHeight)
    }
    update()
    window.visualViewport?.addEventListener("resize", update)
    window.addEventListener("resize", update)
    return () => {
      window.visualViewport?.removeEventListener("resize", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  return height
}

export default function BottomSheet({ open, onClose, title, footer, children }) {
  const viewportHeight = useViewportHeight()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        className="relative bg-white w-full rounded-t-2xl flex flex-col animate-slide-up"
        style={{ maxHeight: Math.round(viewportHeight * 0.7) + "px" }}
      >
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="font-bold text-sm">{title}</h3>
          <button onClick={onClose} className="text-gray-400">
            <X size={22} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && (
          <div className="p-4 border-t shrink-0 bg-white">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
