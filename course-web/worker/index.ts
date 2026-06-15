import '@/lib/load-env'
import { Worker, type Job } from 'bullmq'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { connection } from '@/lib/queue/connection'
import {
  COURSE_GEN_QUEUE,
  courseGenQueue,
  type CourseGenJobData,
} from '@/lib/queue'
import { db } from '@/lib/db'
import {
  courses,
  sourceMaterials,
  modules,
  lessons,
  quizzes,
  quizQuestions,
  onboardingChecklists,
  checklistItems,
  aiGenerationJobs,
} from '@/lib/db/schema'
import { getAIProvider } from '@/lib/ai'

// The aiGenerationJobs table has no dedicated progress/statusMessage columns,
// so we persist them as JSON in outputData. The jobs API route reads them back.
async function setJobProgress(
  jobId: string,
  progress: number,
  statusMessage: string,
) {
  await db
    .update(aiGenerationJobs)
    .set({ outputData: JSON.stringify({ progress, statusMessage }) })
    .where(eq(aiGenerationJobs.id, jobId))
}

async function runGeneration(courseId: string, jobId: string) {
  const ai = getAIProvider()

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course) throw new Error('Course not found')

  const materials = await db
    .select()
    .from(sourceMaterials)
    .where(eq(sourceMaterials.courseId, courseId))

  const materialText = materials
    .map((m) => m.extractedText ?? '')
    .filter(Boolean)
    .join('\n\n')

  await db
    .update(aiGenerationJobs)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(aiGenerationJobs.id, jobId))

  await setJobProgress(jobId, 10, 'Generating course outline')

  const outline = await ai.generateCourseOutline(
    course.title,
    course.description ?? '',
    materialText,
  )

  // Topic for lesson/quiz generation is derived SOLELY from the source (the outline's
  // inferred subject) — never the admin's title/description.
  const courseTopic =
    outline.subject?.trim() || outline.modules[0]?.title || 'the subject of the source material'

  await setJobProgress(jobId, 30, 'Generating lessons')

  const totalModules = outline.modules.length
  let completedModules = 0

  // Generate all modules concurrently — vLLM batches the requests, so this is far
  // faster than the previous sequential loop. Each module: generate lessons, persist
  // them, then generate a quiz GROUNDED in those lessons' actual content.
  await Promise.all(
    outline.modules.map(async (mod, modIndex) => {
      const moduleId = uuidv4()
      const now = new Date()

      await db.insert(modules).values({
        id: moduleId,
        courseId,
        title: mod.title,
        description: mod.description,
        position: modIndex,
        createdAt: now,
        updatedAt: now,
      })

      const lessonTitles = mod.lessons.map((l) => l.title)
      // Pass the full source so each lesson is grounded in the actual uploaded
      // material (the provider retrieves the passages relevant to each lesson).
      const fullLessons = await ai.generateLessons(mod.title, lessonTitles, courseTopic, materialText)

      // The model's lesson objects don't always include every field; the outline is
      // the source of truth for titles. Guard all NOT-NULL columns with safe defaults.
      await Promise.all(
        fullLessons.map((fl, i) => {
          const lessonNow = new Date()
          const title = fl?.title || lessonTitles[i] || `Lesson ${i + 1}`
          const summary = fl?.summary ?? mod.lessons[i]?.summary ?? ''
          return db.insert(lessons).values({
            id: uuidv4(),
            moduleId,
            courseId,
            title,
            summary,
            contentJson: JSON.stringify(fl?.content ?? {}),
            learningObjectives: JSON.stringify(fl?.learningObjectives ?? []),
            keyPoints: JSON.stringify(fl?.keyPoints ?? []),
            lessonSummary: summary,
            position: i,
            createdAt: lessonNow,
            updatedAt: lessonNow,
          })
        }),
      )

      // Build the chapter's real content so the quiz tests what was actually taught.
      const chapterContent = fullLessons
        .map((fl, i) => {
          const c = fl?.content
          const concepts = (c?.concepts ?? []).map((x) => `${x.title}: ${x.body}`).join('\n')
          const takeaways = (c?.keyTakeaways ?? []).join('; ')
          return `## ${fl?.title || lessonTitles[i]}\n${c?.intro ?? ''}\n${concepts}\nKey takeaways: ${takeaways}`
        })
        .join('\n\n')

      const quizQuestionData = await ai.generateQuizQuestions(mod.title, chapterContent, courseTopic)
      const quizId = uuidv4()
      const quizNow = new Date()

      await db.insert(quizzes).values({
        id: quizId,
        moduleId,
        courseId,
        title: `${mod.title} Quiz`,
        passingScore: 0.7,
        createdAt: quizNow,
        updatedAt: quizNow,
      })

      await Promise.all(
        quizQuestionData
          .map((qq, qi) => {
            const questionText = qq?.questionText || (qq as { question?: string })?.question || ''
            if (!questionText) return null
            return db.insert(quizQuestions).values({
              id: uuidv4(),
              quizId,
              questionText,
              questionType: qq?.questionType || 'multiple_choice',
              options: qq?.options ? JSON.stringify(qq.options) : null,
              correctAnswer: qq?.correctAnswer ?? '',
              explanation: qq?.explanation ?? '',
              position: qi,
              createdAt: new Date(),
            })
          })
          .filter(Boolean),
      )

      completedModules++
      const moduleProgress =
        totalModules > 0 ? 30 + Math.round((completedModules / totalModules) * 30) : 60
      await setJobProgress(
        jobId,
        moduleProgress,
        `Generated module ${completedModules} of ${totalModules}`,
      )
    }),
  )

  await setJobProgress(jobId, 60, 'Generating quizzes')
  await setJobProgress(jobId, 85, 'Generating onboarding checklist')

  const checklistData = await ai.generateChecklist(course.title, materialText)
  const checklistId = uuidv4()
  const checklistNow = new Date()

  await db.insert(onboardingChecklists).values({
    id: checklistId,
    courseId,
    title: `${course.title} Onboarding Checklist`,
    createdAt: checklistNow,
    updatedAt: checklistNow,
  })

  for (let ci = 0; ci < checklistData.length; ci++) {
    const item = checklistData[ci]
    await db.insert(checklistItems).values({
      id: uuidv4(),
      checklistId,
      text: item.text,
      description: item.description,
      isRequired: item.isRequired,
      position: ci,
      createdAt: new Date(),
    })
  }

  await db
    .update(courses)
    .set({ status: 'ready', updatedAt: new Date() })
    .where(eq(courses.id, courseId))

  await setJobProgress(jobId, 100, 'Generation complete')

  await db
    .update(aiGenerationJobs)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(aiGenerationJobs.id, jobId))
}

