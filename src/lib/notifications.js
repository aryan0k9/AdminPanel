import { supabase } from './supabase'

export async function createNotification(userId, type, title, message) {
  if (!userId) return { success: false, error: 'No user ID provided' }
  
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type: type, // 'order', 'payment', 'message', 'general'
      title: title,
      message: message,
      read: false
    })
    
    if (error) throw error
    return { success: true }
  } catch (err) {
    console.error('Error creating notification:', err)
    return { success: false, error: err.message }
  }
}
