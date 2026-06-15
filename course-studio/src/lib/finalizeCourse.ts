import { parseOutlineModules } from '@courseneo/shared';
import { SavedCourse, ModelSettings } from './types';
import {
  LessonContent,
  QuizQuestion,
  generateLessonContent,
  generateChapterQuiz,
  cleanForProse,
} from './contentGenerator';
import { generateLessonContentAI, generateChapterQuizAI } from './modelClient';

export type FinalizeProgress = { done: number; total: number; label: string };

export type FinalizeResult = {
  lessons: Record<string, LessonContent>;
  quizzes: Record<string, QuizQuestion[]>;
};

// Plain-text digest of a chapter's lesson content, used to ground the AI quiz.
function buildChapterContent(lessons: string[], contents: Map<string, LessonContent>): string {
  return lessons
    .map(title => {
      const c = contents.get(title);
      if (!c) return `## Lesson: ${title}`;
      const concepts = c.concepts.map(x => `- ${x.title}: ${x.body}`).join('\n');
      const keyPoints = (c.keyPoints ?? []).map(k => `- ${k}`).join('\n');
      return [
        `## Lesson: ${title}`,
        c.intro,
        `Concepts:\n${concepts}`,
        keyPoints ? `Key points:\n${keyPoints}` : '',
        c.example ? `Example: ${c.example}` : '',
        `Tip: ${c.tip}`,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

// Pre-generate and return every lesson's content and every chapter's quiz.
// Resilient by design: any AI failure falls back to the instant template, so a
// single failure can never block publish or hang the finalize.
export async function finalizeCourse(
  course: SavedCourse,
  settings: ModelSettings,
  onProgress: (p: FinalizeProgress) => void,
  isCancelled: () => boolean,
): Promise<FinalizeResult> {
  const mods = parseOutlineModules(course.outline);
  const total = mods.reduce((sum, m) => sum + m.lessons.length, 0) + mods.length;
  const topic = cleanForProse(course.topic);
  const useAI = Boolean(settings.apiKey);

  const lessons: Record<string, LessonContent> = {};
  const lessonMap = new Map<string, LessonContent>();
  const quizzes: Record<string, QuizQuestion[]> = {};
  let done = 0;

  // Pass 1 — lessons
  for (const m of mods) {
    for (const title of m.lessons) {
      if (isCancelled()) return { lessons, quizzes };
      onProgress({ done, total, label: `Lesson: ${title}` });
      let content: LessonContent;
      try {
        if (useAI) {
          const r = await generateLessonContentAI(title, m.module, course.topic, settings);
          content = r.ok ? r.content : generateLessonContent(title, course.topic);
        } else {
          content = generateLessonContent(title, course.topic);
        }
      } catch {
        content = generateLessonContent(title, course.topic);
      }
      lessons[title] = content;
      lessonMap.set(title, content);
      done++;
    }
  }

  // Pass 2 — quizzes
  for (const m of mods) {
    if (isCancelled()) return { lessons, quizzes };
    onProgress({ done, total, label: `Quiz: ${m.module}` });

    const aiMap = new Map<string, LessonContent>();
    for (const title of m.lessons) {
      const c = lessonMap.get(title);
      if (c) aiMap.set(title, c);
    }

    let questions: QuizQuestion[];
    try {
      if (useAI) {
        const chapterContent = buildChapterContent(m.lessons, aiMap);
        const r = await generateChapterQuizAI(m.module, chapterContent, topic, settings);
        questions = r.ok
          ? r.questions
          : generateChapterQuiz(m.module, m.lessons, topic, aiMap, mods);
      } else {
        questions = generateChapterQuiz(m.module, m.lessons, topic, aiMap, mods);
      }
    } catch {
      questions = generateChapterQuiz(m.module, m.lessons, topic, aiMap, mods);
    }
    quizzes[m.module] = questions;
    done++;
  }

  onProgress({ done, total, label: 'Done' });
  return { lessons, quizzes };
}
