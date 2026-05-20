// ============================================================
// AUTH FUNCTIONS (Admin Panel)
// ============================================================

import { supabase } from './supabase'

// ============================================================
// SIGN IN
// Only signs in. Admin role check is handled by AuthContext.
// ============================================================
export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data.user) {
      return { success: false, error: 'Login failed. Please try again.' }
    }

    return {
      success: true,
      user: data.user
    }
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Login failed'
    }
  }
}

// ============================================================
// SIGN OUT
// ============================================================
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}