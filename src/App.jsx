// ============================================================
// APP - Routes for the admin panel
// ============================================================

import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import SiteSelector from './pages/SiteSelector'
import Dashboard from './pages/Dashboard'

import Orders from './pages/Orders'
import OrderDetailPage from './pages/OrderDetailPage'
import UserDetailPage from './pages/UserDetailPage'
import ReworksPage from './pages/ReworksPage'
import UsersPage from './pages/UsersPage'
import ExpertsPage from './pages/ExpertsPage'
import PaymentsPage from './pages/PaymentsPage'
import MessagesPage from './pages/MessagesPage'
import NotificationsPage from './pages/NotificationsPage'
import BlogPostsPage from './pages/BlogPostsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import FeedbackPage from './pages/FeedbackPage'
import CouponsPage from './pages/CouponsPage'
import WalletPage from './pages/WalletPage'
import AgentsPage from './pages/AgentsPage'
import ManagersPage from './pages/ManagersPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />

      <Route
        path="/sites"
        element={
          <ProtectedRoute>
            <SiteSelector />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/:orderId"
        element={
          <ProtectedRoute>
            <OrderDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reworks"
        element={
          <ProtectedRoute>
            <ReworksPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users/:userId"
        element={
          <ProtectedRoute>
            <UserDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/experts"
        element={
          <ProtectedRoute>
            <ExpertsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payments"
        element={
          <ProtectedRoute>
            <PaymentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/blog"
        element={
          <ProtectedRoute>
            <BlogPostsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/feedback"
        element={
          <ProtectedRoute>
            <FeedbackPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/coupons"
        element={
          <ProtectedRoute>
            <CouponsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/agents"
        element={
          <ProtectedRoute>
            <AgentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/managers"
        element={
          <ProtectedRoute>
            <ManagersPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/sites" replace />} />
    </Routes>
  )
}

export default App