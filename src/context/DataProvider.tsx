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

import { useAuthState } from '@/context/AuthProvider';
import {
  clearLogStatus,
  countAttendanceLogs,
  countLogsAfterDate,
  deleteLogsForDate,
  deleteLogsForSlotsOnDate,
  fetchLogsForDate,
  fetchLogsForSubject,
  insertManualLogsBatch,
  setDateLogsStatusBatch,
  setSlotLogStatus,
} from '@/data/logs';
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
  type AttendanceLog,
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

export interface DateLogsCacheEntry {
  logs: AttendanceLog[];
  fetchedAt: number;
}

export interface MarkSlotResult {
  previousStatus: AttendanceStatus | null;
  nextStatus: AttendanceStatus | null;
  attended: number;
  held: number;
}

export interface MarkSlotStatusParams {
  slot: TimetableSlot;
  subject: Subject;
  targetDate: string;
  nextStatus: AttendanceStatus;
  onOptimistic?: (result: MarkSlotResult) => void;
}

export interface RestoreSlotStatusParams {
  slot: TimetableSlot;
  subject: Subject;
  targetDate: string;
  targetStatus: AttendanceStatus | null;
}

export interface StartingCountUpdate {
  id: string;
  attended: number;
  held: number;
}

export interface DataStateValue {
  status: DataStatus;
  error: string | null;
  subjects: Subject[];
  slots: TimetableSlot[];
  trackedSince: string;
}

export interface DataStatsValue {
  statsBySubject: Record<string, SubjectStats>;
}

export interface DataDerivedValue {
  overall: OverallResult;
}

export interface DataDateLogsValue {
  dateLogsByDate: Record<string, DateLogsCacheEntry>;
}

