import { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { useSite } from '../contexts/SiteContext'
import { formatDateTime } from '../lib/stats'
import { Link } from 'react-router-dom'
import { MessageCircle, FileText, CheckCircle, AlertCircle } from 'lucide-react'

export default function ReworksPage() {
  const { selectedSite, isAllSites } = useSite()
  const [reworkRequests, setReworkRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null) // id of row being completed

  useEffect(() => {
    loadReworks()
  }, [selectedSite, isAllSites])

  async function loadReworks() {
    setLoading(true)

    // Fetch ALL active rework messages ([REWORK_REQ] and [REWORK_REQ_READ] but NOT [REWORK_DONE])
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('*, session:chat_sessions(order_id)')
      .like('message', '[REWORK_REQ%')
      .order('created_at', { ascending: false })

    if (!msgs || msgs.length === 0) {
      setReworkRequests([])
      setLoading(false)
      return
    }

    // Mark unread ones as read (badge will clear)
    const unreadMsgs = msgs.filter(m => m.message.startsWith('[REWORK_REQ] '))
    for (const msg of unreadMsgs) {
      await supabase.from('chat_messages')
        .update({ message: msg.message.replace('[REWORK_REQ] ', '[REWORK_REQ_READ] ') })
        .eq('id', msg.id)
    }

    // Collect all order IDs
    const orderIds = [...new Set(msgs.map(m => m.session?.order_id).filter(Boolean))]

    let ordersMap = {}
    if (orderIds.length > 0) {
      let q = supabase.from('orders').select('*').in('id', orderIds)
      if (selectedSite && !isAllSites) q = q.eq('site_id', selectedSite.id)
      const { data: orders } = await q
      if (orders) {
        orders.forEach(o => { ordersMap[o.id] = o })
        // Auto-set completed orders back to active when a rework arrives
        const needsActive = orders.filter(o => o.status === 'completed').map(o => o.id)
        if (needsActive.length > 0) {
          await supabase.from('orders').update({ status: 'active' }).in('id', needsActive)
          needsActive.forEach(id => { if (ordersMap[id]) ordersMap[id].status = 'active' })
        }
      }
    }

    // Build list ALL reworks, each one is its own row (no grouping)
    const combined = msgs
      .filter(m => m.session?.order_id && ordersMap[m.session.order_id])
      .map(m => {
        let payload = {}
        try {
          const jsonStr = m.message
            .replace('[REWORK_REQ] ', '')
            .replace('[REWORK_REQ_READ] ', '')
          payload = JSON.parse(jsonStr)
        } catch (e) { }

        return {
          id: m.id,
          created_at: m.created_at,
          order: ordersMap[m.session.order_id],
          description: payload.description || '',
          files: payload.files || [],
        }
      })

    setReworkRequests(combined)
    setLoading(false)
  }

  // Marks a single rework as complete removes it from the list
  async function markComplete(reqId) {
    setCompleting(reqId)
    const req = reworkRequests.find(r => r.id === reqId)
    if (!req) { setCompleting(null); return }

    // 1. Mark the rework message as done
    const payload = { description: req.description, files: req.files }
    const newMsg = `[REWORK_DONE] ${JSON.stringify(payload)}`

    const { error } = await supabase
      .from('chat_messages')
      .update({ message: newMsg })
      .eq('id', reqId)

    if (error) {
      alert('Failed to mark complete: ' + error.message)
      setCompleting(null)
      return
    }

    // 2. Set order status to completed
    const completedAt = new Date().toISOString()
    let { error: orderError } = await supabase.from('orders')
      .update({ status: 'completed', completed_at: completedAt }).eq('id', req.order.id)
    if (orderError) {
      // completed_at column may not exist — retry without it
      const res = await supabase.from('orders').update({ status: 'completed' }).eq('id', req.order.id)
      orderError = res.error
    }
    if (orderError) console.error('Failed to set order completed:', orderError.message)

    // 3. Find the order's chat session and send a completion message to the student
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('order_id', req.order.id)
      .eq('chat_type', 'order')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (session) {
      const completionMsg = `✅ *Rework Completed!*\n\nGreat news! We've reviewed your rework request and have made the necessary revisions to your order.\n\n📋 *What was addressed:* "${req.description || 'Your requested changes'}"\n\nYour updated work is now ready. Please review it and don't hesitate to reach out if you need any further adjustments. We're here to make sure you're 100% satisfied! 🎯`

      await supabase.from('chat_messages').insert({
        session_id: session.id,
        sender_type: 'admin',
        sender_name: 'Support',
        message: completionMsg,
        read: false
      })

      await supabase.from('chat_sessions').update({
        last_message: '✅ Rework Completed! Your revised work is ready.',
        unread_count: 1,
        updated_at: new Date().toISOString()
      }).eq('id', session.id)

      // 4. Send in-app notification to the student
      if (req.order.user_id) {
        try {
          const { createNotification } = await import('../lib/notifications')
          const orderNum = req.order.order_number?.replace('OD-', '') || req.order.id
          await createNotification(
            req.order.user_id,
            'order',
            '✅ Rework Completed!',
            `Your rework request for order ${orderNum} has been completed. Your revised work is ready to review.`
          )
        } catch (e) { console.error('Notification error:', e) }
      }
    }

    // Remove from local state immediately
    setReworkRequests(prev => prev.filter(r => r.id !== reqId))
    setCompleting(null)
  }

  function renderFileTags(files) {
    if (!files || files.length === 0) return null
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
        {files.map((fileTag, i) => {
          const match = fileTag.match(/\[FILE:::(.*?):::(.*?)\]/)
          if (!match) return null
          const [, filePath, fileName] = match
          return (
            <button
              key={i}
              onClick={async () => {
                const { data } = await supabase.storage
                  .from('order-files')
                  .createSignedUrl(filePath, 3600)
                if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                else alert('File unavailable or expired.')
              }}
              className="admin-btn admin-btn-outline"
              style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={13} /> {fileName}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <AdminLayout title="Reworks">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} color="#EF4444" />
            Rework Requests
          </h3>
          <span>{reworkRequests.length} pending</span>
        </div>

        {loading ? (
          <div className="admin-empty">Loading reworks...</div>
        ) : reworkRequests.length === 0 ? (
          <div className="admin-empty">
            <CheckCircle size={40} color="#10b981" style={{ marginBottom: '16px', opacity: 0.8 }} />
            <h3>No Active Reworks</h3>
            <p style={{ color: '#64748b' }}>All rework requests have been resolved.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Order / Time</th>
                  <th>Rework Details</th>
                  <th style={{ width: '190px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reworkRequests.map(req => (
                  <tr key={req.id}>
                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                        {req.order.order_number?.replace('OD-', '') || req.order.id}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        {formatDateTime(req.created_at)}
                      </div>
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{
                        background: '#fef9f0', padding: '12px', borderRadius: '8px',
                        border: '1px solid #fed7aa', color: '#334155', fontSize: '14px',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {req.description || <em style={{ color: '#94a3b8' }}>No description provided</em>}
                        {renderFileTags(req.files)}
                      </div>
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Mark Complete button removes from list */}
                        <button
                          onClick={() => markComplete(req.id)}
                          disabled={completing === req.id}
                          className="admin-btn admin-btn-primary"
                          style={{
                            background: '#10b981', borderColor: '#10b981',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            opacity: completing === req.id ? 0.6 : 1
                          }}
                        >
                          <CheckCircle size={14} />
                          {completing === req.id ? 'Saving...' : 'Mark Complete'}
                        </button>

                        {/* Open Chat button */}
                        <Link
                          to={`/messages?tab=order&orderId=${req.order.id}`}
                          className="admin-btn admin-btn-outline"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <MessageCircle size={14} /> Chat
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}