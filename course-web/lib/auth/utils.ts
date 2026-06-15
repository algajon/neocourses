import { getServerSession } from 'next-auth'
import { hash, compare } from 'bcryptjs'
import { authOptions } from './config'

export async function getSession() {
  return getServerSession(authOptions)
}

export function isAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

export function isEditorOrAbove(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'reviewer'
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12)
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash)
}
