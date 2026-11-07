import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthProvider';
import { useData } from '@/context/DataProvider';
import { fetchLogsForDate } from '@/data/logs';
import {
  canSkip,
  clampTarget,
  combineCounts,
  formatDisplayPercent,
  formatPercentSpoken,
  getAttendanceLevel,
  getAttendanceRatio,
  levelToTone,
  meetsTarget,
  mustAttend,
  pluralizeClasses,
  type AttendanceTone,
} from '@/lib/attendance';
import {
  formatTime12Hour,
  getIsoWeekday,
  getTodayDateString,
  LONG_WEEKDAYS,
  SHORT_MONTHS,
  timeStringToMinutes,
} from '@/lib/dates';
import { colors, radius, spacing } from '@/theme/tokens';
import { type AttendanceLog } from '@/types/db';

type SubjectFilter = 'all' | 'risk' | 'safe';

function getSubjectInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return 'SB';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function getGreeting(fullName?: string): { greeting: string; firstName: string } {
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
  } else if (hour >= 17 && hour < 22) {
    greeting = 'Good evening';
  } else if (hour >= 22 || hour < 4) {
    greeting = 'Welcome back';
  }
  const firstName = fullName?.trim()?.split(/\s+/)?.[0] || 'Student';
  return { greeting, firstName };
}

function getFormattedTodayHeader(): string {
  const now = new Date();
  const dayName = LONG_WEEKDAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const monthName = SHORT_MONTHS[now.getMonth()];
  return `${dayName}, ${now.getDate()} ${monthName}`;
}

