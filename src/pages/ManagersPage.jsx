// ============================================================
// MANAGERS PAGE (easyadmin)
// Read-only list of the 15 seeded managers + how many users each
// of them is currently assigned to. Assignment itself happens on
// the Order Detail page (Actions → Assign Manager).
// ============================================================

import { useEffect, useState } from 'react'
import { UserCheck, Pencil, Check, X } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'

export default function ManagersPage() {
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: managerRows } = await supabase
      .from('managers')
      .select('id, name, internal_name, created_at')
      .order('name', { ascending: true })

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('manager_id')
      .not('manager_id', 'is', null)

    const counts = {}
    for (const p of profileRows || []) {
      counts[p.manager_id] = (counts[p.manager_id] || 0) + 1
    }

    setManagers((managerRows || []).map(m => ({ ...m, assignedCount: counts[m.id] || 0 })))
    setLoading(false)
  }

  function startEdit(m) {
    setEditingId(m.id)
    setEditValue(m.internal_name || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  async function saveEdit(id) {
    setSaving(true)
    const trimmed = editValue.trim()
    const { error } = await supabase
      .from('managers')
      .update({ internal_name: trimmed || null })
      .eq('id', id)
    setSaving(false)
    if (error) {
      alert(`Could not save internal name: ${error.message}`)
      return
    }
    setEditingId(null)
    setEditValue('')
    load()
  }

  function getInitials(name) {
    const parts = (name || '').trim().split(' ')
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'M'
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <AdminLayout title="Managers">
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
            Managers
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Each customer is assigned one manager. The manager's name appears in that customer's chat heading on every order.
            Assign a manager from the Order Detail page.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading managers…</div>
        ) : managers.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 40px',
            background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          }}>
            <UserCheck size={40} strokeWidth={1.5} style={{ color: 'var(--text-light)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)' }}>No managers found</p>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '6px' }}>
              Run the managers_migration.sql to seed the default 15 managers.
            </p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Manager', 'Assigned Customers', 'Added', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {managers.map((m, idx) => {
                  const isEditing = editingId === m.id
                  return (
                  <tr key={m.id} style={{ borderBottom: idx < managers.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                          {getInitials(m.name)}
                        </div>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{m.name}</span>
                            <span style={{ fontSize: '13.5px', color: '#94a3b8' }}>(</span>
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(m.id)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              autoFocus
                              placeholder="Internal name"
                              style={{ padding: '4px 8px', border: '1.5px solid var(--green)', borderRadius: 6, fontSize: '13px', fontWeight: 600, outline: 'none', minWidth: 140 }}
                            />
                            <span style={{ fontSize: '13.5px', color: '#94a3b8' }}>)</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '13.5px', fontWeight: 600 }}>
                            {m.name}
                            {m.internal_name && (
                              <span style={{ color: '#94a3b8', fontWeight: 500, marginLeft: 6 }}>({m.internal_name})</span>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                        background: m.assignedCount > 0 ? 'rgba(22,163,74,0.1)' : 'var(--surface)',
                        color: m.assignedCount > 0 ? 'var(--green)' : 'var(--text-muted)',
                      }}>
                        {m.assignedCount} {m.assignedCount === 1 ? 'customer' : 'customers'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => saveEdit(m.id)}
                            disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, background: 'var(--green)', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}
                            title="Save"
                          >
                            <Check size={13} /> Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, background: 'white', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            title="Cancel"
                          >
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(m)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'white', cursor: 'pointer' }}
                          title="Edit internal name (admin only)"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                      )}
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
