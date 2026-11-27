import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { OverviewSkeleton } from '@/components/SkeletonLayouts';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ContentFade } from '@/components/ui/ContentFade';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  formatAttendanceActionText,
  getLevelFillColor,
  getLevelLabel,
  getLevelTextTone,
} from '@/components/ui/LevelBadge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { useAuthState } from '@/context/AuthProvider';
import {
  useDataActions,
  useDataDateLogs,
  useDataDerived,
  useDataState,
  useDataStats,
} from '@/context/DataProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import {
  clampTarget,
  formatDisplayPercent,
  formatPercentSpoken,
  getAttendanceLevel,
  getAttendanceRatio,
  getInsightText,
  levelToTone,
  pluralizeClasses,
  type AttendanceLevel,
  type AttendanceTone,
} from '@/lib/attendance';
import {
  formatFriendlyDateLabel,
  formatTime12Hour,
  getIsoWeekday,
  getTodayDateString,
  LONG_MONTHS,
  LONG_WEEKDAYS,
  timeStringToMinutes,
} from '@/lib/dates';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  readOverviewBaselineHintDismissed,
  writeOverviewBaselineHintDismissed,
} from '@/lib/prefs';
import { useMinuteTicker } from '@/lib/ticker';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';
import { type AttendanceLog } from '@/types/db';

type SubjectFilter = 'all' | 'below';

const EMPTY_LOGS: readonly AttendanceLog[] = [];
const FILTER_THRESHOLD = 8;

const SUBJECT_FILTER_OPTIONS: readonly SegmentedOption<SubjectFilter>[] = [
  { label: 'All', value: 'all' },
  { label: 'Below target', value: 'below' },
];

function getUrgencyRank(level: AttendanceLevel): number {
  switch (level) {
    case 'below':
      return 0;
    case 'borderline':
      return 1;
    case 'safe':
    case 'no_data':
    default:
      return 2;
  }
}

function getCurrentDateContext(minuteKey: number) {
  const now = minuteKey >= 0 ? new Date() : new Date();
  const dayName = LONG_WEEKDAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const monthName = LONG_MONTHS[now.getMonth()];
  return {
    formattedDate: `${dayName}, ${now.getDate()} ${monthName}`,
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
    todayStr: getTodayDateString(),
  };
}

interface OverviewHeroCardProps {
  attended: number;
  held: number;
  defaultTarget: number;
  overallRatio: number | null;
  overallTone: AttendanceTone;
  overallLevel: AttendanceLevel;
  overallDisplay: string;
  overallSpoken: string;
  overallInsight: string;
  overallCaption: string;
  showCollegeLink: boolean;
  onPressCollegeLink: () => void;
}