export default function OverviewScreen() {
  const { profile } = useAuth();
  const { status, error, subjects, slots, statsBySubject, reload, reloadStats } =
    useData();

  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SubjectFilter>('all');

  const mountedRef = useRef(true);
  const logsFetchIdRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadTodayLogs = useCallback(async () => {
    const requestId = ++logsFetchIdRef.current;
    const todayStr = getTodayDateString();
    try {
      const rows = await fetchLogsForDate(todayStr);
      if (mountedRef.current && logsFetchIdRef.current === requestId) {
        setTodayLogs(rows);
      }
    } catch {
      // Keep last known logs on silent overview refresh failure.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadStats();
      void loadTodayLogs();
    }, [reloadStats, loadTodayLogs])
  );

  const handleRefresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await Promise.all([reload(true), loadTodayLogs()]);
    } finally {
      refreshingRef.current = false;
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  };

  const defaultTarget = clampTarget(profile?.default_target ?? 75);

  const subjectSummaries = useMemo(() => {
    return subjects.map((subject) => {
      const stats = statsBySubject[subject.id];
      const attended = stats?.attended ?? subject.initial_present;
      const held = stats?.conducted ?? subject.initial_total;
      const target = clampTarget(subject.target_percent);
      const level = getAttendanceLevel(attended, held, target);
      const tone = levelToTone(level);
      const ratio = getAttendanceRatio(attended, held);
      const displayPercent = formatDisplayPercent(attended, held);
      const spokenPercent = formatPercentSpoken(attended, held);
      const canSkipCount = canSkip(attended, held, target);
      const needed = mustAttend(attended, held, target);

      let actionBadgeText = 'No data';
      let actionBadgeTone: AttendanceTone = 'muted';
      if (held > 0) {
        if (!meetsTarget(attended, held, target)) {
          actionBadgeText = `Need ${needed}`;
          actionBadgeTone = 'danger';
        } else if (canSkipCount === 0) {
          actionBadgeText = 'On margin';
          actionBadgeTone = 'warn';
        } else {
          actionBadgeText = `Can bunk ${canSkipCount}`;
          actionBadgeTone = 'safe';
        }
      }

      return {
        subject,
        attended,
        held,
        target,
        level,
        tone,
        ratio,
        displayPercent,
        spokenPercent,
        canSkipCount,
        needed,
        actionBadgeText,
        actionBadgeTone,
        initials: getSubjectInitials(subject.name),
      };
    });
  }, [subjects, statsBySubject]);

  const overall = useMemo(
    () =>
      combineCounts(
        subjectSummaries.map((item) => ({
          attended: item.attended,
          held: item.held,
        }))
      ),
    [subjectSummaries]
  );

  const overallLevel = getAttendanceLevel(
    overall.attended,
    overall.held,
    defaultTarget
  );
  const overallTone = levelToTone(overallLevel);
  const overallRatio = getAttendanceRatio(overall.attended, overall.held);
  const overallDisplay = formatDisplayPercent(overall.attended, overall.held);
  const overallSpoken = formatPercentSpoken(overall.attended, overall.held);

  const overallCanSkip = useMemo(
    () => canSkip(overall.attended, overall.held, defaultTarget),
    [overall, defaultTarget]
  );

  const overallMustAttend = useMemo(
    () => mustAttend(overall.attended, overall.held, defaultTarget),
    [overall, defaultTarget]
  );

  const belowTargetSubjects = useMemo(
    () => subjectSummaries.filter((item) => item.level === 'below'),
    [subjectSummaries]
  );

  const borderlineSubjects = useMemo(
    () => subjectSummaries.filter((item) => item.level === 'borderline'),
    [subjectSummaries]
  );

  const safeSubjects = useMemo(
    () => subjectSummaries.filter((item) => item.level === 'safe'),
    [subjectSummaries]
  );

  const atRiskCount = belowTargetSubjects.length + borderlineSubjects.length;

  const filteredSubjects = useMemo(() => {
    if (filter === 'risk') {
      return subjectSummaries.filter(
        (item) => item.level === 'below' || item.level === 'borderline'
      );
    }
    if (filter === 'safe') {
      return subjectSummaries.filter((item) => item.level === 'safe');
    }
    return subjectSummaries;
  }, [subjectSummaries, filter]);

  const todayWeekday = getIsoWeekday(getTodayDateString());
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

  // Find next upcoming class teaser
  const upcomingClassTeaser = useMemo(() => {
    if (todaySlots.length === 0) return null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
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

    const subj = subjects.find((s) => s.id === nextSlot.subject_id);
    if (!subj) return null;

    try {
      return `${subj.name} at ${formatTime12Hour(nextSlot.start_time)}`;
    } catch {
      return subj.name;
    }
  }, [todaySlots, subjects]);

  const { greeting, firstName } = getGreeting(profile?.full_name);
  const formattedDate = getFormattedTodayHeader();

  // Visual tones for Overall Hero
  const heroBadgeConfig = useMemo(() => {
    if (overall.held === 0) {
      return {
        label: 'No Data Yet',
        dotColor: colors.textMuted,
        bgColor: colors.surfaceMuted,
        textColor: colors.textMuted,
      };
    }
    if (overallLevel === 'below') {
      return {
        label: 'Action Required',
        dotColor: colors.danger,
        bgColor: colors.dangerBg,
        textColor: colors.danger,
      };
    }
    if (overallLevel === 'borderline') {
      return {
        label: 'On Edge',
        dotColor: colors.warn,
        bgColor: colors.warnBg,
        textColor: colors.warn,
      };
    }
    return {
      label: 'Safe Zone',
      dotColor: colors.safe,
      bgColor: colors.safeBg,
      textColor: colors.safe,
    };
  }, [overall.held, overallLevel]);

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
        {/* Header: Personalized Greeting & Date */}
        <View style={styles.header}>
          <View style={styles.headerTextGroup}>
            <AppText variant="caption" tone="muted" style={styles.headerDate}>
              {formattedDate}
            </AppText>
            <AppText variant="title" style={styles.headerTitle}>
              {greeting}, {firstName}
            </AppText>
          </View>
          <PressableScale
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.profileAvatar}
            accessibilityRole="button"
            accessibilityLabel="View profile settings"
          >
            <AppText variant="label" style={styles.profileAvatarText}>
              {firstName.slice(0, 1).toUpperCase()}
            </AppText>
          </PressableScale>
        </View>

        {status === 'loading' ? (
          <View
            accessible
            accessibilityLabel="Loading overview"
            style={styles.loadingContainer}
          >
            {/* Hero Card Skeleton */}
            <Card style={styles.heroCard}>
              <View style={styles.heroSkeletonRow}>
                <Skeleton width={112} height={112} borderRadius={56} />
                <View style={styles.heroSkeletonCol}>
                  <Skeleton width="60%" height={20} />
                  <Skeleton width="85%" height={16} />
                  <Skeleton width="45%" height={14} />
                  <Skeleton width="100%" height={36} borderRadius={radius.control} />
                </View>
              </View>
              <Skeleton
                width="100%"
                height={8}
                borderRadius={4}
                style={styles.heroSkeletonBar}
              />
            </Card>

            {/* Today Strip Skeleton */}
            <Card style={styles.todayCard}>
              <View style={styles.todayCardContent}>
                <Skeleton width={38} height={38} borderRadius={19} />
                <View style={styles.todayInfo}>
                  <Skeleton width="50%" height={18} />
                  <Skeleton width="75%" height={14} />
                </View>
              </View>
            </Card>

            {/* Subjects Skeletons */}
            <View style={styles.sectionHeader}>
              <Skeleton width={120} height={20} />
            </View>
            {[1, 2, 3].map((key) => (
              <Card key={`skel-subject-${key}`} style={styles.subjectCard}>
                <View style={styles.subjectCardTop}>
                  <Skeleton width={44} height={44} borderRadius={22} />
                  <View style={styles.subjectInfo}>
                    <Skeleton width="60%" height={18} />
                    <Skeleton width="40%" height={14} />
                  </View>
                  <Skeleton width={68} height={24} borderRadius={radius.small} />
                </View>
                <Skeleton
                  width="100%"
                  height={6}
                  borderRadius={3}
                  style={styles.subjectBarSkeleton}
                />
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
            icon="grid-outline"
            title="No subjects tracked yet"
            message="Add your subjects and weekly timetable to track attendance, calculate bunk limits, and get proactive warnings."
            actionLabel="Add your first subject"
            onAction={() => router.navigate('/(tabs)/subjects')}
            style={styles.stateCard}
          />
        ) : (
          <View style={styles.dashboardBody}>
            {/* 1. HERO COMMAND CARD */}
            <Card style={styles.heroCard}>
              {/* Top metadata strip */}
              <View style={styles.heroTopRow}>
                <View
                  style={[
                    styles.heroStatusChip,
                    { backgroundColor: heroBadgeConfig.bgColor },
                  ]}
                >
                  <View
                    style={[
                      styles.heroStatusDot,
                      { backgroundColor: heroBadgeConfig.dotColor },
                    ]}
                  />
                  <AppText
                    variant="caption"
                    style={[
                      styles.heroStatusText,
                      { color: heroBadgeConfig.textColor },
                    ]}
                  >
                    {heroBadgeConfig.label}
                  </AppText>
                </View>

                <View style={styles.heroTargetPill}>
                  <Ionicons name="flag" size={12} color={colors.textMuted} />
                  <AppText variant="caption" tone="muted" style={styles.heroTargetText}>
                    Target {defaultTarget}%
                  </AppText>
                </View>
              </View>

              {/* Main Gauge & Executive Summary */}
              <View style={styles.heroBodyRow}>
                <View style={styles.heroRingWrapper}>
                  <ProgressRing
                    value={overallRatio}
                    target={defaultTarget}
                    size={112}
                    strokeWidth={11}
                    tone={overallTone}
                    label={overallDisplay}
                    accessibilityLabel={`Overall attendance, ${overallSpoken}, target ${defaultTarget} percent`}
                  />
                </View>

                <View style={styles.heroSummaryCol}>
                  {/* The Bunk Buffer / Deficit Engine Callout */}
                  <View
                    style={[
                      styles.bufferCallout,
                      {
                        backgroundColor:
                          overall.held === 0
                            ? colors.surfaceMuted
                            : overallLevel === 'below'
                              ? colors.dangerBg
                              : colors.safeBg,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        overall.held === 0
                          ? 'information-circle'
                          : overallLevel === 'below'
                            ? 'warning'
                            : 'shield-checkmark'
                      }
                      size={18}
                      color={
                        overall.held === 0
                          ? colors.textMuted
                          : overallLevel === 'below'
                            ? colors.danger
                            : colors.safe
                      }
                    />
                    <View style={styles.bufferTextGroup}>
                      <AppText
                        variant="label"
                        style={[
                          styles.bufferTitle,
                          {
                            color:
                              overall.held === 0
                                ? colors.text
                                : overallLevel === 'below'
                                  ? colors.danger
                                  : colors.safe,
                          },
                        ]}
                      >
                        {overall.held === 0
                          ? 'No data to calculate'
                          : overallLevel === 'below'
                            ? `Attend next ${overallMustAttend} classes`
                            : overallCanSkip > 0
                              ? `Can skip ${overallCanSkip} ${pluralizeClasses(overallCanSkip)}`
                              : 'Zero skip buffer'}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {overall.held === 0
                          ? 'Mark attendance to see buffer'
                          : overallLevel === 'below'
                            ? `Needed to reach ${defaultTarget}% target`
                            : overallCanSkip > 0
                              ? `Overall safely before dropping`
                              : 'Attendance is right on target'}
                      </AppText>
                    </View>
                  </View>

                  {/* Micro Metrics Row */}
                  <View style={styles.heroMetricsRow}>
                    <View style={styles.heroMetricItem}>
                      <AppText variant="caption" tone="muted">
                        Attended
                      </AppText>
                      <AppText variant="heading" style={styles.heroMetricValue}>
                        {overall.attended}
                        <AppText variant="body" tone="muted">
                          /{overall.held}
                        </AppText>
                      </AppText>
                    </View>

                    <View style={styles.heroMetricDivider} />

                    <View style={styles.heroMetricItem}>
                      <AppText variant="caption" tone="muted">
                        Subjects
                      </AppText>
                      <AppText variant="heading" style={styles.heroMetricValue}>
                        {subjects.length}{' '}
                        <AppText
                          variant="caption"
                          tone={atRiskCount > 0 ? 'danger' : 'safe'}
                        >
                          ({atRiskCount > 0 ? `${atRiskCount} at risk` : 'all safe'})
                        </AppText>
                      </AppText>
                    </View>
                  </View>
                </View>
              </View>

              {/* Linear Benchmark Bar */}
              {overall.held > 0 && (
                <View style={styles.benchmarkWrapper}>
                  <View style={styles.benchmarkTrack}>
                    <View
                      style={[
                        styles.benchmarkFill,
                        {
                          width: `${Math.min(100, Math.max(0, overallRatio ?? 0))}%`,
                          backgroundColor:
                            overallTone === 'safe'
                              ? colors.safe
                              : overallTone === 'warn'
                                ? colors.warn
                                : colors.danger,
                        },
                      ]}
                    />
                    {/* Target Benchmark Line */}
                    <View
                      style={[
                        styles.benchmarkTargetPin,
                        { left: `${defaultTarget}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.benchmarkLegend}>
                    <AppText variant="caption" tone="muted" style={styles.benchmarkLabel}>
                      0%
                    </AppText>
                    <View
                      style={[
                        styles.benchmarkTargetLabelContainer,
                        { left: `${defaultTarget}%` },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        style={styles.benchmarkTargetLabelText}
                      >
                        Target: {defaultTarget}%
                      </AppText>
                    </View>
                    <AppText variant="caption" tone="muted" style={styles.benchmarkLabel}>
                      100%
                    </AppText>
                  </View>
                </View>
              )}
            </Card>

            {/* 2. TODAY'S ACTION BANNER */}
            <Card
              onPress={() => router.navigate('/(tabs)/today')}
              accessibilityLabel={`Today's schedule: ${todaySlots.length} ${pluralizeClasses(todaySlots.length)}, ${unmarkedTodayCount} unrecorded.`}
              style={styles.todayCard}
            >
              <View style={styles.todayCardContent}>
                <View style={styles.todayIconBox}>
                  <Ionicons name="calendar-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.todayInfo}>
                  <View style={styles.todayHeaderRow}>
                    <AppText variant="heading" style={styles.todayTitle}>
                      {"Today's Classes"}
                    </AppText>
                    {unmarkedTodayCount > 0 ? (
                      <View style={styles.todayUnmarkedBadge}>
                        <AppText variant="caption" style={styles.todayUnmarkedText}>
                          {unmarkedTodayCount} to mark
                        </AppText>
                      </View>
                    ) : todaySlots.length > 0 ? (
                      <View style={styles.todayCompleteBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={13}
                          color={colors.safe}
                        />
                        <AppText variant="caption" style={styles.todayCompleteText}>
                          All marked
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {todaySlots.length === 0
                      ? 'No classes scheduled for today • Free day'
                      : upcomingClassTeaser
                        ? `${todaySlots.length} ${pluralizeClasses(todaySlots.length)} • ${upcomingClassTeaser}`
                        : `${todaySlots.length} ${pluralizeClasses(todaySlots.length)} today`}
                  </AppText>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                  style={styles.todayArrow}
                />
              </View>
            </Card>

            {/* 3. URGENT ATTENTION NOTIFICATION (CONDITIONAL) */}
            {belowTargetSubjects.length > 0 && (
              <View style={styles.urgentBanner}>
                <View style={styles.urgentHeader}>
                  <Ionicons name="warning" size={17} color={colors.danger} />
                  <AppText variant="label" tone="danger" style={styles.urgentTitle}>
                    {belowTargetSubjects.length}{' '}
                    {belowTargetSubjects.length === 1
                      ? 'Subject Needs Recovery'
                      : 'Subjects Need Recovery'}
                  </AppText>
                </View>
                <View style={styles.urgentList}>
                  {belowTargetSubjects.map((item) => (
                    <PressableScale
                      key={`urgent-${item.subject.id}`}
                      onPress={() =>
                        router.push(
                          `/subject/${encodeURIComponent(item.subject.id)}`
                        )
                      }
                      style={styles.urgentRow}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.subject.name}, attend next ${item.needed} classes to recover target.`}
                    >
                      <AppText
                        variant="body"
                        numberOfLines={1}
                        style={styles.urgentSubjectName}
                      >
                        {item.subject.name}
                      </AppText>
                      <View style={styles.urgentActionPill}>
                        <AppText variant="caption" style={styles.urgentActionText}>
                          Attend next {item.needed} →
                        </AppText>
                      </View>
                    </PressableScale>
                  ))}
                </View>
              </View>
            )}

            {/* 4. SUBJECTS BREAKDOWN SECTION */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <AppText variant="heading">Subject Breakdown</AppText>
                <AppText variant="caption" tone="muted">
                  {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'} enrolled
                </AppText>
              </View>

              {/* Smart Filter Pills */}
              <View style={styles.filterGroup}>
                <PressableScale
                  onPress={() => setFilter('all')}
                  style={[
                    styles.filterChip,
                    filter === 'all' && styles.filterChipActive,
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={[
                      styles.filterChipText,
                      filter === 'all' && styles.filterChipTextActive,
                    ]}
                  >
                    All ({subjectSummaries.length})
                  </AppText>
                </PressableScale>

                {atRiskCount > 0 && (
                  <PressableScale
                    onPress={() => setFilter('risk')}
                    style={[
                      styles.filterChip,
                      filter === 'risk' && styles.filterChipActiveRisk,
                    ]}
                  >
                    <AppText
                      variant="caption"
                      style={[
                        styles.filterChipText,
                        styles.filterChipTextRisk,
                        filter === 'risk' && styles.filterChipTextActive,
                      ]}
                    >
                      At Risk ({atRiskCount})
                    </AppText>
                  </PressableScale>
                )}

                <PressableScale
                  onPress={() => setFilter('safe')}
                  style={[
                    styles.filterChip,
                    filter === 'safe' && styles.filterChipActiveSafe,
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={[
                      styles.filterChipText,
                      styles.filterChipTextSafe,
                      filter === 'safe' && styles.filterChipTextActive,
                    ]}
                  >
                    Safe ({safeSubjects.length})
                  </AppText>
                </PressableScale>
              </View>
            </View>

            {/* Subject List Cards */}
            {filteredSubjects.length === 0 ? (
              <Card style={styles.emptyFilterCard}>
                <Ionicons
                  name="shield-checkmark"
                  size={28}
                  color={colors.safe}
                  style={styles.emptyFilterIcon}
                />
                <AppText variant="label" style={styles.emptyFilterTitle}>
                  No subjects at risk!
                </AppText>
                <AppText variant="caption" tone="muted" style={styles.emptyFilterMsg}>
                  All your subjects are currently meeting or exceeding their target.
                </AppText>
                <PressableScale
                  onPress={() => setFilter('all')}
                  style={styles.emptyFilterBtn}
                >
                  <AppText variant="caption" style={styles.emptyFilterBtnText}>
                    View All Subjects
                  </AppText>
                </PressableScale>
              </Card>
            ) : (
              <View style={styles.subjectList}>
                {filteredSubjects.map((item) => {
                  const isSafe = item.level === 'safe';
                  const isBelow = item.level === 'below';
                  const isWarn = item.level === 'borderline';

                  const badgeBg = isSafe
                    ? colors.safeBg
                    : isBelow
                      ? colors.dangerBg
                      : isWarn
                        ? colors.warnBg
                        : colors.surfaceMuted;

                  const badgeColor = isSafe
                    ? colors.safe
                    : isBelow
                      ? colors.danger
                      : isWarn
                        ? colors.warn
                        : colors.textMuted;

                  const barFillColor = isSafe
                    ? colors.safe
                    : isBelow
                      ? colors.danger
                      : isWarn
                        ? colors.warn
                        : colors.textMuted;

                  return (
                    <Card
                      key={item.subject.id}
                      onPress={() =>
                        router.push(
                          `/subject/${encodeURIComponent(item.subject.id)}`
                        )
                      }
                      style={styles.subjectCard}
                      accessibilityLabel={`${item.subject.name}, ${item.spokenPercent}, target ${item.target} percent, ${item.actionBadgeText}`}
                    >
                      <View style={styles.subjectCardTop}>
                        {/* Avatar initials chip */}
                        <View
                          style={[
                            styles.subjectAvatar,
                            { backgroundColor: badgeBg },
                          ]}
                        >
                          <AppText
                            variant="label"
                            style={[
                              styles.subjectAvatarText,
                              { color: badgeColor },
                            ]}
                          >
                            {item.initials}
                          </AppText>
                        </View>

                        {/* Subject info */}
                        <View style={styles.subjectInfo}>
                          <AppText
                            variant="heading"
                            numberOfLines={1}
                            style={styles.subjectName}
                          >
                            {item.subject.name}
                          </AppText>
                          <AppText variant="caption" tone="muted">
                            {item.held === 0
                              ? 'No classes recorded yet'
                              : `${item.attended} of ${item.held} attended`}
                          </AppText>
                        </View>

                        {/* Percentage & Action Pill */}
                        <View style={styles.subjectStatCol}>
                          <AppText
                            variant="heading"
                            style={[
                              styles.subjectPercentText,
                              { color: badgeColor },
                            ]}
                          >
                            {item.displayPercent}
                          </AppText>
                          <View
                            style={[
                              styles.subjectActionPill,
                              { backgroundColor: badgeBg },
                            ]}
                          >
                            <AppText
                              variant="caption"
                              style={[
                                styles.subjectActionText,
                                { color: badgeColor },
                              ]}
                            >
                              {item.actionBadgeText}
                            </AppText>
                          </View>
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={colors.textMuted}
                          style={styles.subjectArrow}
                        />
                      </View>

                      {/* Horizontal progress bar with target tick mark */}
                      {item.held > 0 && (
                        <View style={styles.subjectProgressArea}>
                          <View style={styles.subjectProgressBarTrack}>
                            <View
                              style={[
                                styles.subjectProgressBarFill,
                                {
                                  width: `${Math.min(100, Math.max(0, item.ratio ?? 0))}%`,
                                  backgroundColor: barFillColor,
                                },
                              ]}
                            />
                            {/* Target tick line */}
                            <View
                              style={[
                                styles.subjectTargetTick,
                                { left: `${item.target}%` },
                              ]}
                            />
                          </View>
                          <View style={styles.subjectProgressFooter}>
                            <AppText variant="caption" tone="muted" style={styles.subjectFooterText}>
                              Target: {item.target}%
                            </AppText>
                            <AppText
                              variant="caption"
                              tone={isBelow ? 'danger' : 'muted'}
                              style={styles.subjectFooterText}
                            >
                              {isBelow
                                ? `Short by ${item.needed} classes`
                                : item.canSkipCount > 0
                                  ? `Buffer: ${item.canSkipCount} skips`
                                  : 'Target met'}
                            </AppText>
                          </View>
                        </View>
                      )}
                    </Card>
                  );
                })}
              </View>
            )}

            {/* 5. QUICK ACTIONS & TOOLS ROW */}
            <View style={styles.quickToolsContainer}>
              <Card
                onPress={() => router.push('/simulator')}
                style={styles.toolCard}
                accessibilityLabel="What-if simulator. Simulate attendance before skipping upcoming classes."
              >
                <View style={styles.toolContent}>
                  <View
                    style={[
                      styles.toolIconBox,
                      { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Ionicons
                      name="calculator-outline"
                      size={20}
                      color={colors.accent}
                    />
                  </View>
                  <View style={styles.toolTextCol}>
                    <AppText variant="label" style={styles.toolTitle}>
                      What-If Simulator
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      Test bunk scenarios before you skip
                    </AppText>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
              </Card>

              <Card
                onPress={() => router.navigate('/(tabs)/subjects')}
                style={styles.toolCard}
                accessibilityLabel="Timetable & subjects manager. Configure your weekly classes."
              >
                <View style={styles.toolContent}>
                  <View
                    style={[
                      styles.toolIconBox,
                      { backgroundColor: colors.surfaceMuted },
                    ]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={colors.text}
                    />
                  </View>
                  <View style={styles.toolTextCol}>
                    <AppText variant="label" style={styles.toolTitle}>
                      Timetable & Subjects
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      Add, edit or reorganize your schedule
                    </AppText>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
              </Card>
            </View>
          </View>
        )}
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTextGroup: {
    gap: 2,
    flex: 1,
  },
  headerDate: {
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  headerTitle: {
    letterSpacing: -0.4,
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileAvatarText: {
    fontWeight: '700',
    color: colors.accent,
    fontSize: 15,
  },
  stateCard: {
    marginTop: spacing.lg,
  },
  loadingContainer: {
    gap: spacing.md,
  },
  dashboardBody: {
    gap: spacing.lg,
  },

  /* Hero Command Card */
  heroCard: {
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.surface,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  heroStatusText: {
    fontWeight: '600',
    fontSize: 12,
  },
  heroTargetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroTargetText: {
    fontWeight: '500',
    fontSize: 12,
  },
  heroBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroRingWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSummaryCol: {
    flex: 1,
    gap: spacing.md,
  },
  bufferCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.control,
  },
  bufferTextGroup: {
    flex: 1,
    gap: 1,
  },
  bufferTitle: {
    fontWeight: '600',
    fontSize: 14,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
  },
  heroMetricItem: {
    flex: 1,
    gap: 1,
  },
  heroMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  benchmarkWrapper: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  benchmarkTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    position: 'relative',
  },
  benchmarkFill: {
    height: '100%',
    borderRadius: 4,
  },
  benchmarkTargetPin: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.text,
    marginLeft: -1,
  },
  benchmarkLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    height: 18,
  },
  benchmarkLabel: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  benchmarkTargetLabelContainer: {
    position: 'absolute',
    transform: [{ translateX: -30 }],
  },
  benchmarkTargetLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },

  /* Hero Skeleton */
  heroSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroSkeletonCol: {
    flex: 1,
    gap: spacing.sm,
  },
  heroSkeletonBar: {
    marginTop: spacing.md,
  },

  /* Today's Action Banner */
  todayCard: {
    padding: spacing.md,
  },
  todayCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  todayIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayInfo: {
    flex: 1,
    gap: 3,
  },
  todayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  todayTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  todayUnmarkedBadge: {
    backgroundColor: colors.warnBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  todayUnmarkedText: {
    color: colors.warn,
    fontWeight: '600',
    fontSize: 11,
  },
  todayCompleteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.safeBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  todayCompleteText: {
    color: colors.safe,
    fontWeight: '600',
    fontSize: 11,
  },
  todayArrow: {
    marginLeft: spacing.xs,
  },

  /* Urgent Banner */
  urgentBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#F8B4B4',
    padding: spacing.md,
    gap: spacing.sm,
  },
  urgentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  urgentTitle: {
    fontWeight: '600',
  },
  urgentList: {
    gap: spacing.xs,
  },
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: '#FAD2D2',
  },
  urgentSubjectName: {
    fontWeight: '500',
    flex: 1,
    marginRight: spacing.sm,
  },
  urgentActionPill: {
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  urgentActionText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 12,
  },

  /* Subject Breakdown Section */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitleGroup: {
    gap: 2,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  filterChipActive: {
    backgroundColor: colors.text,
  },
  filterChipActiveRisk: {
    backgroundColor: colors.danger,
  },
  filterChipActiveSafe: {
    backgroundColor: colors.safe,
  },
  filterChipText: {
    fontWeight: '500',
    color: colors.textMuted,
    fontSize: 12,
  },
  filterChipTextActive: {
    color: colors.surface,
    fontWeight: '600',
  },
  filterChipTextRisk: {
    color: colors.danger,
  },
  filterChipTextSafe: {
    color: colors.safe,
  },
  subjectList: {
    gap: spacing.md,
  },
  subjectCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  subjectCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subjectAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectAvatarText: {
    fontWeight: '700',
    fontSize: 15,
  },
  subjectInfo: {
    flex: 1,
    gap: 2,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
  },
  subjectStatCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  subjectPercentText: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  subjectActionPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  subjectActionText: {
    fontWeight: '600',
    fontSize: 11,
  },
  subjectArrow: {
    marginLeft: 2,
  },
  subjectProgressArea: {
    gap: 4,
    paddingTop: 4,
  },
  subjectProgressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    position: 'relative',
  },
  subjectProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  subjectTargetTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.text,
    marginLeft: -1,
  },
  subjectProgressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectFooterText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  subjectBarSkeleton: {
    marginTop: spacing.sm,
  },

  /* Empty Filter State */
  emptyFilterCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyFilterIcon: {
    marginBottom: spacing.xs,
  },
  emptyFilterTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  emptyFilterMsg: {
    textAlign: 'center',
  },
  emptyFilterBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  emptyFilterBtnText: {
    fontWeight: '600',
    color: colors.text,
  },

  /* Quick Tools */
  quickToolsContainer: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  toolCard: {
    padding: spacing.md,
  },
  toolContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toolIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTextCol: {
    flex: 1,
    gap: 2,
  },
  toolTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
});
