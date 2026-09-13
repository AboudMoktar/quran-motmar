import { useState } from "react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth, LOGIN_DOMAIN } from "../firebase"
import { ASSOCIATION_NAME, BRANCH_LABEL } from "../config"

export default function Login() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-md p-6 w-full max-w-sm"
      >
        <h1 className="text-xl font-bold text-emerald-700 text-center mb-1">
          {ASSOCIATION_NAME}
        </h1>
        <p className="text-gray-500 text-center text-sm mb-6">
          {BRANCH_LABEL}
        </p>

        <label className="block text-sm text-gray-600 mb-1">اسم المستخدم</label>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <label className="block text-sm text-gray-600 mb-1">كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

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
