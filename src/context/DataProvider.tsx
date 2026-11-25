import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/context/AuthProvider';
import { countAttendanceLogs, countLogsAfterDate } from '@/data/logs';
import {
  createSlot as createSlotRecord,
  createSlots as createSlotsRecord,
  deleteAllSlots as deleteAllSlotsRecord,
  deleteSlot as deleteSlotRecord,
  fetchSlots,
  updateSlot as updateSlotRecord,
} from '@/data/slots';
import {
  createSubject as createSubjectRecord,
  createSubjects as createSubjectsRecord,
  deleteAllSubjects as deleteAllSubjectsRecord,
  deleteSubject as deleteSubjectRecord,
  fetchSubjects,
  fetchSubjectStats,
  updateSubject as updateSubjectRecord,
} from '@/data/subjects';
import { clampTarget } from '@/lib/attendance';
import { formatDateString, getTodayDateString } from '@/lib/dates';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
import {
  computeOverallAttendance,
  type LogsAfterBaselineCounts,
  type OverallResult,
} from '@/lib/overall';
import { cancelAllClassReminders } from '@/lib/reminders';
import {
  type AttendanceStatus,
  type SlotInput,
  type Subject,
  type SubjectInput,
  type SubjectStats,
  type TimetableSlot,
} from '@/types/db';

export type DataStatus = 'loading' | 'ready' | 'error';

export interface TimetableImportSlotInput {
  subjectName: string;
  weekday: number;
  startTime: string;
  endTime: string | null;
}

export interface ImportTimetableResult {
  createdSubjectsCount: number;
  createdSlotsCount: number;
}

export interface DataContextValue {
  status: DataStatus;
  error: string | null;
  subjects: Subject[];
  slots: TimetableSlot[];
  statsBySubject: Record<string, SubjectStats>;
  overall: OverallResult;
  trackedSince: string;
  reload: (silent?: boolean) => Promise<void>;
  reloadStats: () => Promise<void>;
  applyOptimisticAttendanceChange: (
    subjectId: string,
    previousStatus: AttendanceStatus | null,
    nextStatus: AttendanceStatus | null,
    logDate?: string
  ) => void;
  addSubject: (input: SubjectInput) => Promise<Subject>;
  updateSubject: (id: string, input: Partial<SubjectInput>) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<void>;
  deleteAllAttendanceData: () => Promise<void>;
  addSlot: (input: SlotInput) => Promise<TimetableSlot>;
  updateSlot: (
    id: string,
    input: Partial<SlotInput>
  ) => Promise<TimetableSlot>;
  deleteSlot: (id: string) => Promise<void>;
  importTimetable: (
    newSubjectNames: string[],
    slots: TimetableImportSlotInput[],
    replace: boolean
  ) => Promise<ImportTimetableResult>;
}

const DataContext = createContext<DataContextValue | null>(null);

const DATA_CACHE_PREFIX = 'bunksmart:data:';

interface CachedData {
  subjects: Subject[];
  slots: TimetableSlot[];
  statsBySubject: Record<string, SubjectStats>;
}

async function readCachedData(userId: string): Promise<CachedData | null> {
  try {
    const raw = await AsyncStorage.getItem(`${DATA_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedData;
  } catch {
    return null;
  }
}

async function writeCachedData(userId: string, data: CachedData): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${DATA_CACHE_PREFIX}${userId}`,
      JSON.stringify(data)
    );
  } catch {
    // Ignore storage quota errors
  }
}

function sortSubjects(list: Subject[]): Subject[] {
  return [...list].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

function sortSlots(list: TimetableSlot[]): TimetableSlot[] {
  return [...list].sort((a, b) => {
    if (a.weekday !== b.weekday) {
      return a.weekday - b.weekday;
    }
    return a.start_time.localeCompare(b.start_time);
  });
}

function buildStatsMap(list: SubjectStats[]): Record<string, SubjectStats> {
  const map: Record<string, SubjectStats> = {};
  for (const row of list) {
    map[row.subject_id] = row;
  }
  return map;
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }
  return new AppError(getFriendlyErrorMessage(err));
}

