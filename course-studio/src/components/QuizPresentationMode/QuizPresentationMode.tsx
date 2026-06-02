import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { QuizQuestion } from '../../lib/contentGenerator';
import styles from './QuizPresentationMode.module.css';

const TIMER_SECONDS = 10;
const REVEAL_HOLD   = 3;   // seconds to hold the revealed answer before advancing
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

interface Props {
  questions: QuizQuestion[];
  chapterName: string;
  onClose: () => void;
}

const STOP_WORDS = new Set([
  'which','what','how','why','when','where','who','is','are','was','were',
  'the','a','an','in','of','to','for','and','or','but','at','by','from',
  'as','on','with','following','described','refers','reflects','statement',
  'concept','practical','advice','chapter','describes','real','world',
  'application','covered','this','does','do','did','it','its','that',
  'these','those','there','been','have','has','had','not','can','will',
  'would','could','should','may','might','about','key','takeaway',
  'following','correct','according','answer','question','below',
]);

function extractKeywords(question: string, topic: string): string {
  const raw = (question + ' ' + topic)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
  const unique = [...new Set(raw)].slice(0, 3);
  return unique.length ? unique.join(',') : 'education,knowledge,learning';
}

export function QuizPresentationMode({ questions, chapterName, onClose }: Props) {
  const overlayRef   = useRef<HTMLDivElement>(null);
  const [idx, setIdx]             = useState(0);
  const [timeLeft, setTimeLeft]   = useState(TIMER_SECONDS);
  const [revealed, setRevealed]   = useState(false);
  const [holdLeft, setHoldLeft]   = useState(0);
  const [imgSrc, setImgSrc]       = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const [isFS, setIsFS]           = useState(false);

  // Inherit the active app theme so CSS custom properties cascade correctly
  // (critical when the element goes fullscreen and detaches from the root context)
  const theme = document.documentElement.dataset.theme ?? 'white';

  // Platform detection for hotkey label
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const fsKey = isMac ? '⌃⌘F' : 'F11';

  const q = questions[idx];

  /* ── Fullscreen (Tauri native command — works on all platforms) ──────── */
  const enterFS = useCallback(async () => {
    await invoke('set_fullscreen', { fullscreen: true });
    setIsFS(true);
  }, []);

  const exitFS = useCallback(async () => {
    await invoke('set_fullscreen', { fullscreen: false });
    setIsFS(false);
  }, []);

  const toggleFS = useCallback(() => {
    isFS ? exitFS() : enterFS();
  }, [isFS, enterFS, exitFS]);

  // Auto-enter on mount; exit when the overlay unmounts
  useEffect(() => {
    enterFS();
    return () => { invoke('set_fullscreen', { fullscreen: false }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync if user exits fullscreen via OS (e.g. Escape or green button on Mac)
  useEffect(() => {
    let active = true;
    const poll = setInterval(async () => {
      const fs = await invoke<boolean>('is_fullscreen');
      if (active) setIsFS(fs);
    }, 800);
    return () => { active = false; clearInterval(poll); };
  }, []);

  // Platform-aware hotkeys: ⌃⌘F (Mac) or F11 (Win/Linux)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const macFS = isMac  && e.metaKey && e.ctrlKey && (e.key === 'f' || e.key === 'F');
      const winFS = !isMac && e.key === 'F11';
      if (macFS || winFS) { e.preventDefault(); toggleFS(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMac, toggleFS]);

  /* ── Image ───────────────────────────────────────────────── */
  useEffect(() => {
    setImgFailed(false);
    const kw = extractKeywords(q.question, chapterName);
    setImgSrc(`https://loremflickr.com/1400/560/${kw}?lock=${idx}`);
  }, [idx, q.question, chapterName]);

  /* ── Countdown ───────────────────────────────────────────── */
  useEffect(() => {
    if (revealed) return;
    if (timeLeft <= 0) { setRevealed(true); setHoldLeft(REVEAL_HOLD); return; }
    const t = setTimeout(() => setTimeLeft(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, revealed]);

  /* ── Auto-advance after hold ─────────────────────────────── */
  useEffect(() => {
    if (!revealed || holdLeft <= 0) return;
    const t = setTimeout(() => {
      if (holdLeft === 1) advance();
      else setHoldLeft(n => n - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [revealed, holdLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  function advance() {
    if (idx < questions.length - 1) {
      setIdx(i => i + 1);
      setTimeLeft(TIMER_SECONDS);
      setRevealed(false);
      setHoldLeft(0);
    } else {
      exitFS();
      onClose();
    }
  }

  function handleSkip() {
    if (!revealed) { setRevealed(true); setHoldLeft(REVEAL_HOLD); }
    else advance();
  }

  function handleClose() { exitFS(); onClose(); }

  const timerPct  = revealed ? 0 : (timeLeft / TIMER_SECONDS) * 100;

  return (
    <div ref={overlayRef} className={styles.overlay} data-theme={theme}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoDot} />
          <span className={styles.logoText}>
            neo<span className={styles.logoAccent}>Courses</span>
          </span>
        </div>

        <div className={styles.progressDots}>
          {questions.map((_, i) => (
            <div
              key={i}
              className={`${styles.dot} ${i < idx ? styles.dotDone : i === idx ? styles.dotActive : ''}`}
            />
          ))}
        </div>

        <div className={styles.headerRight}>
          <span className={styles.qCounter}>{idx + 1} / {questions.length}</span>
          <button className={styles.fsBtn} onClick={toggleFS} title={isFS ? `Exit fullscreen (${fsKey})` : `Fullscreen (${fsKey})`}>
            {isFS ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M8 1h4v4M5 1H1v4M8 12h4V8M5 12H1V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M1 5V1h4M8 1h4v4M12 8v4H8M5 12H1V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            <span>{fsKey}</span>
          </button>
          <button className={styles.closeBtn} onClick={handleClose} title="Exit presentation">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Image ──────────────────────────────────────────── */}
      <div className={styles.imageWrap}>
        {!imgFailed && imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            className={styles.image}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className={styles.imageFallback}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <rect x="4" y="9" width="36" height="26" rx="3" stroke="currentColor" strokeWidth="2"/>
              <circle cx="15" cy="19" r="4" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 31l13-10 7 6 6-5 14 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>{chapterName}</span>
          </div>
        )}
        <div className={styles.imageScrim} />
        {/* Chapter label floated on image */}
        <div className={styles.chapterBadge}>{chapterName}</div>
      </div>

      {/* ── Question ───────────────────────────────────────── */}
      <div className={styles.questionWrap}>
        <p className={styles.questionText}>{q.question}</p>
      </div>

      {/* ── Options 2×2 ────────────────────────────────────── */}
      <div className={styles.optionsGrid}>
        {q.options.map((opt, oi) => {
          const isCorrect = oi === q.correctIndex;
          return (
            <div
              key={oi}
              className={`${styles.option}
                ${revealed && isCorrect ? styles.optionCorrect : ''}
                ${revealed && !isCorrect ? styles.optionDim : ''}`}
            >
              <span className={`${styles.optionBadge} ${revealed && isCorrect ? styles.optionBadgeCorrect : ''}`}>
                {OPTION_LABELS[oi]}
              </span>
              <span className={styles.optionText}>{opt}</span>
              {revealed && isCorrect && (
                <svg className={styles.checkIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10l4.5 4.5 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className={styles.footer}>
        <div className={styles.timerGroup}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={styles.timerIcon}>
            <circle cx="7" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M7 5.5V8l1.8 1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M5 1.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span className={styles.timerDigit}>{revealed ? '—' : `${timeLeft}s`}</span>
          <div className={styles.timerTrack}>
            <div className={styles.timerFill} style={{ width: `${timerPct}%` }} />
          </div>
        </div>

        {revealed && holdLeft > 0 && (
          <span className={styles.holdLabel}>Next in {holdLeft}s…</span>
        )}

        <button className={styles.skipBtn} onClick={handleSkip}>
          {revealed ? 'Next →' : 'Reveal & skip'}
        </button>
      </div>
    </div>
  );
}
