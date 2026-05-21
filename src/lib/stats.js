// ============================================================
// STATS HELPER
// Queries to get dashboard statistics
// All queries support filtering by site_id
// ============================================================

import { supabase } from './supabase'

// ============================================================
// GET ALL SITES + STATS
// Returns each site with order counts
// ============================================================
export async function getSitesWithStats() {
  try {
    // Get all sites
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('*')
      .order('id')

    if (sitesError) throw sitesError

    // Get order counts per site
    const { data: orderCounts, error: countError } = await supabase
      .from('orders')
      .select('site_id, status')

    if (countError) throw countError

    // Get unread chats per site
    const { data: chatSessions, error: chatError } = await supabase
      .from('chat_sessions')
      .select('site_id, unread_count')
      .gt('unread_count', 0)

    if (chatError) throw chatError

    // Calculate counts per site
    const sitesWithStats = sites.map(site => {
      const siteOrders = orderCounts?.filter(o => o.site_id === site.id) || []
      const siteUnreadChats = chatSessions?.filter(s => s.site_id === site.id).reduce((sum, s) => sum + (s.unread_count || 0), 0) || 0
      
      return {
        ...site,
        total_orders:    siteOrders.length,
        pending_orders:  siteOrders.filter(o => o.status === 'pending').length,
        active_orders:   siteOrders.filter(o => o.status === 'active' || o.status === 'in_review').length,
        completed_orders: siteOrders.filter(o => o.status === 'completed').length,
        unread_messages: siteUnreadChats
      }
    })

    return { success: true, sites: sitesWithStats }
  } catch (err) {
    console.error('getSitesWithStats error:', err)
    return { success: false, sites: [], error: err.message }
  }
}

// ============================================================
// GET DASHBOARD STATS FOR A SITE
// If siteId is null, returns stats for ALL sites combined
// ============================================================
export async function getDashboardStats(siteId = null) {
  try {
    // Build query
    let ordersQuery = supabase.from('orders').select('*')
    let usersQuery = supabase.from('profiles').select('id, full_name, email, role, created_at')

    if (siteId) {
      ordersQuery = ordersQuery.eq('site_id', siteId)
      usersQuery = usersQuery.eq('site_id', siteId)
    }

    const { data: orders } = await ordersQuery
    const { data: users } = await usersQuery

    // Calculate stats
    const totalOrders = orders?.length || 0
    const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0
    const activeOrders = orders?.filter(o => o.status === 'active' || o.status === 'in_review').length || 0
    const completedOrders = orders?.filter(o => o.status === 'completed').length || 0

    const totalRevenue = orders
      ?.filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + parseFloat(o.paid_amount || 0), 0) || 0

    const totalUsers = users?.filter(u => u.role === 'student').length || 0
    const totalExperts = users?.filter(u => u.role === 'expert').length || 0

    // Recent activity
    const recentOrders = orders
      ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5) || []

    const recentUsers = users
      ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5) || []

    // New orders today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const newOrdersToday = orders?.filter(o =>
      new Date(o.created_at) >= today
    ).length || 0

    // New users this week
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const newUsersThisWeek = users?.filter(u =>
      new Date(u.created_at) >= weekAgo && u.role === 'student'
    ).length || 0

    return {
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        activeOrders,
        completedOrders,
        totalRevenue,
        totalUsers,
        totalExperts,
        newOrdersToday,
        newUsersThisWeek,
        recentOrders,
        recentUsers
      }
    }
  } catch (err) {
    console.error('getDashboardStats error:', err)
    return {
      success: false,
      stats: {
        totalOrders: 0, pendingOrders: 0, activeOrders: 0,
        completedOrders: 0, totalRevenue: 0, totalUsers: 0,
        totalExperts: 0, newOrdersToday: 0, newUsersThisWeek: 0,
        recentOrders: [], recentUsers: []
      },
      error: err.message
    }
  }
}

// ============================================================
// FORMAT HELPERS
// ============================================================
export function formatCurrency(amount) {
  return `$${parseFloat(amount || 0).toFixed(2)}`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}
