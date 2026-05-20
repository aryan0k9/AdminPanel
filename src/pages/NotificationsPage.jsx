import { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/stats'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadNotifications() {
      setLoading(true)

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        alert(error.message)
        setNotifications([])
      } else {
        setNotifications(data || [])
      }

      setLoading(false)
    }

    loadNotifications()
  }, [])

  return (
    <AdminLayout title="Notifications">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title">Notifications</h3>
          <span>{notifications.length} total</span>
        </div>

        {loading ? (
          <div className="admin-empty">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="admin-empty">No notifications found</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Title</th>
                  <th>Message</th>
                  <th>Read</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map(item => (
                  <tr key={item.id}>
                    <td>{item.user_id || '-'}</td>
                    <td>{item.title || '-'}</td>
                    <td>{item.message || '-'}</td>
                    <td>{item.read ? 'Yes' : 'No'}</td>
                    <td>{formatDateTime(item.created_at)}</td>
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