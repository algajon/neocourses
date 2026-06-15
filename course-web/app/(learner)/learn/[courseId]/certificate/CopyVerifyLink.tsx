'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icon'

interface CopyVerifyLinkProps {
  code: string
  className?: string
}

export function CopyVerifyLink({ code, className }: CopyVerifyLinkProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = `${window.location.origin}/verify/${code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" onClick={handleCopy} className={className}>
      <Icon name={copied ? 'check' : 'paperclip'} size={14} />
      {copied ? 'Link copied' : 'Copy verification link'}
    </button>
  )
}
