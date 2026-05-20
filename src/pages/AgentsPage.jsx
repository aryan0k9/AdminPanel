// ============================================================
// AGENTS PAGE (easyadmin)
// Admin can create, view, and deactivate support agents.
// Agent accounts are created via the create-agent Edge Function.
// ============================================================

import { useEffect, useState } from 'react'
import { Users, Plus, X, Check, AlertCircle, ToggleLeft, ToggleRight, Mail, User } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'

const SITES = [
  { id: 1, name: 'Easy Assignments' },
  { id: 2, name: 'Rapid Researchers' },
  { id: 3, name: 'Deadline Helper' },
  { id: 4, name: 'Do Assignment Now' },
]

export default function AgentsPage() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedSiteIds, setSelectedSiteIds] = useState([1])

  useEffect(() => { loadAgents() }, [])

  async function loadAgents() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, site_ids, created_at')
      .eq('role', 'agent')
      .order('created_at', { ascending: false })
    setAgents(data || [])
    setLoading(false)
  }

  function toggleSite(siteId) {
    setSelectedSiteIds(prev =>
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    )
  }

  async function handleCreateAgent(e) {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setFormError('All fields are required.')
      return
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    if (selectedSiteIds.length === 0) {
      setFormError('Select at least one site for this agent.')
      return
    }

    setSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/swift-api`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
            site_ids: selectedSiteIds,
          }),
        }
      )

      const json = await res.json()

      if (!res.ok || json.error) {
        setFormError(json.error || 'Failed to create agent. Please try again.')
        setSubmitting(false)
        return
      }

      setFormSuccess(`Agent "${fullName}" created successfully.`)
      setFullName(''); setEmail(''); setPassword(''); setSelectedSiteIds([1])
      loadAgents()
      setTimeout(() => { setShowForm(false); setFormSuccess('') }, 2000)
    } catch (err) {
      setFormError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(agent, currentlyActive) {
    const action = currentlyActive ? 'deactivate' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} ${agent.full_name}?`)) return

    // Toggle by flipping a local "is_active" flag.
    // We store this in user_metadata via the profiles table.
    // For now we just mark it in the profile the ProtectedRoute in agentpanel
    // checks role='agent', so to fully block, you'd delete the profile or
    // set role='agent_inactive'. Here we update site_ids to [] to block access.
    const newSiteIds = currentlyActive ? [] : (agent.site_ids?.length > 0 ? agent.site_ids : [1])
    await supabase.from('profiles').update({ site_ids: newSiteIds }).eq('id', agent.id)
    loadAgents()
  }

  function isActive(agent) {
    return Array.isArray(agent.site_ids) && agent.site_ids.length > 0
  }

  function getSiteNames(siteIds) {
    if (!siteIds || siteIds.length === 0) return 'No sites (inactive)'
    return siteIds.map(id => SITES.find(s => s.id === id)?.name || `Site ${id}`).join(', ')
  }

  return (
    <AdminLayout title="Support Agents">
      <div style={{ padding: '24px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
              Support Agents
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Agents log in to Agent Panel to manage client chats.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setFormError(''); setFormSuccess('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 16px', background: 'var(--green)', color: 'white',
              borderRadius: 'var(--radius-sm)', fontSize: '13.5px', fontWeight: 600,
              transition: 'opacity 0.15s',
            }}
          >
            <Plus size={16} /> New Agent
          </button>
        </div>

        {/* Create agent form */}
        {showForm && (
          <div style={{
            background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            padding: '24px', marginBottom: '24px', position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Create New Agent</h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#dc2626', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                fontSize: '13px', marginBottom: '16px',
              }}>
                <AlertCircle size={15} /> {formError}
              </div>
            )}

            {formSuccess && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
                color: '#059669', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                fontSize: '13px', marginBottom: '16px',
              }}>
                <Check size={15} /> {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateAgent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Full Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Smith"
                      style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13.5px', outline: 'none' }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="agent@example.com"
                      style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13.5px', outline: 'none' }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13.5px', outline: 'none' }}
                  required
                />
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Share this password with the agent. They can change it later.
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Assign to Sites
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {SITES.map(site => (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => toggleSite(site.id)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: '1.5px solid',
                        borderColor: selectedSiteIds.includes(site.id) ? 'var(--green)' : 'var(--border)',
                        background: selectedSiteIds.includes(site.id) ? 'rgba(22,163,74,0.08)' : 'white',
                        color: selectedSiteIds.includes(site.id) ? 'var(--green)' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                        cursor: 'pointer',
                      }}
                    >
                      {selectedSiteIds.includes(site.id) && <Check size={12} style={{ display: 'inline', marginRight: 4 }} />}
                      {site.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '9px 20px', borderRadius: 'var(--radius-sm)', background: 'var(--green)',
                    color: 'white', fontSize: '13.5px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '7px',
                    opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Creating...' : <><Plus size={15} /> Create Agent</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Agents table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading agents...</div>
        ) : agents.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 40px',
            background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          }}>
            <Users size={40} strokeWidth={1.5} style={{ color: 'var(--text-light)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)' }}>No agents yet</p>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '6px' }}>
              Create your first support agent to start delegating chats.
            </p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Agent', 'Email', 'Assigned Sites', 'Created', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, idx) => {
                  const active = isActive(agent)
                  return (
                    <tr key={agent.id} style={{ borderBottom: idx < agents.length - 1 ? '1px solid var(--border)' : 'none', opacity: active ? 1 : 0.55 }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                            {agent.full_name?.slice(0, 2).toUpperCase() || 'AG'}
                          </div>
                          <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{agent.full_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {agent.email}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12.5px', color: active ? 'var(--text)' : 'var(--text-muted)' }}>
                        {getSiteNames(agent.site_ids)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '10px', fontSize: '11.5px', fontWeight: 600,
                          background: active ? 'rgba(22,163,74,0.1)' : 'var(--surface)',
                          color: active ? 'var(--green)' : 'var(--text-muted)',
                        }}>
                          {active ? '● Active' : '● Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => handleToggleActive(agent, active)}
                          title={active ? 'Deactivate agent' : 'Reactivate agent'}
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '12.5px', fontWeight: 600, color: active ? '#dc2626' : 'var(--green)', background: 'white', cursor: 'pointer', transition: 'all 0.12s' }}
                        >
                          {active ? <><ToggleRight size={15} /> Deactivate</> : <><ToggleLeft size={15} /> Reactivate</>}
                        </button>
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
