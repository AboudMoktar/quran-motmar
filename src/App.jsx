import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import Login from "./pages/Login"
import Layout from "./components/Layout"
import Teachers from "./pages/Teachers"
import Classes from "./pages/Classes"
import Students from "./pages/Students"

function AdminRoute({ children }) {
  const { role } = useAuth()
  return role === "admin" ? children : <Navigate to="/" />
}

function TeacherHome() {
  return (
    <div className="p-4 text-center text-gray-500">
      لوحة المعلم قيد الإنشاء
    </div>
  )
}

function Home() {
  const { role } = useAuth()
  if (role === "admin") return <Navigate to="/teachers" />
  return <TeacherHome />
}

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">جارٍ التحميل...</div>
  }

  if (!user) return <Login />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/teachers" element={<AdminRoute><Teachers /></AdminRoute>} />
        <Route path="/classes" element={<AdminRoute><Classes /></AdminRoute>} />
        <Route path="/students" element={<AdminRoute><Students /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
