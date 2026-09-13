import { AuthProvider, useAuth } from "./context/AuthContext"
import Login from "./pages/Login"

function Dashboard() {
  const { role, logout } = useAuth()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <p className="text-lg mb-2">تم تسجيل الدخول بنجاح ✅</p>
      <p className="text-gray-500 mb-6">الدور: {role || "غير محدد"}</p>
      <button
        onClick={logout}
        className="bg-red-600 text-white px-4 py-2 rounded-lg"
      >
        تسجيل الخروج
      </button>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">جارٍ التحميل...</div>
  }
  return user ? <Dashboard /> : <Login />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
