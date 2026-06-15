'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/Icon'
import styles from './ListenButton.module.css'

interface ListenButtonProps {
  text: string
}

const RATES = [0.75, 1, 1.25, 1.5] as const
type Status = 'idle' | 'loading' | 'playing' | 'paused'

export function ListenButton({ text }: ListenButtonProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [rate, setRate] = useState<number>(1)
  // 'audio' = OpenAI voice via /api/tts; 'speech' = browser fallback.
  const [mode, setMode] = useState<'audio' | 'speech' | 'unsupported'>('audio')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  // Reset everything when the lesson (text) changes.
  useEffect(() => {
    setStatus('idle')
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  function speakWithBrowser() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setMode('unsupported')
      return
    }
    setMode('speech')
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.onend = () => setStatus('idle')
    utterance.onerror = () => setStatus('idle')
    synth.speak(utterance)
    setStatus('playing')
  }

  async function startAudio() {
    setStatus('loading')
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error(String(res.status))

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      urlRef.current = url

      const audio = new Audio(url)
      audio.playbackRate = rate
      audio.onended = () => setStatus('idle')
      audio.onerror = () => setStatus('idle')
      audioRef.current = audio
      await audio.play()
      setStatus('playing')
    } catch {
      // No OpenAI key / network error → fall back to the browser voice.
      speakWithBrowser()
    }
  }

  function handlePlayPause() {
    if (mode === 'unsupported') return

    // Resume / pause an already-loaded OpenAI track.
    if (audioRef.current) {
      if (status === 'playing') {
        audioRef.current.pause()
        setStatus('paused')
      } else {
        audioRef.current.play().catch(() => setStatus('idle'))
        setStatus('playing')
      }
      return
    }

    // Browser-voice pause/resume.
    if (mode === 'speech' && status !== 'idle' && 'speechSynthesis' in window) {
      const synth = window.speechSynthesis
      if (status === 'playing') {
        synth.pause()
        setStatus('paused')
      } else {
        synth.resume()
        setStatus('playing')
      }
      return
    }

    // Nothing loaded yet → start. Prefer the OpenAI voice.
    if (mode === 'speech') speakWithBrowser()
    else void startAudio()
  }

  function handleStop() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setStatus('idle')
  }

  function handleRateChange(next: number) {
    setRate(next)
    if (audioRef.current) {
      audioRef.current.playbackRate = next // live on <audio>, no restart needed
    } else if (mode === 'speech' && status !== 'idle' && 'speechSynthesis' in window) {
      // Web Speech can't change rate mid-utterance; restart.
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = next
      utterance.onend = () => setStatus('idle')
      utterance.onerror = () => setStatus('idle')
      window.speechSynthesis.speak(utterance)
      setStatus('playing')
    }
  }

  const isPlaying = status === 'playing'
  const isLoading = status === 'loading'
  const canStop = status === 'playing' || status === 'paused'

  return (
    <div
      className={styles.root}
      title={mode === 'unsupported' ? 'Listen mode is not available in this browser' : undefined}
    >
      <button
        type="button"
        className={styles.control}
        onClick={handlePlayPause}
        disabled={mode === 'unsupported' || isLoading}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : isPlaying ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <Icon name="play" size={16} />
        )}
        <span className={styles.label}>
          {isLoading ? 'Loading…' : isPlaying ? 'Pause' : status === 'paused' ? 'Resume' : 'Listen'}
        </span>
      </button>

      <button
        type="button"
        className={styles.iconButton}
        onClick={handleStop}
        disabled={mode === 'unsupported' || !canStop}
        aria-label="Stop"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>

      <div className={styles.speed} role="group" aria-label="Playback speed">
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            className={`${styles.speedOption} ${rate === r ? styles.speedActive : ''}`}
            onClick={() => handleRateChange(r)}
            disabled={mode === 'unsupported'}
            aria-pressed={rate === r}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  )
}
