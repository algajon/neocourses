import { create } from 'zustand';
import type { UploadStatus, CourseSummary } from '@courseneo/shared';

export type UploadLog = {
  courseId: string;
  title: string;
  status: UploadStatus;
};

type PairingState = {
  /** Base URL of the desktop server (tunnel URL or http://host:port). */
  base: string | null;
  desktopName: string | null;
  session: string | null;
  expiresAt: string | null;
  uploads: UploadLog[];
  courses: CourseSummary[];
  setConnection: (c: { base: string; name?: string }) => void;
  setSession: (s: { session: string; expiresAt: string; host?: string }) => void;
  addUpload: (u: UploadLog) => void;
  setCourses: (courses: CourseSummary[]) => void;
  clear: () => void;
};

export const usePairingStore = create<PairingState>((set) => ({
  base: null,
  desktopName: null,
  session: null,
  expiresAt: null,
  uploads: [],
  courses: [],
  setConnection: (c) => set({ base: c.base, desktopName: c.name ?? null }),
  setSession: (s) =>
    set((st) => ({
      session: s.session,
      expiresAt: s.expiresAt,
      desktopName: s.host ?? st.desktopName,
    })),
  addUpload: (u) => set((st) => ({ uploads: [u, ...st.uploads] })),
  setCourses: (courses) => set({ courses }),
  clear: () =>
    set({ base: null, desktopName: null, session: null, expiresAt: null, uploads: [], courses: [] }),
}));
