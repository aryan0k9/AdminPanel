// ============================================================
// SITE SELECTOR PAGE
// First page after login. Shows all 4 sites + "All Sites" combined view.
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Globe, BarChart3, ArrowRight, Package, MessageSquare } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSite } from '../contexts/SiteContext'
import { getSitesWithStats } from '../lib/stats'

export default function SiteSelector() {
  const navigate = useNavigate()
  const { profile, logout } = useAuth()
  const { setSelectedSite } = useSite()
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadSites() {
      const result = await getSitesWithStats()
      if (mounted) {
        if (result.success) {
          setSites(result.sites)
        } else {
          setError(result.error || 'Failed to load sites')
        }
        setLoading(false)
      }
    }
    
    loadSites()
    
    // Poll every 5 seconds for real-time updates on badges
    const pollId = setInterval(loadSites, 5000)
    
    // Instant refresh when returning to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadSites()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      mounted = false
      clearInterval(pollId)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const handleSelectSite = (site) => {
    setSelectedSite(site)
    navigate('/dashboard')
  }

  const handleSelectAll = () => {
    setSelectedSite({
      id: 'all',
      name: 'All Sites (Combined)',
      domain: 'all',
      theme_color: '#6366F1'
    })
    navigate('/dashboard')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Get site icon based on theme color
  const getSiteIcon = (color) => {
    if (color === '#16A34A') return '📗'
    if (color === '#3B82F6') return '📘'
    if (color === '#EF4444') return '📕'
    if (color === '#A855F7') return '📙'
    return '📔'
  }

  // Total stats across all sites
  const totalStats = sites.reduce((acc, site) => ({
    total_orders: acc.total_orders + (site.total_orders || 0),
    pending: acc.pending + (site.pending_orders || 0),
    active: acc.active + (site.active_orders || 0),
    unread_messages: acc.unread_messages + (site.unread_messages || 0)
  }), { total_orders: 0, pending: 0, active: 0, unread_messages: 0 })

  if (loading) {
    return (
      <div className="admin-loading-page">
        <div className="admin-loading-spinner"></div>
        <p>Loading your business...</p>
      </div>
    )
  }

  return (
    <div className="admin-selector-page">
      {/* Top header */}
      <header className="admin-selector-header">
        <div className="admin-selector-header-inner">
          <div className="admin-selector-brand">
            <div className="admin-brand-mark">A</div>
            <div>
              <div className="admin-selector-brand-title">Control Center</div>
              <div className="admin-selector-brand-subtitle">Welcome back, {profile?.full_name?.split(' ')[0] || 'Admin'}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="admin-logout-btn">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="admin-selector-main">
        <div className="admin-selector-intro">
          <h1 className="admin-selector-title">
            🏢 Choose Your Business
          </h1>
          <p className="admin-selector-subtitle">
            Select which site you want to manage. You can switch between sites anytime.
          </p>
        </div>

        {error && (
          <div className="admin-selector-error">
            ⚠️ {error}
          </div>
        )}

        {/* Site cards grid */}
        <div className="admin-selector-grid">
          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => handleSelectSite(site)}
              className="admin-site-card"
              style={{ '--site-color': site.theme_color }}
            >
              <div className="admin-site-card-header">
                <div className="admin-site-card-icon">
                  {getSiteIcon(site.theme_color)}
                </div>
                <div className="admin-site-card-status">
                  {site.active ? '● Active' : '○ Inactive'}
                </div>
              </div>

              <h3 className="admin-site-card-name">{site.name}</h3>
              <p className="admin-site-card-domain">{site.domain}</p>

              <div className="admin-site-card-stats">
                <div className="admin-site-card-stat">
                  <Package size={14} />
                  <span><strong>{site.total_orders}</strong> orders</span>
                </div>
                <div className="admin-site-card-stat">
                  <span className="admin-stat-dot pending"></span>
                  <span><strong>{site.pending_orders}</strong> pending</span>
                </div>
                <div className="admin-site-card-stat">
                  <span className="admin-stat-dot active"></span>
                  <span><strong>{site.active_orders}</strong> active</span>
                </div>
                {(site.unread_messages > 0 || site.pending_orders > 0) && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                    {site.pending_orders > 0 && (
                      <span style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Package size={12} /> {site.pending_orders} New {site.pending_orders === 1 ? 'Order' : 'Orders'}
                      </span>
                    )}
                    {site.unread_messages > 0 && (
                      <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MessageSquare size={12} /> {site.unread_messages} {site.unread_messages === 1 ? 'Message' : 'Messages'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="admin-site-card-action">
                <span>Open Dashboard</span>
                <ArrowRight size={16} />
              </div>
            </button>
          ))}
        </div>

        {/* All Sites Combined Card */}
        <button
          onClick={handleSelectAll}
          className="admin-all-sites-card"
        >
          <div className="admin-all-sites-icon">
            <BarChart3 size={32} strokeWidth={2.5} />
          </div>
          <div className="admin-all-sites-content">
            <h3 className="admin-all-sites-title">📊 All Sites (Combined View)</h3>
            <p className="admin-all-sites-desc">
              See data from all {sites.length} sites combined in one dashboard
            </p>
            <div className="admin-all-sites-stats">
              <span><strong>{totalStats.total_orders}</strong> total orders</span>
              <span>•</span>
              <span><strong>{totalStats.pending}</strong> pending</span>
              <span>•</span>
              <span><strong>{totalStats.active}</strong> active</span>
              {totalStats.unread_messages > 0 && (
                <>
                  <span>•</span>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}><strong>{totalStats.unread_messages}</strong> unread messages</span>
                </>
              )}
            </div>
          </div>
          <div className="admin-all-sites-arrow">
            <ArrowRight size={20} />
          </div>
        </button>

        {/* Footer info */}
        <div className="admin-selector-footer">
          <p>
            <Globe size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
            {' '}{sites.length} businesses connected • All data secured by Row-Level Security
          </p>
        </div>
      </main>
    </div>
  )
}
