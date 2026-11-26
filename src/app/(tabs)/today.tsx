import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { GoToDateModal } from '@/components/GoToDateModal';
import { TodayClassCard } from '@/components/TodayClassCard';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FadeView } from '@/components/ui/FadeView';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useData } from '@/context/DataProvider';
import {
  clearLogStatus,
  deleteLogsForDate,
  fetchLogsForDate,
  setDateLogsStatusBatch,
  setSlotLogStatus,
} from '@/data/logs';
import {
  addDays,
  formatFriendlyDateLabel,
  getIsoWeekday,
  getTodayDateString,
  isValidDateString,
  LONG_MONTHS,
  LONG_WEEKDAYS,
  parseDateString,
} from '@/lib/dates';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/tokens';
import {
  type AttendanceLog,
  type AttendanceStatus,
  type Subject,
  type TimetableSlot,
} from '@/types/db';

function resolveDateParam(raw: string | undefined, today: string): string {
  if (typeof raw === 'string' && isValidDateString(raw) && raw <= today) {
    return raw;
  }
  return today;
}

function mapLogsBySlot(logs: readonly AttendanceLog[]): Record<string, AttendanceLog> {
  const map: Record<string, AttendanceLog> = {};
  for (const log of logs) {
    if (log.slot_id) {
      map[log.slot_id] = log;
    }
  }
  return map;
}

