import { useState } from "react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { Eye, EyeOff } from "lucide-react"
import { auth, LOGIN_DOMAIN } from "../firebase"
import { ASSOCIATION_NAME, BRANCH_LABEL } from "../config"

export default function Login() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const value = identifier.trim().toLowerCase()
      const email = value.includes("@") ? value : `${value}@${LOGIN_DOMAIN}`
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 w-full max-w-sm"
      >
        <h1 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 text-center mb-1">
          {ASSOCIATION_NAME}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-6">
          {BRANCH_LABEL}
        </p>

        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">اسم المستخدم</label>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
        />

        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">كلمة المرور</label>
        <div className="relative mb-4">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-700 text-white rounded-lg py-2 font-medium hover:bg-emerald-800 disabled:opacity-60"
        >
          {loading ? "جارٍ الدخول..." : "تسجيل الدخول"}
        </button>
      </form>
    </div>
  )
}
