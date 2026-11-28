import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { memo, type ReactNode, useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { PastAttendanceEstimate } from '@/components/PastAttendanceEstimate';
import { ModalFieldSkeleton } from '@/components/SkeletonLayouts';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ModalFormLayout } from '@/components/ui/ModalFormLayout';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { TextField } from '@/components/ui/TextField';
import { useDataActions, useDataState } from '@/context/DataProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type ThemeColors } from '@/theme/tokens';
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

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  headerGroup: {
    gap: spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.destructiveBg,
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
    gap: spacing.lg,
  },
  subjectCard: {
    padding: spacing.md,
    gap: spacing.md,
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
}));

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

interface KnownSubjectCardProps {
  subjectId: string;
  subjectName: string;
  attendedText: string;
  heldText: string;
  busy: boolean;
  onChangeEntry: (subjectId: string, patch: Partial<KnownCountsEntry>) => void;
}

const KnownSubjectCard = memo(function KnownSubjectCard({
  subjectId,
  subjectName,
  attendedText,
  heldText,
  busy,
  onChangeEntry,
}: KnownSubjectCardProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const attended = parseWholeNumber(attendedText);
  const held = parseWholeNumber(heldText);
  const rowError =
    attended !== null && held !== null && attended > held
      ? 'Attended cannot exceed held.'
      : undefined;

  return (
    <Card style={styles.subjectCard}>
      <AppText variant="heading">{subjectName}</AppText>
      <View style={styles.inputsRow}>
        <TextField
          label="Classes attended"
          value={attendedText}
          onChangeText={(value) =>
            onChangeEntry(subjectId, { attendedText: value })
          }
          keyboardType="number-pad"
          maxLength={4}
          error={rowError}
          editable={!busy}
          containerStyle={styles.halfInput}
        />
        <TextField
          label="Classes held"
          value={heldText}
          onChangeText={(value) =>
            onChangeEntry(subjectId, { heldText: value })
          }
          keyboardType="number-pad"
          maxLength={4}
          editable={!busy}
          containerStyle={styles.halfInput}
        />
      </View>
    </Card>
  );
});

function KnownNumbersMethod({
  subjects,
  busy,
  onBusyChange,
  header,
}: {
  subjects: readonly Subject[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  header: ReactNode;
}) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const { updateSubjectsStartingCounts } = useDataActions();
  const { showSnackbar } = useSnackbarActions();
  const [entriesBySubject, setEntriesBySubject] = useState<
    Record<string, KnownCountsEntry>
  >(() => buildInitialKnownMap(subjects));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const updateEntry = useCallback(
    (subjectId: string, patch: Partial<KnownCountsEntry>) => {
      setFormError((prev) => (prev ? null : prev));
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
    },
    []
  );

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
      await updateSubjectsStartingCounts(updates);
      showSnackbar('Past attendance saved.');
      router.back();
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      setFormError(message);
      showSnackbar({ message, tone: 'error' });
    } finally {
      savingRef.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  };

  return (
    <ModalFormLayout
      footer={
        <Button
          title="Save"
          onPress={() => {
            void handleSave();
          }}
          loading={saving}
          disabled={busy}
          fullWidth
        />
      }
    >
      {header}

      {formError ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={colors.destructiveText}
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
          return (
            <KnownSubjectCard
              key={subject.id}
              subjectId={subject.id}
              subjectName={subject.name}
              attendedText={entry.attendedText}
              heldText={entry.heldText}
              busy={busy}
              onChangeEntry={updateEntry}
            />
          );
        })}
      </View>

      <AppText variant="caption" tone="muted" style={styles.helperText}>
        If you also added a college overall number, the overall uses that
        number, and these counts only change each subject&apos;s own percentage.
      </AppText>
    </ModalFormLayout>
  );
}

export default function PastAttendanceScreen() {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const { status, error, subjects, slots } = useDataState();
  const { reload } = useDataActions();
  const [method, setMethod] = useState<PastMethod>('known');
  const [busy, setBusy] = useState(false);

  const subjectsKey = subjects
    .map((s) => `${s.id}:${s.initial_present}:${s.initial_total}`)
    .join('|');

  if (status === 'loading') {
    return (
      <Screen scroll edges={MODAL_EDGES} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Past attendance' }} />
        <ModalFieldSkeleton rows={4} />
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
            void reload(true);
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

  const header = (
    <View style={styles.headerGroup}>
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
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Past attendance' }} />
      {method === 'known' ? (
        <KnownNumbersMethod
          key={subjectsKey}
          subjects={subjects}
          busy={busy}
          onBusyChange={setBusy}
          header={header}
        />
      ) : (
        <PastAttendanceEstimate
          subjects={subjects}
          slots={slots}
          busy={busy}
          onBusyChange={setBusy}
          header={header}
        />
      )}
    </>
  );
}
