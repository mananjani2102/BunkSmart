import { Ionicons } from '@expo/vector-icons';
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  View,
  type ListRenderItem,
} from 'react-native';

import {
  buildHistoryItems,
  EMPTY_HISTORY_ITEMS,
  HistoryCardFooter,
  HistoryCardTop,
  HistorySectionRow,
  type HistoryRowItem,
} from '@/components/HistoryList';
import {
  SubjectDetailSkeleton,
  SubjectLogsSkeleton,
} from '@/components/SkeletonLayouts';
import { buildTrendChartProps, TrendChart } from '@/components/TrendChart';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ContentFade } from '@/components/ui/ContentFade';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  getLevelFillColor,
  getLevelLabel,
  getLevelTextTone,
} from '@/components/ui/LevelBadge';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import {
  useDataActions,
  useDataState,
  useDataStats,
} from '@/context/DataProvider';
import {
  clampTarget,
  formatDisplayPercent,
  getAttendanceLevel,
  getInsightText,
} from '@/lib/attendance';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';
import { type AttendanceLog } from '@/types/db';

const DETAIL_EDGES = ['bottom', 'left', 'right'] as const;

type LogsStatus = 'loading' | 'ready' | 'error';

const keyExtractor = (item: HistoryRowItem) => item.key;

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  flexOne: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerStack: {
    gap: spacing.lg,
  },
  stateCard: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  headerButtonContainer: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  headerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPressed: {
    backgroundColor: colors.muted,
  },
  summaryCard: {
    gap: spacing.md,
  },
  topBlock: {
    gap: spacing.xs,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.dot,
    marginTop: 7,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  targetSection: {
    gap: spacing.xs,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  changeLinkBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    marginRight: -spacing.md,
    borderRadius: radius.small,
    overflow: 'hidden',
  },
  changeLinkPressed: {
    opacity: 0.7,
  },
  changeLinkText: {
    fontFamily: fontFamily.medium,
  },
}));

