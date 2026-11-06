import { assertNoError, unwrapData } from '@/lib/errors';
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

export async function clearLogStatus(logId: string): Promise<void> {
  const result = await supabase
    .from('attendance_logs')
    .delete()
    .eq('id', logId);

  assertNoError(result);
}
