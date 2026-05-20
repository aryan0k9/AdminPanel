import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

const MenuBar = ({ editor }) => {
  if (!editor) return null

  const btn = (action, label, isActive = false) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); action() }}
      className={`rte-btn ${isActive ? 'active' : ''}`}
      title={label}
    >
      {label}
    </button>
  )

  const addImage = () => {
    const url = window.prompt('Image URL:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const addLink = () => {
    const url = window.prompt('URL:')
    if (url) editor.chain().focus().setLink({ href: url }).run()
  }

  return (
    <div className="rte-toolbar">
      <div className="rte-group">
        {btn(() => editor.chain().focus().toggleBold().run(), 'B', editor.isActive('bold'))}
        {btn(() => editor.chain().focus().toggleItalic().run(), 'I', editor.isActive('italic'))}
        {btn(() => editor.chain().focus().toggleUnderline().run(), 'U', editor.isActive('underline'))}
        {btn(() => editor.chain().focus().toggleStrike().run(), 'S̶', editor.isActive('strike'))}
        {btn(() => editor.chain().focus().toggleHighlight().run(), 'H', editor.isActive('highlight'))}
      </div>
      <div className="rte-group">
        {btn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1', editor.isActive('heading', { level: 1 }))}
        {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2', editor.isActive('heading', { level: 2 }))}
        {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3', editor.isActive('heading', { level: 3 }))}
      </div>
      <div className="rte-group">
        {btn(() => editor.chain().focus().setTextAlign('left').run(), '⬅', editor.isActive({ textAlign: 'left' }))}
        {btn(() => editor.chain().focus().setTextAlign('center').run(), '↔', editor.isActive({ textAlign: 'center' }))}
        {btn(() => editor.chain().focus().setTextAlign('right').run(), '➡', editor.isActive({ textAlign: 'right' }))}
      </div>
      <div className="rte-group">
        {btn(() => editor.chain().focus().toggleBulletList().run(), '• List', editor.isActive('bulletList'))}
        {btn(() => editor.chain().focus().toggleOrderedList().run(), '1. List', editor.isActive('orderedList'))}
        {btn(() => editor.chain().focus().toggleBlockquote().run(), '" Quote', editor.isActive('blockquote'))}
        {btn(() => editor.chain().focus().toggleCode().run(), '</>', editor.isActive('code'))}
        {btn(() => editor.chain().focus().toggleCodeBlock().run(), 'Code Block', editor.isActive('codeBlock'))}
      </div>
      <div className="rte-group">
        {btn(addLink, '🔗 Link', editor.isActive('link'))}
        {btn(addImage, '🖼 Image')}
        {btn(() => editor.chain().focus().setHorizontalRule().run(), 'HR')}
      </div>
      <div className="rte-group">
        {btn(() => editor.chain().focus().undo().run(), '↩ Undo')}
        {btn(() => editor.chain().focus().redo().run(), '↪ Redo')}
      </div>
    </div>
  )
}

export default function RichTextEditor({ value, onChange, placeholder = 'Start writing your post...' }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync external value changes (e.g. when editing an existing post)
  useEffect(() => {
    if (editor && value !== undefined && editor.getHTML() !== value) {
      editor.commands.setContent(value || '')
    }
  }, [value]) // eslint-disable-line

  return (
    <div className="rte-wrap">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="rte-content" />
    </div>
  )
}
