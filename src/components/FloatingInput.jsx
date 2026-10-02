import { useState } from "react"

// A text/number/password input whose label starts centered like a
// placeholder, then floats to a small label above the text the moment the
// field has a value OR is focused — so the field's name is always visible,
// never hidden behind what the user typed. Driven by the actual `value`
// (not a CSS-only placeholder trick), so a field that already has a value
// when the form opens (editing an existing record) renders already-floated
// on the very first paint, with no need to focus it first.
export default function FloatingInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  endAdornment,
  className = "",
  inputClassName = "",
  ...rest
}) {
  const [focused, setFocused] = useState(false)
  const floated = focused || (value !== undefined && value !== null && String(value).length > 0)

  return (
    <div className={`relative ${className}`}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 pt-4 pb-1.5 text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 ${endAdornment ? "pl-10" : ""} ${inputClassName}`}
        {...rest}
      />
      <label
        className={`absolute right-3 pointer-events-none transition-all duration-150 ${
          floated
            ? `top-1.5 text-[10px] ${focused ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`
            : "top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-400"
        }`}
      >
        {label}
      </label>
      {endAdornment && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2">{endAdornment}</div>
      )}
    </div>
  )
}
