import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stepper } from '@/components/ui/Stepper';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/context/AuthProvider';
import { useData } from '@/context/DataProvider';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/tokens';
import { type Subject } from '@/types/db';

const MODAL_EDGES = ['bottom', 'left', 'right'] as const;
const QUICK_TARGETS = [60, 65, 70, 75, 80, 85] as const;

function clampTarget(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 75;
  }
  return Math.min(95, Math.max(50, Math.round(value)));
}

interface SubjectFormBodyProps {
  existingSubject?: Subject;
  defaultTarget: number;
}

function SubjectFormBody({
  existingSubject,
  defaultTarget,
}: SubjectFormBodyProps) {
  const { addSubject, updateSubject, deleteSubject } = useData();
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
  const [initialPresent, setInitialPresent] = useState(
    existingSubject?.initial_present ?? 0
  );
  const [initialTotal, setInitialTotal] = useState(
    existingSubject?.initial_total ?? 0
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busyRef = useRef(false);

  const busy = saving || deleting;

  const clearError = () => {
    if (formError) {
      setFormError(null);
    }
  };

  const handleSave = async () => {
    if (busyRef.current) {
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 60) {
      setFormError('Enter a subject name between 1 and 60 characters.');
      return;
    }
    if (targetPercent < 50 || targetPercent > 95) {
      setFormError('Target attendance must be between 50% and 95%.');
      return;
    }
    if (hasInitial && initialPresent > initialTotal) {
      setFormError('Classes attended cannot be more than classes held.');
      return;
    }

    busyRef.current = true;
    setSaving(true);
    setFormError(null);

    try {
      const input = {
        name: trimmedName,
        target_percent: targetPercent,
        initial_present: hasInitial ? initialPresent : 0,
        initial_total: hasInitial ? initialTotal : 0,
      };

      if (existingSubject) {
        await updateSubject(existingSubject.id, input);
      } else {
        await addSubject(input);
      }

      router.back();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Save subject failed:', err);
      }
      setFormError(getFriendlyErrorMessage(err));
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
      router.back();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Delete subject failed:', err);
      }
      setFormError(getFriendlyErrorMessage(err));
    } finally {
      busyRef.current = false;
      setDeleting(false);
    }
  };

  const handleConfirmDelete = () => {
    if (busyRef.current || !existingSubject) {
      return;
    }

    Alert.alert(
      'Delete subject',
      `Delete ${existingSubject.name}? Its timetable classes and attendance records will be deleted too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void handleDelete();
          },
        },
      ]
    );
  };

  return (
    <Screen scroll edges={MODAL_EDGES} contentContainerStyle={styles.content}>
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

      <TextField
        label="Subject name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          clearError();
        }}
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
                    clearError();
                  }
                }}
                disabled={busy}
                scaleTo={0.95}
                rippleColor={
                  selected ? colors.rippleOnAccent : colors.rippleNeutral
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
                  pressed &&
                    !busy &&
                    (selected
                      ? styles.chipSelectedPressed
                      : styles.chipPressed),
                ]}
              >
                <AppText
                  variant="label"
                  tone={selected ? 'onAccent' : 'default'}
                  style={selected && styles.chipTextSelected}
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
            clearError();
          }}
          disabled={busy}
          style={styles.stepperRow}
        />
      </View>

      <View style={styles.section}>
        <Pressable
          onPress={() => {
            if (!busy) {
              setHasInitial((current) => !current);
              clearError();
            }
          }}
          disabled={busy}
          accessibilityRole="switch"
          accessibilityState={{ checked: hasInitial, disabled: busy }}
          style={styles.toggleRow}
        >
          <AppText variant="label" style={styles.toggleLabel}>
            I already have attendance this semester
          </AppText>
          <Switch
            value={hasInitial}
            onValueChange={(next) => {
              setHasInitial(next);
              clearError();
            }}
            disabled={busy}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.surface}
          />
        </Pressable>

        {hasInitial ? (
          <View style={styles.initialBox}>
            <Stepper
              label="Classes attended so far"
              value={initialPresent}
              min={0}
              max={999}
              step={1}
              onChange={(value) => {
                setInitialPresent(value);
                clearError();
              }}
              disabled={busy}
            />
            <Stepper
              label="Classes held so far"
              value={initialTotal}
              min={0}
              max={999}
              step={1}
              onChange={(value) => {
                setInitialTotal(value);
                clearError();
              }}
              disabled={busy}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          title="Save subject"
          onPress={() => {
            void handleSave();
          }}
          loading={saving}
          disabled={busy}
          fullWidth
        />
        {isEditing ? (
          <Button
            title="Delete subject"
            variant="danger"
            onPress={handleConfirmDelete}
            loading={deleting}
            disabled={busy}
            fullWidth
          />
        ) : null}
      </View>
    </Screen>
  );
}

export default function SubjectFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const subjectId =
    typeof params.id === 'string' && params.id.length > 0
      ? params.id
      : undefined;

  const { profile } = useAuth();
  const { subjects, status } = useData();

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
            <View
              accessible
              accessibilityLabel="Loading subject"
              style={styles.skeletonGroup}
            >
              <Skeleton width="45%" height={18} />
              <Skeleton width="100%" height={48} />
              <Skeleton width="100%" height={48} />
            </View>
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
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title }} />
      <SubjectFormBody
        key={existingSubject?.id ?? 'new'}
        existingSubject={existingSubject}
        defaultTarget={clampTarget(profile?.default_target)}
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
    gap: spacing.xl,
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
  chipTextSelected: {
    fontWeight: '600',
  },
  chipPressed: {
    backgroundColor: colors.surfacePressed,
  },
  chipSelectedPressed: {
    backgroundColor: colors.accentPressed,
  },
  stepperRow: {
    marginTop: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  toggleLabel: {
    flex: 1,
  },
  initialBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: spacing.md,
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  missingContainer: {
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  skeletonGroup: {
    gap: spacing.md,
  },
  missingButton: {
    alignSelf: 'flex-start',
  },
});
