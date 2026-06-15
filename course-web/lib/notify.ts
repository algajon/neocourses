import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notifications, users } from '@/lib/db/schema'
import {
  sendEmail,
  welcome,
  courseAssigned,
  courseCompleted,
  type RenderedTemplate,
} from '@/lib/email'

interface NotificationInput {
  userId: string
  type: string
  title: string
  body: string
  link?: string
}

export async function createNotification(n: NotificationInput): Promise<void> {
  await db.insert(notifications).values({
    id: uuidv4(),
    userId: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link ?? null,
    readAt: null,
    createdAt: new Date(),
  })

  // Best-effort transactional email — never throws or blocks the request.
  void sendNotificationEmail(n)
}

/**
 * Maps an in-app notification to its email template and sends it, if the user
 * has an email and the type has a matching template. Swallows all errors.
 */
async function sendNotificationEmail(n: NotificationInput): Promise<void> {
  try {
    const template = templateFor(n)
    if (!template) return

    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, n.userId))
      .limit(1)

    const email = user?.email?.trim()
    if (!email) return

    const rendered = template(user?.name ?? undefined)
    await sendEmail({ to: email, ...rendered })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`[notify] email side-effect failed for user=${n.userId}: ${detail}`)
  }
}

/** Notification type → email template factory. `body` carries the course title. */
function templateFor(
  n: NotificationInput
): ((name?: string) => RenderedTemplate) | null {
  switch (n.type) {
    case 'welcome':
      return (name) => welcome({ name })
    case 'assignment':
      return (name) => courseAssigned({ name, courseTitle: n.body, link: n.link })
    case 'completion':
      return (name) => courseCompleted({ name, courseTitle: n.body, link: n.link })
    default:
      // review_requested / review_approved and any other types stay in-app only.
      return null
  }
}
