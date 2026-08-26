import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface SiteSettingsContextType {
  maintenanceMode: boolean
  loading: boolean
}

const SiteSettingsContext = createContext<SiteSettingsContextType>({
  maintenanceMode: false,
  loading: true
})

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('maintenance_mode')
          .eq('id', 1)
          .maybeSingle()

        if (!error && data) {
          setMaintenanceMode(data.maintenance_mode)
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
          if (payload.new && 'maintenance_mode' in payload.new) {
            setMaintenanceMode(payload.new.maintenance_mode)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <SiteSettingsContext.Provider value={{ maintenanceMode, loading }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}
