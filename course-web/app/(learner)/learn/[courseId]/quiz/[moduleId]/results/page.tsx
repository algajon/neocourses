import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { quizAttempts, quizQuestions, quizzes, modules, lessons } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { Icon } from '@/components/Icon'
import { normalizeQuizOptions } from '@/lib/quiz'
import styles from './page.module.css'

interface PageProps {
  params: { courseId: string; moduleId: string }
  searchParams: { attempt?: string }
}

async function getResults(attemptId: string, userId: string) {
  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
    .limit(1)

  if (!attempt) return null

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, attempt.quizId))
    .limit(1)

  if (!quiz) return null

  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(quizQuestions.position)

  const answers: Record<string, string> = attempt.answers
    ? JSON.parse(attempt.answers)
    : {}

  const moduleLessons = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      summary: lessons.summary,
      keyPoints: lessons.keyPoints,
      learningObjectives: lessons.learningObjectives,
      position: lessons.position,
    })
    .from(lessons)
    .where(eq(lessons.moduleId, quiz.moduleId))
    .orderBy(lessons.position)

  return { attempt, quiz, questions, answers, moduleLessons }
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'as', 'at', 'by', 'from',
  'that', 'this', 'these', 'those', 'it', 'its', 'which', 'what', 'when', 'where',
  'who', 'why', 'how', 'do', 'does', 'did', 'can', 'could', 'would', 'should',
  'will', 'about', 'into', 'than', 'then', 'their', 'they', 'you', 'your', 'not',
  'all', 'any', 'one', 'two', 'following', 'best', 'most', 'true', 'false',
])

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
  )
}

interface ModuleLesson {
  id: string
  title: string
  summary: string | null
  keyPoints: string | null
  learningObjectives: string | null
  position: number
}

// Maps each missed question to the single module lesson whose text overlaps it
// most (title/summary/keyPoints/objectives). Falls back to no match when there
// is zero overlap, so the caller can recommend the whole module instead.
function bestLessonForQuestion(
  questionText: string,
  correctAnswer: string,
  moduleLessons: ModuleLesson[]
): string | null {
  const qWords = keywords(`${questionText} ${correctAnswer}`)
  if (qWords.size === 0) return null

  let bestId: string | null = null
  let bestScore = 0
  for (const lesson of moduleLessons) {
    const lWords = keywords(
      [lesson.title, lesson.summary, lesson.keyPoints, lesson.learningObjectives]
        .filter(Boolean)
        .join(' ')
    )
    let score = 0
    for (const w of qWords) if (lWords.has(w)) score++
    if (score > bestScore) {
      bestScore = score
      bestId = lesson.id
    }
  }
  return bestId
}

