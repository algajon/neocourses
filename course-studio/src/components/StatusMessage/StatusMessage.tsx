import { AppError } from '../../lib/types';
import styles from './StatusMessage.module.css';

type Props = {
  error?: AppError | null;
  success?: string | null;
};

export function StatusMessage({ error, success }: Props) {
  if (error) {
    return (
      <div className={styles.error} role="alert">
        {error.message}
      </div>
    );
  }
  if (success) {
    return (
      <div className={styles.success} role="status">
        {success}
      </div>
    );
  }
  return null;
}
