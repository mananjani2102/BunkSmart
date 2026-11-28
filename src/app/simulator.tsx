import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { SimulatorSkeleton } from '@/components/SkeletonLayouts';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import { AppText } from '@/components/ui/AppText';
import { ContentFade } from '@/components/ui/ContentFade';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FadeView } from '@/components/ui/FadeView';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import {
  useDataActions,
  useDataState,
  useDataStats,
} from '@/context/DataProvider';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';

const SIMULATOR_EDGES = ['bottom', 'left', 'right'] as const;

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
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
    backgroundColor: colors.card,
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
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipPressed: {
    backgroundColor: colors.muted,
  },
  chipTextDefault: {
    color: colors.foreground,
    fontFamily: fontFamily.medium,
  },
  chipTextSelected: {
    color: colors.primaryForeground,
    fontFamily: fontFamily.semibold,
  },
}));

interface SubjectChipProps {
  id: string;
  name: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const SubjectChip = memo(function SubjectChip({
  id,
  name,
  isSelected,
  onSelect,
}: SubjectChipProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  return (
    <PressableScale
      onPress={() => onSelect(id)}
      scaleTo={0.96}
      rippleColor={isSelected ? colors.ripplePrimary : colors.rippleNeutral}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected: isSelected }}
      containerStyle={[
        styles.chipContainer,
        isSelected && styles.chipSelected,
      ]}
      style={({ pressed }) => [
        styles.chip,
        pressed && !isSelected && styles.chipPressed,
      ]}
    >
      <AppText
        variant="label"
        numberOfLines={1}
        style={isSelected ? styles.chipTextSelected : styles.chipTextDefault}
      >
        {name}
      </AppText>
    </PressableScale>
  );
});

export default function SimulatorScreen() {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const params = useLocalSearchParams<{ subjectId?: string }>();
  const paramSubjectId =
    typeof params.subjectId === 'string' && params.subjectId.length > 0
      ? params.subjectId
      : undefined;

  const { status, error, subjects, slots } = useDataState();
  const { statsBySubject } = useDataStats();
  const { reload } = useDataActions();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    paramSubjectId
  );

  const selectedSubject = useMemo(
    () =>
      subjects.find((item) => item.id === selectedId) ??
      (paramSubjectId
        ? subjects.find((item) => item.id === paramSubjectId)
        : undefined) ??
      subjects[0],
    [paramSubjectId, selectedId, subjects]
  );

  const handleSelectSubject = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleRetry = useCallback(() => {
    void reload(true);
  }, [reload]);

  const selectedStats = selectedSubject
    ? statsBySubject[selectedSubject.id]
    : undefined;
  const counts = useMemo(
    () => ({
      attended:
        selectedStats?.attended ?? selectedSubject?.initial_present ?? 0,
      held: selectedStats?.conducted ?? selectedSubject?.initial_total ?? 0,
    }),
    [
      selectedStats?.attended,
      selectedStats?.conducted,
      selectedSubject?.initial_present,
      selectedSubject?.initial_total,
    ]
  );

  return (
    <Screen scroll edges={SIMULATOR_EDGES} contentContainerStyle={styles.content}>
      <ContentFade loading={status === 'loading'} fallback={<SimulatorSkeleton />}>
        {status === 'error' ? (
          <ErrorState
            message={error ?? 'Something went wrong. Try again.'}
            onRetry={handleRetry}
            style={styles.stateCard}
          />
        ) : !selectedSubject ? (
          <EmptyState
            icon="calculator-outline"
            title="No subjects yet"
            message="Add a subject before simulating upcoming classes."
            actionLabel="Add a subject"
            onAction={() => router.replace('/(tabs)/subjects')}
            style={styles.stateCard}
          />
        ) : (
          <View style={styles.content}>
            <View style={styles.pickerSection}>
              <AppText variant="label" tone="muted">
                Subject
              </AppText>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {subjects.map((subject) => (
                  <SubjectChip
                    key={subject.id}
                    id={subject.id}
                    name={subject.name}
                    isSelected={subject.id === selectedSubject.id}
                    onSelect={handleSelectSubject}
                  />
                ))}
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
          </View>
        )}
      </ContentFade>
    </Screen>
  );
}