export default async function QuizResultsPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const attemptId = searchParams.attempt
  if (!attemptId) redirect(`/learn/${params.courseId}`)

  const data = await getResults(attemptId, session.user.id)
  if (!data) notFound()

  const { attempt, quiz, questions, answers, moduleLessons } = data

  const scorePct = attempt.score != null ? Math.round(attempt.score * 100) : 0
  const passingPct = Math.round((quiz.passingScore ?? 0.7) * 100)
  const passed = attempt.passed ?? false

  const missedQuestions = questions.filter(q => {
    const given = answers[q.id] ?? ''
    return given.trim().toLowerCase() !== q.correctAnswer.trim().toLowerCase()
  })
  const correctCount = questions.length - missedQuestions.length

  // Map each missed question to its most relevant lesson in this module. When a
  // question matches a specific lesson we surface that lesson; questions with no
  // clear match (or when matching yields nothing) fall back to the whole module.
  const recommendedLessonIds = new Set<string>()
  let hasUnmappedMiss = false
  for (const q of missedQuestions) {
    const lessonId = bestLessonForQuestion(q.questionText, q.correctAnswer, moduleLessons)
    if (lessonId) recommendedLessonIds.add(lessonId)
    else hasUnmappedMiss = true
  }
  // If any miss couldn't be mapped (or none mapped at all), fall back to
  // recommending every lesson in the module so nothing relevant is hidden.
  if (hasUnmappedMiss || (recommendedLessonIds.size === 0 && missedQuestions.length > 0)) {
    for (const l of moduleLessons) recommendedLessonIds.add(l.id)
  }

  const reviewLessons = moduleLessons.filter(l => recommendedLessonIds.has(l.id))
  const showRemediation = missedQuestions.length > 0 && reviewLessons.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.breadcrumb}>
          <Link href={`/learn/${params.courseId}`} className={styles.breadcrumbLink}>Course</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{quiz.title} — Results</span>
        </div>

        <div className={styles.scoreCard}>
          <div className={`${styles.scoreCircle} ${passed ? styles.scorePassed : styles.scoreFailed}`}>
            <span className={styles.scoreNum}>{scorePct}%</span>
            <span className={styles.scoreLabel}>score</span>
          </div>

          <div className={styles.scoreRight}>
            <div className={`${styles.verdict} ${passed ? styles.verdictPass : styles.verdictFail}`}>
              <span className={`${styles.verdictDot} ${passed ? styles.verdictDotPass : styles.verdictDotFail}`} />
              {passed ? 'Passed' : 'Not Passed'}
            </div>
            <p className={styles.scoreSub}>
              {correctCount} of {questions.length} questions correct
            </p>

            <div
              className={styles.scoreBar}
              role="img"
              aria-label={`Scored ${scorePct} percent; passing score is ${passingPct} percent`}
            >
              <div
                className={`${styles.scoreBarFill} ${passed ? styles.scoreBarPass : styles.scoreBarFail}`}
                style={{ width: `${scorePct}%` }}
              />
              <div className={styles.scoreBarThreshold} style={{ left: `${passingPct}%` }}>
                <span className={styles.scoreBarThresholdLabel}>Pass {passingPct}%</span>
              </div>
            </div>

            <div className={styles.scoreActions}>
              {passed ? (
                <Link
                  href={`/learn/${params.courseId}`}
                  className={styles.btnPrimary}
                >
                  Continue to Next Module <Icon name="arrowRight" size={16} />
                </Link>
              ) : (
                <Link
                  href={`/learn/${params.courseId}/quiz/${params.moduleId}`}
                  className={styles.btnAccent}
                >
                  Retry Quiz
                </Link>
              )}
            </div>
          </div>
        </div>

        {showRemediation && (
          <div
            className={`${styles.remediation} ${passed ? styles.remediationSubtle : styles.remediationProminent}`}
          >
            <div className={styles.remediationHeader}>
              <span className={`${styles.remediationIcon} ${passed ? styles.remediationIconSubtle : styles.remediationIconProminent}`}>
                <Icon name={passed ? 'sparkles' : 'book'} size={16} />
              </span>
              <div className={styles.remediationHeadText}>
                <h2 className={styles.remediationTitle}>
                  {passed ? 'Concepts to reinforce' : 'Review before retrying'}
                </h2>
                <p className={styles.remediationReason}>
                  {`You missed ${missedQuestions.length} question${missedQuestions.length === 1 ? '' : 's'} on this material. `}
                  {passed
                    ? 'Revisit these lessons to lock it in.'
                    : 'Brush up on these lessons, then retry the quiz.'}
                </p>
              </div>
            </div>
            <ul className={styles.remediationList}>
              {reviewLessons.map(lesson => (
                <li key={lesson.id}>
                  <Link
                    href={`/learn/${params.courseId}/lessons/${lesson.id}`}
                    className={styles.remediationLessonLink}
                  >
                    <Icon name="arrowRight" size={14} />
                    {lesson.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.reviewSection}>
          <h2 className={styles.reviewTitle}>Question Review</h2>
          <div className={styles.questionList}>
            {questions.map((q, i) => {
              const givenAnswer = answers[q.id] ?? ''
              const normalizedGiven = givenAnswer.trim().toLowerCase()
              const normalizedCorrect = q.correctAnswer.trim().toLowerCase()
              const isCorrect = normalizedGiven === normalizedCorrect
              const options = normalizeQuizOptions(q.options) ?? []

              return (
                <div
                  key={q.id}
                  className={`${styles.questionItem} ${isCorrect ? styles.questionCorrect : styles.questionIncorrect}`}
                >
                  <div className={styles.questionHeader}>
                    <div className={`${styles.questionIcon} ${isCorrect ? styles.iconCorrect : styles.iconIncorrect}`}>
                      {isCorrect ? <Icon name="check" size={14} /> : <Icon name="x" size={14} />}
                    </div>
                    <span className={styles.questionNum}>Q{i + 1}</span>
                    <p className={styles.questionText}>{q.questionText}</p>
                  </div>

                  <div className={styles.answerArea}>
                    {options.length > 0 && (
                      <div className={styles.optionList}>
                        {options.map((opt, j) => {
                          const optionId = opt.id.trim().toLowerCase()
                          const optionText = opt.text
                          const isChosen = optionId === normalizedGiven
                          const isRight = optionId === normalizedCorrect
                          return (
                            <div
                              key={j}
                              className={`${styles.optionItem} ${isRight ? styles.optCorrect : ''} ${isChosen && !isRight ? styles.optWrong : ''}`}
                            >
                              <span className={styles.optionBullet}>
                                {isRight ? <Icon name="check" size={14} /> : isChosen ? <Icon name="x" size={14} /> : '○'}
                              </span>
                              {optionText}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {options.length === 0 && (
                      <div className={styles.shortAnswerReview}>
                        <div className={styles.answerRow}>
                          <span className={styles.answerRowLabel}>Your answer:</span>
                          <span className={`${styles.answerValue} ${isCorrect ? styles.answerValueCorrect : styles.answerValueWrong}`}>
                            {givenAnswer || '(no answer)'}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div className={styles.answerRow}>
                            <span className={styles.answerRowLabel}>Correct answer:</span>
                            <span className={`${styles.answerValue} ${styles.answerValueCorrect}`}>
                              {q.correctAnswer}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {q.explanation && (
                      <div className={styles.explanation}>
                        <span className={styles.explanationLabel}>Explanation</span>
                        <p className={styles.explanationText}>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.bottomActions}>
          {passed ? (
            <Link href={`/learn/${params.courseId}`} className={styles.btnPrimary}>
              Continue to Next Module <Icon name="arrowRight" size={16} />
            </Link>
          ) : (
            <>
              <Link href={`/learn/${params.courseId}/quiz/${params.moduleId}`} className={styles.btnAccent}>
                Retry Quiz
              </Link>
              <Link href={`/learn/${params.courseId}`} className={styles.btnSecondary}>
                Back to Course
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
