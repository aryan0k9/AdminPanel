import AdminLayout from '../components/AdminLayout'
import { useSite } from '../contexts/SiteContext'

export default function SettingsPage() {
  const { selectedSite } = useSite()

  return (
    <AdminLayout title="Settings">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title">Settings</h3>
        </div>

        <div className="admin-form-section">
          <p><strong>Current Site:</strong> {selectedSite?.name || 'No site selected'}</p>
          <p><strong>Domain:</strong> {selectedSite?.domain || '-'}</p>
          <p><strong>Site ID:</strong> {selectedSite?.id || '-'}</p>
        </div>
      </div>
    </AdminLayout>
  )
}