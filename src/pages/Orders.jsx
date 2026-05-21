import { useEffect, useState, useRef } from 'react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { useSite } from '../contexts/SiteContext'
import { formatDateTime, formatCurrency } from '../lib/stats'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { MessageCircle, Bell } from 'lucide-react'

const STATUS_TABS = [
  { key: 'all',       label: 'All Orders',     color: '#6b7280' },
  { key: 'pending',   label: 'Pending',         color: '#F59E0B' },
  { key: 'in_review', label: 'In Review',       color: '#8B5CF6' },
  { key: 'active',    label: 'Active',          color: '#16A34A' },
  { key: 'completed', label: 'Completed',       color: '#3B82F6' },
  { key: 'today',     label: "Today's Orders",  color: '#EF4444' },
]

export default function Orders() {
  const { selectedSite, isAllSites } = useSite()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [reworkOrderIds, setReworkOrderIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const [globalOnlineUsers, setGlobalOnlineUsers] = useState(new Set())
  const [onlineFilter, setOnlineFilter] = useState('all')
  const [newOrderBanner, setNewOrderBanner] = useState(null)
  const audioCtxRef = useRef(null)
  const bannerTimerRef = useRef(null)

  const urlStatus = searchParams.get('status') || ''
  const urlDate   = searchParams.get('date')   || ''
  const initTab   = urlDate === 'today' ? 'today' : (urlStatus || 'all')
  const [statusFilter, setStatusFilter] = useState(initTab)

  function handleTabChange(key) {
    setStatusFilter(key)
    if (key === 'all') setSearchParams({})
    else if (key === 'today') setSearchParams({ date: 'today' })
    else setSearchParams({ status: key })
  }

  // ===== NEW ORDER SOUND =====
  function playNewOrderSound() {
    try {
      const AudioCtx = window.AudioContext || window['webkitAudioContext']
      const ctx = audioCtxRef.current || new AudioCtx()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime
      // Three rising tones cheerful "ding ding ding"
      const notes = [523, 659, 784]   // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + i * 0.18)
        gain.gain.setValueAtTime(0, now + i * 0.18)
        gain.gain.linearRampToValueAtTime(0.22, now + i * 0.18 + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.35)
        osc.start(now + i * 0.18)
        osc.stop(now + i * 0.18 + 0.38)
      })
    } catch { }
  }

  // ===== GLOBAL PRESENCE =====
  useEffect(() => {
    // Determine a presence key for the admin
    let uid = 'admin'
    const storedAuth = localStorage.getItem('sb-odjmdfgsitpzohllmbrg-auth-token')
    if (storedAuth) {
      try { uid = JSON.parse(storedAuth).user.id } catch (e) {}
    }

    const channel = supabase.channel('student-global-notif', {
      config: { presence: { key: uid } }
    })
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const onlineSet = new Set()
      Object.keys(state).forEach(uid => onlineSet.add(uid))
      setGlobalOnlineUsers(onlineSet)
    })
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ role: 'admin' })
      }
    })
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ===== LOAD ORDERS =====
  useEffect(() => {
    async function loadOrders() {
      setLoading(true)
      setError('')
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
      if (selectedSite && !isAllSites) query = query.eq('site_id', selectedSite.id)
      const { data, error } = await query
      if (error) { setError(error.message); setOrders([]) }
      else setOrders(data || [])

      // Fetch order IDs that have a pending rework ([REWORK_REQ] not yet resolved)
      const { data: reworkMsgs } = await supabase
        .from('chat_messages')
        .select('message, session:chat_sessions!inner(order_id)')
        .like('message', '[REWORK_REQ]%')
      const { data: doneMsgs } = await supabase
        .from('chat_messages')
        .select('session:chat_sessions!inner(order_id)')
        .like('message', '[REWORK_DONE]%')
      if (reworkMsgs) {
        const doneIds = new Set((doneMsgs || []).map(m => m.session?.order_id).filter(Boolean))
        const pendingIds = new Set(
          reworkMsgs
            .map(m => m.session?.order_id)
            .filter(id => id && !doneIds.has(id))
        )
        setReworkOrderIds(pendingIds)
      }

      setLoading(false)
    }
    loadOrders()
  }, [selectedSite, isAllSites])

  // ===== REALTIME: new orders =====
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new
          // Filter by site if needed
          if (selectedSite && !isAllSites && newOrder.site_id !== selectedSite.id) return

          // Prepend to list
          setOrders(prev => [newOrder, ...prev])

          // Play sound
          playNewOrderSound()

          // Show banner
          clearTimeout(bannerTimerRef.current)
          setNewOrderBanner(newOrder)
          bannerTimerRef.current = setTimeout(() => setNewOrderBanner(null), 6000)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearTimeout(bannerTimerRef.current)
    }
  }, [selectedSite, isAllSites])

  async function updateStatus(orderId, status) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
    if (error) { alert(error.message); return }

    const order = orders.find(o => o.id === orderId)
    if (order && order.user_id) {
      const { createNotification } = await import('../lib/notifications')
      const orderNum = order.order_number?.replace('OD-', '') || order.id
      await createNotification(order.user_id, 'order', 'Order Status Updated', `Your order ${orderNum} is now marked as '${status}'.`)
    }

    // Fire-and-forget status-change email dedicated completion template
    // for status='completed', generic status template for everything else.
    // Both functions look up the order server-side.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const fnName = status === 'completed'
          ? 'send-order-completion-email'
          : 'send-order-status-email'
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            orderId,
            appOrigin: window.location.origin,
          }),
        }).catch(err => console.error(`${fnName} failed (non-critical):`, err.message))
      }
    } catch (_) { /* never block status change on email */ }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
  }

  const today = new Date().toDateString()

  const filteredOrders = orders.filter(order => {
    if (onlineFilter === 'online' && !(order.user_id && globalOnlineUsers.has(order.user_id))) return false
    if (onlineFilter === 'offline' && (order.user_id && globalOnlineUsers.has(order.user_id))) return false
    if (statusFilter === 'today') return new Date(order.created_at).toDateString() === today
    if (statusFilter !== 'all') return order.status === statusFilter
    return true
  })

  return (
    <AdminLayout title="Orders">
      {/* ── NEW ORDER BANNER ── */}
      {newOrderBanner && (
        <div
          onClick={() => { navigate(`/orders/${newOrderBanner.id}`); setNewOrderBanner(null) }}
          style={{
            position: 'fixed', top: 20, right: 24, zIndex: 9999,
            background: 'linear-gradient(135deg, #0f172a, #16a34a)',
            color: 'white', borderRadius: 14, padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 8px 32px rgba(22,163,74,0.35)',
            cursor: 'pointer', maxWidth: 340,
            animation: 'slideInRight 0.4s cubic-bezier(0.34,1.56,0.64,1)'
          }}
        >
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(120%); opacity: 0; }
              to   { transform: translateX(0);    opacity: 1; }
            }
          `}</style>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>🎉 New Order!</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {newOrderBanner.order_number || newOrderBanner.id} · {newOrderBanner.subject || 'No subject'}
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setNewOrderBanner(null) }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 className="admin-card-title">Orders</h3>
            <select
              className="admin-select"
              value={onlineFilter}
              onChange={e => setOnlineFilter(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '13px', minWidth: '120px' }}
            >
              <option value="all">All Users</option>
              <option value="online">Online Only</option>
              <option value="offline">Offline Only</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Live
            </span>
            <span style={{ color: '#6b7280', fontSize: '13px', fontWeight: 600 }}>{filteredOrders.length} total</span>
          </div>
        </div>

        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 20px 16px' }}>
          {STATUS_TABS.map(tab => {
            const active = statusFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                style={{
                  padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  border: `1.5px solid ${active ? tab.color : '#e5e7eb'}`,
                  background: active ? tab.color : 'white',
                  color: active ? 'white' : '#6b7280',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="admin-empty">Loading orders...</div>
        ) : error ? (
          <div className="admin-selector-error">⚠️ {error}</div>
        ) : orders.length === 0 ? (
          <div className="admin-empty">No orders found</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Created</th>
                  <th>Update</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const isOnline = order.user_id && globalOnlineUsers.has(order.user_id)
                  const isNew = newOrderBanner?.id === order.id
                  const hasRework = reworkOrderIds.has(order.id)
                  return (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      style={{
                        cursor: 'pointer', transition: 'background 0.15s',
                        background: hasRework ? '#fff1f2' : isNew ? '#f0fdf4' : '',
                        outline: hasRework ? '2px solid #fca5a5' : isNew ? '2px solid #16a34a' : 'none',
                        outlineOffset: -1
                      }}
                      onMouseEnter={e => { if (!isNew && !hasRework) e.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={e => { if (!isNew) e.currentTarget.style.background = '' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isNew && <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: 4 }}>NEW</span>}
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{order.order_number || order.id}</span>
                          <span
                            style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#10b981' : '#9ca3af', display: 'inline-block', flexShrink: 0 }}
                            title={isOnline ? 'Online' : 'Offline'}
                          />
                        </div>
                      </td>
                      <td>{order.subject || '-'}</td>
                      <td>
                        <span className={`admin-status-pill ${order.status}`}>{order.status || 'pending'}</span>
                        {hasRework && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: '#ef4444', color: 'white', padding: '2px 7px', borderRadius: 999, verticalAlign: 'middle', letterSpacing: '0.05em' }}>
                            REWORK
                          </span>
                        )}
                      </td>
                      <td>{order.payment_status || '-'}</td>
                      <td>{formatCurrency(order.paid_amount || order.price || 0)}</td>
                      <td>{formatDateTime(order.created_at)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <select
                          value={order.status?.toLowerCase() || 'pending'}
                          onChange={e => updateStatus(order.id, e.target.value)}
                          className="admin-select"
                        >
                          {(() => {
                            const isCompleted = order.status === 'completed'
                            const completedAt = order.completed_at ? new Date(order.completed_at) : null
                            const daysSince = completedAt ? (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24) : 0
                            const refundExpired = isCompleted && completedAt && daysSince > 15
                            return (<>
                              <option value="pending"    disabled={order.status === 'active' || isCompleted}>Pending</option>
                              <option value="in_review"  disabled={order.status === 'active' || isCompleted}>In Review</option>
                              <option value="active"     disabled={(order.payment_status === 'unpaid' && order.status !== 'active') || isCompleted}>Active</option>
                              <option value="completed"  disabled={order.payment_status !== 'paid' && order.status !== 'completed'}>Completed</option>
                              <option value="cancelled"  disabled={isCompleted}>Cancelled</option>
                              <option value="refunded"   disabled={(order.status !== 'active' && order.status !== 'completed' && order.status !== 'refunded') || refundExpired}>Refunded</option>
                            </>)
                          })()}
                        </select>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <Link
                          to={`/messages?tab=order&orderId=${order.id}`}
                          className="admin-btn admin-btn-outline"
                          style={{ padding: '6px', minWidth: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Message Student"
                        >
                          <MessageCircle size={16} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
