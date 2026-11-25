import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { PastAttendanceEstimate } from '@/components/PastAttendanceEstimate';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useData } from '@/context/DataProvider';
import { updateSubject as updateSubjectRecord } from '@/data/subjects';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/tokens';
import { type Subject } from '@/types/db';

const MODAL_EDGES = ['bottom', 'left', 'right'] as const;

type PastMethod = 'known' | 'estimate';

const METHOD_OPTIONS: readonly SegmentedOption<PastMethod>[] = [
  { label: 'I know the numbers', value: 'known' },
  { label: 'Estimate from timetable', value: 'estimate' },
];

interface KnownCountsEntry {
  attendedText: string;
  heldText: string;
}

function parseWholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function buildInitialKnownMap(
  subjects: readonly Subject[]
): Record<string, KnownCountsEntry> {
  const map: Record<string, KnownCountsEntry> = {};
  for (const subject of subjects) {
    map[subject.id] = {
      attendedText: String(subject.initial_present),
      heldText: String(subject.initial_total),
    };
  }
  return map;
}

function KnownNumbersMethod({
  subjects,
  busy,
  onBusyChange,
}: {
  subjects: readonly Subject[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const { reload } = useData();
  const [entriesBySubject, setEntriesBySubject] = useState<
    Record<string, KnownCountsEntry>
  >(() => buildInitialKnownMap(subjects));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const updateEntry = (
    subjectId: string,
    patch: Partial<KnownCountsEntry>
  ) => {
    if (formError) {
      setFormError(null);
    }
    setEntriesBySubject((prev) => {
      const current = prev[subjectId] ?? { attendedText: '0', heldText: '0' };
      return {
        ...prev,
        [subjectId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const handleSave = async () => {
    if (savingRef.current || busy) {
      return;
    }

    const updates: { id: string; attended: number; held: number }[] = [];
    for (const subject of subjects) {
      const entry = entriesBySubject[subject.id] ?? {
        attendedText: String(subject.initial_present),
        heldText: String(subject.initial_total),
      };
      const attended = parseWholeNumber(entry.attendedText);
      const held = parseWholeNumber(entry.heldText);

      if (attended === null || held === null) {
        setFormError(`Enter whole numbers for ${subject.name}.`);
        return;
      }
      if (attended > held) {
        setFormError(
          `Classes attended cannot be more than classes held for ${subject.name}.`
        );
        return;
      }

      if (
        attended !== subject.initial_present ||
        held !== subject.initial_total
      ) {
        updates.push({ id: subject.id, attended, held });
      }
    }

    if (updates.length === 0) {
      router.back();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    onBusyChange(true);
    setFormError(null);

    try {
      await Promise.all(
        updates.map((item) =>
          updateSubjectRecord(item.id, {
            initial_present: item.attended,
            initial_total: item.held,
          })
        )
      );
      await reload(true);
      router.back();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Save known past attendance failed:', err);
      }
      setFormError(getFriendlyErrorMessage(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  };

  return (
    <View style={styles.methodContainer}>
      {formError ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={colors.danger}
            style={styles.errorIcon}
          />
          <AppText variant="caption" tone="danger" style={styles.errorText}>
            {formError}
          </AppText>
        </View>
      ) : null}

      <View style={styles.subjectList}>
        {subjects.map((subject) => {
          const entry = entriesBySubject[subject.id] ?? {
            attendedText: String(subject.initial_present),
            heldText: String(subject.initial_total),
          };
          const attended = parseWholeNumber(entry.attendedText);
          const held = parseWholeNumber(entry.heldText);
          const rowError =
            attended !== null && held !== null && attended > held
              ? 'Attended cannot exceed held.'
              : undefined;

          return (
            <Card key={subject.id} style={styles.subjectCard}>
              <AppText variant="heading" style={styles.subjectTitle}>
                {subject.name}
              </AppText>
              <View style={styles.inputsRow}>
                <TextField
                  label="Classes attended"
                  value={entry.attendedText}
                  onChangeText={(value) =>
                    updateEntry(subject.id, { attendedText: value })
                  }
                  keyboardType="number-pad"
                  maxLength={4}
                  error={rowError}
                  editable={!busy}
                  containerStyle={styles.halfInput}
                />
                <TextField
                  label="Classes held"
                  value={entry.heldText}
                  onChangeText={(value) =>
                    updateEntry(subject.id, { heldText: value })
                  }
                  keyboardType="number-pad"
                  maxLength={4}
                  editable={!busy}
                  containerStyle={styles.halfInput}
                />
              </View>
            </Card>
          );
        })}
      </View>

      <Button
        title="Save"
        onPress={() => {
          void handleSave();
        }}
        loading={saving}
        disabled={busy}
        fullWidth
      />

      <AppText variant="caption" tone="muted" style={styles.helperText}>
        If you also added a college overall number, the overall uses that
        number, and these counts only change each subject&apos;s own percentage.
      </AppText>
    </View>
  );
}

export default function PastAttendanceScreen() {
  const { status, error, subjects, slots, reload } = useData();
  const [method, setMethod] = useState<PastMethod>('known');
  const [busy, setBusy] = useState(false);

  const subjectsKey = subjects
    .map((s) => `${s.id}:${s.initial_present}:${s.initial_total}`)
    .join('|');

  if (status === 'loading') {
    return (
      <Screen scroll edges={MODAL_EDGES} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Past attendance' }} />
        <View
          accessible
          accessibilityLabel="Loading past attendance"
          style={styles.skeletonGroup}
        >
          <Skeleton width="90%" height={20} />
          <Skeleton width="100%" height={46} />
          <Skeleton width="100%" height={120} />
          <Skeleton width="100%" height={120} />
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen edges={MODAL_EDGES} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Past attendance' }} />
        <ErrorState
          message={error ?? 'Something went wrong. Try again.'}
          onRetry={() => {
            void reload();
          }}
        />
      </Screen>
    );
  }

  if (subjects.length === 0) {
    return (
      <Screen edges={MODAL_EDGES} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Past attendance' }} />
        <EmptyState
          icon="book-outline"
          title="No subjects tracked yet"
          message="Add your subjects or import your timetable before entering past attendance."
          actionLabel="Import timetable from text"
          onAction={() => router.push('/timetable-import')}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: 'Past attendance' }} />
      <Screen scroll edges={MODAL_EDGES} contentContainerStyle={styles.content}>
        <AppText variant="body" tone="muted">
          Optional. Skip this if you only want to count classes from now on.
        </AppText>

        <Segmented
          options={METHOD_OPTIONS}
          value={method}
          onChange={setMethod}
          disabled={busy}
          compact
        />

        {method === 'known' ? (
          <KnownNumbersMethod
            key={subjectsKey}
            subjects={subjects}
            busy={busy}
            onBusyChange={setBusy}
          />
        ) : (
          <PastAttendanceEstimate
            subjects={subjects}
            slots={slots}
            busy={busy}
            onBusyChange={setBusy}
          />
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  skeletonGroup: {
    gap: spacing.md,
  },
  methodContainer: {
    gap: spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.dangerBg,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  errorIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  errorText: {
    flex: 1,
  },
  subjectList: {
    gap: spacing.md,
  },
  subjectCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  subjectTitle: {
    fontSize: 16,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  helperText: {
    lineHeight: 19,
  },
});
