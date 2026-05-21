import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Clock, Package, AlertCircle, Search, X } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { formatDateTime, formatCurrency } from '../lib/stats'
import { createNotification } from '../lib/notifications'
import { getAllExperts } from '../data/experts'

// ── payment helpers ─────────────────────────────────────────────
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d }
function nextWeekWednesday(date) {
  if (!date) return null
  const d = new Date(date)
  const day = d.getDay()
  const toNextMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + toNextMonday + 2)
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
  if (raw === 'weekly')   return { type: 'weekly',   count: 4 }
  if (raw === 'biweekly') return { type: 'biweekly', count: 2 }
  if (raw === 'splithalf') return { type: 'splithalf', count: 2 }
  return { type: 'full', count: 1 }
}

const STATUS_OPTIONS = ['pending', 'in_review', 'active', 'completed', 'cancelled', 'refunded']

const STATUS_COLOR = {
  pending:   { bg: '#fef3c7', text: '#d97706', dot: '#f59e0b' },
  active:    { bg: '#dcfce7', text: '#16a34a', dot: '#22c55e' },
  in_review: { bg: '#ede9fe', text: '#7c3aed', dot: '#8b5cf6' },
  completed: { bg: '#dbeafe', text: '#2563eb', dot: '#3b82f6' },
  cancelled: { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444' },
  refunded:  { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
}

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showExpertPicker, setShowExpertPicker] = useState(false)
  const [expertSearch, setExpertSearch] = useState('')
  const [assigningExpert, setAssigningExpert] = useState(false)
  const [orderFiles, setOrderFiles] = useState([])
  const [chatFiles, setChatFiles] = useState([])
  const [downloadingFile, setDownloadingFile] = useState(null)
  const [txList, setTxList] = useState([])
  const [txLoading, setTxLoading] = useState(false)
  const [orderAddons, setOrderAddons] = useState([])
  const [addonsLoading, setAddonsLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fileFilter, setFileFilter] = useState('all') // 'all' | 'you' | 'student'
  const [managers, setManagers] = useState([])
  const [assignedManagerId, setAssignedManagerId] = useState('')
  const [savingManager, setSavingManager] = useState(false)

  const allExperts = useMemo(() => getAllExperts(), [])
  const filteredExperts = useMemo(() => {
    const q = expertSearch.trim().toLowerCase()
    if (!q) return allExperts.slice(0, 30)
    return allExperts.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.primarySubject.toLowerCase().includes(q) ||
      e.university.toLowerCase().includes(q)
    ).slice(0, 30)
  }, [allExperts, expertSearch])

  useEffect(() => {
    loadOrder()
    loadFiles()
    loadManagers()
  }, [orderId])

  useEffect(() => {
    if (order?.user_id && order?.price > 0) loadTransactions()
    loadOrderAddons()
    if (order?.user_id) loadAssignedManager(order.user_id)
  }, [order?.id])

  async function loadManagers() {
    const { data } = await supabase
      .from('managers')
      .select('id, name, internal_name')
      .order('name', { ascending: true })
    setManagers(data || [])
  }

  async function loadAssignedManager(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('manager_id')
      .eq('id', userId)
      .maybeSingle()
    setAssignedManagerId(data?.manager_id || '')
  }

  async function handleAssignManager(newManagerId) {
    if (!order?.user_id) return
    setSavingManager(true)
    const value = newManagerId || null
    const { error } = await supabase
      .from('profiles')
      .update({ manager_id: value })
      .eq('id', order.user_id)
    if (error) {
      alert(`Could not save manager: ${error.message}`)
    } else {
      setAssignedManagerId(newManagerId)

      // Fire-and-forget manager-assigned email. Only when a manager
      // is actually assigned (not when removed/cleared). Function
      // looks up the user's current manager server-side so the
      // email content always matches the DB state.
      if (value) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-manager-assigned-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                userId: order.user_id,
                appOrigin: window.location.origin,
              }),
            }).catch(err => console.error('Manager email failed (non-critical):', err.message))
          }
        } catch (_) { /* never block assignment on email */ }
      }
    }
    setSavingManager(false)
  }

  async function loadOrderAddons() {
    setAddonsLoading(true)
    const { data } = await supabase
      .from('order_addons')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'completed')
      .order('created_at', { ascending: true })
    setOrderAddons(data || [])
    setAddonsLoading(false)
  }

  async function loadTransactions() {
    setTxLoading(true)
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', order.user_id)
      .eq('status', 'completed')
      .eq('type', 'debit')
      .order('created_at', { ascending: true })
    const orderRef = order.order_number || ''
    const idStr    = String(order.id)
    const numOnly  = orderRef.replace(/^[A-Z]+-/i, '')
    const relevant = (data || []).filter(t => {
      const desc = t.description || ''
      return (orderRef && desc.includes(orderRef)) || desc.includes(idStr) || (numOnly && desc.includes(numOnly))
    })
    // Deduplicate card+wallet entries within same minute
    const deduped = relevant.filter((t, i) => {
      if (i === 0) return true
      return Math.abs(new Date(t.created_at) - new Date(relevant[i - 1].created_at)) > 60_000
    })
    setTxList(deduped)
    setTxLoading(false)
  }

  async function loadOrder() {
    setLoading(true)
    const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (!error && data) setOrder(data)
    setLoading(false)
  }

  async function loadFiles() {
    // 1. Files from order_files table
    const { data: dbFiles } = await supabase
      .from('order_files')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
    setOrderFiles(dbFiles || [])

    // 2. Files embedded in chat messages as [FILE:::path:::name]
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('order_id', orderId)

    if (!sessions || sessions.length === 0) return

    const sessionIds = sessions.map(s => s.id)
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, message, sender_name, sender_type, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true })

    const parsed = []
    if (msgs) {
      for (const msg of msgs) {
        const matches = [...msg.message.matchAll(/\[FILE:::([^:]+):::([^\]]+)\]/g)]
        if (matches.length === 0) continue
        const messageText = msg.message.replace(/\[FILE:::([^:]+):::([^\]]+)\]/g, '').trim()
        for (const m of matches) {
          parsed.push({
            id: `${msg.id}_${m[1]}`,
            file_path: m[1],
            file_name: m[2],
            sender_type: msg.sender_type,
            message_text: messageText,
            created_at: msg.created_at
          })
        }
      }
    }
    setChatFiles(parsed)
  }

  async function downloadFile(filePath, fileId) {
    setDownloadingFile(fileId)
    const { data, error } = await supabase.storage
      .from('order-files')
      .createSignedUrl(filePath, 3600)
    setDownloadingFile(null)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else alert('File unavailable or expired.')
  }

  function getFileIcon(name = '') {
    const ext = name.split('.').pop()?.toLowerCase()
    const map = { pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', csv: '📗', ppt: '📙', pptx: '📙', txt: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', zip: '🗜️', rar: '🗜️' }
    return map[ext] || '📎'
  }

  function formatFileSize(bytes) {
    if (!bytes) return ''
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  async function handleStatusChange(newStatus) {
    setUpdatingStatus(true)
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    if (order?.user_id) {
      const orderNum = order.order_number || order.id
      await createNotification(order.user_id, 'order', 'Order Status Updated', `Your order ${orderNum} is now marked as '${newStatus}'.`)
    }
    setOrder(prev => ({ ...prev, status: newStatus }))

    // Fire-and-forget status-change email via Brevo. Dedicated 'completion'
    // template for status='completed' (richer download-focused email);
    // generic status template for everything else. Both edge functions
    // look up the order server-side, so the email reflects DB state.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const fnName = newStatus === 'completed'
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

    setUpdatingStatus(false)
  }

  async function assignExpert(expert) {
    setAssigningExpert(true)
    await supabase.from('orders').update({
      expert_name: expert.name,
      expert_avatar: expert.avatarUrl
    }).eq('id', orderId)
    if (order?.user_id) {
      await createNotification(order.user_id, 'order', 'Expert Assigned!',
        `${expert.name} has been assigned to your order ${order.order_number || orderId}.`)
    }
    setOrder(prev => ({ ...prev, expert_name: expert.name, expert_avatar: expert.avatarUrl }))
    setShowExpertPicker(false)
    setExpertSearch('')
    setAssigningExpert(false)
  }

  async function removeExpert() {
    await supabase.from('orders').update({ expert_name: null, expert_avatar: null }).eq('id', orderId)
    setOrder(prev => ({ ...prev, expert_name: null, expert_avatar: null }))
  }

  async function deleteOrder() {
    setDeleting(true)
    try {
      // Remove chat sessions (messages cascade via FK)
      const { data: sessions } = await supabase.from('chat_sessions').select('id').eq('order_id', orderId)
      if (sessions?.length) {
        const ids = sessions.map(s => s.id)
        await supabase.from('chat_messages').delete().in('session_id', ids)
        await supabase.from('chat_sessions').delete().in('id', ids)
      }
      // Remove files, then the order
      await supabase.from('order_files').delete().eq('order_id', orderId)
      await supabase.from('orders').delete().eq('id', orderId)
      navigate('/orders')
    } catch {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  if (loading) return (
    <AdminLayout title="Order Detail">
      <div className="admin-loading"><div className="admin-loading-spinner" /><p>Loading order...</p></div>
    </AdminLayout>
  )

  if (!order) return (
    <AdminLayout title="Order Detail">
      <div className="admin-empty"><Package size={40} strokeWidth={1.5} /><p>Order not found</p></div>
    </AdminLayout>
  )

  const sc = STATUS_COLOR[order.status] || STATUS_COLOR.pending

  return (
    <AdminLayout title="Order Detail">
      <style>{`
        .od-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
        .od-card { background: white; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; }
        .od-section { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; }
        .od-section:last-child { border-bottom: none; }
        .od-section-title { font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .od-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; }
        .od-field label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; display: block; margin-bottom: 4px; }
        .od-field span { font-size: 13px; font-weight: 700; color: #0f172a; }
        .od-status-btn { padding: 8px 16px; border-radius: 999px; border: 2px solid transparent; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .od-status-btn.active-s { transform: scale(1.05); }
        @media (max-width: 900px) { .od-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{order.order_number || order.id}</h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{order.subject} · {order.type}</div>
        </div>
        <span style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: sc.bg, color: sc.text }}>
          ● {order.status?.toUpperCase()}
        </span>
      </div>

      <div className="od-grid">
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Order Info */}
          <div className="od-card">
            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', padding: '18px 24px', color: 'white' }}>
              <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 700, letterSpacing: '0.08em' }}>ORDER INFORMATION</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{order.title || `${order.subject} ${order.type}`}</div>
            </div>
            <div className="od-section">
              <div className="od-fields">
                <div className="od-field"><label>Subject</label><span>{order.subject || '—'}</span></div>
                <div className="od-field"><label>Type</label><span>{order.type || '—'}</span></div>
                <div className="od-field"><label>Academic Level</label><span>{order.academic_level || '—'}</span></div>
                <div className="od-field"><label>Formatting Style</label><span>{order.formatting_style || '—'}</span></div>
                <div className="od-field"><label>Word Count</label><span>{order.word_count ? `${order.word_count.toLocaleString()} words` : '—'}</span></div>
                <div className="od-field"><label>Pages</label><span>{order.pages ? `${order.pages} pages` : '—'}</span></div>
                <div className="od-field"><label>Deadline</label><span style={{ color: '#ef4444' }}>{order.deadline ? formatDateTime(order.deadline) : '—'}</span></div>
                <div className="od-field"><label>Created</label><span>{formatDateTime(order.created_at)}</span></div>
                <div className="od-field" style={{ gridColumn: '1 / -1', marginTop: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Coupon Code</label>
                  {order.coupon_code ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '2px solid #86efac', borderRadius: 10, padding: '10px 16px' }}>
                      <span style={{ fontSize: 22 }}>🎟️</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 900, color: '#15803d', letterSpacing: '0.1em' }}>{order.coupon_code}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#bbf7d0', borderRadius: 5, padding: '2px 8px' }}>Applied</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>No coupon applied</span>
                  )}
                </div>
              </div>
            </div>

            {order.description && (
              <div className="od-section">
                <div className="od-section-title">📝 Instructions</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                  {order.description}
                </div>
              </div>
            )}
          </div>

          {/* Files */}
          {(orderFiles.length > 0 || chatFiles.length > 0) && (() => {
            const filteredOrderFiles = orderFiles.filter(f =>
              fileFilter === 'all' ? true : fileFilter === 'you' ? f.uploaded_by === 'admin' : f.uploaded_by !== 'admin'
            )
            const filteredChatFiles = chatFiles.filter(f =>
              fileFilter === 'all' ? true : fileFilter === 'you' ? f.sender_type === 'agent' : f.sender_type !== 'agent'
            )
            const totalAll     = orderFiles.length + chatFiles.length
            const totalYou     = orderFiles.filter(f => f.uploaded_by === 'admin').length + chatFiles.filter(f => f.sender_type === 'agent').length
            const totalStudent = orderFiles.filter(f => f.uploaded_by !== 'admin').length + chatFiles.filter(f => f.sender_type !== 'agent').length
            return (
            <div className="od-card">
              <div className="od-section">
                {/* Header + filter pills */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div className="od-section-title" style={{ margin: 0 }}>📎 Files</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { key: 'all',     label: `All (${totalAll})` },
                      { key: 'you',     label: `Sent by you (${totalYou})` },
                      { key: 'student', label: `From student (${totalStudent})` },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setFileFilter(key)}
                        style={{
                          padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                          background: fileFilter === key
                            ? key === 'you' ? '#7c3aed' : key === 'student' ? '#16a34a' : '#0f172a'
                            : '#f1f5f9',
                          color: fileFilter === key ? 'white' : '#64748b',
                          transition: 'all 0.15s',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredOrderFiles.length > 0 && (
                  <div style={{ marginBottom: filteredChatFiles.length > 0 ? 20 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                      Order Attachments ({filteredOrderFiles.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {filteredOrderFiles.map(f => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                          <span style={{ fontSize: 20, flexShrink: 0 }}>{getFileIcon(f.file_name)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file_name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              <span style={{ fontWeight: 600, color: f.uploaded_by === 'admin' ? '#7c3aed' : '#16a34a' }}>
                                {f.uploaded_by === 'admin' ? 'Sent by you' : 'From student'}
                              </span>
                              {f.file_size > 0 && <span>{formatFileSize(f.file_size)}</span>}
                              <span>{formatDateTime(f.created_at)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => downloadFile(f.file_path, f.id)}
                            disabled={downloadingFile === f.id}
                            style={{ flexShrink: 0, background: '#0f172a', color: 'white', border: 'none', borderRadius: 7, padding: '6px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            {downloadingFile === f.id ? '…' : '⬇ Get'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filteredChatFiles.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                      Shared in Chat ({filteredChatFiles.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {filteredChatFiles.map(f => {
                        const isAdmin = f.sender_type === 'agent'
                        return (
                          <div key={f.id} style={{ borderRadius: 10, border: `1px solid ${isAdmin ? '#ede9fe' : '#e5e7eb'}`, background: isAdmin ? '#faf5ff' : '#f8fafc', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                              <span style={{ fontSize: 20, flexShrink: 0 }}>{getFileIcon(f.file_name)}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file_name}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  <span style={{ fontWeight: 600, color: isAdmin ? '#7c3aed' : '#16a34a' }}>
                                    {isAdmin ? 'Sent by you' : 'From student'}
                                  </span>
                                  <span>{formatDateTime(f.created_at)}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => downloadFile(f.file_path, f.id)}
                                disabled={downloadingFile === f.id}
                                style={{ flexShrink: 0, background: '#0f172a', color: 'white', border: 'none', borderRadius: 7, padding: '6px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                              >
                                {downloadingFile === f.id ? '…' : '⬇ Get'}
                              </button>
                            </div>
                            {f.message_text && (
                              <div style={{ padding: '8px 12px 10px', borderTop: `1px solid ${isAdmin ? '#ede9fe' : '#e5e7eb'}`, fontSize: 12, color: '#374151', lineHeight: 1.6, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                                💬 {f.message_text}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

          {/* Payment & Transactions */}
          {order.price > 0 && (() => {
            const total     = order.price || 0
            const paid      = order.paid_amount || 0
            const remaining = Math.max(0, total - paid)
            const pct       = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
            const isPaid    = order.payment_status === 'paid'
            const isPartial = order.payment_status === 'partial'

            // Parse plan type and count
            const { type: planType, count: explicitWeeks } = parsePlan(order)
            const weeks = (() => {
              if (explicitWeeks !== 1) return explicitWeeks
              // Fallback inference from first tx amount when plan is unknown
              if (txList.length > 0 && total > 0) {
                const amt = Number(txList[0].amount)
                if (amt > 0) {
                  for (const n of [2, 4, 8, 16]) {
                    if (Math.abs(amt - total / n) < 1) return n
                  }
                }
              }
              return explicitWeeks
            })()
            const daySpacing = planType === 'biweekly' ? 14 : 7
            const instAmt    = total > 0 ? total / weeks : 0
            // Use math as source of truth txList.length is unreliable when wallet
            // payments land at the same timestamp and get deduplicated
            const paidWeeks  = instAmt > 0 ? Math.min(weeks, Math.round(paid / instAmt)) : txList.length
            const anchor     = txList[0]?.created_at || order.updated_at || order.created_at
            const fallbackPaidAt = order.updated_at || order.created_at
            const planLabel  = planType === 'full' || planType === 'splithalf'
              ? (planType === 'splithalf' ? 'Split (2 parts)' : 'Full Payment')
              : planType === 'biweekly'
                ? `Bi-Weekly (${weeks} parts)`
                : `Weekly (${weeks} parts)`

            return (
              <div className="od-card">
                {/* Dark header */}
                <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: '18px 22px', color: 'white' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.55, letterSpacing: '0.1em', marginBottom: 4 }}>PAYMENT & TRANSACTIONS</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    <span>Paid: <span style={{ color: '#4ade80' }}>{formatCurrency(paid)}</span></span>
                    <span style={{ opacity: 0.7 }}>Remaining: {formatCurrency(remaining)}</span>
                    <span style={{ opacity: 0.7 }}>Total: {formatCurrency(total)}</span>
                  </div>
                  <div style={{ height: 7, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#4ade80,#16a34a)', borderRadius: 999 }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, opacity: 0.5, marginTop: 4 }}>{pct}% complete</div>
                </div>

                <div style={{ padding: '16px 20px' }}>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                      📋 {planLabel}
                    </span>
                    <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: isPaid ? '#dcfce7' : isPartial ? '#fef3c7' : '#fee2e2',
                      color:      isPaid ? '#16a34a' : isPartial ? '#d97706' : '#dc2626',
                      border: `1px solid ${isPaid ? '#bbf7d0' : isPartial ? '#fde68a' : '#fecaca'}` }}>
                      ● {isPaid ? 'Fully Paid' : isPartial ? 'Partially Paid' : 'Unpaid'}
                    </span>
                  </div>

                  {/* Installment breakdown */}
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Payment Breakdown</div>
                  {txLoading ? (
                    <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 12 }}>Loading…</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Array.from({ length: weeks }, (_, i) => {
                        const weekNum  = i + 1
                        const isPaidWk = weekNum <= paidWeeks
                        const tx       = txList[i]
                        const firstWed = nextWeekWednesday(anchor)
                        const dueDate  = i === 0 ? new Date(anchor) : addDays(firstWed, (i - 1) * daySpacing)
                        const pct100   = Math.round(100 / weeks)
                        return (
                          <div key={weekNum} style={{
                            borderRadius: 12, padding: '12px 14px',
                            background: isPaidWk ? '#f0fdf4' : '#fffbeb',
                            border: `1.5px solid ${isPaidWk ? '#86efac' : '#fde68a'}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10
                          }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                background: isPaidWk ? '#16a34a' : '#fef3c7',
                                border: isPaidWk ? 'none' : '2px solid #fde68a',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                {isPaidWk ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                ) : <span style={{ fontSize: 14 }}>⏳</span>}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: isPaidWk ? '#15803d' : '#0f172a' }}>
                                  {weeks === 1 ? 'Full Payment' : `Week ${weekNum} ${pct100}%`}
                                </div>
                                {isPaidWk ? (
                                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontWeight: 500 }}>
                                    ✓ Paid · ⏱ {fmtDate(tx?.created_at || fallbackPaidAt)}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 11, color: '#d97706', marginTop: 2, fontWeight: 600 }}>
                                    📅 Due: {fmtDate(dueDate)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: isPaidWk ? '#16a34a' : '#0f172a' }}>{formatCurrency(instAmt)}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{pct100}% of total</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Boost Purchases */}
          <div className="od-card">
            <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', padding: '18px 22px', color: 'white', borderRadius: '16px 16px 0 0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.55, letterSpacing: '0.1em', marginBottom: 4 }}>BOOST YOUR ORDER THIS ORDER ONLY</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>🚀 Boost Purchases</div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {addonsLoading ? (
                <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 12 }}>Loading…</div>
              ) : orderAddons.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 16px', background: '#f8fafc', borderRadius: 12, border: '1.5px dashed #e2e8f0' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🛒</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>Nothing purchased</div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>Student has not bought any boost add-ons for this order.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {orderAddons.map(addon => {
                    const EMOJI = { revision: '🔄', plagiarism: '📄', priority: '🛡️', standard: '⚡', elite: '👑', services: '🎯' }
                    const icon = EMOJI[addon.addon_type] || '✨'
                    return (
                      <div key={addon.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                          {icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{addon.addon_label}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Paid</span>
                            <span>·</span>
                            <span>{new Date(addon.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span>· Boost Your Order</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>
                          ${Number(addon.amount).toFixed(2)}
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Total add-ons: </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginLeft: 6 }}>
                      ${orderAddons.reduce((s, a) => s + Number(a.amount), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expert */}
          <div className="od-card">
            <div className="od-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="od-section-title" style={{ margin: 0 }}>👨‍🏫 Expert</div>
                {order.expert_name ? (
                  <button onClick={removeExpert} style={{ fontSize: 11, color: '#ef4444', background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>
                    Remove
                  </button>
                ) : (
                  <button onClick={() => setShowExpertPicker(v => !v)} style={{ fontSize: 12, color: 'white', background: '#0f172a', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Search size={13} /> {showExpertPicker ? 'Cancel' : 'Assign Expert'}
                  </button>
                )}
              </div>

              {order.expert_name ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: '14px 16px' }}>
                  <img src={order.expert_avatar} alt={order.expert_name}
                    style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid #16a34a' }}
                    onError={e => e.target.style.display = 'none'} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{order.expert_name}</div>
                    <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 3 }}>✅ Assigned by admin</div>
                  </div>
                </div>
              ) : !showExpertPicker ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔍</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>No expert assigned yet</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Click "Assign Expert" to pick one from the list.</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      autoFocus
                      type="text"
                      value={expertSearch}
                      onChange={e => setExpertSearch(e.target.value)}
                      placeholder="Search by name, subject, university…"
                      style={{ width: '100%', padding: '9px 10px 9px 32px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                    {expertSearch && (
                      <button onClick={() => setExpertSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredExperts.map(expert => (
                      <div
                        key={expert.id}
                        onClick={() => !assigningExpert && assignExpert(expert)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #f1f5f9', background: 'white', cursor: assigningExpert ? 'wait' : 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#86efac' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#f1f5f9' }}
                      >
                        <img src={expert.avatarUrl} alt={expert.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid #e5e7eb' }} onError={e => e.target.style.display = 'none'} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {expert.name}
                            {expert.isTopRated && <span style={{ marginLeft: 6, fontSize: 10, background: '#fef3c7', color: '#d97706', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>⭐ Top</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {expert.degree} · {expert.primarySubject} · ★ {expert.rating}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: expert.isOnline ? '#22c55e' : '#d1d5db', display: 'inline-block' }} title={expert.isOnline ? 'Online' : 'Offline'} />
                        </div>
                      </div>
                    ))}
                    {filteredExperts.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>No experts found for "{expertSearch}"</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
                    Showing {filteredExperts.length} of {allExperts.length} experts
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Update Status */}
          <div className="od-card">
            <div className="od-section">
              <div className="od-section-title"><Clock size={15} /> Update Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STATUS_OPTIONS.map(s => {
                  const c = STATUS_COLOR[s]
                  const isActive = order.status === s
                  const isLocked = order.status === 'active' && (s === 'pending' || s === 'in_review')
                  const isDisabled = updatingStatus || isLocked
                  return (
                    <button
                      key={s}
                      disabled={isDisabled}
                      onClick={() => handleStatusChange(s)}
                      title={isLocked ? 'Cannot revert to this status once Active' : undefined}
                      style={{
                        padding: '10px 16px', borderRadius: 10,
                        border: `2px solid ${isActive ? c.dot : isLocked ? '#e5e7eb' : '#e5e7eb'}`,
                        background: isActive ? c.bg : isLocked ? '#f9fafb' : 'white',
                        color: isActive ? c.text : isLocked ? '#c4c9d4' : '#374151',
                        fontWeight: isActive ? 800 : 600, fontSize: 13,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
                        opacity: isLocked ? 0.5 : 1,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: isLocked ? '#d1d5db' : c.dot, flexShrink: 0 }} />
                      {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      {isActive && <span style={{ marginLeft: 'auto', fontSize: 11 }}>✓ Current</span>}
                      {isLocked && <span style={{ marginLeft: 'auto', fontSize: 11 }}>🔒</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="od-card">
            <div className="od-section">
              <div className="od-section-title"><AlertCircle size={15} /> Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Assign Manager
                  </label>
                  <select
                    value={assignedManagerId || ''}
                    onChange={(e) => handleAssignManager(e.target.value)}
                    disabled={savingManager || !order?.user_id}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid #e5e7eb', fontSize: 14, fontWeight: 600,
                      background: 'white', color: '#0f172a', cursor: savingManager ? 'wait' : 'pointer'
                    }}
                  >
                    <option value="">No manager —</option>
                    {managers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.internal_name ? `${m.name} (${m.internal_name})` : m.name}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Applies to this customer across all their orders.
                  </div>
                </div>
                <Link
                  to={`/messages?tab=order&orderId=${order.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
                >
                  <MessageCircle size={16} /> Message Student
                </Link>
                <Link
                  to={`/payments?orderId=${order.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
                >
                  💳 Ask Payment
                </Link>
                {(order.status === 'pending' || order.status === 'in_review') && (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' }}
                  >
                    🗑️ Delete Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !deleting && setDeleteConfirm(false)}
        >
          <div
            style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 420, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Delete Order?</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                This will permanently delete order <strong style={{ color: '#0f172a' }}>{order.order_number || order.id}</strong> and all its files and chat history. This cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
                style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={deleteOrder}
                disabled={deleting}
                style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
