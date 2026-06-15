'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Icon, type IconName } from '@/components/Icon'
import styles from './page.module.css'

interface SourceMaterial {
  id: string
  fileName: string
  fileType: string
  fileSizeBytes: number | null
  status: string
  createdAt: string
}

export default function UploadPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [materials, setMaterials] = useState<SourceMaterial[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState<Record<string, { progress: number; error?: string }>>({})
  const [showPasteMode, setShowPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteTitle, setPasteTitle] = useState('')
  const [isSubmittingText, setIsSubmittingText] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/upload`)
      if (res.ok) {
        const data = await res.json()
        setMaterials(data.sourceMaterials ?? [])
      }
    } catch {}
  }, [courseId])

  useEffect(() => {
    loadMaterials()
  }, [loadMaterials])

  const uploadFile = useCallback(async (file: File) => {
    const key = file.name + Date.now()
    setUploads(prev => ({ ...prev, [key]: { progress: 0 } }))

    const formData = new FormData()
    formData.append('file', file)

    try {
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 90)
          setUploads(prev => ({ ...prev, [key]: { progress: pct } }))
        }
      })

      await new Promise<void>((resolve, reject) => {
        xhr.open('POST', `/api/courses/${courseId}/upload`)
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploads(prev => ({ ...prev, [key]: { progress: 100 } }))
            resolve()
          } else {
            let detail = xhr.statusText
            try {
              const parsed = JSON.parse(xhr.responseText)
              if (parsed?.error) detail = parsed.error
            } catch {}
            reject(new Error(`Upload failed: ${detail}`))
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(formData)
      })

      await loadMaterials()
      setTimeout(() => {
        setUploads(prev => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      }, 2000)
    } catch (err) {
      setUploads(prev => ({
        ...prev,
        [key]: { progress: 0, error: err instanceof Error ? err.message : 'Upload failed' },
      }))
    }
  }, [courseId, loadMaterials])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(uploadFile)
  }, [uploadFile])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(uploadFile)
    e.target.value = ''
  }, [uploadFile])

  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) return
    setIsSubmittingText(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText, fileName: pasteTitle || 'Pasted text' }),
      })
      if (res.ok) {
        setPasteText('')
        setPasteTitle('')
        setShowPasteMode(false)
        await loadMaterials()
      }
    } finally {
      setIsSubmittingText(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/courses/${courseId}/source-materials/${id}`, { method: 'DELETE' })
      await loadMaterials()
    } finally {
      setDeletingId(null)
    }
  }

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: 'Pending', cls: 'pill pill-warning' },
      processing: { label: 'Processing', cls: 'pill pill-info' },
      ready: { label: 'Ready', cls: 'pill pill-success' },
      failed: { label: 'Failed', cls: 'pill pill-error' },
    }
    return map[status] ?? { label: status, cls: 'pill pill-draft' }
  }

  const fileIcon = (type: string): IconName => {
    if (type === 'pdf' || type === 'docx' || type === 'txt') return 'file'
    return 'folder'
  }

  const activeUploads = Object.entries(uploads)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.breadcrumb}>Course Setup</p>
          <h1 className={styles.title}>Source Materials</h1>
          <p className={styles.subtitle}>Upload PDFs, Word docs, or text files. The AI will use these to generate your course.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className="btn-secondary"
            onClick={() => setShowPasteMode(v => !v)}
          >
            {showPasteMode ? <><Icon name="arrowRight" size={15} style={{ transform: 'rotate(-90deg)' }} /> Hide text input</> : <><Icon name="edit" size={15} /> Paste text</>}
          </button>
        </div>
      </header>

      {showPasteMode && (
        <div className={`card ${styles.pasteCard}`}>
          <h3 className={styles.pasteTitle}>Paste text content</h3>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="label">Title (optional)</label>
            <input
              className="input"
              placeholder="e.g. Company handbook excerpt"
              value={pasteTitle}
              onChange={e => setPasteTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="label">Content</label>
            <textarea
              className="textarea"
              placeholder="Paste your text content here..."
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={8}
            />
          </div>
          <div className={styles.pasteActions}>
            <button className="btn-secondary" onClick={() => setShowPasteMode(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim() || isSubmittingText}
            >
              {isSubmittingText ? 'Saving...' : 'Save text'}
            </button>
          </div>
        </div>
      )}

      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
        aria-label="Upload files"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.docx"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <div className={styles.dropzoneIcon}><Icon name="upload" size={32} /></div>
        <p className={styles.dropzoneMain}>
          {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
        </p>
        <p className={styles.dropzoneSub}>PDF, TXT, DOCX — up to 50 MB each</p>
      </div>

      {activeUploads.length > 0 && (
        <div className={styles.uploadList}>
          {activeUploads.map(([key, state]) => (
            <div key={key} className={styles.uploadItem}>
              <div className={styles.uploadName}>{key.replace(/\d+$/, '')}</div>
              {state.error ? (
                <span className="pill pill-error">{state.error}</span>
              ) : (
                <div className={styles.uploadProgress}>
                  <div className="progress-bar" style={{ width: 160 }}>
                    <div className="progress-bar-fill" style={{ width: `${state.progress}%` }} />
                  </div>
                  <span className={styles.uploadPct}>{state.progress}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {materials.length > 0 && (
        <div className={styles.materialsSection}>
          <h2 className={styles.sectionTitle}>Uploaded materials ({materials.length})</h2>
          <div className={styles.materialsList}>
            {materials.map(m => {
              const st = statusLabel(m.status)
              return (
                <div key={m.id} className={styles.materialRow}>
                  <span className={styles.materialIcon}><Icon name={fileIcon(m.fileType)} size={16} /></span>
                  <div className={styles.materialInfo}>
                    <span className={styles.materialName}>{m.fileName}</span>
                    <span className={styles.materialMeta}>
                      {m.fileType.toUpperCase()}{m.fileSizeBytes ? ` · ${formatBytes(m.fileSizeBytes)}` : ''}
                    </span>
                  </div>
                  <span className={st.cls}>{st.label}</span>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                    aria-label="Delete material"
                  >
                    {deletingId === m.id ? '...' : <Icon name="x" size={14} />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {materials.length === 0 && activeUploads.length === 0 && (
        <p className={styles.emptyHint}>No materials uploaded yet. Add files above to get started.</p>
      )}

      <div className={styles.footer}>
        <button
          className="btn-cta"
          onClick={() => router.push(`/admin/courses/${courseId}/generate`)}
          disabled={materials.length === 0}
        >
          Next: Generate Content <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </div>
  )
}
