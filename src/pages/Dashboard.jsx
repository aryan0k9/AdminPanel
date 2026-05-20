// ============================================================
// DASHBOARD PAGE
// Shows overview stats for the currently selected site
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Clock, Activity, CheckCircle,
  DollarSign, Users, UserCheck, TrendingUp, Calendar, MessageSquare
} from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { Link } from 'react-router-dom'
import { useSite } from '../contexts/SiteContext'
import { getDashboardStats, formatCurrency, timeAgo } from '../lib/stats'

export default function Dashboard() {
  const navigate = useNavigate()
  const { selectedSite, isAllSites } = useSite()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  // Redirect to site selector if no site chosen
  useEffect(() => {
    if (!selectedSite) {
      navigate('/sites')
    }
  }, [selectedSite, navigate])

  // Load dashboard data
  useEffect(() => {
    if (!selectedSite) return

    async function loadData() {
      setLoading(true)
      const siteId = isAllSites ? null : selectedSite.id
      const result = await getDashboardStats(siteId)
      setStats(result.stats)
      setLoading(false)
    }

    loadData()
  }, [selectedSite, isAllSites])

  if (!selectedSite) return null

  if (loading || !stats) {
    return (
      <AdminLayout title="Dashboard">
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </AdminLayout>
    )
  }

  // Stat cards configuration
  const statCards = [
    {
      label: 'Total Orders',
      value: stats.totalOrders,
      icon: Package,
      color: '#3B82F6',
      change: stats.newOrdersToday > 0 ? `+${stats.newOrdersToday} today` : null,
      link: '/orders'
    },
    {
      label: 'Pending Review',
      value: stats.pendingOrders,
      icon: Clock,
      color: '#F59E0B',
      change: stats.pendingOrders > 0 ? 'Action needed' : 'All caught up',
      link: '/orders?status=pending'
    },
    {
      label: 'Active Orders',
      value: stats.activeOrders,
      icon: Activity,
      color: '#16A34A',
      change: stats.activeOrders > 0 ? 'In progress' : 'No active',
      link: '/orders?status=active'
    },
    {
      label: 'Completed',
      value: stats.completedOrders,
      icon: CheckCircle,
      color: '#A855F7',
      change: 'Total delivered',
      link: '/orders?status=completed'
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: '#16A34A',
      change: 'Lifetime',
      link: '/payments'
    },
    {
      label: 'Total Customers',
      value: stats.totalUsers,
      icon: Users,
      color: '#3B82F6',
      change: stats.newUsersThisWeek > 0 ? `+${stats.newUsersThisWeek} this week` : 'No new this week',
      link: '/users'
    },
    {
      label: 'Active Experts',
      value: stats.totalExperts,
      icon: UserCheck,
      color: '#A855F7',
      change: stats.totalExperts === 0 ? 'Add experts' : 'Available',
      link: '/experts'
    },
    {
      label: 'Today',
      value: stats.newOrdersToday,
      icon: Calendar,
      color: '#EF4444',
      change: 'New orders today',
      link: '/orders?date=today'
    }
  ]

  return (
    <AdminLayout title={`Dashboard${isAllSites ? ' (All Sites)' : ''}`}>
      {/* Welcome banner */}
      <div className="admin-welcome-banner" style={{ '--site-color': selectedSite.theme_color }}>
        <div>
          <h2 className="admin-welcome-title">
            👋 Managing {selectedSite.name}
          </h2>
          <p className="admin-welcome-subtitle">
            {isAllSites
              ? 'Combined data from all sites is shown below.'
              : `Domain: ${selectedSite.domain}`
            }
          </p>
        </div>
        {!isAllSites && (
          <div className="admin-welcome-badge">
            <span className="admin-welcome-dot"></span>
            Live
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="admin-stats-grid">
        {statCards.map((card, i) => {
          const Icon = card.icon
          return (
            <Link
              key={i}
              to={card.link}
              className="admin-stat-card"
              style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '' }}
            >
              <div className="admin-stat-icon" style={{ background: `${card.color}15`, color: card.color }}>
                <Icon size={20} />
              </div>
              <div className="admin-stat-value">{card.value}</div>
              <div className="admin-stat-label">{card.label}</div>
              {card.change && (
                <div className="admin-stat-change">{card.change}</div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Two-column section */}
      <div className="admin-dashboard-cols">
        {/* Recent Orders */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">📦 Recent Orders</h3>
            <button className="admin-card-link" disabled>
              View all (soon) →
            </button>
          </div>
          <div className="admin-card-body">
            {stats.recentOrders.length === 0 ? (
              <div className="admin-empty">
                <Package size={32} strokeWidth={1.5} />
                <p>No orders yet</p>
                <small>Orders placed on the customer site will appear here</small>
              </div>
            ) : (
              <div className="admin-list">
                {stats.recentOrders.map((order) => (
                  <div key={order.id} className="admin-list-item">
                    <div className="admin-list-info">
                      <div className="admin-list-title">{order.order_number}</div>
                      <div className="admin-list-subtitle">
                        {order.subject} · {order.type}
                      </div>
                    </div>
                    <div className="admin-list-meta" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`admin-status-pill ${order.status}`}>
                        ● {order.status}
                      </span>
                      <span className="admin-list-time">{timeAgo(order.created_at)}</span>
                      <Link 
                        to={`/messages?tab=order&orderId=${order.id}`}
                        className="admin-btn admin-btn-outline"
                        style={{ padding: '4px', minWidth: 'auto', display: 'flex', alignItems: 'center' }}
                        title="Message Student"
                      >
                        <MessageSquare size={14} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">👥 Recent Users</h3>
            <button className="admin-card-link" disabled>
              View all (soon) →
            </button>
          </div>
          <div className="admin-card-body">
            {stats.recentUsers.length === 0 ? (
              <div className="admin-empty">
                <Users size={32} strokeWidth={1.5} />
                <p>No users yet</p>
                <small>New signups will appear here</small>
              </div>
            ) : (
              <div className="admin-list">
                {stats.recentUsers.map((user) => (
                  <div key={user.id} className="admin-list-item">
                    <div className="admin-list-info">
                      <div className="admin-list-title">
                        {user.full_name || 'Unnamed user'}
                      </div>
                      <div className="admin-list-subtitle">
                        {user.role || 'student'}
                      </div>
                    </div>
                    <div className="admin-list-meta">
                      <span className="admin-list-time">{timeAgo(user.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Coming Soon notice */}
      <div className="admin-coming-soon">
        <TrendingUp size={20} />
        <div>
          <strong>Phase A complete!</strong> Login, site selector, and dashboard are working.
          Orders management, user management, payments, and more features will be added in Phase B.
        </div>
      </div>
    </AdminLayout>
  )
}
