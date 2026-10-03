import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import Login from "./pages/Login"
import Layout from "./components/Layout"
import Dashboard from "./pages/Dashboard"
import Teachers from "./pages/Teachers"
import Classes from "./pages/Classes"
import Students from "./pages/Students"
import Attendance from "./pages/Attendance"
import Payments from "./pages/Payments"
import Finance from "./pages/Finance"
import Progress from "./pages/Progress"
import ClassNotebook from "./pages/ClassNotebook"
import ClassesProgress from "./pages/ClassesProgress"
import TeachersTracking from "./pages/TeachersTracking"
import PedagogicalDashboard from "./pages/PedagogicalDashboard"
import Reports from "./pages/Reports"
import Messages from "./pages/Messages"
import Settings from "./pages/Settings"
import Logs from "./pages/Logs"
import Trash from "./pages/Trash"
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
        <Route path="/students" element={<Students />} />
        <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="/finance" element={<AdminRoute><Finance /></AdminRoute>} />
        <Route path="/messages" element={<AdminRoute><Messages /></AdminRoute>} />
        <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
        <Route path="/logs" element={<AdminRoute><Logs /></AdminRoute>} />
        <Route path="/trash" element={<AdminRoute><Trash /></AdminRoute>} />
        <Route path="/more" element={<AdminRoute><More /></AdminRoute>} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/notebook" element={<ClassNotebook />} />
        <Route path="/classes-progress" element={<AdminRoute><ClassesProgress /></AdminRoute>} />
        <Route path="/teachers-tracking" element={<AdminRoute><TeachersTracking /></AdminRoute>} />
        <Route path="/pedagogical-dashboard" element={<PedagogicalDashboard />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
