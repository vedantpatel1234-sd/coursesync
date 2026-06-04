import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  CalendarDays,
  FileInput,
  FlaskConical,
  ClipboardList,
  Star,
  LogOut,
  GraduationCap,
  BarChart2,
  Sparkles,
  ScrollText,
} from 'lucide-react'

export default function AppShell() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/assignments', label: 'Assignments', icon: ClipboardList },
    { to: '/admin/instructors', label: 'Instructors', icon: Users },
    { to: '/admin/sections', label: 'Sections', icon: CalendarDays },
    { to: '/admin/courses', label: 'Courses', icon: BookOpen },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
    { to: '/admin/ai', label: 'AI Assistant', icon: Sparkles },
    { to: '/admin/drafts', label: 'Drafts', icon: FlaskConical },
    { to: '/admin/import', label: 'Import', icon: FileInput },
    { to: '/admin/audit', label: 'Audit Log', icon: ScrollText },
  ]

  const instructorLinks = [
    { to: '/instructor', label: 'My Assignments', icon: LayoutDashboard },
    { to: '/instructor/qualifications', label: 'Qualifications', icon: Star },
    { to: '/instructor/preferences', label: 'Preferences', icon: ClipboardList },
    { to: '/instructor/availability', label: 'Availability', icon: CalendarDays },
  ]

  const links = user?.role === 'admin' ? adminLinks : instructorLinks

  return (
    <div className="flex min-h-screen bg-[#F4F3F0]" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');`}</style>

      <aside className="w-52 bg-white border-r border-black/[0.07] flex flex-col py-4 shrink-0">
        <div className="px-4 pb-4 mb-2 border-b border-black/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#534AB7] flex items-center justify-center shrink-0">
              <GraduationCap size={15} color="white" />
            </div>
            <div>
              <div className="text-sm font-medium text-[#1A1A2E]">CourseSync</div>
              <div className="text-[11px] text-[#6B6B80]">
                {user?.role === 'admin' ? 'Administrator' : 'Instructor'}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-2 flex flex-col gap-0.5 overflow-y-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin' || to === '/instructor'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[#EEEDFE] text-[#534AB7] font-medium'
                    : 'text-[#6B6B80] hover:bg-[#F4F3F0] hover:text-[#1A1A2E]'
                }`
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pt-4 border-t border-black/[0.07]">
          <div className="text-[12px] text-[#1A1A2E] font-medium truncate mb-1">{user?.full_name}</div>
          <div className="text-[11px] text-[#6B6B80] truncate mb-3">{user?.email}</div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-[12px] text-[#6B6B80] hover:text-[#E24B4A] transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}