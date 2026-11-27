import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { GoToDateModal } from '@/components/GoToDateModal';
import { TodaySkeleton } from '@/components/SkeletonLayouts';
import { TodayClassCard } from '@/components/TodayClassCard';
import { TodaySummaryBar } from '@/components/TodaySummaryBar';
import {
  ActionSheet,
  type ActionSheetItem,
} from '@/components/ui/ActionSheet';
import { AppText } from '@/components/ui/AppText';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ContentFade } from '@/components/ui/ContentFade';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import {
  useDataActions,
  useDataDateLogs,
  useDataState,
  useDataStats,
} from '@/context/DataProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import { formatDisplayPercent, pluralizeClasses } from '@/lib/attendance';
import {
  addDays,
  formatFriendlyDateLabel,
  getIsoWeekday,
  getTodayDateString,
  isValidDateString,
  LONG_MONTHS,
  LONG_WEEKDAYS,
  parseDateString,
  timeStringToMinutes,
} from '@/lib/dates';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { triggerLightHaptic } from '@/lib/haptics';
import { useMinuteTicker } from '@/lib/ticker';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, spacing, type ThemeColors } from '@/theme/tokens';
import {
  type AttendanceLog,
  type AttendanceStatus,
  type Subject,
  type TimetableSlot,
} from '@/types/db';

const EMPTY_LOGS: readonly AttendanceLog[] = [];

function resolveDateParam(raw: string | undefined, today: string): string {
  if (typeof raw === 'string' && isValidDateString(raw) && raw <= today) {
    return raw;
  }
  return today;
}

