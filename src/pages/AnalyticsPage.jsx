import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  TrendingUp, DollarSign, Package, Users, CheckCircle,
  ArrowUpRight, ArrowDownRight, Clock, BarChart3, RefreshCw, Star, MessageSquare
} from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { useSite } from '../contexts/SiteContext'

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt$ = (n) => `$${parseFloat(n || 0).toFixed(2)}`
const fmtK = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const monthKey = (d) => `${new Date(d).getFullYear()}-${String(new Date(d).getMonth()).padStart(2,'0')}`
const monthLabel = (key) => {
  const [y, m] = key.split('-')
  return `${MONTH_LABELS[+m]} ${y}`
}

const STAR_COLORS  = ['','#ef4444','#f97316','#eab308','#84cc16','#22c55e']
const STAR_LABELS  = ['','Poor','Fair','Good','Great','Excellent']
const STATUS_COLOR = { pending:'#F59E0B', active:'#3B82F6', in_review:'#A855F7', completed:'#16A34A', cancelled:'#EF4444' }
const PIE_COLORS   = ['#3B82F6','#16A34A','#F59E0B','#A855F7','#EF4444','#06B6D4','#F97316']
const AREA_GRADIENT = [{ id:'rev', from:'#16A34A', to:'#16A34A22' }, { id:'ord', from:'#3B82F6', to:'#3B82F622' }]

function parsePlanType(order) {
  const p = (order.payment_plan || '').toLowerCase()
  if (p.includes('weekly') && p.includes('bi')) return 'Biweekly'
  if (p.includes('weekly')) return 'Weekly'
  if (p === 'full' || p === 'full payment') return 'Full'
  if (p.includes('split')) return 'Split Half'
  return 'Full'
}

function getStartDate(range) {
  if (range === 'all') return null
  const d = new Date()
  d.setDate(d.getDate() - parseInt(range))
  d.setHours(0,0,0,0)
  return d
}

// ─── custom tooltip ──────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background:'#1e293b', border:'1px solid #334155', borderRadius:8,
      padding:'8px 14px', fontSize:13, color:'#f1f5f9', boxShadow:'0 4px 20px rgba(0,0,0,.4)'
    }}>
      <div style={{ fontWeight:600, marginBottom:4, color:'#94a3b8' }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:p.color, display:'inline-block' }} />
          <span style={{ color:'#cbd5e1' }}>{p.name}:</span>
          <span style={{ fontWeight:600, color:'#f1f5f9' }}>{prefix}{typeof p.value === 'number' && prefix==='$' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={{
      background:'#1e293b', border:'1px solid #334155', borderRadius:8,
      padding:'8px 14px', fontSize:13, color:'#f1f5f9'
    }}>
      <strong>{name}</strong>: {value}
    </div>
  )
}

