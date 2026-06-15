'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { EnrollButton } from '@/components/EnrollButton'
import styles from './page.module.css'

export interface CatalogItem {
  id: string
  title: string
  description: string | null
  difficultyLevel: string
  courseType: string
  estimatedMinutes: number | null
  certificateEnabled: boolean
  lessonCount: number
  enrolled: boolean
  progressPercent: number
}

const difficultyLabel: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const typeLabel: Record<string, string> = {
  custom: 'Custom',
  onboarding: 'Onboarding',
  compliance: 'Compliance',
  skills: 'Skills',
}

export function CatalogBrowser({ items }: { items: CatalogItem[] }) {
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const [courseType, setCourseType] = useState('all')

  const difficulties = useMemo(
    () => Array.from(new Set(items.map(i => i.difficultyLevel))),
    [items],
  )
  const types = useMemo(() => Array.from(new Set(items.map(i => i.courseType))), [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (difficulty !== 'all' && item.difficultyLevel !== difficulty) return false
      if (courseType !== 'all' && item.courseType !== courseType) return false
      if (q) {
        const haystack = `${item.title} ${item.description ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [items, query, difficulty, courseType])

  const hasFilters = query.trim() !== '' || difficulty !== 'all' || courseType !== 'all'

  return (
    <>
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            className={styles.search}
            placeholder="Search courses…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search courses"
          />
        </div>
        <div className={styles.filters}>
          <select
            className={styles.select}
            value={difficulty}
            onChange={e => setDifficulty(e.target.value)}
            aria-label="Filter by difficulty"
          >
            <option value="all">All levels</option>
            {difficulties.map(d => (
              <option key={d} value={d}>
                {difficultyLabel[d] ?? d}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={courseType}
            onChange={e => setCourseType(e.target.value)}
            aria-label="Filter by course type"
          >
            <option value="all">All types</option>
            {types.map(t => (
              <option key={t} value={t}>
                {typeLabel[t] ?? t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
          <p className={styles.resultCount}>
            {filtered.length} course{filtered.length !== 1 ? 's' : ''}
            {hasFilters ? ' match your filters' : ''}
          </p>
          <div className={styles.grid}>
            {filtered.map(item => (
              <CatalogCard key={item.id} item={item} />
            ))}
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <Icon name="book" size={32} />
          </div>
          <p className={styles.emptyText}>
            {hasFilters ? 'No courses match your search.' : 'No published courses yet.'}
          </p>
          <p className={styles.emptySubtext}>
            {hasFilters
              ? 'Try a different keyword or clear your filters.'
              : 'New courses will appear here once your team publishes them.'}
          </p>
          {hasFilters && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setQuery('')
                setDifficulty('all')
                setCourseType('all')
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </>
  )
}

function CatalogCard({ item }: { item: CatalogItem }) {
  const progress = Math.round(item.progressPercent)

  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <span className={styles.pill}>
            {difficultyLabel[item.difficultyLevel] ?? item.difficultyLevel}
          </span>
          <span className={styles.pillMuted}>{typeLabel[item.courseType] ?? item.courseType}</span>
          {item.estimatedMinutes ? (
            <span className={styles.duration}>{Math.round(item.estimatedMinutes / 60)}h</span>
          ) : null}
        </div>
        <h3 className={styles.cardTitle}>{item.title}</h3>
        {item.description && <p className={styles.cardDescription}>{item.description}</p>}
        <div className={styles.stats}>
          <span className={styles.stat}>
            <Icon name="book" size={14} />
            {item.lessonCount} lesson{item.lessonCount !== 1 ? 's' : ''}
          </span>
          {item.certificateEnabled && (
            <span className={styles.stat}>
              <Icon name="certificate" size={14} />
              Certificate
            </span>
          )}
          {item.enrolled && (
            <span className={styles.enrolledTag}>
              <Icon name="check" size={14} />
              Enrolled
            </span>
          )}
        </div>
        {item.enrolled && progress > 0 && (
          <div className={styles.progressRow}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.progressLabel}>{progress}%</span>
          </div>
        )}
      </div>
      <div className={styles.cardFooter}>
        {item.enrolled ? (
          <Link href={`/learn/${item.id}`} className={styles.btnPrimary}>
            {progress > 0 ? 'Continue' : 'Start'}
            <Icon name="arrowRight" size={14} />
          </Link>
        ) : (
          <EnrollButton courseId={item.id} className={styles.btnAccent} label="Enroll" />
        )}
      </div>
    </div>
  )
}
