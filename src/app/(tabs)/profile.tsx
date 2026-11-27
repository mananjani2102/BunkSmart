import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RemindersCard } from '@/components/RemindersCard';
import { ProfileSkeleton } from '@/components/SkeletonLayouts';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ContentFade } from '@/components/ui/ContentFade';
import { Divider } from '@/components/ui/Divider';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { Stepper } from '@/components/ui/Stepper';
import { useAuthActions, useAuthState } from '@/context/AuthProvider';
import { useDataActions } from '@/context/DataProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import { formatFriendlyDateLabel } from '@/lib/dates';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
  type ThemeMode,
} from '@/theme/tokens';

const TARGET_PRESETS = [75, 80, 85] as const;

const APPEARANCE_OPTIONS: readonly SegmentedOption<ThemeMode>[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export default function ProfileScreen() {
  const { colors, scheme, mode, setMode } = useTheme();
  const styles = createStyles(colors, scheme);
  const { user, profile } = useAuthState();
  const { signOut, updateProfile } = useAuthActions();
  const { deleteAllAttendanceData } = useDataActions();
  const { showSnackbar } = useSnackbarActions();

  const [signingOut, setSigningOut] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [targetExpanded, setTargetExpanded] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const signingOutRef = useRef(false);
  const savingTargetRef = useRef(false);
  const deletingDataRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const metadataName =
    typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name.trim()
      : '';
  const displayName = profile?.full_name.trim() || metadataName || 'Student';
  const displayEmail = user?.email ?? 'Account Email';
  const currentTarget = pendingTarget ?? profile?.default_target ?? 75;
  const actionBusy = signingOut || savingTarget || deletingData;

  const startingAttendanceText =
    profile && profile.baseline_held > 0 && profile.baseline_date
      ? `${profile.baseline_attended} of ${profile.baseline_held} as of ${formatFriendlyDateLabel(profile.baseline_date)}`
      : 'Not set';

  const handleDefaultTargetChange = async (nextTarget: number) => {
    if (
      savingTargetRef.current ||
      deletingDataRef.current ||
      signingOutRef.current ||
      !profile ||
      nextTarget === profile.default_target
    ) {
      return;
    }

    savingTargetRef.current = true;
    setSavingTarget(true);
    setPendingTarget(nextTarget);
    setErrorMessage(null);

    try {
      await updateProfile({ default_target: nextTarget });
      showSnackbar(`Default target saved (${nextTarget}%).`);
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      setErrorMessage(message);
      showSnackbar({ message, tone: 'error' });
    } finally {
      savingTargetRef.current = false;
      setSavingTarget(false);
      setPendingTarget(null);
    }
  };

  const handleDeleteAllData = async () => {
    if (deletingDataRef.current || signingOutRef.current) {
      return;
    }

    deletingDataRef.current = true;
    setDeletingData(true);
    setErrorMessage(null);

    try {
      await deleteAllAttendanceData();
      setResetModalVisible(false);
      showSnackbar('All attendance data deleted.');
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      setErrorMessage(message);
      showSnackbar({ message, tone: 'error' });
    } finally {
      deletingDataRef.current = false;
      setDeletingData(false);
    }
  };

  const handleConfirmDeleteAllData = () => {
    if (deletingDataRef.current || signingOutRef.current) {
      return;
    }

    setErrorMessage(null);
    setResetModalVisible(true);
  };

  const handleSignOut = async () => {
    if (signingOutRef.current || deletingDataRef.current) {
      return;
    }

    signingOutRef.current = true;
    setSigningOut(true);
    setErrorMessage(null);

    try {
      await signOut();
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      setErrorMessage(message);
      showSnackbar({ message, tone: 'error' });
    } finally {
      signingOutRef.current = false;
      setSigningOut(false);
    }
  };

  return (
    <Screen scroll contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <AppText variant="title">Profile</AppText>

        <ContentFade loading={!profile} fallback={<ProfileSkeleton />}>
          {profile ? (
            <View style={styles.contentGroup}>
            {/* Account */}
            <View style={styles.section}>
              <AppText variant="caption" tone="muted" style={styles.sectionHeader}>
                Account
              </AppText>
              <Card style={styles.groupedCard}>
                <ListRow title="Name" rightText={displayName} />
                <Divider />
                <ListRow title="Email" rightText={displayEmail} />
              </Card>
            </View>

            {/* Attendance */}
            <View style={styles.section}>
              <AppText variant="caption" tone="muted" style={styles.sectionHeader}>
                Attendance
              </AppText>
              <Card style={styles.groupedCard}>
                <ListRow
                  title="Default target"
                  rightText={savingTarget ? 'Saving...' : `${currentTarget}%`}
                  chevron
                  disabled={actionBusy}
                  onPress={() => setTargetExpanded((prev) => !prev)}
                />

                {targetExpanded ? (
                  <View style={styles.targetEditor}>
                    <Stepper
                      label="Target percentage"
                      value={currentTarget}
                      min={50}
                      max={95}
                      step={1}
                      suffix="%"
                      disabled={!profile || actionBusy}
                      onChange={(nextValue) => {
                        void handleDefaultTargetChange(nextValue);
                      }}
                    />

                    <View style={styles.presetRow}>
                      {TARGET_PRESETS.map((preset) => {
                        const selected = currentTarget === preset;
                        return (
                          <Pressable
                            key={`preset-${preset}`}
                            onPress={() => {
                              void handleDefaultTargetChange(preset);
                            }}
                            disabled={!profile || actionBusy}
                            android_ripple={{
                              color: selected
                                ? colors.ripplePrimary
                                : colors.rippleNeutral,
                              foreground: true,
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Set target to ${preset} percent`}
                            accessibilityState={{ selected }}
                            style={({ pressed }) => [
                              styles.presetBtn,
                              selected && styles.presetBtnSelected,
                              pressed && !selected && styles.presetBtnPressed,
                            ]}
                          >
                            <AppText
                              variant="caption"
                              style={
                                selected
                                  ? styles.presetTextSelected
                                  : styles.presetText
                              }
                            >
                              {preset}%
                            </AppText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <Divider />

                <ListRow
                  title="Starting attendance"
                  subtitle={startingAttendanceText}
                  chevron
                  disabled={actionBusy}
                  onPress={() => router.push('/starting-attendance')}
                />
              </Card>
            </View>

            {/* Reminders */}
            <View style={styles.section}>
              <AppText variant="caption" tone="muted" style={styles.sectionHeader}>
                Reminders
              </AppText>
              <RemindersCard disabled={signingOut || deletingData} />
            </View>

            {/* Appearance */}
            <View style={styles.section}>
              <AppText variant="caption" tone="muted" style={styles.sectionHeader}>
                Appearance
              </AppText>
              <Segmented
                options={APPEARANCE_OPTIONS}
                value={mode}
                onChange={setMode}
              />
            </View>

            {/* About */}
            <View style={styles.section}>
              <AppText variant="caption" tone="muted" style={styles.sectionHeader}>
                About
              </AppText>
              <Card style={styles.groupedCard}>
                <ListRow
                  title="Privacy Policy"
                  chevron
                  accessibilityRole="link"
                  accessibilityLabel="Privacy Policy"
                  onPress={() => router.push('/legal/privacy')}
                />
                <Divider />
                <ListRow
                  title="Terms and Conditions"
                  chevron
                  accessibilityRole="link"
                  accessibilityLabel="Terms and Conditions"
                  onPress={() => router.push('/legal/terms')}
                />
                <Divider />
                <ListRow title="App version" rightText="1.0.0" />
              </Card>
            </View>

            {/* Data */}
            <View style={styles.section}>
              <AppText variant="caption" tone="muted" style={styles.sectionHeader}>
                Data
              </AppText>
              <Card style={styles.groupedCard}>
                <ListRow
                  title="Delete all attendance data"
                  destructive
                  disabled={actionBusy}
                  onPress={handleConfirmDeleteAllData}
                />
              </Card>
            </View>

            {errorMessage ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={colors.destructiveText}
                  style={styles.errorIcon}
                />
                <AppText variant="caption" tone="danger" style={styles.errorText}>
                  {errorMessage}
                </AppText>
              </View>
            ) : null}

            <Button
              title="Log out"
              variant="secondary"
              fullWidth
              loading={signingOut}
              disabled={actionBusy}
              onPress={() => {
                void handleSignOut();
              }}
            />
            </View>
          ) : null}
        </ContentFade>
      </View>

      <ConfirmModal
        visible={resetModalVisible}
        title="Delete all attendance data"
        message="This action will permanently delete every subject, timetable slot, and attendance record. Your account login remains active."
        confirmLabel="Delete"
        destructive
        loading={deletingData}
        error={errorMessage}
        onCancel={() => setResetModalVisible(false)}
        onConfirm={() => {
          void handleDeleteAllData();
        }}
      />
    </Screen>
  );
}

const createStyles = createThemedStyles((colors: ThemeColors) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: spacing.xxl + 24,
    },
    container: {
      paddingTop: spacing.xl,
      maxWidth: 680,
      width: '100%',
      alignSelf: 'center',
      gap: spacing.lg,
    },
    contentGroup: {
      gap: spacing.xl,
    },
    section: {
      gap: spacing.sm,
    },
    sectionHeader: {
      fontFamily: fontFamily.medium,
      paddingHorizontal: spacing.xs,
    },
    groupedCard: {
      padding: 0,
      overflow: 'hidden',
    },
    targetEditor: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      paddingTop: spacing.xs,
      gap: spacing.md,
    },
    presetRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    presetBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    presetBtnSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    presetBtnPressed: {
      backgroundColor: colors.secondary,
    },
    presetText: {
      fontFamily: fontFamily.medium,
      color: colors.foreground,
    },
    presetTextSelected: {
      fontFamily: fontFamily.semibold,
      color: colors.primaryForeground,
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
  })
);
