import { useState } from 'react';
import { CourseLevel } from '../../lib/types';
import { UI } from '../../lib/strings';
import styles from './CourseBriefForm.module.css';

export type CourseBrief = {
  topic: string;
  audience: string;
  level: CourseLevel;
  goal: string;
};

type Props = {
  onGenerateFake: (brief: CourseBrief) => void;
  onGenerateModel: (brief: CourseBrief) => void;
  isGenerating: boolean;
  hasModelSettings: boolean;
};

export function CourseBriefForm({ onGenerateFake, onGenerateModel, isGenerating, hasModelSettings }: Props) {
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [level, setLevel] = useState<CourseLevel>('beginner');
  const [goal, setGoal] = useState('');
  const [errors, setErrors] = useState<Partial<CourseBrief>>({});

  function validate(): boolean {
    const e: Partial<CourseBrief> = {};
    if (!topic.trim()) e.topic = 'Required';
    if (!audience.trim()) e.audience = 'Required';
    if (!goal.trim()) e.goal = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const brief = (): CourseBrief => ({ topic: topic.trim(), audience: audience.trim(), level, goal: goal.trim() });

  function handleFake(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onGenerateFake(brief());
  }

  function handleModel(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onGenerateModel(brief());
  }

  return (
    <form className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="topic" className={styles.label}>{UI.FORM_TOPIC_LABEL}</label>
        <input
          id="topic"
          type="text"
          className={styles.input}
          value={topic}
          onChange={e => setTopic(e.target.value)}
          aria-describedby={errors.topic ? 'topic-error' : undefined}
          aria-invalid={!!errors.topic}
        />
        {errors.topic && <span id="topic-error" className={styles.fieldError} role="alert">{errors.topic}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="audience" className={styles.label}>{UI.FORM_AUDIENCE_LABEL}</label>
        <input
          id="audience"
          type="text"
          className={styles.input}
          value={audience}
          onChange={e => setAudience(e.target.value)}
          aria-describedby={errors.audience ? 'audience-error' : undefined}
          aria-invalid={!!errors.audience}
        />
        {errors.audience && <span id="audience-error" className={styles.fieldError} role="alert">{errors.audience}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="level" className={styles.label}>{UI.FORM_LEVEL_LABEL}</label>
        <select
          id="level"
          className={styles.select}
          value={level}
          onChange={e => setLevel(e.target.value as CourseLevel)}
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="goal" className={styles.label}>{UI.FORM_GOAL_LABEL}</label>
        <textarea
          id="goal"
          className={styles.textarea}
          value={goal}
          onChange={e => setGoal(e.target.value)}
          rows={3}
          aria-describedby={errors.goal ? 'goal-error' : undefined}
          aria-invalid={!!errors.goal}
        />
        {errors.goal && <span id="goal-error" className={styles.fieldError} role="alert">{errors.goal}</span>}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleFake}
          disabled={isGenerating}
        >
          {UI.FORM_GENERATE_FAKE_BUTTON}
        </button>
        <button
          type="submit"
          className={styles.btnPrimary}
          onClick={handleModel}
          disabled={isGenerating || !hasModelSettings}
          title={!hasModelSettings ? 'Configure model settings first' : undefined}
        >
          {UI.FORM_GENERATE_MODEL_BUTTON}
        </button>
      </div>
    </form>
  );
}
