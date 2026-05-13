import { SavedCourse } from '../../lib/types';
import { UI } from '../../lib/strings';
import styles from './SavedCourseList.module.css';

type Props = {
  courses: SavedCourse[];
  activeCourseId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

export function SavedCourseList({ courses, activeCourseId, onSelect, onDelete }: Props) {
  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (window.confirm(UI.CONFIRM_DELETE)) {
      onDelete(id);
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{UI.SAVED_COURSES_TITLE}</h2>
      {courses.length === 0 ? (
        <p className={styles.empty}>{UI.SAVED_COURSES_EMPTY}</p>
      ) : (
        <ul className={styles.list} role="list">
          {courses.map(course => (
            <li
              key={course.id}
              className={`${styles.item} ${course.id === activeCourseId ? styles.active : ''}`}
              onClick={() => onSelect(course.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onSelect(course.id)}
              aria-current={course.id === activeCourseId ? 'true' : undefined}
            >
              <div className={styles.itemContent}>
                <span className={styles.topic}>{course.topic}</span>
                <span className={styles.level}>{course.level}</span>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={e => handleDelete(e, course.id)}
                aria-label={`Delete ${course.topic}`}
                tabIndex={0}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
