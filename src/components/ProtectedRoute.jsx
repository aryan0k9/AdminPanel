// ============================================================
// PROTECTED ROUTE
// Wraps pages that require admin login
// Redirects to /login if not admin
// ============================================================

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requireSite = false }) {
  const navigate = useNavigate()
  const { isAuthenticated, isAdmin, loading, user } = useAuth()

  useEffect(() => {
    if (loading) return

    // Not logged in → redirect to login
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    // Logged in but not admin → logout and redirect
    if (user && !isAdmin) {
      navigate('/login')
      return
    }
  }, [loading, isAuthenticated, isAdmin, user, navigate])

  // Show loading spinner while checking
  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>Verifying access...</p>
      </div>
    )
  }

  // Don't render if not authenticated/admin
  if (!isAuthenticated || !isAdmin) {
    return null
  }

  return children
}
