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

  const code = getStringProperty(error, 'code').trim().toLowerCase();
  const text = getErrorText(error).toLowerCase();

  // Match auth error codes first.
  if (code === 'invalid_credentials') {
    return 'Email or password is incorrect.';
  }
  if (code === 'user_already_exists' || code === 'email_exists') {
    return 'An account with this email already exists. Log in instead.';
  }
  if (code === 'weak_password') {
    return 'Choose a stronger password with at least 8 characters.';
  }
  if (code === 'email_not_confirmed') {
    return 'Confirm your email address, then log in.';
  }
  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit'
  ) {
    return 'Too many attempts. Wait a minute and try again.';
  }

  // Match specific unique and check constraints before generic Postgres codes.
  if (text.includes('profiles_baseline_valid')) {
    return 'Attended classes cannot be more than held classes.';
  }
  if (text.includes('subjects_user_name_key')) {
    return 'You already have a subject with this name.';
  }
  if (text.includes('timetable_slots_user_day_start_key')) {
    return 'You already have a class at this time on this day.';
  }

  // Match Postgres error codes.
  if (code === '23505') {
    return 'That entry already exists.';
  }
  if (code === '23514') {
    return 'One of the values is out of range. Check your entries.';
  }
  if (code === '42501') {
    return 'The database refused access. Check that the GRANT statements in supabase/schema.sql were run.';
  }

  // Match message text fallbacks, case-insensitive.
  if (
    text.includes('invalid_credentials') ||
    text.includes('invalid login credentials')
  ) {
    return 'Email or password is incorrect.';
  }
  if (
    text.includes('user_already_exists') ||
    text.includes('email_exists') ||
    text.includes('user already registered')
  ) {
    return 'An account with this email already exists. Log in instead.';
  }
  if (
    text.includes('weak_password') ||
    text.includes('password should be at least')
  ) {
    return 'Choose a stronger password with at least 8 characters.';
  }
  if (
    text.includes('email_not_confirmed') ||
    text.includes('email not confirmed')
  ) {
    return 'Confirm your email address, then log in.';
  }
  if (
    text.includes('over_request_rate_limit') ||
    text.includes('over_email_send_rate_limit') ||
    text.includes('rate limit')
  ) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (
    text.includes('network request failed') ||
    text.includes('failed to fetch')
  ) {
    return 'No internet connection. Check your network and try again.';
  }

  return 'Something went wrong. Try again.';
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
