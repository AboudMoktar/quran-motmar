import { useState } from "react"

// Same floating-label behavior as FloatingInput, for a <select>. The first
// option must be value="" (the existing "اختر..." placeholder option) —
// its text is hidden from display since the floating label now plays that
// role, so nothing is duplicated when no choice is made yet.
export default function FloatingSelect({ label, value, onChange, children, className = "", ...rest }) {
  const [focused, setFocused] = useState(false)
  const floated = focused || (value !== undefined && value !== null && String(value).length > 0)

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 pt-4 pb-1.5 text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        {...rest}
      >
        {children}
      </select>
      <label
        className={`absolute right-3 pointer-events-none transition-all duration-150 ${
          floated
            ? `top-1.5 text-[10px] ${focused ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`
            : "top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-400"
        }`}
      >
        {label}
      </label>
    </div>
  )
}
