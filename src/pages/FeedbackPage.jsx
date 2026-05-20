import { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { useSite } from '../contexts/SiteContext'
import { Star, MessageSquare, TrendingUp, Award } from 'lucide-react'

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']
const STAR_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

function StarDisplay({ rating, size = 16 }) {
  return (
    <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ fontSize: size, filter: s <= rating ? 'none' : 'grayscale(1) opacity(0.25)' }}>⭐</span>
      ))}
    </span>
  )
}

export default function FeedbackPage() {
  const { selectedSite, isAllSites } = useSite()
  const [feedbacks, setFeedbacks]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('all') // all | 5 | 4 | 3 | 2 | 1

  useEffect(() => {
    loadFeedback()
  }, [selectedSite, isAllSites])

  async function loadFeedback() {
    setLoading(true)
    let q = supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (selectedSite && !isAllSites) q = q.eq('site_id', selectedSite.id)

    const { data } = await q
    setFeedbacks(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all'
    ? feedbacks
    : feedbacks.filter(f => f.rating === parseInt(filter))

  // Stats
  const total     = feedbacks.length
  const avgRating = total > 0
    ? (feedbacks.reduce((s, f) => s + f.rating, 0) / total).toFixed(1)
    : '—'
  const fiveStar  = feedbacks.filter(f => f.rating === 5).length
  const dist      = [5, 4, 3, 2, 1].map(r => ({
    r,
    count: feedbacks.filter(f => f.rating === r).length,
    pct: total > 0 ? Math.round(feedbacks.filter(f => f.rating === r).length / total * 100) : 0,
  }))

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const getUserName  = (fb) => fb.user_name  || fb.user_email?.split('@')[0] || 'Student'
  const getUserEmail = (fb) => fb.user_email || ''
  const getInitial   = (fb) => getUserName(fb)[0]?.toUpperCase() || 'S'

  return (
    <AdminLayout title="Feedback">
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { icon: <MessageSquare size={20} />, label: 'Total Reviews', value: total, color: '#6366f1' },
          { icon: <Star size={20} />,          label: 'Average Rating', value: total > 0 ? `${avgRating} / 5` : '—', color: '#f59e0b' },
          { icon: <Award size={20} />,         label: '5-Star Reviews', value: fiveStar, color: '#22c55e' },
          { icon: <TrendingUp size={20} />,    label: '5-Star Rate', value: total > 0 ? `${Math.round(fiveStar / total * 100)}%` : '—', color: '#8b5cf6' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: s.color + '18', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Rating distribution panel */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Rating Breakdown</h3>
          {dist.map(({ r, count, pct }) => (
            <div
              key={r}
              onClick={() => setFilter(filter === String(r) ? 'all' : String(r))}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '8px', marginBottom: '4px',
                cursor: 'pointer',
                background: filter === String(r) ? '#f5f3ff' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: STAR_COLORS[r], width: '16px', textAlign: 'right' }}>{r}</span>
              <span style={{ fontSize: '14px' }}>⭐</span>
              <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: STAR_COLORS[r], transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: '12px', color: '#6b7280', width: '30px', textAlign: 'right' }}>{count}</span>
            </div>
          ))}

          <button
            onClick={() => setFilter('all')}
            style={{
              width: '100%', marginTop: '12px', padding: '8px',
              borderRadius: '8px', border: '1px solid #e5e7eb',
              background: filter === 'all' ? '#6366f1' : 'white',
              color: filter === 'all' ? 'white' : '#6b7280',
              fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}
          >
            Show All
          </button>
        </div>

        {/* Feedback list */}
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#111827' }}>
              {filter === 'all' ? `All Reviews (${total})` : `${filter}-Star Reviews (${filtered.length})`}
            </h3>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} style={{ fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Clear filter ×
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>Loading feedback...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
              <p style={{ color: '#9ca3af', margin: 0 }}>No feedback yet for this filter.</p>
            </div>
          ) : (
            <div>
              {filtered.map((fb) => (
                <div key={fb.id} style={{ padding: '18px 20px', borderBottom: '1px solid #f8fafc', display: 'grid', gap: '10px' }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '15px', flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(99,102,241,0.35)'
                      }}>
                        {getInitial(fb)}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{getUserName(fb)}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '1px' }}>{getUserEmail(fb)}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          Order <span style={{ fontFamily: 'monospace', color: '#6366f1' }}>{fb.order_number}</span> · {fb.subject}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <StarDisplay rating={fb.rating} size={14} />
                      <div style={{ fontSize: '11px', fontWeight: 700, color: STAR_COLORS[fb.rating], marginTop: '2px' }}>
                        {STAR_LABELS[fb.rating]}
                      </div>
                    </div>
                  </div>

                  {/* Comment */}
                  {fb.comment && (
                    <div style={{
                      background: '#fafafa', borderRadius: '8px', padding: '12px 14px',
                      fontSize: '14px', color: '#374151', lineHeight: '1.6',
                      borderLeft: `3px solid ${STAR_COLORS[fb.rating]}`,
                    }}>
                      "{fb.comment}"
                    </div>
                  )}

                  {/* Date */}
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>{formatDate(fb.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
