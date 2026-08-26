import { Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import PublicResponsePage from './pages/PublicResponsePage'
import AdminLogin from './pages/AdminLogin'
import AdminPanel from './pages/AdminPanel'
import ProtectedRoute from './components/ProtectedRoute'
import NotFound from './pages/NotFound'
import Maintenance from './pages/Maintenance'
import { SiteSettingsProvider, useSiteSettings } from './contexts/SiteSettingsContext'

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { maintenanceMode, loading } = useSiteSettings()
  
  if (loading) {
    // Optionally return a subtle loading state, but for now we just wait
    return null
  }
  
  if (maintenanceMode) {
    return <Maintenance />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <SiteSettingsProvider>
      <Routes>
        <Route 
          path="/" 
          element={
            <MaintenanceGate>
              <Home />
            </MaintenanceGate>
          } 
        />
        <Route 
          path="/r/:slug" 
          element={
            <MaintenanceGate>
              <PublicResponsePage />
            </MaintenanceGate>
          } 
        />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route 
          path="*" 
          element={
            <MaintenanceGate>
              <NotFound />
            </MaintenanceGate>
          } 
        />
      </Routes>
    </SiteSettingsProvider>
  )
}
