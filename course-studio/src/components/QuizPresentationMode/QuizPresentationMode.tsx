import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { QuizQuestion } from '../../lib/contentGenerator';
import styles from './QuizPresentationMode.module.css';

const TIMER_SECONDS = 10;
const REVEAL_HOLD   = 3;
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

interface Props {
  questions: QuizQuestion[];
  chapterName: string;
  onClose: () => void;
}

// Map chapter names to reliable loremflickr search terms
function chapterKeywords(name: string): string {
  const l = name.toLowerCase();
  if (/\b(ai|artificial.?intel|machine.?learn|neural|llm|gpt|claude|openai|gemini)\b/.test(l)) return 'artificial-intelligence,robot,future';
  if (/\b(vercel|aws|azure|gcp|cloud|devops|docker|kubernetes|deploy)\b/.test(l))              return 'cloud,server,technology';
  if (/\b(javascript|typescript|react|vue|angular|node|next)\b/.test(l))                       return 'javascript,web,programming';
  if (/\b(python|django|flask|pandas|numpy|fastapi)\b/.test(l))                                return 'python,code,computer';
  if (/\b(sql|database|postgres|mysql|mongodb|redis|data)\b/.test(l))                         return 'database,data,server';
  if (/\b(design|ui|ux|figma|css|interface|layout)\b/.test(l))                                return 'design,creative,interface';
  if (/\b(security|crypto|auth|hack|cyber|privacy)\b/.test(l))                                return 'cybersecurity,lock,protection';
  if (/\b(business|marketing|sales|finance|strategy|management)\b/.test(l))                   return 'business,office,professional';
  if (/\b(science|physics|chemistry|biology|math|statistics)\b/.test(l))                      return 'science,laboratory,research';
  if (/\b(mobile|ios|android|swift|kotlin|flutter)\b/.test(l))                                return 'mobile,smartphone,app';
  if (/\b(game|unity|unreal|3d|render|graphics)\b/.test(l))                                   return 'gaming,technology,digital';
  if (/\b(api|sdk|library|framework|package|module)\b/.test(l))                               return 'software,code,technology';
  if (/\b(network|http|tcp|socket|protocol|web)\b/.test(l))                                   return 'network,internet,technology';
  return 'education,knowledge,learning';
}

export function QuizPresentationMode({ questions, chapterName, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx]             = useState(0);
  const [timeLeft, setTimeLeft]   = useState(TIMER_SECONDS);
  const [revealed, setRevealed]   = useState(false);
  const [holdLeft, setHoldLeft]   = useState(0);
  const [imgSrc, setImgSrc]       = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const [isFS, setIsFS]           = useState(false);

  const theme = document.documentElement.dataset.theme ?? 'white';
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const fsKey = isMac ? '⌃⌘F' : 'F11';
  const q     = questions[idx];

  /* ── Fullscreen ──────────────────────────────────────────── */
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

  useEffect(() => {
    enterFS();
    return () => { invoke('set_fullscreen', { fullscreen: false }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;
    const poll = setInterval(async () => {
      const fs = await invoke<boolean>('is_fullscreen');
      if (active) setIsFS(fs);
    }, 800);
    return () => { active = false; clearInterval(poll); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const macFS = isMac  && e.metaKey && e.ctrlKey && (e.key === 'f' || e.key === 'F');
      const winFS = !isMac && e.key === 'F11';
      if (macFS || winFS) { e.preventDefault(); toggleFS(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMac, toggleFS]);

  /* ── Image — use chapter-level keywords for relevance ───── */
  useEffect(() => {
    setImgFailed(false);
    const kw = chapterKeywords(chapterName);
    // lock param gives a consistent photo per question index within same keywords
    setImgSrc(`https://loremflickr.com/1600/700/${kw}?lock=${idx}`);
  }, [idx, chapterName]);

  /* ── Countdown ───────────────────────────────────────────── */
  useEffect(() => {
    if (revealed) return;
    if (timeLeft <= 0) { setRevealed(true); setHoldLeft(REVEAL_HOLD); return; }
    const t = setTimeout(() => setTimeLeft(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, revealed]);

  /* ── Auto-advance ────────────────────────────────────────── */
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

  const timerPct = revealed ? 0 : (timeLeft / TIMER_SECONDS) * 100;

  return (
    <div ref={overlayRef} className={styles.overlay} data-theme={theme}>

      {/* ── Header: close | logo (centered) | counter + fs ── */}
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={handleClose} title="Exit presentation">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        <div className={styles.logo}>
          <div className={styles.logoDot} />
          <span className={styles.logoText}>
            neo<span className={styles.logoAccent}>Courses</span>
          </span>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.qCounter}>{idx + 1} / {questions.length}</span>
          <button
            className={styles.fsBtn}
            onClick={toggleFS}
            title={isFS ? `Exit fullscreen (${fsKey})` : `Fullscreen (${fsKey})`}
          >
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
        </div>
      </div>

      {/* ── Image ──────────────────────────────────────────── */}
      <div className={styles.imageWrap}>
        {!imgFailed && imgSrc ? (
          <img src={imgSrc} alt="" className={styles.image} onError={() => setImgFailed(true)} />
        ) : (
          <div className={styles.imageFallback}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <rect x="4" y="9" width="36" height="26" rx="3" stroke="currentColor" strokeWidth="2"/>
              <circle cx="15" cy="19" r="4" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 31l13-10 7 6 6-5 14 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
        <div className={styles.imageScrim} />
        <div className={styles.chapterBadge}>{chapterName}</div>
      </div>

      {/* ── Fuse timer (between image and question) ─────────── */}
      <div className={styles.fuseWrap}>
        <div className={styles.fuseTrack}>
          <div
            className={`${styles.fuseBar} ${revealed ? styles.fuseBarDone : ''}`}
            style={{ width: `${timerPct}%` }}
          >
            {!revealed && <div className={styles.fuseTip} />}
          </div>
        </div>
        <span className={styles.fuseCount}>
          {revealed ? '✓' : `${timeLeft}s`}
        </span>
      </div>

      {/* ── Question ───────────────────────────────────────── */}
      <div className={styles.questionWrap}>
        <p className={styles.questionText}>{q.question}</p>
      </div>

      {/* ── Options 2 × 2 ──────────────────────────────────── */}
      <div className={styles.optionsGrid}>
        {q.options.map((opt, oi) => {
          const isCorrect = oi === q.correctIndex;
          return (
            <div
              key={oi}
              className={`${styles.option}
                ${revealed && isCorrect  ? styles.optionCorrect : ''}
                ${revealed && !isCorrect ? styles.optionDim     : ''}`}
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
        <span className={styles.fsHint}>{fsKey} — fullscreen</span>
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