function getFormattedDaySubtitle(dateStr: string): string {
  try {
    const d = parseDateString(dateStr);
    const day = d.getDate();
    const month = LONG_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    const weekday = LONG_WEEKDAYS[getIsoWeekday(dateStr) - 1];
    return `${weekday}, ${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

export default function TodayScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const paramDate = typeof params.date === 'string' ? params.date : undefined;

  const {
    status,
    error,
    subjects,
    slots,
    statsBySubject,
    reload,
    reloadStats,
    applyOptimisticAttendanceChange,
  } = useData();

  const today = getTodayDateString();
  const [prevParamDate, setPrevParamDate] = useState<string | undefined>(
    paramDate
  );
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    resolveDateParam(paramDate, today)
  );

  if (prevParamDate !== paramDate) {
    setPrevParamDate(paramDate);
    if (paramDate !== undefined) {
      setSelectedDate(resolveDateParam(paramDate, getTodayDateString()));
    }
  }

  const [logsBySlot, setLogsBySlot] = useState<Record<string, AttendanceLog>>(
    {}
  );
  const [logsLoading, setLogsLoading] = useState(true);
  const [pendingSlots, setPendingSlots] = useState<Record<string, boolean>>({});
  const [bulkPending, setBulkPending] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const selectedDateRef = useRef(selectedDate);
  const pendingSlotsRef = useRef<Record<string, boolean>>({});
  const bulkPendingRef = useRef(false);
  const refreshingRef = useRef(false);
  const logsCacheRef = useRef<Record<string, AttendanceLog[]>>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    if (paramDate !== undefined) {
      router.setParams({ date: undefined });
    }
  }, [paramDate]);

  const loadLogs = useCallback(async (targetDate: string, silent = false) => {
    const requestId = ++fetchIdRef.current;
    const cachedRows = logsCacheRef.current[targetDate];

    if (cachedRows) {
      setLogsBySlot(mapLogsBySlot(cachedRows));
      setLogsLoading(false);
    } else if (!silent) {
      setLogsLoading(true);
    }

    try {
      const rows = await fetchLogsForDate(targetDate);
      if (
        !mountedRef.current ||
        fetchIdRef.current !== requestId ||
        selectedDateRef.current !== targetDate
      ) {
        return;
      }
      logsCacheRef.current[targetDate] = rows;
      setLogsBySlot(mapLogsBySlot(rows));
      setBannerError(null);
    } catch (err) {
      if (
        !mountedRef.current ||
        fetchIdRef.current !== requestId ||
        selectedDateRef.current !== targetDate
      ) {
        return;
      }
      if (!(err instanceof AppError)) {
        console.error('Fetch logs for date failed:', err);
      }
      setBannerError(getFriendlyErrorMessage(err));
    } finally {
      if (mountedRef.current && fetchIdRef.current === requestId) {
        setLogsLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLogs(selectedDate);
    }, [loadLogs, selectedDate])
  );

  const subjectById = useMemo(() => {
    const map: Record<string, Subject> = {};
    for (const subject of subjects) {
      map[subject.id] = subject;
    }
    return map;
  }, [subjects]);

  const weekday = getIsoWeekday(selectedDate);
  const weekdayName = LONG_WEEKDAYS[weekday - 1];

  const daySlots = useMemo(
    () =>
      slots
        .filter((slot) => slot.weekday === weekday && Boolean(subjectById[slot.subject_id]))
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [slots, weekday, subjectById]
  );

  const markedCount = useMemo(
    () => daySlots.filter((slot) => Boolean(logsBySlot[slot.id])).length,
    [daySlots, logsBySlot]
  );

  const presentCount = useMemo(
    () => daySlots.filter((slot) => logsBySlot[slot.id]?.status === 'present').length,
    [daySlots, logsBySlot]
  );

  const absentCount = useMemo(
    () => daySlots.filter((slot) => logsBySlot[slot.id]?.status === 'absent').length,
    [daySlots, logsBySlot]
  );

  const cancelledCount = useMemo(
    () => daySlots.filter((slot) => logsBySlot[slot.id]?.status === 'cancelled').length,
    [daySlots, logsBySlot]
  );

  const unmarkedCount = Math.max(0, daySlots.length - markedCount);

  const isToday = selectedDate === today;
  const isFutureDate = selectedDate > today;
  const canGoNext = selectedDate < today;
  const hasPendingSlot = Object.keys(pendingSlots).length > 0;
  const quickActionDisabled =
    isFutureDate || logsLoading || bulkPending || hasPendingSlot;

  const handlePreviousDay = () => {
    setBannerError(null);
    setSelectedDate((current) => addDays(current, -1));
  };

  const handleNextDay = () => {
    const currentToday = getTodayDateString();
    if (selectedDate >= currentToday) {
      return;
    }
    const nextDate = addDays(selectedDate, 1);
    if (nextDate > currentToday) {
      return;
    }
    setBannerError(null);
    setSelectedDate(nextDate);
  };

  const handleBackToToday = () => {
    const currentToday = getTodayDateString();
    if (selectedDate === currentToday) {
      return;
    }
    setBannerError(null);
    setSelectedDate(currentToday);
  };

  const handleRefresh = async () => {
    if (refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await Promise.all([reload(true), loadLogs(selectedDate, true)]);
    } finally {
      refreshingRef.current = false;
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  };

  const handleSelectStatus = async (
    slot: TimetableSlot,
    subject: Subject,
    nextStatus: AttendanceStatus
  ) => {
    if (
      bulkPendingRef.current ||
      pendingSlotsRef.current[slot.id] ||
      pendingSlots[slot.id]
    ) {
      return;
    }

    const targetDate = selectedDate;
    const previousLog = logsBySlot[slot.id];
    const isClearing = previousLog?.status === nextStatus;
    const nextAttendanceStatus = isClearing ? null : nextStatus;

    pendingSlotsRef.current[slot.id] = true;
    setBannerError(null);
    setPendingSlots((prev) => ({ ...prev, [slot.id]: true }));

    // 1. Instantly update attendance percentage & counts in DataProvider
    applyOptimisticAttendanceChange(
      subject.id,
      previousLog?.status ?? null,
      nextAttendanceStatus,
      targetDate
    );

    // 2. Instantly update slot button UI
    setLogsBySlot((prev) => {
      const next = { ...prev };
      if (isClearing) {
        delete next[slot.id];
      } else {
        next[slot.id] = previousLog
          ? { ...previousLog, status: nextStatus }
          : {
              id: `pending-${slot.id}`,
              user_id: subject.user_id,
              subject_id: subject.id,
              slot_id: slot.id,
              log_date: targetDate,
              status: nextStatus,
              created_at: '',
              updated_at: '',
            };
      }
      return next;
    });

    try {
      if (isClearing) {
        if (previousLog && !previousLog.id.startsWith('pending-')) {
          await clearLogStatus(previousLog.id);
        }
      } else {
        const saved = await setSlotLogStatus({
          subject_id: subject.id,
          slot_id: slot.id,
          log_date: targetDate,
          status: nextStatus,
        });
        if (mountedRef.current && selectedDateRef.current === targetDate) {
          setLogsBySlot((prev) => ({ ...prev, [slot.id]: saved }));
        }
      }

      await reloadStats();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Save attendance status failed:', err);
      }
      // Revert optimistic updates
      applyOptimisticAttendanceChange(
        subject.id,
        nextAttendanceStatus,
        previousLog?.status ?? null,
        targetDate
      );
      if (mountedRef.current && selectedDateRef.current === targetDate) {
        setLogsBySlot((prev) => {
          const reverted = { ...prev };
          if (previousLog) {
            reverted[slot.id] = previousLog;
          } else {
            delete reverted[slot.id];
          }
          return reverted;
        });
        setBannerError(getFriendlyErrorMessage(err));
      }
    } finally {
      delete pendingSlotsRef.current[slot.id];
      if (mountedRef.current) {
        setPendingSlots((prev) => {
          const next = { ...prev };
          delete next[slot.id];
          return next;
        });
      }
    }
  };

  const handleBatchStatus = async (nextStatus: AttendanceStatus) => {
    const currentToday = getTodayDateString();
    const targetDate = selectedDate;
    if (
      targetDate > currentToday ||
      daySlots.length === 0 ||
      bulkPendingRef.current ||
      Object.keys(pendingSlotsRef.current).length > 0
    ) {
      return;
    }

    bulkPendingRef.current = true;
    setBulkPending(true);
    setBannerError(null);

    try {
      const savedLogs = await setDateLogsStatusBatch(
        daySlots.map((slot) => ({
          subject_id: slot.subject_id,
          slot_id: slot.id,
          log_date: targetDate,
          status: nextStatus,
        }))
      );
      logsCacheRef.current[targetDate] = savedLogs;
      if (mountedRef.current && selectedDateRef.current === targetDate) {
        setLogsBySlot(mapLogsBySlot(savedLogs));
      }
      await reloadStats();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Batch attendance update failed:', err);
      }
      if (mountedRef.current) {
        setBannerError(getFriendlyErrorMessage(err));
      }
    } finally {
      bulkPendingRef.current = false;
      if (mountedRef.current) {
        setBulkPending(false);
      }
    }
  };

  const handleClearDay = async () => {
    const currentToday = getTodayDateString();
    const targetDate = selectedDate;
    if (
      targetDate > currentToday ||
      bulkPendingRef.current ||
      Object.keys(pendingSlotsRef.current).length > 0
    ) {
      return;
    }

    bulkPendingRef.current = true;
    setBulkPending(true);
    setBannerError(null);

    try {
      await deleteLogsForDate(targetDate);
      logsCacheRef.current[targetDate] = [];
      if (mountedRef.current && selectedDateRef.current === targetDate) {
        setLogsBySlot({});
      }
      await reloadStats();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Clear day logs failed:', err);
      }
      if (mountedRef.current) {
        setBannerError(getFriendlyErrorMessage(err));
      }
    } finally {
      bulkPendingRef.current = false;
      if (mountedRef.current) {
        setBulkPending(false);
      }
    }
  };

  const handleConfirmClearDay = () => {
    if (
      selectedDate > getTodayDateString() ||
      bulkPendingRef.current ||
      Object.keys(pendingSlotsRef.current).length > 0
    ) {
      return;
    }

    Alert.alert('Clear day', 'Remove all marks for this day?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void handleClearDay();
        },
      },
    ]);
  };

  const formattedDaySubtitle = getFormattedDaySubtitle(selectedDate);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Date Navigator Card */}
        <Card style={styles.dateNavigatorCard}>
          <View style={styles.dateHeaderTopRow}>
            <PressableScale
              onPress={() => setDateModalVisible(true)}
              disabled={bulkPending}
              scaleTo={0.96}
              rippleColor={colors.rippleNeutral}
              accessibilityRole="button"
              accessibilityLabel="Go to date"
              containerStyle={styles.goToDateBtnContainer}
              style={styles.goToDateBtn}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.accent}
              />
              <AppText variant="label" style={styles.goToDateText}>
                Go to date
              </AppText>
            </PressableScale>
          </View>

          <View style={styles.navRow}>
            <PressableScale
              onPress={handlePreviousDay}
              scaleTo={0.92}
              rippleColor={colors.rippleNeutral}
              accessibilityRole="button"
              accessibilityLabel="Previous day"
              containerStyle={styles.navButtonContainer}
              style={styles.navButton}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </PressableScale>

            <View style={styles.dateCenterCol}>
              <View style={styles.dateHeaderBadgeRow}>
                <AppText variant="title" style={styles.dateHeading} numberOfLines={1}>
                  {formatFriendlyDateLabel(selectedDate)}
                </AppText>
                {!isToday && (
                  <PressableScale
                    onPress={handleBackToToday}
                    scaleTo={0.94}
                    style={styles.todayJumpPill}
                    accessibilityRole="button"
                    accessibilityLabel="Jump back to today"
                  >
                    <Ionicons name="arrow-undo" size={11} color={colors.accent} />
                    <AppText variant="caption" style={styles.todayJumpText}>
                      Today
                    </AppText>
                  </PressableScale>
                )}
              </View>
              <AppText variant="caption" tone="muted" style={styles.dateSubtitle}>
                {formattedDaySubtitle}
              </AppText>
            </View>

            <PressableScale
              onPress={handleNextDay}
              disabled={!canGoNext}
              scaleTo={0.92}
              rippleColor={colors.rippleNeutral}
              accessibilityRole="button"
              accessibilityLabel="Next day"
              accessibilityState={{ disabled: !canGoNext }}
              containerStyle={[
                styles.navButtonContainer,
                !canGoNext && styles.navButtonDisabled,
              ]}
              style={styles.navButton}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={canGoNext ? colors.text : colors.textMuted}
              />
            </PressableScale>
          </View>
        </Card>

        {bannerError && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.danger}
              style={styles.errorIcon}
            />
            <AppText variant="caption" tone="danger" style={styles.errorText}>
              {bannerError}
            </AppText>
          </View>
        )}

        {status === 'loading' ? (
          <View
            accessible
            accessibilityLabel="Loading classes"
            style={styles.listSection}
          >
            {/* Daily progress skeleton */}
            <Card style={styles.progressCard}>
              <Skeleton width="50%" height={18} />
              <Skeleton width="100%" height={8} borderRadius={4} style={{ marginTop: 8 }} />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <Skeleton width={80} height={20} borderRadius={10} />
                <Skeleton width={80} height={20} borderRadius={10} />
                <Skeleton width={80} height={20} borderRadius={10} />
              </View>
            </Card>

            {[0, 1, 2].map((item) => (
              <Card key={`today-skeleton-${item}`} style={styles.skeletonCard}>
                <View style={styles.skeletonHeaderRow}>
                  <Skeleton width={44} height={44} borderRadius={22} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="60%" height={18} />
                    <Skeleton width="40%" height={14} />
                  </View>
                  <Skeleton width={60} height={24} borderRadius={8} />
                </View>
                <Skeleton width="100%" height={26} borderRadius={6} style={{ marginTop: 10 }} />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Skeleton width="31%" height={44} borderRadius={10} />
                  <Skeleton width="31%" height={44} borderRadius={10} />
                  <Skeleton width="31%" height={44} borderRadius={10} />
                </View>
              </Card>
            ))}
          </View>
        ) : status === 'error' ? (
          <ErrorState
            message={error ?? 'Something went wrong. Try again.'}
            onRetry={() => {
              void reload();
            }}
            style={styles.stateCard}
          />
        ) : subjects.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title="No subjects tracked yet"
            message="Add your subjects and weekly timetable to record daily attendance."
            actionLabel="Add subjects"
            onAction={() => router.navigate('/(tabs)/subjects')}
            style={styles.stateCard}
          />
        ) : (
          <FadeView transitionKey={selectedDate}>
            {daySlots.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No classes scheduled"
                message={`No classes scheduled for ${weekdayName}. You can add timetable slots in the Subjects tab.`}
                actionLabel="View Timetable"
                onAction={() => router.navigate('/(tabs)/subjects')}
                style={styles.stateCard}
              />
            ) : (
              <View style={styles.listSection}>
                {/* Daily Progress & Breakdown Card */}
                <Card style={styles.progressCard}>
                  <View style={styles.progressHeaderRow}>
                    <View style={styles.progressTitleGroup}>
                      <AppText variant="label" style={styles.progressHeading}>
                        {isToday ? "Today's Schedule Progress" : 'Daily Schedule Progress'}
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        {markedCount === daySlots.length
                          ? 'All classes recorded for this date'
                          : `${markedCount} of ${daySlots.length} classes recorded`}
                      </AppText>
                    </View>

                    {markedCount === daySlots.length ? (
                      <View style={styles.completePill}>
                        <Ionicons name="checkmark-done" size={13} color={colors.safe} />
                        <AppText variant="caption" style={styles.completePillText}>
                          Complete
                        </AppText>
                      </View>
                    ) : (
                      <View style={styles.remainingPill}>
                        <AppText variant="caption" style={styles.remainingPillText}>
                          {unmarkedCount} pending
                        </AppText>
                      </View>
                    )}
                  </View>

                  {/* Linear Progress Bar */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, (markedCount / daySlots.length) * 100)}%`,
                          backgroundColor:
                            markedCount === daySlots.length
                              ? colors.safe
                              : colors.accent,
                        },
                      ]}
                    />
                  </View>

                  {/* Breakdown Indicator Chips */}
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownChip}>
                      <View style={[styles.breakdownDot, { backgroundColor: colors.safe }]} />
                      <AppText variant="caption" style={styles.breakdownLabel}>
                        {presentCount} Present
                      </AppText>
                    </View>

                    <View style={styles.breakdownChip}>
                      <View style={[styles.breakdownDot, { backgroundColor: colors.danger }]} />
                      <AppText variant="caption" style={styles.breakdownLabel}>
                        {absentCount} Absent
                      </AppText>
                    </View>

                    {cancelledCount > 0 && (
                      <View style={styles.breakdownChip}>
                        <View style={[styles.breakdownDot, { backgroundColor: colors.textMuted }]} />
                        <AppText variant="caption" style={styles.breakdownLabel}>
                          {cancelledCount} Cancelled
                        </AppText>
                      </View>
                    )}

                    <View style={styles.breakdownChip}>
                      <View style={[styles.breakdownDot, { backgroundColor: colors.border }]} />
                      <AppText variant="caption" tone="muted" style={styles.breakdownLabel}>
                        {unmarkedCount} Pending
                      </AppText>
                    </View>
                  </View>
                </Card>

                {/* Quick Actions */}
                {!isFutureDate && !logsLoading ? (
                  <View style={styles.quickActionsRow}>
                    <PressableScale
                      onPress={() => {
                        void handleBatchStatus('present');
                      }}
                      disabled={quickActionDisabled}
                      scaleTo={0.96}
                      rippleColor={colors.rippleNeutral}
                      accessibilityRole="button"
                      accessibilityLabel="All present"
                      containerStyle={[
                        styles.quickActionBtnContainer,
                        styles.quickActionSafe,
                        quickActionDisabled && styles.quickActionDisabled,
                      ]}
                      style={styles.quickActionBtn}
                    >
                      <AppText
                        variant="caption"
                        style={[styles.quickActionText, { color: colors.safe }]}
                      >
                        All present
                      </AppText>
                    </PressableScale>

                    <PressableScale
                      onPress={() => {
                        void handleBatchStatus('absent');
                      }}
                      disabled={quickActionDisabled}
                      scaleTo={0.96}
                      rippleColor={colors.rippleNeutral}
                      accessibilityRole="button"
                      accessibilityLabel="All absent"
                      containerStyle={[
                        styles.quickActionBtnContainer,
                        styles.quickActionDanger,
                        quickActionDisabled && styles.quickActionDisabled,
                      ]}
                      style={styles.quickActionBtn}
                    >
                      <AppText
                        variant="caption"
                        style={[
                          styles.quickActionText,
                          { color: colors.danger },
                        ]}
                      >
                        All absent
                      </AppText>
                    </PressableScale>

                    <PressableScale
                      onPress={() => {
                        void handleBatchStatus('cancelled');
                      }}
                      disabled={quickActionDisabled}
                      scaleTo={0.96}
                      rippleColor={colors.rippleNeutral}
                      accessibilityRole="button"
                      accessibilityLabel="Holiday (all cancelled)"
                      containerStyle={[
                        styles.quickActionBtnContainer,
                        styles.quickActionMuted,
                        quickActionDisabled && styles.quickActionDisabled,
                      ]}
                      style={styles.quickActionBtn}
                    >
                      <AppText
                        variant="caption"
                        tone="muted"
                        style={styles.quickActionText}
                      >
                        Holiday (all cancelled)
                      </AppText>
                    </PressableScale>

                    <PressableScale
                      onPress={handleConfirmClearDay}
                      disabled={quickActionDisabled}
                      scaleTo={0.96}
                      rippleColor={colors.rippleNeutral}
                      accessibilityRole="button"
                      accessibilityLabel="Clear day"
                      containerStyle={[
                        styles.quickActionBtnContainer,
                        styles.quickActionClear,
                        quickActionDisabled && styles.quickActionDisabled,
                      ]}
                      style={styles.quickActionBtn}
                    >
                      <AppText
                        variant="caption"
                        style={styles.quickActionText}
                      >
                        Clear day
                      </AppText>
                    </PressableScale>
                  </View>
                ) : null}

                {/* Class Schedule Cards */}
                {logsLoading ? (
                  daySlots.map((slot) => (
                    <Card
                      key={`today-log-skeleton-${slot.id}`}
                      style={styles.skeletonCard}
                    >
                      <View style={styles.skeletonHeaderRow}>
                        <Skeleton width={44} height={44} borderRadius={22} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <Skeleton width="60%" height={18} />
                          <Skeleton width="40%" height={14} />
                        </View>
                        <Skeleton width={60} height={24} borderRadius={8} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        <Skeleton width="31%" height={44} borderRadius={10} />
                        <Skeleton width="31%" height={44} borderRadius={10} />
                        <Skeleton width="31%" height={44} borderRadius={10} />
                      </View>
                    </Card>
                  ))
                ) : (
                  daySlots.map((slot) => {
                    const subject = subjectById[slot.subject_id];
                    if (!subject) {
                      return null;
                    }
                    const stats = statsBySubject[subject.id];
                    const counts = {
                      attended: stats?.attended ?? subject.initial_present,
                      held: stats?.conducted ?? subject.initial_total,
                    };
                    const currentStatus = logsBySlot[slot.id]?.status ?? null;

                    return (
                      <TodayClassCard
                        key={slot.id}
                        slot={slot}
                        subject={subject}
                        counts={counts}
                        status={currentStatus}
                        pending={bulkPending || Boolean(pendingSlots[slot.id])}
                        onSelectStatus={(nextStatus) => {
                          void handleSelectStatus(slot, subject, nextStatus);
                        }}
                      />
                    );
                  })
                )}

                {/* Quick Hint */}
                <View style={styles.hintContainer}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                  <AppText variant="caption" tone="muted" style={styles.hintText}>
                    Tap a marked status again to clear it.
                  </AppText>
                </View>
              </View>
            )}
          </FadeView>
        )}
      </ScrollView>

      <GoToDateModal
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        onSelectDate={(nextDate) => {
          setBannerError(null);
          setSelectedDate(nextDate);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  dateNavigatorCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  dateHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  goToDateBtnContainer: {
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  goToDateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  goToDateText: {
    color: colors.accent,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  navButtonContainer: {
    width: 42,
    height: 42,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.5,
  },
  dateCenterCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  dateHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  dateHeading: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  todayJumpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  todayJumpText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 11,
  },
  dateSubtitle: {
    fontSize: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.dangerBg,
    borderRadius: radius.control,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  errorText: {
    flex: 1,
  },
  stateCard: {
    marginTop: spacing.lg,
  },
  listSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },

  /* Daily Progress Card */
  progressCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitleGroup: {
    gap: 2,
  },
  progressHeading: {
    fontSize: 15,
    fontWeight: '600',
  },
  completePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.safeBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  completePillText: {
    color: colors.safe,
    fontWeight: '600',
    fontSize: 11,
  },
  remainingPill: {
    backgroundColor: colors.warnBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  remainingPillText: {
    color: colors.warn,
    fontWeight: '600',
    fontSize: 11,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: 2,
  },
  breakdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  breakdownDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Skeletons */
  skeletonCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  /* Hint */
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  hintText: {
    fontSize: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  quickActionBtnContainer: {
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  quickActionSafe: {
    backgroundColor: colors.safeBg,
    borderColor: colors.safeBg,
  },
  quickActionDanger: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBg,
  },
  quickActionMuted: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  quickActionClear: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  quickActionDisabled: {
    opacity: 0.55,
  },
  quickActionText: {
    fontWeight: '600',
  },
});
