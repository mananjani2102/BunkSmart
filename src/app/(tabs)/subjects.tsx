import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { SubjectsSkeleton } from '@/components/SkeletonLayouts';
import { TimetableDayView } from '@/components/TimetableDayView';
import {
  ActionSheet,
  type ActionSheetItem,
} from '@/components/ui/ActionSheet';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ContentFade } from '@/components/ui/ContentFade';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FadeView } from '@/components/ui/FadeView';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import {
  useDataActions,
  useDataState,
  useDataStats,
} from '@/context/DataProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import { formatDisplayPercent, pluralizeClasses } from '@/lib/attendance';
import { getIsoWeekday, getTodayDateString } from '@/lib/dates';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';
import { type Subject } from '@/types/db';

type SubjectsTab = 'subjects' | 'timetable';

const TAB_OPTIONS: readonly SegmentedOption<SubjectsTab>[] = [
  { label: 'Subjects', value: 'subjects' },
  { label: 'Timetable', value: 'timetable' },
];

interface SubjectListRowProps {
  id: string;
  name: string;
  targetPercent: number;
  weeklyClassCount: number;
  attended: number;
  held: number;
  onOpenDetail: (subjectId: string) => void;
}

const SubjectListRow = memo(function SubjectListRow({
  id,
  name,
  targetPercent,
  weeklyClassCount,
  attended,
  held,
  onOpenDetail,
}: SubjectListRowProps) {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);

  const handlePress = useCallback(() => {
    onOpenDetail(id);
  }, [id, onOpenDetail]);

  const displayPercent = formatDisplayPercent(attended, held);
  const subtitle = `${weeklyClassCount} ${pluralizeClasses(weeklyClassCount)} per week, target ${targetPercent}%`;

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{ color: colors.rippleNeutral, foreground: true }}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${subtitle}, Attendance ${displayPercent}`}
      style={({ pressed }) => [
        styles.subjectRow,
        pressed && styles.subjectRowPressed,
      ]}
    >
      <View style={styles.subjectInfoCol}>
        <AppText variant="body" numberOfLines={2} style={styles.subjectName}>
          {name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={2}>
          {subtitle}
        </AppText>
      </View>

      <View style={styles.subjectRightGroup}>
        <AppText variant="label" style={styles.subjectPercent}>
          {displayPercent}
        </AppText>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.mutedForeground}
        />
      </View>
    </Pressable>
  );
});

export default function SubjectsScreen() {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const { status, error, subjects, slots } = useDataState();
  const { statsBySubject } = useDataStats();
  const { reload } = useDataActions();
  const { showSnackbar } = useSnackbarActions();

  const [activeTab, setActiveTab] = useState<SubjectsTab>('subjects');
  const [selectedWeekday, setSelectedWeekday] = useState<number>(() =>
    getIsoWeekday(getTodayDateString())
  );
  const selectedWeekdayRef = useRef(selectedWeekday);
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const todayWeekday = useMemo(() => getIsoWeekday(getTodayDateString()), []);

  const slotCountBySubject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const slot of slots) {
      counts[slot.subject_id] = (counts[slot.subject_id] ?? 0) + 1;
    }
    return counts;
  }, [slots]);

  const subjectById = useMemo(() => {
    const map: Record<string, Subject> = {};
    for (const subject of subjects) {
      map[subject.id] = subject;
    }
    return map;
  }, [subjects]);

  useEffect(() => {
    selectedWeekdayRef.current = selectedWeekday;
  }, [selectedWeekday]);

  const daySlots = useMemo(() => {
    return slots
      .filter((slot) => slot.weekday === selectedWeekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [slots, selectedWeekday]);

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await reload(true, true);
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
  }, [reload, showSnackbar]);

  const handleTriggerRefresh = useCallback(() => {
    void handleRefresh();
  }, [handleRefresh]);

  const handleRetryReload = useCallback(() => {
    void reload(true);
  }, [reload]);

  const openNewSubject = useCallback(() => {
    router.push('/subject-form');
  }, []);

  const openSubjectDetail = useCallback((subjectId: string) => {
    router.push(`/subject/${encodeURIComponent(subjectId)}`);
  }, []);

  const openNewSlot = useCallback(() => {
    router.push(`/slot-form?weekday=${selectedWeekdayRef.current}`);
  }, []);

  const openEditSlot = useCallback((slotId: string) => {
    router.push(`/slot-form?id=${encodeURIComponent(slotId)}`);
  }, []);

  const openTimetableImport = useCallback(() => {
    router.push('/timetable-import');
  }, []);

  const openPastAttendance = useCallback(() => {
    router.push('/past-attendance');
  }, []);

  const openStartingAttendance = useCallback(() => {
    router.push('/starting-attendance');
  }, []);

  const moreItems: readonly ActionSheetItem[] = useMemo(
    () => [
      {
        label: 'Import timetable from text',
        icon: 'document-text-outline',
        onPress: openTimetableImport,
      },
      {
        label: 'Add past attendance',
        icon: 'time-outline',
        onPress: openPastAttendance,
      },
      {
        label: 'Starting attendance',
        icon: 'school-outline',
        onPress: openStartingAttendance,
      },
    ],
    [openPastAttendance, openStartingAttendance, openTimetableImport]
  );

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
          <AppText variant="title" style={styles.headerTitle}>
            Subjects
          </AppText>

          <View style={styles.headerActions}>
            <Pressable
              onPress={openNewSubject}
              android_ripple={{ color: colors.rippleNeutral, foreground: true }}
              accessibilityRole="button"
              accessibilityLabel="Add subject"
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.iconBtnPressed,
              ]}
            >
              <Ionicons name="add" size={24} color={colors.foreground} />
            </Pressable>

            <Pressable
              onPress={() => setMoreSheetVisible(true)}
              android_ripple={{ color: colors.rippleNeutral, foreground: true }}
              accessibilityRole="button"
              accessibilityLabel="More options"
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

        {/* Segmented Control */}
        <Segmented
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={setActiveTab}
          style={styles.topSegmented}
        />

        <ContentFade
          loading={status === 'loading'}
          fallback={<SubjectsSkeleton tab={activeTab} />}
        >
          {status === 'error' ? (
            <ErrorState
              message={error ?? 'Something went wrong. Try again.'}
              onRetry={handleRetryReload}
              style={styles.stateCard}
            />
          ) : (
            <FadeView transitionKey={activeTab}>
              {activeTab === 'subjects' ? (
                subjects.length === 0 ? (
                  <EmptyState
                    icon="book-outline"
                    title="No subjects tracked yet"
                    message="Add your subjects to track attendance and customize targets."
                    actionLabel="Add your first subject"
                    onAction={openNewSubject}
                    style={styles.stateCard}
                  />
                ) : (
                  <View style={styles.subjectsContainer}>
                    <Card style={styles.groupedCard}>
                      {subjects.map((subject, index) => {
                        const count = slotCountBySubject[subject.id] ?? 0;
                        const stats = statsBySubject[subject.id];
                        const attended =
                          stats?.attended ?? subject.initial_present;
                        const held = stats?.conducted ?? subject.initial_total;

                        return (
                          <View key={subject.id}>
                            {index > 0 ? <Divider /> : null}
                            <SubjectListRow
                              id={subject.id}
                              name={subject.name}
                              targetPercent={subject.target_percent}
                              weeklyClassCount={count}
                              attended={attended}
                              held={held}
                              onOpenDetail={openSubjectDetail}
                            />
                          </View>
                        );
                      })}
                    </Card>
                  </View>
                )
              ) : subjects.length === 0 ? (
                <EmptyState
                  icon="calendar-outline"
                  title="No subjects available"
                  message="Add at least one subject before scheduling your weekly timetable."
                  actionLabel="Add subject"
                  onAction={openNewSubject}
                  style={styles.stateCard}
                />
              ) : (
                <TimetableDayView
                  selectedWeekday={selectedWeekday}
                  todayWeekday={todayWeekday}
                  daySlots={daySlots}
                  subjectById={subjectById}
                  onSelectWeekday={setSelectedWeekday}
                  onAddClass={openNewSlot}
                  onEditSlot={openEditSlot}
                />
              )}
            </FadeView>
          )}
        </ContentFade>
      </ScrollView>

      <ActionSheet
        visible={moreSheetVisible}
        items={moreItems}
        onClose={() => setMoreSheetVisible(false)}
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
    headerTitle: {
      flex: 1,
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
    topSegmented: {
      marginTop: spacing.lg,
    },
    stateCard: {
      marginTop: spacing.lg,
    },
    subjectsContainer: {
      marginTop: spacing.lg,
    },
    groupedCard: {
      padding: 0,
      overflow: 'hidden',
    },
    subjectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 58,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    subjectRowPressed: {
      backgroundColor: colors.muted,
    },
    subjectInfoCol: {
      flex: 1,
      gap: 2,
    },
    subjectName: {
      fontFamily: fontFamily.semibold,
    },
    subjectRightGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
    },
    subjectPercent: {
      fontFamily: fontFamily.semibold,
      color: colors.foreground,
      fontVariant: ['tabular-nums'],
    },
  })
);