const OverviewHeroCard = memo(function OverviewHeroCard({
  attended,
  held,
  defaultTarget,
  overallRatio,
  overallTone,
  overallLevel,
  overallDisplay,
  overallSpoken,
  overallInsight,
  overallCaption,
  showCollegeLink,
  onPressCollegeLink,
}: OverviewHeroCardProps) {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const dotColor = getLevelFillColor(overallLevel, colors);
  const insightTone = getLevelTextTone(overallLevel);
  const levelLabel = getLevelLabel(overallLevel);

  return (
    <Card style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <ProgressRing
          value={overallRatio}
          target={defaultTarget}
          size={96}
          strokeWidth={9}
          tone={overallTone}
          label={overallDisplay}
          accessibilityLabel={`Overall attendance, ${overallSpoken}, target ${defaultTarget} percent`}
        />

        <View style={styles.heroRightCol}>
          <AppText variant="heading" style={styles.tabular}>
            {attended} of {held} classes
          </AppText>
          <AppText variant="label" tone="muted" style={styles.tabular}>
            Target {defaultTarget}%
          </AppText>
        </View>
      </View>

      <View
        accessible
        accessibilityLabel={`${levelLabel}. ${overallInsight}`}
        style={styles.heroInsightRow}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.statusDot, { backgroundColor: dotColor }]}
        />
        <AppText variant="body" tone={insightTone} style={styles.flexOne}>
          {overallInsight}
        </AppText>
      </View>

      <View style={styles.heroFooter}>
        <View style={styles.captionRow}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={colors.mutedForeground}
            style={styles.captionIcon}
          />
          <AppText variant="caption" tone="muted" style={styles.flexOne}>
            {overallCaption}
          </AppText>
        </View>

        {showCollegeLink ? (
          <Pressable
            onPress={onPressCollegeLink}
            accessibilityRole="button"
            accessibilityLabel="Add your college number"
            android_ripple={{ color: colors.rippleNeutral, foreground: true }}
            style={({ pressed }) => [
              styles.textLinkButton,
              pressed && styles.textLinkPressed,
            ]}
          >
            <AppText variant="label" tone="info" style={styles.textLinkLabel}>
              Add your college number
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
});

interface OverviewSubjectRowProps {
  id: string;
  name: string;
  attended: number;
  held: number;
  target: number;
  level: AttendanceLevel;
  ratio: number | null;
  displayPercent: string;
  spokenPercent: string;
  actionStatusText: string;
  onPressSubject: (subjectId: string) => void;
}

const OverviewSubjectRow = memo(function OverviewSubjectRow({
  id,
  name,
  attended,
  held,
  target,
  level,
  ratio,
  displayPercent,
  spokenPercent,
  actionStatusText,
  onPressSubject,
}: OverviewSubjectRowProps) {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);

  const handlePress = useCallback(() => {
    onPressSubject(id);
  }, [onPressSubject, id]);

  const fillColor = getLevelFillColor(level, colors);
  const statusTone = getLevelTextTone(level);
  const levelLabel = getLevelLabel(level);
  const fillWidth =
    held > 0 && ratio !== null ? Math.min(100, Math.max(0, ratio)) : 0;

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{ color: colors.rippleNeutral, foreground: true }}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${levelLabel}, ${spokenPercent}, ${attended} of ${held} classes, ${actionStatusText}`}
      style={({ pressed }) => [
        styles.subjectRow,
        pressed && styles.subjectRowPressed,
      ]}
    >
      <View style={styles.subjectTopRow}>
        <View style={styles.subjectNameCol}>
          <AppText variant="heading" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.tabular}>
            {attended} of {held} classes
          </AppText>
        </View>
        <AppText variant="heading" tone="default" style={styles.tabular}>
          {displayPercent}
        </AppText>
      </View>

      <View style={styles.subjectBarWrapper}>
        <View style={styles.subjectBarTrack}>
          {held > 0 ? (
            <View
              style={[
                styles.subjectBarFill,
                {
                  width: `${fillWidth}%`,
                  backgroundColor: fillColor,
                },
              ]}
            />
          ) : null}
        </View>
        <View
          pointerEvents="none"
          style={[styles.subjectTargetTick, { left: `${target}%` }]}
        />
      </View>

      <View style={styles.subjectStatusRow}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.smallStatusDot, { backgroundColor: fillColor }]}
        />
        <AppText variant="caption" tone={statusTone} numberOfLines={1}>
          {actionStatusText}
        </AppText>
      </View>
    </Pressable>
  );
});

export default function OverviewScreen() {
  const { colors, scheme } = useTheme();
  const styles = createStyles(colors, scheme);
  const { user, profile } = useAuthState();
  const { status, error, subjects, slots, trackedSince } = useDataState();
  const { statsBySubject } = useDataStats();
  const { overall } = useDataDerived();
  const { dateLogsByDate } = useDataDateLogs();
  const { reload, reloadStats, loadDateLogs } = useDataActions();
  const { showSnackbar } = useSnackbarActions();

  const [isFocused, setIsFocused] = useState(true);
  const minuteKey = useMinuteTicker(isFocused);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SubjectFilter>('all');
  const [hintState, setHintState] = useState<{
    userId: string | null;
    dismissed: boolean;
  }>({ userId: null, dismissed: true });

  const mountedRef = useRef(true);
  const refreshingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      return;
    }

    let cancelled = false;
    void readOverviewBaselineHintDismissed(userId).then((dismissed) => {
      if (!cancelled && mountedRef.current) {
        setHintState({ userId, dismissed });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleDismissHint = useCallback(() => {
    const userId = user?.id;
    if (!userId) {
      return;
    }
    setHintState({ userId, dismissed: true });
    void writeOverviewBaselineHintDismissed(userId, true);
  }, [user?.id]);

  const hintLoaded = Boolean(user?.id && hintState.userId === user.id);
  const hintDismissed = !hintLoaded || hintState.dismissed;

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      void reloadStats(false);
      void loadDateLogs(getTodayDateString(), false).catch(() => undefined);
      return () => {
        setIsFocused(false);
      };
    }, [loadDateLogs, reloadStats])
  );

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        reload(true, true),
        loadDateLogs(getTodayDateString(), true).catch(() => undefined),
      ]);
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

  const handleOpenSubject = useCallback((subjectId: string) => {
    router.push(`/subject/${encodeURIComponent(subjectId)}`);
  }, []);

  const handleRetryReload = useCallback(() => {
    void reload(true);
  }, [reload]);

  const handleGoToday = useCallback(() => {
    router.navigate('/(tabs)/today');
  }, []);

  const handleGoSubjects = useCallback(() => {
    router.navigate('/(tabs)/subjects');
  }, []);

  const handleGoStartingAttendance = useCallback(() => {
    router.push('/starting-attendance');
  }, []);

  const handleGoSimulator = useCallback(() => {
    router.push('/simulator');
  }, []);

  const { formattedDate, nowMinutes, todayStr } = useMemo(
    () => getCurrentDateContext(minuteKey),
    [minuteKey]
  );

  const todayLogs = dateLogsByDate[todayStr]?.logs ?? EMPTY_LOGS;
  const defaultTarget = clampTarget(profile?.default_target ?? 75);

  const subjectSummaries = useMemo(() => {
    const items = subjects.map((subject) => {
      const stats = statsBySubject[subject.id];
      const attended = stats?.attended ?? subject.initial_present;
      const held = stats?.conducted ?? subject.initial_total;
      const target = clampTarget(subject.target_percent);
      const level = getAttendanceLevel(attended, held, target);
      const ratio = getAttendanceRatio(attended, held);
      const displayPercent = formatDisplayPercent(attended, held);
      const spokenPercent = formatPercentSpoken(attended, held);
      const actionStatusText = formatAttendanceActionText(
        attended,
        held,
        target
      );

      return {
        subject,
        attended,
        held,
        target,
        level,
        ratio,
        displayPercent,
        spokenPercent,
        actionStatusText,
      };
    });

    return items.sort((a, b) => {
      const rankDiff = getUrgencyRank(a.level) - getUrgencyRank(b.level);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return a.subject.name.localeCompare(b.subject.name);
    });
  }, [subjects, statsBySubject]);

  const overallLevel = getAttendanceLevel(
    overall.attended,
    overall.held,
    defaultTarget
  );
  const overallTone = levelToTone(overallLevel);
  const overallRatio = getAttendanceRatio(overall.attended, overall.held);
  const overallDisplay = formatDisplayPercent(overall.attended, overall.held);
  const overallSpoken = formatPercentSpoken(overall.attended, overall.held);

  const overallInsight = useMemo(
    () => getInsightText(overall.attended, overall.held, defaultTarget),
    [overall.attended, overall.held, defaultTarget]
  );

  const overallCaption = useMemo(() => {
    if (overall.mode === 'college' && overall.asOfDate) {
      return `College figure up to ${formatFriendlyDateLabel(overall.asOfDate)}, plus classes you marked since.`;
    }
    return `Counted from classes you marked since ${formatFriendlyDateLabel(trackedSince)}.`;
  }, [overall.mode, overall.asOfDate, trackedSince]);

  const showBaselineHint =
    status === 'ready' &&
    overall.mode === 'tracked' &&
    hintLoaded &&
    !hintDismissed;

  const showSubjectsFilter = subjects.length > FILTER_THRESHOLD;
  const activeFilter: SubjectFilter = showSubjectsFilter ? filter : 'all';

  const visibleSubjects = useMemo(() => {
    if (activeFilter === 'below') {
      return subjectSummaries.filter((item) => item.level === 'below');
    }
    return subjectSummaries;
  }, [activeFilter, subjectSummaries]);

  const todayWeekday = useMemo(() => getIsoWeekday(todayStr), [todayStr]);
  const todaySlots = useMemo(
    () => slots.filter((slot) => slot.weekday === todayWeekday),
    [slots, todayWeekday]
  );

  const markedTodayCount = useMemo(() => {
    const markedSlotIds = new Set<string>();
    for (const log of todayLogs) {
      if (log.slot_id) {
        markedSlotIds.add(log.slot_id);
      }
    }
    return todaySlots.filter((slot) => markedSlotIds.has(slot.id)).length;
  }, [todaySlots, todayLogs]);

  const unmarkedTodayCount = Math.max(0, todaySlots.length - markedTodayCount);

  const subjectNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of subjects) {
      map[s.id] = s.name;
    }
    return map;
  }, [subjects]);

  const upcomingClass = useMemo(() => {
    if (todaySlots.length === 0) {
      return null;
    }
    const sorted = [...todaySlots].sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    );
    const nextSlot =
      sorted.find((s) => {
        try {
          return timeStringToMinutes(s.start_time) >= nowMinutes;
        } catch {
          return false;
        }
      }) ?? sorted[0];

    const name = subjectNameById[nextSlot.subject_id];
    if (!name) {
      return null;
    }

    try {
      return {
        name,
        timeLabel: formatTime12Hour(nextSlot.start_time),
      };
    } catch {
      return {
        name,
        timeLabel: '',
      };
    }
  }, [nowMinutes, subjectNameById, todaySlots]);

  const todaySubtitle =
    todaySlots.length === 0
      ? 'No classes today'
      : `${todaySlots.length} ${pluralizeClasses(todaySlots.length)}, ${unmarkedTodayCount} not marked`;

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
            progressBackgroundColor={colors.popover}
          />
        }
      >
        <View style={styles.header}>
          <AppText variant="caption" tone="muted">
            {formattedDate}
          </AppText>
          <AppText variant="title">Overview</AppText>
        </View>

        <ContentFade
          loading={status === 'loading'}
          fallback={<OverviewSkeleton />}
        >
          {status === 'error' ? (
            <ErrorState
              message={error ?? 'Something went wrong. Try again.'}
              onRetry={handleRetryReload}
              style={styles.stateCard}
            />
          ) : subjects.length === 0 ? (
            <View style={styles.sectionStack}>
              {overall.mode === 'college' ? (
                <OverviewHeroCard
                  attended={overall.attended}
                  held={overall.held}
                  defaultTarget={defaultTarget}
                  overallRatio={overallRatio}
                  overallTone={overallTone}
                  overallLevel={overallLevel}
                  overallDisplay={overallDisplay}
                  overallSpoken={overallSpoken}
                  overallInsight={overallInsight}
                  overallCaption={overallCaption}
                  showCollegeLink={false}
                  onPressCollegeLink={handleGoStartingAttendance}
                />
              ) : null}

              <EmptyState
                icon="grid-outline"
                title="No subjects tracked yet"
                message="Add your subjects or import a timetable from the Subjects tab."
                actionLabel="Add your first subject"
                onAction={handleGoSubjects}
                style={styles.stateCard}
              />

              {showBaselineHint ? (
                <Card style={styles.hintCard}>
                  <AppText variant="body">
                    Does your college portal show only overall attendance? Add that
                    number so your overall matches.
                  </AppText>
                  <View style={styles.hintCardActions}>
                    <Button
                      title="Add number"
                      onPress={handleGoStartingAttendance}
                    />
                    <Button
                      title="Dismiss"
                      variant="secondary"
                      onPress={handleDismissHint}
                    />
                  </View>
                </Card>
              ) : null}
            </View>
          ) : (
            <View style={styles.sectionStack}>
            <OverviewHeroCard
              attended={overall.attended}
              held={overall.held}
              defaultTarget={defaultTarget}
              overallRatio={overallRatio}
              overallTone={overallTone}
              overallLevel={overallLevel}
              overallDisplay={overallDisplay}
              overallSpoken={overallSpoken}
              overallInsight={overallInsight}
              overallCaption={overallCaption}
              showCollegeLink={overall.mode === 'tracked'}
              onPressCollegeLink={handleGoStartingAttendance}
            />

            {showBaselineHint ? (
              <Card style={styles.hintCard}>
                <AppText variant="body">
                  Does your college portal show only overall attendance? Add that
                  number so your overall matches.
                </AppText>
                <View style={styles.hintCardActions}>
                  <Button
                    title="Add number"
                    onPress={handleGoStartingAttendance}
                  />
                  <Button
                    title="Dismiss"
                    variant="secondary"
                    onPress={handleDismissHint}
                  />
                </View>
              </Card>
            ) : null}

            <Card
              onPress={handleGoToday}
              accessibilityLabel={`Today. ${todaySubtitle}.${upcomingClass ? ` Next: ${upcomingClass.name} ${upcomingClass.timeLabel}` : ''}`}
              style={styles.navRowCard}
            >
              <View style={styles.navRowContent}>
                <View style={styles.navRowLeft}>
                  <AppText variant="heading">Today</AppText>
                  <AppText
                    variant="caption"
                    tone="muted"
                    style={styles.tabular}
                  >
                    {todaySubtitle}
                  </AppText>
                </View>

                <View style={styles.todayRightGroup}>
                  {upcomingClass ? (
                    <View style={styles.todayRightText}>
                      <AppText variant="label" numberOfLines={1}>
                        {upcomingClass.name}
                      </AppText>
                      {upcomingClass.timeLabel ? (
                        <AppText
                          variant="caption"
                          tone="muted"
                          style={styles.tabular}
                        >
                          {upcomingClass.timeLabel}
                        </AppText>
                      ) : null}
                    </View>
                  ) : null}
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.mutedForeground}
                  />
                </View>
              </View>
            </Card>

            <Card
              onPress={handleGoSimulator}
              accessibilityLabel="What-if simulator"
              style={styles.navRowCard}
            >
              <View style={styles.navRowContent}>
                <AppText variant="heading">What-if simulator</AppText>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.mutedForeground}
                />
              </View>
            </Card>

            <View style={styles.subjectsSection}>
              <AppText variant="heading">Subjects</AppText>

              {showSubjectsFilter ? (
                <Segmented
                  options={SUBJECT_FILTER_OPTIONS}
                  value={activeFilter}
                  onChange={setFilter}
                />
              ) : null}

              <Card style={styles.subjectsGroupedCard}>
                {visibleSubjects.length === 0 ? (
                  <View style={styles.emptyFilterRow}>
                    <AppText variant="body" tone="muted">
                      No subjects below target.
                    </AppText>
                  </View>
                ) : (
                  visibleSubjects.map((item, index) => (
                    <View key={item.subject.id}>
                      {index > 0 ? <Divider /> : null}
                      <OverviewSubjectRow
                        id={item.subject.id}
                        name={item.subject.name}
                        attended={item.attended}
                        held={item.held}
                        target={item.target}
                        level={item.level}
                        ratio={item.ratio}
                        displayPercent={item.displayPercent}
                        spokenPercent={item.spokenPercent}
                        actionStatusText={item.actionStatusText}
                        onPressSubject={handleOpenSubject}
                      />
                    </View>
                  ))
                )}
              </Card>
            </View>
          </View>
          )}
        </ContentFade>
      </ScrollView>
    </Screen>
  );
}

const createStyles = createThemedStyles((colors: ThemeColors) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl + 40,
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
    },
    header: {
      gap: 2,
      marginBottom: spacing.lg,
    },
    sectionStack: {
      gap: spacing.lg,
    },
    stateCard: {
      marginTop: spacing.sm,
    },
    tabular: {
      fontVariant: ['tabular-nums'],
    },
    flexOne: {
      flex: 1,
    },

    /* Hero Card */
    heroCard: {
      gap: spacing.md,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    heroRightCol: {
      flex: 1,
      gap: spacing.xs,
    },
    heroInsightRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: radius.dot,
      marginTop: 7,
    },
    heroFooter: {
      gap: spacing.xs,
    },
    captionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    captionIcon: {
      marginTop: 1,
    },
    textLinkButton: {
      minHeight: 44,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      paddingRight: spacing.sm,
      borderRadius: radius.small,
    },
    textLinkPressed: {
      opacity: 0.7,
    },
    textLinkLabel: {
      fontFamily: fontFamily.medium,
    },

    /* Baseline Hint Card */
    hintCard: {
      gap: spacing.md,
    },
    hintCardActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },

    /* Navigation Row Cards */
    navRowCard: {
      padding: spacing.lg,
    },
    navRowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    navRowLeft: {
      flex: 1,
      gap: 2,
    },
    todayRightGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      maxWidth: '48%',
    },
    todayRightText: {
      alignItems: 'flex-end',
      gap: 2,
    },

    /* Subjects Grouped Section */
    subjectsSection: {
      gap: spacing.md,
    },
    subjectsGroupedCard: {
      padding: 0,
      overflow: 'hidden',
    },
    emptyFilterRow: {
      padding: spacing.lg,
    },
    subjectRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      minHeight: 44,
    },
    subjectRowPressed: {
      backgroundColor: colors.muted,
    },
    subjectTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    subjectNameCol: {
      flex: 1,
      gap: 2,
    },
    subjectBarWrapper: {
      height: 6,
      justifyContent: 'center',
      position: 'relative',
    },
    subjectBarTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.muted,
      overflow: 'hidden',
    },
    subjectBarFill: {
      height: '100%',
      borderRadius: 2,
    },
    subjectTargetTick: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      marginLeft: -1,
      backgroundColor: colors.foreground,
    },
    subjectStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    smallStatusDot: {
      width: 6,
      height: 6,
      borderRadius: radius.dot,
    },
  })
);
