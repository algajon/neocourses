export interface StoredObject {
  key: string
  url: string
  size: number
  contentType: string
}

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  url(key: string): Promise<string> // presigned (s3) or static path (local)
}
