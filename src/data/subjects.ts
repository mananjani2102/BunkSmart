import { assertNoError, unwrapData } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import {
  type Subject,
  type SubjectInput,
  type SubjectStats,
} from '@/types/db';

const SUBJECT_COLUMNS =
  'id, user_id, name, target_percent, initial_present, initial_total, created_at, updated_at';
export async function fetchSubjects(): Promise<Subject[]> {
  const result = await supabase
    .from('subjects')
    .select(SUBJECT_COLUMNS)
    .order('name', { ascending: true })
    .overrideTypes<Subject[], { merge: false }>();

  return unwrapData(result);
}

export async function createSubject(input: SubjectInput): Promise<Subject> {
  const payload: SubjectInput = {
    name: input.name.trim(),
    target_percent: input.target_percent,
    initial_present: input.initial_present,
    initial_total: input.initial_total,
  };

  const result = await supabase
    .from('subjects')
    .insert(payload)
    .select(SUBJECT_COLUMNS)
    .single<Subject>();

  return unwrapData(result);
}

export async function updateSubject(
  id: string,
  input: Partial<SubjectInput>
): Promise<Subject> {
  const payload: Partial<SubjectInput> = {};

  if (input.name !== undefined) {
    payload.name = input.name.trim();
  }
  if (input.target_percent !== undefined) {
    payload.target_percent = input.target_percent;
  }
  if (input.initial_present !== undefined) {
    payload.initial_present = input.initial_present;
  }
  if (input.initial_total !== undefined) {
    payload.initial_total = input.initial_total;
  }

  const result = await supabase
    .from('subjects')
    .update(payload)
    .eq('id', id)
    .select(SUBJECT_COLUMNS)
    .single<Subject>();

  return unwrapData(result);
}

export async function deleteSubject(id: string): Promise<void> {
  const result = await supabase.from('subjects').delete().eq('id', id);
  assertNoError(result);
}
