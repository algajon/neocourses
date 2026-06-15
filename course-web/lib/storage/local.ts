import * as fs from 'fs/promises'
import * as path from 'path'
import type { Storage, StoredObject } from './types'

// Dev-convenience storage: writes under public/uploads/<key> so Next.js serves
// the files statically at /uploads/<key>.
const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads')

function resolvePath(key: string): string {
  return path.join(UPLOAD_ROOT, key)
}

export class LocalStorage implements Storage {
  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const dest = resolvePath(key)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, body)
    return {
      key,
      url: await this.url(key),
      size: body.byteLength,
      contentType,
    }
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(resolvePath(key))
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(resolvePath(key)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err
    })
  }

  async url(key: string): Promise<string> {
    return `/uploads/${key}`
  }
}
