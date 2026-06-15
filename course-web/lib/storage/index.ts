import type { Storage } from './types'
import { LocalStorage } from './local'
import { S3Storage } from './s3'

export type { Storage, StoredObject } from './types'

let cached: Storage | null = null

export function getStorage(): Storage {
  if (cached) return cached
  cached =
    process.env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage()
  return cached
}
