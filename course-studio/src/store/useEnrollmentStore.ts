import { create } from 'zustand';
import { CourseEnrollment } from '../lib/types';
import { loadEnrollments, saveEnrollments } from '../lib/storage';

type EnrollmentStore = {
  enrollments: CourseEnrollment[];
  loadFromStorage: () => void;
  enroll: (userId: string, courseId: string) => void;
  toggleLessonComplete: (userId: string, courseId: string, lessonTitle: string) => void;
  markCourseComplete: (userId: string, courseId: string) => void;
  getEnrollment: (userId: string, courseId: string) => CourseEnrollment | undefined;
  getUserEnrollments: (userId: string) => CourseEnrollment[];
};

export const useEnrollmentStore = create<EnrollmentStore>((set, get) => ({
  enrollments: [],

  loadFromStorage: () => set({ enrollments: loadEnrollments() }),

  enroll: (userId, courseId) => {
    const existing = get().enrollments.find(e => e.userId === userId && e.courseId === courseId);
    if (existing) return;
    const enrollment: CourseEnrollment = {
      userId,
      courseId,
      enrolledAt: new Date().toISOString(),
      completedLessons: [],
      completed: false,
    };
    const updated = [...get().enrollments, enrollment];
    saveEnrollments(updated);
    set({ enrollments: updated });
  },

  toggleLessonComplete: (userId, courseId, lessonTitle) => {
    const updated = get().enrollments.map(e => {
      if (e.userId !== userId || e.courseId !== courseId) return e;
      const has = e.completedLessons.includes(lessonTitle);
      return {
        ...e,
        completedLessons: has
          ? e.completedLessons.filter(l => l !== lessonTitle)
          : [...e.completedLessons, lessonTitle],
      };
    });
    saveEnrollments(updated);
    set({ enrollments: updated });
  },

  markCourseComplete: (userId, courseId) => {
    const updated = get().enrollments.map(e =>
      e.userId === userId && e.courseId === courseId ? { ...e, completed: true } : e
    );
    saveEnrollments(updated);
    set({ enrollments: updated });
  },

  getEnrollment: (userId, courseId) =>
    get().enrollments.find(e => e.userId === userId && e.courseId === courseId),

  getUserEnrollments: (userId) =>
    get().enrollments.filter(e => e.userId === userId),
}));
