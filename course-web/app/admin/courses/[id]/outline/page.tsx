'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast/ToastProvider'
import styles from './page.module.css'

interface Lesson {
  id: string
  title: string
  position: number
}

interface Module {
  id: string
  title: string
  description: string | null
  position: number
  lessons: Lesson[]
}

interface Course {
  id: string
  title: string
  status: string
}

export default function OutlinePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ title: string; description: string }>({ title: '', description: '' })
  const [savingId, setSavingId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const { toast } = useToast()
  const [addingModule, setAddingModule] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')

  const load = useCallback(async () => {
    try {
      const [courseRes, modulesRes] = await Promise.all([
        fetch(`/api/courses/${courseId}`),
        fetch(`/api/courses/${courseId}/modules`),
      ])
      if (courseRes.ok) setCourse((await courseRes.json()).course)
      if (modulesRes.ok) {
        const data = await modulesRes.json()
        const mods: Module[] = data.modules ?? []
        setModules(mods)
        setExpandedModules(new Set(mods.map((m: Module) => m.id)))
      }
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => { load() }, [load])

  const toggleExpand = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startEdit = (mod: Module) => {
    setEditingModuleId(mod.id)
    setEditValues({ title: mod.title, description: mod.description ?? '' })
  }

  const cancelEdit = () => {
    setEditingModuleId(null)
    setEditValues({ title: '', description: '' })
  }

  const saveModule = async (modId: string) => {
    setSavingId(modId)
    try {
      const res = await fetch(`/api/courses/${courseId}/modules/${modId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editValues),
      })
      if (res.ok) {
        setModules(prev => prev.map(m =>
          m.id === modId ? { ...m, title: editValues.title, description: editValues.description } : m
        ))
        setEditingModuleId(null)
      }
    } finally {
      setSavingId(null)
    }
  }

  const regenerateModule = async (modId: string) => {
    setRegeneratingId(modId)
    try {
      await fetch(`/api/courses/${courseId}/modules/${modId}/regenerate`, { method: 'POST' })
      await load()
    } finally {
      setRegeneratingId(null)
    }
  }

  const addModule = async () => {
    if (!newModuleTitle.trim()) return
    try {
      const res = await fetch(`/api/courses/${courseId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newModuleTitle }),
      })
      if (res.ok) {
        setNewModuleTitle('')
        setAddingModule(false)
        await load()
      }
    } catch {}
  }

  const publishCourse = async () => {
    setPublishing(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/publish`, { method: 'POST' })
      if (res.ok) {
        setCourse(prev => prev ? { ...prev, status: 'published' } : prev)
        toast({ type: 'success', title: 'Course published', description: 'Learners can now enroll from the catalog.' })
      } else {
        const data = await res.json().catch(() => null)
        toast({ type: 'error', title: 'Could not publish course', description: data?.error ?? 'Please try again.' })
      }
    } catch {
      toast({ type: 'error', title: 'Could not publish course', description: 'Please try again.' })
    } finally {
      setPublishing(false)
    }
  }

  const moveModule = async (modId: string, direction: 'up' | 'down') => {
    const idx = modules.findIndex(m => m.id === modId)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === modules.length - 1) return

    const next = [...modules]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setModules(next)

    await fetch(`/api/courses/${courseId}/modules/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map(m => m.id) }),
    })
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading outline...</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.breadcrumb}>Course Setup</p>
          <h1 className={styles.title}>{course?.title ?? 'Course Outline'}</h1>
          <p className={styles.subtitle}>{modules.length} modules · {modules.reduce((s, m) => s + m.lessons.length, 0)} lessons</p>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/admin/courses/${courseId}/preview`} className="btn-secondary">
            Preview
          </Link>
          <button
            className="btn-cta"
            onClick={publishCourse}
            disabled={publishing || course?.status === 'published'}
          >
            {publishing ? 'Publishing...' : course?.status === 'published' ? <><Icon name="check" size={15} /> Published</> : 'Publish Course'}
          </button>
        </div>
      </header>

      <div className={styles.modules}>
        {modules.map((mod, idx) => {
          const isExpanded = expandedModules.has(mod.id)
          const isEditing = editingModuleId === mod.id

          return (
            <div key={mod.id} className={styles.moduleCard}>
              <div className={styles.moduleHeader}>
                <div className={styles.moduleReorder}>
                  <button
                    className={styles.reorderBtn}
                    onClick={() => moveModule(mod.id, 'up')}
                    disabled={idx === 0}
                    aria-label="Move up"
                  ><Icon name="arrowRight" size={14} style={{ transform: 'rotate(-90deg)' }} /></button>
                  <button
                    className={styles.reorderBtn}
                    onClick={() => moveModule(mod.id, 'down')}
                    disabled={idx === modules.length - 1}
                    aria-label="Move down"
                  ><Icon name="arrowRight" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
                </div>

                <button
                  className={styles.moduleToggle}
                  onClick={() => toggleExpand(mod.id)}
                  aria-expanded={isExpanded}
                >
                  <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>›</span>
                </button>

                {isEditing ? (
                  <div className={styles.moduleEditForm}>
                    <input
                      className="input"
                      value={editValues.title}
                      onChange={e => setEditValues(v => ({ ...v, title: e.target.value }))}
                      placeholder="Module title"
                    />
                    <input
                      className="input"
                      value={editValues.description}
                      onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                      placeholder="Short description (optional)"
                    />
                    <div className={styles.editActions}>
                      <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>
                      <button
                        className="btn-primary"
                        onClick={() => saveModule(mod.id)}
                        disabled={savingId === mod.id}
                      >
                        {savingId === mod.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.moduleMeta}>
                    <span className={styles.moduleIndex}>Module {idx + 1}</span>
                    <h3 className={styles.moduleTitle}>{mod.title}</h3>
                    {mod.description && (
                      <p className={styles.moduleDesc}>{mod.description}</p>
                    )}
                  </div>
                )}

                {!isEditing && (
                  <div className={styles.moduleActions}>
                    <button className="btn-secondary" onClick={() => startEdit(mod)}>Edit</button>
                    <button
                      className="btn-secondary"
                      onClick={() => regenerateModule(mod.id)}
                      disabled={regeneratingId === mod.id}
                    >
                      {regeneratingId === mod.id ? '...' : <><Icon name="sparkles" size={14} /> Regenerate</>}
                    </button>
                    <Link
                      href={`/admin/courses/${courseId}/quiz/${mod.id}`}
                      className="btn-secondary"
                    >
                      Quiz
                    </Link>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className={styles.lessonsList}>
                  {mod.lessons.length === 0 ? (
                    <p className={styles.noLessons}>No lessons in this module yet.</p>
                  ) : (
                    mod.lessons.map((lesson, lIdx) => (
                      <Link
                        key={lesson.id}
                        href={`/admin/courses/${courseId}/lessons/${lesson.id}`}
                        className={styles.lessonRow}
                      >
                        <span className={styles.lessonNum}>{lIdx + 1}</span>
                        <span className={styles.lessonTitle}>{lesson.title}</span>
                        <span className={styles.lessonEdit}>Edit <Icon name="arrowRight" size={13} /></span>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}

        {addingModule ? (
          <div className={`card ${styles.addModuleForm}`}>
            <h3>New module</h3>
            <input
              className="input"
              placeholder="Module title"
              value={newModuleTitle}
              onChange={e => setNewModuleTitle(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addModule() }}
            />
            <div className={styles.editActions}>
              <button className="btn-secondary" onClick={() => setAddingModule(false)}>Cancel</button>
              <button className="btn-primary" onClick={addModule} disabled={!newModuleTitle.trim()}>Add module</button>
            </div>
          </div>
        ) : (
          <button
            className={styles.addModuleBtn}
            onClick={() => setAddingModule(true)}
          >
            + Add module
          </button>
        )}
      </div>
    </div>
  )
}
