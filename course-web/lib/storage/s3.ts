import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Storage, StoredObject } from './types'

const URL_EXPIRES_SECONDS = 3600

function streamToBuffer(stream: unknown): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const readable = stream as NodeJS.ReadableStream
    readable.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    readable.on('error', reject)
    readable.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

export class S3Storage implements Storage {
  private client: S3Client
  private bucket: string

  constructor() {
    const bucket = process.env.S3_BUCKET
    if (!bucket) {
      throw new Error('S3_BUCKET is not set but STORAGE_DRIVER=s3')
    }
    this.bucket = bucket

    const endpoint = process.env.S3_ENDPOINT || undefined

    this.client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      },
    })
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )
    return {
      key,
      url: await this.url(key),
      size: body.byteLength,
      contentType,
    }
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    )
    return streamToBuffer(res.Body)
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    )
  }

  async url(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: URL_EXPIRES_SECONDS }
    )
  }
}
