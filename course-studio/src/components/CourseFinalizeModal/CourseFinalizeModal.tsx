import { useEffect, useRef, useState } from 'react';
import { SavedCourse } from '../../lib/types';
import { useCourseStore } from '../../store/useCourseStore';
import { useQuizStore } from '../../store/useQuizStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { finalizeCourse, FinalizeProgress } from '../../lib/finalizeCourse';
import { UI } from '../../lib/strings';
import styles from './CourseFinalizeModal.module.css';

type Props = {
  course: SavedCourse;
  onPublished: () => void;
  onCancel: () => void;
};

export function CourseFinalizeModal({ course, onPublished, onCancel }: Props) {
  const cancelledRef = useRef(false);
  const [progress, setProgress] = useState<FinalizeProgress>({ done: 0, total: 1, label: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const settings = useSettingsStore.getState().settings;
        const { lessons, quizzes } = await finalizeCourse(
          course,
          settings,
          p => { if (active) setProgress(p); },
          () => cancelledRef.current,
        );

        if (cancelledRef.current) { onCancel(); return; }

        useCourseStore.getState().updateCourse(course.id, {
          generated: { lessons, generatedAt: new Date().toISOString() },
          published: true,
        });
        for (const [chapter, questions] of Object.entries(quizzes)) {
          useQuizStore.getState().saveQuiz(course.id, chapter, questions);
        }
        onPublished();
      } catch {
        if (!active) return;
        setError(UI.FINALIZE_ERROR);
        setTimeout(onCancel, 1500);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCancel() {
    cancelledRef.current = true;
    onCancel();
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <span className={styles.wordmark}>course<span className={styles.accent}>neo</span></span>
        <h2 className={styles.title}>{UI.FINALIZE_TITLE_PREFIX} “{course.topic}”</h2>
        <p className={styles.subtitle}>{UI.FINALIZE_SUBTITLE}</p>

        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>

        <div className={styles.statusRow}>
          <span className={styles.label}>{error ?? progress.label}</span>
          <span className={styles.step}>{progress.done} / {progress.total}</span>
        </div>

        {!error && (
          <button className={styles.cancelBtn} onClick={handleCancel}>
            {UI.FINALIZE_CANCEL}
          </button>
        )}
      </div>
    </div>
  );
}