function resolveTrackedSince(createdAt?: string | null): string {
  if (typeof createdAt === 'string' && createdAt.trim().length > 0) {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateString(parsed);
    }
  }
  return getTodayDateString();
}

const EMPTY_BASELINE_LOGS: LogsAfterBaselineCounts = {
  present: 0,
  absent: 0,
};

async function fetchAllData(): Promise<CachedData> {
  const [loadedSubjects, loadedSlots, loadedStats] = await Promise.all([
    fetchSubjects(),
    fetchSlots(),
    fetchSubjectStats(),
  ]);

  return {
    subjects: sortSubjects(loadedSubjects),
    slots: sortSlots(loadedSlots),
    statsBySubject: buildStatsMap(loadedStats),
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;

  const [prevUserId, setPrevUserId] = useState<string | null>(userId);
  const [status, setStatus] = useState<DataStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [statsBySubject, setStatsBySubject] = useState<
    Record<string, SubjectStats>
  >({});
  const [logsAfterBaseline, setLogsAfterBaseline] =
    useState<LogsAfterBaselineCounts>(EMPTY_BASELINE_LOGS);

  const baselineHeld = profile?.baseline_held ?? 0;
  const baselineAttended = profile?.baseline_attended ?? 0;
  const baselineDate =
    typeof profile?.baseline_date === 'string' &&
      profile.baseline_date.trim().length > 0
      ? profile.baseline_date.trim()
      : null;
  const hasCollegeBaseline = baselineHeld > 0 && baselineDate !== null;
  const baselineKey =
    userId && hasCollegeBaseline && baselineDate
      ? `${userId}:${baselineDate}`
      : null;
  const [prevBaselineKey, setPrevBaselineKey] = useState<string | null>(
    baselineKey
  );

  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setSubjects([]);
    setSlots([]);
    setStatsBySubject({});
    setLogsAfterBaseline(EMPTY_BASELINE_LOGS);
    setError(null);
    setStatus('loading');
  }

  if (prevBaselineKey !== baselineKey) {
    setPrevBaselineKey(baselineKey);
    setLogsAfterBaseline(EMPTY_BASELINE_LOGS);
  }

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const baselineRequestIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(
    async (silent = false): Promise<void> => {
      if (!userId) {
        return;
      }

      const requestId = ++requestIdRef.current;
      const baselineRequestId = ++baselineRequestIdRef.current;

      if (!silent) {
        setStatus('loading');
        setError(null);
      }

      try {
        const [data, afterCounts] = await Promise.all([
          fetchAllData(),
          hasCollegeBaseline && baselineDate
            ? countLogsAfterDate(baselineDate)
            : Promise.resolve(EMPTY_BASELINE_LOGS),
        ]);

        if (
          !mountedRef.current ||
          requestIdRef.current !== requestId ||
          activeUserIdRef.current !== userId
        ) {
          return;
        }

        setSubjects(data.subjects);
        setSlots(data.slots);
        setStatsBySubject(data.statsBySubject);
        if (baselineRequestIdRef.current === baselineRequestId) {
          setLogsAfterBaseline(afterCounts);
        }
        setError(null);
        setStatus('ready');
        void writeCachedData(userId, data);
      } catch (err) {
        if (
          !mountedRef.current ||
          requestIdRef.current !== requestId ||
          activeUserIdRef.current !== userId
        ) {
          return;
        }

        if (!silent) {
          setError(getFriendlyErrorMessage(err));
          setStatus('error');
        }
      }
    },
    [userId, hasCollegeBaseline, baselineDate]
  );

  const reloadStats = useCallback(async (): Promise<void> => {
    if (!userId) {
      return;
    }

    const baselineRequestId = ++baselineRequestIdRef.current;

    try {
      const [loadedStats, afterCounts] = await Promise.all([
        fetchSubjectStats(),
        hasCollegeBaseline && baselineDate
          ? countLogsAfterDate(baselineDate)
          : Promise.resolve(EMPTY_BASELINE_LOGS),
      ]);
      if (!mountedRef.current || activeUserIdRef.current !== userId) {
        return;
      }
      const nextStats = buildStatsMap(loadedStats);
      setStatsBySubject(nextStats);
      if (baselineRequestIdRef.current === baselineRequestId) {
        setLogsAfterBaseline(afterCounts);
      }
      setSubjects((currentSubjects) => {
        setSlots((currentSlots) => {
          void writeCachedData(userId, {
            subjects: currentSubjects,
            slots: currentSlots,
            statsBySubject: nextStats,
          });
          return currentSlots;
        });
        return currentSubjects;
      });
    } catch {
      // Keep current stats on silent stats refresh failure.
    }
  }, [userId, hasCollegeBaseline, baselineDate]);

  const applyOptimisticAttendanceChange = useCallback(
    (
      subjectId: string,
      previousStatus: AttendanceStatus | null,
      nextStatus: AttendanceStatus | null,
      logDate?: string
    ) => {
      if (previousStatus === nextStatus) {
        return;
      }

      if (
        hasCollegeBaseline &&
        baselineDate &&
        logDate &&
        logDate > baselineDate
      ) {
        let deltaPresent = 0;
        let deltaAbsent = 0;

        if (previousStatus === 'present') {
          deltaPresent -= 1;
        } else if (previousStatus === 'absent') {
          deltaAbsent -= 1;
        }

        if (nextStatus === 'present') {
          deltaPresent += 1;
        } else if (nextStatus === 'absent') {
          deltaAbsent += 1;
        }

        if (deltaPresent !== 0 || deltaAbsent !== 0) {
          setLogsAfterBaseline((prev) => ({
            present: Math.max(0, prev.present + deltaPresent),
            absent: Math.max(0, prev.absent + deltaAbsent),
          }));
        }
      }

      setStatsBySubject((prev) => {
        const current = prev[subjectId];
        const subject = subjects.find((s) => s.id === subjectId);
        const baseAttended = current?.attended ?? subject?.initial_present ?? 0;
        const baseConducted = current?.conducted ?? subject?.initial_total ?? 0;
        const baseCancelled = current?.cancelled ?? 0;

        let deltaAttended = 0;
        let deltaConducted = 0;
        let deltaCancelled = 0;

        if (previousStatus === 'present') {
          deltaAttended -= 1;
          deltaConducted -= 1;
        } else if (previousStatus === 'absent') {
          deltaConducted -= 1;
        } else if (previousStatus === 'cancelled') {
          deltaCancelled -= 1;
        }

        if (nextStatus === 'present') {
          deltaAttended += 1;
          deltaConducted += 1;
        } else if (nextStatus === 'absent') {
          deltaConducted += 1;
        } else if (nextStatus === 'cancelled') {
          deltaCancelled += 1;
        }

        const nextAttended = Math.max(0, baseAttended + deltaAttended);
        const nextConducted = Math.max(
          nextAttended,
          baseConducted + deltaConducted
        );
        const nextCancelled = Math.max(0, baseCancelled + deltaCancelled);

        return {
          ...prev,
          [subjectId]: {
            subject_id: subjectId,
            user_id: current?.user_id ?? subject?.user_id ?? userId ?? '',
            attended: nextAttended,
            conducted: nextConducted,
            cancelled: nextCancelled,
          },
        };
      });
    },
    [subjects, userId, hasCollegeBaseline, baselineDate]
  );

  useEffect(() => {
    activeUserIdRef.current = userId;
    const requestId = ++requestIdRef.current;

    let cancelled = false;

    const loadInitial = async () => {
      if (!userId) {
        setSubjects([]);
        setSlots([]);
        setStatsBySubject({});
        setStatus('ready');
        return;
      }

      // 1. Immediately hydrate from cache for instantaneous render
      try {
        const cached = await readCachedData(userId);
        if (
          cached &&
          !cancelled &&
          mountedRef.current &&
          activeUserIdRef.current === userId
        ) {
          setSubjects(cached.subjects);
          setSlots(cached.slots);
          setStatsBySubject(cached.statsBySubject);
          setStatus('ready');
        }
      } catch {
        // Cache read failure is non-fatal
      }

      // 2. Fetch fresh data over network
      try {
        const data = await fetchAllData();
        if (
          cancelled ||
          !mountedRef.current ||
          requestIdRef.current !== requestId ||
          activeUserIdRef.current !== userId
        ) {
          return;
        }

        setSubjects(data.subjects);
        setSlots(data.slots);
        setStatsBySubject(data.statsBySubject);
        setError(null);
        setStatus('ready');
        void writeCachedData(userId, data);
      } catch (err) {
        if (
          cancelled ||
          !mountedRef.current ||
          requestIdRef.current !== requestId ||
          activeUserIdRef.current !== userId
        ) {
          return;
        }

        setError(getFriendlyErrorMessage(err));
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
      }
    };

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !hasCollegeBaseline || !baselineDate) {
      return;
    }

    let cancelled = false;
    const baselineRequestId = ++baselineRequestIdRef.current;

    const loadBaselineLogs = async () => {
      try {
        const counts = await countLogsAfterDate(baselineDate);
        if (
          cancelled ||
          !mountedRef.current ||
          activeUserIdRef.current !== userId ||
          baselineRequestIdRef.current !== baselineRequestId
        ) {
          return;
        }
        setLogsAfterBaseline(counts);
      } catch {
        // Keep last known counts on silent baseline count refresh failure.
      }
    };

    void loadBaselineLogs();

    return () => {
      cancelled = true;
    };
  }, [userId, hasCollegeBaseline, baselineDate]);

  const addSubject = useCallback(
    async (input: SubjectInput): Promise<Subject> => {
      try {
        const created = await createSubjectRecord(input);
        await reload(true);
        return created;
      } catch (err) {
        throw toAppError(err);
      }
    },
    [reload]
  );

  const updateSubject = useCallback(
    async (id: string, input: Partial<SubjectInput>): Promise<Subject> => {
      try {
        const updated = await updateSubjectRecord(id, input);
        await reload(true);
        return updated;
      } catch (err) {
        throw toAppError(err);
      }
    },
    [reload]
  );

  const deleteSubject = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteSubjectRecord(id);
        await reload(true);
      } catch (err) {
        throw toAppError(err);
      }
    },
    [reload]
  );

  const deleteAllAttendanceData = useCallback(async (): Promise<void> => {
    try {
      await cancelAllClassReminders();
      if (userId) {
        await deleteAllSubjectsRecord(userId);
        void AsyncStorage.removeItem(`${DATA_CACHE_PREFIX}${userId}`);
      }
      await reload(true);
    } catch (err) {
      throw toAppError(err);
    }
  }, [reload, userId]);

  const addSlot = useCallback(
    async (input: SlotInput): Promise<TimetableSlot> => {
      try {
        const created = await createSlotRecord(input);
        await reload(true);
        return created;
      } catch (err) {
        throw toAppError(err);
      }
    },
    [reload]
  );

  const updateSlot = useCallback(
    async (
      id: string,
      input: Partial<SlotInput>
    ): Promise<TimetableSlot> => {
      try {
        const updated = await updateSlotRecord(id, input);
        await reload(true);
        return updated;
      } catch (err) {
        throw toAppError(err);
      }
    },
    [reload]
  );

  const deleteSlot = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteSlotRecord(id);
        await reload(true);
      } catch (err) {
        throw toAppError(err);
      }
    },
    [reload]
  );

  const importTimetable = useCallback(
    async (
      newSubjectNames: string[],
      importSlots: TimetableImportSlotInput[],
      replace: boolean
    ): Promise<ImportTimetableResult> => {
      if (!userId) {
        throw new AppError('You must be signed in to import a timetable.');
      }

      try {
        if (replace) {
          const logsCount = await countAttendanceLogs(userId);
          if (logsCount > 0) {
            throw new AppError(
              'Cannot replace timetable because attendance logs already exist. Use "Add to my timetable" instead.'
            );
          }
          await deleteAllSlotsRecord(userId);
        }

        // Build existing subjects lookup map (case-insensitive)
        const subjectMap = new Map<string, Subject>();
        for (const s of subjects) {
          subjectMap.set(s.name.trim().replace(/\s+/g, ' ').toLowerCase(), s);
        }

        // Determine which subjects are truly new, merging names that differ only by case
        const missingInputs: SubjectInput[] = [];
        const seenNew = new Set<string>();
        const defaultTarget = clampTarget(profile?.default_target ?? 75);

        for (const rawName of newSubjectNames) {
          const cleanName = rawName.trim().replace(/\s+/g, ' ');
          const key = cleanName.toLowerCase();
          if (!subjectMap.has(key) && !seenNew.has(key)) {
            seenNew.add(key);
            missingInputs.push({
              name: cleanName,
              target_percent: defaultTarget,
              initial_present: 0,
              initial_total: 0,
            });
          }
        }

        if (missingInputs.length > 0) {
          const created = await createSubjectsRecord(missingInputs);
          for (const s of created) {
            subjectMap.set(s.name.trim().replace(/\s+/g, ' ').toLowerCase(), s);
          }
        }

        // Prepare slots to create
        // If replace is false, skip slots that already exist in timetable (same weekday and start_time)
        const existingSlotKeys = replace
          ? new Set<string>()
          : new Set(slots.map((s) => `${s.weekday}:${s.start_time}`));

        const slotsToCreate: SlotInput[] = [];
        for (const slot of importSlots) {
          const slotKey = `${slot.weekday}:${slot.startTime}`;
          if (!replace && existingSlotKeys.has(slotKey)) {
            continue;
          }
          existingSlotKeys.add(slotKey);

          const key = slot.subjectName.trim().replace(/\s+/g, ' ').toLowerCase();
          const targetSubject = subjectMap.get(key);
          if (!targetSubject) {
            throw new AppError(
              `Could not find or create subject "${slot.subjectName}".`
            );
          }

          slotsToCreate.push({
            subject_id: targetSubject.id,
            weekday: slot.weekday,
            start_time: slot.startTime,
            end_time: slot.endTime,
          });
        }

        if (slotsToCreate.length > 0) {
          await createSlotsRecord(slotsToCreate);
        }

        await reload(true);

        return {
          createdSubjectsCount: missingInputs.length,
          createdSlotsCount: slotsToCreate.length,
        };
      } catch (err) {
        throw toAppError(err);
      }
    },
    [profile, reload, slots, subjects, userId]
  );

  const overall = useMemo<OverallResult>(() => {
    const subjectStats = subjects.map((subject) => {
      const stats = statsBySubject[subject.id];
      return {
        attended: stats?.attended ?? subject.initial_present,
        held: stats?.conducted ?? subject.initial_total,
      };
    });

    return computeOverallAttendance(
      {
        baseline_attended: baselineAttended,
        baseline_held: baselineHeld,
        baseline_date: baselineDate,
      },
      subjectStats,
      logsAfterBaseline
    );
  }, [
    subjects,
    statsBySubject,
    baselineAttended,
    baselineHeld,
    baselineDate,
    logsAfterBaseline,
  ]);

  const trackedSince = useMemo(
    () => resolveTrackedSince(profile?.created_at),
    [profile?.created_at]
  );

  const value = useMemo<DataContextValue>(
    () => ({
      status,
      error,
      subjects,
      slots,
      statsBySubject,
      overall,
      trackedSince,
      reload,
      reloadStats,
      applyOptimisticAttendanceChange,
      addSubject,
      updateSubject,
      deleteSubject,
      deleteAllAttendanceData,
      addSlot,
      updateSlot,
      deleteSlot,
      importTimetable,
    }),
    [
      status,
      error,
      subjects,
      slots,
      statsBySubject,
      overall,
      trackedSince,
      reload,
      reloadStats,
      applyOptimisticAttendanceChange,
      addSubject,
      updateSubject,
      deleteSubject,
      deleteAllAttendanceData,
      addSlot,
      updateSlot,
      deleteSlot,
      importTimetable,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider.');
  }
  return context;
}
