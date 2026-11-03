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
  deleteSubject as deleteSubjectRecord,
  fetchSubjects,
  fetchSubjectStats,
  updateSubject as updateSubjectRecord,
} from '@/data/subjects';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
import {
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
  addSubject: (input: SubjectInput) => Promise<Subject>;
  updateSubject: (id: string, input: Partial<SubjectInput>) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<void>;
  addSlot: (input: SlotInput) => Promise<TimetableSlot>;
  updateSlot: (
    id: string,
    input: Partial<SlotInput>
  ) => Promise<TimetableSlot>;
  deleteSlot: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

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

async function fetchAllData() {
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

  const [status, setStatus] = useState<DataStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [statsBySubject, setStatsBySubject] = useState<
    Record<string, SubjectStats>
  >({});

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
    async (silent = false) => {
      if (!userId) {
        setSubjects([]);
        setSlots([]);
        setStatsBySubject({});
        setError(null);
        setStatus('ready');
        return;
      }

      const requestId = ++requestIdRef.current;
      if (!silent) {
        setStatus('loading');
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
      } catch (err) {
        if (
          !mountedRef.current ||
          requestIdRef.current !== requestId ||
          activeUserIdRef.current !== userId
        ) {
          return;
        }
        setError(getFriendlyErrorMessage(err));
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
      }
    },
    [userId]
  );

  const reloadStats = useCallback(async () => {
    if (!userId) return;
    try {
      const loadedStats = await fetchSubjectStats();
      if (!mountedRef.current || activeUserIdRef.current !== userId) return;
      setStatsBySubject(buildStatsMap(loadedStats));
    } catch {
      // Non-fatal stats refresh error
    }
  }, [userId]);

  useEffect(() => {
    activeUserIdRef.current = userId;
    void reload(false);
  }, [userId, reload]);

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
      addSubject,
      updateSubject,
      deleteSubject,
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
      addSubject,
      updateSubject,
      deleteSubject,
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