function mapLogsBySlot(
  logs: readonly AttendanceLog[]
): Record<string, AttendanceLog> {
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

function getSlotStatusFlags(
  daySlots: readonly TimetableSlot[],
  isToday: boolean,
  minuteKey: number
): { nowSlotId: string | null; nextSlotId: string | null } {
  if (!isToday || daySlots.length === 0 || minuteKey < 0) {
    return { nowSlotId: null, nextSlotId: null };
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let nowSlotId: string | null = null;
  let nextSlotId: string | null = null;

  for (const slot of daySlots) {
    try {
      const startMins = timeStringToMinutes(slot.start_time);
      const endMins = slot.end_time
        ? timeStringToMinutes(slot.end_time)
        : startMins + 60;

      if (!nowSlotId && nowMinutes >= startMins && nowMinutes < endMins) {
        nowSlotId = slot.id;
      } else if (!nextSlotId && startMins > nowMinutes) {
        nextSlotId = slot.id;
      }
    } catch {
      continue;
    }
  }

  return { nowSlotId, nextSlotId };
}

export default function TodayScreen() {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const params = useLocalSearchParams<{ date?: string }>();
  const paramDate = typeof params.date === 'string' ? params.date : undefined;

  const { status, error, subjects, slots } = useDataState();
  const { statsBySubject } = useDataStats();
  const { dateLogsByDate } = useDataDateLogs();
  const {
    reload,
    loadDateLogs,
    markSlotStatus,
    restoreSlotStatus,
    markDateBatchStatus,
    clearDateLogs,
    restoreDateLogs,
  } = useDataActions();
  const { showSnackbar } = useSnackbarActions();

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

  const [failedDate, setFailedDate] = useState<string | null>(null);
  const [dateLoadError, setDateLoadError] = useState<string | null>(null);
  const [clearModalError, setClearModalError] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const selectedDateRef = useRef(selectedDate);
  const bulkPendingRef = useRef(false);
  const refreshingRef = useRef(false);

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

  const dateEntry = dateLogsByDate[selectedDate];
  const logsBySlot = useMemo(
    () => mapLogsBySlot(dateEntry?.logs ?? EMPTY_LOGS),
    [dateEntry?.logs]
  );
  const logsLoading = !dateEntry && failedDate !== selectedDate;
  const logsFailed = !dateEntry && failedDate === selectedDate;

  const syncDateLogs = useCallback(
    async (targetDate: string, force = false) => {
      const requestId = ++fetchIdRef.current;
      try {
        await loadDateLogs(targetDate, force);
        if (
          !mountedRef.current ||
          fetchIdRef.current !== requestId ||
          selectedDateRef.current !== targetDate
        ) {
          return;
        }
        setFailedDate(null);
        setDateLoadError(null);
      } catch (err) {
        if (
          !mountedRef.current ||
          fetchIdRef.current !== requestId ||
          selectedDateRef.current !== targetDate
        ) {
          return;
        }
        const message = getFriendlyErrorMessage(err);
        if (dateLogsByDate[targetDate]) {
          showSnackbar({ message, tone: 'error' });
        } else {
          setFailedDate(targetDate);
          setDateLoadError(message);
        }
      }
    },
    [dateLogsByDate, loadDateLogs, showSnackbar]
  );

  useFocusEffect(
    useCallback(() => {
      void syncDateLogs(selectedDate, false);
    }, [selectedDate, syncDateLogs])
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
        .filter(
          (slot) => slot.weekday === weekday && Boolean(subjectById[slot.subject_id])
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [slots, weekday, subjectById]
  );
  const daySlotsRef = useRef(daySlots);

  useEffect(() => {
    daySlotsRef.current = daySlots;
  }, [daySlots]);

  const markedCount = useMemo(
    () => daySlots.filter((slot) => Boolean(logsBySlot[slot.id])).length,
    [daySlots, logsBySlot]
  );

  const presentCount = useMemo(
    () =>
      daySlots.filter((slot) => logsBySlot[slot.id]?.status === 'present').length,
    [daySlots, logsBySlot]
  );

  const absentCount = useMemo(
    () =>
      daySlots.filter((slot) => logsBySlot[slot.id]?.status === 'absent').length,
    [daySlots, logsBySlot]
  );

  const cancelledCount = useMemo(
    () =>
      daySlots.filter((slot) => logsBySlot[slot.id]?.status === 'cancelled')
        .length,
    [daySlots, logsBySlot]
  );

  const isToday = selectedDate === today;
  const isFutureDate = selectedDate > today;
  const canGoNext = selectedDate < today;
  const quickActionDisabled =
    isFutureDate || logsLoading || bulkPending || daySlots.length === 0;

  const minuteKey = useMinuteTicker(isToday);
  const { nowSlotId, nextSlotId } = useMemo(
    () => getSlotStatusFlags(daySlots, isToday, minuteKey),
    [daySlots, isToday, minuteKey]
  );

  const handlePreviousDay = useCallback(() => {
    setFailedDate(null);
    setDateLoadError(null);
    setSelectedDate((current) => addDays(current, -1));
  }, []);

  const handleNextDay = useCallback(() => {
    const currentToday = getTodayDateString();
    const currentSelected = selectedDateRef.current;
    if (currentSelected >= currentToday) {
      return;
    }
    const nextDate = addDays(currentSelected, 1);
    if (nextDate > currentToday) {
      return;
    }
    setFailedDate(null);
    setDateLoadError(null);
    setSelectedDate(nextDate);
  }, []);

  const handleBackToToday = useCallback(() => {
    const currentToday = getTodayDateString();
    if (selectedDateRef.current === currentToday) {
      return;
    }
    setFailedDate(null);
    setDateLoadError(null);
    setSelectedDate(currentToday);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        reload(true, true),
        loadDateLogs(selectedDateRef.current, true),
      ]);
      if (mountedRef.current) {
        setFailedDate(null);
        setDateLoadError(null);
      }
    } catch (err) {
      showSnackbar({
        message: getFriendlyErrorMessage(err),
        tone: 'error',
      });
    } finally {
      refreshingRef.current = false;
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [loadDateLogs, reload, showSnackbar]);

  const handleTriggerRefresh = useCallback(() => {
    void handleRefresh();
  }, [handleRefresh]);

  const handleSelectStatus = useCallback(
    (slot: TimetableSlot, subject: Subject, nextStatus: AttendanceStatus) => {
      if (bulkPendingRef.current) {
        return;
      }

      const targetDate = selectedDateRef.current;
      triggerLightHaptic();

      void markSlotStatus({
        slot,
        subject,
        targetDate,
        nextStatus,
        onOptimistic: (result) => {
          const percent = formatDisplayPercent(result.attended, result.held);
          let message: string;
          if (result.nextStatus === 'present') {
            message = `Marked present. ${subject.name} is now ${percent}.`;
          } else if (result.nextStatus === 'absent') {
            message = `Marked absent. ${subject.name} is now ${percent}.`;
          } else if (result.nextStatus === 'cancelled') {
            message =
              result.held > 0
                ? `Marked cancelled. ${subject.name} is now ${percent}.`
                : `Marked cancelled for ${subject.name}.`;
          } else {
            message =
              result.held > 0
                ? `Cleared mark. ${subject.name} is now ${percent}.`
                : `Cleared mark for ${subject.name}.`;
          }

          showSnackbar({
            message,
            actionLabel: 'Undo',
            onAction: async () => {
              try {
                await restoreSlotStatus({
                  slot,
                  subject,
                  targetDate,
                  targetStatus: result.previousStatus,
                });
              } catch (undoErr) {
                showSnackbar({
                  message: getFriendlyErrorMessage(undoErr),
                  tone: 'error',
                });
              }
            },
          });
        },
      }).catch((err: unknown) => {
        showSnackbar({
          message: getFriendlyErrorMessage(err),
          tone: 'error',
        });
      });
    },
    [markSlotStatus, restoreSlotStatus, showSnackbar]
  );

  const handleBatchStatus = useCallback(
    async (nextStatus: AttendanceStatus) => {
      const currentToday = getTodayDateString();
      const targetDate = selectedDateRef.current;
      const currentSlots = daySlotsRef.current;
      if (
        targetDate > currentToday ||
        currentSlots.length === 0 ||
        bulkPendingRef.current
      ) {
        return;
      }

      bulkPendingRef.current = true;
      setBulkPending(true);

      try {
        const previousLogs = await markDateBatchStatus(
          targetDate,
          currentSlots,
          nextStatus
        );
        const countLabel = `${currentSlots.length} ${pluralizeClasses(currentSlots.length)}`;
        const message =
          nextStatus === 'present'
            ? `Marked all ${countLabel} present.`
            : nextStatus === 'absent'
              ? `Marked all ${countLabel} absent.`
              : `Marked holiday. All ${countLabel} cancelled.`;

        showSnackbar({
          message,
          actionLabel: 'Undo',
          onAction: async () => {
            try {
              await restoreDateLogs(targetDate, previousLogs);
            } catch (undoErr) {
              showSnackbar({
                message: getFriendlyErrorMessage(undoErr),
                tone: 'error',
              });
            }
          },
        });
      } catch (err) {
        showSnackbar({
          message: getFriendlyErrorMessage(err),
          tone: 'error',
        });
      } finally {
        bulkPendingRef.current = false;
        if (mountedRef.current) {
          setBulkPending(false);
        }
      }
    },
    [markDateBatchStatus, restoreDateLogs, showSnackbar]
  );

  const handleClearDay = useCallback(async () => {
    const currentToday = getTodayDateString();
    const targetDate = selectedDateRef.current;
    if (targetDate > currentToday || bulkPendingRef.current) {
      return;
    }

    bulkPendingRef.current = true;
    setBulkPending(true);
    setClearModalError(null);

    try {
      const previousLogs = await clearDateLogs(targetDate);
      if (mountedRef.current) {
        setClearModalVisible(false);
      }
      showSnackbar({
        message: 'Cleared marks for the day.',
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await restoreDateLogs(targetDate, previousLogs);
          } catch (undoErr) {
            showSnackbar({
              message: getFriendlyErrorMessage(undoErr),
              tone: 'error',
            });
          }
        },
      });
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      if (mountedRef.current) {
        setClearModalError(message);
      }
      showSnackbar({
        message,
        tone: 'error',
      });
    } finally {
      bulkPendingRef.current = false;
      if (mountedRef.current) {
        setBulkPending(false);
      }
    }
  }, [clearDateLogs, restoreDateLogs, showSnackbar]);

  const handleConfirmClearDay = useCallback(() => {
    if (
      selectedDateRef.current > getTodayDateString() ||
      bulkPendingRef.current
    ) {
      return;
    }

    setClearModalError(null);
    setClearModalVisible(true);
  }, []);

  const handleOpenDateModal = useCallback(() => setDateModalVisible(true), []);
  const handleCloseDateModal = useCallback(() => setDateModalVisible(false), []);
  const handleSelectModalDate = useCallback((nextDate: string) => {
    setFailedDate(null);
    setDateLoadError(null);
    setSelectedDate(nextDate);
  }, []);
  const handleCloseClearModal = useCallback(() => {
    setClearModalError(null);
    setClearModalVisible(false);
  }, []);
  const handleRetryDateLogs = useCallback(() => {
    setFailedDate(null);
    setDateLoadError(null);
    void syncDateLogs(selectedDateRef.current, true);
  }, [syncDateLogs]);
  const handleConfirmClearModal = useCallback(() => {
    void handleClearDay();
  }, [handleClearDay]);
  const handleRetryReload = useCallback(() => {
    void reload(true);
  }, [reload]);
  const handleNavigateSubjects = useCallback(() => {
    router.navigate('/(tabs)/subjects');
  }, []);

  const wholeDayItems: readonly ActionSheetItem[] = useMemo(
    () => [
      {
        label: 'All present',
        icon: 'checkmark-circle-outline',
        disabled: quickActionDisabled,
        onPress: () => {
          void handleBatchStatus('present');
        },
      },
      {
        label: 'All absent',
        icon: 'close-circle-outline',
        disabled: quickActionDisabled,
        onPress: () => {
          void handleBatchStatus('absent');
        },
      },
      {
        label: 'Holiday (all cancelled)',
        icon: 'remove-circle-outline',
        disabled: quickActionDisabled,
        onPress: () => {
          void handleBatchStatus('cancelled');
        },
      },
      {
        label: 'Clear day',
        icon: 'trash-outline',
        destructive: true,
        disabled: isFutureDate || logsLoading || bulkPending,
        onPress: handleConfirmClearDay,
      },
    ],
    [
      bulkPending,
      handleBatchStatus,
      handleConfirmClearDay,
      isFutureDate,
      logsLoading,
      quickActionDisabled,
    ]
  );

  const formattedDaySubtitle = getFormattedDaySubtitle(selectedDate);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleTriggerRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <AppText variant="title">Today</AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {formattedDaySubtitle}
            </AppText>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={handleOpenDateModal}
              disabled={bulkPending}
              android_ripple={{ color: colors.rippleNeutral, foreground: true }}
              accessibilityRole="button"
              accessibilityLabel="Go to date"
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.iconBtnPressed,
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={22}
                color={colors.foreground}
              />
            </Pressable>

            <Pressable
              onPress={() => setMoreSheetVisible(true)}
              disabled={bulkPending}
              android_ripple={{ color: colors.rippleNeutral, foreground: true }}
              accessibilityRole="button"
              accessibilityLabel="Mark whole day"
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.iconBtnPressed,
              ]}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={colors.foreground}
              />
            </Pressable>
          </View>
        </View>

        {/* Compact Date Row */}
        <View style={styles.dateRow}>
          <Pressable
            onPress={handlePreviousDay}
            android_ripple={{ color: colors.rippleNeutral, foreground: true }}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            style={({ pressed }) => [
              styles.arrowBtn,
              pressed && styles.iconBtnPressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={colors.foreground}
            />
          </Pressable>

          <View style={styles.dateLabelGroup}>
            <AppText variant="label" numberOfLines={1}>
              {formatFriendlyDateLabel(selectedDate)}
            </AppText>
            {!isToday ? (
              <Pressable
                onPress={handleBackToToday}
                android_ripple={{ color: colors.rippleNeutral, foreground: true }}
                accessibilityRole="button"
                accessibilityLabel="Back to today"
                style={({ pressed }) => [
                  styles.backToTodayBtn,
                  pressed && styles.backToTodayPressed,
                ]}
              >
                <AppText variant="label" tone="info">
                  Back to today
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={handleNextDay}
            disabled={!canGoNext}
            android_ripple={
              canGoNext
                ? { color: colors.rippleNeutral, foreground: true }
                : undefined
            }
            accessibilityRole="button"
            accessibilityLabel="Next day"
            accessibilityState={{ disabled: !canGoNext }}
            style={({ pressed }) => [
              styles.arrowBtn,
              !canGoNext && styles.arrowBtnDisabled,
              pressed && canGoNext && styles.iconBtnPressed,
            ]}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={canGoNext ? colors.foreground : colors.mutedForeground}
            />
          </Pressable>
        </View>

        <ContentFade loading={status === 'loading'} fallback={<TodaySkeleton />}>
          {status === 'error' ? (
            <ErrorState
              message={error ?? 'Something went wrong. Try again.'}
              onRetry={handleRetryReload}
              style={styles.stateCard}
            />
          ) : subjects.length === 0 ? (
            <EmptyState
              icon="book-outline"
              title="No subjects tracked yet"
              message="Add your subjects and weekly timetable to record daily attendance."
              actionLabel="Add subjects"
              onAction={handleNavigateSubjects}
              style={styles.stateCard}
            />
          ) : daySlots.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No classes scheduled"
              message={`No classes scheduled for ${weekdayName}.`}
              actionLabel="View Timetable"
              onAction={handleNavigateSubjects}
              style={styles.stateCard}
            />
          ) : logsFailed ? (
            <ErrorState
              message={dateLoadError ?? 'Could not load attendance for this date.'}
              onRetry={handleRetryDateLogs}
              style={styles.stateCard}
            />
          ) : (
            <ContentFade
              loading={logsLoading}
              fallback={<TodaySkeleton count={daySlots.length} />}
            >
              <View style={styles.listSection}>
                <TodaySummaryBar
                  markedCount={markedCount}
                  totalCount={daySlots.length}
                  presentCount={presentCount}
                  absentCount={absentCount}
                  cancelledCount={cancelledCount}
                />

                {daySlots.map((slot) => {
                  const subject = subjectById[slot.subject_id];
                  if (!subject) {
                    return null;
                  }
                  const stats = statsBySubject[subject.id];
                  const attended =
                    stats?.attended ?? subject.initial_present;
                  const held = stats?.conducted ?? subject.initial_total;
                  const currentStatus = logsBySlot[slot.id]?.status ?? null;

                  return (
                    <TodayClassCard
                      key={slot.id}
                      slot={slot}
                      subject={subject}
                      attended={attended}
                      held={held}
                      status={currentStatus}
                      pending={bulkPending}
                      isNow={slot.id === nowSlotId}
                      isNext={slot.id === nextSlotId}
                      onSelectStatus={handleSelectStatus}
                    />
                  );
                })}

                <AppText
                  variant="caption"
                  tone="muted"
                  style={styles.hintText}
                >
                  Tap a selected status again to clear it.
                </AppText>
              </View>
            </ContentFade>
          )}
        </ContentFade>
      </ScrollView>

      <ActionSheet
        visible={moreSheetVisible}
        title="Mark whole day"
        subtitle={
          isFutureDate ? 'Future dates cannot be marked.' : formattedDaySubtitle
        }
        items={wholeDayItems}
        onClose={() => setMoreSheetVisible(false)}
      />

      <GoToDateModal
        visible={dateModalVisible}
        onClose={handleCloseDateModal}
        onSelectDate={handleSelectModalDate}
      />

      <ConfirmModal
        visible={clearModalVisible}
        title="Clear day"
        message="Remove all marks for this day?"
        confirmLabel="Clear"
        destructive
        loading={bulkPending}
        error={clearModalError}
        onCancel={handleCloseClearModal}
        onConfirm={handleConfirmClearModal}
      />
    </Screen>
  );
}

const createStyles = createThemedStyles((colors: ThemeColors) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl + 24,
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    headerTextCol: {
      flex: 1,
      gap: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.control,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    iconBtnPressed: {
      backgroundColor: colors.muted,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.control,
      backgroundColor: colors.card,
      minHeight: 44,
      overflow: 'hidden',
    },
    arrowBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    arrowBtnDisabled: {
      opacity: 0.4,
    },
    dateLabelGroup: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    backToTodayBtn: {
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.small,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    backToTodayPressed: {
      backgroundColor: colors.muted,
    },
    stateCard: {
      marginTop: spacing.lg,
    },
    listSection: {
      marginTop: spacing.lg,
      gap: spacing.md,
    },
    hintText: {
      textAlign: 'center',
      fontFamily: fontFamily.regular,
      marginTop: spacing.xs,
    },
  })
);
