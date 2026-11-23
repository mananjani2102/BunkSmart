export type AttendanceStatus = 'present' | 'absent' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  default_target: number;
  baseline_attended: number;
  baseline_held: number;
  baseline_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  target_percent: number;
  initial_present: number;
  initial_total: number;
  created_at: string;
  updated_at: string;
}

export interface TimetableSlot {
  id: string;
  user_id: string;
  subject_id: string;
  weekday: number;
  start_time: string;
  end_time: string | null;
  created_at: string;
}

export interface AttendanceLog {
  id: string;
  user_id: string;
  subject_id: string;
  slot_id: string | null;
  log_date: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}

export interface SubjectStats {
  subject_id: string;
  user_id: string;
  attended: number;
  conducted: number;
  cancelled: number;
}

export interface SubjectInput {
  name: string;
  target_percent: number;
  initial_present: number;
  initial_total: number;
}

export interface SlotInput {
  subject_id: string;
  weekday: number;
  start_time: string;
  end_time: string | null;
}
