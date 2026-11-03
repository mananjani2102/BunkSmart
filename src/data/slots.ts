import { assertNoError, unwrapData } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { type SlotInput, type TimetableSlot } from '@/types/db';

const SLOT_COLUMNS =
  'id, user_id, subject_id, weekday, start_time, end_time, created_at';

export async function fetchSlots(): Promise<TimetableSlot[]> {
  const result = await supabase
    .from('timetable_slots')
    .select(SLOT_COLUMNS)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })
    .overrideTypes<TimetableSlot[], { merge: false }>();

  return unwrapData(result);
}

export async function createSlot(input: SlotInput): Promise<TimetableSlot> {
  const payload: SlotInput = {
    subject_id: input.subject_id,
    weekday: input.weekday,
    start_time: input.start_time,
    end_time: input.end_time,
  };

  const result = await supabase
    .from('timetable_slots')
    .insert(payload)
    .select(SLOT_COLUMNS)
    .single<TimetableSlot>();

  return unwrapData(result);
}

export async function updateSlot(
  id: string,
  input: Partial<SlotInput>
): Promise<TimetableSlot> {
  const payload: Partial<SlotInput> = {};

  if (input.subject_id !== undefined) {
    payload.subject_id = input.subject_id;
  }
  if (input.weekday !== undefined) {
    payload.weekday = input.weekday;
  }
  if (input.start_time !== undefined) {
    payload.start_time = input.start_time;
  }
  if (input.end_time !== undefined) {
    payload.end_time = input.end_time;
  }

  const result = await supabase
    .from('timetable_slots')
    .update(payload)
    .eq('id', id)
    .select(SLOT_COLUMNS)
    .single<TimetableSlot>();

  return unwrapData(result);
}

export async function deleteSlot(id: string): Promise<void> {
  const result = await supabase.from('timetable_slots').delete().eq('id', id);
  assertNoError(result);
}
