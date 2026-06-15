import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { QuizQuestion } from '../../lib/contentGenerator';
import styles from './QuizPresentationMode.module.css';

const TIMER_SECONDS = 15;
const REVEAL_HOLD   = 3;
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

interface Props {
  questions: QuizQuestion[];
  chapterName: string;
  onClose: () => void;
}

type Subject =
  | 'frontend' | 'code' | 'data' | 'cloud' | 'ai'
  | 'security' | 'api' | 'mobile' | 'gaming' | 'business' | 'science' | 'learning';

// Classify the chapter (with the question as a secondary hint) into a subject.
// Stock photos from keyword services were hopelessly unreliable — a question
// containing the word "takeaway" returned a fish-and-chips shop. Instead we map
// to a fixed subject and render a branded, always-relevant key visual.
function subjectOf(chapter: string, question: string): Subject {
  const l = `${chapter} ${question}`.toLowerCase();
  if (/\b(react|vue|angular|svelte|frontend|front-end|ui|ux|css|html|component|jsx|dom)\b/.test(l)) return 'frontend';
  if (/\b(security|crypto|encryption|auth|jwt|oauth|password|privacy|vulnerab)\b/.test(l)) return 'security';
  if (/\b(ai|artificial|intelligence|machine|learning|neural|llm|gpt|model|prompt)\b/.test(l)) return 'ai';
  if (/\b(aws|azure|gcp|cloud|docker|kubernetes|devops|deploy|infrastructure|container|pod|cluster)\b/.test(l)) return 'cloud';
  if (/\b(database|sql|data|mongodb|postgres|redis|analytics|query|schema)\b/.test(l)) return 'data';
  if (/\b(api|rest|graphql|endpoint|http|network|protocol|socket|backend|service)\b/.test(l)) return 'api';
  if (/\b(mobile|ios|android|flutter|swift|kotlin|native)\b/.test(l)) return 'mobile';
  if (/\b(game|gaming|3d|graphics|unity|unreal|render|canvas|webgl|shader)\b/.test(l)) return 'gaming';
  if (/\b(business|marketing|sales|finance|strategy|management|product|team)\b/.test(l)) return 'business';
  if (/\b(science|physics|chemistry|biology|research|laboratory|experiment)\b/.test(l)) return 'science';
  if (/\b(python|javascript|typescript|node|java|rust|go|ruby|php|code|programming|function|class|algorithm)\b/.test(l)) return 'code';
  return 'learning';
}

// SVG path geometry (viewBox 0 0 24 24) for each subject's icon.
const SUBJECT_ICON: Record<Subject, string> = {
  frontend: 'M3 4h18v14H3zM3 8h18M8 21h8M12 18v3',
  code:     'M9 8l-4 4 4 4M15 8l4 4-4 4',
  data:     'M12 3c4 0 7 1.3 7 3v12c0 1.7-3 3-7 3s-7-1.3-7-3V6c0-1.7 3-3 7-3zM5 6c0 1.7 3 3 7 3s7-1.3 7-3M5 12c0 1.7 3 3 7 3s7-1.3 7-3',
  cloud:    'M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 18 18zM9 13l3-3 3 3M12 10v7',
  ai:       'M12 3a4 4 0 0 1 4 4 4 4 0 0 1-1 8 4 4 0 0 1-3 2 4 4 0 0 1-3-2 4 4 0 0 1-1-8 4 4 0 0 1 4-4zM12 7v10M8 11h8',
  security: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4',
  api:      'M4 12h4M16 12h4M9 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0zM12 3v4M12 17v4',
  mobile:   'M7 3h10v18H7zM10 18h4',
  gaming:   'M7 8h10a4 4 0 0 1 4 4 4 4 0 0 1-7 3h-4a4 4 0 0 1-7-3 4 4 0 0 1 4-4zM7 11v3M5.5 12.5h3M15 12h.01M17 14h.01',
  business: 'M3 20h18M5 20V9l5-4 4 3v12M14 20v-7h5v7',
  science:  'M9 3v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V3M9 3h6M7.5 14h9',
  learning: 'M12 4L2 9l10 5 10-5zM6 11v5c0 1 3 3 6 3s6-2 6-3v-5',
};

