import {
  ENDPOINTS,
  PROTOCOL_VERSION,
  baseUrlFor,
  type PingResponse,
  type PairRequest,
  type PairResponse,
  type PairingPayload,
  type UploadFields,
  type UploadResponse,
  type CourseSummary,
  type CoursesResponse,
  type ApiErrorCode,
} from '@courseneo/shared';

export { PROTOCOL_VERSION };

/** Error carrying the protocol's `{error: code}` value when present. */
export class PairingError extends Error {
  code?: ApiErrorCode;
  status?: number;
  constructor(message: string, opts?: { code?: ApiErrorCode; status?: number }) {
    super(message);
    this.name = 'PairingError';
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

export type PickedFile = { uri: string; name: string; mimeType?: string };

/** Resolve the base URL (tunnel URL when present, else http://host:port). */
export function resolveBase(p: Pick<PairingPayload, 'host' | 'port' | 'url'>): string {
  return baseUrlFor(p);
}

async function toError(res: Response): Promise<PairingError> {
  let code: ApiErrorCode | undefined;
  try {
    const body = (await res.json()) as { error?: ApiErrorCode };
    if (body && typeof body.error === 'string') code = body.error;
  } catch {
    /* non-JSON error body */
  }
  return new PairingError(code ?? `HTTP ${res.status}`, { code, status: res.status });
}

export async function ping(base: string): Promise<PingResponse> {
  const res = await fetch(`${base}${ENDPOINTS.ping}`);
  if (!res.ok) throw await toError(res);
  return (await res.json()) as PingResponse;
}

export async function pair(base: string, req: PairRequest): Promise<PairResponse> {
  const res = await fetch(`${base}${ENDPOINTS.pair}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as PairResponse;
}

export async function uploadCourse(
  base: string,
  session: string,
  fields: UploadFields,
  file?: PickedFile,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append('title', fields.title);
  if (fields.brief) form.append('brief', fields.brief);
  if (file) {
    // React Native multipart file part shape.
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType ?? 'application/octet-stream',
    } as unknown as Blob);
  }
  const res = await fetch(`${base}${ENDPOINTS.courses}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session}` },
    body: form,
  });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as UploadResponse;
}

export async function listCourses(base: string, session: string): Promise<CourseSummary[]> {
  const res = await fetch(`${base}${ENDPOINTS.courses}`, {
    headers: { authorization: `Bearer ${session}` },
  });
  if (!res.ok) throw await toError(res);
  const body = (await res.json()) as CoursesResponse;
  return body.courses ?? [];
}

export async function presentCourse(base: string, session: string, courseId: string): Promise<void> {
  const res = await fetch(`${base}${ENDPOINTS.present}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` },
    body: JSON.stringify({ courseId }),
  });
  if (!res.ok) throw await toError(res);
}