// ─── stat card ───────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color, trend }) {
  const isPos = trend > 0
  return (
    <div style={{
      background:'#fff', borderRadius:14, padding:'20px 22px',
      border:'1px solid #e2e8f0', display:'flex', flexDirection:'column', gap:8
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{
          width:40, height:40, borderRadius:10,
          background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', color
        }}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <div style={{
            display:'flex', alignItems:'center', gap:3, fontSize:12, fontWeight:600,
            color: isPos ? '#16A34A' : '#EF4444'
          }}>
            {isPos ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div style={{ fontSize:28, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:13, fontWeight:600, color:'#64748b' }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#94a3b8' }}>{sub}</div>}
    </div>
  )
}

// ─── section heading ─────────────────────────────────────────────────────────
function SectionHead({ icon: Icon, title, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
      <div style={{ width:32, height:32, borderRadius:8, background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b' }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{ fontWeight:700, fontSize:15, color:'#0f172a' }}>{title}</div>
        {sub && <div style={{ fontSize:11, color:'#94a3b8' }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { selectedSite, isAllSites } = useSite()
  const [range, setRange]     = useState('90')
  const [orders, setOrders]   = useState([])
  const [profiles, setProfiles] = useState([])
  const [walletTxns, setWalletTxns] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    const siteId = (!isAllSites && selectedSite?.id !== 'all') ? selectedSite?.id : null

    let ordQ = supabase.from('orders').select('id,created_at,price,paid_amount,payment_status,status,type,subject,payment_plan,site_id')
    let profQ = supabase.from('profiles').select('id,role,created_at,site_id')
    if (siteId) { ordQ = ordQ.eq('site_id', siteId); profQ = profQ.eq('site_id', siteId) }

    let fbQ = supabase.from('feedback').select('id,created_at,rating,comment,user_name,user_email,subject,order_number,site_id')
    if (siteId) fbQ = fbQ.eq('site_id', siteId)

    const [{ data: od }, { data: pd }, { data: wt }, { data: fb }] = await Promise.all([
      ordQ,
      profQ,
      supabase.from('wallet_transactions').select('id,created_at,amount,type,description,user_id'),
      fbQ,
    ])
    setOrders(od || [])
    setProfiles(pd || [])
    setWalletTxns(wt || [])
    setFeedbacks(fb || [])
    setLoading(false)
  }

  useEffect(() => { if (selectedSite) loadData() }, [selectedSite, isAllSites])

  // ── filter by date range ────────────────────────────────────────────────
  const { filteredOrders, filteredProfiles, filteredWallet, filteredFeedback, prevOrders, prevProfiles } = useMemo(() => {
    const start = getStartDate(range)
    const prevStart = start ? new Date(start.getTime() - (start.getTime() - new Date(0).getTime()) / 2) : null

    const fOrd = start ? orders.filter(o => new Date(o.created_at) >= start) : orders
    const fPro = start ? profiles.filter(p => new Date(p.created_at) >= start) : profiles
    const fWal = start ? walletTxns.filter(w => new Date(w.created_at) >= start) : walletTxns

    const periodMs = start ? Date.now() - start.getTime() : null
    const prevStart2 = start ? new Date(start.getTime() - periodMs) : null
    const prevEnd2 = start

    const pOrd = prevStart2 ? orders.filter(o => new Date(o.created_at) >= prevStart2 && new Date(o.created_at) < prevEnd2) : []
    const pPro = prevStart2 ? profiles.filter(p => new Date(p.created_at) >= prevStart2 && new Date(p.created_at) < prevEnd2) : []

    const fFb = start ? feedbacks.filter(f => new Date(f.created_at) >= start) : feedbacks

    return { filteredOrders: fOrd, filteredProfiles: fPro, filteredWallet: fWal, filteredFeedback: fFb, prevOrders: pOrd, prevProfiles: pPro }
  }, [orders, profiles, walletTxns, feedbacks, range])

  // ── KPIs ────────────────────────────────────────────────────────────────
  const feedbackKpi = useMemo(() => {
    const total = filteredFeedback.length
    const avg = total > 0 ? (filteredFeedback.reduce((s,f) => s + f.rating, 0) / total) : 0
    const fiveStar = filteredFeedback.filter(f => f.rating === 5).length
    const fiveStarRate = total > 0 ? Math.round((fiveStar / total) * 100) : 0
    const dist = [5,4,3,2,1].map(r => ({
      r, label: STAR_LABELS[r], color: STAR_COLORS[r],
      count: filteredFeedback.filter(f => f.rating === r).length,
      pct: total > 0 ? Math.round(filteredFeedback.filter(f => f.rating === r).length / total * 100) : 0,
    }))
    return { total, avg: avg.toFixed(1), fiveStar, fiveStarRate, dist }
  }, [filteredFeedback])

  const ratingByMonth = useMemo(() => {
    const map = {}
    filteredFeedback.forEach(f => {
      const k = monthKey(f.created_at)
      if (!map[k]) map[k] = { month: monthLabel(k), totalRating: 0, count: 0 }
      map[k].totalRating += f.rating
      map[k].count++
    })
    return Object.keys(map).sort().map(k => ({
      month: map[k].month,
      avg: parseFloat((map[k].totalRating / map[k].count).toFixed(2)),
      count: map[k].count,
    }))
  }, [filteredFeedback])

  const kpi = useMemo(() => {
    const revenue = filteredOrders.reduce((s,o) => s + parseFloat(o.paid_amount || 0), 0)
    const prevRevenue = prevOrders.reduce((s,o) => s + parseFloat(o.paid_amount || 0), 0)
    const newStudents = filteredProfiles.filter(p => p.role === 'student').length
    const prevStudents = prevProfiles.filter(p => p.role === 'student').length
    const completed = filteredOrders.filter(o => o.status === 'completed').length
    const completionRate = filteredOrders.length ? Math.round((completed / filteredOrders.length) * 100) : 0
    const avgOrderValue = filteredOrders.length ? revenue / filteredOrders.length : 0
    const walletCredits = filteredWallet.filter(w => w.type === 'credit' && !w.description?.startsWith('Card payment for Order')).reduce((s,w) => s + parseFloat(w.amount || 0), 0)

    const revTrend = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null
    const userTrend = prevStudents > 0 ? Math.round(((newStudents - prevStudents) / prevStudents) * 100) : null

    return { revenue, newStudents, completed, completionRate, avgOrderValue, walletCredits, revTrend, userTrend }
  }, [filteredOrders, filteredProfiles, filteredWallet, prevOrders, prevProfiles])

  // ── Revenue + Orders by Month ─────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map = {}
    filteredOrders.forEach(o => {
      const k = monthKey(o.created_at)
      if (!map[k]) map[k] = { month: monthLabel(k), revenue: 0, orders: 0 }
      map[k].revenue += parseFloat(o.paid_amount || 0)
      map[k].orders++
    })
    return Object.keys(map).sort().map(k => ({ ...map[k], revenue: parseFloat(map[k].revenue.toFixed(2)) }))
  }, [filteredOrders])

  // ── Orders by Status (pie) ────────────────────────────────────────────
  const statusData = useMemo(() => {
    const map = {}
    filteredOrders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name: name.replace('_',' '), value }))
      .sort((a,b) => b.value - a.value)
  }, [filteredOrders])

  // ── Orders by Type ───────────────────────────────────────────────────
  const typeData = useMemo(() => {
    const map = {}
    filteredOrders.forEach(o => {
      const t = (o.type || 'Other').replace(/_/g,' ')
      map[t] = (map[t] || 0) + 1
    })
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 8)
  }, [filteredOrders])

  // ── Payment Plans ─────────────────────────────────────────────────────
  const planData = useMemo(() => {
    const map = {}
    filteredOrders.forEach(o => {
      const t = parsePlanType(o)
      map[t] = (map[t] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [filteredOrders])

  // ── Top Subjects ──────────────────────────────────────────────────────
  const subjectData = useMemo(() => {
    const map = {}
    filteredOrders.forEach(o => {
      const s = o.subject?.trim() || 'Unknown'
      map[s] = (map[s] || 0) + 1
    })
    return Object.entries(map).map(([subject, count]) => ({ subject, count }))
      .sort((a,b) => b.count - a.count).slice(0,8)
  }, [filteredOrders])

  // ── User Growth by Month ──────────────────────────────────────────────
  const userGrowthData = useMemo(() => {
    const map = {}
    filteredProfiles.filter(p => p.role === 'student').forEach(p => {
      const k = monthKey(p.created_at)
      if (!map[k]) map[k] = { month: monthLabel(k), students: 0 }
      map[k].students++
    })
    return Object.keys(map).sort().map(k => map[k])
  }, [filteredProfiles])

  // ── Payment Status breakdown ──────────────────────────────────────────
  const payStatusData = useMemo(() => {
    const paid = filteredOrders.filter(o => o.payment_status === 'paid').length
    const partial = filteredOrders.filter(o => o.payment_status === 'partial').length
    const unpaid = filteredOrders.filter(o => !o.payment_status || o.payment_status === 'pending').length
    return [
      { name: 'Fully Paid', value: paid },
      { name: 'Partial', value: partial },
      { name: 'Unpaid', value: unpaid },
    ].filter(d => d.value > 0)
  }, [filteredOrders])

  // ─── render ───────────────────────────────────────────────────────────
  const ranges = [
    { label: '7 Days', value: '7' },
    { label: '30 Days', value: '30' },
    { label: '90 Days', value: '90' },
    { label: '1 Year', value: '365' },
    { label: 'All Time', value: 'all' },
  ]

  if (loading) return (
    <AdminLayout title="Analytics">
      <div className="admin-loading">
        <div className="admin-loading-spinner" />
        <p>Loading analytics...</p>
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout title="Analytics">
      <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: 16, padding: '24px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16
        }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'rgba(22,163,74,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#4ade80' }}>
                <BarChart3 size={20} />
              </div>
              <div style={{ fontSize:22, fontWeight:800, color:'#f1f5f9' }}>Analytics Overview</div>
            </div>
            <div style={{ fontSize:13, color:'#64748b' }}>
              {isAllSites ? 'All sites combined' : `Site: ${selectedSite?.name}`} · Showing {range === 'all' ? 'all-time' : `last ${range} days`} data
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', background:'rgba(255,255,255,0.06)', borderRadius:10, padding:4, gap:2 }}>
              {ranges.map(r => (
                <button key={r.value} onClick={() => setRange(r.value)} style={{
                  padding:'6px 14px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                  background: range === r.value ? '#16A34A' : 'transparent',
                  color: range === r.value ? '#fff' : '#94a3b8',
                  transition: 'all .15s'
                }}>{r.label}</button>
              ))}
            </div>
            <button onClick={loadData} style={{
              width:36, height:36, borderRadius:9, border:'1px solid rgba(255,255,255,0.1)',
              background:'rgba(255,255,255,0.05)', color:'#94a3b8', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center'
            }} title="Refresh"><RefreshCw size={15} /></button>
          </div>
        </div>

        {/* ── KPI Cards ───────────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16 }}>
          <KpiCard icon={DollarSign}   label="Total Revenue"       value={fmt$(kpi.revenue)}        sub={`${filteredOrders.length} orders`}       color="#16A34A" trend={kpi.revTrend} />
          <KpiCard icon={Package}      label="New Orders"          value={filteredOrders.length}      sub={`${kpi.completed} completed`}            color="#3B82F6" />
          <KpiCard icon={Users}        label="New Students"        value={kpi.newStudents}            sub="Signed up this period"                   color="#A855F7" trend={kpi.userTrend} />
          <KpiCard icon={TrendingUp}   label="Avg Order Value"     value={fmt$(kpi.avgOrderValue)}   sub="Per order"                               color="#F59E0B" />
          <KpiCard icon={CheckCircle}  label="Completion Rate"     value={`${kpi.completionRate}%`}  sub={`${kpi.completed} of ${filteredOrders.length}`} color="#06B6D4" />
          <KpiCard icon={DollarSign}   label="Wallet Top-ups"      value={fmt$(kpi.walletCredits)}   sub="Credited this period"                    color="#EF4444" />
        </div>

        {/* ── Revenue + Orders Area Chart ─────────────────────────── */}
        <div style={{ background:'#fff', borderRadius:14, padding:'24px 24px 16px', border:'1px solid #e2e8f0' }}>
          <SectionHead icon={TrendingUp} title="Revenue & Orders Over Time" sub="Monthly breakdown" />
          {monthlyData.length === 0 ? (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:'40px 0', fontSize:14 }}>No data for selected period</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData} margin={{ top:10, right:20, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rev" orientation="left" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip prefix="$" />} />
                <Legend wrapperStyle={{ fontSize:12, paddingTop:12 }} />
                <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#16A34A" strokeWidth={2.5} fill="url(#colorRev)" dot={{ fill:'#16A34A', strokeWidth:0, r:4 }} activeDot={{ r:6 }} />
                <Area yAxisId="ord" type="monotone" dataKey="orders"  name="Orders" stroke="#3B82F6" strokeWidth={2.5} fill="url(#colorOrd)" dot={{ fill:'#3B82F6', strokeWidth:0, r:4 }} activeDot={{ r:6 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Row: Status Pie + Payment Status Pie ─────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Order Status */}
          <div style={{ background:'#fff', borderRadius:14, padding:'24px 24px 16px', border:'1px solid #e2e8f0' }}>
            <SectionHead icon={Package} title="Orders by Status" sub="Current distribution" />
            {statusData.length === 0 ? (
              <div style={{ textAlign:'center', color:'#94a3b8', padding:'40px 0', fontSize:14 }}>No data</div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:24 }}>
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {statusData.map((entry, i) => {
                        const statusKey = entry.name.replace(' ','_')
                        return <Cell key={i} fill={STATUS_COLOR[statusKey] || PIE_COLORS[i % PIE_COLORS.length]} />
                      })}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                  {statusData.map((s, i) => {
                    const statusKey = s.name.replace(' ','_')
                    const color = STATUS_COLOR[statusKey] || PIE_COLORS[i % PIE_COLORS.length]
                    const pct = filteredOrders.length ? Math.round((s.value / filteredOrders.length) * 100) : 0
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }} />
                        <span style={{ fontSize:12, color:'#64748b', flex:1, textTransform:'capitalize' }}>{s.name}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>{s.value}</span>
                        <span style={{ fontSize:11, color:'#94a3b8', width:34, textAlign:'right' }}>{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Payment Status */}
          <div style={{ background:'#fff', borderRadius:14, padding:'24px 24px 16px', border:'1px solid #e2e8f0' }}>
            <SectionHead icon={DollarSign} title="Payment Status" sub="Paid vs partial vs unpaid" />
            {payStatusData.length === 0 ? (
              <div style={{ textAlign:'center', color:'#94a3b8', padding:'40px 0', fontSize:14 }}>No data</div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:24 }}>
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie data={payStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {payStatusData.map((entry, i) => {
                        const colors = ['#16A34A','#F59E0B','#EF4444']
                        return <Cell key={i} fill={colors[i]} />
                      })}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                  {payStatusData.map((s, i) => {
                    const colors = ['#16A34A','#F59E0B','#EF4444']
                    const pct = filteredOrders.length ? Math.round((s.value / filteredOrders.length) * 100) : 0
                    return (
                      <div key={i}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:12, color:'#64748b', display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ width:8, height:8, borderRadius:'50%', background:colors[i], display:'inline-block' }} />
                            {s.name}
                          </span>
                          <span style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>{s.value}</span>
                        </div>
                        <div style={{ height:4, background:'#f1f5f9', borderRadius:999 }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:colors[i], borderRadius:999 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Row: Order Types + Payment Plans ─────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Order types bar */}
          <div style={{ background:'#fff', borderRadius:14, padding:'24px 24px 16px', border:'1px solid #e2e8f0' }}>
            <SectionHead icon={Package} title="Orders by Type" sub="What students order most" />
            {typeData.length === 0 ? (
              <div style={{ textAlign:'center', color:'#94a3b8', padding:'40px 0', fontSize:14 }}>No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={typeData} layout="vertical" margin={{ top:0, right:20, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Orders" fill="#3B82F6" radius={[0,6,6,0]} maxBarSize={22}>
                    {typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment Plans */}
          <div style={{ background:'#fff', borderRadius:14, padding:'24px 24px 16px', border:'1px solid #e2e8f0' }}>
            <SectionHead icon={DollarSign} title="Payment Plans" sub="How students prefer to pay" />
            {planData.length === 0 ? (
              <div style={{ textAlign:'center', color:'#94a3b8', padding:'40px 0', fontSize:14 }}>No data</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:8 }}>
                {planData.map((p, i) => {
                  const planColors = { 'Full':'#16A34A', 'Weekly':'#3B82F6', 'Biweekly':'#A855F7', 'Split Half':'#F59E0B' }
                  const color = planColors[p.name] || PIE_COLORS[i]
                  const total = planData.reduce((s, d) => s + d.value, 0)
                  const pct = total ? Math.round((p.value / total) * 100) : 0
                  return (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ width:10, height:10, borderRadius:'50%', background:color, display:'inline-block' }} />
                          <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>{p.name}</span>
                        </div>
                        <div style={{ display:'flex', gap:10 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{p.value}</span>
                          <span style={{ fontSize:12, color:'#94a3b8', width:36, textAlign:'right' }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height:6, background:'#f1f5f9', borderRadius:999 }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:999, transition:'width .4s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Row: User Growth + Top Subjects ──────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* User growth */}
          <div style={{ background:'#fff', borderRadius:14, padding:'24px 24px 16px', border:'1px solid #e2e8f0' }}>
            <SectionHead icon={Users} title="Student Growth" sub="New signups per month" />
            {userGrowthData.length === 0 ? (
              <div style={{ textAlign:'center', color:'#94a3b8', padding:'40px 0', fontSize:14 }}>No signups in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={userGrowthData} margin={{ top:10, right:10, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A855F7" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#A855F760" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="students" name="New Students" fill="url(#userGrad)" radius={[6,6,0,0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Subjects */}
          <div style={{ background:'#fff', borderRadius:14, padding:'24px 24px 16px', border:'1px solid #e2e8f0' }}>
            <SectionHead icon={BarChart3} title="Top Subjects" sub="Most requested subjects" />
            {subjectData.length === 0 ? (
              <div style={{ textAlign:'center', color:'#94a3b8', padding:'40px 0', fontSize:14 }}>No data</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }}>
                {subjectData.map((s, i) => {
                  const pct = subjectData[0].count ? Math.round((s.count / subjectData[0].count) * 100) : 0
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{
                        width:22, height:22, borderRadius:6, background:'#f8fafc', border:'1px solid #e2e8f0',
                        fontSize:11, fontWeight:700, color:'#64748b',
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
                      }}>{i + 1}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:12, color:'#374151', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'75%' }}>{s.subject}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:'#0f172a', flexShrink:0 }}>{s.count}</span>
                        </div>
                        <div style={{ height:4, background:'#f1f5f9', borderRadius:999 }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius:999 }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Feedback Section Divider ─────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
          <div style={{
            display:'flex', alignItems:'center', gap:8, padding:'6px 16px',
            background:'linear-gradient(135deg,#fef3c7,#fde68a)', borderRadius:20,
            fontSize:13, fontWeight:700, color:'#92400e'
          }}>
            <Star size={14} fill="#f59e0b" color="#f59e0b" /> Feedback & Reviews
          </div>
          <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
        </div>

        {/* ── Feedback KPI cards ────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:16 }}>
          {[
            { icon:MessageSquare, label:'Total Reviews',  value: feedbackKpi.total,           color:'#6366f1', sub:'All time in period' },
            { icon:Star,          label:'Average Rating', value: feedbackKpi.total > 0 ? `${feedbackKpi.avg} / 5` : '—', color:'#f59e0b', sub:'Out of 5 stars' },
            { icon:Star,          label:'5-Star Reviews', value: feedbackKpi.fiveStar,         color:'#22c55e', sub:'Excellent ratings' },
            { icon:TrendingUp,    label:'5-Star Rate',    value: feedbackKpi.total > 0 ? `${feedbackKpi.fiveStarRate}%` : '—', color:'#8b5cf6', sub:'Of all reviews' },
          ].map((c,i) => <KpiCard key={i} {...c} />)}
        </div>

        {/* ── Row: Rating Distribution + Avg Rating Over Time ─────── */}
        <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:16 }}>
          {/* Rating breakdown bars */}
          <div style={{ background:'#fff', borderRadius:14, padding:'24px', border:'1px solid #e2e8f0' }}>
            <SectionHead icon={Star} title="Rating Breakdown" sub="Stars distribution" />
            {feedbackKpi.total === 0 ? (
              <div style={{ textAlign:'center', color:'#94a3b8', padding:'30px 0', fontSize:14 }}>No reviews yet</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {feedbackKpi.dist.map(({ r, label, color, count, pct }) => (
                  <div key={r} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:13, fontWeight:700, color, width:14, textAlign:'right', flexShrink:0 }}>{r}</span>
                    <span style={{ fontSize:15, flexShrink:0 }}>⭐</span>
                    <div style={{ flex:1, height:10, borderRadius:999, background:'#f1f5f9', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:999, transition:'width .5s' }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:'#0f172a', width:24, textAlign:'right', flexShrink:0 }}>{count}</span>
                    <span style={{ fontSize:11, color:'#94a3b8', width:34, textAlign:'right', flexShrink:0 }}>{pct}%</span>
                  </div>
                ))}
                {/* Big avg display */}
                <div style={{
                  marginTop:16, padding:'14px', borderRadius:12,
                  background:'linear-gradient(135deg,#fef9c3,#fef3c7)',
                  border:'1px solid #fde68a', textAlign:'center'
                }}>
                  <div style={{ fontSize:40, fontWeight:900, color:'#92400e', lineHeight:1 }}>{feedbackKpi.avg}</div>
                  <div style={{ fontSize:22, marginTop:4 }}>{'⭐'.repeat(Math.round(parseFloat(feedbackKpi.avg)))}</div>
                  <div style={{ fontSize:12, color:'#a16207', marginTop:4 }}>Average across {feedbackKpi.total} reviews</div>
                </div>
              </div>
            )}
          </div>

          {/* Avg rating over time area chart */}
          <div style={{ background:'#fff', borderRadius:14, padding:'24px 24px 16px', border:'1px solid #e2e8f0' }}>
            <SectionHead icon={TrendingUp} title="Rating Trend Over Time" sub="Average score per month" />
            {ratingByMonth.length === 0 ? (
              <div style={{ textAlign:'center', color:'#94a3b8', padding:'60px 0', fontSize:14 }}>No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={ratingByMonth} margin={{ top:10, right:20, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,5]} ticks={[1,2,3,4,5]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="avg" name="Avg Rating" stroke="#f59e0b" strokeWidth={2.5}
                    fill="url(#ratingGrad)" dot={{ fill:'#f59e0b', strokeWidth:0, r:5 }} activeDot={{ r:7 }} />
                  <Area type="monotone" dataKey="count" name="Reviews" stroke="#6366f1" strokeWidth={2}
                    fill="none" dot={{ fill:'#6366f1', strokeWidth:0, r:3 }} activeDot={{ r:5 }} yAxisId={undefined} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Recent Reviews ────────────────────────────────────────── */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e2e8f0', overflow:'hidden' }}>
          <div style={{ padding:'20px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <SectionHead icon={MessageSquare} title="Recent Reviews" sub={`Latest ${Math.min(5, filteredFeedback.length)} of ${filteredFeedback.length}`} />
          </div>
          {filteredFeedback.length === 0 ? (
            <div style={{ padding:'48px', textAlign:'center', color:'#94a3b8', fontSize:14 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>💬</div>
              No reviews in this period
            </div>
          ) : (
            <div>
              {[...filteredFeedback].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,5).map((fb, i) => {
                const name = fb.user_name || fb.user_email?.split('@')[0] || 'Student'
                const initial = name[0]?.toUpperCase() || 'S'
                const color = STAR_COLORS[fb.rating]
                return (
                  <div key={fb.id} style={{
                    padding:'16px 24px', borderBottom: i < 4 ? '1px solid #f8fafc' : 'none',
                    display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14, alignItems:'start'
                  }}>
                    <div style={{
                      width:42, height:42, borderRadius:'50%', flexShrink:0,
                      background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:700, fontSize:16, boxShadow:'0 2px 8px rgba(99,102,241,.3)'
                    }}>{initial}</div>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>{name}</span>
                        <span style={{ fontSize:11, color:'#94a3b8' }}>·</span>
                        <span style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>{fb.order_number}</span>
                        {fb.subject && <span style={{ fontSize:11, background:'#f1f5f9', color:'#64748b', padding:'1px 7px', borderRadius:20 }}>{fb.subject}</span>}
                      </div>
                      {fb.comment && (
                        <div style={{
                          fontSize:13, color:'#374151', lineHeight:1.6,
                          background:'#fafafa', borderRadius:8, padding:'8px 12px',
                          borderLeft:`3px solid ${color}`, marginTop:6
                        }}>"{fb.comment}"</div>
                      )}
                      <div style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>
                        {new Date(fb.created_at).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' })}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:15 }}>{'⭐'.repeat(fb.rating)}</div>
                      <div style={{ fontSize:11, fontWeight:700, color, marginTop:2 }}>
                        {['','Poor','Fair','Good','Great','Excellent'][fb.rating]}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Conversion Funnel ────────────────────────────────────── */}
        <div style={{ background:'#fff', borderRadius:14, padding:'24px 28px', border:'1px solid #e2e8f0' }}>
          <SectionHead icon={TrendingUp} title="Order Conversion Funnel" sub="From pending to delivered" />
          <div style={{ display:'flex', alignItems:'stretch', gap:0, marginTop:8 }}>
            {[
              { label:'Pending', count: filteredOrders.filter(o=>o.status==='pending').length, color:'#F59E0B', pct:100 },
              { label:'Active', count: filteredOrders.filter(o=>o.status==='active'||o.status==='in_review').length, color:'#3B82F6', pct: null },
              { label:'Completed', count: filteredOrders.filter(o=>o.status==='completed').length, color:'#16A34A', pct: null },
            ].map((step, i, arr) => {
              const first = arr[0].count || 1
              const pct = Math.round((step.count / first) * 100)
              const arrow = i < arr.length - 1 ? '→' : null
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', flex:1 }}>
                  <div style={{
                    flex:1, background:`${step.color}10`, borderRadius:12,
                    border:`2px solid ${step.color}40`, padding:'18px 20px', textAlign:'center'
                  }}>
                    <div style={{ fontSize:11, fontWeight:600, color: step.color, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{step.label}</div>
                    <div style={{ fontSize:32, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{step.count}</div>
                    <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>
                      {i === 0 ? '100%' : `${pct}% of pending`}
                    </div>
                  </div>
                  {arrow && (
                    <div style={{ fontSize:20, color:'#cbd5e1', padding:'0 12px', flexShrink:0 }}>→</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}
