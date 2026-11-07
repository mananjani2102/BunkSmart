import { Ionicons } from '@expo/vector-icons';
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useData } from '@/context/DataProvider';
import {
  clampTarget,
  formatDisplayPercent,
  formatPercentSpoken,
  getAttendanceLevel,
  getAttendanceRatio,
  getInsightText,
  levelToTone,
} from '@/lib/attendance';
import { colors, radius, spacing } from '@/theme/tokens';

const DETAIL_EDGES = ['bottom', 'left', 'right'] as const;

export default function SubjectDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const subjectId =
    typeof params.id === 'string' && params.id.length > 0
      ? params.id
      : undefined;

  const { status, error, subjects, slots, statsBySubject, reload, reloadStats } =
    useData();
  const subject = subjectId
    ? subjects.find((item) => item.id === subjectId)
    : undefined;
  const hasSubject = Boolean(
    subjectId && subjects.some((item) => item.id === subjectId)
  );

  useFocusEffect(
    useCallback(() => {
      if (!subjectId || !hasSubject) {
        return;
      }
      void reloadStats();
    }, [subjectId, hasSubject, reloadStats])
  );

  const openEditSubject = () => {
    if (!subject) {
      return;
    }
    router.push(`/subject-form?id=${encodeURIComponent(subject.id)}`);
  };

  if (status === 'loading') {
    return (
      <Screen scroll edges={DETAIL_EDGES} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Subject', headerRight: undefined }} />
        <View accessible accessibilityLabel="Loading subject details" style={styles.skeletonStack}>
          <Card style={styles.summaryCard}>
            <View style={styles.ringSection}>
              <Skeleton width={140} height={140} />
              <Skeleton width={88} height={24} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen edges={DETAIL_EDGES}>
        <Stack.Screen options={{ title: 'Subject', headerRight: undefined }} />
        <ErrorState
          message={error ?? 'Something went wrong. Try again.'}
          onRetry={() => {
            void reload();
          }}
          style={styles.stateCard}
        />
      </Screen>
    );
  }

  if (!subject) {
    return (
      <Screen edges={DETAIL_EDGES}>
        <Stack.Screen options={{ title: 'Subject', headerRight: undefined }} />
        <EmptyState
          icon="book-outline"
          title="This subject no longer exists."
          message="Return to your subjects list to pick another one."
          actionLabel="Back to subjects"
          onAction={() => router.replace('/(tabs)/subjects')}
          style={styles.stateCard}
        />
      </Screen>
    );
  }

  const stats = statsBySubject[subject.id];
  const attended = stats?.attended ?? subject.initial_present;
  const held = stats?.conducted ?? subject.initial_total;
  const cancelled = stats?.cancelled ?? 0;
  const target = clampTarget(subject.target_percent);

  const displayPercent = formatDisplayPercent(attended, held);
  const ratio = getAttendanceRatio(attended, held);
  const level = getAttendanceLevel(attended, held, target);
  const tone = levelToTone(level);
  const insight = getInsightText(attended, held, target);
  const spokenPercent = formatPercentSpoken(attended, held);

  return (
    <Screen scroll edges={DETAIL_EDGES} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: subject.name,
          headerRight: () => (
            <PressableScale
              onPress={openEditSubject}
              scaleTo={0.92}
              rippleColor={colors.rippleNeutral}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${subject.name}`}
              containerStyle={styles.headerButtonContainer}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.headerButtonPressed,
              ]}
            >
              <Ionicons name="pencil" size={20} color={colors.text} />
            </PressableScale>
          ),
        }}
      />

      <Card style={styles.summaryCard}>
        <View style={styles.ringSection}>
          <ProgressRing
            value={ratio}
            target={target}
            size={140}
            strokeWidth={12}
            tone={tone}
            label={displayPercent}
            accessibilityLabel={`${subject.name}, ${spokenPercent}, target ${target} percent`}
          />
          <LevelBadge level={level} style={styles.badge} />
        </View>

        <View style={styles.metaRow}>
          <AppText variant="body" style={styles.metaValue}>
            {attended} of {held} classes counted
          </AppText>
          <View style={styles.metaSubRow}>
            <AppText variant="caption" tone="muted">
              {cancelled} cancelled
            </AppText>
            <AppText variant="caption" tone="muted">
              Target {target}%
            </AppText>
          </View>
        </View>

        <View style={styles.insightBox}>
          <AppText variant="body">{insight}</AppText>
        </View>
      </Card>

      <WhatIfSimulator
        key={subject.id}
        subject={subject}
        counts={{ attended, held }}
        slots={slots}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  skeletonStack: {
    gap: spacing.lg,
  },
  skeletonCard: {
    gap: spacing.md,
  },
  stateCard: {
    marginTop: spacing.lg,
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
    backgroundColor: colors.surfacePressed,
  },
  summaryCard: {
    gap: spacing.lg,
  },
  ringSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    alignSelf: 'center',
  },
  metaRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaValue: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  metaSubRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  insightBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  countsCard: {
    gap: spacing.md,
  },
  countsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countTile: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.control,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  countLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  countDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  countValue: {
    fontVariant: ['tabular-nums'],
  },
});
