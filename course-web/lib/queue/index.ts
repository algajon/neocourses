import { Queue } from 'bullmq'
import { connection } from './connection'

export const COURSE_GEN_QUEUE = 'course-generation'

export interface CourseGenJobData {
  courseId: string
  jobId: string
}

// Cache the Queue on globalThis so hot-reload doesn't leak Queue instances
// (each holds its own Redis connection).
const globalForQueue = globalThis as unknown as {
  __courseGenQueue?: Queue<CourseGenJobData>
}

export const courseGenQueue =
  globalForQueue.__courseGenQueue ??
  new Queue<CourseGenJobData>(COURSE_GEN_QUEUE, { connection })

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.__courseGenQueue = courseGenQueue
}

export async function enqueueCourseGeneration(data: CourseGenJobData) {
  return courseGenQueue.add('generate', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  })
}
