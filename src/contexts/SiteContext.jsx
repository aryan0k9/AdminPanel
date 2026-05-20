// ============================================================
// SITE CONTEXT
// Tracks which site the admin is currently managing
// Stored in sessionStorage so it persists across page reloads
// ============================================================

import { createContext, useContext, useState, useEffect } from 'react'

const SiteContext = createContext(null)

const STORAGE_KEY = 'easyadmin-selected-site'

export function SiteProvider({ children }) {
  const [selectedSite, setSelectedSiteState] = useState(null)

  // Load from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setSelectedSiteState(JSON.parse(saved))
      } catch (err) {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Save to sessionStorage when changed
  const setSelectedSite = (site) => {
    if (site) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(site))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
    setSelectedSiteState(site)
  }

  // Clear selection (used when "switching sites")
  const clearSite = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setSelectedSiteState(null)
  }

  const value = {
    selectedSite,
    setSelectedSite,
    clearSite,
    // Helper: is "All Sites" selected?
    isAllSites: selectedSite?.id === 'all'
  }

  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  const context = useContext(SiteContext)
  if (!context) {
    throw new Error('useSite must be used within SiteProvider')
  }
  return context
}
