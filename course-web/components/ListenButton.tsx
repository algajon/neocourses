'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/Icon'
import styles from './ListenButton.module.css'

interface ListenButtonProps {
  text: string
}

const RATES = [0.75, 1, 1.25, 1.5] as const
type Status = 'idle' | 'playing' | 'paused'

// Reads lesson text aloud using the device's built-in (OS-native) speech
// synthesizer. Everything runs locally in the browser — no audio or text is sent
// to any external service.
export function ListenButton({ text }: ListenButtonProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [rate, setRate] = useState<number>(1)
  const [supported, setSupported] = useState(true)
  const rateRef = useRef(1)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
  }, [])

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  // Stop any in-flight speech when the lesson (text) changes or we unmount.
  useEffect(() => {
    setStatus('idle')
    return cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  function speak() {
    if (!supported) return
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rateRef.current
    utterance.onend = () => setStatus('idle')
    utterance.onerror = () => setStatus('idle')
    synth.speak(utterance)
    setStatus('playing')
  }

  function handlePlayPause() {
    if (!supported) return
    const synth = window.speechSynthesis

    if (status === 'playing') {
      synth.pause()
      setStatus('paused')
      return
    }
    if (status === 'paused') {
      synth.resume()
      setStatus('playing')
      return
    }
    speak()
  }

  function handleStop() {
    cancel()
    setStatus('idle')
  }

  function handleRateChange(next: number) {
    setRate(next)
    rateRef.current = next
    // Web Speech can't change rate mid-utterance; restart if currently speaking.
    if (status !== 'idle') speak()
  }

  const isPlaying = status === 'playing'
  const canStop = status === 'playing' || status === 'paused'

  return (
    <div
      className={styles.root}
      title={!supported ? 'Listen mode is not available in this browser' : undefined}
    >
      <button
        type="button"
        className={styles.control}
        onClick={handlePlayPause}
        disabled={!supported}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <Icon name="play" size={16} />
        )}
        <span className={styles.label}>
          {isPlaying ? 'Pause' : status === 'paused' ? 'Resume' : 'Listen'}
        </span>
      </button>

      <button
        type="button"
        className={styles.iconButton}
        onClick={handleStop}
        disabled={!supported || !canStop}
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
            disabled={!supported}
            aria-pressed={rate === r}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  )
}
