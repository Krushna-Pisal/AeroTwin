import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './features/auth/Login'
import { useAppStore } from './store/useAppStore'
import { ModeBanner } from './components/common/ModeBanner'
import { CitizenPortal } from './features/citizen/CitizenPortal'
import { AuthorityShell } from './features/authority/AuthorityShell'

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode, allowedRole: 'citizen' | 'municipal' }) {
  const role = useAppStore((s) => s.role)
  if (!role) return <Navigate to="/login" replace />
  if (role !== allowedRole) return <Navigate to={role === 'citizen' ? '/citizen' : '/authority'} replace />
  return <>{children}</>
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/citizen/*" element={
            <ProtectedRoute allowedRole="citizen">
              <CitizenPortal />
            </ProtectedRoute>
          } />
          <Route path="/authority/*" element={
            <ProtectedRoute allowedRole="municipal">
              <AuthorityShell />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
