import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'

import ProtectedRoute from './components/shared/ProtectedRoute'
import AppShell from './components/shared/AppShell'
import LoginPage from './pages/auth/LoginPage'
import InstructorDashboard from './pages/instructor/Dashboard'
import InstructorQualifications from './pages/instructor/Qualifications'
import InstructorPreferences from './pages/instructor/Preferences'
import InstructorAvailability from './pages/instructor/Availability'
import AdminDashboard from './pages/admin/Dashboard'
import AdminCourses from './pages/admin/Courses'
import AdminSections from './pages/admin/Sections'
import AdminInstructors from './pages/admin/Instructors'
import AdminAssignments from './pages/admin/Assignments'
import AdminDrafts from './pages/admin/Drafts'
import AdminImport from './pages/admin/Import'
import AdminAnalytics from './pages/admin/Analytics'
import AdminAIAssistant from './pages/admin/AIAssistant'
import AdminAuditLog from './pages/admin/AuditLog'

export default function App() {
  const fetchProfile = useAuthStore(s => s.fetchProfile)
  const setUser = useAuthStore(s => s.setUser)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute allowedRoles={['instructor']} />}>
          <Route element={<AppShell />}>
            <Route path="/instructor" element={<InstructorDashboard />} />
            <Route path="/instructor/qualifications" element={<InstructorQualifications />} />
            <Route path="/instructor/preferences" element={<InstructorPreferences />} />
            <Route path="/instructor/availability" element={<InstructorAvailability />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/courses" element={<AdminCourses />} />
            <Route path="/admin/sections" element={<AdminSections />} />
            <Route path="/admin/instructors" element={<AdminInstructors />} />
            <Route path="/admin/assignments" element={<AdminAssignments />} />
            <Route path="/admin/drafts" element={<AdminDrafts />} />
            <Route path="/admin/import" element={<AdminImport />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/ai" element={<AdminAIAssistant />} />
            <Route path="/admin/audit" element={<AdminAuditLog />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}