export interface DataActionsValue {
  reload: (force?: boolean, silent?: boolean) => Promise<void>;
  reloadStats: (force?: boolean) => Promise<void>;
  loadDateLogs: (
    dateStr: string,
    force?: boolean
  ) => Promise<AttendanceLog[]>;
  loadSubjectLogs: (
    subjectId: string,
    force?: boolean
  ) => Promise<AttendanceLog[]>;
  getCachedSubjectLogs: (subjectId: string) => AttendanceLog[] | null;
  markSlotStatus: (params: MarkSlotStatusParams) => Promise<MarkSlotResult>;
  restoreSlotStatus: (params: RestoreSlotStatusParams) => Promise<void>;
  markDateBatchStatus: (
    targetDate: string,
    daySlots: readonly TimetableSlot[],
    nextStatus: AttendanceStatus,
    onOptimistic?: (previousLogs: readonly AttendanceLog[]) => void
  ) => Promise<readonly AttendanceLog[]>;
  clearDateLogs: (
    targetDate: string,
    onOptimistic?: (previousLogs: readonly AttendanceLog[]) => void
  ) => Promise<readonly AttendanceLog[]>;
  restoreDateLogs: (
    targetDate: string,
    previousLogs: readonly AttendanceLog[]
  ) => Promise<void>;
  addSubject: (input: SubjectInput) => Promise<Subject>;
  updateSubject: (id: string, input: Partial<SubjectInput>) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<void>;
  updateSubjectsStartingCounts: (
    updates: readonly StartingCountUpdate[]
  ) => Promise<void>;
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

const DataStateContext = createContext<DataStateValue | null>(null);
const DataStatsContext = createContext<DataStatsValue | null>(null);
const DataDerivedContext = createContext<DataDerivedValue | null>(null);
const DataDateLogsContext = createContext<DataDateLogsValue | null>(null);
const DataActionsContext = createContext<DataActionsValue | null>(null);

const DATA_CACHE_PREFIX = 'bunksmart:data:';
const FRESHNESS_WINDOW_MS = 30_000;
const STATS_REFRESH_DEBOUNCE_MS = 1200;
const MAX_DATE_LOGS_CACHE = 7;
const MAX_SUBJECT_LOGS_CACHE = 5;

interface CachedData {
  subjects: Subject[];
  slots: TimetableSlot[];
  statsBySubject: Record<string, SubjectStats>;
}

interface SubjectLogsCacheEntry {
  logs: AttendanceLog[];
  fetchedAt: number;
}

const EMPTY_BASELINE_LOGS: LogsAfterBaselineCounts = {
  present: 0,
  absent: 0,
};

async function readCachedData(userId: string): Promise<CachedData | null> {
  try {
    const raw = await AsyncStorage.getItem(`${DATA_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedData;
  } catch {
    return null;
  }
}

async function writeCachedData(
  userId: string,
  data: CachedData
): Promise<void> {
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

function computeStatusDelta(
  previousStatus: AttendanceStatus | null,
  nextStatus: AttendanceStatus | null
): { attended: number; conducted: number; cancelled: number } {
  let attended = 0;
  let conducted = 0;
  let cancelled = 0;

  if (previousStatus === 'present') {
    attended -= 1;
    conducted -= 1;
  } else if (previousStatus === 'absent') {
    conducted -= 1;
  } else if (previousStatus === 'cancelled') {
    cancelled -= 1;
  }

  if (nextStatus === 'present') {
    attended += 1;
    conducted += 1;
  } else if (nextStatus === 'absent') {
    conducted += 1;
  } else if (nextStatus === 'cancelled') {
    cancelled += 1;
  }

  return { attended, conducted, cancelled };
}

function applyDeltaToStatsMap(
  prev: Record<string, SubjectStats>,
  subjectById: Map<string, Subject>,
  userId: string | null,
  deltasBySubject: Map<
    string,
    { attended: number; conducted: number; cancelled: number }
  >
): Record<string, SubjectStats> {
  if (deltasBySubject.size === 0) {
    return prev;
  }

  const next = { ...prev };
  for (const [subjectId, delta] of deltasBySubject.entries()) {
    if (
      delta.attended === 0 &&
      delta.conducted === 0 &&
      delta.cancelled === 0
    ) {
      continue;
    }

    const current = next[subjectId];
    const subject = subjectById.get(subjectId);
    const baseAttended = current?.attended ?? subject?.initial_present ?? 0;
    const baseConducted = current?.conducted ?? subject?.initial_total ?? 0;
    const baseCancelled = current?.cancelled ?? 0;

    const nextAttended = Math.max(0, baseAttended + delta.attended);
    const nextConducted = Math.max(nextAttended, baseConducted + delta.conducted);
    const nextCancelled = Math.max(0, baseCancelled + delta.cancelled);

    next[subjectId] = {
      subject_id: subjectId,
      user_id: current?.user_id ?? subject?.user_id ?? userId ?? '',
      attended: nextAttended,
      conducted: nextConducted,
      cancelled: nextCancelled,
    };
  }

  return next;
}

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

/**
 * Provides split read-only entity, stats, derived, date-log cache, and
 * stable action contexts with 30-second freshness and optimistic mutations.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuthState();
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
  const [dateLogsByDate, setDateLogsByDate] = useState<
    Record<string, DateLogsCacheEntry>
  >({});

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
    setDateLogsByDate({});
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
  const statusRef = useRef<DataStatus>(status);
  const subjectsRef = useRef<Subject[]>(subjects);
  const slotsRef = useRef<TimetableSlot[]>(slots);
  const statsBySubjectRef =
    useRef<Record<string, SubjectStats>>(statsBySubject);
  const dateLogsByDateRef =
    useRef<Record<string, DateLogsCacheEntry>>(dateLogsByDate);
  const profileRef = useRef(profile);
  const hasCollegeBaselineRef = useRef(hasCollegeBaseline);
  const baselineDateRef = useRef(baselineDate);
  const baselineKeyRef = useRef(baselineKey);

  useEffect(() => {
    activeUserIdRef.current = userId;
    statusRef.current = status;
    subjectsRef.current = subjects;
    slotsRef.current = slots;
    statsBySubjectRef.current = statsBySubject;
    dateLogsByDateRef.current = dateLogsByDate;
    profileRef.current = profile;
    hasCollegeBaselineRef.current = hasCollegeBaseline;
    baselineDateRef.current = baselineDate;
    baselineKeyRef.current = baselineKey;
  }, [
    userId,
    status,
    subjects,
    slots,
    statsBySubject,
    dateLogsByDate,
    profile,
    hasCollegeBaseline,
    baselineDate,
    baselineKey,
  ]);

  const dataFetchedAtRef = useRef(0);
  const statsFetchedAtRef = useRef(0);
  const loadedBaselineKeyRef = useRef<string | null>(null);
  const dateLogsOrderRef = useRef<string[]>([]);
  const inFlightDateFetchesRef = useRef<
    Map<string, Promise<AttendanceLog[]>>
  >(new Map());
  const subjectLogsCacheRef = useRef<Map<string, SubjectLogsCacheEntry>>(
    new Map()
  );
  const inFlightSubjectFetchesRef = useRef<
    Map<string, Promise<AttendanceLog[]>>
  >(new Map());
  const slotWriteQueuesRef = useRef<Map<string, Promise<void>>>(new Map());
  const committedSlotLogsRef = useRef<Map<string, AttendanceLog | null>>(
    new Map()
  );
  const inFlightWritesCountRef = useRef(0);
  const statsDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (statsDebounceTimerRef.current !== null) {
        clearTimeout(statsDebounceTimerRef.current);
        statsDebounceTimerRef.current = null;
      }
    };
  }, []);

  const persistCurrentSnapshot = useCallback(
    (
      targetUserId: string,
      nextSubjects: Subject[],
      nextSlots: TimetableSlot[],
      nextStats: Record<string, SubjectStats>
    ) => {
      void writeCachedData(targetUserId, {
        subjects: nextSubjects,
        slots: nextSlots,
        statsBySubject: nextStats,
      });
    },
    []
  );

  const touchDateLogsCache = useCallback(
    (dateStr: string, logs: AttendanceLog[], fetchedAt: number) => {
      const nextOrder = dateLogsOrderRef.current.filter((d) => d !== dateStr);
      nextOrder.push(dateStr);

      let evictedKey: string | undefined;
      while (nextOrder.length > MAX_DATE_LOGS_CACHE) {
        evictedKey = nextOrder.shift();
      }
      dateLogsOrderRef.current = nextOrder;

      setDateLogsByDate((prev) => {
        const next: Record<string, DateLogsCacheEntry> = {
          ...prev,
          [dateStr]: { logs, fetchedAt },
        };
        if (evictedKey && evictedKey !== dateStr) {
          delete next[evictedKey];
        }
        dateLogsByDateRef.current = next;
        return next;
      });
    },
    []
  );

  const touchDateLogsOrderOnly = useCallback((dateStr: string) => {
    const nextOrder = dateLogsOrderRef.current.filter((d) => d !== dateStr);
    nextOrder.push(dateStr);
    dateLogsOrderRef.current = nextOrder;
  }, []);

  const invalidateSubjectLogs = useCallback((subjectIds: Iterable<string>) => {
    for (const id of subjectIds) {
      subjectLogsCacheRef.current.delete(id);
    }
  }, []);

  const reloadStats = useCallback(async (force = false): Promise<void> => {
    const currentUserId = activeUserIdRef.current;
    if (!currentUserId) {
      return;
    }

    if (
      !force &&
      statsFetchedAtRef.current > 0 &&
      Date.now() - statsFetchedAtRef.current < FRESHNESS_WINDOW_MS
    ) {
      return;
    }

    const baselineRequestId = ++baselineRequestIdRef.current;
    const useBaseline = hasCollegeBaselineRef.current;
    const currentBaselineDate = baselineDateRef.current;

    try {
      const [loadedStats, afterCounts] = await Promise.all([
        fetchSubjectStats(),
        useBaseline && currentBaselineDate
          ? countLogsAfterDate(currentBaselineDate)
          : Promise.resolve(EMPTY_BASELINE_LOGS),
      ]);
      if (!mountedRef.current || activeUserIdRef.current !== currentUserId) {
        return;
      }
      const nextStats = buildStatsMap(loadedStats);
      statsFetchedAtRef.current = Date.now();
      statsBySubjectRef.current = nextStats;
      setStatsBySubject(nextStats);
      if (baselineRequestIdRef.current === baselineRequestId) {
        setLogsAfterBaseline(afterCounts);
        loadedBaselineKeyRef.current = baselineKeyRef.current;
      }
      persistCurrentSnapshot(
        currentUserId,
        subjectsRef.current,
        slotsRef.current,
        nextStats
      );
    } catch {
      // Keep current stats on silent stats refresh failure.
    }
  }, [persistCurrentSnapshot]);

  const scheduleStatsRefresh = useCallback(() => {
    if (statsDebounceTimerRef.current !== null) {
      clearTimeout(statsDebounceTimerRef.current);
      statsDebounceTimerRef.current = null;
    }

    statsDebounceTimerRef.current = setTimeout(() => {
      statsDebounceTimerRef.current = null;
      if (!mountedRef.current || inFlightWritesCountRef.current > 0) {
        return;
      }
      void reloadStats(true);
    }, STATS_REFRESH_DEBOUNCE_MS);
  }, [reloadStats]);

  const reload = useCallback(
    async (force = true, silent = false): Promise<void> => {
      const currentUserId = activeUserIdRef.current;
      if (!currentUserId) {
        return;
      }

      if (
        !force &&
        dataFetchedAtRef.current > 0 &&
        Date.now() - dataFetchedAtRef.current < FRESHNESS_WINDOW_MS &&
        statusRef.current === 'ready'
      ) {
        return;
      }

      const requestId = ++requestIdRef.current;
      const baselineRequestId = ++baselineRequestIdRef.current;
      const useBaseline = hasCollegeBaselineRef.current;
      const currentBaselineDate = baselineDateRef.current;

      if (!silent) {
        setStatus('loading');
        setError(null);
      }

      try {
        const [data, afterCounts] = await Promise.all([
          fetchAllData(),
          useBaseline && currentBaselineDate
            ? countLogsAfterDate(currentBaselineDate)
            : Promise.resolve(EMPTY_BASELINE_LOGS),
        ]);

        if (
          !mountedRef.current ||
          requestIdRef.current !== requestId ||
          activeUserIdRef.current !== currentUserId
        ) {
          return;
        }

        const now = Date.now();
        dataFetchedAtRef.current = now;
        statsFetchedAtRef.current = now;
        subjectsRef.current = data.subjects;
        slotsRef.current = data.slots;
        statsBySubjectRef.current = data.statsBySubject;
        setSubjects(data.subjects);
        setSlots(data.slots);
        setStatsBySubject(data.statsBySubject);
        if (baselineRequestIdRef.current === baselineRequestId) {
          setLogsAfterBaseline(afterCounts);
          loadedBaselineKeyRef.current = baselineKeyRef.current;
        }
        setError(null);
        setStatus('ready');
        persistCurrentSnapshot(
          currentUserId,
          data.subjects,
          data.slots,
          data.statsBySubject
        );
      } catch (err) {
        if (
          !mountedRef.current ||
          requestIdRef.current !== requestId ||
          activeUserIdRef.current !== currentUserId
        ) {
          return;
        }

        if (!silent) {
          setError(getFriendlyErrorMessage(err));
          setStatus('error');
        } else {
          throw toAppError(err);
        }
      }
    },
    [persistCurrentSnapshot]
  );

  useEffect(() => {
    activeUserIdRef.current = userId;
    const requestId = ++requestIdRef.current;
    const baselineRequestId = ++baselineRequestIdRef.current;

    dataFetchedAtRef.current = 0;
    statsFetchedAtRef.current = 0;
    loadedBaselineKeyRef.current = null;
    dateLogsOrderRef.current = [];
    inFlightDateFetchesRef.current.clear();
    subjectLogsCacheRef.current.clear();
    inFlightSubjectFetchesRef.current.clear();
    slotWriteQueuesRef.current.clear();
    committedSlotLogsRef.current.clear();
    if (statsDebounceTimerRef.current !== null) {
      clearTimeout(statsDebounceTimerRef.current);
      statsDebounceTimerRef.current = null;
    }

    let cancelled = false;

    const loadInitial = async () => {
      if (!userId) {
        subjectsRef.current = [];
        slotsRef.current = [];
        statsBySubjectRef.current = {};
        setSubjects([]);
        setSlots([]);
        setStatsBySubject({});
        setStatus('ready');
        return;
      }

      try {
        const cached = await readCachedData(userId);
        if (
          cached &&
          !cancelled &&
          mountedRef.current &&
          activeUserIdRef.current === userId
        ) {
          subjectsRef.current = cached.subjects;
          slotsRef.current = cached.slots;
          statsBySubjectRef.current = cached.statsBySubject;
          setSubjects(cached.subjects);
          setSlots(cached.slots);
          setStatsBySubject(cached.statsBySubject);
          setStatus('ready');
        }
      } catch {
        // Cache read failure is non-fatal
      }

      const useBaseline = hasCollegeBaselineRef.current;
      const currentBaselineDate = baselineDateRef.current;

      try {
        const [data, afterCounts] = await Promise.all([
          fetchAllData(),
          useBaseline && currentBaselineDate
            ? countLogsAfterDate(currentBaselineDate)
            : Promise.resolve(EMPTY_BASELINE_LOGS),
        ]);
        if (
          cancelled ||
          !mountedRef.current ||
          requestIdRef.current !== requestId ||
          activeUserIdRef.current !== userId
        ) {
          return;
        }

        const now = Date.now();
        dataFetchedAtRef.current = now;
        statsFetchedAtRef.current = now;
        subjectsRef.current = data.subjects;
        slotsRef.current = data.slots;
        statsBySubjectRef.current = data.statsBySubject;
        setSubjects(data.subjects);
        setSlots(data.slots);
        setStatsBySubject(data.statsBySubject);
        if (baselineRequestIdRef.current === baselineRequestId) {
          setLogsAfterBaseline(afterCounts);
          loadedBaselineKeyRef.current = baselineKeyRef.current;
        }
        setError(null);
        setStatus('ready');
        persistCurrentSnapshot(
          userId,
          data.subjects,
          data.slots,
          data.statsBySubject
        );
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
  }, [userId, persistCurrentSnapshot]);

  useEffect(() => {
    if (!userId || !hasCollegeBaseline || !baselineDate) {
      return;
    }

    if (loadedBaselineKeyRef.current === baselineKey) {
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
        loadedBaselineKeyRef.current = baselineKey;
        setLogsAfterBaseline(counts);
      } catch {
        // Keep last known counts on silent baseline count refresh failure.
      }
    };

    void loadBaselineLogs();

    return () => {
      cancelled = true;
    };
  }, [userId, hasCollegeBaseline, baselineDate, baselineKey]);

  const loadDateLogs = useCallback(
    async (dateStr: string, force = false): Promise<AttendanceLog[]> => {
      const currentUserId = activeUserIdRef.current;
      if (!currentUserId) {
        return [];
      }

      const cached = dateLogsByDateRef.current[dateStr];
      if (
        !force &&
        cached &&
        Date.now() - cached.fetchedAt < FRESHNESS_WINDOW_MS
      ) {
        touchDateLogsOrderOnly(dateStr);
        return cached.logs;
      }

      const existingInFlight = inFlightDateFetchesRef.current.get(dateStr);
      if (existingInFlight && !force) {
        return existingInFlight;
      }

      const request = (async () => {
        try {
          const rows = await fetchLogsForDate(dateStr);
          if (mountedRef.current && activeUserIdRef.current === currentUserId) {
            touchDateLogsCache(dateStr, rows, Date.now());
            for (const row of rows) {
              if (row.slot_id) {
                committedSlotLogsRef.current.set(`${dateStr}:${row.slot_id}`, row);
              }
            }
          }
          return rows;
        } catch (err) {
          throw toAppError(err);
        } finally {
          inFlightDateFetchesRef.current.delete(dateStr);
        }
      })();

      inFlightDateFetchesRef.current.set(dateStr, request);
      return request;
    },
    [touchDateLogsCache, touchDateLogsOrderOnly]
  );

  const loadSubjectLogs = useCallback(
    async (subjectId: string, force = false): Promise<AttendanceLog[]> => {
      const currentUserId = activeUserIdRef.current;
      if (!currentUserId) {
        return [];
      }

      const cached = subjectLogsCacheRef.current.get(subjectId);
      if (
        !force &&
        cached &&
        Date.now() - cached.fetchedAt < FRESHNESS_WINDOW_MS
      ) {
        return cached.logs;
      }

      const existingInFlight = inFlightSubjectFetchesRef.current.get(subjectId);
      if (existingInFlight && !force) {
        return existingInFlight;
      }

      const request = (async () => {
        try {
          const rows = await fetchLogsForSubject(subjectId);
          if (mountedRef.current && activeUserIdRef.current === currentUserId) {
            subjectLogsCacheRef.current.delete(subjectId);
            subjectLogsCacheRef.current.set(subjectId, {
              logs: rows,
              fetchedAt: Date.now(),
            });
            while (subjectLogsCacheRef.current.size > MAX_SUBJECT_LOGS_CACHE) {
              const oldestKey = subjectLogsCacheRef.current.keys().next().value;
              if (oldestKey === undefined) break;
              subjectLogsCacheRef.current.delete(oldestKey);
            }
          }
          return rows;
        } catch (err) {
          throw toAppError(err);
        } finally {
          inFlightSubjectFetchesRef.current.delete(subjectId);
        }
      })();

      inFlightSubjectFetchesRef.current.set(subjectId, request);
      return request;
    },
    []
  );

  const getCachedSubjectLogs = useCallback(
    (subjectId: string): AttendanceLog[] | null => {
      if (!activeUserIdRef.current) {
        return null;
      }
      const cached = subjectLogsCacheRef.current.get(subjectId);
      if (
        cached &&
        Date.now() - cached.fetchedAt < FRESHNESS_WINDOW_MS
      ) {
        return cached.logs;
      }
      return null;
    },
    []
  );

  const applyLocalStatsAndBaselineDeltas = useCallback(
    (
      deltasBySubject: Map<
        string,
        { attended: number; conducted: number; cancelled: number }
      >,
      baselinePresentDelta: number,
      baselineAbsentDelta: number
    ) => {
      const currentUserId = activeUserIdRef.current;
      const subjectMap = new Map(subjectsRef.current.map((s) => [s.id, s]));

      setStatsBySubject((prev) => {
        const next = applyDeltaToStatsMap(
          prev,
          subjectMap,
          currentUserId,
          deltasBySubject
        );
        statsBySubjectRef.current = next;
        if (currentUserId) {
          persistCurrentSnapshot(
            currentUserId,
            subjectsRef.current,
            slotsRef.current,
            next
          );
        }
        return next;
      });

      if (baselinePresentDelta !== 0 || baselineAbsentDelta !== 0) {
        setLogsAfterBaseline((prev) => ({
          present: Math.max(0, prev.present + baselinePresentDelta),
          absent: Math.max(0, prev.absent + baselineAbsentDelta),
        }));
      }
    },
    [persistCurrentSnapshot]
  );

  const applySlotStatusTransition = useCallback(
    async ({
      slot,
      subject,
      targetDate,
      nextAttendanceStatus,
      onOptimistic,
    }: {
      slot: TimetableSlot;
      subject: Subject;
      targetDate: string;
      nextAttendanceStatus: AttendanceStatus | null;
      onOptimistic?: (result: MarkSlotResult) => void;
    }): Promise<MarkSlotResult> => {
      const currentUserId = activeUserIdRef.current;
      if (!currentUserId) {
        return {
          previousStatus: null,
          nextStatus: null,
          attended: subject.initial_present,
          held: subject.initial_total,
        };
      }

      const existingEntry = dateLogsByDateRef.current[targetDate];
      const currentLogs = existingEntry?.logs ?? [];
      const previousLog =
        currentLogs.find((item) => item.slot_id === slot.id) ?? null;
      const previousStatus = previousLog?.status ?? null;
      const isClearing = nextAttendanceStatus === null;

      const currentStat = statsBySubjectRef.current[subject.id];
      const baseAttended = currentStat?.attended ?? subject.initial_present;
      const baseConducted = currentStat?.conducted ?? subject.initial_total;

      const delta = computeStatusDelta(previousStatus, nextAttendanceStatus);
      const nextAttended = Math.max(0, baseAttended + delta.attended);
      const nextHeld = Math.max(nextAttended, baseConducted + delta.conducted);
      const result: MarkSlotResult = {
        previousStatus,
        nextStatus: nextAttendanceStatus,
        attended: nextAttended,
        held: nextHeld,
      };

      if (previousStatus === nextAttendanceStatus) {
        onOptimistic?.(result);
        return result;
      }

      const queueKey = `${targetDate}:${slot.id}`;
      if (!committedSlotLogsRef.current.has(queueKey)) {
        committedSlotLogsRef.current.set(queueKey, previousLog);
      }

      const deltasMap = new Map([[subject.id, delta]]);

      const affectsBaseline =
        hasCollegeBaselineRef.current &&
        baselineDateRef.current !== null &&
        targetDate > baselineDateRef.current;

      let baselinePresentDelta = 0;
      let baselineAbsentDelta = 0;
      if (affectsBaseline) {
        if (previousStatus === 'present') baselinePresentDelta -= 1;
        else if (previousStatus === 'absent') baselineAbsentDelta -= 1;
        if (nextAttendanceStatus === 'present') baselinePresentDelta += 1;
        else if (nextAttendanceStatus === 'absent') baselineAbsentDelta += 1;
      }

      // 1. Update local state and date cache immediately
      applyLocalStatsAndBaselineDeltas(
        deltasMap,
        baselinePresentDelta,
        baselineAbsentDelta
      );
      invalidateSubjectLogs([subject.id]);

      const optimisticId = `pending-${slot.id}-${Date.now()}`;
      const nextLogs = isClearing
        ? currentLogs.filter((item) => item.slot_id !== slot.id)
        : [
            ...currentLogs.filter((item) => item.slot_id !== slot.id),
            previousLog
              ? { ...previousLog, status: nextAttendanceStatus }
              : {
                  id: optimisticId,
                  user_id: subject.user_id || currentUserId,
                  subject_id: subject.id,
                  slot_id: slot.id,
                  log_date: targetDate,
                  status: nextAttendanceStatus,
                  created_at: '',
                  updated_at: '',
                },
          ];

      touchDateLogsCache(
        targetDate,
        nextLogs,
        existingEntry?.fetchedAt ?? Date.now()
      );
      onOptimistic?.(result);

      // 2. Sync to Supabase sequentially per slot in background
      const previousQueue =
        slotWriteQueuesRef.current.get(queueKey) ?? Promise.resolve();

      let writeError: AppError | null = null;
      const nextQueue = previousQueue
        .catch(() => undefined)
        .then(async () => {
          inFlightWritesCountRef.current += 1;
          try {
            const committed =
              committedSlotLogsRef.current.get(queueKey) ?? previousLog;

            if (isClearing) {
              if (committed && !committed.id.startsWith('pending-')) {
                await clearLogStatus(committed.id);
              }
              committedSlotLogsRef.current.set(queueKey, null);
            } else {
              const saved = await setSlotLogStatus({
                subject_id: subject.id,
                slot_id: slot.id,
                log_date: targetDate,
                status: nextAttendanceStatus,
              });
              committedSlotLogsRef.current.set(queueKey, saved);

              if (
                mountedRef.current &&
                activeUserIdRef.current === currentUserId
              ) {
                const latestEntry = dateLogsByDateRef.current[targetDate];
                const latestLogs = latestEntry?.logs ?? [];
                const currentOptimistic = latestLogs.find(
                  (item) => item.slot_id === slot.id
                );
                if (
                  currentOptimistic &&
                  currentOptimistic.status === nextAttendanceStatus
                ) {
                  touchDateLogsCache(
                    targetDate,
                    latestLogs.map((item) =>
                      item.slot_id === slot.id ? saved : item
                    ),
                    Date.now()
                  );
                }
              }
            }

            if (mountedRef.current) {
              scheduleStatsRefresh();
            }
          } catch (err) {
            // Revert exact delta for this failed transition
            const revertDeltas = new Map([
              [
                subject.id,
                {
                  attended: -delta.attended,
                  conducted: -delta.conducted,
                  cancelled: -delta.cancelled,
                },
              ],
            ]);
            if (
              mountedRef.current &&
              activeUserIdRef.current === currentUserId
            ) {
              applyLocalStatsAndBaselineDeltas(
                revertDeltas,
                -baselinePresentDelta,
                -baselineAbsentDelta
              );

              const committed =
                committedSlotLogsRef.current.get(queueKey) ?? null;
              const latestEntry = dateLogsByDateRef.current[targetDate];
              const latestLogs = latestEntry?.logs ?? [];
              const restoredLogs = committed
                ? [
                    ...latestLogs.filter((item) => item.slot_id !== slot.id),
                    committed,
                  ]
                : latestLogs.filter((item) => item.slot_id !== slot.id);
              touchDateLogsCache(
                targetDate,
                restoredLogs,
                latestEntry?.fetchedAt ?? Date.now()
              );
            }
            writeError = toAppError(err);
          } finally {
            inFlightWritesCountRef.current = Math.max(
              0,
              inFlightWritesCountRef.current - 1
            );
            if (inFlightWritesCountRef.current === 0 && !writeError) {
              scheduleStatsRefresh();
            }
          }
        });

      slotWriteQueuesRef.current.set(queueKey, nextQueue);
      await nextQueue;
      if (slotWriteQueuesRef.current.get(queueKey) === nextQueue) {
        slotWriteQueuesRef.current.delete(queueKey);
      }

      if (writeError) {
        throw writeError;
      }

      return result;
    },
    [
      applyLocalStatsAndBaselineDeltas,
      invalidateSubjectLogs,
      scheduleStatsRefresh,
      touchDateLogsCache,
    ]
  );

  const markSlotStatus = useCallback(
    async ({
      slot,
      subject,
      targetDate,
      nextStatus,
      onOptimistic,
    }: MarkSlotStatusParams): Promise<MarkSlotResult> => {
      const existingEntry = dateLogsByDateRef.current[targetDate];
      const currentLogs = existingEntry?.logs ?? [];
      const previousLog =
        currentLogs.find((item) => item.slot_id === slot.id) ?? null;
      const previousStatus = previousLog?.status ?? null;
      const nextAttendanceStatus =
        previousStatus === nextStatus ? null : nextStatus;

      return applySlotStatusTransition({
        slot,
        subject,
        targetDate,
        nextAttendanceStatus,
        onOptimistic,
      });
    },
    [applySlotStatusTransition]
  );

  const restoreSlotStatus = useCallback(
    async ({
      slot,
      subject,
      targetDate,
      targetStatus,
    }: RestoreSlotStatusParams): Promise<void> => {
      await applySlotStatusTransition({
        slot,
        subject,
        targetDate,
        nextAttendanceStatus: targetStatus,
      });
    },
    [applySlotStatusTransition]
  );

  const markDateBatchStatus = useCallback(
    async (
      targetDate: string,
      daySlots: readonly TimetableSlot[],
      nextStatus: AttendanceStatus,
      onOptimistic?: (previousLogs: readonly AttendanceLog[]) => void
    ): Promise<readonly AttendanceLog[]> => {
      const currentUserId = activeUserIdRef.current;
      if (!currentUserId || daySlots.length === 0) {
        return [];
      }

      const existingEntry = dateLogsByDateRef.current[targetDate];
      const previousLogs = [...(existingEntry?.logs ?? [])];
      const prevBySlot = new Map<string, AttendanceLog>();
      for (const log of previousLogs) {
        if (log.slot_id) {
          prevBySlot.set(log.slot_id, log);
        }
      }

      const deltasMap = new Map<
        string,
        { attended: number; conducted: number; cancelled: number }
      >();
      const affectedSubjectIds = new Set<string>();
      let baselinePresentDelta = 0;
      let baselineAbsentDelta = 0;
      const affectsBaseline =
        hasCollegeBaselineRef.current &&
        baselineDateRef.current !== null &&
        targetDate > baselineDateRef.current;

      const optimisticLogs: AttendanceLog[] = [];
      const daySlotIds = new Set(daySlots.map((s) => s.id));
      for (const log of previousLogs) {
        if (!log.slot_id || !daySlotIds.has(log.slot_id)) {
          optimisticLogs.push(log);
        }
      }

      for (const slot of daySlots) {
        const prevLog = prevBySlot.get(slot.id);
        const prevStatus = prevLog?.status ?? null;
        affectedSubjectIds.add(slot.subject_id);

        if (prevStatus !== nextStatus) {
          const delta = computeStatusDelta(prevStatus, nextStatus);
          const existingDelta = deltasMap.get(slot.subject_id) ?? {
            attended: 0,
            conducted: 0,
            cancelled: 0,
          };
          deltasMap.set(slot.subject_id, {
            attended: existingDelta.attended + delta.attended,
            conducted: existingDelta.conducted + delta.conducted,
            cancelled: existingDelta.cancelled + delta.cancelled,
          });

          if (affectsBaseline) {
            if (prevStatus === 'present') baselinePresentDelta -= 1;
            else if (prevStatus === 'absent') baselineAbsentDelta -= 1;
            if (nextStatus === 'present') baselinePresentDelta += 1;
            else if (nextStatus === 'absent') baselineAbsentDelta += 1;
          }
        }

        optimisticLogs.push(
          prevLog
            ? { ...prevLog, status: nextStatus }
            : {
                id: `pending-${slot.id}`,
                user_id: slot.user_id || currentUserId,
                subject_id: slot.subject_id,
                slot_id: slot.id,
                log_date: targetDate,
                status: nextStatus,
                created_at: '',
                updated_at: '',
              }
        );
      }

      // 1. Update local state first
      applyLocalStatsAndBaselineDeltas(
        deltasMap,
        baselinePresentDelta,
        baselineAbsentDelta
      );
      invalidateSubjectLogs(affectedSubjectIds);
      touchDateLogsCache(targetDate, optimisticLogs, Date.now());
      onOptimistic?.(previousLogs);

      // 2. Sync batch to server
      inFlightWritesCountRef.current += 1;
      try {
        const savedLogs = await setDateLogsStatusBatch(
          daySlots.map((slot) => ({
            subject_id: slot.subject_id,
            slot_id: slot.id,
            log_date: targetDate,
            status: nextStatus,
          }))
        );

        if (mountedRef.current && activeUserIdRef.current === currentUserId) {
          touchDateLogsCache(targetDate, savedLogs, Date.now());
          for (const row of savedLogs) {
            if (row.slot_id) {
              committedSlotLogsRef.current.set(
                `${targetDate}:${row.slot_id}`,
                row
              );
            }
          }
          scheduleStatsRefresh();
        }
        return previousLogs;
      } catch (err) {
        if (mountedRef.current && activeUserIdRef.current === currentUserId) {
          const revertDeltas = new Map<
            string,
            { attended: number; conducted: number; cancelled: number }
          >();
          for (const [id, delta] of deltasMap.entries()) {
            revertDeltas.set(id, {
              attended: -delta.attended,
              conducted: -delta.conducted,
              cancelled: -delta.cancelled,
            });
          }
          applyLocalStatsAndBaselineDeltas(
            revertDeltas,
            -baselinePresentDelta,
            -baselineAbsentDelta
          );
          touchDateLogsCache(
            targetDate,
            previousLogs,
            existingEntry?.fetchedAt ?? Date.now()
          );
        }
        throw toAppError(err);
      } finally {
        inFlightWritesCountRef.current = Math.max(
          0,
          inFlightWritesCountRef.current - 1
        );
      }
    },
    [
      applyLocalStatsAndBaselineDeltas,
      invalidateSubjectLogs,
      scheduleStatsRefresh,
      touchDateLogsCache,
    ]
  );

  const clearDateLogs = useCallback(
    async (
      targetDate: string,
      onOptimistic?: (previousLogs: readonly AttendanceLog[]) => void
    ): Promise<readonly AttendanceLog[]> => {
      const currentUserId = activeUserIdRef.current;
      if (!currentUserId) {
        return [];
      }

      const existingEntry = dateLogsByDateRef.current[targetDate];
      const previousLogs = [...(existingEntry?.logs ?? [])];
      const deltasMap = new Map<
        string,
        { attended: number; conducted: number; cancelled: number }
      >();
      const affectedSubjectIds = new Set<string>();
      let baselinePresentDelta = 0;
      let baselineAbsentDelta = 0;
      const affectsBaseline =
        hasCollegeBaselineRef.current &&
        baselineDateRef.current !== null &&
        targetDate > baselineDateRef.current;

      for (const log of previousLogs) {
        affectedSubjectIds.add(log.subject_id);
        const delta = computeStatusDelta(log.status, null);
        const existingDelta = deltasMap.get(log.subject_id) ?? {
          attended: 0,
          conducted: 0,
          cancelled: 0,
        };
        deltasMap.set(log.subject_id, {
          attended: existingDelta.attended + delta.attended,
          conducted: existingDelta.conducted + delta.conducted,
          cancelled: existingDelta.cancelled + delta.cancelled,
        });

        if (affectsBaseline) {
          if (log.status === 'present') baselinePresentDelta -= 1;
          else if (log.status === 'absent') baselineAbsentDelta -= 1;
        }
      }

      // 1. Update local state first
      applyLocalStatsAndBaselineDeltas(
        deltasMap,
        baselinePresentDelta,
        baselineAbsentDelta
      );
      invalidateSubjectLogs(affectedSubjectIds);
      touchDateLogsCache(targetDate, [], Date.now());
      onOptimistic?.(previousLogs);

      // 2. Sync clear to server
      inFlightWritesCountRef.current += 1;
      try {
        await deleteLogsForDate(targetDate);
        if (mountedRef.current && activeUserIdRef.current === currentUserId) {
          for (const key of Array.from(committedSlotLogsRef.current.keys())) {
            if (key.startsWith(`${targetDate}:`)) {
              committedSlotLogsRef.current.set(key, null);
            }
          }
          scheduleStatsRefresh();
        }
        return previousLogs;
      } catch (err) {
        if (mountedRef.current && activeUserIdRef.current === currentUserId) {
          const revertDeltas = new Map<
            string,
            { attended: number; conducted: number; cancelled: number }
          >();
          for (const [id, delta] of deltasMap.entries()) {
            revertDeltas.set(id, {
              attended: -delta.attended,
              conducted: -delta.conducted,
              cancelled: -delta.cancelled,
            });
          }
          applyLocalStatsAndBaselineDeltas(
            revertDeltas,
            -baselinePresentDelta,
            -baselineAbsentDelta
          );
          touchDateLogsCache(
            targetDate,
            previousLogs,
            existingEntry?.fetchedAt ?? Date.now()
          );
        }
        throw toAppError(err);
      } finally {
        inFlightWritesCountRef.current = Math.max(
          0,
          inFlightWritesCountRef.current - 1
        );
      }
    },
    [
      applyLocalStatsAndBaselineDeltas,
      invalidateSubjectLogs,
      scheduleStatsRefresh,
      touchDateLogsCache,
    ]
  );

  const restoreDateLogs = useCallback(
    async (
      targetDate: string,
      previousLogs: readonly AttendanceLog[]
    ): Promise<void> => {
      const currentUserId = activeUserIdRef.current;
      if (!currentUserId) {
        return;
      }

      const existingEntry = dateLogsByDateRef.current[targetDate];
      const currentLogs = [...(existingEntry?.logs ?? [])];

      const deltasMap = new Map<
        string,
        { attended: number; conducted: number; cancelled: number }
      >();
      const affectedSubjectIds = new Set<string>();
      let baselinePresentDelta = 0;
      let baselineAbsentDelta = 0;
      const affectsBaseline =
        hasCollegeBaselineRef.current &&
        baselineDateRef.current !== null &&
        targetDate > baselineDateRef.current;

      const addDeltaForLog = (log: AttendanceLog, direction: 1 | -1) => {
        affectedSubjectIds.add(log.subject_id);
        const raw =
          direction === 1
            ? computeStatusDelta(null, log.status)
            : computeStatusDelta(log.status, null);
        const existingDelta = deltasMap.get(log.subject_id) ?? {
          attended: 0,
          conducted: 0,
          cancelled: 0,
        };
        deltasMap.set(log.subject_id, {
          attended: existingDelta.attended + raw.attended,
          conducted: existingDelta.conducted + raw.conducted,
          cancelled: existingDelta.cancelled + raw.cancelled,
        });

        if (affectsBaseline) {
          if (log.status === 'present') baselinePresentDelta += direction;
          else if (log.status === 'absent') baselineAbsentDelta += direction;
        }
      };

      for (const log of currentLogs) {
        addDeltaForLog(log, -1);
      }
      for (const log of previousLogs) {
        addDeltaForLog(log, 1);
      }

      // 1. Update local state immediately
      applyLocalStatsAndBaselineDeltas(
        deltasMap,
        baselinePresentDelta,
        baselineAbsentDelta
      );
      invalidateSubjectLogs(affectedSubjectIds);
      touchDateLogsCache(targetDate, [...previousLogs], Date.now());

      // 2. Sync restored day logs to server
      inFlightWritesCountRef.current += 1;
      try {
        if (previousLogs.length === 0) {
          await deleteLogsForDate(targetDate);
          if (mountedRef.current && activeUserIdRef.current === currentUserId) {
            for (const key of Array.from(committedSlotLogsRef.current.keys())) {
              if (key.startsWith(`${targetDate}:`)) {
                committedSlotLogsRef.current.set(key, null);
              }
            }
          }
        } else {
          const prevSlotIds = new Set(
            previousLogs
              .map((log) => log.slot_id)
              .filter((id): id is string => Boolean(id))
          );
          const slotIdsToDelete = currentLogs
            .map((log) => log.slot_id)
            .filter(
              (id): id is string =>
                typeof id === 'string' && id.length > 0 && !prevSlotIds.has(id)
            );

          const slottedToRestore = previousLogs.filter(
            (log): log is AttendanceLog & { slot_id: string } =>
              Boolean(log.slot_id)
          );
          const manualToRestore = previousLogs.filter(
            (log) => log.slot_id === null
          );

          const [savedSlotted, savedManual] = await Promise.all([
            slottedToRestore.length > 0
              ? setDateLogsStatusBatch(
                  slottedToRestore.map((log) => ({
                    subject_id: log.subject_id,
                    slot_id: log.slot_id,
                    log_date: targetDate,
                    status: log.status,
                  }))
                )
              : Promise.resolve([]),
            manualToRestore.length > 0 &&
            !currentLogs.some((log) => log.slot_id === null)
              ? insertManualLogsBatch(
                  manualToRestore.map((log) => ({
                    subject_id: log.subject_id,
                    log_date: targetDate,
                    status: log.status,
                  }))
                )
              : Promise.resolve(manualToRestore),
            deleteLogsForSlotsOnDate(targetDate, slotIdsToDelete),
          ]);

          const restoredList = [...savedSlotted, ...savedManual];
          if (mountedRef.current && activeUserIdRef.current === currentUserId) {
            touchDateLogsCache(targetDate, restoredList, Date.now());
            for (const slotId of slotIdsToDelete) {
              committedSlotLogsRef.current.set(`${targetDate}:${slotId}`, null);
            }
            for (const row of restoredList) {
              if (row.slot_id) {
                committedSlotLogsRef.current.set(
                  `${targetDate}:${row.slot_id}`,
                  row
                );
              }
            }
          }
        }

        if (mountedRef.current && activeUserIdRef.current === currentUserId) {
          scheduleStatsRefresh();
        }
      } catch (err) {
        if (mountedRef.current && activeUserIdRef.current === currentUserId) {
          const revertDeltas = new Map<
            string,
            { attended: number; conducted: number; cancelled: number }
          >();
          for (const [id, delta] of deltasMap.entries()) {
            revertDeltas.set(id, {
              attended: -delta.attended,
              conducted: -delta.conducted,
              cancelled: -delta.cancelled,
            });
          }
          applyLocalStatsAndBaselineDeltas(
            revertDeltas,
            -baselinePresentDelta,
            -baselineAbsentDelta
          );
          touchDateLogsCache(
            targetDate,
            currentLogs,
            existingEntry?.fetchedAt ?? Date.now()
          );
        }
        throw toAppError(err);
      } finally {
        inFlightWritesCountRef.current = Math.max(
          0,
          inFlightWritesCountRef.current - 1
        );
      }
    },
    [
      applyLocalStatsAndBaselineDeltas,
      invalidateSubjectLogs,
      scheduleStatsRefresh,
      touchDateLogsCache,
    ]
  );

  const addSubject = useCallback(
    async (input: SubjectInput): Promise<Subject> => {
      const currentUserId = activeUserIdRef.current;
      try {
        const created = await createSubjectRecord(input);
        const nextSubjects = sortSubjects([...subjectsRef.current, created]);
        const nextStats: Record<string, SubjectStats> = {
          ...statsBySubjectRef.current,
          [created.id]: {
            subject_id: created.id,
            user_id: created.user_id,
            attended: created.initial_present,
            conducted: created.initial_total,
            cancelled: 0,
          },
        };
        subjectsRef.current = nextSubjects;
        statsBySubjectRef.current = nextStats;
        setSubjects(nextSubjects);
        setStatsBySubject(nextStats);
        if (currentUserId) {
          persistCurrentSnapshot(
            currentUserId,
            nextSubjects,
            slotsRef.current,
            nextStats
          );
        }
        return created;
      } catch (err) {
        throw toAppError(err);
      }
    },
    [persistCurrentSnapshot]
  );

  const updateSubject = useCallback(
    async (id: string, input: Partial<SubjectInput>): Promise<Subject> => {
      const currentUserId = activeUserIdRef.current;
      const prevSubjects = subjectsRef.current;
      const prevStats = statsBySubjectRef.current;
      const existing = prevSubjects.find((item) => item.id === id);

      if (existing) {
        const nextPresent = input.initial_present ?? existing.initial_present;
        const nextTotal = input.initial_total ?? existing.initial_total;
        const deltaAttended = nextPresent - existing.initial_present;
        const deltaConducted = nextTotal - existing.initial_total;

        const optimisticSubject: Subject = {
          ...existing,
          name: input.name !== undefined ? input.name.trim() : existing.name,
          target_percent: input.target_percent ?? existing.target_percent,
          initial_present: nextPresent,
          initial_total: nextTotal,
        };
        const nextSubjects = sortSubjects(
          prevSubjects.map((s) => (s.id === id ? optimisticSubject : s))
        );
        subjectsRef.current = nextSubjects;
        setSubjects(nextSubjects);

        if (deltaAttended !== 0 || deltaConducted !== 0) {
          const currentStat = prevStats[id];
          const nextAttended = Math.max(
            0,
            (currentStat?.attended ?? existing.initial_present) + deltaAttended
          );
          const nextConducted = Math.max(
            nextAttended,
            (currentStat?.conducted ?? existing.initial_total) + deltaConducted
          );
          const nextStats = {
            ...prevStats,
            [id]: {
              subject_id: id,
              user_id: currentStat?.user_id ?? existing.user_id,
              attended: nextAttended,
              conducted: nextConducted,
              cancelled: currentStat?.cancelled ?? 0,
            },
          };
          statsBySubjectRef.current = nextStats;
          setStatsBySubject(nextStats);
        }
      }

      try {
        const updated = await updateSubjectRecord(id, input);
        const syncedSubjects = sortSubjects(
          subjectsRef.current.map((s) => (s.id === id ? updated : s))
        );
        subjectsRef.current = syncedSubjects;
        setSubjects(syncedSubjects);
        if (currentUserId) {
          persistCurrentSnapshot(
            currentUserId,
            syncedSubjects,
            slotsRef.current,
            statsBySubjectRef.current
          );
        }
        return updated;
      } catch (err) {
        subjectsRef.current = prevSubjects;
        statsBySubjectRef.current = prevStats;
        setSubjects(prevSubjects);
        setStatsBySubject(prevStats);
        throw toAppError(err);
      }
    },
    [persistCurrentSnapshot]
  );

  const deleteSubject = useCallback(
    async (id: string): Promise<void> => {
      const currentUserId = activeUserIdRef.current;
      const prevSubjects = subjectsRef.current;
      const prevSlots = slotsRef.current;
      const prevStats = statsBySubjectRef.current;
      const prevDateLogs = dateLogsByDateRef.current;

      const nextSubjects = prevSubjects.filter((item) => item.id !== id);
      const nextSlots = prevSlots.filter((item) => item.subject_id !== id);
      const nextStats = { ...prevStats };
      delete nextStats[id];

      const nextDateLogs: Record<string, DateLogsCacheEntry> = {};
      for (const [dateKey, entry] of Object.entries(prevDateLogs)) {
        nextDateLogs[dateKey] = {
          ...entry,
          logs: entry.logs.filter((log) => log.subject_id !== id),
        };
      }

      subjectsRef.current = nextSubjects;
      slotsRef.current = nextSlots;
      statsBySubjectRef.current = nextStats;
      dateLogsByDateRef.current = nextDateLogs;
      setSubjects(nextSubjects);
      setSlots(nextSlots);
      setStatsBySubject(nextStats);
      setDateLogsByDate(nextDateLogs);
      invalidateSubjectLogs([id]);

      try {
        await deleteSubjectRecord(id);
        if (currentUserId) {
          persistCurrentSnapshot(
            currentUserId,
            nextSubjects,
            nextSlots,
            nextStats
          );
        }
        if (hasCollegeBaselineRef.current) {
          scheduleStatsRefresh();
        }
      } catch (err) {
        subjectsRef.current = prevSubjects;
        slotsRef.current = prevSlots;
        statsBySubjectRef.current = prevStats;
        dateLogsByDateRef.current = prevDateLogs;
        setSubjects(prevSubjects);
        setSlots(prevSlots);
        setStatsBySubject(prevStats);
        setDateLogsByDate(prevDateLogs);
        throw toAppError(err);
      }
    },
    [invalidateSubjectLogs, persistCurrentSnapshot, scheduleStatsRefresh]
  );

  const updateSubjectsStartingCounts = useCallback(
    async (updates: readonly StartingCountUpdate[]): Promise<void> => {
      if (updates.length === 0) {
        return;
      }

      const currentUserId = activeUserIdRef.current;
      const prevSubjects = subjectsRef.current;
      const prevStats = statsBySubjectRef.current;
      const updateMap = new Map(updates.map((u) => [u.id, u]));

      const nextSubjects = prevSubjects.map((subject) => {
        const patch = updateMap.get(subject.id);
        if (!patch) return subject;
        return {
          ...subject,
          initial_present: patch.attended,
          initial_total: patch.held,
        };
      });

      const nextStats = { ...prevStats };
      for (const subject of prevSubjects) {
        const patch = updateMap.get(subject.id);
        if (!patch) continue;
        const currentStat = nextStats[subject.id];
        const deltaAttended = patch.attended - subject.initial_present;
        const deltaConducted = patch.held - subject.initial_total;
        const nextAttended = Math.max(
          0,
          (currentStat?.attended ?? subject.initial_present) + deltaAttended
        );
        const nextConducted = Math.max(
          nextAttended,
          (currentStat?.conducted ?? subject.initial_total) + deltaConducted
        );
        nextStats[subject.id] = {
          subject_id: subject.id,
          user_id: currentStat?.user_id ?? subject.user_id,
          attended: nextAttended,
          conducted: nextConducted,
          cancelled: currentStat?.cancelled ?? 0,
        };
      }

      subjectsRef.current = nextSubjects;
      statsBySubjectRef.current = nextStats;
      setSubjects(nextSubjects);
      setStatsBySubject(nextStats);

      try {
        const updatedRows = await Promise.all(
          updates.map((item) =>
            updateSubjectRecord(item.id, {
              initial_present: item.attended,
              initial_total: item.held,
            })
          )
        );
        const returnedById = new Map(updatedRows.map((row) => [row.id, row]));
        const syncedSubjects = subjectsRef.current.map(
          (s) => returnedById.get(s.id) ?? s
        );
        subjectsRef.current = syncedSubjects;
        setSubjects(syncedSubjects);
        if (currentUserId) {
          persistCurrentSnapshot(
            currentUserId,
            syncedSubjects,
            slotsRef.current,
            statsBySubjectRef.current
          );
        }
      } catch (err) {
        subjectsRef.current = prevSubjects;
        statsBySubjectRef.current = prevStats;
        setSubjects(prevSubjects);
        setStatsBySubject(prevStats);
        throw toAppError(err);
      }
    },
    [persistCurrentSnapshot]
  );

  const deleteAllAttendanceData = useCallback(async (): Promise<void> => {
    const currentUserId = activeUserIdRef.current;
    const prevSubjects = subjectsRef.current;
    const prevSlots = slotsRef.current;
    const prevStats = statsBySubjectRef.current;
    const prevDateLogs = dateLogsByDateRef.current;

    subjectsRef.current = [];
    slotsRef.current = [];
    statsBySubjectRef.current = {};
    dateLogsByDateRef.current = {};
    dateLogsOrderRef.current = [];
    subjectLogsCacheRef.current.clear();
    committedSlotLogsRef.current.clear();
    setSubjects([]);
    setSlots([]);
    setStatsBySubject({});
    setLogsAfterBaseline(EMPTY_BASELINE_LOGS);
    setDateLogsByDate({});

    try {
      await Promise.all([
        cancelAllClassReminders(),
        currentUserId
          ? deleteAllSubjectsRecord(currentUserId)
          : Promise.resolve(),
      ]);
      if (currentUserId) {
        void AsyncStorage.removeItem(`${DATA_CACHE_PREFIX}${currentUserId}`);
      }
      const now = Date.now();
      dataFetchedAtRef.current = now;
      statsFetchedAtRef.current = now;
    } catch (err) {
      subjectsRef.current = prevSubjects;
      slotsRef.current = prevSlots;
      statsBySubjectRef.current = prevStats;
      dateLogsByDateRef.current = prevDateLogs;
      setSubjects(prevSubjects);
      setSlots(prevSlots);
      setStatsBySubject(prevStats);
      setDateLogsByDate(prevDateLogs);
      throw toAppError(err);
    }
  }, []);

  const addSlot = useCallback(
    async (input: SlotInput): Promise<TimetableSlot> => {
      const currentUserId = activeUserIdRef.current;
      try {
        const created = await createSlotRecord(input);
        const nextSlots = sortSlots([...slotsRef.current, created]);
        slotsRef.current = nextSlots;
        setSlots(nextSlots);
        if (currentUserId) {
          persistCurrentSnapshot(
            currentUserId,
            subjectsRef.current,
            nextSlots,
            statsBySubjectRef.current
          );
        }
        return created;
      } catch (err) {
        throw toAppError(err);
      }
    },
    [persistCurrentSnapshot]
  );

  const updateSlot = useCallback(
    async (id: string, input: Partial<SlotInput>): Promise<TimetableSlot> => {
      const currentUserId = activeUserIdRef.current;
      const prevSlots = slotsRef.current;
      const existing = prevSlots.find((item) => item.id === id);

      if (existing) {
        const optimisticSlot: TimetableSlot = {
          ...existing,
          subject_id: input.subject_id ?? existing.subject_id,
          weekday: input.weekday ?? existing.weekday,
          start_time: input.start_time ?? existing.start_time,
          end_time:
            input.end_time !== undefined ? input.end_time : existing.end_time,
        };
        const nextSlots = sortSlots(
          prevSlots.map((s) => (s.id === id ? optimisticSlot : s))
        );
        slotsRef.current = nextSlots;
        setSlots(nextSlots);
      }

      try {
        const updated = await updateSlotRecord(id, input);
        const syncedSlots = sortSlots(
          slotsRef.current.map((s) => (s.id === id ? updated : s))
        );
        slotsRef.current = syncedSlots;
        setSlots(syncedSlots);
        if (currentUserId) {
          persistCurrentSnapshot(
            currentUserId,
            subjectsRef.current,
            syncedSlots,
            statsBySubjectRef.current
          );
        }
        return updated;
      } catch (err) {
        slotsRef.current = prevSlots;
        setSlots(prevSlots);
        throw toAppError(err);
      }
    },
    [persistCurrentSnapshot]
  );

  const deleteSlot = useCallback(
    async (id: string): Promise<void> => {
      const currentUserId = activeUserIdRef.current;
      const prevSlots = slotsRef.current;
      const nextSlots = prevSlots.filter((item) => item.id !== id);
      slotsRef.current = nextSlots;
      setSlots(nextSlots);

      try {
        await deleteSlotRecord(id);
        if (currentUserId) {
          persistCurrentSnapshot(
            currentUserId,
            subjectsRef.current,
            nextSlots,
            statsBySubjectRef.current
          );
        }
      } catch (err) {
        slotsRef.current = prevSlots;
        setSlots(prevSlots);
        throw toAppError(err);
      }
    },
    [persistCurrentSnapshot]
  );

  const importTimetable = useCallback(
    async (
      newSubjectNames: string[],
      importSlots: TimetableImportSlotInput[],
      replace: boolean
    ): Promise<ImportTimetableResult> => {
      const currentUserId = activeUserIdRef.current;
      if (!currentUserId) {
        throw new AppError('You must be signed in to import a timetable.');
      }

      try {
        if (replace) {
          const logsCount = await countAttendanceLogs(currentUserId);
          if (logsCount > 0) {
            throw new AppError(
              'Cannot replace timetable because attendance logs already exist. Use "Add to my timetable" instead.'
            );
          }
          await deleteAllSlotsRecord(currentUserId);
        }

        const currentSubjects = subjectsRef.current;
        const currentSlots = slotsRef.current;

        const subjectMap = new Map<string, Subject>();
        for (const s of currentSubjects) {
          subjectMap.set(s.name.trim().replace(/\s+/g, ' ').toLowerCase(), s);
        }

        const missingInputs: SubjectInput[] = [];
        const seenNew = new Set<string>();
        const defaultTarget = clampTarget(
          profileRef.current?.default_target ?? 75
        );

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

        let createdSubjects: Subject[] = [];
        if (missingInputs.length > 0) {
          createdSubjects = await createSubjectsRecord(missingInputs);
          for (const s of createdSubjects) {
            subjectMap.set(s.name.trim().replace(/\s+/g, ' ').toLowerCase(), s);
          }
        }

        const existingSlotKeys = replace
          ? new Set<string>()
          : new Set(currentSlots.map((s) => `${s.weekday}:${s.start_time}`));

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

        let createdSlots: TimetableSlot[] = [];
        if (slotsToCreate.length > 0) {
          createdSlots = await createSlotsRecord(slotsToCreate);
        }

        const nextSubjects =
          createdSubjects.length > 0
            ? sortSubjects([...currentSubjects, ...createdSubjects])
            : currentSubjects;
        const nextSlots = sortSlots(
          replace ? createdSlots : [...currentSlots, ...createdSlots]
        );
        const nextStats = { ...statsBySubjectRef.current };
        for (const s of createdSubjects) {
          nextStats[s.id] = {
            subject_id: s.id,
            user_id: s.user_id,
            attended: s.initial_present,
            conducted: s.initial_total,
            cancelled: 0,
          };
        }

        subjectsRef.current = nextSubjects;
        slotsRef.current = nextSlots;
        statsBySubjectRef.current = nextStats;
        setSubjects(nextSubjects);
        setSlots(nextSlots);
        setStatsBySubject(nextStats);
        persistCurrentSnapshot(
          currentUserId,
          nextSubjects,
          nextSlots,
          nextStats
        );

        return {
          createdSubjectsCount: missingInputs.length,
          createdSlotsCount: slotsToCreate.length,
        };
      } catch (err) {
        throw toAppError(err);
      }
    },
    [persistCurrentSnapshot]
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

  const stateValue = useMemo<DataStateValue>(
    () => ({
      status,
      error,
      subjects,
      slots,
      trackedSince,
    }),
    [status, error, subjects, slots, trackedSince]
  );

  const statsValue = useMemo<DataStatsValue>(
    () => ({
      statsBySubject,
    }),
    [statsBySubject]
  );

  const derivedValue = useMemo<DataDerivedValue>(
    () => ({
      overall,
    }),
    [overall]
  );

  const dateLogsValue = useMemo<DataDateLogsValue>(
    () => ({
      dateLogsByDate,
    }),
    [dateLogsByDate]
  );

  const actionsValue = useMemo<DataActionsValue>(
    () => ({
      reload,
      reloadStats,
      loadDateLogs,
      loadSubjectLogs,
      getCachedSubjectLogs,
      markSlotStatus,
      restoreSlotStatus,
      markDateBatchStatus,
      clearDateLogs,
      restoreDateLogs,
      addSubject,
      updateSubject,
      deleteSubject,
      updateSubjectsStartingCounts,
      deleteAllAttendanceData,
      addSlot,
      updateSlot,
      deleteSlot,
      importTimetable,
    }),
    [
      reload,
      reloadStats,
      loadDateLogs,
      loadSubjectLogs,
      getCachedSubjectLogs,
      markSlotStatus,
      restoreSlotStatus,
      markDateBatchStatus,
      clearDateLogs,
      restoreDateLogs,
      addSubject,
      updateSubject,
      deleteSubject,
      updateSubjectsStartingCounts,
      deleteAllAttendanceData,
      addSlot,
      updateSlot,
      deleteSlot,
      importTimetable,
    ]
  );

  return (
    <DataActionsContext.Provider value={actionsValue}>
      <DataStateContext.Provider value={stateValue}>
        <DataStatsContext.Provider value={statsValue}>
          <DataDerivedContext.Provider value={derivedValue}>
            <DataDateLogsContext.Provider value={dateLogsValue}>
              {children}
            </DataDateLogsContext.Provider>
          </DataDerivedContext.Provider>
        </DataStatsContext.Provider>
      </DataStateContext.Provider>
    </DataActionsContext.Provider>
  );
}

/**
 * Returns read-only core data (`status`, `error`, `subjects`, `slots`, `trackedSince`).
 */
export function useDataState(): DataStateValue {
  const context = useContext(DataStateContext);
  if (!context) {
    throw new Error('useDataState must be used within a DataProvider.');
  }
  return context;
}

/**
 * Returns per-subject attendance stats map.
 */
export function useDataStats(): DataStatsValue {
  const context = useContext(DataStatsContext);
  if (!context) {
    throw new Error('useDataStats must be used within a DataProvider.');
  }
  return context;
}

/**
 * Returns derived overall attendance counts and tracking mode.
 */
export function useDataDerived(): DataDerivedValue {
  const context = useContext(DataDerivedContext);
  if (!context) {
    throw new Error('useDataDerived must be used within a DataProvider.');
  }
  return context;
}

/**
 * Returns the shared LRU cache of attendance logs keyed by date string.
 */
export function useDataDateLogs(): DataDateLogsValue {
  const context = useContext(DataDateLogsContext);
  if (!context) {
    throw new Error('useDataDateLogs must be used within a DataProvider.');
  }
  return context;
}

/**
 * Returns stable data mutation and fetch action functions.
 */
export function useDataActions(): DataActionsValue {
  const context = useContext(DataActionsContext);
  if (!context) {
    throw new Error('useDataActions must be used within a DataProvider.');
  }
  return context;
}
