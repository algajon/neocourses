'use client'

import { useEffect, useRef, useState, useCallback, FormEvent } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface CourseInfo {
  title: string
  lessonTitles: string[]
}

export default function TutorPage() {
  const params = useParams<{ courseId: string }>()
  const courseId = params.courseId

  const [messages, setMessages] = useState<Message[]>([])
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/tutor/${courseId}/history`).then(r => r.json()),
      fetch(`/api/tutor/${courseId}/context`).then(r => r.json()),
    ])
      .then(([history, ctx]) => {
        setMessages(history.messages ?? [])
        setCourseInfo(ctx)
        setLoadingHistory(false)
      })
      .catch(() => setLoadingHistory(false))
  }, [courseId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [])

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    const userMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, message: text }),
      })
      const data = await res.json()
      const assistantMsg: Message = {
        id: data.id ?? `ai-${Date.now()}`,
        role: 'assistant',
        content: data.content ?? 'Sorry, I could not generate a response.',
        createdAt: new Date().toISOString(),
      }
      setMessages(prev => [
        ...prev.filter(m => m.id !== userMsg.id),
        { ...userMsg, id: data.userMessageId ?? userMsg.id },
        assistantMsg,
      ])
    } catch {
      setMessages(prev => [
        ...prev.filter(m => m.id !== userMsg.id),
        userMsg,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setSending(false)
    }
  }, [input, courseId, sending])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }, [handleSubmit])

  return (
    <div className={styles.shell}>
      <div className={styles.topBar}>
        <Link href={`/learn/${courseId}`} className={styles.backBtn}>← Course</Link>
        <div className={styles.topTitle}>
          <span className={styles.topLabel}>AI Tutor</span>
          {courseInfo && (
            <span className={styles.topCourse}>{courseInfo.title}</span>
          )}
        </div>
        <div className={styles.topBadge}>Powered by AI</div>
      </div>

      <div className={styles.messages}>
        {loadingHistory && (
          <div className={styles.loadingMessages}>
            <div className={styles.spinner} />
          </div>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <p className={styles.emptyTitle}>Ask me anything about this course</p>
            {courseInfo && (
              <p className={styles.emptySubtitle}>I know all the lessons in <strong>{courseInfo.title}</strong></p>
            )}
            <div className={styles.suggestions}>
              {[
                'Summarize the key concepts',
                'What are the main learning goals?',
                'Give me a quiz question',
              ].map(s => (
                <button
                  key={s}
                  className={styles.suggestion}
                  onClick={() => {
                    setInput(s)
                    textareaRef.current?.focus()
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
          >
            <div className={styles.avatar}>
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            <div className={styles.bubble}>
              <div className={styles.bubbleContent}>
                {msg.content.split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < msg.content.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
              <span className={styles.timestamp}>
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {sending && (
          <div className={`${styles.message} ${styles.messageAssistant}`}>
            <div className={styles.avatar}>AI</div>
            <div className={styles.bubble}>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={e => { setInput(e.target.value); autoResize() }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!input.trim() || sending}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
