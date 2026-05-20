import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/stats'

const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

const TYPE_COLOR = {
  credit: { bg: '#dcfce7', text: '#16a34a', dot: '#22c55e', icon: '⬇️', label: 'Credit' },
  debit:  { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444', icon: '⬆️', label: 'Debit'  },
}

export default function WalletPage() {
  const navigate = useNavigate()
  const [txns, setTxns]           = useState([])
  const [users, setUsers]         = useState({})   // userId → { name, email }
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'credit' | 'debit'
  const [page, setPage]           = useState(1)
  const PER_PAGE = 25

  // Manual credit modal
  const [creditModal, setCreditModal] = useState(false)
  const [creditUserId, setCreditUserId] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [creditDesc, setCreditDesc]   = useState('')
  const [creditLoading, setCreditLoading] = useState(false)
  const [creditMsg, setCreditMsg]     = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: txData }, { data: profileData }] = await Promise.all([
      supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('profiles')
        .select('id, full_name, email'),
    ])

    const userMap = {}
    for (const p of (profileData || [])) {
      userMap[p.id] = { name: p.full_name || 'Unknown', email: p.email || '' }
    }
    setUsers(userMap)
    setTxns(txData || [])
    setLoading(false)
  }

  // Summary stats
  const stats = useMemo(() => {
    const credits = txns.filter(t => t.type === 'credit' && t.status === 'completed')
    const debits  = txns.filter(t => t.type === 'debit'  && t.status === 'completed')
    const totalCredit = credits.reduce((s, t) => s + Number(t.amount), 0)
    const totalDebit  = debits.reduce((s, t) => s + Number(t.amount), 0)

    // Per-user balances
    const balMap = {}
    for (const t of txns.filter(t => t.status === 'completed')) {
      if (!balMap[t.user_id]) balMap[t.user_id] = 0
      balMap[t.user_id] += t.type === 'credit' ? Number(t.amount) : -Number(t.amount)
    }
    const usersWithBalance = Object.values(balMap).filter(v => v > 0).length
    const totalBalance     = Object.values(balMap).reduce((s, v) => s + Math.max(0, v), 0)

    return { totalCredit, totalDebit, totalBalance, usersWithBalance, txCount: txns.length }
  }, [txns])

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return txns.filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (!q) return true
      const u = users[t.user_id] || {}
      return (
        (u.name  || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      )
    })
  }, [txns, users, search, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // Per-user net balance map (for displaying current balance)
  const balanceMap = useMemo(() => {
    const m = {}
    for (const t of txns.filter(t => t.status === 'completed')) {
      if (!m[t.user_id]) m[t.user_id] = 0
      m[t.user_id] += t.type === 'credit' ? Number(t.amount) : -Number(t.amount)
    }
    return m
  }, [txns])

  async function handleManualCredit() {
    if (!creditUserId || !creditAmount || isNaN(parseFloat(creditAmount))) return
    setCreditLoading(true)
    setCreditMsg('')
    const amt = parseFloat(creditAmount)
    const { error } = await supabase.from('wallet_transactions').insert({
      user_id: creditUserId,
      amount: amt,
      type: 'credit',
      status: 'completed',
      balance_after: 0,
      description: creditDesc.trim() || `Admin credit $${amt.toFixed(2)}`,
    })
    if (error) {
      setCreditMsg('Error: ' + error.message)
    } else {
      setCreditMsg(`✅ $${amt.toFixed(2)} credited successfully!`)
      setCreditUserId('')
      setCreditAmount('')
      setCreditDesc('')
      await loadData()
      setTimeout(() => { setCreditModal(false); setCreditMsg('') }, 1800)
    }
    setCreditLoading(false)
  }

  return (
    <AdminLayout title="Wallet Transactions">
      <style>{`
        .wt-stat { background: white; border-radius: 14px; border: 1px solid #e5e7eb; padding: 18px 22px; }
        .wt-stat-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .wt-stat-value { font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
        .wt-stat-sub { font-size: 12px; color: #64748b; margin-top: 3px; }
        .wt-pill { padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; transition: all 0.15s; }
        .wt-row { display: grid; grid-template-columns: 2fr 1.4fr 1fr 1fr 1.2fr; gap: 12px; align-items: center; padding: 13px 18px; border-bottom: 1px solid #f1f5f9; transition: background 0.1s; }
        .wt-row:hover { background: #f8fafc; }
        .wt-row:last-child { border-bottom: none; }
        .wt-head { display: grid; grid-template-columns: 2fr 1.4fr 1fr 1fr 1.2fr; gap: 12px; padding: 10px 18px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; border-radius: 12px 12px 0 0; }
      `}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>💰 Wallet Transactions</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>All student wallet activity across the platform</p>
        </div>
        <button
          onClick={() => setCreditModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}
        >
          + Manual Credit
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="wt-stat">
          <div className="wt-stat-label">Total Balance (all users)</div>
          <div className="wt-stat-value" style={{ color: '#16a34a' }}>{formatCurrency(stats.totalBalance)}</div>
          <div className="wt-stat-sub">{stats.usersWithBalance} users with balance</div>
        </div>
        <div className="wt-stat">
          <div className="wt-stat-label">Total Credits Given</div>
          <div className="wt-stat-value">{formatCurrency(stats.totalCredit)}</div>
          <div className="wt-stat-sub">All time top-ups + bonuses</div>
        </div>
        <div className="wt-stat">
          <div className="wt-stat-label">Total Debits</div>
          <div className="wt-stat-value" style={{ color: '#dc2626' }}>{formatCurrency(stats.totalDebit)}</div>
          <div className="wt-stat-sub">Payments made from wallet</div>
        </div>
        <div className="wt-stat">
          <div className="wt-stat-label">Total Transactions</div>
          <div className="wt-stat-value">{stats.txCount}</div>
          <div className="wt-stat-sub">All records</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 15 }}>🔍</span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by user or description…"
            style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all', 'All'], ['credit', '⬇️ Credits'], ['debit', '⬆️ Debits']].map(([key, label]) => (
            <button
              key={key}
              className="wt-pill"
              onClick={() => { setTypeFilter(key); setPage(1) }}
              style={{
                background: typeFilter === key ? '#0f172a' : '#f1f5f9',
                color: typeFilter === key ? 'white' : '#64748b',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
          {filtered.length} records
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div className="wt-head">
          <span>User</span>
          <span>Description</span>
          <span>Type</span>
          <span>Amount</span>
          <span>Date</span>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#16a34a', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            Loading transactions…
          </div>
        ) : paginated.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💰</div>
            No transactions found
          </div>
        ) : paginated.map(t => {
          const u  = users[t.user_id] || {}
          const tc = TYPE_COLOR[t.type] || TYPE_COLOR.credit
          const userBal = Math.max(0, balanceMap[t.user_id] || 0)
          const initials = (u.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

          return (
            <div key={t.id} className="wt-row">
              {/* User */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', color: 'white', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                    onClick={() => navigate(`/users/${t.user_id}`)}
                    title={u.name}
                  >
                    {u.name || t.user_id.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email} · Bal: <span style={{ color: '#16a34a', fontWeight: 700 }}>{formatCurrency(userBal)}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.description}>
                {t.description || '—'}
              </div>

              {/* Type badge */}
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.text }}>
                  {tc.icon} {tc.label}
                </span>
              </div>

              {/* Amount */}
              <div style={{ fontWeight: 800, fontSize: 15, color: t.type === 'credit' ? '#16a34a' : '#dc2626' }}>
                {t.type === 'credit' ? '+' : '−'}{formatCurrency(Number(t.amount))}
              </div>

              {/* Date */}
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {fmtDate(t.created_at)}
                {t.status !== 'completed' && (
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#fef3c7', borderRadius: 4, padding: '1px 5px' }}>
                    {t.status}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', fontSize: 13, fontWeight: 600, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', fontSize: 13, fontWeight: 600, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
            Next →
          </button>
        </div>
      )}

      {/* Manual Credit Modal */}
      {creditModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !creditLoading && setCreditModal(false)}
        >
          <div
            style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 440, padding: 32, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>💳 Manual Wallet Credit</h3>
            <p style={{ margin: '0 0 22px', fontSize: 13, color: '#64748b' }}>Add funds directly to a user's wallet.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>User ID</label>
                <input
                  value={creditUserId}
                  onChange={e => setCreditUserId(e.target.value)}
                  placeholder="Paste user UUID…"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }}
                />
                <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
                  Find user UUID on the <span style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setCreditModal(false); navigate('/users') }}>Users page →</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Amount (USD)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)}
                  placeholder="e.g. 20.00"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Description (optional)</label>
                <input
                  value={creditDesc}
                  onChange={e => setCreditDesc(e.target.value)}
                  placeholder="e.g. Welcome bonus $20.00 gift"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>

            {creditMsg && (
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: creditMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: creditMsg.startsWith('✅') ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
                {creditMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setCreditModal(false)}
                disabled={creditLoading}
                style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleManualCredit}
                disabled={creditLoading || !creditUserId || !creditAmount}
                style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: creditLoading ? 'not-allowed' : 'pointer', opacity: creditLoading ? 0.7 : 1 }}
              >
                {creditLoading ? 'Adding…' : '+ Add Credit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
