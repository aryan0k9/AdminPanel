import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { DollarSign, CheckCircle, Clock, Search, Send, X } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { formatDateTime, formatCurrency } from '../lib/stats'
import { useSite } from '../contexts/SiteContext'

// ── helpers ────────────────────────────────────────────────────
function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function parsePlan(order) {
  const raw = (order.payment_plan || '').toLowerCase()
  const m = raw.match(/^(weekly|biweekly)(\d+)$/)
  if (m) return { type: m[1], count: parseInt(m[2], 10) }
  if (raw === 'weekly')    return { type: 'weekly',   count: 4 }
  if (raw === 'biweekly')  return { type: 'biweekly', count: 2 }
  if (raw === 'splithalf') return { type: 'splithalf', count: 2 }
  return { type: 'full', count: 1 }
}

// ── Transaction Detail Modal ────────────────────────────────────
function TransactionModal({ order, onClose }) {
  const [txList, setTxList] = useState([])
  const [txLoading, setTxLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setTxLoading(true)
      // Fetch wallet transactions for this order (matched by order_number in description)
      if (order.user_id) {
        const { data } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', order.user_id)
          .eq('status', 'completed')
          .eq('type', 'debit')
          .order('created_at', { ascending: true })
        // Match by order_number, UUID id, or numeric id all possible description formats
        const orderRef  = order.order_number || ''
        const idStr     = String(order.id)
        const numOnly   = orderRef.replace(/^[A-Z]+-/i, '') // strip prefix e.g. "EA-"
        const relevant  = (data || []).filter(t => {
          const desc = t.description || ''
          return (
            (orderRef && desc.includes(orderRef)) ||
            (idStr    && desc.includes(idStr))    ||
            (numOnly  && desc.includes(numOnly))
          )
        })
        // Deduplicate by date proximity (card + wallet tx for same installment share timestamp)
        const deduped = relevant.filter((t, i) => {
          if (i === 0) return true
          const prev = relevant[i - 1]
          return Math.abs(new Date(t.created_at) - new Date(prev.created_at)) > 60_000
        })
        setTxList(deduped)
      }
      setTxLoading(false)
    }
    load()
  }, [order.id])

  const total     = order.price || 0
  const paid      = order.paid_amount || 0
  const remaining = Math.max(0, total - paid)
  const pct       = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0

  const { type: planType, count: explicitWeeks } = parsePlan(order)
  const weeks = (() => {
    if (explicitWeeks !== 1) return explicitWeeks
    if (txList.length > 0 && total > 0) {
      const singleAmt = Number(txList[0].amount)
      if (singleAmt > 0) {
        for (const n of [2, 4, 8, 16]) {
          if (Math.abs(singleAmt - total / n) < 1) return n
        }
      }
    }
    return explicitWeeks
  })()

  const daySpacing = planType === 'biweekly' ? 14 : 7
  const instAmt    = total > 0 ? total / weeks : 0
  // Math-based txList.length is unreliable when wallet payments share the same timestamp
  const paidWeeks  = instAmt > 0 ? Math.min(weeks, Math.round(paid / instAmt)) : txList.length
  const anchor     = txList[0]?.created_at || order.updated_at || order.created_at
  const fallbackPaidAt = order.updated_at || order.created_at

  const planLabel = planType === 'full' ? 'Full Payment'
    : planType === 'splithalf' ? 'Split (2 parts)'
    : planType === 'biweekly'  ? `Bi-Weekly (${weeks} parts)`
    : `Weekly (${weeks} parts)`
  const isPaid    = order.payment_status === 'paid'
  const isPartial = order.payment_status === 'partial'

  return (
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: '20px 22px 18px', color: 'white', position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onMouseDown={e => { e.stopPropagation(); onClose() }}
            style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', zIndex: 10 }}
          >
            <X size={16} />
          </button>
          <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.55, letterSpacing: '0.1em', marginBottom: 4 }}>TRANSACTION DETAILS</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{order.order_number || order.id}</div>
          <div style={{ fontSize: 13, opacity: 0.65, marginTop: 2 }}>{order.subject} · {order.type}</div>

          {/* Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>
            <span>Paid: <span style={{ color: '#4ade80' }}>{formatCurrency(paid)}</span></span>
            <span style={{ opacity: 0.7 }}>Remaining: {formatCurrency(remaining)}</span>
            <span style={{ opacity: 0.7 }}>Total: {formatCurrency(total)}</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#4ade80,#16a34a)', borderRadius: 999, transition: 'width 0.6s' }} />
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, opacity: 0.5, marginTop: 4 }}>{pct}% complete</div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '18px 20px' }}>

          {/* Badges row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ padding: '5px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
              📋 {planLabel}
            </span>
            <span style={{ padding: '5px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              background: isPaid ? '#dcfce7' : isPartial ? '#fef3c7' : '#fee2e2',
              color:      isPaid ? '#16a34a' : isPartial ? '#d97706' : '#dc2626',
              border: `1px solid ${isPaid ? '#bbf7d0' : isPartial ? '#fde68a' : '#fecaca'}` }}>
              ● {isPaid ? 'Fully Paid' : isPartial ? 'Partially Paid' : 'Unpaid'}
            </span>
            <span style={{ padding: '5px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
              ⏱ Order: {fmtDate(order.created_at)}
            </span>
          </div>

          {/* Order meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 18, padding: '14px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            {[
              ['Order ID',     order.order_number || order.id],
              ['Subject',      order.subject || '—'],
              ['Type',         order.type || '—'],
              ['Words',        order.word_count ? `${order.word_count.toLocaleString()} words` : '—'],
              ['Deadline',     order.deadline ? fmtDate(order.deadline) : '—'],
              ['Order Status', order.status || '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Payment Breakdown */}
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Payment Breakdown</div>
          {txLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>Loading transactions…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: weeks }, (_, i) => {
                const weekNum  = i + 1
                const isPaidWk = weekNum <= paidWeeks
                const tx       = txList[i]
                const dueDate  = addDays(anchor, i * daySpacing)
                const pct100   = Math.round(100 / weeks)

                return (
                  <div
                    key={weekNum}
                    style={{
                      borderRadius: 14, padding: '14px 16px',
                      background: isPaidWk ? '#f0fdf4' : '#fffbeb',
                      border: `1.5px solid ${isPaidWk ? '#86efac' : '#fde68a'}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                      {/* Icon */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: isPaidWk ? '#16a34a' : '#fef3c7',
                        border: isPaidWk ? 'none' : '2px solid #fde68a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: isPaidWk ? 17 : 18,
                      }}>
                        {isPaidWk ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : '⏳'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isPaidWk ? '#15803d' : '#0f172a' }}>
                          {weeks === 1 ? 'Full Payment' : `Week ${weekNum} ${pct100}%`}
                        </div>
                        {isPaidWk ? (
                          <div style={{ fontSize: 12, color: '#16a34a', marginTop: 3, fontWeight: 600 }}>
                            ✓ Paid<span style={{ color: '#6b7280', fontWeight: 500 }}> · ⏱ {fmtDate(tx?.created_at || fallbackPaidAt)}</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#d97706', marginTop: 3, fontWeight: 600 }}>
                            📅 Due: {fmtDate(dueDate)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: isPaidWk ? '#16a34a' : '#0f172a' }}>{formatCurrency(instAmt)}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{pct100}% of total</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', background: '#f8fafc', flexShrink: 0 }}>
          <Link
            to={`/orders/${order.id}`}
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', color: 'white', borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
          >
            📦 View Order
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightOrderId = searchParams.get('orderId') || ''

  const { selectedSite, isAllSites } = useSite()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('orders')
  const [transactions, setTransactions] = useState([])
  const [txLoading, setTxLoading] = useState(false)
  const [txSearch, setTxSearch] = useState('')

  // Request Form State
  const [requestOrderId, setRequestOrderId] = useState(highlightOrderId)
  const [requestAmount, setRequestAmount] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [allowedPlans, setAllowedPlans] = useState([])
  const [weeklyCount, setWeeklyCount] = useState(4)
  const [biweeklyCount, setBiweeklyCount] = useState(2)
  const [isSending, setIsSending] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [showPendingModal, setShowPendingModal] = useState(false)

  // Derived discount preview
  const discountPct = (() => {
    const orig = parseFloat(originalPrice)
    const offer = parseFloat(requestAmount)
    if (!orig || !offer || offer >= orig) return 0
    return Math.round((1 - offer / orig) * 100)
  })()
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [couponInfo, setCouponInfo] = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)

  // Only consider orders that have SOME payment activity for the table
  const paidOrders = orders.filter(o => o.paid_amount > 0 || o.payment_status === 'paid')
  const pendingRequests = orders.filter(o => o.payment_status !== 'paid' && o.price > 0)

  // Stats (calculated across all orders)
  const totalRevenue = orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0)
  const pendingRevenue = orders.reduce((sum, o) => {
    const total = o.price || 0
    const paid = o.paid_amount || 0
    return sum + Math.max(0, total - paid)
  }, 0)
  const fullyPaidOrders = orders.filter(o => o.payment_status === 'paid').length

  const loadOrders = async () => {
    setLoading(true)
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (selectedSite && !isAllSites) {
      query = query.eq('site_id', selectedSite.id)
    }

    const { data, error } = await query
    if (!error) {
      setOrders(data || [])

      // Auto-fill form if orderId passed
      if (highlightOrderId && data) {
        const targetOrder = data.find(o => String(o.id) === highlightOrderId)
        if (targetOrder) {
          setRequestOrderId(targetOrder.order_number || String(targetOrder.id))
          // Clean up URL so it doesn't stay there forever
          setSearchParams({})
        }
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
    loadTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSite, isAllSites])

  // When selected order changes, look up its coupon code
  useEffect(() => {
    setCouponInfo(null)
    if (!requestOrderId || !orders.length) return
    const order = orders.find(o => o.order_number === requestOrderId || String(o.id) === requestOrderId)
    if (!order?.coupon_code) return
    setCouponLoading(true)
    supabase
      .from('coupons')
      .select('code, discount_type, discount_value')
      .eq('code', order.coupon_code)
      .maybeSingle()
      .then(({ data }) => {
        setCouponInfo(data || null)
        setCouponLoading(false)
      })
  }, [requestOrderId, orders])

  // Auto-calculate offer price when original price changes and a coupon is present
  useEffect(() => {
    if (!couponInfo || !originalPrice) return
    const orig = parseFloat(originalPrice)
    if (isNaN(orig) || orig <= 0) return
    const offer = couponInfo.discount_type === 'percentage'
      ? orig * (1 - couponInfo.discount_value / 100)
      : Math.max(0, orig - couponInfo.discount_value)
    setRequestAmount(offer.toFixed(2))
  }, [originalPrice, couponInfo])

  const loadTransactions = async () => {
    setTxLoading(true)
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setTransactions(data)
    setTxLoading(false)
  }

  const handleSendPaymentRequest = async (e) => {
    e.preventDefault()
    if (!requestOrderId || !requestAmount) return

    setIsSending(true)
    try {
      // Find the actual order in the DB
      let targetOrder = orders.find(o => o.order_number === requestOrderId || String(o.id) === requestOrderId)

      if (!targetOrder) {
        alert("Order not found! Please check the Order ID.")
        setIsSending(false)
        return
      }

      // 1. Update the order total amount + ensure payment_status is 'unpaid'
      const offerAmt = parseFloat(requestAmount)
      const origAmt  = parseFloat(originalPrice) || null
      const discPct  = (origAmt && origAmt > offerAmt) ? Math.round((1 - offerAmt / origAmt) * 100) : 0

      // Core update price + status (always required)
      const { error: orderErr } = await supabase
        .from('orders')
        .update({ price: offerAmt, payment_status: 'unpaid' })
        .eq('id', targetOrder.id)

      if (orderErr) throw orderErr

      // Extended update new columns (skip silently if columns don't exist yet)
      await supabase.from('orders').update({
        original_price: origAmt,
        allowed_payment_plans: allowedPlans.join(',')
      }).eq('id', targetOrder.id).then(({ error }) => {
        if (error) console.warn('Extended fields not saved (run migration):', error.message)
      })

      // 2. Find or create the chat session for this order
      let sessionId = null
      const { data: sessions } = await supabase
        .from('chat_sessions')
        .select('id, unread_count')
        .eq('order_id', targetOrder.id)
        .eq('chat_type', 'order')
        .limit(1)

      if (sessions && sessions.length > 0) {
        sessionId = sessions[0].id
      } else if (targetOrder.user_id) {
        // No session yet create one so the message reaches the student
        const { data: newSession } = await supabase
          .from('chat_sessions')
          .insert({
            user_id:    targetOrder.user_id,
            order_id:   targetOrder.id,
            chat_type:  'order',
            unread_count: 0,
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single()
        if (newSession) sessionId = newSession.id
      }

      // 3. Insert payment request message into the session
      if (sessionId) {
        const discountLine = discPct > 0 ? `\n🎉 Special Offer: ${discPct}% off! (Original: $${origAmt.toFixed(2)})` : ''
        const plansLine = allowedPlans.length > 0 ? `\nPlans: ${allowedPlans.join(',')}` : ''
        const paymentMsg = `💰 PAYMENT REQUEST${discountLine}\n\nAmount Due: $${offerAmt.toFixed(2)}\nOrder: ${targetOrder.order_number || targetOrder.id}${plansLine}\n\nChoose a payment plan below to proceed. Thank you!`

        await supabase.from('chat_messages').insert({
          session_id:  sessionId,
          sender_type: 'admin',
          sender_name: 'Support',
          message:     paymentMsg,
          read:        false
        })
        await supabase.from('chat_sessions').update({
          last_message: `💰 Payment request: $${offerAmt.toFixed(2)}`,
          unread_count: 1,
          updated_at:   new Date().toISOString()
        }).eq('id', sessionId)
      }

      // 4. Send notification to student
      if (targetOrder.user_id) {
        const { createNotification } = await import('../lib/notifications')
        const orderNum = targetOrder.order_number?.replace('OD-', '') || targetOrder.id
        await createNotification(
          targetOrder.user_id,
          'payment',
          'Payment Requested',
          `A payment of $${parseFloat(requestAmount).toFixed(2)} has been requested for your order ${orderNum}.`
        )
      }

      // Fire-and-forget email notification to the student. The edge function
      // looks up the order server-side (amount, plans, discount, manager) so
      // the email content can't be spoofed by the caller.
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-payment-request-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              orderId: targetOrder.id,
              appOrigin: window.location.origin,
            }),
          }).catch(err => console.error('Payment-request email failed (non-critical):', err.message))
        }
      } catch (_) { /* never block success on email */ }

      setRequestAmount('')
      setOriginalPrice('')
      setRequestOrderId('')
      setAllowedPlans([])
      setWeeklyCount(4)
      setBiweeklyCount(2)
      loadOrders()

      const sentMsg = discPct > 0
        ? `Payment request of $${offerAmt.toFixed(2)} (${discPct}% off) sent!`
        : `Payment request of $${offerAmt.toFixed(2)} sent!`
      setSuccessMsg(`${sentMsg} Student has been notified.`)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      console.error("Error sending payment request:", err)
      alert("Error sending payment request: " + err.message)
    } finally {
      setIsSending(false)
    }
  }

  const handleEditRequest = (req) => {
    setShowPendingModal(false)
    setRequestOrderId(req.order_number || String(req.id))
    setRequestAmount(req.price || '')
    setSuccessMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filteredPaidOrders = paidOrders.filter(o =>
    (o.order_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (o.subject?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (String(o.id)).includes(searchTerm)
  )

  return (
    <AdminLayout title="Payments">
      <style>{`
        .payment-layout {
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 24px;
          align-items: start;
        }
        .request-box {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          border: 1px solid var(--border-color);
        }
        .request-box h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-color);
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 6px;
          color: var(--text-muted);
        }
        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-group input:focus {
          border-color: #10b981;
        }
      `}</style>

      {/* STATS HEADER */}
      <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A' }}>
            <DollarSign size={24} />
          </div>
          <div className="admin-stat-info">
            <h4>Total Revenue</h4>
            <div className="admin-stat-value">{formatCurrency(totalRevenue)}</div>
          </div>
        </div>

        <div
          className="admin-stat-card"
          onClick={() => setShowPendingModal(true)}
          style={{ cursor: 'pointer', transition: 'all 0.2s', border: '2px solid transparent' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#F59E0B'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'transparent'; }}
        >
          <div className="admin-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
            <Clock size={24} />
          </div>
          <div className="admin-stat-info">
            <h4>Pending Payments</h4>
            <div className="admin-stat-value">{formatCurrency(pendingRevenue)}</div>
            <div style={{ fontSize: '11px', color: '#F59E0B', marginTop: '4px', fontWeight: 600 }}>Click to view details →</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
            <CheckCircle size={24} />
          </div>
          <div className="admin-stat-info">
            <h4>Fully Paid Orders</h4>
            <div className="admin-stat-value">{fullyPaidOrders}</div>
          </div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { key: 'orders', label: '📋 Order Payments' },
          { key: 'ledger', label: '📒 Transaction Ledger' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13,
            background: activeTab === tab.key ? '#0f172a' : '#f1f5f9',
            color: activeTab === tab.key ? 'white' : '#475569',
          }}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'ledger' && (() => {
        // Extract order number from description e.g. "Wallet payment for Order OD-123"
        const extractOrder = (desc = '') => {
          const m = desc.match(/Order\s+(OD-\S+)/i)
          return m ? m[1] : null
        }
        const getTag = (desc = '') => {
          if (desc.includes('Welcome bonus')) return { label: '🎁 Bonus', bg: '#fef9c3', color: '#854d0e' }
          if (desc.includes('Wallet top-up')) return { label: '⬆️ Top-up', bg: '#dbeafe', color: '#1d4ed8' }
          if (desc.includes('Wallet payment')) return { label: '👛 W-Paid', bg: '#ede9fe', color: '#7c3aed' }
          if (desc.includes('Card payment')) return { label: '💳 C-Paid', bg: '#dcfce7', color: '#15803d' }
          return { label: '💰 Other', bg: '#f1f5f9', color: '#475569' }
        }
        const filtered = transactions.filter(t =>
          (t.description?.toLowerCase() || '').includes(txSearch.toLowerCase()) ||
          (t.user_id?.toLowerCase() || '').includes(txSearch.toLowerCase())
        )
        return (
          <div className="admin-card" style={{ margin: 0 }}>
            <div className="admin-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 className="admin-card-title">Transaction Ledger</h3>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="Search order / user..." className="admin-input"
                    style={{ paddingLeft: 30, fontSize: 13, width: 220 }}
                    value={txSearch} onChange={e => setTxSearch(e.target.value)} />
                </div>
              </div>
              <span>{filtered.length} records</span>
            </div>
            {txLoading ? (
              <div className="admin-empty">Loading transactions...</div>
            ) : filtered.length === 0 ? (
              <div className="admin-empty">No transactions found.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Order ID</th>
                      <th>Amount</th>
                      <th>User</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(tx => {
                      const tag = getTag(tx.description)
                      const orderNum = extractOrder(tx.description)
                      return (
                        <tr key={tx.id}>
                          <td>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                              background: tag.bg, color: tag.color, letterSpacing: '0.03em'
                            }}>
                              {tag.label}
                            </span>
                          </td>
                          <td>
                            {orderNum ? (
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', fontFamily: 'monospace' }}>
                                {orderNum.replace('OD-', '')}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 700, fontSize: 14, color: tx.type === 'credit' ? '#16a34a' : '#dc2626' }}>
                            {tx.type === 'credit' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                          </td>
                          <td style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
                            {tx.user_id?.slice(0, 8)}…
                          </td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{formatDateTime(tx.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {activeTab === 'orders' && <div className="payment-layout">
        {/* LEFT COL: Request Payment Form + Pending Requests */}
        <div className="payment-left-col">
          <div className="request-box">
            <h3>Request Payment</h3>

            {/* Success Toast */}
            {successMsg && (
              <div style={{
                background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px',
                padding: '12px 16px', marginBottom: '16px', fontSize: '13px',
                color: '#065f46', display: 'flex', gap: '8px', alignItems: 'center'
              }}>
                ✅ {successMsg}
              </div>
            )}

            <form onSubmit={handleSendPaymentRequest}>
              <div className="form-group">
                <label>Select Order</label>
                <select
                  value={requestOrderId}
                  onChange={e => setRequestOrderId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '14px', outline: 'none', background: 'white' }}
                >
                  <option value="">-- Select an Order --</option>
                  {orders
                    .filter(o => !o.price || o.price === 0 || requestOrderId === (o.order_number || String(o.id)))
                    .map(o => (
                      <option key={o.id} value={o.order_number || String(o.id)}>
                        {o.order_number || o.id} {o.subject || 'No subject'}
                      </option>
                    ))}
                </select>
              </div>

              {/* Coupon info banner */}
              {couponLoading && (
                <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 14, fontSize: 13, color: '#64748b' }}>
                  🔍 Looking up coupon…
                </div>
              )}
              {couponInfo && (
                <div style={{ padding: '12px 14px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid #86efac', borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🎟️</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#15803d' }}>
                      Coupon: <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{couponInfo.code}</span>
                      {' '}
                      {couponInfo.discount_type === 'percentage' ? `${couponInfo.discount_value}% OFF` : `$${couponInfo.discount_value} OFF`}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      Offer price will be auto-calculated from the original price
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Original Price (optional shown as crossed out)</label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 500.00"
                    value={originalPrice}
                    onChange={e => setOriginalPrice(e.target.value)}
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  Offer Price in $
                  {couponInfo && (
                    <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 700, fontSize: 11, background: '#dcfce7', padding: '2px 7px', borderRadius: 999 }}>
                      ✓ auto-calculated
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="0.00"
                    value={requestAmount}
                    onChange={e => setRequestAmount(e.target.value)}
                    style={{ paddingLeft: '36px', borderColor: requestAmount ? '#16a34a' : undefined, background: couponInfo ? '#f0fdf4' : undefined }}
                    required
                  />
                </div>
              </div>

              {/* Payment Plan Options */}
              <div className="form-group">
                <label>Allow Payment Plans</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>

                  {/* Full Payment + Split Half */}
                  {[
                    { key: 'full',      icon: '⚡', label: 'Full Payment', desc: 'Pay full amount at once' },
                    { key: 'splithalf', icon: '✂️', label: 'Split Half',   desc: '50% before work starts, 50% before submission' },
                  ].map(plan => {
                    const checked = allowedPlans.includes(plan.key)
                    return (
                      <label
                        key={plan.key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                          border: `2px solid ${checked ? '#16a34a' : '#e5e7eb'}`,
                          background: checked ? '#f0fdf4' : 'white',
                          transition: 'all 0.15s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setAllowedPlans(prev =>
                            checked ? prev.filter(p => p !== plan.key) : [...prev, plan.key]
                          )}
                          style={{ width: 16, height: 16, accentColor: '#16a34a', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{plan.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: checked ? '#15803d' : '#374151' }}>{plan.label}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{plan.desc}</div>
                        </div>
                        {checked && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>✓ ON</span>}
                      </label>
                    )
                  })}

                  {/* Bi-Weekly plan with installment radio buttons */}
                  {(() => {
                    const bwChecked = allowedPlans.some(p => p.startsWith('biweekly'))
                    const pct = Math.round(100 / biweeklyCount)
                    return (
                      <div style={{
                        borderRadius: 10, border: `2px solid ${bwChecked ? '#16a34a' : '#e5e7eb'}`,
                        background: bwChecked ? '#f0fdf4' : 'white', transition: 'all 0.15s', overflow: 'hidden'
                      }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={bwChecked}
                            onChange={() => {
                              if (bwChecked) {
                                setAllowedPlans(prev => prev.filter(p => !p.startsWith('biweekly')))
                              } else {
                                setAllowedPlans(prev => [...prev, `biweekly${biweeklyCount}`])
                              }
                            }}
                            style={{ width: 16, height: 16, accentColor: '#16a34a', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 16, flexShrink: 0 }}>📅</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: bwChecked ? '#15803d' : '#374151' }}>
                              Bi-Weekly ({biweeklyCount} parts)
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                              {pct}% every 2 weeks × {biweeklyCount}
                            </div>
                          </div>
                          {bwChecked && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>✓ ON</span>}
                        </label>
                        {bwChecked && (
                          <div style={{ display: 'flex', gap: 8, padding: '0 12px 12px 40px', flexWrap: 'wrap' }}>
                            {[2, 4, 8].map(n => (
                              <label
                                key={n}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                                  border: `1.5px solid ${biweeklyCount === n ? '#16a34a' : '#d1d5db'}`,
                                  background: biweeklyCount === n ? '#dcfce7' : '#f9fafb',
                                  fontSize: 13, fontWeight: 700,
                                  color: biweeklyCount === n ? '#15803d' : '#374151',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <input
                                  type="radio"
                                  name="biweeklyCount"
                                  value={n}
                                  checked={biweeklyCount === n}
                                  onChange={() => {
                                    setBiweeklyCount(n)
                                    setAllowedPlans(prev => [
                                      ...prev.filter(p => !p.startsWith('biweekly')),
                                      `biweekly${n}`
                                    ])
                                  }}
                                  style={{ accentColor: '#16a34a', width: 14, height: 14 }}
                                />
                                {n} parts
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Weekly plan with installment radio buttons */}
                  {(() => {
                    const weeklyChecked = allowedPlans.some(p => p.startsWith('weekly'))
                    const pct = Math.round(100 / weeklyCount)
                    return (
                      <div style={{
                        borderRadius: 10, border: `2px solid ${weeklyChecked ? '#16a34a' : '#e5e7eb'}`,
                        background: weeklyChecked ? '#f0fdf4' : 'white', transition: 'all 0.15s', overflow: 'hidden'
                      }}>
                        {/* Checkbox row */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={weeklyChecked}
                            onChange={() => {
                              if (weeklyChecked) {
                                setAllowedPlans(prev => prev.filter(p => !p.startsWith('weekly')))
                              } else {
                                setAllowedPlans(prev => [...prev, `weekly${weeklyCount}`])
                              }
                            }}
                            style={{ width: 16, height: 16, accentColor: '#16a34a', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 16, flexShrink: 0 }}>🗓️</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: weeklyChecked ? '#15803d' : '#374151' }}>
                              Weekly ({weeklyCount} parts)
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                              {pct}% each week × {weeklyCount}
                            </div>
                          </div>
                          {weeklyChecked && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>✓ ON</span>}
                        </label>

                        {/* Installment radio buttons shown only when weekly is checked */}
                        {weeklyChecked && (
                          <div style={{
                            display: 'flex', gap: 8, padding: '0 12px 12px 40px', flexWrap: 'wrap'
                          }}>
                            {[4, 8, 16].map(n => (
                              <label
                                key={n}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                                  border: `1.5px solid ${weeklyCount === n ? '#16a34a' : '#d1d5db'}`,
                                  background: weeklyCount === n ? '#dcfce7' : '#f9fafb',
                                  fontSize: 13, fontWeight: 700,
                                  color: weeklyCount === n ? '#15803d' : '#374151',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <input
                                  type="radio"
                                  name="weeklyCount"
                                  value={n}
                                  checked={weeklyCount === n}
                                  onChange={() => {
                                    setWeeklyCount(n)
                                    setAllowedPlans(prev => [
                                      ...prev.filter(p => !p.startsWith('weekly')),
                                      `weekly${n}`
                                    ])
                                  }}
                                  style={{ accentColor: '#16a34a', width: 14, height: 14 }}
                                />
                                {n} weeks
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                </div>
                {allowedPlans.length === 0 && requestAmount && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6, fontWeight: 600 }}>⚠ Select at least one payment plan</div>
                )}
              </div>

              {/* Live discount preview */}
              {discountPct > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 22 }}>🎉</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#15803d' }}>{discountPct}% Discount Applied</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      <span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>${parseFloat(originalPrice).toFixed(2)}</span>
                      {' → '}
                      <span style={{ fontWeight: 700, color: '#16a34a' }}>${parseFloat(requestAmount).toFixed(2)}</span>
                      {' '}
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        (Save ${(parseFloat(originalPrice) - parseFloat(requestAmount)).toFixed(2)})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="admin-btn"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', padding: '12px', fontSize: '14px' }}
                disabled={isSending || allowedPlans.length === 0}
              >
                <Send size={16} />
                {isSending ? 'Sending...' : 'Send Request'}
              </button>
            </form>
          </div>

          {/* Removed pending requests list from here as it is now in a modal */}
        </div>

        {/* RIGHT COL: Paid Orders Table */}
        <div className="admin-card" style={{ margin: 0 }}>
          <div className="admin-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <h3 className="admin-card-title">Successful Payments</h3>
              <div className="admin-search-wrapper" style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search paid orders..."
                  className="admin-input"
                  style={{ paddingLeft: '30px', paddingRight: '10px', py: '6px', fontSize: '13px', width: '200px' }}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <span>{filteredPaidOrders.length} records</span>
          </div>

          {loading ? (
            <div className="admin-empty">Loading payments...</div>
          ) : filteredPaidOrders.length === 0 ? (
            <div className="admin-empty">No successful payments found yet.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Subject</th>
                    <th>Total Due</th>
                    <th>Amount Paid</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPaidOrders.map(order => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '' }}
                    >
                      <td><strong>{order.order_number?.replace('OD-', '') || order.id}</strong></td>
                      <td>{order.subject || '-'}</td>
                      <td>{formatCurrency(order.price || 0)}</td>
                      <td style={{ color: '#16A34A', fontWeight: 600 }}>
                        {formatCurrency(order.paid_amount || 0)}
                      </td>
                      <td>
                        <span className={`admin-status-pill ${order.payment_status || 'unpaid'}`}>
                          {order.payment_status || 'unpaid'}
                        </span>
                      </td>
                      <td>{formatDateTime(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>}

      {/* PENDING PAYMENTS MODAL */}
      {showPendingModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#f8fafc', borderRadius: '16px 16px 0 0'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock color="#f59e0b" size={24} /> Pending Payments
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Orders awaiting payment from the student.
                </p>
              </div>
              <button
                onClick={() => setShowPendingModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', color: '#94a3b8', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {pendingRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                  <h3>No pending payments!</h3>
                  <p>All requested payments have been completed.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {pendingRequests.map(req => {
                    const total = req.price || 0
                    const paid = req.paid_amount || 0
                    const remaining = Math.max(0, total - paid)
                    const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
                    const editDisabled = paid > 0

                    return (
                      <div key={req.id} style={{
                        border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px',
                        background: 'white', position: 'relative', overflow: 'hidden'
                      }}>
                        {/* Status bar top */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#fef3c7' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#f59e0b' }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                              {req.order_number?.replace('OD-', '') || req.id}
                            </strong>
                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
                              {req.subject || 'No subject'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706' }}>
                              ${remaining.toFixed(2)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' }}>
                              <button
                                onClick={editDisabled ? undefined : () => handleEditRequest(req)}
                                disabled={editDisabled}
                                title={editDisabled ? 'Cannot edit student has already made a payment' : 'Edit this quote'}
                                style={{
                                  background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, padding: 0,
                                  color: editDisabled ? '#94a3b8' : '#3b82f6',
                                  cursor: editDisabled ? 'not-allowed' : 'pointer',
                                  textDecoration: editDisabled ? 'none' : 'underline',
                                  opacity: editDisabled ? 0.6 : 1
                                }}
                              >
                                {editDisabled ? '🔒 Locked' : 'Edit Quote'}
                              </button>
                              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Amount Due
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #e5e7eb',
                          fontSize: '12px'
                        }}>
                          <span style={{ color: '#64748b' }}>
                            Total Price: <strong>${total.toFixed(2)}</strong>
                          </span>
                          <span style={{ color: '#64748b' }}>
                            Amount Paid: <strong style={{ color: '#10b981' }}>${paid.toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', background: '#f8fafc', borderRadius: '0 0 16px 16px', textAlign: 'right' }}>
              <button
                onClick={() => setShowPendingModal(false)}
                className="admin-btn"
                style={{ background: '#e2e8f0', color: '#475569', padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION DETAIL MODAL */}
      {selectedOrder && (
        <TransactionModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

    </AdminLayout>
  )
}