'use client'

import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/Icon'
import styles from './LessonComments.module.css'

interface Comment {
  id: string
  courseId: string
  lessonId: string | null
  authorId: string
  authorName: string | null
  body: string
  resolved: boolean
  createdAt: string
}

type ReviewStatus = 'none' | 'in_review' | 'approved'

interface LessonCommentsProps {
  courseId: string
  lessonId?: string
  reviewStatus?: ReviewStatus
}

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  none: 'Not in review',
  in_review: 'In review',
  approved: 'Approved',
}

const REVIEW_PILL: Record<ReviewStatus, string> = {
  none: styles.pillNone,
  in_review: styles.pillReview,
  approved: styles.pillApproved,
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function LessonComments({ courseId, lessonId, reviewStatus = 'none' }: LessonCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<ReviewStatus>(reviewStatus)
  const [statusBusy, setStatusBusy] = useState(false)
  const [error, setError] = useState('')

  const query = lessonId ? `?lessonId=${encodeURIComponent(lessonId)}` : ''

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/courses/${courseId}/comments${query}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setComments(data.comments ?? [])
    } catch {
      setError('Could not load comments.')
    } finally {
      setLoading(false)
    }
  }, [courseId, query])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setStatus(reviewStatus)
  }, [reviewStatus])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/courses/${courseId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lessonId ?? null, body }),
      })
      if (!res.ok) throw new Error('post failed')
      const data = await res.json()
      setComments((prev) => [data.comment, ...prev])
      setDraft('')
    } catch {
      setError('Could not post comment.')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleResolved(comment: Comment) {
    const next = !comment.resolved
    setComments((prev) =>
      prev.map((c) => (c.id === comment.id ? { ...c, resolved: next } : c)),
    )
    try {
      const res = await fetch(`/api/courses/${courseId}/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: next }),
      })
      if (!res.ok) throw new Error('patch failed')
    } catch {
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, resolved: comment.resolved } : c)),
      )
      setError('Could not update comment.')
    }
  }

  async function remove(comment: Comment) {
    if (!window.confirm('Delete this comment?')) return
    const previous = comments
    setComments((prev) => prev.filter((c) => c.id !== comment.id))
    try {
      const res = await fetch(`/api/courses/${courseId}/comments/${comment.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('delete failed')
    } catch {
      setComments(previous)
      setError('Could not delete comment.')
    }
  }

  async function setReview(next: ReviewStatus) {
    const previous = status
    setStatus(next)
    setStatusBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/courses/${courseId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('review failed')
    } catch {
      setStatus(previous)
      setError('Could not update review status.')
    } finally {
      setStatusBusy(false)
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.reviewBar}>
        <div className={styles.reviewState}>
          <span className={styles.reviewLabel}>Review</span>
          <span className={`${styles.pill} ${REVIEW_PILL[status]}`}>{REVIEW_LABEL[status]}</span>
        </div>
        <div className={styles.reviewActions}>
          {status !== 'in_review' && (
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={statusBusy}
              onClick={() => setReview('in_review')}
            >
              <Icon name="eye" size={14} />
              Request review
            </button>
          )}
          {status !== 'approved' && (
            <button
              type="button"
              className={styles.btnApprove}
              disabled={statusBusy}
              onClick={() => setReview('approved')}
            >
              <Icon name="check" size={14} />
              Approve
            </button>
          )}
          {status !== 'none' && (
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={statusBusy}
              onClick={() => setReview('none')}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          className={styles.textarea}
          placeholder="Leave a comment for reviewers…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
        />
        <div className={styles.formFooter}>
          <button type="submit" className={styles.btnPost} disabled={submitting || !draft.trim()}>
            {submitting ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.list}>
        {loading ? (
          <div className={styles.muted}>Loading comments…</div>
        ) : comments.length === 0 ? (
          <div className={styles.empty}>No comments yet.</div>
        ) : (
          comments.map((comment) => (
            <article
              key={comment.id}
              className={`${styles.comment} ${comment.resolved ? styles.resolved : ''}`}
            >
              <div className={styles.commentHead}>
                <span className={styles.author}>{comment.authorName ?? 'Unknown'}</span>
                <span className={styles.time}>{formatTime(comment.createdAt)}</span>
                {comment.resolved && (
                  <span className={`${styles.pill} ${styles.pillApproved}`}>Resolved</span>
                )}
              </div>
              <p className={styles.body}>{comment.body}</p>
              <div className={styles.commentActions}>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => toggleResolved(comment)}
                >
                  {comment.resolved ? 'Unresolve' : 'Resolve'}
                </button>
                <button
                  type="button"
                  className={styles.linkBtnDanger}
                  onClick={() => remove(comment)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
