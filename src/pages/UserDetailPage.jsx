import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, ShieldOff, Package, DollarSign, Clock, CheckCircle, MessageCircle } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { formatDateTime, formatCurrency } from '../lib/stats'

const STATUS_COLOR = {
  pending:   { bg: '#fef3c7', text: '#d97706' },
  active:    { bg: '#dcfce7', text: '#16a34a' },
  in_review: { bg: '#ede9fe', text: '#7c3aed' },
  completed: { bg: '#dbeafe', text: '#2563eb' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
  refunded:  { bg: '#f1f5f9', text: '#64748b' },
}

export default function UserDetailPage() {
  const { userId } = useParams()
  const navigate   = useNavigate()

  const [user,    setUser]    = useState(null)
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [banning, setBanning] = useState(false)

  useEffect(() => { loadAll() }, [userId])

  async function loadAll() {
    setLoading(true)
    const [{ data: profile }, { data: userOrders }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    ])
    if (profile) setUser(profile)
    setOrders(userOrders || [])
    setLoading(false)
  }

  async function toggleBan() {
    setBanning(true)
    await supabase.from('profiles').update({ banned: !user.banned }).eq('id', userId)
    setUser(prev => ({ ...prev, banned: !prev.banned }))
    setBanning(false)
  }

  if (loading) return (
    <AdminLayout title="User Detail">
      <div className="admin-loading"><div className="admin-loading-spinner" /><p>Loading user...</p></div>
    </AdminLayout>
  )

  if (!user) return (
    <AdminLayout title="User Detail">
      <div className="admin-empty"><p>User not found</p></div>
    </AdminLayout>
  )

  const totalSpent   = orders.reduce((s, o) => s + (o.paid_amount || 0), 0)
  const completedCnt = orders.filter(o => o.status === 'completed').length
  const activeCnt    = orders.filter(o => o.status === 'active').length
  const pendingCnt   = orders.filter(o => o.status === 'pending').length
  const cancelledCnt = orders.filter(o => o.status === 'cancelled').length
  const initials     = (user.full_name || user.email || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const avatarColor  = user.banned ? '#dc2626' : user.role === 'admin' ? '#7c3aed' : '#16a34a'

  const statCards = [
    { icon: Package,    color: '#3b82f6', num: orders.length,             lbl: 'Total Orders' },
    { icon: Clock,      color: '#f59e0b', num: pendingCnt,                lbl: 'Pending' },
    { icon: CheckCircle,color: '#16a34a', num: completedCnt,              lbl: 'Completed' },
    { icon: DollarSign, color: '#16a34a', num: formatCurrency(totalSpent),lbl: 'Total Spent' },
  ]

  const breakdown = [
    { label: 'Completed', count: completedCnt, color: '#3b82f6' },
    { label: 'Active',    count: activeCnt,    color: '#16a34a' },
    { label: 'Pending',   count: pendingCnt,   color: '#f59e0b' },
    { label: 'Cancelled', count: cancelledCnt, color: '#ef4444' },
  ]

  return (
    <AdminLayout title="User Detail">
      <style>{`
        .ud-wrap  { display: grid; grid-template-columns: 300px 1fr; gap: 22px; align-items: start; }
        .ud-card  { background: white; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; }
        .ud-sec   { padding: 18px 22px; border-bottom: 1px solid #f1f5f9; }
        .ud-sec:last-child { border-bottom: none; }
        .ud-lbl   { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
        .ud-val   { font-size: 13px; font-weight: 700; color: #0f172a; word-break: break-all; }
        .ud-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 18px; }
        .ud-stat  { background: white; border-radius: 14px; border: 1px solid #e5e7eb; padding: 16px 18px; }
        .ud-order-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; margin-bottom: 10px; }
        .ud-order-card:last-child { margin-bottom: 0; }
        .ud-order-card:hover { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        @media (max-width: 860px) {
          .ud-wrap  { grid-template-columns: 1fr; }
          .ud-stats { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .ud-stats { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* Back + heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', flexShrink: 0 }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.full_name || 'Unnamed User'}
          </h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
        </div>
        {user.banned && (
          <span style={{ marginLeft: 'auto', padding: '5px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: 999, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>🚫 Banned</span>
        )}
      </div>

      <div className="ud-wrap">
        {/* ── LEFT: Profile sidebar ── */}
        <div>
          <div className="ud-card" style={{ marginBottom: 0 }}>
            {/* Avatar hero */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', padding: '28px 22px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'white', border: '3px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>{user.full_name || 'Unnamed'}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, wordBreak: 'break-all' }}>{user.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                {user.student_id && (
                  <span style={{ padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: 'rgba(255,255,255,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.35)', letterSpacing: '0.04em' }}>
                    ID {user.student_id}
                  </span>
                )}
                <span style={{ padding: '3px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: user.role === 'admin' ? '#7c3aed' : '#16a34a', color: 'white' }}>
                  {user.role || 'student'}
                </span>
              </div>
            </div>

            {/* Info fields */}
            <div className="ud-sec">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {[
                  ['Student ID',   user.student_id || '—'],
                  ['Phone',        user.phone || '—'],
                  ['Wallet',       formatCurrency(user.wallet_balance || 0)],
                  ['Member Since', formatDateTime(user.created_at)],
                  ['Last Updated', formatDateTime(user.updated_at)],
                  ['Site',         user.site_id || '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div className="ud-lbl" style={{ marginBottom: 0, flexShrink: 0 }}>{label}</div>
                    <div className="ud-val" style={{ textAlign: 'right', wordBreak: 'break-word', minWidth: 0 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="ud-sec">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link
                  to={`/messages?tab=user&userId=${user.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
                >
                  <MessageCircle size={16} /> Message User
                </Link>
                <button
                  onClick={toggleBan}
                  disabled={banning}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: user.banned ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: banning ? 'wait' : 'pointer', opacity: banning ? 0.7 : 1 }}
                >
                  {user.banned ? <><ShieldCheck size={16} /> Unban User</> : <><ShieldOff size={16} /> Ban User</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Stats + orders ── */}
        <div style={{ minWidth: 0 }}>

          {/* Stat cards 2×2 */}
          <div className="ud-stats">
            {statCards.map(({ icon: Icon, color, num, lbl }) => (
              <div key={lbl} className="ud-stat">
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Icon size={16} color={color} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{num}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginTop: 4 }}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* Breakdown bars */}
          <div className="ud-card" style={{ marginBottom: 18 }}>
            <div className="ud-sec">
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>Order Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {breakdown.map(({ label, count, color }) => {
                  const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                        <span style={{ color: '#374151' }}>{label}</span>
                        <span style={{ color }}>{count} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: 7, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Orders list as cards (no horizontal scroll) */}
          <div className="ud-card">
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>📦 Orders</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', background: '#f1f5f9', padding: '3px 10px', borderRadius: 999 }}>{orders.length} total</span>
            </div>

            <div style={{ padding: orders.length === 0 ? 0 : '14px 16px' }}>
              {orders.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No orders yet</div>
              ) : orders.map((order, i) => {
                const sc = STATUS_COLOR[order.status] || STATUS_COLOR.pending
                return (
                  <div
                    key={order.id}
                    className="ud-order-card"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    {/* Top row: order number + status + message btn */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {order.order_number || order.id.slice(0, 8)}
                      </span>
                      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.text, flexShrink: 0 }}>
                        {order.status || 'pending'}
                      </span>
                      <div onClick={e => e.stopPropagation()}>
                        <Link
                          to={`/messages?tab=order&orderId=${order.id}`}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', flexShrink: 0 }}
                          title="Message about this order"
                        >
                          <MessageCircle size={13} />
                        </Link>
                      </div>
                    </div>

                    {/* Detail row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                      {[
                        { label: 'Subject',  val: order.subject || '—',   color: '#374151' },
                        { label: 'Type',     val: order.type || '—',      color: '#374151' },
                        { label: 'Amount',   val: formatCurrency(order.paid_amount || order.price || 0), color: '#16a34a' },
                        { label: 'Deadline', val: order.deadline ? formatDateTime(order.deadline) : '—', color: '#ef4444' },
                        { label: 'Created',  val: formatDateTime(order.created_at), color: '#6b7280' },
                      ].map(({ label, val, color }) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 1 }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
