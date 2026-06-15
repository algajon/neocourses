import { useState } from 'react';
import { SavedCourse, AppError } from '../../lib/types';
import { UserSession } from '../../lib/types';
import { useCourseStore } from '../../store/useCourseStore';
import { OutlineEditor } from '../../components/OutlineEditor/OutlineEditor';
import { SavedCourseList } from '../../components/SavedCourseList/SavedCourseList';
import { StatusMessage } from '../../components/StatusMessage/StatusMessage';
import { ImportPanel, ImportedFile } from '../../components/ImportPanel/ImportPanel';
import { generateFakeOutline, generateOutlineDirect, exportMarkdown } from '../../lib/modelClient';
import { useSettingsStore } from '../../store/useSettingsStore';
import { UI } from '../../lib/strings';
import styles from './EditorDashboard.module.css';

let idSeq = 0;
function newId() {
  return `${Date.now()}-${++idSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

type PendingOutline = {
  outline: string;
  topic: string;
  audience: string;
  level: string;
  goal: string;
};

type Props = {
  session: UserSession;
  onRequestPublish: (courseId: string) => void;
};

export function EditorDashboard({ onRequestPublish }: Props) {
  const { courses, activeCourseId, addCourse, updateCourse, deleteCourse, setActiveCourse } =
    useCourseStore();
  const settings = useSettingsStore(s => s.settings);

  const [statusError, setStatusError] = useState<AppError | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [pendingOutline, setPendingOutline] = useState<PendingOutline | null>(null);
  const [importGenerating, setImportGenerating] = useState(false);

  const activeCourse = courses.find(c => c.id === activeCourseId) ?? null;

  function clearStatus() {
    setStatusError(null);
    setStatusSuccess(null);
  }

  function handleSavePending() {
    if (!pendingOutline) return;
    const { outline, topic, audience, level, goal } = pendingOutline;
    const now = new Date().toISOString();
    const course: SavedCourse = {
      id: newId(),
      schemaVersion: 1,
      topic,
      audience,
      level: level as SavedCourse['level'],
      goal,
      outline,
      published: false,
      createdAt: now,
      updatedAt: now,
      projectId: null,
      tags: [],
    };
    addCourse(course);
    setActiveCourse(course.id);
    setPendingOutline(null);
    setStatusSuccess('Course saved as draft.');
  }

  function handleSaveCourse(outline: string) {
    if (!activeCourseId) return;
    updateCourse(activeCourseId, { outline });
    setStatusSuccess('Changes saved.');
  }

  async function handleExport(outline: string) {
    if (!activeCourse) return;
    clearStatus();
    const result = await exportMarkdown(activeCourse.topic, outline);
    if (result.ok) setStatusSuccess(`Exported to: ${result.path}`);
    else setStatusError(result.error);
  }

  function handlePublishToggle(courseId: string) {
    onRequestPublish(courseId);
  }

  async function handleImportGenerate(files: ImportedFile[], audience: string, level: string) {
    if (files.length === 0) return;
    setImportGenerating(true);
    clearStatus();

    const topic = files
      .map(f => f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
      .join(' + ');

    const goal = `Comprehensive course generated from ${files.length} source file${files.length !== 1 ? 's' : ''}: ${files.map(f => f.name).join(', ')}`;

    const useRealModel = Boolean(settings.apiKey);
    const result = useRealModel
      ? await generateOutlineDirect(topic, audience, level, goal, settings)
      : await generateFakeOutline(topic, audience, level, goal);
    setImportGenerating(false);

    if (result.ok) {
      setPendingOutline({ outline: result.outline, topic, audience, level, goal });
      setStatusSuccess(`Course outline generated from ${files.length} file${files.length !== 1 ? 's' : ''}. Review and save below.`);
    } else {
      setStatusError(result.error);
    }
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <SavedCourseList
          courses={courses}
          activeCourseId={activeCourseId}
          onSelect={id => { setActiveCourse(id); setPendingOutline(null); clearStatus(); }}
          onDelete={deleteCourse}
        />
      </aside>

      <main className={styles.main}>
        <ImportPanel onGenerate={handleImportGenerate} isGenerating={importGenerating} />
        <StatusMessage error={statusError} success={statusSuccess} />

        {pendingOutline && pendingOutline.outline && (
          <div className={styles.pendingOutline}>
            <div className={styles.pendingToolbar}>
              <span className={styles.pendingLabel}>Generated: {pendingOutline.topic}</span>
              <button className={styles.saveBtn} onClick={handleSavePending}>
                {UI.EDITOR_SAVE_BUTTON}
              </button>
            </div>
            <pre className={styles.pendingPre}>{pendingOutline.outline}</pre>
          </div>
        )}

        {activeCourse && !pendingOutline && (
          <div className={styles.editorWrapper}>
            <div className={styles.publishRow}>
              <span className={activeCourse.published ? styles.publishedBadge : styles.draftBadge}>
                {activeCourse.published ? '● Published' : '○ Draft'}
              </span>
              <button
                className={styles.publishBtn}
                onClick={() => handlePublishToggle(activeCourse.id)}
              >
                {activeCourse.published ? UI.EDITOR_UNPUBLISH_BUTTON : UI.EDITOR_PUBLISH_BUTTON}
              </button>
            </div>
            <OutlineEditor
              course={activeCourse}
              onSave={handleSaveCourse}
              onExport={handleExport}
            />
          </div>
        )}
      </main>
    </div>
  );
}
