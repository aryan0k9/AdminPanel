// ============================================================
// COUPONS PAGE Admin Panel
// Create, edit, toggle, delete coupon codes
// Supports: global coupons, user-restricted, order-restricted
// ============================================================

import { useState, useEffect, useRef } from 'react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, ToggleLeft, ToggleRight, Edit2, X, Check, Copy } from 'lucide-react'

const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed',      label: 'Fixed Amount ($)' },
]

const EMPTY_FORM = {
  code:                  '',
  description:           '',
  discount_type:         'percentage',
  discount_value:        '',
  min_order_value:       '',
  max_uses:              '',
  expires_at:            '',
  is_active:             true,
  restricted_to_user_id: null,
  restricted_to_order_id: null,
}

export default function CouponsPage() {
  const [coupons, setCoupons]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editCoupon, setEditCoupon] = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [copied, setCopied]         = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // User / Order picker state
  const [users, setUsers]                   = useState([])
  const [allOrders, setAllOrders]           = useState([])
  const [userSearch, setUserSearch]         = useState('')
  const [orderSearch, setOrderSearch]       = useState('')
  const [selectedUserLabel, setSelectedUserLabel]   = useState('')
  const [selectedOrderLabel, setSelectedOrderLabel] = useState('')
  const [showUserDrop, setShowUserDrop]     = useState(false)
  const [showOrderDrop, setShowOrderDrop]   = useState(false)
  const userRef  = useRef(null)
  const orderRef = useRef(null)

  useEffect(() => { fetchCoupons() }, [])

  // Load users + orders when modal opens
  useEffect(() => {
    if (!showModal) return
    supabase.from('profiles').select('id, full_name, email, student_id').order('full_name')
      .then(({ data }) => setUsers(data || []))
    supabase.from('orders').select('id, order_number, subject').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setAllOrders(data || []))
  }, [showModal])

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e) {
      if (userRef.current  && !userRef.current.contains(e.target))  setShowUserDrop(false)
      if (orderRef.current && !orderRef.current.contains(e.target)) setShowOrderDrop(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function fetchCoupons() {
    setLoading(true)
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false })

    if (data?.length) {
      const userIds  = [...new Set(data.filter(c => c.restricted_to_user_id).map(c => c.restricted_to_user_id))]
      const orderIds = [...new Set(data.filter(c => c.restricted_to_order_id).map(c => c.restricted_to_order_id))]
      const [{ data: profilesData }, { data: ordersData }] = await Promise.all([
        userIds.length  ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)          : { data: [] },
        orderIds.length ? supabase.from('orders').select('id, order_number, subject').in('id', orderIds) : { data: [] },
      ])
      const profileMap = Object.fromEntries((profilesData || []).map(p => [p.id, p]))
      const orderMap   = Object.fromEntries((ordersData  || []).map(o => [o.id, o]))
      setCoupons(data.map(c => ({
        ...c,
        _user:  c.restricted_to_user_id  ? profileMap[c.restricted_to_user_id]  : null,
        _order: c.restricted_to_order_id ? orderMap[c.restricted_to_order_id]   : null,
      })))
    } else {
      setCoupons(data || [])
    }
    setLoading(false)
  }

  function openCreate() {
    setEditCoupon(null)
    setForm(EMPTY_FORM)
    setUserSearch(''); setOrderSearch('')
    setSelectedUserLabel(''); setSelectedOrderLabel('')
    setError('')
    setShowModal(true)
  }

  async function openEdit(c) {
    setEditCoupon(c)
    setForm({
      code:            c.code,
      description:     c.description || '',
      discount_type:   c.discount_type,
      discount_value:  String(c.discount_value),
      min_order_value: c.min_order_value != null ? String(c.min_order_value) : '',
      max_uses:        c.max_uses != null ? String(c.max_uses) : '',
      expires_at:      c.expires_at ? c.expires_at.slice(0, 10) : '',
      is_active:       c.is_active,
      restricted_to_user_id:  c.restricted_to_user_id  || null,
      restricted_to_order_id: c.restricted_to_order_id || null,
    })
    // Resolve labels for existing restrictions
    setSelectedUserLabel('')
    setSelectedOrderLabel('')
    setUserSearch(''); setOrderSearch('')
    if (c.restricted_to_user_id) {
      const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', c.restricted_to_user_id).single()
      if (p) setSelectedUserLabel(p.full_name || p.email)
    }
    if (c.restricted_to_order_id) {
      const { data: o } = await supabase.from('orders').select('order_number').eq('id', c.restricted_to_order_id).single()
      if (o) setSelectedOrderLabel(o.order_number || c.restricted_to_order_id)
    }
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    if (!form.code.trim()) return setError('Coupon code is required.')
    if (!form.discount_value || isNaN(Number(form.discount_value)) || Number(form.discount_value) <= 0)
      return setError('Enter a valid discount value.')
    if (form.discount_type === 'percentage' && Number(form.discount_value) > 100)
      return setError('Percentage discount cannot exceed 100%.')

    setSaving(true)
    const payload = {
      code:                   form.code.trim().toUpperCase(),
      description:            form.description.trim() || null,
      discount_type:          form.discount_type,
      discount_value:         Number(form.discount_value),
      min_order_value:        form.min_order_value ? Number(form.min_order_value) : null,
      max_uses:               form.max_uses ? Number(form.max_uses) : null,
      expires_at:             form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active:              form.is_active,
      restricted_to_user_id:  form.restricted_to_user_id  || null,
      restricted_to_order_id: form.restricted_to_order_id || null,
    }

    let err, savedCode
    if (editCoupon) {
      ;({ error: err } = await supabase.from('coupons').update(payload).eq('id', editCoupon.id))
      savedCode = payload.code
    } else {
      const { error: insErr } = await supabase.from('coupons').insert({ ...payload, used_count: 0 })
      err = insErr
      savedCode = payload.code
    }

    if (err) {
      setSaving(false)
      if (err.code === '23505') return setError('A coupon with this code already exists.')
      return setError(err.message)
    }

    // If restricted to a specific order, auto-apply the coupon code to that order
    if (form.restricted_to_order_id && savedCode) {
      await supabase.from('orders')
        .update({ coupon_code: savedCode })
        .eq('id', form.restricted_to_order_id)
    }

    setSaving(false)
    setShowModal(false)
    fetchCoupons()
  }

  async function toggleActive(c) {
    await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id)
    fetchCoupons()
  }

  async function handleDelete(id) {
    await supabase.from('coupons').delete().eq('id', id)
    setDeleteConfirm(null)
    fetchCoupons()
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1800)
  }

  const formatDiscount = (c) =>
    c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `$${c.discount_value} OFF`

  const isExpired = (c) => c.expires_at && new Date(c.expires_at) < new Date()
  const isMaxed   = (c) => c.max_uses != null && c.used_count >= c.max_uses

  const statusColor = (c) => {
    if (!c.is_active || isExpired(c) || isMaxed(c)) return { bg: '#fef2f2', color: '#dc2626', label: 'Inactive' }
    return { bg: '#f0fdf4', color: '#16a34a', label: 'Active' }
  }

  // Filtered lists for pickers
  const filteredUsers = users.filter(u =>
    userSearch.length >= 1 && (
      (u.full_name?.toLowerCase() || '').includes(userSearch.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(userSearch.toLowerCase())
    )
  ).slice(0, 8)

  const filteredOrders = allOrders.filter(o =>
    orderSearch.length >= 1 && (
      (o.order_number?.toLowerCase() || '').includes(orderSearch.toLowerCase()) ||
      (o.subject?.toLowerCase() || '').includes(orderSearch.toLowerCase())
    )
  ).slice(0, 8)

  const dropStyle = {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
    background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, maxHeight: 200, overflowY: 'auto'
  }

  return (
    <AdminLayout title="Coupon Codes">
      <style>{`
        .cp-card { background: white; border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.06); overflow: hidden; }
        .cp-row:hover { background: #f8fafc !important; }
        .cp-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .cp-icon-btn { background: none; border: none; cursor: pointer; border-radius: 8px; padding: 6px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s; color: #64748b; }
        .cp-icon-btn:hover { background: #f1f5f9; color: #0f172a; }
        .cp-icon-btn.danger:hover { background: #fef2f2; color: #dc2626; }
        .cp-input { width: 100%; padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; font-family: inherit; color: #0f172a; box-sizing: border-box; transition: border-color 0.15s; }
        .cp-input:focus { border-color: #16a34a; }
        .cp-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .cp-modal { background: white; border-radius: 18px; width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
        .cp-code-chip { font-family: monospace; font-size: 13px; font-weight: 700; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.04em; }
        .cp-create-btn { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: opacity 0.15s, transform 0.15s; }
        .cp-create-btn:hover { opacity: 0.92; transform: translateY(-1px); }
        .cp-drop-item { padding: 9px 14px; cursor: pointer; border-bottom: 1px solid #f8fafc; transition: background 0.1s; }
        .cp-drop-item:hover { background: #f0fdf4; }
        .cp-drop-item:last-child { border-bottom: none; }
        .cp-chip { display: inline-flex; align-items: center; gap: 6px; padding: '6px 10px'; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; font-size: 13px; font-weight: 600; color: #15803d; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>🎟️ Coupon Codes</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Create global, user-specific, or order-specific discount codes
          </p>
        </div>
        <button className="cp-create-btn" onClick={openCreate}>
          <Plus size={16} /> Create Coupon
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Coupons', value: coupons.length, color: '#6366f1', bg: '#eef2ff' },
          { label: 'Active',        value: coupons.filter(c => c.is_active && !isExpired(c) && !isMaxed(c)).length, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'User-Specific', value: coupons.filter(c => c.restricted_to_user_id).length,  color: '#0ea5e9', bg: '#f0f9ff' },
          { label: 'Order-Specific',value: coupons.filter(c => c.restricted_to_order_id).length, color: '#f59e0b', bg: '#fffbeb' },
        ].map(s => (
          <div key={s.label} className="cp-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="cp-card">
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#16a34a', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Loading coupons...
          </div>
        ) : coupons.length === 0 ? (
          <div style={{ padding: 80, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎟️</div>
            <p style={{ fontWeight: 600, fontSize: 16, margin: '0 0 8px', color: '#64748b' }}>No coupons yet</p>
            <p style={{ fontSize: 14, margin: 0 }}>Create your first coupon to offer discounts to students.</p>
            <button className="cp-create-btn" onClick={openCreate} style={{ margin: '20px auto 0', display: 'inline-flex' }}>
              <Plus size={16} /> Create Coupon
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['Code', 'Discount', 'Restriction', 'Usage', 'Expires', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c, i) => {
                const st = statusColor(c)
                return (
                  <tr key={c.id} className="cp-row" style={{ borderBottom: i < coupons.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.12s' }}>
                    {/* Code */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="cp-code-chip">{c.code}</span>
                        <button className="cp-icon-btn" onClick={() => copyCode(c.code)} title="Copy" style={{ padding: 4 }}>
                          {copied === c.code ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>
                    {/* Discount */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#16a34a' }}>{formatDiscount(c)}</span>
                      {c.min_order_value != null && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>min. ${c.min_order_value}</div>
                      )}
                    </td>
                    {/* Restriction */}
                    <td style={{ padding: '14px 16px', minWidth: 140 }}>
                      {c.restricted_to_user_id ? (
                        <div>
                          <span className="cp-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                            👤 User Only
                          </span>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                            {c._user?.full_name || c._user?.email || '—'}
                          </div>
                        </div>
                      ) : c.restricted_to_order_id ? (
                        <div>
                          <span className="cp-badge" style={{ background: '#fffbeb', color: '#b45309' }}>
                            📦 Order Only
                          </span>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontFamily: 'monospace' }}>
                            {c._order?.order_number || '—'}
                          </div>
                        </div>
                      ) : (
                        <span className="cp-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                          🌍 Public
                        </span>
                      )}
                    </td>
                    {/* Usage */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{c.used_count || 0}</span>
                      {c.max_uses != null && (
                        <span style={{ fontSize: 13, color: '#94a3b8' }}> / {c.max_uses}</span>
                      )}
                    </td>
                    {/* Expires */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', fontSize: 13, color: isExpired(c) ? '#dc2626' : '#64748b' }}>
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                    </td>
                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span className="cp-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="cp-icon-btn" onClick={() => toggleActive(c)} title={c.is_active ? 'Deactivate' : 'Activate'}>
                          {c.is_active ? <ToggleRight size={18} color="#16a34a" /> : <ToggleLeft size={18} />}
                        </button>
                        <button className="cp-icon-btn" onClick={() => openEdit(c)} title="Edit">
                          <Edit2 size={15} />
                        </button>
                        <button className="cp-icon-btn danger" onClick={() => setDeleteConfirm(c)} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="cp-overlay" onClick={() => setShowModal(false)}>
          <div className="cp-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {editCoupon ? 'Edit Coupon' : 'Create New Coupon'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  {editCoupon ? 'Update the coupon details below.' : 'Fill in the details to create a discount coupon.'}
                </p>
              </div>
              <button className="cp-icon-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 28px' }}>
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 18, color: '#dc2626', fontSize: 13 }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                {/* Code */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Coupon Code *</label>
                  <input
                    className="cp-input"
                    placeholder="e.g. SAVE20"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                    style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, letterSpacing: '0.06em' }}
                  />
                </div>

                {/* Discount Type */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Discount Type *</label>
                  <select className="cp-input" value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
                    {DISCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {/* Discount Value */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Discount Value * {form.discount_type === 'percentage' ? '(%)' : '($)'}
                  </label>
                  <input className="cp-input" type="number" min="0" max={form.discount_type === 'percentage' ? 100 : undefined} step="0.01"
                    placeholder={form.discount_type === 'percentage' ? '10' : '5.00'}
                    value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} />
                </div>

                {/* Min Order Value */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Min. Order Value ($)</label>
                  <input className="cp-input" type="number" min="0" step="0.01" placeholder="Leave blank for no minimum"
                    value={form.min_order_value} onChange={e => setForm(f => ({ ...f, min_order_value: e.target.value }))} />
                </div>

                {/* Max Uses */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max Uses</label>
                  <input className="cp-input" type="number" min="1" placeholder="Leave blank for unlimited"
                    value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} />
                </div>

                {/* Expires At */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expiry Date</label>
                  <input className="cp-input" type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
                </div>

                {/* Description */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description (shown to students)</label>
                  <input className="cp-input" placeholder="e.g. 20% off for new students"
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>

                {/* ── RESTRICTION SECTION ── */}
                <div style={{ gridColumn: '1 / -1', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 4 }}>🔒 Restrict To (Optional)</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                    Leave both blank to make this coupon available to all students.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                    {/* User Picker */}
                    <div ref={userRef}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        👤 Specific User
                      </div>
                      {form.restricted_to_user_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 8 }}>
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedUserLabel || 'Selected'}
                          </div>
                          <button
                            onClick={() => { setForm(f => ({ ...f, restricted_to_user_id: null })); setSelectedUserLabel(''); setUserSearch('') }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          ><X size={14} /></button>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <input
                            className="cp-input"
                            placeholder="Search by name or email..."
                            value={userSearch}
                            onChange={e => { setUserSearch(e.target.value); setShowUserDrop(true) }}
                            onFocus={() => setShowUserDrop(true)}
                            style={{ fontSize: 12 }}
                          />
                          {showUserDrop && filteredUsers.length > 0 && (
                            <div style={dropStyle}>
                              {filteredUsers.map(u => (
                                <div key={u.id} className="cp-drop-item"
                                  onMouseDown={() => {
                                    setForm(f => ({ ...f, restricted_to_user_id: u.id }))
                                    setSelectedUserLabel(u.full_name || u.email)
                                    setUserSearch('')
                                    setShowUserDrop(false)
                                  }}
                                >
                                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{u.full_name || 'No name'}</div>
                                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.email}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Order Picker */}
                    <div ref={orderRef}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        📦 Specific Order
                        {form.restricted_to_order_id && (
                          <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, background: '#fffbeb', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>
                            Auto-applies coupon to this order
                          </span>
                        )}
                      </div>
                      {form.restricted_to_order_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 8 }}>
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#b45309', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedOrderLabel || 'Selected'}
                          </div>
                          <button
                            onClick={() => { setForm(f => ({ ...f, restricted_to_order_id: null })); setSelectedOrderLabel(''); setOrderSearch('') }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fbbf24', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          ><X size={14} /></button>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <input
                            className="cp-input"
                            placeholder="Search by order ID or subject..."
                            value={orderSearch}
                            onChange={e => { setOrderSearch(e.target.value); setShowOrderDrop(true) }}
                            onFocus={() => setShowOrderDrop(true)}
                            style={{ fontSize: 12 }}
                          />
                          {showOrderDrop && filteredOrders.length > 0 && (
                            <div style={dropStyle}>
                              {filteredOrders.map(o => (
                                <div key={o.id} className="cp-drop-item"
                                  onMouseDown={() => {
                                    setForm(f => ({ ...f, restricted_to_order_id: o.id }))
                                    setSelectedOrderLabel(o.order_number || o.id)
                                    setOrderSearch('')
                                    setShowOrderDrop(false)
                                  }}
                                >
                                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', fontFamily: 'monospace' }}>{o.order_number}</div>
                                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{o.subject || '—'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {form.restricted_to_user_id && form.restricted_to_order_id && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 12, color: '#c2410c' }}>
                      ⚠️ Both restrictions set only the specified user can use this coupon, and it's locked to the specified order.
                    </div>
                  )}
                </div>

                {/* Active Toggle */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#f8fafc', borderRadius: 10 }}>
                  <div
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    style={{ width: 44, height: 26, borderRadius: 13, background: form.is_active ? '#16a34a' : '#d1d5db', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
                  >
                    <div style={{ position: 'absolute', top: 3, left: form.is_active ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{form.is_active ? 'Active' : 'Inactive'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Students {form.is_active ? 'can' : 'cannot'} use this coupon</div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setShowModal(false)}
                  style={{ padding: '10px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', color: '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: '10px 24px', border: 'none', borderRadius: 8, background: saving ? '#d1d5db' : 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {saving ? 'Saving...' : editCoupon ? '✓ Save Changes' : '+ Create Coupon'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div className="cp-overlay" onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: '32px', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Delete Coupon?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b' }}>
              This will permanently delete the coupon <strong style={{ color: '#0f172a' }}>{deleteConfirm.code}</strong>. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id)} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: '#dc2626', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
