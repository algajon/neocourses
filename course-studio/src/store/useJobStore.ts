import { create } from 'zustand';
import { Job, AppError } from '../lib/types';

type JobStore = {
  jobs: Job[];
  activeJobId: string | null;
  startJob: (id: string, label: string) => void;
  updateProgress: (id: string, progress: number) => void;
  completeJob: (id: string) => void;
  failJob: (id: string, error: AppError) => void;
  cancelJob: (id: string) => void;
};

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  activeJobId: null,
  startJob: (id, label) =>
    set(s => ({
      jobs: [...s.jobs, { id, label, status: 'running', progress: 0 }],
      activeJobId: id,
    })),
  updateProgress: (id, progress) =>
    set(s => ({ jobs: s.jobs.map(j => j.id === id ? { ...j, progress } : j) })),
  completeJob: (id) =>
    set(s => ({
      jobs: s.jobs.map(j => j.id === id ? { ...j, status: 'complete', progress: 100 } : j),
      activeJobId: null,
    })),
  failJob: (id, error) =>
    set(s => ({
      jobs: s.jobs.map(j => j.id === id ? { ...j, status: 'failed', error } : j),
      activeJobId: null,
    })),
  cancelJob: (id) =>
    set(s => ({
      jobs: s.jobs.map(j => j.id === id ? { ...j, status: 'cancelled' } : j),
      activeJobId: null,
    })),
}));
