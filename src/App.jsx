import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import Login from "./pages/Login"
import Layout from "./components/Layout"
import Dashboard from "./pages/Dashboard"
import Teachers from "./pages/Teachers"
import Classes from "./pages/Classes"
import Students from "./pages/Students"
import Attendance from "./pages/Attendance"
import Payments from "./pages/Payments"
import Progress from "./pages/Progress"
import Reports from "./pages/Reports"
import More from "./pages/More"

function AdminRoute({ children }) {
  const { isAdminLevel } = useAuth()
  return isAdminLevel ? children : <Navigate to="/" />
}

function Home() {
  const { isAdminLevel } = useAuth()
  if (isAdminLevel) return <Navigate to="/dashboard" />
  return <Navigate to="/attendance" />
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
        <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/teachers" element={<AdminRoute><Teachers /></AdminRoute>} />
        <Route path="/classes" element={<AdminRoute><Classes /></AdminRoute>} />
        <Route path="/students" element={<AdminRoute><Students /></AdminRoute>} />
        <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="/more" element={<AdminRoute><More /></AdminRoute>} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/progress" element={<Progress />} />
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