// Stable gradient pair per chapter title (deterministic, no network).
// Shown as the panel background while the photo loads, and behind the SVG
// fallback if the photo fails.
const SUBJECT_GRADIENT: Record<Subject, [string, string]> = {
  frontend: ['#0ea5e9', '#6366f1'],
  code:     ['#1e293b', '#0ea5e9'],
  data:     ['#0891b2', '#0ea5e9'],
  cloud:    ['#2563eb', '#22d3ee'],
  ai:       ['#7c3aed', '#ec4899'],
  security: ['#b45309', '#dc2626'],
  api:      ['#0d9488', '#10b981'],
  mobile:   ['#4f46e5', '#0ea5e9'],
  gaming:   ['#db2777', '#7c3aed'],
  business: ['#ca8a04', '#16a34a'],
  science:  ['#0f766e', '#14b8a6'],
  learning: ['#a3b300', '#10b981'],
};

// Hand-picked, always-relevant stock photos per subject. Curation (rather
// than keyword search) is deliberate: keyword services matched literal words
// and once returned a fish-and-chips shop for the word "takeaway". Every URL
// here was verified to load and to match its subject.
const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=70`;

// Several verified photos per subject so each question shows a different —
// but still on-topic — image. Picked by question index (see imageFor).
const SUBJECT_IMAGES: Record<Subject, string[]> = {
  code:     ['1461749280684-dccba630e2f6', '1487058792275-0ad4aaf24ca7', '1498050108023-c5249f4df085', '1517180102446-f3ece451e9d8', '1555066931-4365d14bab8c'],
  frontend: ['1507238691740-187a5b1d37b8', '1547658719-da2b51169166', '1481487196290-c152efe083f5', '1467232004584-a241de8bcf5d'],
  data:     ['1551288049-bebda4e38f71', '1460925895917-afdab827c52f', '1543286386-2e659306cd6c', '1518186285589-2f7649de83e0'],
  cloud:    ['1544197150-b99a580bb7a8', '1451187580459-43490279c0fa', '1558494949-ef010cbdcc31', '1484557052118-f32bd25b45b5'],
  ai:       ['1620712943543-bcc4688e7485', '1677442136019-21780ecad995', '1518770660439-4636190af475', '1526374965328-7f61d4dc18c5'],
  security: ['1555949963-aa79dcee981c', '1510511459019-5dda7724fd87', '1563013544-824ae1b704d3', '1633265486064-086b219458ec'],
  api:      ['1558494949-ef010cbdcc31', '1451187580459-43490279c0fa', '1614064641938-3bbee52942c7'],
  mobile:   ['1512941937669-90a1b58e7e9c', '1551650975-87deedd944c3', '1529653762956-b0a27278529c'],
  gaming:   ['1542751371-adc38448a05e', '1538481199705-c710c4e965fc', '1511512578047-dfb367046420'],
  business: ['1556761175-5973dc0f32e7', '1454165804606-c3d57bc86b40', '1497032628192-86f99bcd76bc'],
  science:  ['1532094349884-543bc11b234d', '1554475901-4538ddfbccc2', '1576086213369-97a306d36557'],
  learning: ['1503676260728-1c00da094a0b', '1456513080510-7bf3a84b82f8', '1524995997946-a1c2e315a42f'],
};

function imageFor(subject: Subject, idx: number): string {
  const pool = SUBJECT_IMAGES[subject];
  return UNSPLASH(pool[idx % pool.length]);
}

export function QuizPresentationMode({ questions, chapterName, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx]             = useState(0);
  const [timeLeft, setTimeLeft]   = useState(TIMER_SECONDS);
  const [revealed, setRevealed]   = useState(false);
  const [holdLeft, setHoldLeft]   = useState(0);
  const [failedImg, setFailedImg] = useState<Set<number>>(new Set());
  const [controlsVisible, setControlsVisible] = useState(true);

  // Per-question subject (used for the photo, gradient + fallback icon)
  const subjects = useMemo(
    () => questions.map(qq => subjectOf(chapterName, qq.question)),
    [questions, chapterName]
  );

  const theme = document.documentElement.dataset.theme ?? 'white';
  const q     = questions[idx];

  /* ── Fullscreen: enter on mount, exit on unmount ─────────── */
  const exitFS = useCallback(async () => {
    await invoke('set_fullscreen', { fullscreen: false });
    // Nudge WKWebView to recompute layout against the restored window size.
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }, []);

  useEffect(() => {
    invoke('set_fullscreen', { fullscreen: true });
    return () => { invoke('set_fullscreen', { fullscreen: false }); };
  }, []);

  /* ── Esc always exits ────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Reveal controls on mouse activity, hide when idle ───── */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setControlsVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setControlsVisible(false), 2200);
    };
    window.addEventListener('mousemove', wake);
    wake();
    return () => { window.removeEventListener('mousemove', wake); clearTimeout(timer); };
  }, []);

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
    // Loop forever: after the last question, wrap back to the first.
    // The presentation only ends when the user explicitly closes it.
    setIdx(i => (i < questions.length - 1 ? i + 1 : 0));
    setTimeLeft(TIMER_SECONDS);
    setRevealed(false);
    setHoldLeft(0);
  }

  function handleClose() { exitFS(); onClose(); }

  function handleSkip() {
    if (!revealed) { setRevealed(true); setHoldLeft(REVEAL_HOLD); }
    else advance();
  }

  const timerPct = revealed ? 0 : (timeLeft / TIMER_SECONDS) * 100;

  return createPortal(
    <div ref={overlayRef} className={styles.overlay} data-theme={theme}>

      {/* ── Header: close (hover) | logo (centered) | counter ── */}
      <div className={styles.header}>
        <button
          className={`${styles.closeBtn} ${controlsVisible ? '' : styles.controlHidden}`}
          onClick={handleClose}
          title="Exit presentation"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        <div className={styles.logo}>
          <div className={styles.logoDot} />
          <span className={styles.logoText}>
            course<span className={styles.logoAccent}>neo</span>
          </span>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.qCounter}>{idx + 1} / {questions.length}</span>
        </div>
      </div>

      {/* ── Content area: scrollable middle section ────────────────────────────────────────────── */}
      <div className={styles.contentArea}>
        {/* ── Relevant photo (curated per subject) with SVG fallback ── */}
        <div
          className={styles.imageWrap}
          style={{
            background: `linear-gradient(135deg, ${SUBJECT_GRADIENT[subjects[idx]][0]}, ${SUBJECT_GRADIENT[subjects[idx]][1]})`,
          }}
        >
          {!failedImg.has(idx) ? (
            <img
              key={idx}
              src={imageFor(subjects[idx], idx)}
              alt=""
              className={styles.image}
              decoding="async"
              fetchPriority="high"
              onError={() => setFailedImg(prev => new Set(prev).add(idx))}
            />
          ) : (
            <svg
              key={idx}
              className={styles.keyVisual}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d={SUBJECT_ICON[subjects[idx]]}
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <div className={styles.imageScrim} />
          <div className={styles.chapterBadge}>{chapterName}</div>
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
      </div>

      {/* ── Fuse timer (fixed at bottom, above footer) ─────────── */}
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

      {/* ── Footer: reveal/skip control (shown on mouse activity) ── */}
      <div className={styles.footer}>
        <span className={`${styles.escHint} ${controlsVisible ? '' : styles.controlHidden}`}>
          Press Esc to exit
        </span>
        <button
          className={`${styles.skipBtn} ${controlsVisible ? '' : styles.controlHidden}`}
          onClick={handleSkip}
        >
          {revealed ? 'Next →' : 'Reveal & skip'}
        </button>
      </div>
    </div>,
    document.body
  );
}
