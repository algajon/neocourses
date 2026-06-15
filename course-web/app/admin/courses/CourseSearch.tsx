'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/Icon'

interface CourseSearchProps {
  className?: string
  inputClassName?: string
  defaultValue?: string
}

export function CourseSearch({ className, inputClassName, defaultValue = '' }: CourseSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(defaultValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function push(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.trim()) params.set('q', next.trim())
    else params.delete('q')
    const qs = params.toString()
    router.push(qs ? `/admin/courses?${qs}` : '/admin/courses')
  }

  return (
    <div className={className}>
      <Icon name="search" size={15} />
      <input
        type="search"
        placeholder="Search courses…"
        className={inputClassName}
        value={value}
        onChange={(e) => {
          const next = e.target.value
          setValue(next)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => push(next), 250)
        }}
      />
    </div>
  )
}
