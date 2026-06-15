import { Queue, type JobsOptions } from 'bullmq'
import { connection } from './connection'

export const COURSE_GEN_QUEUE = 'course-generation'

export interface CourseGenJobData {
  courseId: string
  jobId: string
}

// Single source of truth for retry/backoff behaviour. Applied both as the
// Queue's defaultJobOptions (so jobs enqueued elsewhere inherit it) and
// explicitly when enqueuing. 3 attempts with exponential backoff (5s, 10s, 20s)
// rides out transient model/DB hiccups without hammering a down dependency.
export const COURSE_GEN_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 500,
}

// Cache the Queue on globalThis so hot-reload doesn't leak Queue instances
// (each holds its own Redis connection).
const globalForQueue = globalThis as unknown as {
  __courseGenQueue?: Queue<CourseGenJobData>
}

export const courseGenQueue =
  globalForQueue.__courseGenQueue ??
  new Queue<CourseGenJobData>(COURSE_GEN_QUEUE, {
    connection,
    defaultJobOptions: COURSE_GEN_JOB_OPTIONS,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.__courseGenQueue = courseGenQueue
}

export async function enqueueCourseGeneration(data: CourseGenJobData) {
  return courseGenQueue.add('generate', data, COURSE_GEN_JOB_OPTIONS)
}
