// ============================================================
// MESSAGES PAGE v3 3 Tabs: Guest | User | Order
// ============================================================

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { MessageSquare, Send, X, Mail, Clock, Volume2, VolumeX, Star, Users, Package, DollarSign, Paperclip, ClipboardList, Copy, Check } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { useSite } from '../contexts/SiteContext'
import { useAuth } from '../contexts/AuthContext'

const TABS = [
  { key: 'guest', label: 'Guest Chats', icon: MessageSquare, filter: 'guest' },
  { key: 'user', label: 'User Messages', icon: Users, filter: 'user' },
  { key: 'order', label: 'Order Messages', icon: Package, filter: 'order' }
]

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedSite, isAllSites } = useSite()
  const { user, profile } = useAuth()
  const myAdminName = profile?.full_name || user?.email?.split('@')[0] || 'Admin'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'guest')

  // Realtime presence: who's viewing what right now (other admins only)
  // Map<session_id, [{ admin_id, admin_name }]>
  const [adminsBySession, setAdminsBySession] = useState({})
  const presenceChannelRef = useRef(null)

  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const fileInputRef = useRef(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [orderNumbers, setOrderNumbers] = useState({})

  const [showDetailModal, setShowDetailModal] = useState(false)
  const [sendingDetailReq, setSendingDetailReq] = useState(false)

  async function handleSendDetailRequest() {
    if (!activeSession || sendingDetailReq) return
    setSendingDetailReq(true)
    const msg = '[DETAIL_REQUEST]'
    try {
      await supabase.from('chat_messages').insert({
        session_id: activeSession.id, sender_type: 'admin',
        sender_name: 'Support', message: msg, read: false
      })
      await supabase.from('chat_sessions').update({
        last_message: '📋 Detail request sent', updated_at: new Date().toISOString()
      }).eq('id', activeSession.id)
      setMessages(prev => [...prev, { id: `t-${Date.now()}`, session_id: activeSession.id, sender_type: 'admin', sender_name: 'Support', message: msg, read: false, created_at: new Date().toISOString() }])
      setShowDetailModal(false)
      loadSessions()
    } catch (e) { console.error(e) }
    finally { setSendingDetailReq(false) }
  }

  const [visitorTyping, setVisitorTyping] = useState(false)
  const [visitorOnline, setVisitorOnline] = useState(false)
  const [globalOnlineUsers, setGlobalOnlineUsers] = useState(new Set())
  // Managers gate for order chats: admin must assign a manager before replying.
  const [allManagers, setAllManagers] = useState([])
  const [sessionManager, setSessionManager] = useState(null) // { name, internal_name } | null
  const [assigningManager, setAssigningManager] = useState(false)
  const [inlineManagerId, setInlineManagerId] = useState('')
  const typingTimeoutRef = useRef(null)
  const channelRef = useRef(null)
  const audioContextRef = useRef(null)
  const messagesEndRef = useRef(null)
  const autoCreateRef     = useRef(false)
  const autoCreateUserRef = useRef(false)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => { scrollToBottom() }, [messages])

  // ===== LOAD SESSIONS (filtered by tab) =====
  useEffect(() => { loadSessions() }, [selectedSite, isAllSites, activeTab])

  async function loadSessions() {
    setLoading(true)
    let query = supabase.from('chat_sessions').select('*')
      .eq('chat_type', activeTab)
      .order('updated_at', { ascending: false })
    if (selectedSite && !isAllSites) query = query.eq('site_id', selectedSite.id)
    const { data } = await query
    const sessionList = data || []
    setSessions(sessionList)

    // Fetch order numbers for order-type sessions
    if (activeTab === 'order') {
      const orderIds = sessionList.filter(s => s.order_id).map(s => s.order_id)
      if (orderIds.length > 0) {
        const { data: orders } = await supabase.from('orders').select('id, order_number').in('id', orderIds)
        if (orders) {
          const map = {}
          orders.forEach(o => { map[o.id] = o.order_number })
          setOrderNumbers(map)
        }
      }
    }
    setLoading(false)
  }

  // ===== Tab counts =====
  const [tabCounts, setTabCounts] = useState({ guest: 0, user: 0, order: 0 })
  useEffect(() => {
    async function loadCounts() {
      const results = {}
      for (const type of ['guest', 'user', 'order']) {
        let q = supabase.from('chat_sessions').select('unread_count').eq('chat_type', type).gt('unread_count', 0)
        if (selectedSite && !isAllSites) q = q.eq('site_id', selectedSite.id)
        const { data } = await q
        results[type] = data?.reduce((s, r) => s + (r.unread_count || 0), 0) || 0
      }
      setTabCounts(results)
    }
    loadCounts()
  }, [sessions, selectedSite, isAllSites])

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
      Object.keys(state).forEach(userId => {
        onlineSet.add(userId)
      })
      setGlobalOnlineUsers(onlineSet)
    })
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ role: 'admin' })
      }
    })
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ===== Auto-select from URL =====
  useEffect(() => {
    async function checkTargetOrder() {
      const targetOrderId = searchParams.get('orderId')
      if (!targetOrderId || loading || autoCreateRef.current) return

      let targetSession = sessions.find(s => s.order_id === targetOrderId)

      // If no session exists for this order, create one!
      if (!targetSession) {
        autoCreateRef.current = true
        const { data: order } = await supabase.from('orders').select('user_id, site_id, order_number').eq('id', targetOrderId).single()
        if (order) {
          const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', order.user_id).single()

          const newSession = {
            chat_type: 'order',
            user_id: order.user_id,
            order_id: targetOrderId,
            site_id: order.site_id,
            visitor_name: profile?.full_name || 'Student',
            visitor_email: profile?.email || 'student@easyassignments.com',
            status: 'active',
            unread_count: 0
          }
          const { data: inserted } = await supabase.from('chat_sessions').insert(newSession).select().single()
          if (inserted) {
            targetSession = inserted
            setSessions(prev => [inserted, ...prev])
            setOrderNumbers(prev => ({ ...prev, [targetOrderId]: order.order_number }))
          }
        }
        autoCreateRef.current = false
      }

      if (targetSession && (!activeSession || activeSession.id !== targetSession.id)) {
        loadMessages(targetSession)
        setSearchParams(prev => {
          const params = new URLSearchParams(prev)
          params.delete('orderId')
          return params
        }, { replace: true })
      }
    }

    checkTargetOrder()
  }, [loading, searchParams, activeSession, setSearchParams, sessions])

  // ===== Auto-select user session from URL ?userId= =====
  useEffect(() => {
    async function checkTargetUser() {
      const targetUserId = searchParams.get('userId')
      if (!targetUserId || loading || autoCreateUserRef.current) return
      if (activeTab !== 'user') return

      let targetSession = sessions.find(s => s.user_id === targetUserId)

      if (!targetSession) {
        autoCreateUserRef.current = true
        const { data: profile } = await supabase.from('profiles').select('full_name, email, site_id').eq('id', targetUserId).single()
        if (profile) {
          const newSession = {
            chat_type: 'user',
            user_id: targetUserId,
            site_id: profile.site_id || 1,
            visitor_name: profile.full_name || 'Student',
            visitor_email: profile.email || '',
            status: 'active',
            unread_count: 0
          }
          const { data: inserted } = await supabase.from('chat_sessions').insert(newSession).select().single()
          if (inserted) {
            targetSession = inserted
            setSessions(prev => [inserted, ...prev])
          }
        }
        autoCreateUserRef.current = false
      }

      if (targetSession && (!activeSession || activeSession.id !== targetSession.id)) {
        loadMessages(targetSession)
        setSearchParams(prev => {
          const params = new URLSearchParams(prev)
          params.delete('userId')
          return params
        }, { replace: true })
      }
    }

    checkTargetUser()
  }, [loading, searchParams, activeSession, activeTab, setSearchParams, sessions])

  // ===== LOAD MANAGERS (once) =====
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('managers')
        .select('id, name, internal_name')
        .order('name', { ascending: true })
      setAllManagers(data || [])
    })()
  }, [])

  // ===== ADMIN-TO-ADMIN PRESENCE =====
  // One global channel. Each admin tracks their { admin_id, admin_name,
  // current_session_id }. When state syncs, build a map
  // session_id -> [other admins currently viewing it].
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase.channel('admin-presence-global', {
      config: { presence: { key: user.id } }
    })
    presenceChannelRef.current = ch

    function rebuildMap() {
      const state = ch.presenceState()
      const map = {}
      for (const key of Object.keys(state)) {
        if (key === user.id) continue // skip myself
        for (const meta of state[key]) {
          const sid = meta.current_session_id
          if (!sid) continue
          if (!map[sid]) map[sid] = []
          if (!map[sid].find(a => a.admin_id === meta.admin_id)) {
            map[sid].push({ admin_id: meta.admin_id, admin_name: meta.admin_name })
          }
        }
      }
      setAdminsBySession(map)
    }

    ch.on('presence', { event: 'sync' },  rebuildMap)
    ch.on('presence', { event: 'join' },  rebuildMap)
    ch.on('presence', { event: 'leave' }, rebuildMap)

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ admin_id: user.id, admin_name: myAdminName, current_session_id: null })
      }
    })

    return () => {
      ch.untrack().catch(() => {})
      supabase.removeChannel(ch)
      presenceChannelRef.current = null
    }
  }, [user?.id, myAdminName])

  // Update tracked current_session_id whenever the active session changes
  useEffect(() => {
    const ch = presenceChannelRef.current
    if (!ch || !user?.id) return
    ch.track({ admin_id: user.id, admin_name: myAdminName, current_session_id: activeSession?.id || null }).catch(() => {})
  }, [activeSession?.id, user?.id, myAdminName])

  // ===== LOAD ASSIGNED MANAGER for current session's customer =====
  async function loadSessionManager(userId) {
    if (!userId) { setSessionManager(null); setInlineManagerId(''); return }
    const { data: profile } = await supabase
      .from('profiles')
      .select('manager_id')
      .eq('id', userId)
      .maybeSingle()
    if (!profile?.manager_id) { setSessionManager(null); setInlineManagerId(''); return }
    const { data: mgr } = await supabase
      .from('managers')
      .select('id, name, internal_name')
      .eq('id', profile.manager_id)
      .maybeSingle()
    setSessionManager(mgr || null)
    setInlineManagerId(mgr?.id || '')
  }

  async function handleInlineAssignManager(managerId) {
    if (!activeSession?.user_id || !managerId) return
    setAssigningManager(true)
    const { error } = await supabase
      .from('profiles')
      .update({ manager_id: managerId })
      .eq('id', activeSession.user_id)
    if (error) {
      alert(`Could not assign manager: ${error.message}`)
      setAssigningManager(false)
      return
    }
    await loadSessionManager(activeSession.user_id)

    // Fire-and-forget manager-assigned email same edge function as
    // the OrderDetailPage path. Function looks up the current manager
    // server-side, so the email reflects the real DB state.
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
            userId: activeSession.user_id,
            appOrigin: window.location.origin,
          }),
        }).catch(err => console.error('Manager email failed (non-critical):', err.message))
      }
    } catch (_) { /* never block assignment on email */ }

    setAssigningManager(false)
  }

  // ===== SELECT SESSION =====
  async function loadMessages(session) {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    setActiveSession(session)
    setReplyText('')
    setVisitorTyping(false)
    setVisitorOnline(false)
    // Fetch the assigned manager only for order chats (the gate only applies there)
    if (session?.chat_type === 'order') {
      loadSessionManager(session.user_id)
    } else {
      setSessionManager(null); setInlineManagerId('')
    }

    const { data } = await supabase.from('chat_messages').select('*')
      .eq('session_id', session.id).order('created_at', { ascending: true })
    setMessages(data || [])

    await supabase.from('chat_messages').update({ read: true })
      .eq('session_id', session.id).eq('sender_type', 'visitor').eq('read', false)
    await supabase.from('chat_sessions').update({ unread_count: 0 }).eq('id', session.id)
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, unread_count: 0 } : s))

    // Determine channel name based on chat type
    const channelPrefix = session.chat_type === 'order' ? 'orderchat' : session.chat_type === 'user' ? 'userchat' : 'livechat'
    const channel = supabase.channel(`${channelPrefix}-${session.id}`, { config: { presence: { key: 'admin' } } })

    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload?.sender === 'visitor') {
        setVisitorTyping(true)
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setVisitorTyping(false), 2000)
      }
    })
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      setVisitorOnline(Object.values(state).flat().some(p => p.role === 'visitor' || p.role === 'student'))
    })
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ role: 'admin' })
    })
    channelRef.current = channel
  }

  const sendTypingEvent = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { sender: 'admin' } })
  }, [])

  // ===== CLEANUP CHANNEL ON UNMOUNT =====
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  // ===== REALTIME =====
  useEffect(() => {
    const ch = supabase.channel('admin-msgs-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const m = payload.new
        if (activeSession && m.session_id === activeSession.id) {
          setMessages(prev => {
            // Skip if already added by real ID
            if (prev.some(e => e.id === m.id)) return prev
            // Replace matching optimistic message (temp ID) with the real one
            const filtered = prev.filter(e =>
              !(String(e.id).startsWith('t-') && e.message === m.message && e.sender_type === m.sender_type)
            )
            return [...filtered, m]
          })
          if (m.sender_type === 'visitor') {
            supabase.from('chat_messages').update({ read: true }).eq('id', m.id).then(() => { })
          }
        }
        if (m.sender_type === 'visitor' && soundEnabled) {
          if (m.message.startsWith('[REWORK_REQ]')) playReworkSound()
          else playNotificationSound()
        }
        loadSessions()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, () => loadSessions())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [activeSession, soundEnabled, activeTab])

  // ===== SEND =====
  async function handleSendReply(e) {
    e.preventDefault()
    if ((!replyText.trim() && selectedFiles.length === 0) || !activeSession || sending || uploading) return
    // Manager-gate: admin cannot reply on an order chat until a manager is assigned to the customer.
    // The auto welcome message on order creation comes from the DB trigger (SECURITY DEFINER) and is not affected.
    if (activeSession.chat_type === 'order' && !sessionManager) {
      alert('Please assign a manager to this customer before replying.')
      return
    }
    const msg = replyText.trim()
    setReplyText('')
    setSending(true)

    let finalMsgText = msg
    let lastMsgPreview = msg

    if (selectedFiles.length > 0) {
      setUploading(true)
      let fileTags = []
      let lastFileName = ''

      const { data: { user } } = await supabase.auth.getUser()

      for (const file of selectedFiles) {
        try {
          const timestamp = Date.now()
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          // Fix for RLS: Storage policy usually requires the root folder to match auth.uid()
          const filePath = `${user?.id}/${timestamp}_${safeName}`

          const { data, error } = await supabase.storage
            .from('order-files')
            .upload(filePath, file, { cacheControl: '3600', upsert: false })

          if (error) throw error

          if (activeSession.chat_type === 'order' && activeSession.order_id) {
            const { error: dbError } = await supabase.from('order_files').insert({
              order_id: activeSession.order_id,
              user_id: user?.id, // Use admin's user_id to comply with INSERT RLS
              site_id: activeSession.site_id,
              file_name: file.name,
              file_path: data.path,
              file_size: file.size,
              file_type: file.type,
              category: 'reference',
              uploaded_by: 'admin',
              notes: msg || null
            })
            if (dbError) {
              console.error("Order files insert error:", dbError)
              // Don't throw, we still want to send the message with the file link
            }
          }

          fileTags.push(`[FILE:::${data.path}:::${file.name}]`)
          lastFileName = file.name
        } catch (err) {
          alert(`Upload failed for ${file.name}: ` + err.message)
        }
      }

      if (fileTags.length > 0) {
        const fileTagStr = fileTags.join('\n')
        finalMsgText = msg ? `${fileTagStr}\n\n${msg}` : fileTagStr
        lastMsgPreview = selectedFiles.length > 1
          ? `📎 ${selectedFiles.length} files${msg ? ' + text' : ''}`
          : `📎 ${lastFileName}${msg ? ' + text' : ''}`
      }

      setSelectedFiles([])
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    if (!finalMsgText) {
      setSending(false)
      return
    }

    setMessages(prev => [...prev, { id: `t-${Date.now()}`, session_id: activeSession.id, sender_type: 'admin', sender_name: myAdminName, message: finalMsgText, read: false, created_at: new Date().toISOString() }])
    try {
      const { data: inserted } = await supabase
        .from('chat_messages')
        .insert({ session_id: activeSession.id, sender_type: 'admin', sender_name: myAdminName, message: finalMsgText, read: false })
        .select('id')
        .single()
      await supabase.from('chat_sessions').update({ last_message: lastMsgPreview || 'New message', updated_at: new Date().toISOString() }).eq('id', activeSession.id)

      // Fire-and-forget email notification to the student. Use a dedicated
      // 'files uploaded' function when the message contained attachments
      // (richer template listing file names), otherwise the regular admin
      // reply function. Both share the same throttle window via
      // chat_sessions.last_admin_email_at so the student never gets two
      // emails for one send.
      if (inserted?.id) {
        const containedFiles = /\[FILE:::[^:]+:::[^\]]+\]/.test(finalMsgText)
        const fnName = containedFiles ? 'send-files-uploaded-email' : 'send-admin-reply-email'
        try {
          const { data: { session: adminSession } } = await supabase.auth.getSession()
          if (adminSession?.access_token) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminSession.access_token}`,
              },
              body: JSON.stringify({
                messageId: inserted.id,
                appOrigin: window.location.origin,
              }),
            }).catch(err => console.error(`${fnName} failed (non-critical):`, err.message))
          }
        } catch (_) { /* never block send on email */ }
      }

      loadSessions()
      if (soundEnabled) playSendSound()
    } catch (e) { console.error(e) }
    finally { setSending(false) }
  }

  function handleFileSelect(e) {
    if (e.target.files?.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)])
    }
  }

  function removeFile(index) {
    setSelectedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index)
      if (newFiles.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return newFiles
    })
  }

  async function handleCloseSession(id) {
    if (!window.confirm('Close this chat?')) return
    await supabase.from('chat_sessions').update({ status: 'closed' }).eq('id', id)
    if (activeSession?.id === id) { setActiveSession(null); setMessages([]) }
    loadSessions()
  }

  function playNotificationSound() {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = ctx
      const now = ctx.currentTime
        ;[830, 1100, 1320].forEach((f, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain()
          o.connect(g); g.connect(ctx.destination); o.frequency.setValueAtTime(f, now + i * 0.15)
          o.type = 'sine'; g.gain.setValueAtTime(0.12 - i * 0.02, now + i * 0.15)
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4)
          o.start(now + i * 0.15); o.stop(now + i * 0.15 + 0.4)
        })
    } catch { }
  }

  function playSendSound() {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = ctx
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.setValueAtTime(600, now)
      o.frequency.exponentialRampToValueAtTime(900, now + 0.12)
      o.type = 'sine'; g.gain.setValueAtTime(0.08, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      o.start(now); o.stop(now + 0.15)
    } catch { }
  }

  function playReworkSound() {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = ctx
      const now = ctx.currentTime
        ;[600, 800, 600, 800].forEach((f, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain()
          o.connect(g); g.connect(ctx.destination); o.frequency.setValueAtTime(f, now + i * 0.2)
          o.type = 'square'; g.gain.setValueAtTime(0.1, now + i * 0.2)
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.15)
          o.start(now + i * 0.2); o.stop(now + i * 0.2 + 0.15)
        })
    } catch { }
  }

  function formatTime(d) {
    if (!d) return ''
    const diff = Date.now() - new Date(d)
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const ratingEmojis = ['', '😞', '😐', '🙂', '😄', '😍']
  const totalUnread = sessions.reduce((s, r) => s + (r.unread_count || 0), 0)

  function renderMessageText(text) {
    if (!text) return ''

    // [DETAIL_REQUEST] admin sent it, show a "waiting" card
    if (text.trim() === '[DETAIL_REQUEST]') {
      return (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(109,40,217,0.12)', borderRadius:10, border:'1.5px solid rgba(109,40,217,0.25)' }}>
          <ClipboardList size={18} color="#7c3aed" style={{ flexShrink:0 }} />
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:'#6d28d9' }}>Detail request sent</div>
            <div style={{ fontSize:12, color:'#8b5cf6', marginTop:2 }}>Waiting for student to fill in Website, Email & Password…</div>
          </div>
        </div>
      )
    }

    // [DETAIL_RESPONSE:::website=X|email=Y|password=Z] student replied, show credentials card
    const detailResMatch = text.match(/^\[DETAIL_RESPONSE:::(.*)\]$/)
    if (detailResMatch) {
      const pairs = {}
      detailResMatch[1].split('|').forEach(p => {
        const idx = p.indexOf('=')
        if (idx > -1) pairs[p.slice(0, idx).trim()] = p.slice(idx + 1).trim()
      })
      return <DetailResponseCard pairs={pairs} />
    }

    const fileRegex = /\[FILE:::(.*?):::(.*?)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = fileRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      parts.push(
        <FileAttachment key={`file-${match.index}`} filePath={match[1]} fileName={match[2]} />
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : text;
  }

  return (
    <AdminLayout title="Messages">
      {/* TAB BAR */}
      <div className="chat-tab-bar">
        {TABS.map(tab => {
          const Icon = tab.icon
          const count = tabCounts[tab.key] || 0
          return (
            <button key={tab.key}
              className={`chat-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.key); setActiveSession(null); setMessages([]) }}>
              <Icon size={16} />
              <span>{tab.label}</span>
              {count > 0 && <span className="chat-tab-badge">{count}</span>}
            </button>
          )
        })}
      </div>

      <div className="chat-container">
        {/* LEFT */}
        <div className="chat-sessions">
          <div className="chat-sessions-header">
            <div className="chat-sessions-title">
              <MessageSquare size={18} />
              <span>{TABS.find(t => t.key === activeTab)?.label}</span>
              {totalUnread > 0 && <span className="chat-unread-total">{totalUnread}</span>}
            </div>
            <button className="chat-sound-toggle" onClick={() => setSoundEnabled(!soundEnabled)}>
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
          {loading ? (
            <div className="chat-sessions-empty">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="chat-sessions-empty">
              <MessageSquare size={32} strokeWidth={1.5} />
              <p>No {activeTab} chats</p>
              <small>Chats will appear here</small>
            </div>
          ) : (
            <div className="chat-sessions-list">
              {sessions.map(s => (
                <button key={s.id}
                  className={`chat-session-item ${activeSession?.id === s.id ? 'active' : ''} ${s.status === 'closed' ? 'closed' : ''}`}
                  onClick={() => loadMessages(s)}>
                  <div className="chat-session-avatar" style={{ position: 'relative' }}>
                    {s.visitor_name?.[0]?.toUpperCase() || '?'}
                    {((activeSession?.id === s.id && visitorOnline) || (s.user_id && globalOnlineUsers.has(s.user_id))) && (
                      <span style={{
                        position: 'absolute', bottom: 0, right: 0, width: 10, height: 10,
                        background: '#10b981', borderRadius: '50%', border: '2px solid white'
                      }}></span>
                    )}
                  </div>
                  <div className="chat-session-info">
                    <div className="chat-session-name">
                      {s.visitor_name || 'Unknown'}
                      {s.status === 'closed' && <span className="chat-session-closed-tag">Closed</span>}
                      {s.rating > 0 && <span className="chat-session-rating">{ratingEmojis[s.rating]}</span>}
                    </div>
                    <div className="chat-session-email">
                      {s.visitor_email}
                    </div>
                    {activeTab === 'order' && s.order_id && (
                      <div className="chat-session-order-num">
                        📦 {orderNumbers[s.order_id] || `Order #${String(s.order_id).slice(0, 8)}`}
                      </div>
                    )}
                    <div className="chat-session-last">
                      {s.last_message ? (s.last_message.length > 40 ? s.last_message.slice(0, 40) + '...' : s.last_message) : 'No messages'}
                    </div>
                    {adminsBySession[s.id]?.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {adminsBySession[s.id].map(a => (
                          <span key={a.admin_id} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 10,
                            background: '#fef3c7', color: '#92400e',
                            fontSize: 11, fontWeight: 700
                          }}>
                            👁 {a.admin_name} viewing
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="chat-session-meta">
                    <span className="chat-session-time">{formatTime(s.updated_at)}</span>
                    {s.unread_count > 0 && <span className="chat-session-badge">{s.unread_count}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="chat-thread">
          {!activeSession ? (
            <div className="chat-thread-empty">
              <MessageSquare size={48} strokeWidth={1.5} />
              <h3>Select a conversation</h3>
              <p>Choose a chat from the left to view and reply</p>
            </div>
          ) : (
            <>
              <div className="chat-thread-header">
                <div className="chat-thread-user">
                  <div className="chat-thread-avatar-wrap">
                    <div className="chat-thread-avatar">{activeSession.visitor_name?.[0]?.toUpperCase() || '?'}</div>
                    <span className={`chat-presence-dot ${(visitorOnline || (activeSession.user_id && globalOnlineUsers.has(activeSession.user_id))) ? 'online' : 'offline'}`}></span>
                  </div>
                  <div>
                    <div className="chat-thread-name">
                      {activeSession.visitor_name}
                      {visitorTyping && <span className="chat-admin-typing-label">typing<span className="chat-typing-dots"><span>.</span><span>.</span><span>.</span></span></span>}
                    </div>
                    <p>
                      <Mail size={12} /> {activeSession.visitor_email}
                      {' - '}
                      <span style={{ color: (visitorOnline || (activeSession.user_id && globalOnlineUsers.has(activeSession.user_id))) ? '#10b981' : '#9ca3af' }}>
                        {(visitorOnline || (activeSession.user_id && globalOnlineUsers.has(activeSession.user_id))) ? 'Online' : 'Offline'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="chat-thread-actions">
                  {/* Ask Detail available in ALL chat types */}
                  <button
                    onClick={() => setShowDetailModal(true)}
                    className="admin-btn admin-btn-outline"
                    style={{ padding: '4px 10px', fontSize: '12px', minWidth: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: '#8B5CF6', color: '#8B5CF6' }}
                  >
                    <ClipboardList size={14} /> Ask Detail
                  </button>

                  {activeSession.chat_type === 'order' && activeSession.order_id && (
                    <>
                      <Link
                        to={`/payments?askPayment=true&orderId=${activeSession.order_id}`}
                        className="admin-btn admin-btn-outline"
                        style={{ padding: '4px 10px', fontSize: '12px', minWidth: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <DollarSign size={14} /> Ask Payment
                      </Link>
                      <span className="chat-order-badge">📦 Order #{String(activeSession.order_id).slice(0, 8)}</span>
                    </>
                  )}
                  {activeSession.rating > 0 && (
                    <span className="chat-rating-display"><Star size={14} /> {ratingEmojis[activeSession.rating]}</span>
                  )}
                  <span className={`chat-status-badge ${activeSession.status}`}>● {activeSession.status}</span>
                  {activeSession.status === 'active' && activeSession.chat_type !== 'order' && (
                    <button className="chat-close-btn" onClick={() => handleCloseSession(activeSession.id)}>
                      <X size={16} /><span>Close</span>
                    </button>
                  )}
                </div>
              </div>

              {adminsBySession[activeSession.id]?.length > 0 && (
                <div style={{
                  background: '#fffbeb', borderBottom: '1px solid #fde68a',
                  padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: '#92400e', fontWeight: 600
                }}>
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  <span>
                    Also viewing this chat: {adminsBySession[activeSession.id].map(a => a.admin_name).join(', ')} —
                    coordinate before replying to avoid double-responding.
                  </span>
                </div>
              )}

              <div className="chat-messages-area">
                <div className="chat-date-divider">
                  <span><Clock size={12} /> {new Date(activeSession.created_at).toLocaleString()}</span>
                </div>
                {messages.map(m => {
                  if (m.message.startsWith('[REWORK_REQ]') || m.message.startsWith('[REWORK_REQ_READ]')) {
                    let reworkPayload = {}
                    try {
                      const jsonStr = m.message
                        .replace('[REWORK_REQ] ', '')
                        .replace('[REWORK_REQ_READ] ', '')
                      reworkPayload = JSON.parse(jsonStr)
                    } catch (e) {}
                    const reworkDesc = reworkPayload.description || ''
                    const reworkFiles = reworkPayload.files || []
                    return (
                      <div key={m.id} className="chat-msg chat-msg-visitor">
                        <div className="chat-msg-avatar">{activeSession.visitor_name?.[0]?.toUpperCase() || '?'}</div>
                        <div className="chat-msg-content">
                          <div className="chat-msg-sender">
                            {activeSession.visitor_name}
                            <span className="chat-msg-time">{new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="chat-msg-bubble" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '13px', textAlign: 'center', marginBottom: (reworkDesc || reworkFiles.length > 0) ? '10px' : 0 }}>
                              🚨 REWORK REQUEST SUBMITTED 🚨
                            </div>
                            {reworkDesc && (
                              <div style={{ color: '#374151', fontSize: '13px', whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.6)', borderRadius: '6px', padding: '8px 10px', marginBottom: reworkFiles.length > 0 ? '8px' : 0 }}>
                                {reworkDesc}
                              </div>
                            )}
                            {reworkFiles.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {reworkFiles.map((fileTag, i) => {
                                  const match = fileTag.match(/\[FILE:::(.*?):::(.*?)\]/)
                                  if (!match) return null
                                  const [, filePath, fileName] = match
                                  return <FileAttachment key={i} filePath={filePath} fileName={fileName} />
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={m.id} className={`chat-msg ${m.sender_type === 'admin' ? 'chat-msg-admin' : 'chat-msg-visitor'}`}>
                      <div className="chat-msg-avatar">
                        {m.sender_type === 'admin'
                          ? (m.sender_name && m.sender_name !== 'Support' ? m.sender_name.slice(0,2).toUpperCase() : 'AD')
                          : (activeSession.visitor_name?.[0]?.toUpperCase() || '?')}
                      </div>
                      <div className="chat-msg-content">
                        <div className="chat-msg-sender">
                          {m.sender_type === 'admin'
                            ? (m.sender_name && m.sender_name !== 'Support'
                                ? (m.sender_name === myAdminName ? `You (${m.sender_name})` : m.sender_name)
                                : 'You')
                            : activeSession.visitor_name}
                          <span className="chat-msg-time">{new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="chat-msg-bubble" style={{ display: 'flex', flexDirection: 'column', gap: '4px', whiteSpace: 'pre-wrap' }}>
                          {renderMessageText(m.message)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {visitorTyping && (
                  <div className="chat-msg chat-msg-visitor">
                    <div className="chat-msg-avatar">{activeSession.visitor_name?.[0]?.toUpperCase() || '?'}</div>
                    <div className="chat-msg-content">
                      <div className="chat-msg-bubble chat-typing-bubble-admin">
                        <span className="chat-typing-indicator"><span></span><span></span><span></span></span>
                      </div>
                    </div>
                  </div>
                )}
                {activeSession.status === 'closed' && activeSession.feedback_text && (
                  <div className="chat-feedback-note"><Star size={14} /> "{activeSession.feedback_text}"</div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {activeSession.status === 'active' && activeSession.chat_type === 'order' && !sessionManager ? (
                <div style={{ background: '#fffbeb', borderTop: '1px solid #fde68a', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>Assign a manager before replying</div>
                      <div style={{ fontSize: 12, color: '#a16207', marginTop: 2 }}>
                        Every customer must have an assigned manager. The manager's name appears in the customer's chat heading.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={inlineManagerId}
                      onChange={(e) => setInlineManagerId(e.target.value)}
                      disabled={assigningManager}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #fde68a', fontSize: 14, fontWeight: 600, background: 'white', color: '#0f172a', cursor: assigningManager ? 'wait' : 'pointer' }}
                    >
                      <option value="">Choose a manager —</option>
                      {allManagers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.internal_name ? `${m.name} (${m.internal_name})` : m.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleInlineAssignManager(inlineManagerId)}
                      disabled={!inlineManagerId || assigningManager}
                      style={{ padding: '10px 18px', borderRadius: 8, background: !inlineManagerId || assigningManager ? '#e5e7eb' : 'var(--green)', color: !inlineManagerId || assigningManager ? '#94a3b8' : 'white', border: 'none', fontWeight: 700, fontSize: 14, cursor: !inlineManagerId || assigningManager ? 'not-allowed' : 'pointer' }}
                    >
                      {assigningManager ? 'Saving…' : 'Assign'}
                    </button>
                  </div>
                </div>
              ) : activeSession.status === 'active' ? (
                <>
                  {activeSession.chat_type === 'order' && sessionManager && (
                    <div style={{
                      padding: '6px 16px', background: '#f0fdf4', borderTop: '1px solid #dcfce7',
                      fontSize: '12px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                      <span style={{
                        display: 'inline-grid', placeItems: 'center',
                        width: '18px', height: '18px', borderRadius: '50%',
                        background: '#16a34a', color: 'white', fontSize: '10px', fontWeight: 700
                      }}>👤</span>
                      <span>
                        Manager: <strong>{sessionManager.name}</strong>
                        {sessionManager.internal_name && (
                          <span style={{ color: '#64748b', fontWeight: 500, marginLeft: 4 }}>
                            ({sessionManager.internal_name})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
                  {selectedFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '8px',
                          background: '#f1f5f9', padding: '6px 12px', borderRadius: '12px',
                          fontSize: '12px', fontWeight: 600, color: '#334155'
                        }}>
                          <span>📎 {file.name}</span>
                          <button type="button" onClick={() => removeFile(idx)} disabled={uploading} style={{
                            background: 'none', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', color: '#94a3b8',
                            display: 'flex', alignItems: 'center', padding: '0 4px'
                          }} title="Remove file">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <form className="chat-reply-bar" onSubmit={handleSendReply} style={{ padding: 0, borderTop: 'none', display: 'flex', alignItems: 'center' }}>
                    <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ marginRight: '8px', width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '50%', border: 'none', color: '#64748b', display: 'grid', placeItems: 'center', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.5 : 1 }}>
                      <Paperclip size={18} />
                    </button>
                    <input type="text" className="chat-reply-input" placeholder={uploading ? `Uploading ${selectedFiles.length} file(s)...` : "Type your reply..."}
                      value={replyText} disabled={uploading} onChange={(e) => { setReplyText(e.target.value); sendTypingEvent() }} autoFocus style={{ flex: 1 }} />
                    <button type="submit" className="chat-reply-send" disabled={(!replyText.trim() && selectedFiles.length === 0) || sending || uploading}><Send size={18} /></button>
                  </form>
                </div>
                </>
              ) : (
                <div className="chat-closed-bar">This chat has been closed.</div>
              )}
            </>
          )}
        </div>
      </div>
      {/* ── Ask Detail Modal ─────────────────────────────────── */}
      {showDetailModal && (
        <div onClick={() => setShowDetailModal(false)} style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(15,23,42,0.65)', backdropFilter:'blur(6px)',
          display:'flex', alignItems:'center', justifyContent:'center',
          animation:'adFadeIn .18s ease',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'#fff', borderRadius:20, width:'100%', maxWidth:420,
            boxShadow:'0 24px 60px rgba(0,0,0,0.28)', overflow:'hidden',
            animation:'adSlideUp .2s ease',
          }}>
            {/* Header */}
            <div style={{ background:'linear-gradient(135deg,#4c1d95,#6d28d9)', padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📋</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#fff' }}>Request Account Details</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>Student will see a form to fill in</div>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:8, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                <X size={16} />
              </button>
            </div>

            {/* Preview */}
            <div style={{ padding:'20px 24px 8px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Student will be asked to provide:</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { icon:'🌐', label:'Portal Link', placeholder:'https://example.com' },
                  { icon:'📧', label:'Email Address / User Name', placeholder:'user@example.com' },
                  { icon:'🔒', label:'Password',      placeholder:'••••••••' },
                ].map((f, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, background:'#f8fafc', border:'1.5px solid #e2e8f0' }}>
                    <span style={{ fontSize:18 }}>{f.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', marginBottom:1 }}>{f.label}</div>
                      <div style={{ fontSize:13, color:'#cbd5e1' }}>{f.placeholder}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12, color:'#94a3b8', margin:'14px 0 4px', textAlign:'center' }}>
                The student fills this form in chat and submits. You'll receive the details instantly.
              </p>
            </div>

            {/* Actions */}
            <div style={{ padding:'12px 24px 22px', display:'flex', gap:10 }}>
              <button onClick={() => setShowDetailModal(false)} style={{ flex:1, padding:'11px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'#f8fafc', color:'#64748b', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSendDetailRequest} disabled={sendingDetailReq} style={{
                flex:2, padding:'11px', borderRadius:10, border:'none',
                background: sendingDetailReq ? '#c4b5fd' : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                color:'#fff', fontWeight:700, fontSize:14, cursor: sendingDetailReq ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow:'0 4px 14px rgba(109,40,217,0.35)',
              }}>
                {sendingDetailReq ? 'Sending…' : <><ClipboardList size={15}/> Send Request</>}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes adFadeIn  { from{opacity:0} to{opacity:1} }
            @keyframes adSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
          `}</style>
        </div>
      )}
    </AdminLayout>
  )
}

function DetailResponseCard({ pairs }) {
  const [copied, setCopied] = useState(null)
  const fields = [
    { key:'website',  icon:'🌐', label:'Portal Link' },
    { key:'email',    icon:'📧', label:'Email / Username' },
    { key:'password', icon:'🔒', label:'Password' },
  ]
  function copyVal(key, val) {
    navigator.clipboard.writeText(val)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }
  return (
    <div style={{ minWidth:220 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <div style={{ width:28, height:28, borderRadius:8, background:'rgba(22,163,74,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>📋</div>
        <div style={{ fontWeight:700, fontSize:13, color:'#15803d' }}>Account Details Received</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {fields.map(f => {
          const val = pairs[f.key] || '—'
          const isCopied = copied === f.key
          return (
            <div key={f.key} style={{ background:'rgba(255,255,255,0.5)', borderRadius:8, padding:'8px 10px', border:'1px solid rgba(255,255,255,0.6)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(21,128,61,0.7)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>
                {f.icon} {f.label}
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#0f172a', wordBreak:'break-all', flex:1 }}>{val}</span>
                {val !== '—' && (
                  <button onClick={() => copyVal(f.key, val)} style={{
                    background: isCopied ? 'rgba(22,163,74,0.15)' : 'rgba(0,0,0,0.06)',
                    border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer',
                    fontSize:11, fontWeight:700, color: isCopied ? '#15803d' : '#64748b',
                    display:'flex', alignItems:'center', gap:4, flexShrink:0, transition:'all .15s'
                  }}>
                    {isCopied ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy</>}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FileAttachment({ filePath, fileName }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload(e) {
    e.stopPropagation()
    setLoading(true)
    const { data, error } = await supabase.storage.from('order-files').createSignedUrl(filePath, 3600)
    setLoading(false)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    } else {
      alert('File has expired or is unavailable.')
    }
  }

  return (
    <div
      onClick={handleDownload}
      style={{
        marginTop: 4, padding: '8px 12px', background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        fontSize: '13px', fontWeight: 600, color: 'inherit'
      }}
      title="Click to download"
    >
      <span style={{ opacity: 0.7 }}>📎</span>
      <span style={{ textDecoration: 'underline', textUnderlineOffset: 2, wordBreak: 'break-all' }}>
        {loading ? 'Generating link...' : fileName}
      </span>
    </div>
  )
}