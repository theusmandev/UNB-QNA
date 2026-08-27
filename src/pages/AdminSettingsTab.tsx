import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminSettingsTab() {
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [showInstallBanner, setShowInstallBanner] = useState(true)
  const [installBannerCampaign, setInstallBannerCampaign] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await supabase
        .from('site_settings')
        .select('maintenance_mode, show_install_banner, install_banner_campaign')
        .eq('id', 1)
        .maybeSingle()
        
      if (!error && data) {
        setMaintenanceMode(data.maintenance_mode)
        if (data.show_install_banner !== undefined) setShowInstallBanner(data.show_install_banner)
        if (data.install_banner_campaign !== undefined) setInstallBannerCampaign(data.install_banner_campaign)
      }
      setLoading(false)
    }
    loadSettings()
  }, [])

  const toggleMaintenance = async () => {
    setSaving(true)
    const newValue = !maintenanceMode
    const { error } = await supabase
      .from('site_settings')
      .update({ maintenance_mode: newValue, updated_at: new Date().toISOString() })
      .eq('id', 1)

    if (!error) {
      setMaintenanceMode(newValue)
    } else {
      alert('Failed to update maintenance mode.')
    }
    setSaving(false)
  }

  const toggleInstallBanner = async () => {
    setSaving(true)
    const newValue = !showInstallBanner
    const newCampaign = newValue ? installBannerCampaign + 1 : installBannerCampaign
    
    const { error } = await supabase
      .from('site_settings')
      .update({ 
        show_install_banner: newValue, 
        install_banner_campaign: newCampaign,
        updated_at: new Date().toISOString() 
      })
      .eq('id', 1)

    if (!error) {
      setShowInstallBanner(newValue)
      setInstallBannerCampaign(newCampaign)
    } else {
      alert('Failed to update install banner setting.')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="p-4 text-center text-wa-muted">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5">
          <h2 className="font-semibold text-wa-ink">Site Settings</h2>
        </div>
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-wa-ink">Maintenance Mode</h3>
              <p className="text-[13px] text-wa-muted mt-0.5 max-w-md">
                When enabled, visitors will see a maintenance page instead of the site content. 
                You will still be able to access this admin panel.
              </p>
            </div>
            <button
              onClick={toggleMaintenance}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2 ${
                maintenanceMode ? 'bg-wa-teal' : 'bg-gray-200'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              role="switch"
              aria-checked={maintenanceMode}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-wa-ink">Show Install App Banner</h3>
              <p className="text-[13px] text-wa-muted mt-0.5 max-w-md">
                Show the prompt to install the app on supported devices. 
                Toggling this off and then on again will reset the dismiss state for all visitors.
              </p>
            </div>
            <button
              onClick={toggleInstallBanner}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-wa-teal focus:ring-offset-2 ${
                showInstallBanner ? 'bg-wa-teal' : 'bg-gray-200'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              role="switch"
              aria-checked={showInstallBanner}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  showInstallBanner ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
