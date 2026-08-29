import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface SiteSettingsContextType {
  maintenanceMode: boolean
  showInstallBanner: boolean
  installBannerCampaign: number
  showPushPrompt: boolean
  pushPromptCampaign: number
  loading: boolean
}

const SiteSettingsContext = createContext<SiteSettingsContextType>({
  maintenanceMode: false,
  showInstallBanner: true,
  installBannerCampaign: 1,
  showPushPrompt: true,
  pushPromptCampaign: 1,
  loading: true
})

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [showInstallBanner, setShowInstallBanner] = useState(true)
  const [installBannerCampaign, setInstallBannerCampaign] = useState(1)
  const [showPushPrompt, setShowPushPrompt] = useState(true)
  const [pushPromptCampaign, setPushPromptCampaign] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('maintenance_mode, show_install_banner, install_banner_campaign, show_push_prompt, push_prompt_campaign')
          .eq('id', 1)
          .maybeSingle()

        if (!error && data) {
          setMaintenanceMode(data.maintenance_mode)
          if (data.show_install_banner !== undefined) setShowInstallBanner(data.show_install_banner)
          if (data.install_banner_campaign !== undefined) setInstallBannerCampaign(data.install_banner_campaign)
          if (data.show_push_prompt !== undefined) setShowPushPrompt(data.show_push_prompt)
          if (data.push_prompt_campaign !== undefined) setPushPromptCampaign(data.push_prompt_campaign)
        }
      } catch (err) {
        console.error('Error fetching site settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()

    const channel = supabase.channel('site_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'site_settings',
          filter: 'id=eq.1'
        },
        (payload) => {
          if (payload.new) {
            if ('maintenance_mode' in payload.new) {
              setMaintenanceMode(payload.new.maintenance_mode)
            }
            if ('show_install_banner' in payload.new) {
              setShowInstallBanner(payload.new.show_install_banner)
            }
            if ('install_banner_campaign' in payload.new) {
              setInstallBannerCampaign(payload.new.install_banner_campaign)
            }
            if ('show_push_prompt' in payload.new) {
              setShowPushPrompt(payload.new.show_push_prompt)
            }
            if ('push_prompt_campaign' in payload.new) {
              setPushPromptCampaign(payload.new.push_prompt_campaign)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <SiteSettingsContext.Provider value={{ maintenanceMode, showInstallBanner, installBannerCampaign, showPushPrompt, pushPromptCampaign, loading }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}
