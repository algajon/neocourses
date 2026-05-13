import { AppError, ErrorCode } from './types';
import { ERROR_MESSAGES } from './strings';

export function makeError(code: ErrorCode, detail?: string): AppError {
  return {
    code,
    message: ERROR_MESSAGES[code] ?? ERROR_MESSAGES['UNKNOWN'],
    detail,
  };
}

export function fromUnknown(err: unknown): AppError {
  if (err && typeof err === 'object' && 'code' in err) {
    const e = err as any;
    return {
      code: e.code ?? 'UNKNOWN',
      message: ERROR_MESSAGES[e.code as ErrorCode] ?? ERROR_MESSAGES['UNKNOWN'],
      detail: e.detail ?? String(err),
    };
  }
  return makeError('UNKNOWN', String(err));
}
