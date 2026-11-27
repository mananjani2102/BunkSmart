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
import { AppState, Platform } from 'react-native';

import { useAuthState } from '@/context/AuthProvider';
import { useDataState } from '@/context/DataProvider';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  DEFAULT_REMINDER_SETTINGS,
  readReminderSettings,
  writeReminderSettings,
  type ReminderMinutes,
  type ReminderSettings,
} from '@/lib/prefs';
import {
  cancelAllClassReminders,
  getExactAlarmPermissionState,
  hasReminderPermission,
  requestExactAlarmPermission,
  requestReminderPermission,
  rescheduleClassReminders,
} from '@/lib/reminders';

export interface RemindersContextValue {
  settings: ReminderSettings;
  loaded: boolean;
  busy: boolean;
  permissionDenied: boolean;
  exactAlarmGranted: boolean;
  exactAlarmCanAsk: boolean;
  error: string | null;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  setMinutesBefore: (minutesBefore: ReminderMinutes) => Promise<boolean>;
  allowExactAlarms: () => Promise<void>;
}

const RemindersContext = createContext<RemindersContextValue | null>(null);

export function RemindersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthState();
  const { status, subjects, slots } = useDataState();
  const userId = user?.id ?? null;

  const [prevUserId, setPrevUserId] = useState<string | null>(userId);
  const [settings, setSettings] = useState<ReminderSettings>(
    DEFAULT_REMINDER_SETTINGS
  );
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [exactAlarmGranted, setExactAlarmGranted] = useState(true);
  const [exactAlarmCanAsk, setExactAlarmCanAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setSettings(DEFAULT_REMINDER_SETTINGS);
    setLoaded(false);
    setPermissionDenied(false);
    setExactAlarmGranted(true);
    setExactAlarmCanAsk(false);
    setError(null);
  }

  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const syncIdRef = useRef(0);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      const [saved, exactState] = await Promise.all([
        readReminderSettings(userId),
        getExactAlarmPermissionState(),
      ]);
      if (!cancelled && mountedRef.current) {
        setSettings(saved);
        setExactAlarmGranted(exactState.granted);
        setExactAlarmCanAsk(exactState.canAskAgain);
        setLoaded(true);
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !loaded || status !== 'ready' || !settings.enabled) {
      return;
    }

    let cancelled = false;
    const syncId = ++syncIdRef.current;

    const syncReminders = async () => {
      try {
        const granted = await hasReminderPermission();
        if (cancelled || !mountedRef.current || syncIdRef.current !== syncId) {
          return;
        }
        if (!granted) {
          return;
        }
        await rescheduleClassReminders(slots, subjects, settings.minutesBefore);
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          setError(getFriendlyErrorMessage(err));
        }
      }
    };

    void syncReminders();

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    loaded,
    status,
    settings.enabled,
    settings.minutesBefore,
    exactAlarmGranted,
    slots,
    subjects,
  ]);

  useEffect(() => {
    if (!permissionDenied && (!settings.enabled || exactAlarmGranted)) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      void Promise.all([
        hasReminderPermission(),
        getExactAlarmPermissionState(),
      ])
        .then(([granted, exactState]) => {
          if (!mountedRef.current) {
            return;
          }
          if (granted) {
            setPermissionDenied(false);
          }
          setExactAlarmGranted(exactState.granted);
          setExactAlarmCanAsk(exactState.canAskAgain);
        })
        .catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, [permissionDenied, settings.enabled, exactAlarmGranted]);

  const setEnabled = useCallback(
    async (nextEnabled: boolean): Promise<boolean> => {
      if (Platform.OS === 'web' || !userId || busyRef.current) {
        return false;
      }

      busyRef.current = true;
      setBusy(true);
      setError(null);

      try {
        const current = settingsRef.current;

        if (nextEnabled) {
          const permission = await requestReminderPermission();
          if (!mountedRef.current) {
            return false;
          }

          if (permission === 'denied') {
            const disabledSettings: ReminderSettings = {
              enabled: false,
              minutesBefore: current.minutesBefore,
            };
            await writeReminderSettings(userId, disabledSettings);
            if (mountedRef.current) {
              setSettings(disabledSettings);
              setPermissionDenied(true);
            }
            return false;
          }

          const exactState = await requestExactAlarmPermission();
          if (!mountedRef.current) {
            return false;
          }

          const enabledSettings: ReminderSettings = {
            enabled: true,
            minutesBefore: current.minutesBefore,
          };
          await writeReminderSettings(userId, enabledSettings);
          if (mountedRef.current) {
            setPermissionDenied(false);
            setExactAlarmGranted(exactState.granted);
            setExactAlarmCanAsk(exactState.canAskAgain);
            setSettings(enabledSettings);
          }
          return true;
        } else {
          const disabledSettings: ReminderSettings = {
            enabled: false,
            minutesBefore: current.minutesBefore,
          };
          await Promise.all([
            cancelAllClassReminders(),
            writeReminderSettings(userId, disabledSettings),
          ]);
          if (mountedRef.current) {
            setPermissionDenied(false);
            setSettings(disabledSettings);
          }
          return true;
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(getFriendlyErrorMessage(err));
        }
        return false;
      } finally {
        busyRef.current = false;
        if (mountedRef.current) {
          setBusy(false);
        }
      }
    },
    [userId]
  );

  const setMinutesBefore = useCallback(
    async (minutesBefore: ReminderMinutes): Promise<boolean> => {
      if (
        !userId ||
        busyRef.current ||
        settingsRef.current.minutesBefore === minutesBefore
      ) {
        return false;
      }

      busyRef.current = true;
      setBusy(true);
      setError(null);

      try {
        const nextSettings: ReminderSettings = {
          enabled: settingsRef.current.enabled,
          minutesBefore,
        };
        await writeReminderSettings(userId, nextSettings);
        if (mountedRef.current) {
          setSettings(nextSettings);
        }
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(getFriendlyErrorMessage(err));
        }
        return false;
      } finally {
        busyRef.current = false;
        if (mountedRef.current) {
          setBusy(false);
        }
      }
    },
    [userId]
  );

  const allowExactAlarms = useCallback(async (): Promise<void> => {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError(null);

    try {
      const exactState = await requestExactAlarmPermission();
      if (mountedRef.current) {
        setExactAlarmGranted(exactState.granted);
        setExactAlarmCanAsk(exactState.canAskAgain);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(getFriendlyErrorMessage(err));
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  }, []);

  const value = useMemo<RemindersContextValue>(
    () => ({
      settings,
      loaded,
      busy,
      permissionDenied,
      exactAlarmGranted,
      exactAlarmCanAsk,
      error,
      setEnabled,
      setMinutesBefore,
      allowExactAlarms,
    }),
    [
      settings,
      loaded,
      busy,
      permissionDenied,
      exactAlarmGranted,
      exactAlarmCanAsk,
      error,
      setEnabled,
      setMinutesBefore,
      allowExactAlarms,
    ]
  );

  return (
    <RemindersContext.Provider value={value}>
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders(): RemindersContextValue {
  const context = useContext(RemindersContext);
  if (!context) {
    throw new Error('useReminders must be used within a RemindersProvider.');
  }
  return context;
}
