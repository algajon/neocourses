import { useEffect } from 'react';
import { SavedCourse } from '../../lib/types';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { UI } from '../../lib/strings';
import styles from './OutlineEditor.module.css';

type Props = {
  course: SavedCourse;
  onSave: (outline: string) => void;
  onExport: (outline: string) => void;
};

export function OutlineEditor({ course, onSave, onExport }: Props) {
  const { currentValue, setCurrentValue, isDirty, markSaved, reset } = useUnsavedChanges(course.outline);

  useEffect(() => {
    reset(course.outline);
  }, [course.id, course.outline]);

  function handleSave() {
    onSave(currentValue);
    markSaved(currentValue);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(currentValue);
    } catch {
      // fallback — do nothing visible
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{course.topic}</h2>
          {isDirty && (
            <span className={styles.unsavedDot} title={UI.EDITOR_UNSAVED_INDICATOR} aria-label={UI.EDITOR_UNSAVED_INDICATOR} />
          )}
        </div>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={handleCopy} type="button" aria-label={UI.EDITOR_COPY_BUTTON}>
            {UI.EDITOR_COPY_BUTTON}
          </button>
          <button className={styles.btn} onClick={handleSave} type="button" disabled={!isDirty}>
            {UI.EDITOR_SAVE_BUTTON}
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => onExport(currentValue)}
            type="button"
          >
            {UI.EDITOR_EXPORT_BUTTON}
          </button>
        </div>
      </div>

      <textarea
        className={styles.editor}
        value={currentValue}
        onChange={e => setCurrentValue(e.target.value)}
        spellCheck={false}
        aria-label="Course outline editor"
      />
    </div>
  );
}