export default function SubjectDetailScreen() {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const params = useLocalSearchParams<{ id?: string }>();
  const subjectId =
    typeof params.id === 'string' && params.id.length > 0
      ? params.id
      : undefined;

  const { status, error, subjects, slots } = useDataState();
  const { statsBySubject } = useDataStats();
  const { reload, reloadStats, loadSubjectLogs, getCachedSubjectLogs } =
    useDataActions();

  const subject = useMemo(
    () =>
      subjectId ? subjects.find((item) => item.id === subjectId) : undefined,
    [subjectId, subjects]
  );
  const hasSubject = Boolean(subject);

  const initialCachedLogs = subjectId ? getCachedSubjectLogs(subjectId) : null;
  const [prevSubjectId, setPrevSubjectId] = useState<string | undefined>(
    subjectId
  );
  const [logs, setLogs] = useState<AttendanceLog[]>(
    () => initialCachedLogs ?? []
  );
  const [logsStatus, setLogsStatus] = useState<LogsStatus>(() =>
    initialCachedLogs !== null ? 'ready' : 'loading'
  );
  const [logsError, setLogsError] = useState<string | null>(null);

  if (prevSubjectId !== subjectId) {
    const cachedForNext = subjectId ? getCachedSubjectLogs(subjectId) : null;
    setPrevSubjectId(subjectId);
    setLogs(cachedForNext ?? []);
    setLogsStatus(cachedForNext !== null ? 'ready' : 'loading');
    setLogsError(null);
  }

  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const hasLoadedLogsRef = useRef(initialCachedLogs !== null);

  useEffect(() => {
    hasLoadedLogsRef.current = logsStatus === 'ready';
  }, [logsStatus]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchSubjectHistory = useCallback(
    async (targetSubjectId: string, force = false) => {
      if (!force) {
        const cached = getCachedSubjectLogs(targetSubjectId);
        if (cached !== null) {
          setLogs(cached);
          setLogsStatus('ready');
          setLogsError(null);
          return;
        }
      }

      const requestId = ++fetchIdRef.current;
      if (!hasLoadedLogsRef.current || force) {
        setLogsStatus('loading');
      }
      setLogsError(null);

      try {
        const rows = await loadSubjectLogs(targetSubjectId, force);
        if (!mountedRef.current || fetchIdRef.current !== requestId) {
          return;
        }
        setLogs(rows);
        setLogsStatus('ready');
      } catch (err) {
        if (!mountedRef.current || fetchIdRef.current !== requestId) {
          return;
        }
        setLogsError(getFriendlyErrorMessage(err));
        setLogsStatus('error');
      }
    },
    [getCachedSubjectLogs, loadSubjectLogs]
  );

  useFocusEffect(
    useCallback(() => {
      if (!subjectId || !hasSubject) {
        return;
      }
      void reloadStats(false);
      void fetchSubjectHistory(subjectId, false);
    }, [subjectId, hasSubject, reloadStats, fetchSubjectHistory])
  );

  const openEditSubject = useCallback(() => {
    if (!subjectId) {
      return;
    }
    router.push(`/subject-form?id=${encodeURIComponent(subjectId)}`);
  }, [subjectId]);

  const handleRetryReload = useCallback(() => {
    void reload(true);
  }, [reload]);

  const handleBackToSubjects = useCallback(() => {
    router.replace('/(tabs)/subjects');
  }, []);

  const handleRetrySubjectLogs = useCallback(() => {
    if (subjectId) {
      void fetchSubjectHistory(subjectId, true);
    }
  }, [fetchSubjectHistory, subjectId]);

  const handleOpenDateInToday = useCallback((dateStr: string) => {
    router.navigate({
      pathname: '/(tabs)/today',
      params: { date: dateStr },
    });
  }, []);

  const renderHeaderRight = useCallback(
    () => (
      <PressableScale
        onPress={openEditSubject}
        scaleTo={0.92}
        rippleColor={colors.rippleNeutral}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${subject?.name ?? 'subject'}`}
        containerStyle={styles.headerButtonContainer}
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.headerButtonPressed,
        ]}
      >
        <Ionicons name="pencil" size={20} color={colors.foreground} />
      </PressableScale>
    ),
    [
      colors.foreground,
      colors.rippleNeutral,
      openEditSubject,
      styles.headerButton,
      styles.headerButtonContainer,
      styles.headerButtonPressed,
      subject?.name,
    ]
  );

  const stats = subject ? statsBySubject[subject.id] : undefined;
  const attended = stats?.attended ?? subject?.initial_present ?? 0;
  const held = stats?.conducted ?? subject?.initial_total ?? 0;
  const cancelled = stats?.cancelled ?? 0;

  const simulatorCounts = useMemo(
    () => ({ attended, held }),
    [attended, held]
  );

  const trendChartProps = useMemo(() => {
    if (!subject) {
      return null;
    }
    return buildTrendChartProps(
      subject.initial_present,
      subject.initial_total,
      subject.target_percent,
      logs
    );
  }, [subject, logs]);

  const historyItems = useMemo(() => {
    if (logsStatus !== 'ready') {
      return EMPTY_HISTORY_ITEMS;
    }
    return buildHistoryItems(logs, slots);
  }, [logs, logsStatus, slots]);

  const renderHistoryItem = useCallback<ListRenderItem<HistoryRowItem>>(
    ({ item }) => (
      <HistorySectionRow item={item} onPressDate={handleOpenDateInToday} />
    ),
    [handleOpenDateInToday]
  );

  const target = subject ? clampTarget(subject.target_percent) : 75;
  const displayPercent = formatDisplayPercent(attended, held);
  const level = getAttendanceLevel(attended, held, target);
  const levelLabel = getLevelLabel(level);
  const insight = getInsightText(attended, held, target);
  const dotColor = getLevelFillColor(level, colors);
  const insightTone = getLevelTextTone(level);
  const hasStartingCounts = subject
    ? subject.initial_total > 0 || subject.initial_present > 0
    : false;

  const listHeader = subject ? (
    <View style={styles.headerStack}>
      <Card style={styles.summaryCard}>
        <View style={styles.topBlock}>
          <AppText
            variant="display"
            tone="default"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.tabular}
          >
            {displayPercent}
          </AppText>
          <AppText variant="body" tone="muted" style={styles.tabular}>
            {attended} of {held} classes
          </AppText>
          <View
            accessible
            accessibilityLabel={`${levelLabel}. ${insight}`}
            style={styles.insightRow}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={[styles.statusDot, { backgroundColor: dotColor }]}
            />
            <AppText variant="body" tone={insightTone} style={styles.flexOne}>
              {insight}
            </AppText>
          </View>
        </View>

        <Divider />

        <View style={styles.statsRow}>
          <View
            accessible
            accessibilityLabel={`${attended} attended`}
            style={styles.statCol}
          >
            <AppText variant="heading" style={styles.tabular}>
              {attended}
            </AppText>
            <AppText variant="caption" tone="muted">
              Attended
            </AppText>
          </View>
          <View style={styles.verticalDivider} />
          <View
            accessible
            accessibilityLabel={`${held} held`}
            style={styles.statCol}
          >
            <AppText variant="heading" style={styles.tabular}>
              {held}
            </AppText>
            <AppText variant="caption" tone="muted">
              Held
            </AppText>
          </View>
          <View style={styles.verticalDivider} />
          <View
            accessible
            accessibilityLabel={`${cancelled} cancelled`}
            style={styles.statCol}
          >
            <AppText variant="heading" style={styles.tabular}>
              {cancelled}
            </AppText>
            <AppText variant="caption" tone="muted">
              Cancelled
            </AppText>
          </View>
        </View>

        <Divider />

        <View style={styles.targetSection}>
          <View style={styles.targetRow}>
            <AppText variant="body" style={styles.tabular}>
              Target {target}%
            </AppText>
            <Pressable
              onPress={openEditSubject}
              android_ripple={{ color: colors.rippleNeutral, foreground: true }}
              accessibilityRole="button"
              accessibilityLabel={`Change target for ${subject.name}`}
              style={({ pressed }) => [
                styles.changeLinkBtn,
                pressed && styles.changeLinkPressed,
              ]}
            >
              <AppText variant="label" tone="info" style={styles.changeLinkText}>
                Change
              </AppText>
            </Pressable>
          </View>
          <AppText variant="caption" tone="muted">
            {hasStartingCounts
              ? 'Includes the starting counts you entered.'
              : 'Counts only the classes you marked in BunkSmart.'}
          </AppText>
        </View>
      </Card>

      <WhatIfSimulator
        key={subject.id}
        subject={subject}
        counts={simulatorCounts}
        slots={slots}
      />

      <ContentFade
        loading={logsStatus === 'loading'}
        fallback={<SubjectLogsSkeleton />}
      >
        {logsStatus === 'error' ? (
          <ErrorState
            message={logsError ?? 'Something went wrong. Try again.'}
            onRetry={handleRetrySubjectLogs}
          />
        ) : (
          <View style={styles.headerStack}>
            {trendChartProps ? <TrendChart {...trendChartProps} /> : null}
            <HistoryCardTop isEmpty={historyItems.length === 0} />
          </View>
        )}
      </ContentFade>
    </View>
  ) : null;

  const listFooter =
    subject && logsStatus === 'ready' ? (
      <HistoryCardFooter hasItems={historyItems.length > 0} />
    ) : undefined;

  return (
    <Screen edges={DETAIL_EDGES} padded={false}>
      <Stack.Screen
        options={{
          title: subject?.name ?? 'Subject',
          headerRight: subject ? renderHeaderRight : undefined,
        }}
      />

      <ContentFade
        loading={status === 'loading'}
        fallback={
          <ScrollView contentContainerStyle={styles.listContent}>
            <SubjectDetailSkeleton />
          </ScrollView>
        }
        style={styles.flexOne}
      >
        {status === 'error' ? (
          <ErrorState
            message={error ?? 'Something went wrong. Try again.'}
            onRetry={handleRetryReload}
            style={styles.stateCard}
          />
        ) : !subject ? (
          <EmptyState
            icon="book-outline"
            title="Subject not found"
            message="Return to your subjects list to pick another one."
            actionLabel="Back to subjects"
            onAction={handleBackToSubjects}
            style={styles.stateCard}
          />
        ) : (
          <FlatList
            data={historyItems}
            keyExtractor={keyExtractor}
            renderItem={renderHistoryItem}
            ListHeaderComponent={listHeader ?? undefined}
            ListFooterComponent={listFooter}
            contentContainerStyle={styles.listContent}
            initialNumToRender={16}
            maxToRenderPerBatch={16}
            windowSize={7}
            removeClippedSubviews
          />
        )}
      </ContentFade>
    </Screen>
  );
}
