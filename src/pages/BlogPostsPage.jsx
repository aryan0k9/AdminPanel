import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import RichTextEditor from '../components/RichTextEditor'
import { supabase } from '../lib/supabase'

const BLOG_CATEGORIES = [
  'Study Tips', 'Writing Guides', 'Programming', 
  'Career & Future', 'Student Life', 'Subject Help'
]

export default function BlogPostsPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingPost, setEditingPost] = useState(null) // null = list view, {} = new post, {...} = editing
  
  // Form State
  const [formData, setFormData] = useState({
    title: '', slug: '', excerpt: '', content: '', cover_image: '', 
    category: BLOG_CATEGORIES[0], tags: '', author: 'Admin', author_avatar: 'A', status: 'draft', featured: false
  })

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) console.error('Error fetching posts:', error)
    else setPosts(data || [])
    setLoading(false)
  }

  const handleCreateNew = () => {
    setFormData({
      title: '', slug: '', excerpt: '', content: '', cover_image: '', 
      category: BLOG_CATEGORIES[0], tags: '', author: 'Admin', author_avatar: 'A', status: 'draft', featured: false
    })
    setEditingPost({})
  }

  const handleEdit = (post) => {
    setFormData({
      ...post,
      tags: post.tags ? post.tags.join(', ') : ''
    })
    setEditingPost(post)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this post permanently?')) return
    
    const { error } = await supabase.from('blog_posts').delete().eq('id', id)
    if (error) alert('Error deleting post: ' + error.message)
    else fetchPosts()
  }

  const handleSave = async (e) => {
    e.preventDefault()
    
    const postData = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      slug: formData.slug || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      published_at: formData.status === 'published' && (!editingPost.id || formData.status !== editingPost.status) 
        ? new Date().toISOString() 
        : editingPost.published_at
    }

    let error;
    if (editingPost.id) {
      // Update
      const res = await supabase.from('blog_posts').update(postData).eq('id', editingPost.id)
      error = res.error
    } else {
      // Insert
      const res = await supabase.from('blog_posts').insert([postData])
      error = res.error
    }

    if (error) {
      alert('Error saving post: ' + error.message)
    } else {
      setEditingPost(null)
      fetchPosts()
    }
  }

  // --- RENDERING ---

  if (editingPost !== null) {
    return (
      <AdminLayout title={editingPost.id ? 'Edit Post' : 'New Post'}>
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">{editingPost.id ? 'Edit Post' : 'Create New Post'}</h3>
            <button className="btn btn-outline" onClick={() => setEditingPost(null)}>Cancel</button>
          </div>
          
          <form className="admin-form" onSubmit={handleSave} style={{ padding: '24px' }}>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
              
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                  <label>Title</label>
                  <input type="text" className="input" required
                    value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} 
                  />
                </div>
                
                <div className="form-group">
                  <label>Excerpt (Short summary)</label>
                  <textarea className="input" rows="3" required
                    value={formData.excerpt} onChange={e => setFormData({...formData, excerpt: e.target.value})}
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label>Content</label>
                  <RichTextEditor 
                    value={formData.content} 
                    onChange={val => setFormData({...formData, content: val})} 
                  />
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                  <label>Status</label>
                  <select className="input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select className="input" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Cover Image URL</label>
                  <input type="text" className="input" 
                    value={formData.cover_image} onChange={e => setFormData({...formData, cover_image: e.target.value})} 
                  />
                  {formData.cover_image && (
                    <img src={formData.cover_image} alt="Preview" style={{ marginTop: 8, width: '100%', borderRadius: 8, maxHeight: 120, objectFit: 'cover' }} />
                  )}
                </div>

                <div className="form-group">
                  <label>Tags (comma separated)</label>
                  <input type="text" className="input" placeholder="essay, tips, grammar"
                    value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} 
                  />
                </div>

                <div className="form-group">
                  <label>Author Name</label>
                  <input type="text" className="input" required
                    value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} 
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="checkbox" id="featured" 
                    checked={formData.featured} onChange={e => setFormData({...formData, featured: e.target.checked})} 
                  />
                  <label htmlFor="featured" style={{ margin: 0 }}>Featured Post</label>
                </div>
              </div>

            </div>

            <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setEditingPost(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Post</button>
            </div>
          </form>
        </div>
      </AdminLayout>
    )
  }

  // --- LIST VIEW ---
  return (
    <AdminLayout title="Blog Posts">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title">All Posts</h3>
          <button className="btn btn-primary btn-sm" onClick={handleCreateNew}>+ New Post</button>
        </div>
        
        {loading ? (
          <div className="admin-empty">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="admin-empty">
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>📝</div>
            No blog posts yet.<br />Click "+ New Post" to write your first article.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--primary)' }}>{post.title}</div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>/{post.slug}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${post.status === 'published' ? 'status-completed' : 'status-pending'}`}>
                        {post.status}
                      </span>
                      {post.featured && <span className="status-badge" style={{ marginLeft: 8, background: '#fef3c7', color: '#92400e' }}>Featured</span>}
                    </td>
                    <td>{post.category}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '14px' }}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => handleEdit(post)}>Edit</button>
                        <button className="btn btn-outline btn-sm" style={{ color: '#ef4444', borderColor: '#fee2e2' }} onClick={() => handleDelete(post.id)}>Delete</button>
                      </div>
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