import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { quizAttempts, quizQuestions, quizzes, modules } from '@/lib/db/schema'
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

  return { attempt, quiz, questions, answers }
}

export default async function QuizResultsPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const attemptId = searchParams.attempt
  if (!attemptId) redirect(`/learn/${params.courseId}`)

  const data = await getResults(attemptId, session.user.id)
  if (!data) notFound()

  const { attempt, quiz, questions, answers } = data

  const scorePct = attempt.score != null ? Math.round(attempt.score * 100) : 0
  const passingPct = Math.round((quiz.passingScore ?? 0.7) * 100)
  const passed = attempt.passed ?? false

  const correctCount = questions.filter(q => {
    const given = answers[q.id] ?? ''
    return given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
  }).length

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
