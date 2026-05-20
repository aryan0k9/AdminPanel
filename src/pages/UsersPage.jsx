import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { useSite } from '../contexts/SiteContext'
import { formatDateTime } from '../lib/stats'

export default function UsersPage() {
  const { selectedSite, isAllSites } = useSite()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUsers() {
      setLoading(true)

      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (selectedSite && !isAllSites) {
        query = query.eq('site_id', selectedSite.id)
      }

      const { data, error } = await query

      if (error) {
        alert(error.message)
        setUsers([])
      } else {
        setUsers(data || [])
      }

      setLoading(false)
    }

    loadUsers()
  }, [selectedSite, isAllSites])

  async function toggleBan(user) {
    const { error } = await supabase
      .from('profiles')
      .update({ banned: !user.banned })
      .eq('id', user.id)

    if (error) {
      alert(error.message)
      return
    }

    setUsers(prev =>
      prev.map(u => u.id === user.id ? { ...u, banned: !u.banned } : u)
    )
  }

  return (
    <AdminLayout title="Users">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title">Users</h3>
          <span>{users.length} total</span>
        </div>

        {loading ? (
          <div className="admin-empty">Loading users...</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Wallet</th>
                  <th>Banned</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr
                    key={user.id}
                    onClick={() => navigate(`/users/${user.id}`)}
                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td>{user.full_name || '-'}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>${Number(user.wallet_balance || 0).toFixed(2)}</td>
                    <td>{user.banned ? 'Yes' : 'No'}</td>
                    <td>{formatDateTime(user.created_at)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        className="admin-small-btn"
                        onClick={() => toggleBan(user)}
                      >
                        {user.banned ? 'Unban' : 'Ban'}
                      </button>
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