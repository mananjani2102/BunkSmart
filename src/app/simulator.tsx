import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FadeView } from '@/components/ui/FadeView';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useData } from '@/context/DataProvider';
import { colors, radius, spacing } from '@/theme/tokens';

const SIMULATOR_EDGES = ['bottom', 'left', 'right'] as const;

export default function SimulatorScreen() {
  const params = useLocalSearchParams<{ subjectId?: string }>();
  const paramSubjectId =
    typeof params.subjectId === 'string' && params.subjectId.length > 0
      ? params.subjectId
      : undefined;

  const { status, error, subjects, slots, statsBySubject, reload } = useData();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    paramSubjectId
  );

  const selectedSubject =
    subjects.find((item) => item.id === selectedId) ??
    (paramSubjectId
      ? subjects.find((item) => item.id === paramSubjectId)
      : undefined) ??
    subjects[0];

  if (status === 'loading') {
    return (
      <Screen edges={SIMULATOR_EDGES} contentContainerStyle={styles.content}>
        <View
          accessible
          accessibilityLabel="Loading simulator"
          style={styles.skeletonGroup}
        >
          <Skeleton width={80} height={16} />
          <View style={styles.chipRow}>
            <Skeleton width={104} height={44} />
            <Skeleton width={120} height={44} />
          </View>
          <Card style={styles.skeletonCard}>
            <Skeleton width="55%" height={20} />
            <Skeleton width="100%" height={44} />
            <Skeleton width="100%" height={44} />
            <Skeleton width="100%" height={48} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen edges={SIMULATOR_EDGES}>
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

  if (!selectedSubject) {
    return (
      <Screen edges={SIMULATOR_EDGES}>
        <EmptyState
          icon="calculator-outline"
          title="No subjects yet"
          message="Add a subject before simulating upcoming classes."
          actionLabel="Add a subject"
          onAction={() => router.replace('/(tabs)/subjects')}
          style={styles.stateCard}
        />
      </Screen>
    );
  }

  const stats = statsBySubject[selectedSubject.id];
  const counts = {
    attended: stats?.attended ?? selectedSubject.initial_present,
    held: stats?.conducted ?? selectedSubject.initial_total,
  };

  return (
    <Screen scroll edges={SIMULATOR_EDGES} contentContainerStyle={styles.content}>
      <View style={styles.pickerSection}>
        <AppText variant="label" tone="muted">
          Subject
        </AppText>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {subjects.map((subject) => {
            const isSelected = subject.id === selectedSubject.id;
            return (
              <PressableScale
                key={subject.id}
                onPress={() => setSelectedId(subject.id)}
                scaleTo={0.96}
                rippleColor={
                  isSelected ? colors.rippleOnAccent : colors.rippleNeutral
                }
                accessibilityRole="button"
                accessibilityLabel={subject.name}
                accessibilityState={{ selected: isSelected }}
                containerStyle={[
                  styles.chipContainer,
                  isSelected && styles.chipSelected,
                ]}
                style={({ pressed }) => [
                  styles.chip,
                  pressed &&
                    (isSelected
                      ? styles.chipSelectedPressed
                      : styles.chipPressed),
                ]}
              >
                <AppText
                  variant="label"
                  tone={isSelected ? 'onAccent' : 'default'}
                  numberOfLines={1}
                  style={isSelected && styles.chipTextSelected}
                >
                  {subject.name}
                </AppText>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      <FadeView transitionKey={selectedSubject.id}>
        <WhatIfSimulator
          key={selectedSubject.id}
          subject={selectedSubject}
          counts={counts}
          slots={slots}
        />
      </FadeView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  skeletonGroup: {
    gap: spacing.md,
  },
  skeletonCard: {
    gap: spacing.md,
  },
  stateCard: {
    marginTop: spacing.lg,
  },
  pickerSection: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chipContainer: {
    minHeight: 44,
    maxWidth: 220,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  chip: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipPressed: {
    backgroundColor: colors.surfacePressed,
  },
  chipSelectedPressed: {
    backgroundColor: colors.accentPressed,
  },
  chipTextSelected: {
    fontWeight: '600',
  },
});
