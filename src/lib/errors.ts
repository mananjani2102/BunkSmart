export class AppError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export interface SupabaseErrorLike {
  message?: string;
  code?: string;
  details?: string;
}

export interface SupabaseDataResult<T> {
  data: T | null;
  error: SupabaseErrorLike | null;
}

export interface SupabaseErrorResult {
  error: SupabaseErrorLike | null;
}

function getStringProperty(value: unknown, key: string): string {
  if (typeof value !== 'object' || value === null) {
    return '';
  }
  const record = value as Record<string, unknown>;
  const prop = record[key];
  return typeof prop === 'string' ? prop : '';
}

function getErrorCode(error: unknown): string | undefined {
  const code = getStringProperty(error, 'code').trim();
  return code.length > 0 ? code : undefined;
}

function getErrorText(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    const details = getStringProperty(error, 'details');
    return details ? `${error.message} ${details}` : error.message;
  }
  const message = getStringProperty(error, 'message');
  const details = getStringProperty(error, 'details');
  return details ? `${message} ${details}` : message;
}

export function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  const text = getErrorText(error).trim();
  return text.length > 0 ? text : 'Something went wrong. Try again.';
}

export function unwrapData<T>(result: SupabaseDataResult<T>): T {
  if (result.error) {
    throw new AppError(
      getFriendlyErrorMessage(result.error),
      getErrorCode(result.error)
    );
  }
  if (result.data === null) {
    throw new AppError('Something went wrong. Try again.');
  }
  return result.data;
}

export function unwrapMaybeData<T>(result: SupabaseDataResult<T>): T | null {
  if (result.error) {
    throw new AppError(
      getFriendlyErrorMessage(result.error),
      getErrorCode(result.error)
    );
  }
  return result.data;
}

export function assertNoError(result: SupabaseErrorResult): void {
  if (result.error) {
    throw new AppError(
      getFriendlyErrorMessage(result.error),
      getErrorCode(result.error)
    );
  }
}
