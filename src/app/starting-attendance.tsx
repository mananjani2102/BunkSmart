import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/context/AuthProvider';
import { formatDisplayPercent } from '@/lib/attendance';
import { addDays, getTodayDateString } from '@/lib/dates';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/tokens';
import { type Profile } from '@/types/db';

const MODAL_EDGES = ['bottom', 'left', 'right'] as const;
const MAX_CLASSES = 2000;

type CutoffChoice = 'yesterday' | 'today';

const CUTOFF_OPTIONS: readonly SegmentedOption<CutoffChoice>[] = [
  { label: 'Before today', value: 'yesterday' },
  { label: 'Including today', value: 'today' },
];

function parseWholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) {
    return null;
  }
  return value;
}

interface StartingAttendanceBodyProps {
  profile: Profile;
}

function StartingAttendanceBody({ profile }: StartingAttendanceBodyProps) {
  const { updateProfile } = useAuth();

  const hasExistingBaseline =
    profile.baseline_held > 0 &&
    typeof profile.baseline_date === 'string' &&
    profile.baseline_date.trim().length > 0;

  const today = getTodayDateString();
  const initialChoice: CutoffChoice =
    hasExistingBaseline && profile.baseline_date === today
      ? 'today'
      : 'yesterday';

  const [attendedText, setAttendedText] = useState(
    hasExistingBaseline ? String(profile.baseline_attended) : ''
  );
  const [heldText, setHeldText] = useState(
    hasExistingBaseline ? String(profile.baseline_held) : ''
  );
  const [cutoffChoice, setCutoffChoice] = useState<CutoffChoice>(initialChoice);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const busyRef = useRef(false);

  const busy = saving || removing;

  const clearError = () => {
    if (formError) {
      setFormError(null);
    }
  };

  const parsedAttended = parseWholeNumber(attendedText);
  const parsedHeld = parseWholeNumber(heldText);
  const previewValid =
    parsedAttended !== null &&
    parsedHeld !== null &&
    parsedHeld >= 1 &&
    parsedAttended <= parsedHeld &&
    parsedHeld <= MAX_CLASSES;
  const previewPercent = previewValid
    ? formatDisplayPercent(parsedAttended, parsedHeld)
    : formatDisplayPercent(0, 0);

  const handleSave = async () => {
    if (busyRef.current) {
      return;
    }

    const attended = parseWholeNumber(attendedText);
    const held = parseWholeNumber(heldText);

    if (attended === null) {
      setFormError('Enter a whole number for classes attended.');
      return;
    }
    if (held === null) {
      setFormError('Enter a whole number for classes held.');
      return;
    }
    if (held < 1) {
      setFormError('Classes held must be at least 1.');
      return;
    }
    if (attended > MAX_CLASSES || held > MAX_CLASSES) {
      setFormError('Classes attended and held must be at most 2000.');
      return;
    }
    if (attended > held) {
      setFormError('Attended classes cannot be more than held classes.');
      return;
    }

    const currentToday = getTodayDateString();
    const baselineDate =
      cutoffChoice === 'today' ? currentToday : addDays(currentToday, -1);

    busyRef.current = true;
    setSaving(true);
    setFormError(null);

    try {
      await updateProfile({
        baseline_attended: attended,
        baseline_held: held,
        baseline_date: baselineDate,
      });
      router.back();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Save starting attendance failed:', err);
      }
      setFormError(getFriendlyErrorMessage(err));
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setRemoving(true);
    setFormError(null);

    try {
      await updateProfile({
        baseline_attended: 0,
        baseline_held: 0,
        baseline_date: null,
      });
      router.back();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Remove starting attendance failed:', err);
      }
      setFormError(getFriendlyErrorMessage(err));
    } finally {
      busyRef.current = false;
      setRemoving(false);
    }
  };

  const handleConfirmRemove = () => {
    if (busyRef.current) {
      return;
    }

    Alert.alert(
      'Remove starting attendance',
      'Your overall attendance will be calculated only from the classes you track in BunkSmart.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void handleRemove();
          },
        },
      ]
    );
  };

  return (
    <Screen scroll edges={MODAL_EDGES} contentContainerStyle={styles.content}>
      <AppText variant="body" tone="muted">
        Enter your overall attendance from your college portal. BunkSmart adds
        the classes you mark after that.
      </AppText>

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

      <View style={styles.fieldsGroup}>
        <TextField
          label="Classes attended (overall)"
          value={attendedText}
          onChangeText={(value) => {
            setAttendedText(value);
            clearError();
          }}
          keyboardType="number-pad"
          placeholder="0"
          maxLength={4}
          editable={!busy}
          returnKeyType="next"
          helperText="Whole number from 0 to 2000"
        />

        <TextField
          label="Classes held (overall)"
          value={heldText}
          onChangeText={(value) => {
            setHeldText(value);
            clearError();
          }}
          keyboardType="number-pad"
          placeholder="0"
          maxLength={4}
          editable={!busy}
          returnKeyType="done"
          helperText="Whole number from 1 to 2000"
        />
      </View>

      <View style={styles.section}>
        <AppText variant="label">Counts up to</AppText>
        <Segmented
          options={CUTOFF_OPTIONS}
          value={cutoffChoice}
          onChange={(nextChoice) => {
            setCutoffChoice(nextChoice);
            clearError();
          }}
          disabled={busy}
        />
        <AppText variant="caption" tone="muted">
          If your portal already counts today&apos;s classes, choose Including
          today.
        </AppText>
      </View>

      <Card style={styles.previewCard}>
        <View style={styles.previewRow}>
          <AppText variant="label" tone="muted">
            Preview
          </AppText>
          <AppText variant="heading" style={styles.previewValue}>
            {previewPercent}
          </AppText>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          title="Save"
          onPress={() => {
            void handleSave();
          }}
          loading={saving}
          disabled={busy}
          fullWidth
        />
        {hasExistingBaseline ? (
          <Button
            title="Remove starting attendance"
            variant="danger"
            onPress={handleConfirmRemove}
            loading={removing}
            disabled={busy}
            fullWidth
          />
        ) : null}
      </View>

      <AppText variant="caption" tone="muted" style={styles.bottomHelper}>
        Classes you mark on or before the chosen date still count in each
        subject, but not again in the overall number.
      </AppText>
    </Screen>
  );
}

export default function StartingAttendanceScreen() {
  const { profile } = useAuth();

  if (!profile) {
    return (
      <Screen edges={MODAL_EDGES} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Starting attendance' }} />
        <View
          accessible
          accessibilityLabel="Loading starting attendance"
          style={styles.skeletonGroup}
        >
          <Skeleton width="90%" height={40} />
          <Skeleton width="100%" height={48} />
          <Skeleton width="100%" height={48} />
          <Skeleton width="100%" height={46} />
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: 'Starting attendance' }} />
      <StartingAttendanceBody
        key={`${profile.id}:${profile.baseline_date ?? 'none'}:${profile.baseline_held}:${profile.baseline_attended}`}
        profile={profile}
      />
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
  fieldsGroup: {
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
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
  previewCard: {
    padding: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewValue: {
    fontVariant: ['tabular-nums'],
    color: colors.accent,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  bottomHelper: {
    lineHeight: 19,
  },
  skeletonGroup: {
    gap: spacing.md,
  },
});
