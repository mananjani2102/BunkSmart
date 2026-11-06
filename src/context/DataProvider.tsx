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
import {
  createSlot as createSlotRecord,
  deleteSlot as deleteSlotRecord,
  fetchSlots,
  updateSlot as updateSlotRecord,
} from '@/data/slots';
import {
  createSubject as createSubjectRecord,
  deleteAllSubjects as deleteAllSubjectsRecord,
  deleteSubject as deleteSubjectRecord,
  fetchSubjects,
  fetchSubjectStats,
  updateSubject as updateSubjectRecord,
} from '@/data/subjects';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
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

export interface DataContextValue {
  status: DataStatus;
  error: string | null;
  subjects: Subject[];
  slots: TimetableSlot[];
  statsBySubject: Record<string, SubjectStats>;
  reload: (silent?: boolean) => Promise<void>;
  reloadStats: () => Promise<void>;
  applyOptimisticAttendanceChange: (
    subjectId: string,
    previousStatus: AttendanceStatus | null,
    nextStatus: AttendanceStatus | null
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
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [prevUserId, setPrevUserId] = useState<string | null>(userId);
  const [status, setStatus] = useState<DataStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [statsBySubject, setStatsBySubject] = useState<
    Record<string, SubjectStats>
  >({});

  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setSubjects([]);
    setSlots([]);
    setStatsBySubject({});
    setError(null);
    setStatus('loading');
  }

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
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

      if (!silent) {
        setStatus('loading');
        setError(null);
      }

      try {
        const data = await fetchAllData();

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
    [userId]
  );

  const reloadStats = useCallback(async (): Promise<void> => {
    if (!userId) {
      return;
    }

    try {
      const loadedStats = await fetchSubjectStats();
      if (!mountedRef.current || activeUserIdRef.current !== userId) {
        return;
      }
      const nextStats = buildStatsMap(loadedStats);
      setStatsBySubject(nextStats);
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
  }, [userId]);

  const applyOptimisticAttendanceChange = useCallback(
    (
      subjectId: string,
      previousStatus: AttendanceStatus | null,
      nextStatus: AttendanceStatus | null
    ) => {
      if (previousStatus === nextStatus) {
        return;
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
    [subjects, userId]
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

  const value = useMemo<DataContextValue>(
    () => ({
      status,
      error,
      subjects,
      slots,
      statsBySubject,
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
    }),
    [
      status,
      error,
      subjects,
      slots,
      statsBySubject,
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
