import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ModalFieldSkeleton } from '@/components/SkeletonLayouts';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ModalFormLayout } from '@/components/ui/ModalFormLayout';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { TextField } from '@/components/ui/TextField';
import { useAuthActions, useAuthState } from '@/context/AuthProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import { formatDisplayPercent } from '@/lib/attendance';
import { addDays, getTodayDateString } from '@/lib/dates';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';
import { type Profile } from '@/types/db';

const MODAL_EDGES = ['bottom', 'left', 'right'] as const;
const MAX_CLASSES = 2000;

type CutoffChoice = 'yesterday' | 'today';

const CUTOFF_OPTIONS: readonly SegmentedOption<CutoffChoice>[] = [
  { label: 'Before today', value: 'yesterday' },
  { label: 'Including today', value: 'today' },
];

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  loadingContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
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
  },
  bottomHelper: {
    lineHeight: 19,
  },
  destructiveTextBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  destructiveTextBtnPressed: {
    backgroundColor: colors.destructiveBg,
  },
  destructiveTextLabel: {
    fontFamily: fontFamily.medium,
  },
}));

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
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const { updateProfile } = useAuthActions();
  const { showSnackbar } = useSnackbarActions();

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
  const [attendedError, setAttendedError] = useState<string | undefined>(
    undefined
  );
  const [heldError, setHeldError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const busyRef = useRef(false);

  const busy = saving || removing;

  const clearErrors = () => {
    if (formError) setFormError(null);
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
      setAttendedError('Enter a whole number for classes attended.');
      return;
    }
    if (held === null) {
      setHeldError('Enter a whole number for classes held.');
      return;
    }
    if (held < 1) {
      setHeldError('Classes held must be at least 1.');
      return;
    }
    if (attended > MAX_CLASSES) {
      setAttendedError('Classes attended must be at most 2000.');
      return;
    }
    if (held > MAX_CLASSES) {
      setHeldError('Classes held must be at most 2000.');
      return;
    }
    if (attended > held) {
      setAttendedError('Attended classes cannot be more than held classes.');
      return;
    }

    const currentToday = getTodayDateString();
    const baselineDate =
      cutoffChoice === 'today' ? currentToday : addDays(currentToday, -1);

    busyRef.current = true;
    setSaving(true);
    setAttendedError(undefined);
    setHeldError(undefined);
    setFormError(null);

    try {
      await updateProfile({
        baseline_attended: attended,
        baseline_held: held,
        baseline_date: baselineDate,
      });
      showSnackbar('Starting attendance saved.');
      router.back();
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      setFormError(message);
      showSnackbar({ message, tone: 'error' });
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
      setRemoveModalVisible(false);
      showSnackbar('Starting attendance removed.');
      router.back();
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      setFormError(message);
      showSnackbar({ message, tone: 'error' });
    } finally {
      busyRef.current = false;
      setRemoving(false);
    }
  };

  const handleConfirmRemove = () => {
    if (busyRef.current) {
      return;
    }

    setFormError(null);
    setRemoveModalVisible(true);
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
      <AppText variant="body" tone="muted">
        Enter your overall attendance from your college portal. BunkSmart adds
        the classes you mark after that.
      </AppText>

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

      <TextField
        label="Classes attended (overall)"
        value={attendedText}
        onChangeText={(value) => {
          setAttendedText(value);
          if (attendedError) setAttendedError(undefined);
          clearErrors();
        }}
        error={attendedError}
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
          if (heldError) setHeldError(undefined);
          clearErrors();
        }}
        error={heldError}
        keyboardType="number-pad"
        placeholder="0"
        maxLength={4}
        editable={!busy}
        returnKeyType="done"
        helperText="Whole number from 1 to 2000"
      />

      <View style={styles.section}>
        <AppText variant="label">Counts up to</AppText>
        <Segmented
          options={CUTOFF_OPTIONS}
          value={cutoffChoice}
          onChange={(nextChoice) => {
            setCutoffChoice(nextChoice);
            clearErrors();
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

      <AppText variant="caption" tone="muted" style={styles.bottomHelper}>
        Classes you mark on or before the chosen date still count in each
        subject, but not again in the overall number.
      </AppText>

      {hasExistingBaseline ? (
        <Pressable
          onPress={handleConfirmRemove}
          disabled={busy}
          android_ripple={
            !busy ? { color: colors.rippleNeutral, foreground: true } : undefined
          }
          accessibilityRole="button"
          accessibilityLabel="Remove starting attendance"
          style={({ pressed }) => [
            styles.destructiveTextBtn,
            pressed && !busy && styles.destructiveTextBtnPressed,
          ]}
        >
          <AppText
            variant="label"
            tone="danger"
            style={styles.destructiveTextLabel}
          >
            Remove starting attendance
          </AppText>
        </Pressable>
      ) : null}

      <ConfirmModal
        visible={removeModalVisible}
        title="Remove starting attendance"
        message="Your overall attendance will be calculated only from the classes you track in BunkSmart."
        confirmLabel="Remove"
        destructive
        loading={removing}
        error={formError}
        onCancel={() => setRemoveModalVisible(false)}
        onConfirm={() => {
          void handleRemove();
        }}
      />
    </ModalFormLayout>
  );
}

export default function StartingAttendanceScreen() {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const { profile } = useAuthState();

  if (!profile) {
    return (
      <Screen edges={MODAL_EDGES} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: 'Starting attendance' }} />
        <ModalFieldSkeleton rows={4} />
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Starting attendance' }} />
      <StartingAttendanceBody
        key={`${profile.id}:${profile.baseline_date ?? 'none'}:${profile.baseline_held}:${profile.baseline_attended}`}
        profile={profile}
      />
    </>
  );
}
