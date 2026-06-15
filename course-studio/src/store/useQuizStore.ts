import { create } from 'zustand';
import { StoredQuiz, StoredQuizQuestion, QuizAttempt } from '../lib/types';
import { loadQuizzes, saveQuizzes, loadQuizAttempts, saveQuizAttempts } from '../lib/storage';

type QuizStore = {
  quizzes: StoredQuiz[];
  attempts: QuizAttempt[];
  loadFromStorage: () => void;
  saveQuiz: (courseId: string, chapterName: string, questions: StoredQuizQuestion[]) => void;
  getQuiz: (courseId: string, chapterName: string) => StoredQuiz | undefined;
  recordAttempt: (attempt: Omit<QuizAttempt, 'id' | 'takenAt'>) => void;
};

export const useQuizStore = create<QuizStore>((set, get) => ({
  quizzes: [],
  attempts: [],

  loadFromStorage: () => set({ quizzes: loadQuizzes(), attempts: loadQuizAttempts() }),

  saveQuiz: (courseId, chapterName, questions) => {
    if (questions.length === 0) return;
    const exists = get().quizzes.some(q => q.courseId === courseId && q.chapterName === chapterName);
    const entry: StoredQuiz = { courseId, chapterName, questions, updatedAt: new Date().toISOString() };
    const updated = exists
      ? get().quizzes.map(q => (q.courseId === courseId && q.chapterName === chapterName ? entry : q))
      : [...get().quizzes, entry];
    saveQuizzes(updated);
    set({ quizzes: updated });
  },

  getQuiz: (courseId, chapterName) =>
    get().quizzes.find(q => q.courseId === courseId && q.chapterName === chapterName),

  recordAttempt: (attempt) => {
    const full: QuizAttempt = {
      ...attempt,
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      takenAt: new Date().toISOString(),
    };
    const updated = [...get().attempts, full];
    saveQuizAttempts(updated);
    set({ attempts: updated });
  },
}));
