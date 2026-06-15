import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type {
  StartPairingResponse,
  DevicePairedEvent,
  CourseUploadReceivedEvent,
  UploadStatus,
} from '@courseneo/shared';
import { PAIRING_EVENTS } from '@courseneo/shared';
import { SavedCourse, AppError } from '../../lib/types';
import { useCourseStore } from '../../store/useCourseStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { startPairing, stopPairing, syncPairingCourses, generateOutlineDirect, generateFakeOutline } from '../../lib/modelClient';
import { StatusMessage } from '../StatusMessage/StatusMessage';
import styles from './DevicePairingPanel.module.css';

type Phase = 'idle' | 'starting' | 'waiting' | 'paired';

type UploadRow = {
  courseId: string;
  title: string;
  status: UploadStatus;
};

export function DevicePairingPanel() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [pairing, setPairing] = useState<StartPairingResponse | null>(null);
  const [requirePin, setRequirePin] = useState(false);
  const [useTunnel, setUseTunnel] = useState(false);
  const [device, setDevice] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [error, setError] = useState<AppError | null>(null);

  // Published courses, pushed to the pairing server so the phone can browse them.
  const courses = useCourseStore(s => s.courses);

  // Track whether a server is live so we can tear it down on unmount.
  const serverLive = useRef(false);

  // Keep the desktop server's course list in sync while pairing is active.
  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'paired') return;
    const published = courses
      .filter(c => c.published)
      .map(c => ({ id: c.id, topic: c.topic, level: c.level, outline: c.outline }));
    void syncPairingCourses(published);
  }, [phase, courses]);

  const handleUpload = useCallback(async (ev: CourseUploadReceivedEvent) => {
    setUploads(prev => [{ courseId: ev.courseId, title: ev.title, status: 'generating' }, ...prev]);

    const settings = useSettingsStore.getState().settings;
    const addCourse = useCourseStore.getState().addCourse;

    const topic = ev.title.trim() || 'Untitled course';
    const goal =
      ev.brief?.trim() ||
      (ev.fileName ? `Course generated from uploaded file: ${ev.fileName}` : 'Course generated from a mobile upload');
    const audience = 'General audience';
    const level: SavedCourse['level'] = 'beginner';

    const result = settings.apiKey
      ? await generateOutlineDirect(topic, audience, level, goal, settings)
      : await generateFakeOutline(topic, audience, level, goal);

    if (result.ok) {
      const now = new Date().toISOString();
      addCourse({
        id: ev.courseId,
        schemaVersion: 1,
        topic,
        audience,
        level,
        goal,
        outline: result.outline,
        published: false,
        createdAt: now,
        updatedAt: now,
        projectId: null,
        tags: [],
      });
      setUploads(prev => prev.map(u => (u.courseId === ev.courseId ? { ...u, status: 'draft_ready' } : u)));
    } else {
      setError(result.error);
      setUploads(prev => prev.map(u => (u.courseId === ev.courseId ? { ...u, status: 'failed' } : u)));
    }
  }, []);

  // Subscribe to the desktop server's lifecycle events for the panel's lifetime.
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let cancelled = false;

    (async () => {
      const subs = await Promise.all([
        listen<DevicePairedEvent>(PAIRING_EVENTS.devicePaired, e => {
          setDevice(e.payload.device);
          setPhase('paired');
        }),
        listen<CourseUploadReceivedEvent>(PAIRING_EVENTS.courseUploadReceived, e => {
          void handleUpload(e.payload);
        }),
        listen(PAIRING_EVENTS.pairingExpired, () => {
          setPhase(p => (p === 'paired' ? p : 'idle'));
          setPairing(null);
          serverLive.current = false;
        }),
        listen(PAIRING_EVENTS.pairingClosed, () => {
          serverLive.current = false;
        }),
      ]);
      if (cancelled) subs.forEach(u => u());
      else unlisteners.push(...subs);
    })();

    return () => {
      cancelled = true;
      unlisteners.forEach(u => u());
      if (serverLive.current) void stopPairing();
      serverLive.current = false;
    };
  }, [handleUpload]);

  async function handleStart() {
    setError(null);
    setPhase('starting');
    const result = await startPairing(requirePin, useTunnel);
    if (result.ok) {
      setPairing(result.pairing);
      serverLive.current = true;
      setPhase('waiting');
      setDevice(null);
    } else {
      setError(result.error);
      setPhase('idle');
    }
  }

  async function handleStop() {
    await stopPairing();
    serverLive.current = false;
    setPairing(null);
    setDevice(null);
    setPhase('idle');
  }

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <h3 className={styles.sectionTitle}>Connect a device</h3>
        <p className={styles.lead}>
          Pair your phone with the <span className={styles.brand}>course<span className={styles.brandAccent}>neo</span></span> app
          to push a file or brief straight onto this desktop as a draft course. Both devices must be on the same
          network. The pairing code is only active while this panel is open.
        </p>
      </div>

      {phase === 'idle' && (
        <div className={styles.startCol}>
          <label className={styles.pinToggle}>
            <input
              type="checkbox"
              checked={useTunnel}
              onChange={e => setUseTunnel(e.target.checked)}
            />
            <span>Connect over the internet (tunnel) — use when the phone isn't on the same Wi-Fi</span>
          </label>
          <div className={styles.startRow}>
            <label className={styles.pinToggle}>
              <input
                type="checkbox"
                checked={requirePin}
                onChange={e => setRequirePin(e.target.checked)}
              />
              <span>Require a PIN to pair</span>
            </label>
            <button className={styles.startBtn} onClick={handleStart}>
              Start pairing
            </button>
          </div>
        </div>
      )}

      {phase === 'starting' && (
        <p className={styles.lead}>
          {useTunnel ? 'Establishing a secure tunnel… this can take 10–20 seconds.' : 'Starting local server…'}
        </p>
      )}

      {(phase === 'waiting' || phase === 'paired') && pairing && (
        <div className={styles.liveCol}>
          {/* Step 1 — load the app on the phone via Expo Go */}
          <div className={styles.step}>
            <span className={styles.stepLabel}>
              <span className={styles.stepNum}>1</span> Open the courseneo app on your phone
            </span>
            <div className={styles.live}>
              {pairing.expoQrSvg && (
                <div className={styles.qrFrame} dangerouslySetInnerHTML={{ __html: pairing.expoQrSvg }} />
              )}
              <div className={styles.infoCol}>
                <p className={styles.hint}>
                  In <strong>Expo Go</strong>, tap “Enter URL manually”{pairing.expoQrSvg ? ' (or scan this code)' : ''} and use:
                </p>
                <code className={styles.urlText}>{pairing.expoUrl ?? `exp://${pairing.host}:8081`}</code>
                <p className={styles.hint}>
                  This loads the app. Make sure the Expo dev server (<code className={styles.urlInline}>npm run start</code>)
                  is running on this network.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 — pair inside the app */}
          <div className={styles.step}>
            <span className={styles.stepLabel}>
              <span className={styles.stepNum}>2</span> Pair inside the courseneo app
            </span>
            <div className={styles.live}>
              <div className={styles.qrCol}>
                <div className={styles.qrFrame} dangerouslySetInnerHTML={{ __html: pairing.qrSvg }} />
                {pairing.pin && (
                  <div className={styles.pinBox}>
                    <span className={styles.pinLabel}>PIN</span>
                    <span className={styles.pinValue}>{pairing.pin}</span>
                  </div>
                )}
              </div>

              <div className={styles.infoCol}>
                <div className={`${styles.status} ${phase === 'paired' ? styles.statusOk : ''}`}>
                  <span className={styles.statusDot} />
                  {phase === 'paired' ? `Connected: ${device ?? 'device'}` : 'Waiting for a device to scan…'}
                </div>
                <dl className={styles.meta}>
                  <div><dt>Mode</dt><dd>{pairing.url ? 'Internet tunnel' : 'Local network'}</dd></div>
                  <div><dt>Address</dt><dd>{pairing.url ?? `${pairing.host}:${pairing.port}`}</dd></div>
                  <div><dt>Desktop</dt><dd>{pairing.name ?? 'courseneo'}</dd></div>
                </dl>
                <p className={styles.hint}>
                  Inside the courseneo app, scan this code with its camera{pairing.pin ? ' and enter the PIN' : ''}.
                  Not in Expo Go — this code pairs the app to this desktop.
                </p>
                <button className={styles.stopBtn} onClick={handleStop}>Stop pairing</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorBox} role="alert">
          <span>{error.message}</span>
          {error.detail && error.detail !== error.message && (
            <span className={styles.errorDetail}>{error.detail}</span>
          )}
        </div>
      )}

      {uploads.length > 0 && (
        <div className={styles.uploads}>
          <h4 className={styles.uploadsTitle}>Received from device</h4>
          <ul className={styles.uploadList}>
            {uploads.map(u => (
              <li key={u.courseId} className={styles.uploadRow}>
                <span className={styles.uploadName}>{u.title}</span>
                <span className={`${styles.uploadStatus} ${styles[`st_${u.status}`] ?? ''}`}>
                  {u.status === 'generating' && 'Generating…'}
                  {u.status === 'draft_ready' && 'Draft ready'}
                  {u.status === 'failed' && 'Failed'}
                  {u.status === 'received' && 'Received'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
