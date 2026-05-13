import { UI } from '../../lib/strings';
import styles from './JobProgressBar.module.css';

type Props = {
  label: string;
  progress: number;
  onCancel?: () => void;
};

export function JobProgressBar({ label, progress, onCancel }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {onCancel && (
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            aria-label={UI.CANCEL_JOB}
          >
            {UI.CANCEL_JOB}
          </button>
        )}
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.fill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