async function processor(job: Job<CourseGenJobData>) {
  const { courseId, jobId } = job.data

  try {
    await runGeneration(courseId, jobId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    await db
      .update(aiGenerationJobs)
      .set({
        status: 'failed',
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(aiGenerationJobs.id, jobId))

    await db
      .update(courses)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(eq(courses.id, courseId))

    // Rethrow so BullMQ records the failure and applies the retry policy.
    throw err
  }
}

const worker = new Worker<CourseGenJobData>(COURSE_GEN_QUEUE, processor, {
  connection,
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
  // Course generation is long-running (many model calls), so the per-job lock
  // must outlive a single iteration. BullMQ auto-renews the lock every
  // lockDuration/2 while the job is alive; if the worker crashes mid-job the
  // lock expires after lockDuration and the job is reclaimed as stalled.
  lockDuration: Number(process.env.WORKER_LOCK_DURATION_MS ?? 5 * 60 * 1000),
  // How often the worker scans for jobs whose lock expired (crashed workers).
  stalledInterval: Number(process.env.WORKER_STALLED_INTERVAL_MS ?? 30 * 1000),
  // A job may be recovered from "stalled" this many times before it is moved to
  // failed instead of being retried — bounds infinite reprocessing of a job
  // that reliably crashes the worker.
  maxStalledCount: Number(process.env.WORKER_MAX_STALLED ?? 2),
})

worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} completed (course ${job.data.courseId})`)
})

worker.on('failed', (job, err) => {
  console.error(
    `[worker] job ${job?.id} failed (course ${job?.data.courseId}): ${err.message}`,
  )
})

// A stalled job means its lock expired (typically a crashed/hung worker). It
// will be retried automatically until maxStalledCount; surface it for ops.
worker.on('stalled', (jobId) => {
  console.warn(`[worker] job ${jobId} stalled (lock expired) — will be retried`)
})

worker.on('error', (err) => {
  console.error(`[worker] worker error: ${err.message}`)
})

worker.on('ready', () => {
  console.log('[worker] ready — connected to Redis, listening for jobs')
})

// Health signal: surface Redis connection problems instead of failing silently.
connection.on('error', (err) => {
  console.error(`[worker] redis connection error: ${err.message}`)
})
connection.on('reconnecting', () => {
  console.warn('[worker] redis reconnecting…')
})

// Lightweight heartbeat so liveness is observable in logs without an HTTP probe.
const HEARTBEAT_MS = Number(process.env.WORKER_HEARTBEAT_MS ?? 60 * 1000)
const heartbeat = setInterval(() => {
  const state = worker.isRunning() ? 'running' : 'stopped'
  console.log(
    `[worker] heartbeat: ${state} (concurrency ${worker.concurrency})`,
  )
}, HEARTBEAT_MS)
// Don't keep the event loop alive solely for the heartbeat.
heartbeat.unref?.()

// Startup recovery: a worker crash can leave ai_generation_jobs rows in
// 'running' with no live BullMQ job to ever finish them, and their courses
// stuck out of 'draft'. On boot, reconcile any such orphans to 'failed' so the
// course returns to a re-generatable state. Safe because the worker isn't
// processing yet at this point and a genuinely-active job would not be in this
// table state without a corresponding live job.
async function recoverOrphanedJobs() {
  try {
    const stuck = await db
      .select()
      .from(aiGenerationJobs)
      .where(
        and(
          inArray(aiGenerationJobs.status, ['running', 'processing', 'pending']),
          isNull(aiGenerationJobs.completedAt),
        ),
      )

    if (stuck.length === 0) return

    // Cross-check against BullMQ: a job is a real orphan only if there is no
    // active/waiting/delayed BullMQ job for the same course. This avoids
    // failing jobs that a still-running worker (or a pending retry) owns.
    const liveJobs = await courseGenQueue.getJobs([
      'active',
      'waiting',
      'delayed',
      'paused',
    ])
    const liveCourseIds = new Set(
      liveJobs.map((j) => j?.data?.courseId).filter(Boolean) as string[],
    )

    const orphans = stuck.filter((row) => !liveCourseIds.has(row.courseId))
    if (orphans.length === 0) return

    console.warn(
      `[worker] startup recovery: found ${orphans.length} orphaned generation job(s) — marking failed`,
    )

    for (const row of orphans) {
      await db
        .update(aiGenerationJobs)
        .set({
          status: 'failed',
          errorMessage:
            'Worker restarted while this job was in progress; the job was not completed.',
          completedAt: new Date(),
        })
        .where(eq(aiGenerationJobs.id, row.id))

      await db
        .update(courses)
        .set({ status: 'draft', updatedAt: new Date() })
        .where(eq(courses.id, row.courseId))
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[worker] startup recovery failed: ${message}`)
  }
}

void recoverOrphanedJobs()

console.log('Worker listening on course-generation queue')

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down`)
  clearInterval(heartbeat)
  await worker.close()
  await connection.quit()
  process.exit(0)
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
process.on('SIGINT', () => {
  void shutdown('SIGINT')
})
