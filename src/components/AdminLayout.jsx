// ============================================================
// ADMIN LAYOUT
// The main layout: sidebar + topbar + content area
// Used by all admin pages (after site is selected)
// ============================================================

import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSite } from '../contexts/SiteContext'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, Package, Users, DollarSign,
  MessageSquare, FileText, BarChart3, Settings,
  LogOut, ArrowLeft, Bell, Search, AlertCircle, Star, Ticket, Wallet, UserCheck
} from 'lucide-react'

export default function AdminLayout({ title, children }) {
  const navigate = useNavigate()
  const { profile, logout } = useAuth()
  const { selectedSite, clearSite } = useSite()

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout()
      navigate('/login')
    }
  }

  const handleSwitchSite = () => {
    clearSite()
    navigate('/sites')
  }

  // Real-time unread chat count
  const [unreadChats, setUnreadChats] = useState(0)
  const [unreadReworks, setUnreadReworks] = useState(0)
  const pollRef = useRef(null)

  async function loadUnreadCount() {
    let query = supabase
      .from('chat_sessions')
      .select('unread_count')
      .eq('status', 'active')
      .gt('unread_count', 0)

    if (selectedSite && selectedSite.id !== 'all') {
      query = query.eq('site_id', selectedSite.id)
    }

    const { data } = await query
    const total = data?.reduce((sum, s) => sum + (s.unread_count || 0), 0) || 0
    setUnreadChats(total)

    // Load unread reworks (only messages not yet read)
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .like('message', '[REWORK_REQ] %')
      
    setUnreadReworks(count || 0)
  }

  useEffect(() => {
    loadUnreadCount()

    // Polling fallback every 5s ensures badge stays accurate regardless of real-time
    pollRef.current = setInterval(loadUnreadCount, 5000)

    // Instant refresh when admin returns to the tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadUnreadCount()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Subscribe to realtime changes on chat_sessions
    const channel = supabase
      .channel('admin-unread-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, () => {
        loadUnreadCount()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        loadUnreadCount()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [selectedSite])

  // Navigation sections
  const navSections = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }
    ]
  },
  {
    label: 'Operations',
    items: [
      { to: '/orders', icon: Package, label: 'Orders' },
      { to: '/reworks', icon: AlertCircle, label: 'Reworks', badge: unreadReworks > 0 ? unreadReworks : null },
      { to: '/feedback', icon: Star, label: 'Feedback' },
      { to: '/users', icon: Users, label: 'Users' },
      { to: '/experts', icon: Users, label: 'Experts' },
      { to: '/agents', icon: Users, label: 'Agents' },
      { to: '/managers', icon: UserCheck, label: 'Managers' }
    ]
  },
  {
    label: 'Finance',
    items: [
      { to: '/payments', icon: DollarSign, label: 'Payments' },
      { to: '/wallet',   icon: Wallet,     label: 'Wallet' },
      { to: '/coupons',  icon: Ticket,     label: 'Coupons' }
    ]
  },
  {
    label: 'Communication',
    items: [
      { to: '/messages', icon: MessageSquare, label: 'Messages', badge: unreadChats > 0 ? unreadChats : null },
      { to: '/notifications', icon: Bell, label: 'Notifications' }
    ]
  },
  {
    label: 'Content',
    items: [
      { to: '/blog', icon: FileText, label: 'Blog Posts' }
    ]
  },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', icon: BarChart3, label: 'Analytics' }
    ]
  },
  {
    label: 'System',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' }
    ]
  }
]

  // User initials for avatar
  const getInitials = (name) => {
    if (!name) return 'A'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'A'
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Site icon based on theme color
  const siteIcon = selectedSite?.id === 'all' ? '📊'
                 : selectedSite?.theme_color === '#16A34A' ? '📗'
                 : selectedSite?.theme_color === '#3B82F6' ? '📘'
                 : selectedSite?.theme_color === '#EF4444' ? '📕'
                 : selectedSite?.theme_color === '#A855F7' ? '📙'
                 : '🏢'

  return (
    <div className="admin-app">
      {/* SIDEBAR */}
      <aside className="admin-sidebar">
        {/* Brand */}
        <div className="admin-brand">
          <div className="admin-brand-mark">A</div>
          <div className="admin-brand-text">
            <div className="admin-brand-title">Control</div>
            <div className="admin-brand-subtitle">Center</div>
          </div>
        </div>

        {/* Current Site Indicator */}
        <div className="admin-site-indicator">
          <div className="admin-site-icon">{siteIcon}</div>
          <div className="admin-site-info">
            <div className="admin-site-label">Managing</div>
            <div className="admin-site-name">{selectedSite?.name || 'No site'}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="admin-nav">
          {navSections.map((section, i) => (
            <div key={i} className="admin-nav-section">
              <div className="admin-nav-label">{section.label}</div>
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `admin-nav-link ${isActive ? 'active' : ''} ${item.soon ? 'soon' : ''}`
                    }
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {item.soon && <span className="admin-nav-badge">Soon</span>}
                    {item.badge && <span className="admin-nav-msg-badge">{item.badge}</span>}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User card at bottom */}
        <div className="admin-user-card">
          <div className="admin-user-avatar">
            {getInitials(profile?.full_name)}
          </div>
          <div className="admin-user-info">
            <div className="admin-user-name">{profile?.full_name || 'Admin'}</div>
            <div className="admin-user-role">{profile?.role || 'admin'}</div>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="admin-main">
        {/* TOP BAR */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              onClick={handleSwitchSite}
              className="admin-switch-btn"
              title="Switch to another site"
            >
              <ArrowLeft size={16} />
              <span>Switch Site</span>
            </button>
            <h1 className="admin-page-title">{title}</h1>
          </div>

          <div className="admin-topbar-right">
            <button className="admin-icon-btn" title="Search (coming soon)">
              <Search size={18} />
            </button>
            <button className="admin-icon-btn" title="Notifications (coming soon)">
              <Bell size={18} />
            </button>
            <button onClick={handleLogout} className="admin-logout-btn">
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  )
}
// Trigger Vite HMR
