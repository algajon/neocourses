'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Icon, type IconName } from '@/components/Icon'
import { useToast } from '@/components/Toast/ToastProvider'
import styles from './page.module.css'

interface SourceMaterial {
  id: string
  fileName: string
  fileType: string
  fileSizeBytes: number | null
  status: string
  processingError?: string | null
  createdAt: string
}

export default function UploadPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const courseId = params.id as string

  const [materials, setMaterials] = useState<SourceMaterial[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState<Record<string, { progress: number; error?: string }>>({})
  const [addMode, setAddMode] = useState<'file' | 'url' | 'text'>('file')
  const [urlValue, setUrlValue] = useState('')
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteTitle, setPasteTitle] = useState('')
  const [isSubmittingText, setIsSubmittingText] = useState(false)
  const [textError, setTextError] = useState<string | null>(null)
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

  const handleUrlSubmit = async () => {
    if (!urlValue.trim()) return
    setIsSubmittingUrl(true)
    setUrlError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/ingest-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlValue.trim() }),
      })
      if (res.ok) {
        setUrlValue('')
        await loadMaterials()
        toast({ type: 'success', title: 'Source added from URL' })
      } else {
        const data = await res.json().catch(() => null)
        const msg = data?.error ?? 'Could not add from URL'
        setUrlError(msg)
        toast({ type: 'error', title: 'Could not add from URL', description: msg })
      }
    } catch {
      setUrlError('Network error')
      toast({ type: 'error', title: 'Could not add from URL', description: 'Network error' })
    } finally {
      setIsSubmittingUrl(false)
    }
  }

  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) return
    setIsSubmittingText(true)
    setTextError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/ingest-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText, title: pasteTitle.trim() || undefined }),
      })
      if (res.ok) {
        setPasteText('')
        setPasteTitle('')
        await loadMaterials()
        toast({ type: 'success', title: 'Text source added' })
      } else {
        const data = await res.json().catch(() => null)
        const msg = data?.error ?? 'Could not add text'
        setTextError(msg)
        toast({ type: 'error', title: 'Could not add text', description: msg })
      }
    } catch {
      setTextError('Network error')
      toast({ type: 'error', title: 'Could not add text', description: 'Network error' })
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

  const MEDIA_TYPES = new Set(['mp3', 'm4a', 'wav', 'mp4', 'mov', 'webm', 'mpeg', 'mpga', 'ogg', 'oga', 'flac'])
  const fileIcon = (type: string): IconName => {
    if (type === 'url') return 'arrowRight'
    if (type === 'text') return 'edit'
    if (MEDIA_TYPES.has(type)) return 'play'
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
          <p className={styles.subtitle}>Add reference material from a file (PDF, docs, audio, or video), a URL, or pasted text. The AI will use these to generate your course.</p>
        </div>
      </header>

      <div className={styles.segmented} role="tablist" aria-label="Source type">
        <button
          className={`${styles.segment} ${addMode === 'file' ? styles.segmentActive : ''}`}
          onClick={() => setAddMode('file')}
          role="tab"
          aria-selected={addMode === 'file'}
        >
          <Icon name="upload" size={15} /> Upload file
        </button>
        <button
          className={`${styles.segment} ${addMode === 'url' ? styles.segmentActive : ''}`}
          onClick={() => setAddMode('url')}
          role="tab"
          aria-selected={addMode === 'url'}
        >
          <Icon name="arrowRight" size={15} /> Add from URL
        </button>
        <button
          className={`${styles.segment} ${addMode === 'text' ? styles.segmentActive : ''}`}
          onClick={() => setAddMode('text')}
          role="tab"
          aria-selected={addMode === 'text'}
        >
          <Icon name="edit" size={15} /> Paste text
        </button>
      </div>

      {addMode === 'file' && (
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
            accept=".pdf,.txt,.md,.docx,.csv,.mp3,.m4a,.wav,.mp4,.mov,.webm,.mpeg,.mpga,.ogg,.oga,.flac,audio/*,video/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <div className={styles.dropzoneIcon}><Icon name="upload" size={32} /></div>
          <p className={styles.dropzoneMain}>
            {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
          </p>
          <p className={styles.dropzoneSub}>PDF, docs, audio, or video — up to 50 MB each</p>
          <p className={styles.dropzoneSub}>Audio &amp; video are transcribed automatically (max 25 MB) and may take a little longer to process.</p>
        </div>
      )}

      {addMode === 'url' && (
        <div className={`card ${styles.sourceCard}`}>
          <h3 className={styles.sourceCardTitle}>Add from URL</h3>
          <p className={styles.sourceCardHint}>We'll fetch the page and extract its readable text.</p>
          <div className={styles.urlRow}>
            <input
              className="input"
              type="url"
              placeholder="https://example.com/article"
              value={urlValue}
              onChange={e => { setUrlValue(e.target.value); setUrlError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') handleUrlSubmit() }}
            />
            <button
              className="btn-primary"
              onClick={handleUrlSubmit}
              disabled={!urlValue.trim() || isSubmittingUrl}
            >
              {isSubmittingUrl ? 'Adding...' : 'Add'}
            </button>
          </div>
          {urlError && <p className={styles.sourceError}>{urlError}</p>}
        </div>
      )}

      {addMode === 'text' && (
        <div className={`card ${styles.sourceCard}`}>
          <h3 className={styles.sourceCardTitle}>Paste text content</h3>
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
              onChange={e => { setPasteText(e.target.value); setTextError(null) }}
              rows={8}
            />
          </div>
          {textError && <p className={styles.sourceError}>{textError}</p>}
          <div className={styles.pasteActions}>
            <button
              className="btn-primary"
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim() || isSubmittingText}
            >
              {isSubmittingText ? 'Saving...' : 'Add text'}
            </button>
          </div>
        </div>
      )}

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
                    {m.status === 'failed' && m.processingError && (
                      <span className={styles.sourceError}>{m.processingError}</span>
                    )}
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
