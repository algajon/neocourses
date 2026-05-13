import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useJobStore } from '../store/useJobStore';
import { AppError } from '../lib/types';

export function useJobProgress() {
  const { updateProgress, completeJob, failJob } = useJobStore();

  useEffect(() => {
    const unlisten1 = listen<{ job_id: string; progress: number }>('job_progress', e => {
      updateProgress(e.payload.job_id, e.payload.progress);
    });

    const unlisten2 = listen<{ job_id: string }>('job_complete', e => {
      completeJob(e.payload.job_id);
    });

    const unlisten3 = listen<{ job_id: string; error: AppError }>('job_failed', e => {
      failJob(e.payload.job_id, e.payload.error);
    });

    return () => {
      unlisten1.then(f => f());
      unlisten2.then(f => f());
      unlisten3.then(f => f());
    };
  }, []);
}
