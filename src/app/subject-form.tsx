import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { ModalFieldSkeleton } from '@/components/SkeletonLayouts';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ModalFormLayout } from '@/components/ui/ModalFormLayout';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Stepper } from '@/components/ui/Stepper';
import { TextField } from '@/components/ui/TextField';
import { useAuthState } from '@/context/AuthProvider';
import { useDataActions, useDataState } from '@/context/DataProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';
import { type Subject } from '@/types/db';

const MODAL_EDGES = ['bottom', 'left', 'right'] as const;
const QUICK_TARGETS = [60, 65, 70, 75, 80, 85] as const;

const getStyles = createThemedStyles((colors: ThemeColors) => ({
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
  section: {
    gap: spacing.md,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipContainer: {
    minWidth: 64,
    minHeight: 44,
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
  chipTextDefault: {
    color: colors.foreground,
    fontFamily: fontFamily.medium,
  },
  chipTextSelected: {
    color: colors.primaryForeground,
    fontFamily: fontFamily.semibold,
  },
  chipPressed: {
    backgroundColor: colors.muted,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  toggleRowPressed: {
    backgroundColor: colors.muted,
  },
  toggleLabel: {
    flex: 1,
  },
  initialBox: {
    gap: spacing.lg,
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
  missingContainer: {
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  missingButton: {
    alignSelf: 'flex-start',
  },
}));

function clampTarget(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 75;
  }
  return Math.min(95, Math.max(50, Math.round(value)));
}

function parseWholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0 || value > 999) {
    return null;
  }
  return value;
}

interface SubjectFormBodyProps {
  existingSubject?: Subject;
  defaultTarget: number;
}

function SubjectFormBody({
  existingSubject,
  defaultTarget,
}: SubjectFormBodyProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const { addSubject, updateSubject, deleteSubject } = useDataActions();
  const { showSnackbar } = useSnackbarActions();
  const isEditing = Boolean(existingSubject);

  const [name, setName] = useState(existingSubject?.name ?? '');
  const [targetPercent, setTargetPercent] = useState(
    existingSubject ? existingSubject.target_percent : defaultTarget
  );
  const [hasInitial, setHasInitial] = useState(
    existingSubject
      ? existingSubject.initial_total > 0 || existingSubject.initial_present > 0
      : false
  );
  const [initialPresentText, setInitialPresentText] = useState(
    String(existingSubject?.initial_present ?? 0)
  );
  const [initialTotalText, setInitialTotalText] = useState(
    String(existingSubject?.initial_total ?? 0)
  );
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [initialError, setInitialError] = useState<string | undefined>(
    undefined
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const busyRef = useRef(false);

  const busy = saving || deleting;

  const clearErrors = () => {
    if (formError) setFormError(null);
  };

  const handleSave = async () => {
    if (busyRef.current) {
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 60) {
      setNameError('Enter a subject name between 1 and 60 characters.');
      return;
    }
    if (targetPercent < 50 || targetPercent > 95) {
      setFormError('Target attendance must be between 50% and 95%.');
      return;
    }

    let initialPresent = 0;
    let initialTotal = 0;

    if (hasInitial) {
      const parsedPresent = parseWholeNumber(initialPresentText);
      const parsedTotal = parseWholeNumber(initialTotalText);
      if (parsedPresent === null || parsedTotal === null) {
        setInitialError('Enter whole numbers between 0 and 999.');
        return;
      }
      if (parsedPresent > parsedTotal) {
        setInitialError('Classes attended cannot be more than classes held.');
        return;
      }
      initialPresent = parsedPresent;
      initialTotal = parsedTotal;
    }

    busyRef.current = true;
    setSaving(true);
    setNameError(undefined);
    setInitialError(undefined);
    setFormError(null);

    try {
      const input = {
        name: trimmedName,
        target_percent: targetPercent,
        initial_present: initialPresent,
        initial_total: initialTotal,
      };

      if (existingSubject) {
        await updateSubject(existingSubject.id, input);
        showSnackbar('Subject saved.');
      } else {
        await addSubject(input);
        showSnackbar('Subject added.');
      }

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

  const handleDelete = async () => {
    if (busyRef.current || !existingSubject) {
      return;
    }

    busyRef.current = true;
    setDeleting(true);
    setFormError(null);

    try {
      await deleteSubject(existingSubject.id);
      setDeleteModalVisible(false);
      showSnackbar('Subject deleted.');
      router.back();
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      setFormError(message);
      showSnackbar({ message, tone: 'error' });
    } finally {
      busyRef.current = false;
      setDeleting(false);
    }
  };

  const handleConfirmDelete = () => {
    if (busyRef.current || !existingSubject) {
      return;
    }

    setFormError(null);
    setDeleteModalVisible(true);
  };

  return (
    <ModalFormLayout
      footer={
        <Button
          title="Save subject"
          onPress={() => {
            void handleSave();
          }}
          loading={saving}
          disabled={busy}
          fullWidth
        />
      }
    >
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
        label="Subject name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          if (nameError) setNameError(undefined);
          clearErrors();
        }}
        error={nameError}
        maxLength={60}
        editable={!busy}
        autoCapitalize="words"
        returnKeyType="done"
        helperText="1 to 60 characters"
      />

      <View style={styles.section}>
        <AppText variant="label">Target attendance</AppText>

        <View style={styles.chipGrid}>
          {QUICK_TARGETS.map((preset) => {
            const selected = targetPercent === preset;
            return (
              <PressableScale
                key={preset}
                onPress={() => {
                  if (!busy) {
                    setTargetPercent(preset);
                    clearErrors();
                  }
                }}
                disabled={busy}
                scaleTo={0.95}
                rippleColor={
                  selected ? colors.ripplePrimary : colors.rippleNeutral
                }
                accessibilityRole="button"
                accessibilityLabel={`Set target to ${preset}%`}
                accessibilityState={{ selected, disabled: busy }}
                containerStyle={[
                  styles.chipContainer,
                  selected && styles.chipSelected,
                ]}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && !busy && !selected && styles.chipPressed,
                ]}
              >
                <AppText
                  variant="label"
                  style={
                    selected ? styles.chipTextSelected : styles.chipTextDefault
                  }
                >
                  {preset}%
                </AppText>
              </PressableScale>
            );
          })}
        </View>

        <Stepper
          label="Target percentage"
          value={targetPercent}
          min={50}
          max={95}
          step={1}
          suffix="%"
          onChange={(value) => {
            setTargetPercent(value);
            clearErrors();
          }}
          disabled={busy}
        />
      </View>

      <View style={styles.section}>
        <Pressable
          onPress={() => {
            if (!busy) {
              setHasInitial((current) => !current);
              setInitialError(undefined);
              clearErrors();
            }
          }}
          disabled={busy}
          android_ripple={
            !busy ? { color: colors.rippleNeutral, foreground: true } : undefined
          }
          accessibilityRole="switch"
          accessibilityLabel="I already have attendance this semester"
          accessibilityState={{ checked: hasInitial, disabled: busy }}
          style={({ pressed }) => [
            styles.toggleRow,
            pressed && !busy && styles.toggleRowPressed,
          ]}
        >
          <AppText variant="label" style={styles.toggleLabel}>
            I already have attendance this semester
          </AppText>
          <Switch
            value={hasInitial}
            onValueChange={(next) => {
              setHasInitial(next);
              setInitialError(undefined);
              clearErrors();
            }}
            disabled={busy}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.primaryForeground}
          />
        </Pressable>

        {hasInitial ? (
          <View style={styles.initialBox}>
            <TextField
              label="Classes attended so far"
              value={initialPresentText}
              onChangeText={(value) => {
                setInitialPresentText(value);
                if (initialError) setInitialError(undefined);
                clearErrors();
              }}
              error={initialError}
              keyboardType="number-pad"
              maxLength={3}
              editable={!busy}
              returnKeyType="next"
            />
            <TextField
              label="Classes held so far"
              value={initialTotalText}
              onChangeText={(value) => {
                setInitialTotalText(value);
                if (initialError) setInitialError(undefined);
                clearErrors();
              }}
              keyboardType="number-pad"
              maxLength={3}
              editable={!busy}
              returnKeyType="done"
            />
          </View>
        ) : null}
      </View>

      {isEditing ? (
        <Pressable
          onPress={handleConfirmDelete}
          disabled={busy}
          android_ripple={
            !busy ? { color: colors.rippleNeutral, foreground: true } : undefined
          }
          accessibilityRole="button"
          accessibilityLabel="Delete subject"
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
            Delete subject
          </AppText>
        </Pressable>
      ) : null}

      {existingSubject ? (
        <ConfirmModal
          visible={deleteModalVisible}
          title="Delete subject"
          message={`Delete ${existingSubject.name}? Its timetable classes and attendance records will be deleted too.`}
          confirmLabel="Delete"
          destructive
          loading={deleting}
          error={formError}
          onCancel={() => setDeleteModalVisible(false)}
          onConfirm={() => {
            void handleDelete();
          }}
        />
      ) : null}
    </ModalFormLayout>
  );
}

export default function SubjectFormScreen() {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const params = useLocalSearchParams<{ id?: string }>();
  const subjectId =
    typeof params.id === 'string' && params.id.length > 0
      ? params.id
      : undefined;

  const { profile } = useAuthState();
  const { subjects, status } = useDataState();

  const existingSubject = subjectId
    ? subjects.find((item) => item.id === subjectId)
    : undefined;
  const isEditing = Boolean(subjectId);
  const title = isEditing ? 'Edit subject' : 'New subject';

  if (isEditing && !existingSubject) {
    return (
      <Screen edges={MODAL_EDGES}>
        <Stack.Screen options={{ title }} />
        <View style={styles.missingContainer}>
          {status === 'loading' ? (
            <ModalFieldSkeleton rows={4} />
          ) : (
            <>
              <AppText variant="body" tone="muted">
                Subject not found.
              </AppText>
              <Button
                title="Go back"
                variant="secondary"
                onPress={() => router.back()}
                style={styles.missingButton}
              />
            </>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <SubjectFormBody
        key={existingSubject?.id ?? 'new'}
        existingSubject={existingSubject}
        defaultTarget={clampTarget(profile?.default_target)}
      />
    </>
  );
}
