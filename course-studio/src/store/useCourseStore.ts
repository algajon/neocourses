import { create } from 'zustand';
import { SavedCourse } from '../lib/types';
import { loadCourses, saveCourses } from '../lib/storage';

type CourseStore = {
  courses: SavedCourse[];
  activeCourseId: string | null;
  loadFromStorage: () => void;
  addCourse: (course: SavedCourse) => void;
  updateCourse: (id: string, updates: Partial<SavedCourse>) => void;
  deleteCourse: (id: string) => void;
  setActiveCourse: (id: string | null) => void;
};

export const useCourseStore = create<CourseStore>((set, get) => ({
  courses: [],
  activeCourseId: null,
  loadFromStorage: () => set({ courses: loadCourses() }),
  addCourse: (course) => {
    const updated = [...get().courses, course];
    set({ courses: updated });
    saveCourses(updated);
  },
  updateCourse: (id, updates) => {
    const updated = get().courses.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    );
    set({ courses: updated });
    saveCourses(updated);
  },
  deleteCourse: (id) => {
    const updated = get().courses.filter(c => c.id !== id);
    set({
      courses: updated,
      activeCourseId: get().activeCourseId === id ? null : get().activeCourseId,
    });
    saveCourses(updated);
  },
  setActiveCourse: (id) => set({ activeCourseId: id }),
}));
