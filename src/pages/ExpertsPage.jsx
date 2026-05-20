import { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'

export default function ExpertsPage() {
  const [experts, setExperts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadExperts() {
      setLoading(true)

      const { data, error } = await supabase
        .from('experts')
        .select('*')
        .order('rating', { ascending: false })

      if (error) {
        alert(error.message)
        setExperts([])
      } else {
        setExperts(data || [])
      }

      setLoading(false)
    }

    loadExperts()
  }, [])

  return (
    <AdminLayout title="Experts">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title">Experts</h3>
          <span>{experts.length} total</span>
        </div>

        {loading ? (
          <div className="admin-empty">Loading experts...</div>
        ) : experts.length === 0 ? (
          <div className="admin-empty">No experts added yet</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subjects</th>
                  <th>Hourly Rate</th>
                  <th>Rating</th>
                  <th>Total Orders</th>
                  <th>Total Earnings</th>
                </tr>
              </thead>
              <tbody>
                {experts.map(expert => (
                  <tr key={expert.id}>
                    <td>{expert.id}</td>
                    <td>{Array.isArray(expert.subjects) ? expert.subjects.join(', ') : expert.subjects || '-'}</td>
                    <td>${Number(expert.hourly_rate || 0).toFixed(2)}</td>
                    <td>{expert.rating || 0}</td>
                    <td>{expert.total_orders || 0}</td>
                    <td>${Number(expert.total_earnings || 0).toFixed(2)}</td>
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