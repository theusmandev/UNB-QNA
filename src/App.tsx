import { Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import PublicResponsePage from './pages/PublicResponsePage'
import AdminLogin from './pages/AdminLogin'
import AdminPanel from './pages/AdminPanel'
import ProtectedRoute from './components/ProtectedRoute'
import NotFound from './pages/NotFound'
import Maintenance from './pages/Maintenance'
import { SiteSettingsProvider, useSiteSettings } from './contexts/SiteSettingsContext'
import SplashScreen from './components/SplashScreen'

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { maintenanceMode, loading } = useSiteSettings()
  
  // We always render children so that they start mounting behind the splash screen.
  // The splash screen overlay will handle its own fade out once loading is false.
  
  if (maintenanceMode && !loading) {
    return <Maintenance />
  }

  return (
    <>
      <SplashScreen isLoading={loading} />
      {/* Render actual content only when not loading to avoid flashes */}
      {!loading && children}
    </>
  )
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
