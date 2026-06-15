import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'

export async function createNotification(n: {
  userId: string
  type: string
  title: string
  body: string
  link?: string
}): Promise<void> {
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
}
