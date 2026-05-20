// ============================================================
// ADMIN LOGIN PAGE
// Dark-themed login with role check
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react'
import { signIn } from '../lib/auth'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { isAuthenticated, isAdmin, loading: authLoading, profile } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    console.log('Login auth state:', {
      authLoading,
      isAuthenticated,
      isAdmin,
      profile
    })

    if (!authLoading && isAuthenticated && isAdmin) {
      setLoading(false)
      navigate('/sites', { replace: true })
    }

    if (!authLoading && isAuthenticated && !isAdmin && profile) {
      setLoading(false)
      setError('⛔ Access denied. This panel is for authorized personnel only.')
    }
  }, [authLoading, isAuthenticated, isAdmin, profile, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please enter email and password')
      return
    }

    setLoading(true)

    try {
      const result = await signIn(email, password)

      if (!result.success) {
        setError(result.error)
        setLoading(false)
        return
      }

      // Do not navigate here.
      // AuthContext will load profile, check role, then redirect.
    } catch (err) {
      console.error('Login error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-bg">
        <div className="admin-login-glow"></div>
      </div>

      <div className="admin-login-container">
        <div className="admin-login-header">
          <div className="admin-login-shield">
            <Shield size={28} strokeWidth={2.5} />
          </div>
          <h1 className="admin-login-title">Control Center</h1>
          <p className="admin-login-subtitle">Authorized personnel only</p>
        </div>

        <div className="admin-login-card">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="admin-login-error">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="admin-login-field">
              <label className="admin-login-label">Email Address</label>
              <div className="admin-login-input-wrap">
                <Mail size={16} className="admin-login-input-icon" />
                <input
                  type="email"
                  className="admin-login-input"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="admin-login-field">
              <label className="admin-login-label">Password</label>
              <div className="admin-login-input-wrap">
                <Lock size={16} className="admin-login-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="admin-login-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="admin-login-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="admin-login-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="admin-spinner"></span>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Login to Control Center</span>
                </>
              )}
            </button>
          </form>

          <div className="admin-login-notice">
            <Shield size={12} />
            <span>Secured access. All activity is logged.</span>
          </div>
        </div>

        <p className="admin-login-footer">
          Not authorized? Visit our{' '}
          <a href="https://easyassignments.com" target="_blank" rel="noopener noreferrer">
            customer site
          </a>
        </p>
      </div>
    </div>
  )
}