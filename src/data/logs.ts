import { assertNoError, unwrapData, unwrapMaybeData } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { type AttendanceLog, type AttendanceStatus } from '@/types/db';

const LOG_COLUMNS =
  'id, user_id, subject_id, slot_id, log_date, status, created_at, updated_at';

export interface SetSlotLogInput {
  subject_id: string;
  slot_id: string;
  log_date: string;
  status: AttendanceStatus;
}

export async function fetchLogsForDate(
  logDate: string
): Promise<AttendanceLog[]> {
  const result = await supabase
    .from('attendance_logs')
    .select(LOG_COLUMNS)
    .eq('log_date', logDate)
    .overrideTypes<AttendanceLog[], { merge: false }>();

  return unwrapData(result);
}

export async function fetchLogsForSubject(
  subjectId: string
): Promise<AttendanceLog[]> {
  const result = await supabase
    .from('attendance_logs')
    .select(LOG_COLUMNS)
    .eq('subject_id', subjectId)
    .order('log_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1000)
    .overrideTypes<AttendanceLog[], { merge: false }>();

  return unwrapData(result);
}

export async function setSlotLogStatus(
  input: SetSlotLogInput
): Promise<AttendanceLog> {
  const payload: SetSlotLogInput = {
    subject_id: input.subject_id,
    slot_id: input.slot_id,
    log_date: input.log_date,
    status: input.status,
  };

  const result = await supabase
    .from('attendance_logs')
    .upsert(payload, { onConflict: 'slot_id,log_date' })
    .select(LOG_COLUMNS)
    .single<AttendanceLog>();

  return unwrapData(result);
}

export async function setDateLogsStatusBatch(
  inputs: readonly SetSlotLogInput[]
): Promise<AttendanceLog[]> {
  if (inputs.length === 0) {
    return [];
  }

  const payload: SetSlotLogInput[] = inputs.map((input) => ({
    subject_id: input.subject_id,
    slot_id: input.slot_id,
    log_date: input.log_date,
    status: input.status,
  }));

  const result = await supabase
    .from('attendance_logs')
    .upsert(payload, { onConflict: 'slot_id,log_date' })
    .select(LOG_COLUMNS)
    .overrideTypes<AttendanceLog[], { merge: false }>();

  return unwrapData(result);
}

export async function deleteLogsForDate(logDate: string): Promise<void> {
  const result = await supabase
    .from('attendance_logs')
    .delete()
    .eq('log_date', logDate);

  assertNoError(result);
}

export async function fetchEarliestLogDate(): Promise<string | null> {
  const result = await supabase
    .from('attendance_logs')
    .select('log_date')
    .order('log_date', { ascending: true })
    .limit(1)
    .maybeSingle<{ log_date: string }>();

  const row = unwrapMaybeData(result);
  return row?.log_date ?? null;
}

export async function clearLogStatus(logId: string): Promise<void> {
  const result = await supabase
    .from('attendance_logs')
    .delete()
    .eq('id', logId);

  assertNoError(result);
}

export async function countAttendanceLogs(userId?: string): Promise<number> {
  let query = supabase
    .from('attendance_logs')
    .select('id', { count: 'exact', head: true });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const result = await query;
  assertNoError(result);
  return result.count ?? 0;
}

export interface LogsAfterDateCounts {
  present: number;
  absent: number;
}

export async function countLogsAfterDate(
  afterDate: string
): Promise<LogsAfterDateCounts> {
  const [presentResult, absentResult] = await Promise.all([
    supabase
      .from('attendance_logs')
      .select('id', { count: 'exact', head: true })
      .gt('log_date', afterDate)
      .eq('status', 'present'),
    supabase
      .from('attendance_logs')
      .select('id', { count: 'exact', head: true })
      .gt('log_date', afterDate)
      .eq('status', 'absent'),
  ]);

  assertNoError(presentResult);
  assertNoError(absentResult);

  return {
    present: presentResult.count ?? 0,
    absent: absentResult.count ?? 0,
  };
}
